import DeliverooClient from "./api/deliverooClient.js";
import { Me }          from "./models/me.js";
import { ParcelsStore }from "./models/parcelsStore.js";
import { MapStore }    from "./models/mapStore.js";
import { Agent }       from "./agent/agent.js";

async function main() {
  const client   = new DeliverooClient();
  const me       = new Me();
  const parcels  = new ParcelsStore();
  const mapStore = new MapStore();
  const agent    = new Agent(client, me, parcels, mapStore);

  client.onYou((payload, time) => me.update(payload, time));
  client.onTile(({ x, y, type }) =>
    mapStore.addTile({ x, y, type: parseInt(type) })
  );
  client.onMap((w, h, tiles) => {
    mapStore.mapSize = w;
    tiles.forEach(t =>
      mapStore.addTile({ x: t.x, y: t.y, type: t.type })
    );
    console.log(` Map loaded (${tiles.length} tiles)`);
    mapStore.calculateDistances();
  });
  client.onParcelsSensing(pp => {
    //console.log(`Sensing ${pp.length} parcel(s)`);
    parcels.updateAll
      ? parcels.updateAll(pp, mapStore)
      : pp.forEach(p => parcels.addParcel(p, mapStore));
  });

  // I've tried to follow this one (https://github.com/bandomatteo/Deliveroo/issues/18)
  while (true) {
    await new Promise(r => setTimeout(r, 100));
    if (!me.id) continue;           

    //agent.generateOptions();
    agent.generateDesires();
    agent.filterIntentions();
    await agent.act();
  }
}

main()
