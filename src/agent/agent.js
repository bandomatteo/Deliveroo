import { smartMove, smartMoveToNearestBase, smartMoveToNearestBaseAndPutDown} from "../actions/movement.js";
import DeliverooClient from "../api/deliverooClient.js";
import { MapStore } from "../models/mapStore.js";
import { Me } from "../models/me.js";
import { ParcelsStore } from "../models/parcelsStore.js";
import { INTENTIONS } from "../utils/intentions.js";
import { goingTowardsParcel } from "../utils/geometry.js";

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

      switch (intention.type) {

        // If pickup -> check if there are other agents
        case INTENTIONS.GO_PICKUP:
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

          // If program is here, the parcel can be pickup by us
          return this.achievePickup(p);
        case INTENTIONS.GO_DEPOSIT:
          return this.achieveDeposit();
        case INTENTIONS.EXPLORE:
          return this.achieveExplore();
        default:
          return;
      }
    }
  }

  async achievePickup(p) {
    //console.log(p.reward);
    console.log("[Agent] GO_PICKUP");

    // move towards the parcel and pick up
    await smartMove(this.client, this.me, p, this.mapStore);
    await this.client.emitPickup();
  }

  async achieveDeposit() {
    console.log("[Agent] GO_DEPOSIT");
    //const mePos = { x: this.me.x, y: this.me.y };

    // use helper to move to nearest base
    await smartMoveToNearestBaseAndPutDown(this.client, this.me, this.mapStore, this.parcels);
  }

  async achieveExplore() {
    console.log("[Agent] EXPLORE");
    // Explore
    let spawnTileCoord = this.mapStore.randomSpawnTile
    await smartMove(this.client, this.me, spawnTileCoord, this.mapStore);
  }
}
