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
import gameConfig from "../utils/gameConfig.js";

/**
 * Agent class representing an agent in the game.
 * This class encapsulates the agent's beliefs, desires, intentions, and pathfinding logic.
 * It interacts with the game server through a client and manages its own state, including movement, exploration, and collision handling.
 * @class
 * @param {DeliverooClient} client - The client to communicate with the server.
 * @param {Me} me - The agent's own data, including its position and state.
 * @param {ParcelsStore} parcels - The parcels store to manage parcels in the game.
 * @param {MapStore} mapStore - The map store to manage the game map.
 * @param {AgentStore} agentStore - The agent store to manage other agents in the game.
 * @param {ServerConfig} serverConfig - The server configuration containing game settings.
 * @description
 * The Agent class is responsible for managing the agent's actions and interactions within the game.
 * It maintains the agent's beliefs, desires, and intentions, and uses pathfinding algorithms to navigate the game map.
 * The agent can perform actions such as picking up parcels, depositing them at bases, and exploring the map.
 * It also handles agent collisions and camping behavior based on the game state.
 * The agent's actions are logged for debugging and analysis purposes.
 */
export class Agent {
 /**
  * Agent constructor
  * @param {*} client - The client to communicate with the server
  * @param {Me} me - The agent's own data
  * @param {ParcelsStore} parcels - The parcels store to manage parcels
  * @param {MapStore} mapStore - The map store to manage the game map
  * @param {AgentStore} agentStore - The agent store to manage other agents
  * @param {ServerConfig} serverConfig - The server configuration
  * @constructor
  * @description
  * This constructor initializes the agent with the provided client, own data, parcels, map store, agent store, and server configuration.
  * It sets up the agent's beliefs, desires, intentions, and pathfinding structures.
  * It also initializes various flags and timers for movement, exploration, camping, and agent collision handling.
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
    this.campingStartTime = 0;

    // Agent collision timers
    this.isColliding = false;
    this.agentCollisionStartTime = 0;

    // Log section
    this.logLevels = [];
  }


  /**
   * Logs messages based on the provided log level and arguments.
   * @param {string} logLevel - The log level to filter messages (e.g., LOG_LEVELS.MASTER, LOG_LEVELS.ACTION)
   * @param {...*} args - The arguments to log, can be any type (string, object, etc.)
   * @returns {void}
   * @description
   * This method checks if the provided log level is included in the agent's log levels.
   * If it is, it calls the `log` function with the log levels, log level, and arguments.
   * This allows for flexible logging of messages based on the agent's current log configuration.
   * @example
   * agent.log(LOG_LEVELS.MASTER, "This is a master log message");
   * @example
   * agent.log(LOG_LEVELS.ACTION, "This is an action log message", { somjeData: 123 });
   */
  log(logLevel, ...args) {
    log(this.logLevels, logLevel, ...args);
  }

/**
 * Updates the agent's beliefs based on the current state of the game.
 * This method calculates the frame difference since the last update, updates the parcels data,
 * and updates the agent's beliefs about the game state.
 * @returns {void}
 * @description
 * This method is typically called in each game loop to keep the agent's beliefs up-to-date with the current game state.
 */
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
  * Generates desires for the agent based on the current state of the game.
  * This method evaluates the available parcels, calculates potential rewards for picking them up,
  * and considers depositing carried parcels at the nearest base.
  * @description
  * This method is called to determine the agent's desires, which are then used to form intentions.
  * It evaluates the agent's current state, including carried parcels and their rewards,
  * and generates a list of desires with associated scores.
  * It also considers the agent's position on the map and the distance to available parcels.
  * If the agent is carrying parcels, it will also consider depositing them at the nearest base.
  * Finally, it adds an intention to explore if no other intentions are more desirable.
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
      
      // Calculate distance
      const distanceToParcel = this.mapStore.distance(roundedMe, p);
      // If parcel is below us, pickup (might see some other parcel that is more valuable and leave that on the ground)
      if (distanceToParcel === 0) {
        this.desires.push({ type: INTENTIONS.GO_PICKUP, parcel: p, score: gameConfig.PICKUP_NEAR_PARCEL });
        continue;
      }

