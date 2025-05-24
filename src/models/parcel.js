import { MapStore } from "./mapStore.js";

export class Parcel {
    /**
     * @param {{id : string, carriedBy? : string, x : number, y : number, reward : number}} parcel 
     * @param { MapStore } mapStore 
     */
    constructor(parcel, mapStore, frame) {
        this.id = parcel.id;
        this.carriedBy = parcel.carriedBy;
        this.x = parcel.x;
        this.y = parcel.y;
        this.reward = parcel.reward;

        this.baseDistance = Infinity;

        this.lastSeen = frame;
        this.existingProb = 1;

        /**
         * @type {{x : number, y : number}}
         */
        this.nearestBase = null;

        if (!this.carriedBy) {
            this.calculateNearestBase(mapStore);
        }

        this.potentialPickupReward =  0; // Reward potenziale per il pickup
        this.potentialPickUpRewardSlave = 0;
        
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

    /**
     * Calcola la probabilità (tra 0 e 1) che una parcel esista ancora
     * @param {number} currentFrame - Numero di frame trascorsi (20 al secondo)
     * @param {number} agentCount - Numero di agenti attivi
    */
    calculateSurvivalProbability(currentFrame, agentCount) {
        const seconds = (currentFrame - this.lastSeen) / 20;
        const lambda = 0.069;
        this.existingProb = Math.exp(-lambda * seconds * agentCount);    // Con 1 agente -> 50% in 10 sec, con 2 50% in 5 sec, ...

        // console.log("Parcel ", this.id, " - Prob: ", this.existingProb * 100, " %");
    }


    /**
     * Compute the potential reward for picking up this parcel
     * @param {{x: number, y: number}} agentPos - Posizione dell'agente
     * @param {number} carriedValue 
     * @param {number} carriedCount 
     * @param {MapStore} mapStore 
     * @param {number} clockPenalty 
     * 
     *
     */
    calculatePotentialPickUpRewardMaster(agentPos, carriedValue, carriedCount, mapStore, clockPenalty) {
        if (this.carriedBy) 
            return -Infinity; // Already carried, no reward

        const distanceToParcel = mapStore.distance(agentPos, this);
        
        // Total reward = sum of all carried parcels + this parcel's reward
        const totalReward = carriedValue + this.reward;

        const totalDistance = distanceToParcel + this.baseDistance;
        
        const totalParcels = carriedCount + 1;
        
        // reward potenziale: reward totale - costo temporale del viaggio
        const potentialReward = totalReward - (totalDistance * totalParcels * clockPenalty);
        
        this.potentialPickupReward = potentialReward;
    }

    calculatePotentialPickUpRewardSlave(agentPos, carriedValue, carriedCount, mapStore, clockPenalty) {
        if (this.carriedBy) 
            return -Infinity; // Already carried, no reward

        const distanceToParcel = mapStore.distance(agentPos, this);
        
        // Total reward = sum of all carried parcels + this parcel's reward
        const totalReward = carriedValue + this.reward;

        const totalDistance = distanceToParcel + this.baseDistance;
        
        const totalParcels = carriedCount + 1;
        
        // reward potenziale: reward totale - costo temporale del viaggio
        const potentialReward = totalReward - (totalDistance * totalParcels * clockPenalty);
        
        this.potentialPickUpRewardSlave = potentialReward;
    }

    
}