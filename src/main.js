import DeliverooClient from './api/deliverooClient.js';
import { Me }         from './models/me.js';
import { ParcelsStore } from './models/parcelsStore.js';
import { distance }   from './utils/geometry.js';
import { blindMove }  from './actions/movement.js';

async function main() {
  const client = new DeliverooClient();

  // TODO: I do think that we can try to encapsulate the belief state of the agent in a single class
  // ----------------------------------------
  // Belief state of the agent
  const me = new Me();                  
  // Belief state of the parcels
  const parcels = new ParcelsStore();
  // ---------------------------------------


  client.onYou((payload, time) => {
    me.update(payload, time);
  });

  client.onParcels(array => {
    parcels.updateAll(array);
  });

  
  while (true) {

    await new Promise(res => setTimeout(res, 100));

    if (!me.id || parcels.available.length === 0) continue;

    /*console.log(`me(${me.x},${me.y})`,
      parcels.available
        .map(p => `${p.reward}@(${p.x},${p.y})`)
        .join(' ')
    );*/
    const nearest = parcels.available
      .sort((a,b) => distance(me, a) - distance(me, b))[0];

    await blindMove(client, me, nearest);
    //console.log('moved to', nearest.id, me.x, me.y);
    await client.emitPickup();
    //console.log('picked up', nearest.id);
  }
}

main();
