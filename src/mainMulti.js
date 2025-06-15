import DeliverooClient from "./api/deliverooClient.js";
import { Me }          from "./models/me.js";
import { ParcelsStore }from "./models/parcelsStore.js";
import { MapStore }    from "./models/mapStore.js";
import { MultiAgent }       from "./agent/agentMulti.js";
import { AgentStore } from "./models/agentStore.js";
import { ServerConfig } from "./models/serverConfig.js";
import { Communication } from "./models/communication.js";
import config from './utils/gameConfig.js';


/**
 * Main function to initialize the Deliveroo client, models, and agents.
 * It sets up event listeners for client events and runs the agents' decision-making loop.
 * The agents update their beliefs, generate desires, filter intentions, and act based on the current state of the game.
 * The loop continues until the game is terminated, allowing the agents to continuously adapt to the game environment.
 * @async
 */
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

  const agent1 = new MultiAgent(client1, me1, me2, parcels, mapStore, agentStore,communication, serverConfig, true);
  const agent2 = new MultiAgent(client2, me2, me1, parcels, mapStore, agentStore, communication, serverConfig, false);

  client1.onYou((payload, time) => {
    me1.update(payload, time);
  });
  
  client2.onYou((payload, time) => {
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
    mapStore.calculateDistances();
    mapStore.calculateSparseness(serverConfig);
  });

  client1.onParcelsSensing(pp => {
    if (mapStore.mapSize > 0) {
      parcels.updateAll(me1, pp, mapStore, serverConfig);
    }
  });

  client2.onParcelsSensing(pp => {
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

  

  let firstLoadFlag = true;

  /**
   * Function that executes only on the first loop of the game, after the agents are ready
   */
  function firstLoad() {

    if (config.USE_MAP_DIVISION) {
      // Run k-means to split the map between the 2 agents
      const agent_ids = [me1.id, me2.id];

      let oneEmpty = true;

      for (let i = 0; oneEmpty && i < config.MAX_TRIES_KMEANS; i++) {
        mapStore.kMeans(agent_ids.length, agent_ids, config.MAX_ITERATIONS_KMEANS, config.ERROR_KMEANS);

        oneEmpty = false;

        for (const el of agent_ids) {
          const assignedTiles = Array.from(mapStore.spawnTiles.values()).filter(p => p.assignedTo === el);

          // console.log(el, " -> ", assignedTiles);
          oneEmpty = oneEmpty || assignedTiles.length === 0;

          if (oneEmpty) break;
        }
      }

      // If one is empty after MAX_TRIES, reset
      if (oneEmpty) {
        mapStore.resetKmeans();
      }
    }
  }



  while (true) {
    await new Promise(r => setTimeout(r, serverConfig.clock));
    
    
    // Check if both agents are ready and the map is loaded
    const idLoaded = me1.id && me2.id && mapStore.mapSize > 0;

    const masterReady = idLoaded && !agent1.isMoving;
    const slaveReady = idLoaded && !agent2.isMoving;
    
    if (!idLoaded) {
      continue;
    }

    if (firstLoadFlag) {
      firstLoadFlag = false;
      firstLoad();
    }
    
    // Parallel execution of both agents
    const promises = [];
    
    if (masterReady) {
      agent1.updateBeliefs();
      agent1.generateDesires();
      agent1.filterIntentions();
      promises.push(agent1.act());
    }
    
    if (slaveReady) {
      agent2.updateBeliefs();
      agent2.generateDesires();
      agent2.filterIntentions();
      promises.push(agent2.act());
    }
    
    await Promise.all(promises);
  }
}

main()