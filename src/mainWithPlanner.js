// main.js

import DeliverooClient from "./api/deliverooClient.js";
import { Me } from "./models/me.js";
import { ParcelsStore } from "./models/parcelsStore.js";
import { MapStore } from "./models/mapStore.js";
import { AgentStore } from "./models/agentStore.js";
import { ServerConfig } from "./models/serverConfig.js";
import { getPlan, executePlan } from "./PDDL/planner.js";
import { moveAndWait, exitCurrentBase, moveToNearestBase } from "./actions/movement.js";
import { direction } from "./utils/astar.js";
import { TILE_TYPES } from "./utils/tile.js";
import { coord2Key, key2Coord } from "./utils/hashMap.js";

/**
 * Handles unhandled rejections and uncaught exceptions globally.
 */
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

/**
 * Handles uncaught exceptions globally.
 * This is a last resort to catch errors that were not handled anywhere else.
 */
process.on('uncaughtException', (err) => {
  console.log('Uncaught Exception:', err);
});

/**
 * Initializes the application by creating instances of necessary classes.
 * @returns {Promise<Object>} - An object containing initialized instances.
 * @throws {Error} - Throws an error if initialization fails.
 * @description
 * This function initializes the main components of the application:
 * - DeliverooClient: The client to interact with the Deliveroo API.
 * - Me: Represents the current player.
 * - ParcelsStore: Manages the parcels in the game.
 * - MapStore: Manages the game map
 * - AgentStore: Manages the agents in the game.
 * - ServerConfig: Holds the server configuration.
 */
async function initApp() {
  const client = new DeliverooClient(true);
  const me = new Me();
  const parcels = new ParcelsStore();
  const mapStore = new MapStore();
  const agentStore = new AgentStore();
  const serverConfig = new ServerConfig();
  return { client, me, parcels, mapStore, agentStore, serverConfig };
}

/**
 * Registers event handlers for the Deliveroo client.
 * @param {Object} context - The context containing initialized instances.
 * @param {DeliverooClient} context.client - The Deliveroo client instance.
 * @param {Me} context.me - The current player instance.
 * @param {ParcelsStore} context.parcels - The parcels store instance.
 * @param {MapStore} context.mapStore - The map store instance.
 * @param {AgentStore} context.agentStore - The agent store instance.
 * @param {ServerConfig} context.serverConfig - The server configuration instance.
 * @description
 * This function sets up event listeners for various events emitted by the Deliveroo client.
 * It updates the player state, map tiles, configuration, parcels sensing, and agents sensing.
 * It ensures that the application reacts to changes in the game state and updates the relevant models accordingly.
 * @throws {Error} - Throws an error if the client fails to register event handlers.  
 */
function registerEventHandlers({ client, me, parcels, mapStore, agentStore, serverConfig }) {
  client.onYou((payload, time) => {
    me.update(payload, time);
  });

  client.onTile(({ x, y, type }) => {
    mapStore.addTile({ x, y, type: parseInt(type) });
  });

  client.onConfig((cfg) => {
    serverConfig.updateConfig(cfg);
  });

  client.onMap((w, h, tiles) => {
    mapStore.mapSize = w;
    tiles.forEach((t) => mapStore.addTile({ x: t.x, y: t.y, type: t.type }));
    mapStore.calculateDistances();
    mapStore.calculateSparseness(serverConfig);
  });

  client.onParcelsSensing((pp) => {
    if (mapStore.mapSize > 0) {
      parcels.updateAll(me, pp, mapStore, serverConfig);
    }
  });

  client.onAgentsSensing((agents) => {
    agents.forEach((a) => agentStore.addAgent(a, me.ms));
  });
}

/**
 * Waits for the application to be ready by checking if the player ID is set and the map size is greater than zero.
 * @param {Object} context - The context containing initialized instances.
 * @param {Me} context.me - The current player instance.
 * @param {MapStore} context.mapStore - The map store instance.
 * @returns {Promise<void>} - A promise that resolves when the application is ready.
 * @description
 * This function continuously checks if the player ID is set and the map size is greater than zero.
 * It uses a polling mechanism to wait until these conditions are met before resolving the promise.
 * This is useful to ensure that the application has all necessary data before proceeding with the main logic.
 * @throws {Error} - Throws an error if the application is not ready within a reasonable time.
 */
