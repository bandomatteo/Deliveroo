import DeliverooClient from "../api/deliverooClient.js";
import { MapStore } from "../models/mapStore.js";
import { Me } from "../models/me.js";
import { astarSearch, direction } from "../utils/astar.js";

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
  const path = astarSearch({ x: me.x, y: me.y }, target, mapStore);
  for (const step of path) {
    const dir = direction(me, step);
    if (!dir) continue;
    console.log(`Moving ${dir} from (${me.x},${me.y}) to (${step.x},${step.y})`);
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

