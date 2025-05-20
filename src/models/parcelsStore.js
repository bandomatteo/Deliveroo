import { MapStore } from "./mapStore.js";
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

    /**
     * Add parcel to the ParcelStore
     * @param {*} p 
     * @param {MapStore} mapStore 
     */
    addParcel(p, mapStore) {
      let parcel = new Parcel(p, mapStore);
      this.map.set(parcel.id, parcel);
    }

    /**
     * Remove parcel from the ParcelStore
     * @param {*} p 
     */
    removeParcel(p) {
      this.map.delete(p.id);
    }
  
    /**
     * Returns only parcels not carried by anyone.
     */
    get available() {
      return Array.from(this.map.values())
        .filter(p => !p.carriedBy);
    }

    /**
     * Return set of parcels id that are currently available
     */
    get availableIdSet() {
      return new Set(
        Array.from(this.map.values())
          .filter(p => !p.carriedBy)
          .map(p => p.id)
      );
    }

    /**
     * Return only parcels carried by played with id = id
     * @param {string} id
     */
    carried(id) {
      return Array.from(this.map.values())
        .filter(p => p.carriedBy === id);
    }

    /**
     * Lowers the score of each parcel in memory
     * @param {number} amountToSubtract 
     */
    updateReward(amountToSubtract) {
      const availableParcels = this.availableIdSet;
      
      for (const [key, parcel] of this.map) {

        if (key in availableParcels) {
          continue;
        }

        parcel.reward -= amountToSubtract;

        if (parcel.reward <= 0) {
          this.removeParcel(parcel);
        }
      }
    }
  }
  