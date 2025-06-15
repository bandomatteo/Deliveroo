/**
 * @module DIRECTIONS
 * @description
 * This module provides utility functions for handling directions in a grid-based game.
 * It defines a set of constants for directions and includes a function to get the opposite direction.
 * The directions are represented as strings, and the module includes a function to determine the opposite direction
 * based on the input direction.    
 */
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