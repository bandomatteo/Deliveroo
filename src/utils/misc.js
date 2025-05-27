import { MapStore } from "../models/mapStore.js";
import { ServerConfig } from "../models/serverConfig.js";

/**
 * @param {{x: number, y: number}} startPos - Starting position
 * @param {{x: number, y: number}} goalPos - Goal position (tile in which there are parcels)
 * @param {number} carriedValue 
 * @param {number} carriedCount
 * @param {number} reward - Reward of parcels of group of parcels in a tile
 * @param {number} baseDistance 
 * @param {number} clockPenalty 
 * @param {MapStore} mapStore 
 * @param {ServerConfig} configuration
 */
export function getPickupScore(startPos, goalPos, carriedValue, carriedCount, reward, baseDistance, clockPenalty, mapStore, configuration) {
    const distanceToParcel = mapStore.distance(startPos, goalPos);

    // Total reward = sum of all carried parcels + this parcel's reward (or group of parcels)
    const totalReward = carriedValue + reward;

    const totalDistance = distanceToParcel + baseDistance;

    const totalParcels = carriedCount + 1;

    // reward potenziale: reward totale - costo temporale del viaggio
    return totalReward - (totalDistance * totalParcels * clockPenalty / configuration.parcels_decaying_interval);
}