import { smartMove, smartMoveToNearestBase, smartMoveToNearestBaseAndPutDown} from "../actions/movement.js";
import DeliverooClient from "../api/deliverooClient.js";
import { MapStore } from "../models/mapStore.js";
import { Me } from "../models/me.js";
import { ParcelsStore } from "../models/parcelsStore.js";
import { INTENTIONS } from "../utils/intentions.js";

export class Agent {
  /**
   * @param {DeliverooClient} client
   * @param {Me}               me
   * @param {ParcelsStore}     parcels
   * @param {MapStore}         mapStore
   */
  constructor(client, me, parcels, mapStore) {
    this.client   = client;
    this.me       = me;
    this.parcels  = parcels;
    this.mapStore = mapStore;

    this.oldTime = null;
    this.seconds_per_move = 0.1;

    // this.options    = [];
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

  
  // generateOptions() {
  //   this.options = [
  //     INTENTIONS.GO_PICKUP,
  //     INTENTIONS.GO_DEPOSIT,
  //     INTENTIONS.EXPLORE
  //   ];
  // }

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

    this.desires.push({type : INTENTIONS.GO_EXPLORE, score : 0.0001});
  }

  //TODO: Follow jonathan's idea 
  /**
   * Select the highest-priority intention that matches a desire.
   * Priority: GO_DEPOSIT > GO_PICKUP > EXPLORE
   */
  filterIntentions() {
    // define priority order of intentions (we need to edit this one)
    // const priority = [
    //   INTENTIONS.GO_DEPOSIT,
    //   INTENTIONS.GO_PICKUP,
    //   INTENTIONS.EXPLORE
    // ];

    // const desireSet = new Set(this.desires);
    this.intentions = this.desires.sort((a, b) => {return b.score - a.score});
  }

  async act() {
    const intention = this.intentions[0];
    switch (intention.type) {
      case INTENTIONS.GO_PICKUP:
        return this.achievePickup(intention.parcel);
      case INTENTIONS.GO_DEPOSIT:
        return this.achieveDeposit();
      case INTENTIONS.EXPLORE:
        return this.achieveExplore();
      default:
        return;
    }
  }

  async achievePickup(p) {
    //console.log(p.reward);
    console.log("[Agent] GO_PICKUP");
    // const mePos = { x: this.me.x, y: this.me.y };

    // const parcelsWithDistance = this.parcels.available.map(parcel => ({
    //   parcel, distance: this.mapStore.distance(this.me, parcel)
    // }));

    // // filter out parcels that are unreachable
    // const reachable = parcelsWithDistance.filter(({ distance }) =>
    //   Number.isFinite(distance)
    // );

    // // sort parcels by distance
    // const candidates = reachable.sort((a, b) =>
    //   a.distance - b.distance
    // );

    // if (candidates.length === 0) {
    //   console.warn("[Agent] no reachable parcels");
    //   return;
    // }

    // go and pick the nearest parcel
    // const parcel = candidates[0].parcel;

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

  //TODO: Implement this one betetr because now the agent moves randomly
  async achieveExplore() {
    console.log("[Agent] EXPLORE");
    // Explore
    let spawnTileCoord = this.mapStore.randomSpawnTile
    await smartMove(this.client, this.me, spawnTileCoord, this.mapStore);
  }
}
