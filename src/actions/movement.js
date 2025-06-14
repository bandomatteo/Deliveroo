import DeliverooClient from "../api/deliverooClient.js";
import { MapStore } from "../models/mapStore.js";
import { Me } from "../models/me.js";
import { astarSearch, direction } from "../utils/astar.js";
import { DIRECTIONS, oppositeDirection } from "../utils/directions.js";
import { coord2Key } from "../utils/hashMap.js";
import { isWalkableTile, TILE_TYPES } from "../utils/tile.js";
import gameConfig from "../utils/gameConfig.js";
import { ParcelsStore } from "../models/parcelsStore.js";

/**
 * Moves the agent in the specified direction and waits for the move to complete.
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {Me} me - The current player instance.
 * @param {string} dir - The direction to move in (e.g., 'UP', 'DOWN', 'LEFT', 'RIGHT').
 * @returns {Promise<void>} - A promise that resolves when the move is complete.
 * @description
 * This function emits a move command to the Deliveroo client and waits for the
 * player's state to update with the new position. It listens for the 'onYou' event
 * to confirm that the move has been processed and the player's position has been updated.
 */
export async function moveAndWait(client, me, dir) {
  const moved = new Promise(resolve => {
    client.onYou((state, time) => {
      if (Number.isInteger(state.x) && Number.isInteger(state.y)) {
        me.update(state, time);
        resolve();
      }
    });
  });
  await client.emitMove(dir);
  await moved;
}

/**
 * Moves the agent towards the target position using A* search algorithm.
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {Me} me - The current player instance.
 * @param {{x: number, y: number}} target - The target position to move towards.
 * @param {MapStore} mapStore - The MapStore instance containing the current map state.
 * @returns {Promise<void>} - A promise that resolves when the movement is complete.
 * @description
 * This function calculates the path from the current position to the target position
 * using the A* search algorithm. It then iterates through each step in the path,
 * determines the direction to move in, and calls the `moveAndWait` function to 
 * move the agent step by step.
 */
export async function smartMove(client, me, target, mapStore) {
  const path = astarSearch( me, target, mapStore);
  for (const step of path) {
    const dir = direction(me, step);
    if (!dir) continue;
    
    await moveAndWait(client, me, dir);
  }
}

/**
 * Moves the agent to the nearest base using smart movement.
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {Me} me - The current player instance.
 * @param {MapStore} mapStore - The MapStore instance containing the current map state.
 * @returns {Promise<void>} - A promise that resolves when the movement is complete.
 * @description
 * This function finds the nearest base on the map and moves the agent towards it
 * using the `smartMove` function. If a base is found, it will navigate to that base
 * efficiently, taking into account the current map state and obstacles.
 */
export async function smartMoveToNearestBase(client, me, mapStore) {
  const [base] = mapStore.nearestBase(me);
  if (base) {
    await smartMove(client, me, base, mapStore);
  }

}
/**
 * Moves the agent to the nearest base and puts down all carried parcels.
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {Me} me - The current player instance.
 * @param {MapStore} mapStore - The MapStore instance containing the current map state.
 * @param {ParcelsStore} parcels - The list of parcels to be put down.
 * @returns {Promise<void>} - A promise that resolves when the movement and put down action are complete.
 * @description
 * This function finds the nearest base on the map and moves the agent towards it
 * using the `smartMove` function. Once the agent reaches the base, it emits a put down
 * command for all carried parcels. This is useful for efficiently delivering parcels
 * to the nearest base, ensuring that the agent can quickly return to the delivery process.
 */
export async function smartMoveToNearestBaseAndPutDown(client, me, mapStore, parcels) {
  const [base] = mapStore.nearestBase(me);
  if (base) {
    await smartMove(client, me, base, mapStore);

    // drop off all carried parcels
    if (me.x === base.x && me.y === base.y) {
      client.emitPutdown(parcels, me.id);
    }
  }
}

/**
 * Makes a random move in one direction and then returns to the original position.
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {Me} me - The current player instance.
 * @param {MapStore} mapStore - The MapStore instance containing the current map state.
 * @returns {Promise<void>} - A promise that resolves when the random move and return are complete.
 * @description
 * This function checks the surrounding tiles for walkable paths and randomly selects one to move in.
 * After moving in the random direction, it immediately moves back to the original position.
 * This is useful for testing movement logic or simulating random behavior in the game.
 */
export async function randomMoveAndBack(client, me, mapStore) {
  let possibleMoves = [];

  const rightCell = mapStore.map.get(coord2Key({x : me.x + 1, y : me.y}))
  const leftCell = mapStore.map.get(coord2Key({x : me.x - 1, y : me.y}))
  const upCell = mapStore.map.get(coord2Key({x : me.x, y : me.y + 1}))
  const downCell = mapStore.map.get(coord2Key({x : me.x, y : me.y - 1}))

  if (isWalkableTile(rightCell))
    possibleMoves.push(DIRECTIONS.RIGHT);
  if (isWalkableTile(leftCell))
    possibleMoves.push(DIRECTIONS.LEFT);
  if (isWalkableTile(upCell))
    possibleMoves.push(DIRECTIONS.UP);
  if (isWalkableTile(downCell))
    possibleMoves.push(DIRECTIONS.DOWN);
  
  const randomDir = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  const secondDir = oppositeDirection(randomDir);

  await client.emitMove(randomDir);
  await client.emitMove(secondDir);
}


