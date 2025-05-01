import { coord2Key, key2Coord } from "../utils/hashMap.js";
import { distance } from "../utils/geometry.js";
import { MapStore } from "../models/mapStore.js";
import DeliverooClient from "../api/deliverooClient.js";
import { Me } from "../models/me.js";

/**
 * Returns path from start to goal using A* on known map
 * @param {{x: number, y: number}} start 
 * @param {{x: number, y: number}} goal 
 * @param {MapStore} mapStore 
 * @returns {Array<{x: number, y: number}>} the path from start to goal
 */
export function astarSearch(start, goal, mapStore) {
    const startKey = coord2Key(start);
    const goalKey = coord2Key(goal);

    //console.log("DEBUG START type:", mapStore.map.get(startKey), ", GOAL type:", mapStore.map.get(goalKey));

    if (!mapStore.map.has(startKey) || !mapStore.map.has(goalKey)) {
        console.warn("A*: Start or goal not in mapStore:", startKey, goalKey);
        return [];
    }

    const startType = mapStore.map.get(startKey);
    const goalType = mapStore.map.get(goalKey);

    if (startType === 0 || goalType === 0) {
        console.warn("A*: Start or goal is a hole");
        return [];
    }

    const openSet = new Set([startKey]);
    const cameFrom = new Map();
    const gScore = new Map([[startKey, 0]]);
    const fScore = new Map([[startKey, distance(start, goal)]]);

    while (openSet.size > 0) {
        //console.log(" openSet:", [...openSet].map(k => JSON.stringify(key2Coord(k))).join(" | "));

        let currentKey = [...openSet].reduce((a, b) =>
            (fScore.get(a) || Infinity) < (fScore.get(b) || Infinity) ? a : b
        );
        const current = key2Coord(currentKey);

        if (currentKey === goalKey) {
            const path = [];
            let temp = currentKey;
            while (temp !== startKey) {
                path.push(key2Coord(temp));
                temp = cameFrom.get(temp);
            }
            path.reverse();
            return path;
        }

        openSet.delete(currentKey);

        for (const { dx, dy } of [ {dx:1,dy:0}, {dx:-1,dy:0}, {dx:0,dy:1}, {dx:0,dy:-1} ]) {
            const neighbor = { x: current.x + dx, y: current.y + dy };
            const neighborKey = coord2Key(neighbor);

            if (!mapStore.map.has(neighborKey)) {
                //console.log(` Skipping unknown tile at ${neighbor.x},${neighbor.y}`);
                continue;
            }

            const tileType = mapStore.map.get(neighborKey);
            const isWalkable = tileType !== 0;

            if (!isWalkable) {
                //console.log(` Skipping blocked tile at ${neighbor.x},${neighbor.y} (type ${tileType})`);
                continue;
            } else {
                //console.log(` Walkable tile: ${neighbor.x},${neighbor.y} (type ${tileType})`);
            }

            const tentativeG = gScore.has(currentKey) ? gScore.get(currentKey) + 1 : 1;

            //console.log(` tentativeG = ${tentativeG}, g(neighbor) = ${gScore.get(neighborKey)}`);

            if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
                //console.log(` Updating path to ${neighbor.x},${neighbor.y} from ${current.x},${current.y}`);
                cameFrom.set(neighborKey, currentKey);
                gScore.set(neighborKey, tentativeG);
                fScore.set(neighborKey, tentativeG + distance(neighbor, goal));
                openSet.add(neighborKey);
               // console.log(` Added  ${neighbor.x},${neighbor.y} to the openSet`);
            }
        }
    }

    console.warn(" A*: No path found from", startKey, "to", goalKey);
    return [];
}

export function direction(from, to) {
    if (to.x > from.x) return 'right';
    if (to.x < from.x) return 'left';
    if (to.y > from.y) return 'up';
    if (to.y < from.y) return 'down';
    return null;
}

/**
 * Ensures movement command is only sent after previous is complete.
 * @param {DeliverooClient} client 
 * @param {Me} me 
 * @param {'up'|'down'|'left'|'right'} dir 
 */
export async function moveAndWait(client, me, dir) {
    const moved = new Promise(res => {
        client.onYou((state, time) => {
            if (Number.isInteger(state.x) && Number.isInteger(state.y)) {
                me.update(state, time);
                res();
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
 * @param {{x:number, y:number}} target 
 * @param {MapStore} mapStore 
 */
export async function smartMove(client, me, target, mapStore) {
    const path = astarSearch(me, target, mapStore);
    for (const step of path) {
        const dir = direction(me, step);
        if (!dir) continue;
        console.log("➡️ Moving", dir, "from", me.x, me.y, "to", step.x, step.y);
        await moveAndWait(client, me, dir);
    }
}