      p.calculatePotentialPickUpReward(roundedMe, true, carried_value, carried_count, this.mapStore, clockPenalty, this.serverConfig);
      
      let pickUpScoreMaster = p.potentialPickUpReward;

      this.desires.push({ type: INTENTIONS.GO_PICKUP, parcel: p, score: pickUpScoreMaster });
    }

    //If we have parcels, consider deposit option
    if (carried_count > 0) {
      let [base, minDist] = this.mapStore.nearestBase(this.me);

      // If we are on a base, drop instantly (might see some other parcel that is more valuable and not drop the parcels)
      if (minDist === 0) {
        this.desires.push({ type: INTENTIONS.GO_DEPOSIT, score: gameConfig.DEPOSIT_INSTANTLY });
      }
      else {
        let deposit_score = carried_value - minDist * carried_count * clockPenalty / this.serverConfig.parcels_decaying_interval;
  
        this.desires.push({ type: INTENTIONS.GO_DEPOSIT, score: deposit_score });
      }
    }

    // Explore come fallback
    this.desires.push({ type: INTENTIONS.EXPLORE, score: 0.0001 });
  }


  /**
   * Filters the agent's intentions based on their scores.
   * This method sorts the desires in descending order of their scores and updates the intentions list.
   * @description
   * This method is typically called after generating desires to prioritize the most desirable actions for the agent.
   * It ensures that the agent acts on the most valuable intentions first, based on their calculated scores.
   */
  filterIntentions() {
    this.intentions = this.desires.sort((a, b) => { return b.score - a.score });
  }


  /**
   * Acts on the agent's intentions.
   * This method iterates through the agent's intentions and performs actions based on their types.
   * It handles pickup, deposit, and exploration intentions, checking for conditions such as agent visibility and parcel availability.
   * @description
   * This method is called in each game loop to execute the agent's intentions based on the current game state.
   * It ensures that the agent acts on its most pressing intentions while considering the environment and other agents.
   */
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

  /**
   * Achieves the pickup of a parcel.
   * This method moves the agent towards the specified parcel and attempts to pick it up.
   * @param {Object} p - The parcel to be picked up, containing its coordinates and ID.
   * @param {boolean} isEqualToLastIntention - Indicates if the current intention is the same as the last one.
   * @param {boolean} isFromDropped - Indicates if the pickup is from a dropped parcel.
   * @description
   * This method is called when the agent intends to pick up a parcel.
   * It checks if the agent is already at the parcel's location and emits a pickup event if so.
   * If the agent is not at the parcel's location, it calculates a new path towards the parcel and checks for collisions with other agents.
   * If the agent reaches the parcel's coordinates, it emits a pickup event to the server.
   */
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

  /**
   * Achieves the deposit of parcels at the nearest base.
   * This method moves the agent towards the nearest base and attempts to deposit carried parcels.
   * @param {boolean} isEqualToLastIntention - Indicates if the current intention is the same as the last one.
   * @description
   * This method is called when the agent intends to deposit parcels.
   * It checks if the agent is already at the nearest base and emits a putdown event if so.
   * If the agent is not at the base, it calculates a new path towards the base and checks for collisions with other agents.
   * If the agent reaches the base's coordinates, it emits a putdown event to deposit the carried parcels.
   */
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

  /**
   * Achieves the exploration of the map.
   * This method moves the agent towards a random spawn tile and checks for camping conditions.
   * If the agent is camping, it will perform random movements until the camping conditions are no longer met.
   * @param {boolean} isEqualToLastIntention - Indicates if the current intention is the same as the last one.
   * @description
   * This method is called when the agent intends to explore the map.
   * It checks if the agent is camping on a spawn tile and updates the camping state based on the elapsed time.
   * If the agent is not camping, it calculates a new path towards a random spawn tile and checks for collisions with other agents.
   * If the agent reaches the spawn tile, it will either continue exploring or camp based on the spawn's sparsity.
   * If the agent is camping, it will perform random movements until the camping conditions are no longer met.
   */
  async achieveExplore(isEqualToLastIntention) {

    this.log(LOG_LEVELS.MASTER, "EXPLORE");

    const wasCamping = this.isCamping;

    const isOnSpawn = this.mapStore.map.get(coord2Key(this.me)) === TILE_TYPES.SPAWN;
    const spawnIsSparse = this.mapStore.isSpawnSparse;

    if (wasCamping) {
      const secondsElapsed = (Date.now() - this.campingStartTime) / 1000;
      this.isCamping = spawnIsSparse && (secondsElapsed < config.CAMP_TIME);
    }
    else {
      this.isCamping = !this.isExploring && spawnIsSparse && isOnSpawn;
    }

    // If spawn is not sparse OR we are not on a green tile
    if (!this.isCamping) {
      
      if (!isEqualToLastIntention || wasCamping) {
        let spawnTileCoord = this.mapStore.randomSpawnTile(this.me);
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
        this.campingStartFrame = Date.now();
      }

      this.isMoving = true;
      await randomMoveAndBack(this.client, this.me, this.mapStore);
      this.isMoving = false;
    }
  }

