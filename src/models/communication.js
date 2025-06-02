import { MapStore } from "./mapStore.js";

export class Communication {
    constructor() {
        this.resetDrop();

        this.moveAwayAgentId = null;
    }

    resetDrop() {
        // Drop parcel handling
        this.droppedValue = 0;
        this.droppedQuantity = 0;
        this.agentToPickup = null;
        /**
         * @type {{x : number, y : number}}
         */
        this.droppedCoord = { x: undefined, y: undefined };
        this.droppedBaseDistance = null;
    }

    /**
     * 
     * @param {{x : number, y : number}} position 
     * @param {number} value 
     * @param {number} quantity
     * @param {string} agentToPickup 
     * @param {MapStore} mapStore
     */
    setDropped(position, value, quantity, agentToPickup, mapStore) {
        this.droppedCoord.x = position.x;
        this.droppedCoord.y = position.y;
        this.droppedValue = value;
        this.droppedQuantity = quantity;
        this.agentToPickup = agentToPickup;
        //
        let [base, minDist] = mapStore.nearestBase(this.droppedCoord);
        this.droppedBaseDistance = minDist;
    }
}