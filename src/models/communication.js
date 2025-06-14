import { MapStore } from "./mapStore.js";

/**
 * Communication class to handle game communication
 * @class Communication
 * @description
 * This class is responsible for managing the communication related to parcel dropping and picking up.
 * It allows setting the dropped parcel's position, value, quantity, and the agent responsible for picking it up.
 * It also manages the distance to the nearest base for the dropped parcel.
 * It provides methods to reset the drop state and set the dropped parcel's details.
 * 
 */
export class Communication {
    constructor() {
        this.resetDrop();

        this.moveAwayAgentId = null;
    }

    /**
     * Resets the drop state to its initial values.
     * @description
     * This method clears the dropped parcel's details and the agent responsible for picking it up.
     * It also resets the coordinates and distance to the nearest base for the dropped parcel.
     */
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
     * Sets the details of a dropped parcel.
     * @param {Object} position - The coordinates where the parcel is dropped.
     * @param {number} value - The value of the dropped parcel.
     * @param {number} quantity - The quantity of the dropped parcel.
     * @param {string} agentToPickup - The ID of the agent responsible for picking up the parcel.
     * @param {MapStore} mapStore - An instance of MapStore to find the nearest base.
     * @description
     * This method updates the state with the details of a dropped parcel and calculates the distance to the nearest base.
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