/**
 * Checks for agent collisions and performs one step of the agent's path.
 * This method checks if the agent is colliding with another agent in the next tile of its path.
 * If a collision is detected, it sets the colliding flag and starts a timer.
 * If the timer expires, it gets a new path based on the last intention.
 * If there are no collisions, it performs one step of the agent's path.
 * @param {Object} newPathTile - The tile to which the agent should move if a collision is detected.
 * @description
 * This method is called in each game loop to handle agent movement and collision detection.
 * It ensures that the agent can navigate the map while avoiding collisions with other agents.
 * If a collision is detected, it will wait for a specified time before attempting to get a new path.
 * If no collisions are detected, it will proceed with the next step in the agent's path.
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
              const spawnTileCoord = this.mapStore.randomSpawnTile(this.me);
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
 * Performs one step of the agent's path.
 * This method moves the agent towards the next tile in its path and updates the path index.
 * If the agent has reached the end of its path, it resets the last intention.
 * @description
 * This method is called in each game loop to move the agent towards its next destination.
 * It calculates the direction to the next tile in the path and performs the movement action.
 * If the agent has reached the end of its path, it resets the last intention to indicate that no further action is needed. 
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
 * Get A* path to a target tile
 * @param {{x : number, y : number}} target - The target coordinates to which the agent should find a path.
 * @description
 * This method calculates a path from the agent's current position to the specified target using the A* algorithm.
 * It initializes the path index to 0 and stores the calculated path in the agent's path property.
 * The path is used to determine the agent's movement towards the target tile.
 * @example
 * agent.getPath({ x: 5, y: 10 });
 */
  getPath(target) {
    this.pathIndex = 0;
    this.path = astarSearch({ x: Math.round(this.me.x), y: Math.round(this.me.y) }, target, this.mapStore);
  }

/**
 * Get A* path to a target tile, removing visible agents from the map
 * @param {{x : number, y : number}} target - The target coordinates to which the agent should find a path.
 * @description
 * This method calculates a path from the agent's current position to the specified target using the A* algorithm.
 * It initializes the path index to 0 and temporarily removes visible agents from the map to avoid collisions.
 * The path is then calculated and stored in the agent's path property.
 * After the path is calculated, the removed agents are restored to their original tile types.
 * This allows the agent to find a path without being blocked by other agents while still considering their presence in the game.
 * @example
 * agent.getNewPath({ x: 5, y: 10 });
 * */
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
   * Get a path to the nearest base, removing the current base from the map if necessary.
   * @param {{x : number, y : number}} target - The target coordinates of the nearest base to which the agent should find a path.
   * @description
   * This method attempts to find a path to the nearest base tile.
   * If the agent is already at the target base, it returns immediately.
   * If the agent is not at the target base, it checks if the path to the base is clear.
   * If the path is not clear, it removes the current base from the map and waits for a specified time before restoring it.
   * It then finds a new target base and recalculates the path to it.
   * This process continues until a valid path is found or the maximum number of tries is reached.
   * @example
   * agent.getBasePath({ x: 10, y: 15 });
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
