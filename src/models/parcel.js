import { key2Coord } from "../utils/hashMap.js";
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

        this.calculateNearestBase(mapStore);
    }

    /**
     * Calculate distance from parcel to nearest base
     * @param { MapStore } mapStore 
     */
    calculateNearestBase(mapStore) {
        for (const key of mapStore.bases) {
            let coords = key2Coord(key);

            let distance = mapStore.distance(this, coords);

            if (distance <= this.baseDistance) {
                this.baseDistance = distance;
            }
        }
    }
}
  