import { moveAndWait, randomMoveAndBack } from "../actions/movement.js";
import DeliverooClient from "../api/deliverooClient.js";
import { MapStore } from "../models/mapStore.js";
import { Me } from "../models/me.js";
import { ParcelsStore } from "../models/parcelsStore.js";
import { INTENTIONS } from "../utils/intentions.js";
import { goingTowardsParcel } from "../utils/geometry.js";
import { astarSearch, direction } from "../utils/astar.js";
import { coord2Key, key2Coord } from "../utils/hashMap.js";
import { LOG_LEVELS } from "../utils/log.js";
import { log } from "../utils/log.js";
import { AgentStore } from "../models/agentStore.js";
import { TILE_TYPES } from "../utils/tile.js";
import { ServerConfig } from "../models/serverConfig.js";
import config from "../utils/gameConfig.js";

export class Agent {
  /**
   * @param {DeliverooClient} client
   * @param {Me}              me
   * @param {ParcelsStore}    parcels
   * @param {MapStore}        mapStore
   * @param {AgentStore}      agentStore
   * @param {ServerConfig}    serverConfig
   */
  constructor(client, me, parcels, mapStore, agentStore, serverConfig) {
    this.client = client;
    this.me = me;
    this.parcels = parcels;
    this.mapStore = mapStore;
    this.agentStore = agentStore;
    this.serverConfig = serverConfig;

    // BDI structures
    this.desires = [];
    this.intentions = [];
    this.lastIntention = {  // Out last intentions
      type: null,
    };

    // Pathfinding 
    this.pathIndex = 0; // Move to perform (from path)
    this.path = [];     // Path got from A*

    this.oldTime = null;    // Keep track of last loop time

    this.isMoving = false;  // flag to check if it's already perfoming an action -> to not get penalties

    // Explore timers
    this.isExploring = false;
    this.isCamping = false;
    this.campingStartFrame = 0;

    // Agent collision timers
    this.isColliding = false;
    this.agentCollisionStartTime = 0;

    // Log section
    this.logLevels = [];
    // this.logLevels.push(LOG_LEVELS.MASTER);
    // this.logLevels.push(LOG_LEVELS.ACTION);
  }


  log(logLevel, ...args) {
    log(this.logLevels, logLevel, ...args);
  }


  updateBeliefs() {
    // Get frame difference
    if (this.oldTime === null) {
      this.oldTime = this.me.ms;
    }
    const timeDiff = this.me.ms - this.oldTime;
    this.oldTime = this.me.ms;

    // Update parcels
    this.parcels.updateData(timeDiff / 1000, this.me.frame, this.agentStore.map.size, this.serverConfig);
  }

  /**
    * Filter options into current desires based on state:
    * Generate all possible desires (pickup and deposit) and let the agent choose the best one
    */
  generateDesires() {
    this.desires = [];
  

    let myParcels = this.parcels.carried(this.me.id);
    let carried_value = myParcels.reduce((sum, parcel) => sum + parcel.reward, 0);
    let carried_count = myParcels.length;
    const clockPenalty = this.serverConfig.clock / 1000;

    const roundedMe = {x : Math.round(this.me.x), y : Math.round(this.me.y)};

    // For all parcels available, calculate potential reward
    for (const p of this.parcels.available) {

      p.calculatePotentialPickUpReward(roundedMe, true, carried_value, carried_count, this.mapStore, clockPenalty, this.serverConfig);
      
      let pickUpScoreMaster = p.potentialPickUpReward;

      this.desires.push({ type: INTENTIONS.GO_PICKUP, parcel: p, score: pickUpScoreMaster });
    }

    //If we have parcels, consider deposit option
    if (carried_count > 0) {
      let [base, minDist] = this.mapStore.nearestBase(this.me);
      let deposit_score = carried_value - minDist * carried_count * clockPenalty / this.serverConfig.parcels_decaying_interval;

      this.desires.push({ type: INTENTIONS.GO_DEPOSIT, score: deposit_score });
    }

    // Explore come fallback
    this.desires.push({ type: INTENTIONS.EXPLORE, score: 0.0001 });
  }


  filterIntentions() {
    this.intentions = this.desires.sort((a, b) => { return b.score - a.score });
  }


