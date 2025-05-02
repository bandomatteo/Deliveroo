import DeliverooClient from './api/deliverooClient.js';
import { Me } from './models/me.js';
import { ParcelsStore } from './models/parcelsStore.js';
import { MapStore } from './models/mapStore.js';
import { astarSearch } from './utils/astar.js';
import { smartMove } from './actions/movement.js';

async function main() {
  const client = new DeliverooClient();
  const me = new Me();
  const parcels = new ParcelsStore();
  const mapStore = new MapStore();

  client.onYou((payload, time) => me.update(payload, time));
  client.onTile(({ x, y, type }) => mapStore.addTile({ x, y, type: parseInt(type) }));

  client.onMap((width, height, tiles) => {
    mapStore.mapSize = width;
    tiles.forEach(tile => mapStore.addTile({ x: tile.x, y: tile.y, type: tile.type }));
    console.log(`Loaded ${tiles.length} tiles. Map ready.`);
    mapStore.calculateDistances();
  });

  client.onParcelsSensing(pp => {
    console.log(`Sensing ${pp.length} parcel(s)`);
    parcels.updateAll
      ? parcels.updateAll(pp, mapStore)
      : pp.forEach(p => parcels.addParcel(p, mapStore));
  });

  const isInsideMap = ({ x, y }) => x >= 0 && x < mapStore.mapSize && y >= 0 && y < mapStore.mapSize;

  const getPathToParcel = parcel => {
    let path = astarSearch(me, parcel, mapStore);
    if (path.length) return path;
    for (const { dx, dy } of [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]) {
      const alt = { x: parcel.x + dx, y: parcel.y + dy };
      if (!isInsideMap(alt)) continue;
      path = astarSearch(me, alt, mapStore);
      if (path.length) return path;
    }
    return [];
  };

  while (true) {
    await new Promise(res => setTimeout(res, 100));
    if (!me.id || parcels.available.length === 0) continue;

    const reachable = parcels.available
      .map(parcel => ({ parcel, path: getPathToParcel(parcel) }))
      .filter(e => e.path.length > 0)
      .sort((a, b) => a.path.length - b.path.length);

    if (!reachable.length) {
      console.log("No reachable parcels");
      continue;
    }

    const { parcel } = reachable[0];
    console.log(`Collecting parcel ${parcel.id} at (${parcel.x},${parcel.y})`);

    await smartMove(client, me, parcel, mapStore);
    await client.emitPickup();
  }
}

main();
