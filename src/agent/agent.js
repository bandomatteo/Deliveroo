// Agent.js
import { smartMove, smartMoveToNearestBase } from "../actions/movement.js";
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
    let seconds_per_move = 0.1;

    this.options    = [];
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

  
  generateOptions() {
    this.options = [
      INTENTIONS.GO_PICKUP,
      INTENTIONS.GO_DEPOSIT,
      INTENTIONS.EXPLORE
    ];
  }

  /**
   * Filter options into current desires based on state:
   * - GO_DEPOSIT if carrying any parcels
   * - GO_PICKUP if there are parcels available
   * - EXPLORE otherwise
   */
  generateDesires() {
    this.desires = [];

    if (this.parcels.available.length > 0) {
      this.desires.push(INTENTIONS.GO_PICKUP);
    }

    if (this.parcels.carried(this.me.id).length > 0) {
      this.desires.push(INTENTIONS.GO_DEPOSIT);
    }

    if (this.desires.length === 0) {
      this.desires.push(INTENTIONS.EXPLORE);
    }
  }

  //TODO: Follow jonathan's idea 
  /**
   * Select the highest-priority intention that matches a desire.
   * Priority: GO_DEPOSIT > GO_PICKUP > EXPLORE
   */
  filterIntentions() {
    // define priority order of intentions (we need to edit this one)
    const priority = [
      INTENTIONS.GO_DEPOSIT,
      INTENTIONS.GO_PICKUP,
      INTENTIONS.EXPLORE
    ];

    const desireSet = new Set(this.desires);
    this.intentions = priority.filter(intent => desireSet.has(intent));
  }

  async act() {
    const intention = this.intentions[0];
    switch (intention) {
      case INTENTIONS.GO_PICKUP:
        return this.achievePickup();
      case INTENTIONS.GO_DEPOSIT:
        return this.achieveDeposit();
      case INTENTIONS.EXPLORE:
        return this.achieveExplore();
      default:
        return;
    }
  }

  async achievePickup() {
    console.log("[Agent] GO_PICKUP");
    const mePos = { x: this.me.x, y: this.me.y };

    const parcelsWithDistance = this.parcels.available.map(parcel => ({
      parcel, distance: this.mapStore.distance(mePos, parcel)
    }));

    // filter out parcels that are unreachable
    const reachable = parcelsWithDistance.filter(({ distance }) =>
      Number.isFinite(distance)
    );

    // sort parcels by distance
    const candidates = reachable.sort((a, b) =>
      a.distance - b.distance
    );

    if (candidates.length === 0) {
      console.warn("[Agent] no reachable parcels");
      return;
    }

    // go and pick the nearest parcel
    const parcel = candidates[0].parcel;

    // move towards the parcel and pick up
    await smartMove(this.client, this.me, parcel, this.mapStore);
    await this.client.emitPickup();
  }

  async achieveDeposit() {
    console.log("[Agent] GO_DEPOSIT");
    //const mePos = { x: this.me.x, y: this.me.y };

    // use helper to move to nearest base
    let [base, minDist] = this.mapStore.nearestBase(this.me);
    await smartMove(this.client, this.me, base, this.mapStore);
        
    // drop off all carried parcels
    if (this.me.x === base.x && this.me.y === base.y) {
        this.client.emitPutdown(this.parcels, this.me.id);
    }
  }

  //TODO: Implement this one betetr because now the agent moves randomly
  async achieveExplore() {
    console.log("[Agent] EXPLORE");
    const dirs = [
      { dx:  1, dy:  0 }, // right
      { dx: -1, dy:  0 }, // left
      { dx:  0, dy:  1 }, // down
      { dx:  0, dy: -1 } // up
    ];
    const { x, y } = this.me; // to get the current position
    // pick a random direction
    const r = dirs[Math.floor(Math.random() * dirs.length)];
    const target = { x: x + r.dx, y: y + r.dy };

    // move towards the target cell
    await smartMove(this.client, this.me, target, this.mapStore);
  }
}
