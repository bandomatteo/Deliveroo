/**
 * @module directions
 * @description
 * This module exports constants and functions related to movement directions in the game.
 * It defines the possible directions and provides a function to get the opposite direction.
 * @property {Object} DIRECTIONS - An object containing constants for each direction.
 * @property {string} DIRECTIONS.NONE - Represents no direction.
 * @property {string} DIRECTIONS.UP - Represents the upward direction.
 * @property {string} DIRECTIONS.DOWN - Represents the downward direction.
 * @property {string} DIRECTIONS.LEFT - Represents the leftward direction.
 * @property {string} DIRECTIONS.RIGHT - Represents the rightward direction.
 * */

export const DIRECTIONS = {
    NONE:  null,
    UP: "up",
    DOWN: "down",
    LEFT : "left",
    RIGHT : "right"
};

/**
 * Returns the opposite direction of the given direction.
 * @param {string} direction - The direction to find the opposite for.
 * @returns {string} - The opposite direction or null if the input is invalid.
 * @description
 * This function checks the input direction and returns its opposite. If the input is not a valid direction,
 * it returns null.
 */
export function oppositeDirection(direction) {
    switch (direction) {
        case DIRECTIONS.UP :
            return DIRECTIONS.DOWN;
        case DIRECTIONS.DOWN :
            return DIRECTIONS.UP;
        case DIRECTIONS.RIGHT :
            return DIRECTIONS.LEFT;
        case DIRECTIONS.LEFT :
            return DIRECTIONS.RIGHT;
        default :
            return DIRECTIONS.NONE;
    }
}