/**
  * Gets the possible near tiles for movement based on the current position of the agent and its mate.
  * @param {MapStore} mapStore - The MapStore instance containing the current map state.
  * @param {Me} me - The current player instance.
  * @param {Me} mate - The mate player instance.
  * @param {{x: number, y: number}} myPos - The current position of the agent.
  * @returns {string[]} - An array of possible movement directions (e.g., ['UP', 'DOWN']).
 */
export function getNearTiles(mapStore, me, mate, myPos) {
  let possibleMoves = [];

  const rightCell = { x: me.x + 1, y: me.y }
  const leftCell = { x: me.x - 1, y: me.y }
  const upCell = { x: me.x, y: me.y + 1 }
  const downCell = { x: me.x, y: me.y - 1 }

  const rightCellType = mapStore.map.get(coord2Key(rightCell))
  const leftCellType = mapStore.map.get(coord2Key(leftCell))
  const upCellType = mapStore.map.get(coord2Key(upCell))
  const downCellType = mapStore.map.get(coord2Key(downCell))

  if (isWalkableTile(rightCellType)
      && !(rightCell.x === mate.x && rightCell.y === mate.y)
      && !(rightCell.x === myPos.x && rightCell.y === myPos.y))
    possibleMoves.push(DIRECTIONS.RIGHT);

  if (isWalkableTile(leftCellType)
      && !(leftCell.x === mate.x && leftCell.y === mate.y)
      && !(leftCell.x === myPos.x && leftCell.y === myPos.y))
    possibleMoves.push(DIRECTIONS.LEFT);

  if (isWalkableTile(upCellType)
      && !(upCell.x === mate.x && upCell.y === mate.y) 
      && !(upCell.x === myPos.x && upCell.y === myPos.y))
    possibleMoves.push(DIRECTIONS.UP);

  if (isWalkableTile(downCellType)
      && !(downCell.x === mate.x && downCell.y === mate.y)
      && !(downCell.x === myPos.x && downCell.y === myPos.y))
    possibleMoves.push(DIRECTIONS.DOWN);

  return possibleMoves;
}

/**
 * Moves the agent away from the current position in a random direction for a specified number of moves.
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {Me} me - The current player instance.
 * @param {Me} mate - The mate player instance.
 * @param {MapStore} mapStore - The MapStore instance containing the current map state.
 * @returns {Promise<void>} - A promise that resolves when the movement is complete.
 * @description
 * This function iterates a specified number of times, each time selecting a random direction
 * from the possible near tiles around the agent's current position. It moves the agent in that
 * random direction and updates the agent's position for the next iteration. This is useful for
 * simulating random movement away from the current position, which can be useful in various game scenarios.
 */
export async function goAway(client, me, mate, mapStore) {
  let myPos = {x : undefined, y : undefined};

  for (let i = 0; i < gameConfig.GO_AWAY_MOVES; i++) {
    let possibleMoves = getNearTiles(mapStore, me, mate, myPos);

    const randomDir = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    
    if (randomDir) {
      myPos = { x: me.x, y: me.y }; // Set my position for the next iteration
      await client.emitMove(randomDir);
    }
  }
}

/**
 * Moves the agent to the nearest base using A* search algorithm.
 * @param {DeliverooClient} client - The Deliveroo client instance.
 * @param {Me} me - The current player instance.
 * @param {MapStore} mapStore - The MapStore instance containing the current map state.
 * @returns {Promise<boolean>} - Returns true if successfully moved to a new base, false otherwise.
 * @description
 * This function finds the nearest base on the map and uses the A* search algorithm to calculate
 * the path to that base. It then moves the agent in the direction of the first step in the path.
 * If a valid path is found, it moves the agent and returns true. If no base is found or no valid
 * path exists, it logs an error message and returns false.
 */
export async function moveToNearestBase(client, me, mapStore) {
    const [newBase] = mapStore.nearestBase(me);
    if (!newBase) {
        console.log("No bases found");
        return false;
    }

    const fullPath = astarSearch(me, newBase, mapStore);
    if (!fullPath?.length) {
        console.log("No valid path to base");
        return false;
    }

    const firstStep = fullPath[0];
    const dir = direction(me, firstStep);
    if (!dir) {
        console.log("Couldn't determine direction");
        return false;
    }

    await moveAndWait(client, me, dir);
    return true;
}

/**
  * Exits the current base by setting the tile type to WALKABLE and then moving to the nearest base.
  * After moving, it resets the tile type back to BASE.
  * @param {DeliverooClient} client - The Deliveroo client instance.
  * @param {Me} me - The current player instance.
  * @param {MapStore} mapStore - The MapStore instance containing the current map state.
  * @returns {Promise<boolean>} - Returns true if successfully moved to a new base, false otherwise.
  * @description
  * This function is used to exit the current base by first marking the tile as WALKABLE,
  * then finding the nearest base and moving towards it. After the move, it resets the tile type
  * back to BASE. This is useful for scenarios where the player needs to leave the current base
  * and find a new one, ensuring that the map state is correctly updated.
  */ 
export async function exitCurrentBase(client, me, mapStore) {
    const baseCoord = { x: me.x, y: me.y };
    mapStore.setType(baseCoord, TILE_TYPES.WALKABLE);

    try {
        return await moveToNearestBase(client, me, mapStore);
    } finally {
        mapStore.setType(baseCoord, TILE_TYPES.BASE);
    }
}

