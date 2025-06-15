import { distance } from "../utils/geometry.js";
import { MapStore } from "./mapStore.js";
import { Me } from "./me.js";
import { Parcel } from "./parcel.js";
import { ServerConfig } from "./serverConfig.js";

/**
 * ParcelsStore class to manage parcels in the game
 * @class 
 * @description
 * This class is responsible for managing parcels in the game.
 * It allows adding, removing, and updating parcels, as well as retrieving available parcels and those carried by players.
 */
export class ParcelsStore {
    constructor() {
      
      this.map = new Map();
    }
  
    /**
     * Update the parcels store with new parcels data
     * @param {Me} me - The local player object
     * @param {Array} parcelsArray - Array of parcel objects to update the store with
     * @param {MapStore} mapStore - The MapStore instance containing the game map
     * @param {ServerConfig} config - The server configuration object
     * @description
     * This method updates the parcels store by first removing parcels that are no longer visible to the player,
     * and then adding the new parcels from the provided array.
     * It checks the visibility of parcels based on the player's position and the game configuration.
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
     * Add a parcel to the ParcelStore
     * @param {*} p - Parcel object containing id, x, y, reward, etc.
     * @param {MapStore} mapStore - The MapStore instance containing the game map
     * @param {number} frame - The current frame number
     * @description
     * This method creates a new Parcel instance and adds it to the parcels map.
     * If the parcel already exists, it will update its state.
     */
    addParcel(p, mapStore, frame) {
      let parcel = new Parcel(p, mapStore, frame);
      this.map.set(parcel.id, parcel);
    }

    /**
     * Remove a parcel from the ParcelStore
     * @param {*} p - Parcel object containing id
     * @description
     * This method removes a parcel from the parcels map based on its ID.
     */
    removeParcel(p) {
      this.map.delete(p.id);
    }
  
    /**
     * Return all parcels that are currently available
     * @returns {Parcel[]}
     * @description
     * This method filters the parcels map to return only those parcels that are not currently carried by any player
     * and have an existing probability greater than or equal to 0.5.
     * It returns an array of available Parcel instances.
     */
    get available() {
      return Array.from(this.map.values())
        .filter(p => !p.carriedBy)
        .filter(p => p.existingProb >= 0.5);
    }

    /**
     * Return a Set of IDs of all available parcels
     * @returns {Set<string>}
     * @description
     * This method creates a Set from the IDs of all parcels that are currently available (not carried by any player).
     * It is useful for quickly checking the availability of parcels by their IDs.
     */
    get availableIdSet() {
      return new Set(
        Array.from(this.map.values())
          .filter(p => !p.carriedBy)
          .map(p => p.id)
      );
    }

    /**
     * Return all parcels that are currently carried by a specific player
     * @param {string} id - The ID of the player
     * @returns {Parcel[]}
     * @description
     * This method filters the parcels map to return only those parcels that are currently being carried by the specified player.
     * It returns an array of Parcel instances that match the player's ID.
     */
    carried(id) {
      return Array.from(this.map.values())
        .filter(p => p.carriedBy === id);
    }

    /**
     * Update the reward of all parcels by subtracting a specified amount
     * @param {number} amountToSubtract - The amount to subtract from each parcel's reward
     * @param {number} frame - The current frame number
     * @param {number} agentCount - The number of agents in the game
     * @param {ServerConfig} config - The server configuration object
     * @description
     * This method iterates through all parcels in the store, subtracts the specified amount from each parcel's reward,
     * and updates its survival probability based on the current frame and agent count.
     * If a parcel's reward drops to zero or below, it is removed from the store.
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
     * Get all parcels that are visible to the player based on their position and game configuration
     * @param {Me} me - The local player object
     * @param {ServerConfig} config - The server configuration object
     * @returns {Set<string>} - A Set of IDs of visible parcels
     * @description
     * This method filters the parcels map to return a Set of IDs of parcels that are within a certain distance from the player's position,
     * as defined by the game configuration. It is useful for determining which parcels the player can interact with.
     */
    visible(me, config) {
        return new Set(Array
          .from(this.map.values())
          .filter(p => distance(p, me) < config.parcels_obs_distance)
          .map(p => p.id));
    }
  }
  