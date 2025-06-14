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


/**  
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {Me} me - The current player instance.
 * @returns {function} - A function that takes targetX and targetY and returns a Promise.  
 */
function makeOnMove(client, me) {
  return async (targetX, targetY) => {
    const dir = direction(me, {
      x: targetX,
      y: targetY
    });
    /*if (!dir) {
      throw new Error(`Cannot find direction from ${me.x},${me.y} to ${targetX},${targetY}`);
    }*/

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
        console.warn(`Move to ${targetX},${targetY} may have failed: still at ${me.x},${me.y}`);
      }

    } catch (err) {
      console.log(err)
    }

    // Check if  we' re at the expected position
    if (me.x !== targetX || me.y !== targetY) {
      console.warn(`Expected position ${targetX},${targetY} but at ${me.x},${me.y}`);
    }
  };
}

// onPickup() → Promise that resolves after client.emitPickup() and state update 
/** 
  * @param {DeliverooClient} client - The Deliveroo client instance.
  * @param {Me} me - The current player instance.
  * @returns {function} - A function that returns a Promise when called.
  * 
  */
function makeOnPickup(client, me) {
  return async () => {
    await client.emitPickup();
  };
}

/** onDeposit() → Promise that resolves after client.emitPutdown() and state update */
function makeOnDeposit(client, parcels, me) {
  return async () => {
    //const oldParcelCount = me.parcels ? me.parcels.length : 0;

    await client.emitPutdown(parcels, me.id);

    // Wait for parcel count to decrease (with timeout)
    /* const timeout = 1000;
     const startTime = Date.now();
     
     while ((me.parcels?.length || 0) >= oldParcelCount && (Date.now() - startTime < timeout)) {
       await new Promise(r => setTimeout(r, 10));
     }
     
     if ((me.parcels?.length || 0) >= oldParcelCount) {
       console.warn(`Deposit may have failed: parcel count still ${oldParcelCount}`);
     }*/
  };
}

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
 * 
 * @param {Me} me 
 * @param {MapStore} mapStore
 * @returns {boolean} - Returns true if the player is at a base, false otherwise.
 */
function checkIfIamAtBase(me, mapStore) {
  // Convert the current position to a key
  const currentKey = coord2Key({ x: me.x, y: me.y });

  // Check if this key exists in the bases Set
  return mapStore.bases.has(currentKey);
}

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
      mapStore.addTile({
        x: t.x,
        y: t.y,
        type: t.type
      })
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

  // Simply the main loop like we had before (re-plan & execute), but now but don't overlap executions
  while (true) {
    await new Promise((r) => setTimeout(r, serverConfig.clock));

    // Skip if we're still executing a previous plan
    if (isExecutingPlan) {
      console.log("Still executing previous plan, skipping...");
      continue;
    }

    if (!me.id || mapStore.mapSize === 0) {
      continue;
    }

    // computing the new plan
    let rawPlan;
    try {
      //rawPlan = await getPlan(mapStore, parcels, me, serverConfig);
      rawPlan = await planWithDynamicAgents(mapStore, agentStore, me, parcels, serverConfig);
      //console.log(rawPlan);

    } catch (err) {
      console.error("Planning error:", err);
      continue;
    }

    

    // if the plan is empty, we just move randomly toward a base
    if (!rawPlan || rawPlan.length === 0) {
      console.log("No plan found, I shoudl move randomly towards a base");

      if (checkIfIamAtBase(me, mapStore)) {
        // Save the current base coordinates
        const baseCoord = { x: me.x, y: me.y };

        // Remove the base tile temporarily
        mapStore.setType(baseCoord, TILE_TYPES.EMPTY);

        try {
          // Find the nearest base and move towards it removing the current base tile
          let [newBase,] = mapStore.nearestBase(me);
          mapStore.setType(baseCoord, TILE_TYPES.BASE);

          if (newBase) {

            const fullPath = astarSearch(me, newBase, mapStore);

            if (fullPath && fullPath.length > 0) {
              // I take only the first step from the path
              const firstStep = fullPath[0];
              const dir = direction(me, firstStep);

              if (dir) {
                console.log(`Moving ${dir} toward new base`);
                await moveAndWait(client, me, dir);
              } else {
                console.log("Couldn't determine direction for first step");
              }
            } else {
              console.log("No valid path found to target base");
            }
          } else {
            console.log("No other bases found");
          }
        } finally {
          // Restore the base tile
          mapStore.setType(baseCoord, TILE_TYPES.BASE);
        }
      }
      else{
        let [newBase,] = mapStore.nearestBase(me);
        
        if(newBase) {
          const fullPath = astarSearch(me, newBase, mapStore);

          if (fullPath && fullPath.length > 0) {
            // Take only the first step from the path
            const firstStep = fullPath[0];
            const dir = direction(me, firstStep);

            if (dir) {
              console.log(`Moving ${dir} toward nearest base`);
              await moveAndWait(client, me, dir);
            } else {
              console.log("Couldn't determine direction for first step");
            }
          } else {
            console.log("No valid path found to target base");
          }
        }


      }

      continue;

    }//fine if

    // Execute plan with  synchronization
    isExecutingPlan = true;
    try {
      console.log(`Executing plan with ${rawPlan.length} actions`);
      await executePlan(rawPlan, onMove, onPickup, onDeposit);
      //console.log("Plan execution completed successfully");
    } catch (err) {
      console.error("Error executing plan:", err);
      console.log("FIXME")
      console.log(isExecutingPlan)
    } finally {
      isExecutingPlan = false;
    
      
    }
  }
}

main()