/* 
*  This main is just a simple version for showing how to integrate the planner
   with the Deliveroo client.
*/

import DeliverooClient from "./api/deliverooClient.js";
import { Me } from "./models/me.js";
import { ParcelsStore } from "./models/parcelsStore.js";
import { MapStore } from "./models/mapStore.js";
import { AgentStore } from "./models/agentStore.js";
import { ServerConfig } from "./models/serverConfig.js";
import { getPlan, executePlan } from "./planner.js";
import { moveAndWait } from "./actions/movement.js";
import { astarSearch, direction } from "./utils/astar.js";
import { TILE_TYPES } from "./utils/tile.js";
import { coord2Key, key2Coord } from "./utils/hashMap.js";
import { exitCurrentBase, moveToNearestBase } from "./actions/movement.js";

/**
 * Handles unhandled rejections and uncaught exceptions globally
 * This is useful for debugging and ensuring the bot doesn't crash silently.
 * It logs the error and the promise that caused it.
 * @param {Error} reason - The reason for the unhandled rejection.
 * @param {Promise} promise - The promise that was rejected.  
 */
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

/**
 * Handles uncaught exceptions globally
 * This is useful for debugging and ensuring the bot doesn't crash silently.
 * It logs the error that caused the exception.
 * @param {Error} err - The uncaught exception error.
 */
process.on('uncaughtException', (err) => {
  console.log('Uncaught Exception:', err);
});

/**
 * Creates a function that handles movement actions.
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {Me} me - The current player instance.
 * @returns {function} - A function that returns a Promise when called.
 * @description
 * This function calculates the direction from the current position to the target position,
 * sends a move command to the client, and waits for the state to update.
 * If the move fails or the position does not match the target after a timeout,
 * it returns a rejected promise with an error message.
 */
function makeOnMove(client, me) {
  return async (targetX, targetY) => {
    const dir = direction(me, {
      x: targetX,
      y: targetY
    });
    if (!dir) {
      console.warn(`Cannot find direction from ${me.x},${me.y} to ${targetX},${targetY}`);
      // Return a rejected promise instead of throwing
      return Promise.reject(new Error(`Cannot find direction from ${me.x},${me.y} to ${targetX},${targetY}`));
    }

    const oldX = me.x;
    const oldY = me.y;

    try {
      await moveAndWait(client, me, dir);

      // Wait for state to update (with timeout)
      const timeout = 1000; // 1 second timeout
      const startTime = Date.now();

      while ((me.x === oldX && me.y === oldY) && (Date.now() - startTime < timeout)) {
        await new Promise(r => setTimeout(r, 10));
      }

      if (me.x === oldX && me.y === oldY) {
        const errorMsg = `Move to ${targetX},${targetY} may have failed: still at ${me.x},${me.y}`;
        console.warn(errorMsg);
        // Return a rejected promise instead of throwing
        return Promise.reject(new Error(errorMsg));
      }

      // Check if we're at the expected position
      if (me.x !== targetX || me.y !== targetY) {
        const errorMsg = `Expected position ${targetX},${targetY} but at ${me.x},${me.y}`;
        console.warn(errorMsg);
        // Return a rejected promise instead of throwing
        return Promise.reject(new Error(errorMsg));
      }

    } catch (err) {
      console.log("Movement error:", err);
      // Return a rejected promise instead of re-throwing
      return Promise.reject(err);
    }
  };
}

/** 
  * @param {DeliverooClient} client - The Deliveroo client instance.
  * @param {Me} me - The current player instance.
  * @returns {function} - A function that returns a Promise when called.
  * @description 
  * This function emits a pickup event to the Deliveroo client.
  */
function makeOnPickup(client, me) {
  return async () => {
    await client.emitPickup();
  };
}

/**
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {ParcelsStore} parcels - The parcels store instance.
 * @param {Me} me - The current player instance.
 * @returns {function} - A function that returns a Promise when called.
 * @description 
 * This function emits a putdown event to the Deliveroo client.
 * 
 */
function makeOnDeposit(client, parcels, me) {
  return async () => {
    await client.emitPutdown(parcels, me.id);
  };
}

/**
 * Plans with dynamic agents by temporarily removing them from the map,
 * executing the plan, and then restoring the map state.
 * @param {MapStore} mapStore - The map store instance.
 * @param {AgentStore} agentStore - The agent store instance.
 * @param {Me} me - The current player instance.
 * @param {ParcelsStore} parcels - The parcels store instance.
 * @param {ServerConfig} serverConfig - The server configuration instance.
 * @returns {Promise<Array>} - The planned actions.
 * @description
 * This function first removes all visible agents from the map by setting their tiles to EMPTY.
 * It then calls the getPlan function to generate a new plan based on the current map state.
 * After the plan is generated, it restores the map state by re-adding the agents back to their original tiles.
 * This allows the planner to work with a static map while still considering dynamic agents.
 */
async function planWithDynamicAgents(mapStore, agentStore, me, parcels, serverConfig) {

  let tileMapTemp = new Map();

  // Remove tiles with agents
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

  // Re-add tiles
  for (const [key, value] of tileMapTemp) {
    let tile = key2Coord(key);
    mapStore.setType(tile, value);
  }

  return rawPlan;
}

/**
 * Checks if the current position of the agent is at a base.
 * @param {Me} me - The current player instance.
 * @param {MapStore} mapStore - The map store instance.
 * @returns {boolean} - Returns true if the agent is at a base, false otherwise.
 * @description
 * This function converts the current position of the agent into a key using coord2Key,
 * and checks if this key exists in the bases Set of the map store.
 * If it exists, it means the agent is at a base.
 */
function checkIfIamAtBase(me, mapStore) {
  // Convert the current position to a key
  const currentKey = coord2Key({ x: me.x, y: me.y });

  // Check if this key exists in the bases Set
  return mapStore.bases.has(currentKey);
}
/**
 * Main function that initializes the Deliveroo client and sets up the game loop.
 * It creates instances of the necessary models, listens for events from the client,
 * and executes plans based on the current state of the game.
 * @description
 * This function initializes the Deliveroo client, sets up the models for the player,
 * parcels, map, agents, and server configuration. It listens for events from the client
 * to update the models accordingly. It then enters a loop where it waits for the map and player ID
 * to be ready, computes a plan using the planner, and executes the plan using the action handlers.
 * If no plan is found, it attempts to move to the nearest base. The loop continues indefinitely,
 * executing plans and handling actions until the process is terminated.
 * @throws {Error} - Throws an error if there is an issue with the planning or execution of actions.
 */
async function main() {
  console.log("Creating client…");
  const client = new DeliverooClient(true);

  console.log("Creating models…");
  const me = new Me();
  const parcels = new ParcelsStore();
  const mapStore = new MapStore();
  const agentStore = new AgentStore();
  const serverConfig = new ServerConfig();

  client.onYou((payload, time) => {
    me.update(payload, time);
  });

  client.onTile(({ x, y, type }) =>
    mapStore.addTile({
      x, y, type: parseInt(type)
    })
  );

  client.onConfig((cfg) => {
    serverConfig.updateConfig(cfg);
  });

  client.onMap((w, h, tiles) => {
    mapStore.mapSize = w;
    tiles.forEach((t) =>
      mapStore.addTile({ x: t.x,y: t.y,type: t.type})
    );
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

  // Wait until we know our id and the map is fully loaded
  while (!me.id || mapStore.mapSize === 0) {
    await new Promise((r) => setTimeout(r, 50));
  }

  // preparing the 3 action handlers to give to the executor
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

      // Computing the new plan
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

}//fine main

main()


