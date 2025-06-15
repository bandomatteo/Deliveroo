import { moveAndWait, randomMoveAndBack, goAway, getNearTiles } from "../actions/movement.js";
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
import { Communication } from "../models/communication.js";
import { getPickupScore } from "../utils/misc.js";
import config from "../utils/gameConfig.js";
import gameConfig from "../utils/gameConfig.js";

/**
 * MultiAgent class for managing multi-agent interactions in the Deliveroo game.
 * It handles desires, intentions, and actions of agents, including pathfinding and communication.
 * It supports both master and slave agents, allowing them to coordinate actions and share information.
 * The class implements a BDI (Belief-Desire-Intention) architecture to manage agent behavior.
 * It includes methods for generating desires, filtering intentions, and executing actions based on the current state of the game.
 * The agent can perform actions such as picking up parcels, depositing them, exploring the map, and avoiding collisions with other agents.
 * It also manages the agent's state, including movement, camping, and collision detection.
 * The class is designed to be extensible, allowing for the addition of new intentions and actions as needed.
 * @class 
 * @param {DeliverooClient} client - The client instance for API communication.
 * @param {Me} me - The agent's own state.
 * @param {Me} mate - The mate agent's state (for master agents, this is the slave agent).
 * @param {ParcelsStore} parcels - The store for managing parcels.
 * @param {MapStore} mapStore - The store for managing the game map.
 * @param {AgentStore} agentStore - The store for managing agents.
 * @param {Communication} communication - The communication model for the agent.
 * @param {ServerConfig} serverConfig - The server configuration for the game.
 * @param {boolean} isMaster - Flag to check if the agent is a master agent.
 * @property {DeliverooClient} client - The client instance for API communication.
 * @description
 * The MultiAgent class implements a BDI architecture to manage agent behavior in the Deliveroo game.
 * It allows agents to generate desires based on the current state of the game, filter those desires into intentions, and execute actions accordingly.
 * The class supports both master and slave agents, enabling them to coordinate actions and share information.
 * It includes methods for pathfinding, collision detection, and managing the agent's state, such as movement, camping, and exploring the map.
 * The agent can perform actions such as picking up parcels, depositing them, exploring the map, and avoiding collisions with other agents.
 * The class is designed to be extensible, allowing for the addition of new intentions and actions as needed.
 * It also includes logging functionality to track agent actions and intentions
 */