  async act() {
    for (let intentionIndex = 0; intentionIndex < this.intentions.length; intentionIndex++) {

      // Get current intention
      const intention = this.intentions[intentionIndex];

      let isEqualToLastIntention = intention.type === this.lastIntention.type;

      switch (intention.type) {

        // If pickup -> check if there are other agents
        case INTENTIONS.GO_PICKUP:
          isEqualToLastIntention = isEqualToLastIntention && intention.parcel.id === this.lastIntention.parcel.id;

          let p = intention.parcel;

          let visibleAgents = this.agentStore.visible(this.me, this.serverConfig);

          if (visibleAgents.length > 0) {

            let canPickup = true;
            const myDist = this.mapStore.distance(this.me, p)

            for (let a of visibleAgents) {
              const agentDist = this.mapStore.distance(a, p);

              if (agentDist < myDist && (agentDist <= 1 || goingTowardsParcel(a, p))) {
                canPickup = false;
                break;
              }
            }

            if (!canPickup) {
              // Skip the parcel and pick the next intention in order
              continue;
            }
          }

          this.lastIntention = intention;

          // If program is here, the parcel can be pickup by us
          return this.achievePickup(p, isEqualToLastIntention, false);
        case INTENTIONS.GO_DEPOSIT:
          this.lastIntention = intention;
          return this.achieveDeposit(isEqualToLastIntention);
        case INTENTIONS.EXPLORE:
          this.lastIntention = intention;
          return this.achieveExplore(isEqualToLastIntention);
        default:
          this.lastIntention = intention;
          return;
      }
    }
  }

  async achievePickup(p, isEqualToLastIntention, isFromDropped) {
    
    this.log(LOG_LEVELS.MASTER, "GO_PICKUP");
    
    // Move towards the parcel and pick up
    if (!isEqualToLastIntention) {
      this.getNewPath(p);
    }

    this.oneStepCheckAgents(p);
    // this.oneStep();
    if (this.me.x === p.x && this.me.y === p.y) {
      await this.client.emitPickup();
    }
  }

  async achieveDeposit(isEqualToLastIntention) {
    
    this.log(LOG_LEVELS.MASTER, "GO_DEPOSIT");
    
    // Use helper to move to nearest base
    if (!isEqualToLastIntention) {

      let [base, minDist] = this.mapStore.nearestBase(this.me);
      this.getBasePath(base);

      this.currentNearestBase = base;
    }

    this.oneStepCheckAgents(null);
    if (this.me.x === this.currentNearestBase.x && this.me.y === this.currentNearestBase.y) {
      this.isMoving = true;
      this.log(LOG_LEVELS.ACTION, "PUTDOWN");
      await this.client.emitPutdown(this.parcels, this.me.id);
      this.isMoving = false;
    }
  }

  async achieveExplore(isEqualToLastIntention) {

    this.log(LOG_LEVELS.MASTER, "EXPLORE");

    const wasCamping = this.isCamping;

    const isOnSpawn = this.mapStore.map.get(coord2Key(this.me)) === TILE_TYPES.SPAWN;
    const spawnIsSparse = this.mapStore.isSpawnSparse;

    if (wasCamping) {
      this.isCamping = spawnIsSparse && (this.me.frame - this.campingStartFrame < config.CAMP_TIME);
    }
    else {
      this.isCamping = !this.isExploring && spawnIsSparse && isOnSpawn;
    }

    // If spawn is not sparse OR we are not on a green tile
    if (!this.isCamping) {
      
      if (!isEqualToLastIntention || wasCamping) {
        let spawnTileCoord = this.mapStore.randomSpawnTile(this.me.id);
        this.isExploring = true;
        this.getNewPath(spawnTileCoord);
      }

      this.oneStepCheckAgents(null);
      if (this.pathIndex >= this.path.length) {
        this.isExploring = false;
      }
    }
    // Camping behaviour
    else {
      if (!wasCamping) {
        this.campingStartFrame = this.me.frame;
      }

      this.isMoving = true;
      await randomMoveAndBack(this.client, this.me, this.mapStore);
      this.isMoving = false;
    }
  }

