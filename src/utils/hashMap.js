/**
 * @module hashMap
 * @description Utility functions for converting between coordinate objects and string keys.
 * This module provides functions to convert a coordinate object with x and y properties into a string key,
 * and to convert a string key back into a coordinate object.
 * The coordinate format is "x,y", where x and y are numbers.
 * The functions are useful for storing and retrieving coordinates in a hash map or similar data structure.
 * @example
 * // Example usage:
 * const coord = { x: 10, y: 20 };
 * const key = coord2Key(coord); // "10,20"
 * const newCoord = key2Coord(key); // { x: 10, y: 20 }
 * console.log(newCoord); // { x: 10, y: 20 }
 * @returns {string} - The string representation of the coordinate.
 */

/**
 * Converts a coordinate object to a string key.
 * @param { {x: number, y: number} } coord - The coordinate object with x and y properties.
 * @returns {string} - The string key in the format "x,y".
 */
export function coord2Key(coord) {
    return `${coord.x},${coord.y}`;
}

/**
 * Converts a string key back to a coordinate object.
 * @param {string} key - The string key in the format "x,y".
 * @returns { {x: number, y: number} } - The coordinate object with x and y properties.
 */
export function key2Coord(key) {
    let [x, y] = key.split(',').map(Number);
    return { x, y };
}