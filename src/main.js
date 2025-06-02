import DeliverooClient from "./api/deliverooClient.js";
import { Me }          from "./models/me.js";
import { ParcelsStore }from "./models/parcelsStore.js";
import { MapStore }    from "./models/mapStore.js";
import { MultiAgent }       from "./agent/agentMulti.js";
import { AgentStore } from "./models/agentStore.js";
import { ServerConfig } from "./models/serverConfig.js";
import { Communication } from "./models/communication.js";
import config from './utils/gameConfig.js';
import { Agent } from "./agent/agent.js";


async function main() {
  console.log("Creating clients...");
  const client = new DeliverooClient(true);

  console.log("Creating models...");
  const me = new Me();
  
  //Shared stores
  const parcels  = new ParcelsStore();
  const mapStore = new MapStore();
  const agentStore = new AgentStore();
  const serverConfig = new ServerConfig();

  const agent = new Agent(client, me, parcels, mapStore, agentStore, serverConfig);

  client.onYou((payload, time) => {
    me.update(payload, time);
  });

  client.onTile(({ x, y, type }) =>
    mapStore.addTile({ x, y, type: parseInt(type) })
  );
  
  client.onConfig(config => {
    serverConfig.updateConfig(config);
  });

  client.onMap((w, h, tiles) => {
    mapStore.mapSize = w;
    tiles.forEach(t =>
      mapStore.addTile({ x: t.x, y: t.y, type: t.type })
    );

    // console.log(`Master Map loaded (${tiles.length} tiles)`);
    mapStore.calculateDistances();
    mapStore.calculateSparseness(serverConfig);
  });

  client.onParcelsSensing(pp => {
    if (mapStore.mapSize > 0) {
      parcels.updateAll(me, pp, mapStore, serverConfig);
    }
  });

  client.onAgentsSensing(agents => {
    agents.forEach(a => agentStore.addAgent(a, me.ms));
  });


  while (true) {
    await new Promise(r => setTimeout(r, serverConfig.clock));
    
    // Verifica che siano pronto l'agente e la mappa caricata
    const agentReady = me.id && !agent.isMoving && mapStore.mapSize > 0;
    
    if (!agentReady) {
      // console.log("Waiting for agents to be ready...");
      continue;
    }

    agent.updateBeliefs();
    agent.generateDesires();
    agent.filterIntentions();
    await agent.act();
  }
}

main()