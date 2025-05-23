import { moveAndWait} from "../actions/movement.js";
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

export class Agent {
  /**
   * @param {DeliverooClient} client
   * @param {Me}              me
   * @param {ParcelsStore}    parcels
   * @param {MapStore}        mapStore
   * @param {AgentStore}      agentStore
   */
  constructor(client, me, parcels, mapStore, agentStore) {
    this.client   = client;
    this.me       = me;
    this.parcels  = parcels;
    this.mapStore = mapStore;
    this.agentStore = agentStore;

    this.pathIndex = 0; // Move to perform (from path)
    this.path = [];     // Path got from A*

    this.penaltyCounter = 0;
    this.oldPenalty = null;

    this.lastIntention = {  // Out last intentions
      type: null,
    };

    this.currentNearestBase = null; // Nearest base from our position

    this.oldTime = null;    // Keep track of last loop time
    this.ms_per_move = 10; // Timeout for each move

    this.desires    = []; // Desires
    this.intentions = []; // Intensions

    this.isMoving = false;  // flag to check if it's already perfoming an action -> to not get penalties

    // Log section
    this.logLevels = [];
    // this.logLevels.push(LOG_LEVELS.AGENT);
    this.logLevels.push(LOG_LEVELS.ACTION);
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
    this.parcels.updateData(timeDiff / 1000, this.me.frame, this.agentStore.map.size);

    //update penalty
    if (this.oldPenalty === null) {
      this.oldPenalty = this.me.penalty;
    }
    const penaltyDiff = this.me.penalty - this.oldPenalty;
    this.oldPenalty = this.me.penalty;

    if (penaltyDiff === 0) {
      this.penaltyCounter = 0;
    }
    else {
      this.penaltyCounter += penaltyDiff;
    }
  }

  /**
   * Filter options into current desires based on state:
   * - GO_DEPOSIT if carrying any parcels
   * - GO_PICKUP if there are parcels available
   * - EXPLORE otherwise
   */
  generateDesires() {
    this.desires = [];

    let myParcels = this.parcels.carried(this.me.id);
    let carried_value = myParcels.reduce((sum, parcel) => sum + parcel.reward, 0);

    for (const p of this.parcels.available) {
      // Calculate score of picking the parcel and then going home
      let pickup_score = carried_value + p.reward 
        - (this.mapStore.distance(this.me, p) + p.baseDistance) * (myParcels.length + 1) * (this.ms_per_move / 1000);
      
      this.desires.push({type : INTENTIONS.GO_PICKUP, parcel : p , score : pickup_score});
    }

    if (myParcels.length > 0) {
      // Calculate score of going home
      let [base, minDist] = this.mapStore.nearestBase(this.me);
      let home_score = carried_value - minDist * myParcels.length * (this.ms_per_move / 1000);

      this.desires.push({type : INTENTIONS.GO_DEPOSIT, score : home_score});
    }

    this.desires.push({type : INTENTIONS.EXPLORE, score : 0.0001});
  }

  filterIntentions() {
    this.intentions = this.desires.sort((a, b) => {return b.score - a.score});
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
  
          let visibleAgents = this.agentStore.visible(this.me);
      
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
                // Drop the parcel and pick the next intention in order
                continue;
            }
          }

          

          this.lastIntention = intention;
          // If program is here, the parcel can be pickup by us
          return this.achievePickup(p, isEqualToLastIntention, this.penaltyCounter <=- 3);
        case INTENTIONS.GO_DEPOSIT:
          this.lastIntention = intention;
          return this.achieveDeposit(isEqualToLastIntention, this.penaltyCounter <=- 3);
        case INTENTIONS.EXPLORE:
          this.lastIntention = intention;
          return this.achieveExplore(isEqualToLastIntention, this.penaltyCounter <=- 3);
        default:
          this.lastIntention = intention;
          return;
      }
    }
  }

  async achievePickup(p, isEqualToLastIntention, getNewPath) {
    this.log(LOG_LEVELS.AGENT, "GO_PICKUP");

    // move towards the parcel and pick up
    if (!isEqualToLastIntention && !getNewPath) {
      // await smartMove(this.client, this.me, p, this.mapStore);
      this.getPath(p);
    }
    else if (getNewPath) {
      this.getNewPath(p);
    }
    
    this.oneStep();
    if (this.me.x === p.x && this.me.y === p.y) {
      await this.client.emitPickup();
    }
  }

  async achieveDeposit(isEqualToLastIntention, getNewPath) {
    this.log(LOG_LEVELS.AGENT, "GO_DEPOSIT");
    //const mePos = { x: this.me.x, y: this.me.y };

    // use helper to move to nearest base
  if (!isEqualToLastIntention && !getNewPath) {

      let [base, minDist] = this.mapStore.nearestBase(this.me);
      this.getPath(base);

      this.currentNearestBase = base;
    }
    else if (getNewPath) {
      let [base, minDist] = this.mapStore.nearestBase(this.me);
      this.getNewPath(this.currentNearestBase);

      this.currentNearestBase = base;
    }

    this.oneStep();
    if (this.me.x === this.currentNearestBase.x && this.me.y === this.currentNearestBase.y) {
        this.isMoving = true;
        this.log(LOG_LEVELS.ACTION, "PUTDOWN");
        await this.client.emitPutdown(this.parcels, this.me.id);
        this.isMoving = false;
    }
  }

  async achieveExplore(isEqualToLastIntention, getNewPath) {
    this.log(LOG_LEVELS.AGENT, "EXPLORE");
    // Explore
    if (!isEqualToLastIntention && !getNewPath) {
      let spawnTileCoord = this.mapStore.randomSpawnTile
      this.getPath(spawnTileCoord);
    }
    else if (getNewPath) {
      let spawnTileCoord = this.mapStore.randomSpawnTile
      this.getNewPath(spawnTileCoord);
    }
    this.oneStep();
  }

  /**
   * Performs one step of the agent path, updating the path index
   */
  async oneStep(){
    if (this.pathIndex >= this.path.length) {
      this.lastIntention = {type : null};
      return;
    }
    
    this.isMoving = true;

    const dir = direction (this.me, this.path[this.pathIndex]);
    if (dir){
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
  getPath(target){
    this.pathIndex = 0;
    this.path = astarSearch({x : Math.round(this.me.x), y : Math.round(this.me.y)}, target, this.mapStore);
  }

  /**
   * Get A* path, removing visible agents
   * @param {{x : number, y : number}} target 
   */
  getNewPath(target) {
    this.pathIndex = 0;
    this.penaltyCounter = 0;
    
    let tileMapTemp = new Map();

    // Remove tiles with agents
    for (const a of this.agentStore.visible(this.me)) {
      let type = this.mapStore.setType({x : a.x, y : a.y}, 0);
      tileMapTemp.set(coord2Key(a), type);
    }

    this.path = astarSearch({x : Math.round(this.me.x), y : Math.round(this.me.y)}, target, this.mapStore);
    
    // Re-add tiles
    for (const [key, value] of tileMapTemp) {
      let tile = key2Coord(key);
      this.mapStore.setType(tile, value);
    }
  }
}