export class MultiAgent {
  constructor(client, me, mate, parcels, mapStore, agentStore, communication, serverConfig, isMaster) {
    this.client = client;
    this.me = me;
    this.mate = mate; // For master agent, the mate is the slave agent
    this.parcels = parcels;
    this.mapStore = mapStore;
    this.agentStore = agentStore;
    this.serverConfig = serverConfig;
    this.isMaster = isMaster; // Flag to check if it's a master agent
    this.communication = communication; // Communication model for the agent

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
   * Logs messages based on the log level.
   * @param {string} logLevel - The log level to filter messages.
   * @param {...any} args - The messages to log.
   * @description
   * This method logs messages to the console based on the specified log level.
   * It uses the `log` utility function to filter and format the messages according to the log levels defined in the class.
   * The log levels can include master, slave, and action logs, allowing for flexible logging of agent actions and intentions.
   * @example
   * // Log a master level message
   * agent.log(LOG_LEVELS.MASTER, "This is a master level message");
   * @example
   * // Log a slave level message
   * agent.log(LOG_LEVELS.SLAVE, "This is a slave level message");
   */
  log(logLevel, ...args) {
    log(this.logLevels, logLevel, ...args);
  }


  /**
   * Updates the agent's beliefs based on the current state of the game.
   * It calculates the frame difference and updates the parcels data accordingly.
   * @description
   * This method is called to update the agent's beliefs about the game state.
   * It calculates the time difference since the last update and uses it to update the parcels data.
   * The parcels data is updated based on the current frame and the server configuration.
   * This method is essential for keeping the agent's beliefs up-to-date, allowing it to make informed decisions based on the latest game state.
   * @example
   * // Update the agent's beliefs
   * agent.updateBeliefs();
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
  * Generates desires based on the current state of the game.
  * It considers the agent's carried parcels, the distance to the nearest base, and the presence of other agents.
  * It calculates potential rewards for picking up parcels and decides on actions such as picking up, depositing, or exploring.
  * @description
  * This method is responsible for generating the agent's desires based on the current game state.
  * It evaluates the agent's carried parcels, calculates potential rewards for picking up new parcels, and considers the distance to the nearest base.
  * It also checks for the presence of other agents and their actions, allowing the agent to make informed decisions about its next actions.
  * The desires are sorted by score, with higher scores indicating more desirable actions.
  * The method also handles special cases, such as dropping parcels when close to a mate agent or moving away if another agent is stuck.
  * The generated desires are stored in the `this.desires` array, which is later filtered to create intentions for the agent to act upon.
  * @example
  * // Generate desires based on the current game state
  * agent.generateDesires();
  * @returns {void}
 */
  generateDesires() {
    this.desires = [];
  

    let myParcels = this.parcels.carried(this.me.id);
    let carried_value = myParcels.reduce((sum, parcel) => sum + parcel.reward, 0);
    let carried_count = myParcels.length;
    const clockPenalty = this.serverConfig.clock / 1000;

    const roundedMe = {x : Math.round(this.me.x), y : Math.round(this.me.y)};
    const roundedMate = {x : Math.round(this.mate.x), y : Math.round(this.mate.y)};

    //If we have a mate close to us, drop carried parcels
    if (this.mapStore.distance(roundedMe, roundedMate) <= 1 && carried_count > 0) {
      let [base, minDist] = this.mapStore.nearestBase(this.me);
      let [baseMate, minDistMate] = this.mapStore.nearestBase(this.mate);
      
      if (minDist > minDistMate) {
        this.desires.push({ type: INTENTIONS.DROP_AND_GO_AWAY, score: gameConfig.EXCHANGE_PARCELS });
        return;
      }
    }
    
    // Move away if other agent is stuck
    if (this.communication.moveAwayAgentId === this.me.id) {
      this.desires.push({ type: INTENTIONS.GO_AWAY, score: gameConfig.FREE_MATE });
      return;
    }
    
    // For all parcels available, calculate potential reward
    for (const p of this.parcels.available) {

      let pickUpScoreMaster = -1;
      let pickUpScoreSlave = -1;

      // If is the parcel dropped, do not consider (score is -1)
      if (p.x !== this.communication.droppedCoord.x || p.y !== this.communication.droppedCoord.y 
          || this.communication.agentToPickup === this.me.id
          || (p.x === this.me.x && p.y === this.me.y)) {

        // Calculate distance
        const distanceToParcel = this.mapStore.distance(roundedMe, p);
        // If parcel is below us, pickup (might see some other parcel that is more valuable and leave that on the ground)
        if (distanceToParcel === 0) {
          this.desires.push({ type: INTENTIONS.GO_PICKUP, parcel: p, score: gameConfig.PICKUP_NEAR_PARCEL });
          continue;
        }
        
        p.calculatePotentialPickUpReward(roundedMe, this.isMaster, carried_value, carried_count, this.mapStore, clockPenalty, this.serverConfig);
        p.calculatePotentialPickUpReward(roundedMate, !this.isMaster, carried_value, carried_count, this.mapStore, clockPenalty, this.serverConfig);
      
        pickUpScoreMaster = p.potentialPickUpReward;
        pickUpScoreSlave = p.potentialPickUpRewardSlave;
      }

      if (this.isMaster === true) {
        if (pickUpScoreMaster >= pickUpScoreSlave) {
          this.desires.push({ type: INTENTIONS.GO_PICKUP, parcel: p, score: pickUpScoreMaster });
        }
      }
      else {
        if (pickUpScoreSlave > pickUpScoreMaster) {
          this.desires.push({ type: INTENTIONS.GO_PICKUP, parcel: p, score: pickUpScoreSlave });
        }
      }
    }

    // Dropped parcels
    if (this.communication.droppedValue > 0 && this.communication.agentToPickup === this.me.id) {
      const dropPickupReward = getPickupScore(this.me, this.communication.droppedCoord, carried_value, carried_count, 
                                              this.communication.droppedValue, this.communication.droppedQuantity, 
                                              this.communication.droppedBaseDistance, clockPenalty, this.mapStore, this.serverConfig);
      
      this.desires.push({ type: INTENTIONS.GO_PICKUP, parcel: this.communication.droppedCoord, score: dropPickupReward, isFromDropped : true });
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

    // Explore
    this.desires.push({ type: INTENTIONS.EXPLORE, score: 0.0001 });
  }

/**
 * Filters the desires into intentions based on their scores.
 * It sorts the desires in descending order of score and updates the intentions array.
 * @description
 * This method filters the agent's desires into intentions by sorting them based on their scores.
 * It ensures that the most desirable actions are prioritized for execution.
 * The intentions are sorted in descending order, with higher scores indicating more desirable actions.
 * The filtered intentions are stored in the `this.intentions` array, which is later used to determine the agent's actions.
 * @example
 * // Filter the desires into intentions
 * agent.filterIntentions();
 * @returns {void}
 */
  filterIntentions() {
    this.intentions = this.desires.sort((a, b) => { return b.score - a.score });
  }

/**
 * Executes the agent's actions based on the current intentions.
 * It iterates through the intentions and performs actions such as picking up parcels, depositing them, exploring, or moving away.
 * It checks for conditions such as whether the intention is equal to the last intention and handles agent collisions.
 * @description
 * This method is responsible for executing the agent's actions based on its current intentions.
 * It iterates through the intentions and performs actions such as picking up parcels, depositing them, exploring the map, or moving away from other agents.
 * It checks for conditions such as whether the current intention is equal to the last intention and handles agent collisions.
 * The method uses helper methods to achieve specific actions, such as `achievePickup`, `achieveDeposit`, `achieveDropAndGoAway`, `achieveGoAway`, and `achieveExplore`.
 * The agent's actions are performed in a sequential manner, ensuring that it follows its intentions and updates its state accordingly.
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
              // Drop the parcel and pick the next intention in order
              continue;
            }
          }

          this.lastIntention = intention;
          // If program is here, the parcel can be pickup by us
          const isFromDropped = intention.hasOwnProperty("isFromDropped") && intention.isFromDropped;
          return this.achievePickup(p, isEqualToLastIntention, isFromDropped);
        case INTENTIONS.GO_DEPOSIT:
          this.lastIntention = intention;
          return this.achieveDeposit(isEqualToLastIntention);
        case INTENTIONS.DROP_AND_GO_AWAY:
          this.lastIntention = intention;
          return this.achieveDropAndGoAway();
        case INTENTIONS.GO_AWAY:
          this.lastIntention = intention;
          return this.achieveGoAway();
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
 * Achieves the pickup action by moving towards the parcel and picking it up.
 * It checks if the intention is equal to the last intention and handles the pickup accordingly.
 * @param {Object} p - The parcel to be picked up.
 * @param {boolean} isEqualToLastIntention - Flag to check if the intention is equal to the last intention.
 * @param {boolean} isFromDropped - Flag to check if the pickup is from a dropped parcel.
 * @description
 * This method is responsible for achieving the pickup action by moving towards the specified parcel and picking it up.
 * It checks if the current intention is equal to the last intention and updates the path accordingly.
 * If the agent is already at the parcel's location, it emits a pickup event to the server.
 * If the pickup is from a dropped parcel, it resets the drop communication.
 * The method uses the `oneStepCheckAgents` method to check for collisions with other agents before performing the pickup action.
 * The agent's state is updated to reflect the pickup action, and it logs the action based on whether it is a master or slave agent.
 */
  async achievePickup(p, isEqualToLastIntention, isFromDropped) {
    
    if (this.isMaster) {
      this.log(LOG_LEVELS.MASTER, "GO_PICKUP");
    }
    else {
      this.log(LOG_LEVELS.SLAVE, "GO_PICKUP");
    }

    // Move towards the parcel and pick up
    if (!isEqualToLastIntention) {
      this.getNewPath(p);
    }

    this.oneStepCheckAgents(p);
    // this.oneStep();
    if (this.me.x === p.x && this.me.y === p.y) {
      await this.client.emitPickup();

      if (isFromDropped) {
        this.communication.resetDrop();
      }
    }
  }

  /**
   * Achieves the deposit action by moving to the nearest base and depositing carried parcels.
   * It checks if the intention is equal to the last intention and handles the deposit accordingly.
   * @param {boolean} isEqualToLastIntention - Flag to check if the intention is equal to the last intention.
   * @description
   * This method is responsible for achieving the deposit action by moving to the nearest base and depositing the carried parcels.
   * It checks if the current intention is equal to the last intention and updates the path to the nearest base accordingly.
   * If the agent is already at the base's location, it emits a putdown event to the server.
   * The method uses the `oneStepCheckAgents` method to check for collisions with other agents before performing the deposit action.
   * The agent's state is updated to reflect the deposit action, and it logs the action based on whether it is a master or slave agent.
   */
  async achieveDeposit(isEqualToLastIntention) {
    if (this.isMaster) {
      this.log(LOG_LEVELS.MASTER, "GO_DEPOSIT");}
    else {
      this.log(LOG_LEVELS.SLAVE, "GO_DEPOSIT");
    }

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
   * Achieves the drop and go away action by dropping carried parcels and moving away.
   * It checks if there are possible moves and handles the drop and go away action accordingly.
   * @description
   * This method is responsible for achieving the drop and go away action by dropping the carried parcels and moving away from the current location.
   * It checks if there are possible moves available and, if so, sets the dropped state, puts down the parcels, and moves away.
   * If there are no possible moves, it communicates with the mate agent to move away.
   * The method updates the agent's state to reflect the drop and go away action, and it logs the action based on whether it is a master or slave agent.
   */
  async achieveDropAndGoAway() {
    const myParcels = this.parcels.carried(this.me.id);
    const carried_value = myParcels.reduce((sum, parcel) => sum + parcel.reward, 0);
    
    // Check if there's a possibility to move
    const possibleMoves = getNearTiles(this.mapStore, this.me, this.mate, {x : undefined, y : undefined});
    if (possibleMoves.length === 0) {
      
      // Tell the other agent to move away
      this.communication.moveAwayAgentId = this.mate.id;
      return;
    }

    // 1. Set dropped
    // 2. Putdown parcels
    // 3. Go away

    this.isMoving = true;

    this.communication.setDropped(this.me, carried_value, myParcels.length, this.mate.id, this.mapStore);
    await this.client.emitPutdown(this.parcels, this.me.id);
    await goAway(this.client, this.me, this.mate, this.mapStore);
    this.isMoving = false;
  }

  /**
   * Achieves the go away action by moving away from the current location.
   * It checks if there are possible moves and handles the go away action accordingly.
   * @description
   * This method is responsible for achieving the go away action by moving away from the current location.
   * It checks if there are possible moves available and, if so, moves away from the current location.
   * If there are no possible moves, it communicates with the mate agent to move away.
   * The method updates the agent's state to reflect the go away action, and it logs the action based on whether it is a master or slave agent.
   */
  async achieveGoAway() {
    this.isMoving = true;
    await goAway(this.client, this.me, this.mate, this.mapStore);
    this.isMoving = false;
    this.communication.moveAwayAgentId = null;
  }

  /**
   * Achieves the explore action by moving to a random spawn tile or camping on the spawn.
   * It checks if the intention is equal to the last intention and handles the explore action accordingly.
   * @param {boolean} isEqualToLastIntention - Flag to check if the intention is equal to the last intention.
   * @description
   * This method is responsible for achieving the explore action by moving to a random spawn tile or camping on the spawn.
   * It checks if the current intention is equal to the last intention and updates the path to a random spawn tile accordingly.
   * If the agent is camping, it saves the camping start time and checks if the camping time has expired.
   * If the agent is not camping, it moves to a random spawn tile and checks for collisions with other agents.
   * The method updates the agent's state to reflect the explore action, and it logs the action based on whether it is a master or slave agent.
   */
  async achieveExplore(isEqualToLastIntention) {
    if (this.isMaster === true) {
      this.log(LOG_LEVELS.MASTER, "EXPLORE");
    }
    else {
      this.log(LOG_LEVELS.SLAVE, "EXPLORE");
    }

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
    // Camping behaviour --> save time but do nothing
    else if (!wasCamping) {
      this.campingStartTime = Date.now();
    }
  }

/**
 * Performs a one-step check for agents in the next tile of the path.
 * It checks if any agent is in the tile the agent wants to go to and handles collisions accordingly.
 * If a collision is detected, it sets the colliding state and starts a timer.
 * If the timer expires, it gets a new path or base path based on the last intention.
 * If everything is clear, it performs one step of the agent path.
 * @param {{x : number, y : number}} newPathTile - The new path tile to check for agents.
 * @description
 * This method performs a one-step check for agents in the next tile of the path.
 * It checks if any agent is in the tile the agent wants to go to and handles collisions accordingly.
 * If a collision is detected, it sets the colliding state and starts a timer.
 * If the timer expires, it gets a new path or base path based on the last intention.
 * If everything is clear, it performs one step of the agent path.
 * The method updates the agent's state to reflect the one-step check, and it logs the action based on whether it is a master or slave agent.
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
 * Performs one step of the agent path.
 * It moves the agent towards the next tile in the path and updates the path index.
 * If the agent is already at the destination tile, it does nothing.
 * @description
 * This method performs one step of the agent path by moving the agent towards the next tile in the path.
 * It checks if the agent is already at the destination tile and does nothing if it is.
 * If the agent is not at the destination tile, it calculates the direction to move and performs the move action.
 * The method updates the agent's state to reflect the movement and increments the path index.
 * It also sets the moving state to false after the move is completed.
 * The method logs the action based on whether it is a master or slave agent.
 * @example
 * agent.oneStep();
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
   * Gets the A* path to the target tile.
   * It initializes the path index and calculates the path using the astarSearch function.
   * @param {{x : number, y : number}} target - The target tile to get the path to.
   * @description
   * This method is responsible for getting the A* path to the specified target tile.
   * It initializes the path index to 0 and calculates the path using the astarSearch function.
   * The calculated path is stored in the `this.path` variable, which is later used for movement actions.
   * The method ensures that the agent has a valid path to follow towards the target tile.
   * @example
   * agent.getPath({ x: 5, y: 10 });
   */
  getPath(target) {
    this.pathIndex = 0;
    this.path = astarSearch({ x: Math.round(this.me.x), y: Math.round(this.me.y) }, target, this.mapStore);
  }

  /**
   * Gets a new A* path to the target tile, removing visible agents from the map.
   * It initializes the path index and calculates the path using the astarSearch function.
   * @param {{x : number, y : number}} target - The target tile to get the path to.
   * @description
   * This method is responsible for getting a new A* path to the specified target tile.
   * It removes visible agents from the map to ensure that the pathfinding algorithm does not consider them as obstacles.
   * The calculated path is stored in the `this.path` variable, which is later used for movement actions.
   * The method ensures that the agent has a valid path to follow towards the target tile, even in the presence of other agents.
   * @example
   * agent.getNewPath({ x: 5, y: 10 });
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
 * Gets the base path to the nearest base tile.
 * It checks if the agent is already at the base tile and returns if so.
 * If the agent is not at the base tile, it gets a new path to the nearest base using the getNewPath method.
 * If the base tile is not found, it removes the base from the map and sets a timer to restore it later.
 * @param {{x : number, y : number}} target - The target tile to get the base path to.
 * @description
 * This method is responsible for getting the base path to the nearest base tile.
 * It checks if the agent is already at the base tile and returns if so.
 * If the agent is not at the base tile, it gets a new path to the nearest base using the getNewPath method.
 * If the base tile is not found, it removes the base from the map and sets a timer to restore it later.
 * The method ensures that the agent has a valid path to follow towards the nearest base tile, even if the base is temporarily removed from the map.
 * @example
 * agent.getBasePath({ x: 5, y: 10 });
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