  /**
   * Performs one step of the agent path, checking if there are collision with other agents
   * @param {{x : number, y : number}} newPathTile
   */
  async oneStepCheckAgents(newPathTile) {

    if (this.pathIndex >= this.path.length) {
      this.lastIntention = { type: null };
      return;
    }

    const visibleAgents = this.agentStore.visible(this.me, this.serverConfig);

    // Check if any agent is in the tile i want to go
    const nextTile = this.path[this.pathIndex];

    for (let a of visibleAgents) {
      // If there's an agent in the tile i want to go
      if (a.x === nextTile.x && a.y === nextTile.y) {

        // Set colliding (only first time)
        if (!this.isColliding) {
          this.isColliding = true;
          this.agentCollisionStartTime = Date.now();
        }

        // After timer expires -> get new path
        const secondsElapsed = (Date.now() - this.agentCollisionStartTime) / 1000;
        if (secondsElapsed > config.AGENT_TIME) {
          this.isColliding = false;

          switch (this.lastIntention.type) {
            case INTENTIONS.GO_PICKUP :
              break;
            case INTENTIONS.GO_DEPOSIT :
              const [base, minDist] = this.mapStore.nearestBase(this.me);
              this.currentNearestBase = base;
              newPathTile = base;
              break;
            case INTENTIONS.EXPLORE :
              const spawnTileCoord = this.mapStore.randomSpawnTile(this.me.id);
              this.isExploring = true;
              newPathTile = spawnTileCoord;
              break;
            default :
              break;
          }

          if (this.lastIntention.type === INTENTIONS.GO_DEPOSIT) {
            this.getBasePath(newPathTile);
          }
          else {
            this.getNewPath(newPathTile);
          }
        }

        return;
      }
    }

    this.isColliding = false;

    // If everything is clear -> move
    await this.oneStep();
  }

  /**
   * Performs one step of the agent path, updating the path index
   */
  async oneStep() {
    if (this.pathIndex >= this.path.length) {
      this.lastIntention = { type: null };
      return;
    }

    this.isMoving = true;

    const dir = direction(this.me, this.path[this.pathIndex]);
    if (dir) {
      this.log(LOG_LEVELS.ACTION, "Moving ", dir);
      await moveAndWait(this.client, this.me, dir);
    }

    this.isMoving = false;

    this.pathIndex++;
  }

  /**
   * Get A* path
   * @param {{x : number, y : number}} target 
   */
  getPath(target) {
    this.pathIndex = 0;
    this.path = astarSearch({ x: Math.round(this.me.x), y: Math.round(this.me.y) }, target, this.mapStore);
  }

  /**
   * Get A* path, removing visible agents
   * @param {{x : number, y : number}} target 
   */
  getNewPath(target) {
    this.pathIndex = 0;

    let tileMapTemp = new Map();

    // Remove tiles with agents
    for (const a of this.agentStore.visible(this.me, this.serverConfig)) {
      let type = this.mapStore.setType(a, TILE_TYPES.EMPTY);
      tileMapTemp.set(coord2Key(a), type);
    }

    this.path = astarSearch({ x: Math.round(this.me.x), y: Math.round(this.me.y) }, target, this.mapStore);

    // Re-add tiles
    for (const [key, value] of tileMapTemp) {
      let tile = key2Coord(key);
      this.mapStore.setType(tile, value);
    }
  }

  /**
   * Get A* path to base, removing visible agents
   * @param {{x : number, y : number}} target 
   */
  getBasePath(target) {
    let tries = 0;

    do {
      // Check if #tries expired
      if (tries % config.BASE_TRIES === 0 && tries > 0) {
        
        // Delete base from map
        this.mapStore.setType(target, TILE_TYPES.EMPTY);

        // Re-add seconds later
        const restoreTarget = { x: target.x, y: target.y };  // snapshot
        setTimeout(() => {
          this.mapStore.setType(restoreTarget, TILE_TYPES.BASE);
        }, config.BASE_REMOVAL_TIME);

        // Find new target
        const [base, minDist] = this.mapStore.nearestBase(this.me);

        if (base === null || base === undefined) {
          return;
        }

        this.currentNearestBase = base;

        target = base;
      }

      if (this.me.x === target.x && this.me.y === target.y)
        return;

      // Check if it exists a path to the nearest base (without the one removed from the map)
      this.getNewPath(target);

      tries++;

    } while (this.path.length === 0 && tries < config.BASE_SWITCH_MAX_TRIES);
  }
}
