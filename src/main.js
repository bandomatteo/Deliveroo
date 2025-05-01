import DeliverooClient from './api/deliverooClient.js';
import { Me } from './models/me.js';
import { ParcelsStore } from './models/parcelsStore.js';
import { distance } from './utils/geometry.js';
import { astarSearch, direction } from './utils/astar.js';
import { MapStore } from './models/mapStore.js';
//import { printTileNeighborhood } from './utils/debug.js';

async function main() {
  const client = new DeliverooClient();

  const me = new Me();
  const parcels = new ParcelsStore();
  const mapStore = new MapStore();

  client.onYou((payload, time) => {
    me.update(payload, time);
  });

  // TODO: probably we can delete this one
  client.onTile(({ x, y, type }) => {
    const key = `${x},${y}`;
   // console.log(` TILE: (${x}, ${y}) = ${type}`);
    mapStore.addTile({ x, y, type: parseInt(type) });
  });

  client.onMap((width, height, tiles) => {
    mapStore.mapSize = width;
    for (const tile of tiles) {
      mapStore.addTile({ x: tile.x, y: tile.y, type: tile.type });
    }
    console.log(` Loaded  ${tiles.length} tiles of the map`);

    mapStore.calculateDistances();
    console.log(" Distances calculated.\n The map is ready.");
  });


  client.onParcelsSensing((pp) => {
    console.log(` Sensing ${pp.length} parcel(s)`);
    for (const p of pp) {
      parcels.addParcel(p, mapStore);
    }
  });

  function isInsideMap({ x, y }, mapStore) {
    const size = mapStore.mapSize;
    return x >= 0 && x < size && y >= 0 && y < size;
  }

  function getPathToParcel(me, parcel, mapStore) {
    const mainPath = astarSearch(me, parcel, mapStore);
    if (mainPath.length > 0) return mainPath;

    //TODO: I added this to avoid a bug where the path is blocked by a hole, but probably now it can be removed (just try it with other players, maybe it can be useful)
    const around = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    for (const { dx, dy } of around) {
      console.log(` Trying to go around (${parcel.x}, ${parcel.y})`);
      const goal = { x: parcel.x + dx, y: parcel.y + dy };
      if (!isInsideMap(goal, mapStore)) continue;
      const altPath = astarSearch(me, goal, mapStore);
      if (altPath.length > 0) return altPath;
    }

    return [];
  }

  while (true) {
    await new Promise(res => setTimeout(res, 100));

    if (!me.id || parcels.available.length === 0) continue;

    const reachable = parcels.available
      .map(p => ({ parcel: p, path: getPathToParcel(me, p, mapStore) }))
      .filter(entry => entry.path.length > 0)
      .sort((a, b) => a.path.length - b.path.length);

    if (reachable.length === 0) {
      console.log(" No reachable parcels");
      for (const p of parcels.available) {
        console.log(`- Pacco ${p.id} @ (${p.x}, ${p.y}) → path: []`);
        //printTileNeighborhood(p, mapStore);
      }
      continue;
    }

    const { parcel, path } = reachable[0];
    console.log(` I'm going to take this parcel: ${parcel.id} @ (${parcel.x}, ${parcel.y})`);

    for (const step of path) {
      const dir = direction(me, step);
      if (!dir) continue;

      const moved = new Promise(res => {
        client.onYou((state, time) => {
          if (state.x % 1 === 0 && state.y % 1 === 0) {
            me.update(state, time);
            res();
          }
        });
      });

      await client.emitMove(dir);
      await moved;
    }
    await client.emitPickup();
  }
}

main();
