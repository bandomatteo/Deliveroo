import DeliverooClient from "./api/deliverooClient.js";
import { Me }          from "./models/me.js";
import { ParcelsStore }from "./models/parcelsStore.js";
import { MapStore }    from "./models/mapStore.js";
import { Agent }       from "./agent/agent.js";
import { AgentStore } from "./models/agentStore.js";
import { ServerConfig } from "./models/serverConfig.js";
import { Communication } from "./models/communication.js";

async function main() {
  console.log("Creating clients...");
  const client1   = new DeliverooClient(true);   //true for master, false for slave
  const client2 = new DeliverooClient(false);

  console.log("Creating models...");
  const me1       = new Me();
  const me2 = new Me();
  
  //Shared stores
  const parcels  = new ParcelsStore();
  const mapStore = new MapStore();
  const agentStore = new AgentStore();
  const serverConfig = new ServerConfig();
  const communication = new Communication();

  const agent1    = new Agent(client1, me1,me2, parcels, mapStore, agentStore,communication, serverConfig,true);
  const agent2 = new Agent(client2, me2,me1, parcels, mapStore, agentStore, communication, serverConfig,false);

  client1.onYou((payload, time) => {
    //console.log("Master received onYou:", payload);
    me1.update(payload, time);
  });
  
  client2.onYou((payload, time) => {
    //console.log("Slave received onYou:", payload);
    me2.update(payload, time);
  });

  // Eventi per il master
  client1.onTile(({ x, y, type }) =>
    mapStore.addTile({ x, y, type: parseInt(type) })
  );
  
  client1.onConfig(config => {
    serverConfig.updateConfig(config);
  });

  client1.onMap((w, h, tiles) => {
    mapStore.mapSize = w;
    tiles.forEach(t =>
      mapStore.addTile({ x: t.x, y: t.y, type: t.type })
    );
   // console.log(`Master Map loaded (${tiles.length} tiles)`);
    mapStore.calculateDistances();
    mapStore.calculateSparseness(serverConfig);
  });

  client1.onParcelsSensing(pp => {
    //console.log("Master received parcels, mapSize:", mapStore.mapSize);
    if (mapStore.mapSize > 0) {
      parcels.updateAll(me1, pp, mapStore, serverConfig);
    }
  });

  client2.onParcelsSensing(pp => {
    //console.log("Slave received parcels, mapSize:", mapStore.mapSize);
    if (mapStore.mapSize > 0) {
      parcels.updateAll(me2, pp, mapStore, serverConfig); 
    }
  });

  client1.onAgentsSensing(agents => {
    agents.forEach(a => agentStore.addAgent(a, me1.ms));
  });
  
  client2.onAgentsSensing(agents => {
    agents.forEach(a => agentStore.addAgent(a, me2.ms)); 
  });

  while (true) {
    await new Promise(r => setTimeout(r, serverConfig.clock));
    
    // Debug
    //console.log(`Master: id=${me.id}, isMoving=${agent.isMoving}`);
   // console.log(`Slave: id=${meSlave.id}, isMoving=${agentSlave.isMoving}`);
    //console.log(`MapStore size: ${mapStore.mapSize}`);
    
    // Verifica che entrambi siano pronti e la mappa caricata
    const masterReady = me1.id && !agent1.isMoving && mapStore.mapSize > 0;
    const slaveReady = me2.id && !agent2.isMoving && mapStore.mapSize > 0;
    
    if (!masterReady && !slaveReady) {
      //console.log("Waiting for agents to be ready...");
      continue;
    }
    
    // Fai agire entrambi in parallelo
    const promises = [];
    
    if (masterReady) {
      //console.log("Master is acting...");
      agent1.updateBeliefs();
      agent1.generateDesires();
      agent1.filterIntentions();
      promises.push(agent1.act());
    }
    
    if (slaveReady) {
      //console.log("Slave is acting...");
      agent2.updateBeliefs();
      agent2.generateDesires();
      agent2.filterIntentions();
      promises.push(agent2.act()); 
    }
    
    await Promise.all(promises);
    //console.log("Cycle completed");
  }
}

main()