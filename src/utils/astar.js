import { coord2Key, key2Coord } from "../utils/hashMap.js";
import { distance } from "../utils/geometry.js";
import { MapStore } from "../models/mapStore.js";

/**
 * Returns path from start to goal using A* on known map
 * @param {{x: number, y: number}} start
 * @param {{x: number, y: number}} goal
 * @param {MapStore} mapStore
 * @returns {Array<{x: number, y: number}>}
 */
export function astarSearch(start, goal, mapStore) {
  const startKey = coord2Key(start);
  const goalKey = coord2Key(goal);

  if (!mapStore.map.has(startKey) || !mapStore.map.has(goalKey)) {
    console.warn("A*: Start or goal not in mapStore:", startKey, goalKey);
    return [];
  }

  if (mapStore.map.get(startKey) === 0 || mapStore.map.get(goalKey) === 0) {
    console.warn("A*: Start or goal is a hole");
    return [];
  }

  const openSet = new Set([startKey]);
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const fScore = new Map([[startKey, distance(start, goal)]]);

  while (openSet.size > 0) {
    // pick node in openSet with lowest fScore
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
      return path.reverse();
    }

    openSet.delete(currentKey);

    // explore neighbors
    for (const { dx, dy } of [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]) {
      const neighbor = { x: current.x + dx, y: current.y + dy };
      const neighborKey = coord2Key(neighbor);

      if (!mapStore.map.has(neighborKey)) continue;
      if (mapStore.map.get(neighborKey) === 0) continue;

      const tentativeG = (gScore.get(currentKey) || 0) + 1;
      if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + distance(neighbor, goal));
        openSet.add(neighborKey);
      }
    }
  }

  console.warn("A*: No path found from", startKey, "to", goalKey);
  return [];
}

/**
 * Determines direction between two adjacent tiles.
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @returns {'up'|'down'|'left'|'right'|null}
 */
export function direction(from, to) {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  if (to.y > from.y) return 'up';
  if (to.y < from.y) return 'down';
  return null;
}
