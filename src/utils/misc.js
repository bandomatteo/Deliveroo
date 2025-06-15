import { MapStore } from "../models/mapStore.js";
import { ServerConfig } from "../models/serverConfig.js";

/**
 * @module misc
 * @description
 * This module provides utility functions for calculating scores related to parcel pickup in a grid-based game.
 * It includes a function to compute the score for picking up parcels based on various parameters such as starting position,
 * goal position, carried value, carried count, reward, pickup count, base distance, clock penalty, and map store.
 * The score is calculated by considering the total reward, distance to the parcel, and the number of parcels involved.
 * The function is useful for determining the optimal strategy for parcel pickup in the game.
 * @example
 * // Example usage:
 * import { getPickupScore } from './misc';
 * const startPos = { x: 1, y: 2 };
 * const goalPos = { x: 3, y: 4 };
 * const carriedValue = 100;
 * const carriedCount = 2;
 * const reward = 50;
 * const pickupCount = 3;
 * const baseDistance = 5;
 * const clockPenalty = 0.1;
 * const mapStore = new MapStore();
 * const configuration = new ServerConfig();
 * const score = getPickupScore(startPos, goalPos, carriedValue, carriedCount, reward, pickupCount, baseDistance, clockPenalty, mapStore, configuration);
 * console.log(score); // Outputs the calculated score for picking up parcels
 */

/**
 * Calculates the score for picking up parcels based on various parameters.
 * @param {Object} startPos - The starting position of the player, with x and y properties.
 * @param {Object} goalPos - The goal position of the parcel, with x and y properties.
 * @param {number} carriedValue - The total value of parcels currently being carried by the player.
 * @param {number} carriedCount - The number of parcels currently being carried by the player.
 * @param {number} reward - The reward value of the parcel being picked up.
 * @param {number} pickupCount - The number of parcels to be picked up.
 * @param {number} baseDistance - The base distance to consider for the pickup.
 * @param {number} clockPenalty - The penalty applied to the score based on time.
 * @param {MapStore} mapStore - An instance of MapStore to calculate distances.
 * @param {ServerConfig} configuration - An instance of ServerConfig containing game configuration settings.
 * @returns {number} - The calculated score for picking up parcels.
 * @description
 * This function computes the score for picking up parcels by considering the total reward from carried parcels and the parcel being picked up,
 * the distance to the parcel, and the number of parcels involved. The score is adjusted by a clock penalty based on the total distance traveled.
 * If the base distance is not provided, it defaults to 0. The function uses the MapStore instance to calculate the distance between the start and goal positions.
 * The score is calculated as follows:
 * 1. Calculate the distance to the parcel using the MapStore's distance method.
 * 2. Compute the total reward as the sum of carried value and the reward for the parcel being picked up.
 * 3. Calculate the total distance as the sum of the distance to the parcel and the base distance.
 * 4. Determine the total number of parcels as the sum of carried count and pickup count.
 * 5. Finally, calculate the score as the total reward minus the product of total distance, total parcels, and clock penalty divided by the decaying interval.
 */
export function getPickupScore(startPos, goalPos, carriedValue, carriedCount, reward, pickupCount, baseDistance, clockPenalty, mapStore, configuration) {
    if (baseDistance === null || baseDistance === undefined) {
        baseDistance = 0;
    }
    
    const distanceToParcel = mapStore.distance(startPos, goalPos);

    // Total reward = sum of all carried parcels + this parcel's reward (or group of parcels)
    const totalReward = carriedValue + reward;

    const totalDistance = distanceToParcel + baseDistance;

    const totalParcels = carriedCount + pickupCount;

    // reward potenziale: reward totale - costo temporale del viaggio
    return totalReward - (totalDistance * totalParcels * clockPenalty / configuration.parcels_decaying_interval);
}