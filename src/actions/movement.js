import DeliverooClient from "../api/deliverooClient.js";
import { MapStore } from "../models/mapStore.js";
import { Me } from "../models/me.js";
import { astarSearch, direction } from "../utils/astar.js";
import { DIRECTIONS, oppositeDirection } from "../utils/directions.js";
import { coord2Key } from "../utils/hashMap.js";
import { isWalkableTile, TILE_TYPES } from "../utils/tile.js";
import gameConfig from "../utils/gameConfig.js";

/**
 * Ensures movement command is only sent after previous is complete.
 * This is important to avoid sending multiple commands at once otherwise we get a penalty. 
 * @param {DeliverooClient} client
 * @param {Me} me
 * @param {'up'|'down'|'left'|'right'} dir
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
 * Uses A* to move agent tile-by-tile toward the target
 * @param {DeliverooClient} client
 * @param {Me} me
 * @param {{x: number, y: number}} target
 * @param {MapStore} mapStore
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
 * Move to the nearest base from current position
 * @param {DeliverooClient} client
 * @param {Me} me
 * @param {MapStore} mapStore
 * @returns {Promise<void>}

 */
export async function smartMoveToNearestBase(client, me, mapStore) {
  const [base] = mapStore.nearestBase(me);
  if (base) {
    await smartMove(client, me, base, mapStore);
  }

}

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
 * @param {DeliverooClient} client
 * @param {Me} me
 * @param {MapStore} mapStore
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
 * @param {MapStore} mapStore
 * @param {Me} me
 * @param {Me} mate
 * @param {{x : number, y : number}} myPos
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
 * @param {DeliverooClient} client
 * @param {Me} me
 * @param {Me} mate
 * @param {MapStore} mapStore
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



