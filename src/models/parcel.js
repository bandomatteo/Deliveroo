import { MapStore } from "./mapStore.js";

export class Parcel {
    /**
     * @param {{id : string, carriedBy? : string, x : number, y : number, reward : number}} parcel 
     * @param { MapStore } mapStore 
     */
    constructor(parcel, mapStore) {
        this.id = parcel.id;
        this.carriedBy = parcel.carriedBy;
        this.x = parcel.x;
        this.y = parcel.y;
        this.reward = parcel.reward;

        this.baseDistance = Infinity;

        /**
         * @type {{x : number, y : number}}
         */
        this.nearestBase = null;

        if (!this.carriedBy) {
            this.calculateNearestBase(mapStore);
        }
    }

    /**
     * Calculate distance from parcel to nearest base
     * @param { MapStore } mapStore 
     */
    calculateNearestBase(mapStore) {
        let [base, minDist] = mapStore.nearestBase(this);

        this.baseDistance = minDist;
        this.nearestBase = {x : base.x, y : base.y};
    }
}
  