async function waitForAppReady({ me, mapStore }) {
  while (!me.id || mapStore.mapSize === 0) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

/**
 * Creates an onMove handler that moves the agent to a target position.
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {Me} me - The current player instance.
 * @returns {function} - A function that takes target coordinates and moves the agent.
 * @description
 * This function returns a handler that can be used to move the agent to a specified target position.
 * It calculates the direction from the current position to the target position and uses the client to emit a move action.
 * It also waits for the move to complete and checks if the agent has reached the target position.
 * If the move fails or the agent does not reach the target position, it logs an error and rejects the promise.
 * @throws {Error} - Throws an error if the direction cannot be determined or if the move fails.
 */
function makeOnMove(client, me) {
  return async (targetX, targetY) => {
    const dir = direction(me, { x: targetX, y: targetY });
    if (!dir) {
      const msg = `Cannot find direction from ${me.x},${me.y} to ${targetX},${targetY}`;
      console.warn(msg);
      return Promise.reject(new Error(msg));
    }
    const oldX = me.x, oldY = me.y;
    try {
      await moveAndWait(client, me, dir);
      // Wait for update
      const timeout = 1000;
      const startTime = Date.now();
      while ((me.x === oldX && me.y === oldY) && (Date.now() - startTime < timeout)) {
        await new Promise(r => setTimeout(r, 10));
      }
      if (me.x === oldX && me.y === oldY) {
        const errMsg = `Move to ${targetX},${targetY} may have failed: still at ${me.x},${me.y}`;
        console.warn(errMsg);
        return Promise.reject(new Error(errMsg));
      }
      if (me.x !== targetX || me.y !== targetY) {
        const errMsg = `Expected position ${targetX},${targetY} but at ${me.x},${me.y}`;
        console.warn(errMsg);
        return Promise.reject(new Error(errMsg));
      }
    } catch (err) {
      console.log("Movement error:", err);
      return Promise.reject(err);
    }
  };
}
/**
 * Creates an onPickup handler that emits a pickup action.
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {Me} me - The current player instance.
 * @returns {function} - A function that emits a pickup action when called.
 * @description
 * This function returns a handler that can be used to emit a pickup action.
 * It uses the client to emit a pickup event, which will trigger the server to handle the pickup logic.
 */
function makeOnPickup(client, me) {
  return async () => {
    await client.emitPickup();
  };
}

/**
 * Creates an onDeposit handler that emits a putdown action with the current parcels.
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {ParcelsStore} parcels - The parcels store instance.
 * @param {Me} me - The current player instance.
 * @returns {function} - A function that emits a putdown action with the current parcels when called.
 * @description
 * This function returns a handler that can be used to emit a putdown action.
 * It uses the client to emit a putdown event with the current parcels and the player's ID.
 * This will trigger the server to handle the deposit logic for the parcels.
 * */
function makeOnDeposit(client, parcels, me) {
  return async () => {
    await client.emitPutdown(parcels, me.id);
  };
}

/**
 * Plans the next actions using dynamic agents.
 * @param {MapStore} mapStore - The MapStore instance containing the current map state.
 * @param {AgentStore} agentStore - The AgentStore instance containing the current agents state.
 * @param {Me} me - The current player instance.
 * @param {ParcelsStore} parcels - The list of parcels to be processed.
 * @param {ServerConfig} serverConfig - The server configuration instance.
 * @returns {Promise<Array>} - A promise that resolves to the raw plan generated by the planner.
 * @description
 * This function generates a plan for the current player based on the current map state, visible agents, and parcels.
 * It temporarily removes agents from the map to avoid interference during planning.
 * After generating the plan, it restores the agents back to their original state on the map.
 * If an error occurs during planning, it logs the error and returns an empty plan.
 * @throws {Error} - Throws an error if the planning process fails.
 */

async function planWithDynamicAgents(mapStore, agentStore, me, parcels, serverConfig) {
  let tileMapTemp = new Map();
  // Remove agents from map
  for (const a of agentStore.visible(me, serverConfig)) {
    let type = mapStore.setType(a, TILE_TYPES.EMPTY);
    tileMapTemp.set(coord2Key(a), type);
  }
  let rawPlan;
  try {
    rawPlan = await getPlan(mapStore, parcels, me, serverConfig);
  } catch (err) {
    console.error("Planning error:", err);
  }
  // Restore tiles
  for (const [key, value] of tileMapTemp) {
    let tile = key2Coord(key);
    mapStore.setType(tile, value);
  }
  return rawPlan;
}

/**
 * Checks if the current player is at a base location.
 * @param {Me} me - The current player instance.
 * @param {MapStore} mapStore - The MapStore instance containing the current map state.
 * @returns {boolean} - Returns true if the player is at a base, false otherwise.
 * @description
 * This function checks if the current player's coordinates match any of the base locations in the map store.
 * It uses the coord2Key function to convert the player's coordinates into a key that can be checked against the map store's bases.
 * @throws {Error} - Throws an error if the map store is not initialized or if the player's coordinates are invalid.
 */
function checkIfIamAtBase(me, mapStore) {
  const currentKey = coord2Key({ x: me.x, y: me.y });
  return mapStore.bases.has(currentKey);
}

/**
 * Runs the main planning loop for the application.
 * @param {Object} context - The context containing initialized instances.
 * @param {DeliverooClient} context.client - The Deliveroo client instance.
 * @param {Me} context.me - The current player instance.
 * @param {ParcelsStore} context.parcels - The parcels store instance.
 * @param {MapStore} context.mapStore - The map store instance.
 * @param {AgentStore} context.agentStore - The agent store instance.
 * @param {ServerConfig} context.serverConfig - The server configuration instance.
 * @returns {Promise<void>} - A promise that resolves when the planning loop is complete.
 * @description
 * This function runs the main planning loop for the application.
 * It continuously checks the game state, computes a plan using dynamic agents, and executes the plan.
 * If no plan is found, it attempts to move towards the nearest base.
 * It handles errors during planning and execution, ensuring that the application remains responsive and can recover from failures.
 * @throws {Error} - Throws an error if the planning or execution fails.
 */

async function runPlanningLoop(context) {
  const { client, me, parcels, mapStore, agentStore, serverConfig } = context;
  const onMove = makeOnMove(client, me);
  const onPickup = makeOnPickup(client, me);
  const onDeposit = makeOnDeposit(client, parcels, me);
  let isExecutingPlan = false;

  while (true) {
    try {
      await new Promise((r) => setTimeout(r, serverConfig.clock));
      if (isExecutingPlan) {
        console.log("Still executing previous plan, skipping...");
        continue;
      }
      if (!me.id || mapStore.mapSize === 0) {
        continue;
      }
      // Compute plan
      let rawPlan;
      try {
        rawPlan = await planWithDynamicAgents(mapStore, agentStore, me, parcels, serverConfig);
      } catch (err) {
        console.error("Planning error:", err);
        continue;
      }
      if (!rawPlan || rawPlan.length === 0) {
        console.log("No plan found, moving toward nearest base");
        try {
          if (checkIfIamAtBase(me, mapStore)) {
            await exitCurrentBase(client, me, mapStore);
          } else {
            await moveToNearestBase(client, me, mapStore);
          }
        } catch (baseErr) {
          console.error("Error moving to base:", baseErr.message);
        }
        continue;
      }
      isExecutingPlan = true;
      try {
        console.log(`Executing plan with ${rawPlan.length} actions`);
        await executePlan(rawPlan, onMove, onPickup, onDeposit);
        console.log("Plan execution completed successfully");
      } catch (err) {
        console.error("Plan execution failed:", err.message);
        console.log("Will generate new plan in next iteration");
      } finally {
        isExecutingPlan = false;
      }
    } catch (mainLoopErr) {
      console.error("Main loop error:", mainLoopErr.message);
      isExecutingPlan = false;
    }
  }
}

/**
 * Main function to initialize the application and start the planning loop.
 * @returns {Promise<void>} - A promise that resolves when the application is fully initialized and the planning loop is running.
 * @function mainSinglePDDL
 * @async
 * @description
 * This function initializes the application by creating instances of necessary classes, registers event handlers,
 * waits for the application to be ready, and then starts the main planning loop.
 * It serves as the entry point for the application, ensuring that all components are set up correctly before starting the main logic.
 * @throws {Error} - Throws an error if the application initialization or planning loop fails.
 */
async function main() {
  console.log("Initializing application…");
  const context = await initApp();
  registerEventHandlers(context);
  await waitForAppReady(context);
  await runPlanningLoop(context);
}

main();
