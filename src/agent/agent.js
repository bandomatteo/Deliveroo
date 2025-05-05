import { moveAndWait, smartMove, smartMoveToNearestBase, smartMoveToNearestBaseAndPutDown} from "../actions/movement.js";
import DeliverooClient from "../api/deliverooClient.js";
import { MapStore } from "../models/mapStore.js";
import { Me } from "../models/me.js";
import { ParcelsStore } from "../models/parcelsStore.js";
import { INTENTIONS } from "../utils/intentions.js";
import { goingTowardsParcel } from "../utils/geometry.js";
import { astarSearch, direction } from "../utils/astar.js";

export class Agent {
  /**
   * @param {DeliverooClient} client
   * @param {Me}               me
   * @param {ParcelsStore}     parcels
   * @param {MapStore}         mapStore
   */
  constructor(client, me, parcels, mapStore, agentStore) {
    this.client   = client;
    this.me       = me;
    this.parcels  = parcels;
    this.mapStore = mapStore;
    this.agentStore = agentStore;

    this.pathIndex = 0;
    this.path = [];

    this.lastIntention = {
      type: null,
    };

    this.oldTime = null;
    this.seconds_per_move = 0.1;

    this.desires    = [];
    this.intentions = [];
  }


  updateBeliefs() {
    // Get frame difference
    if (this.oldTime === null) {
      this.oldTime = this.me.ms;
    }
    const timeDiff = this.me.ms - this.oldTime;
    this.oldTime = this.me.ms;

    // Update parcels
    this.parcels.updateReward(timeDiff / 1000);
  }

  /**
   * Filter options into current desires based on state:
   * - GO_DEPOSIT if carrying any parcels
   * - GO_PICKUP if there are parcels available
   * - EXPLORE otherwise
   */
  generateDesires() {
    this.desires = [];

    let myParcels = this.parcels.carried(this.me.id);
    let carried_value = myParcels.reduce((sum, parcel) => sum + parcel.reward, 0);

    for (const p of this.parcels.available) {
      // Calculate score of picking the parcel and then going home
      let pickup_score = carried_value + p.reward 
        - (this.mapStore.distance(this.me, p) + p.baseDistance) * (myParcels.length + 1) * this.seconds_per_move;
      
      this.desires.push({type : INTENTIONS.GO_PICKUP, parcel : p , score : pickup_score});
    }

    if (myParcels.length > 0) {
      // Calculate score of going home
      let [base, minDist] = this.mapStore.nearestBase(this.me);
      let home_score = carried_value - minDist * myParcels.length * this.seconds_per_move;

      this.desires.push({type : INTENTIONS.GO_DEPOSIT, score : home_score});
    }

    this.desires.push({type : INTENTIONS.EXPLORE, score : 0.0001});
  }

  filterIntentions() {
    this.intentions = this.desires.sort((a, b) => {return b.score - a.score});
  }

  async act() {
    for (let intentionIndex = 0; intentionIndex < this.intentions.length; intentionIndex++) {
      
      // Get current intention
      const intention = this.intentions[intentionIndex];

      let isEqualToLastIntention = intention.type === this.lastIntention.type;

      switch (intention.type) {

        // If pickup -> check if there are other agents
        case INTENTIONS.GO_PICKUP:
          isEqualToLastIntention = isEqualToLastIntention && intention.parcel.id === this.lastIntention.parcel.id;

          let p = intention.parcel;
  
          let visibleAgents = this.agentStore.visible(this.me);
      
          if (visibleAgents.length > 0) {
      
            let canPickup = true;
            const myDist = this.mapStore.distance(this.me, p)
            
            for (let a of visibleAgents) {
                const agentDist = this.mapStore.distance(a, p);

                if (agentDist < myDist && (agentDist <= 1 || goingTowardsParcel(a, p))) {
                  canPickup = false;
                  break;
                }
            }
  
            if (!canPickup) {
                // Drop the parcel and pick the next intention in order
                continue;
            }
          }

          

          this.lastIntention = intention;
          // If program is here, the parcel can be pickup by us
          return this.achievePickup(p, isEqualToLastIntention);
        case INTENTIONS.GO_DEPOSIT:
          this.lastIntention = intention;
          return this.achieveDeposit(isEqualToLastIntention);
        case INTENTIONS.EXPLORE:
          this.lastIntention = intention;
          return this.achieveExplore(isEqualToLastIntention);
        default:
          this.lastIntention = intention;
          return;
      }
    }
  }

  async achievePickup(p, isEqualToLastIntention) {
    //console.log(p.reward);
    console.log("[Agent] GO_PICKUP");

    // move towards the parcel and pick up
    if (!isEqualToLastIntention) {
      // await smartMove(this.client, this.me, p, this.mapStore);
      this.getPath(p);
    }
    
    this.oneStep();
    if (this.me.x === p.x && this.me.y === p.y) {
      await this.client.emitPickup();
    }
  }

  async achievePickup2(p){
    console.log("Achieve pickup 2");

  }

  async achieveDeposit(isEqualToLastIntention) {
    console.log("[Agent] GO_DEPOSIT");
    //const mePos = { x: this.me.x, y: this.me.y };

    // use helper to move to nearest base
    if (!isEqualToLastIntention) {

      let [base, minDist] = this.mapStore.nearestBase(this.me);
      this.getPath(base);
      
      if (this.me.x === base.x && this.me.y === base.y) {
          this.client.emitPutdown(this.parcels, this.me.id);
      }
    }
    // await smartMoveToNearestBaseAndPutDown(this.client, this.me, this.mapStore, this.parcels);
    this.oneStep();
  }

  async achieveExplore(isEqualToLastIntention) {
    console.log("[Agent] EXPLORE");
    // Explore
    if (!isEqualToLastIntention) {
      let spawnTileCoord = this.mapStore.randomSpawnTile
      this.getPath(spawnTileCoord);
    }
    this.oneStep();
  }

   async oneStep(){

    if (!Number.isInteger(this.me.x) || !Number.isInteger(this.me.y)){
      console.log("Agent is not on a tile");
      return;
    }

    if (this.pathIndex >= this.path.length) {
      return;
    }
    
    // console.log(" INSIDE oneStep x "+ this.me.x, "INSIDE oneStep y "+  this.me.y);

    console.log("index = ", this.pathIndex);
    
    const dir = direction (this.me, this.path[this.pathIndex]);
    if (dir)
      await moveAndWait(this.client, this.me, dir);

    this.pathIndex++;
  }

  getPath(target){
    this.pathIndex = 0;
    this.path = astarSearch(this.me, target, this.mapStore);

    console.log("Path size : ", this.path.length);
  }
}
