import { getPickupScore } from "../utils/misc.js";
import { MapStore } from "./mapStore.js";
import { ServerConfig } from "./serverConfig.js";
import config from "../utils/gameConfig.js"
import { ParcelsStore } from "./parcelsStore.js";


/**
 * Parcel class to represent a parcel in the game
 * @class
 * @description
 * This class is used to represent a parcel in the game.
 * It contains properties such as id, carriedBy, x, y, reward, baseDistance, lastSeen, existingProb, nearestBase,
 * potentialPickUpReward, and potentialPickUpRewardSlave
 * @param {Object} parcel - The parcel object containing id, carriedBy, x, y, reward
 * @param {MapStore} mapStore - The MapStore instance containing the bases
 * @param {number} frame - The current frame number
 * @param {ParcelsStore} parcelStore - The ParcelStore instance managing parcels
 * @property {string} id - The unique identifier of the parcel.
 * @property {string|null} carriedBy - The ID of the agent currently carrying the parcel, or null if not carried.
 * @property {number} x - The x-coordinate of the parcel's position.
 * @property {number} y - The y-coordinate of the parcel's position.
 * @property {number} reward - The reward value of the parcel.
 * @property {number} baseDistance - The distance to the nearest base for this parcel.
 * @property {number} lastSeen - The frame number when the parcel was last seen.
 * @property {number} existingProb - The survival probability of the parcel based on the last seen frame and agent count.
 * @property {{x: number, y: number}|null} nearestBase - The coordinates of the nearest base to the parcel, or null if not applicable.
 * @property {number} potentialPickUpReward - The potential reward for picking up the parcel (for master instance).
 * @property {number} potentialPickUpRewardSlave - The potential reward for picking up the parcel (for slave instance).
 */
export class Parcel {
    constructor(parcel, mapStore, frame, parcelStore) {
        this.id = parcel.id;
        this.carriedBy = parcel.carriedBy;
        this.x = parcel.x;
        this.y = parcel.y;
        this.reward = parcel.reward;

        this.baseDistance = Infinity;

        this.lastSeen = frame;
        this.existingProb = 1;

        
         // @type {{x : number, y : number}}
         
        this.nearestBase = null;

        if (!this.carriedBy) {
            this.calculateNearestBase(mapStore);
        }

        this.potentialPickUpReward = 0; // Reward potenziale per il pickup
        this.potentialPickUpRewardSlave = 0;

    }

   /**
    * calculate the nearest base to this parcel
    * @param {MapStore} mapStore - The MapStore instance containing the bases
    * @description
    * This method calculates the nearest base to the parcel and updates the baseDistance and nearestBase properties.
    * It uses the nearestBase method from the MapStore to find the closest base and its distance.
    * If no base is found, the baseDistance remains Infinity and nearestBase is null.
    * @returns {void}
    */
    calculateNearestBase(mapStore) {
        let [base, minDist] = mapStore.nearestBase(this);

        this.baseDistance = minDist;

        if (base) {
            this.nearestBase = { x: base.x, y: base.y };
        }
    }

    /**
     * Calculate the survival probability of the parcel based on the last seen frame and agent count
     * @param {number} currentFrame - The current frame number
     * @param {number} agentCount - The number of agents in the game
     * @description
     * This method calculates the survival probability of the parcel based on the time since it was last seen and the number of agents.
     * The probability decreases exponentially with time and increases with the number of agents.
     * @example
     * // Example usage:
     * const parcel = new Parcel(parcelData, mapStore, currentFrame, parcelStore);
     * parcel.calculateSurvivalProbability(currentFrame, agentCount);
     */
    calculateSurvivalProbability(currentFrame, agentCount) {
        const seconds = (currentFrame - this.lastSeen) / 20;
        this.existingProb = Math.exp(-config.PARCEL_SURVIVAL_LAMBDA * seconds * agentCount);    // Con 1 agente -> 50% in 10 sec, con 2 50% in 5 sec, ...

    }


    /**
     * Calculate the potential pickup reward for this parcel
     * @param {Object} agentPos - The position of the agent attempting to pick up the parcel
     * @param {boolean} isMaster - Whether the current instance is the master instance
     * @param {number} carriedValue - The total value of parcels currently carried by the agent
     * @param {number} carriedCount - The number of parcels currently carried by the agent
     * @param {MapStore} mapStore - The MapStore instance containing the game map
     * @param {number} clockPenalty - The clock penalty applied to the reward calculation
     * @param {ServerConfig} config - The server configuration settings
     * @description
     * This method calculates the potential pickup reward for a parcel based on its position, carried value, and other parameters.
     * It updates the potentialPickUpReward or potentialPickUpRewardSlave property based on whether it is called from the master or slave instance.
     */
    calculatePotentialPickUpReward(agentPos, isMaster, carriedValue, carriedCount, mapStore, clockPenalty, config) {
        if (this.carriedBy)
            return -Infinity; // Already carried, no reward
        
        const potentialReward = getPickupScore(agentPos, this, carriedValue, carriedCount, this.reward, 1, this.baseDistance, clockPenalty, mapStore, config);

        if (isMaster) {
            this.potentialPickUpReward = potentialReward;
        }
        else {
            this.potentialPickUpRewardSlave = potentialReward;
        }
    }
}