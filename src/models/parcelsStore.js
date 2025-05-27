import { distance } from "../utils/geometry.js";
import { MapStore } from "./mapStore.js";
import { Me } from "./me.js";
import { Parcel } from "./parcel.js";
import { ServerConfig } from "./serverConfig.js";

/**
 * Manages the current known parcels.
 */
export class ParcelsStore {
    constructor() {
      /** 
       * @type {Map <string, Parcel>}
       */
      this.map = new Map();
    }
  
    /**
     * Update the store from sensing event.
     * @param {Me} me
     * @param {Array<{id:string,carriedBy?:string,x:number,y:number,reward:number}>} parcelsArray
     * @param {MapStore} mapStore
     * @param {ServerConfig} config
     */
    updateAll(me, parcelsArray, mapStore, config) {
      let visibleParcelIds = this.visible(me, config);
      let sensedParcelIds = new Set(parcelsArray.map(p => p.id));

      visibleParcelIds.forEach(id => {
        if (!sensedParcelIds.has(id)) {
            this.removeParcel(id); // Assuming removeParcel takes an object with id
        }
    });
      
      parcelsArray.forEach(p => {
        this.addParcel(p, mapStore, me.frame);
      });
    }

    /**
     * Add parcel to the ParcelStore
     * @param {*} p 
     * @param {MapStore} mapStore 
     */
    addParcel(p, mapStore, frame) {
      let parcel = new Parcel(p, mapStore, frame);
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
        .filter(p => !p.carriedBy)
        .filter(p => p.existingProb >= 0.5);
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
     * @param {number} frame
     * @param {number} agentCount
     * @param {ServerConfig} config
     */
    updateData(amountToSubtract, frame, agentCount, config) {
      const availableParcels = this.availableIdSet;
      
      for (const [key, parcel] of this.map) {

        if (key in availableParcels) {
          continue;
        }

        parcel.reward -= amountToSubtract * config.parcels_decaying_interval;
        parcel.calculateSurvivalProbability(frame, agentCount);

        if (parcel.reward <= 0) {
          this.removeParcel(parcel);
        }
      }
    }

    /**
     * @param {Me} me 
     * @param {ServerConfig} config
     * @returns {Set <>}
     */
    visible(me, config) {
        return new Set(Array
          .from(this.map.values())
          .filter(p => distance(p, me) < config.parcels_obs_distance)
          .map(p => p.id));
    }
  }
  