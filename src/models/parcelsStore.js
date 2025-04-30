import { Parcel } from "./parcel.js";

/**
 * Manages the current known parcels.
 */
export class ParcelsStore {
    constructor() {
      this.map = new Map();
    }
  
    /**
     * Update the store from sensing event.
     * @param {Array<{id:string,carriedBy?:string,x:number,y:number,reward:number}>} parcelsArray
     */
    updateAll(parcelsArray, mapStore) {
      this.map.clear();
      parcelsArray.forEach(p => {
        this.addParcel(p, mapStore);
      });
    }

    addParcel(p, mapStore) {
      let parcel = new Parcel(p, mapStore);
      this.map.set(parcel.id, parcel);
    }
  
    /**
     * Returns only parcels not carried by anyone.
     */
    get available() {
      return Array.from(this.map.values())
        .filter(p => !p.carriedBy);
    }
  }
  