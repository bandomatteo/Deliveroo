import { DIRECTIONS } from "./directions.js";

/**
 * @module geometry
 * @description
 * This module provides utility functions for geometric calculations in a grid-based game.
 * It includes functions to calculate the Manhattan distance and Euclidean distance between two points,
 * as well as a function to determine if a player is moving towards a specific parcel based on their direction.
 * The functions operate on coordinate objects with x and y properties, and the direction is represented as a string.
 * The module is useful for pathfinding, collision detection, and movement logic in grid-based games.
 * @example
 * // Example usage:
 * const pointA = { x: 1, y: 2 };
 * const pointB = { x: 4, y: 6 }; 
 * const manhattanDistance = distance(pointA, pointB); // 7
 * const euclideanDistance = euclidean_distance(pointA, pointB); // 5
 * const player = { x: 3, y: 4, direction: "up" };
 * const parcel = { x: 3, y: 5 };
 * const isMovingTowards = goingTowardsParcel(player, parcel); // true
 */

/**
 * 
 * @param {{x:number, y:number}} a
 * @param {{x:number, y:number}} b
 * @description
 * Calculates the Manhattan distance between two points.
 * The Manhattan distance is the sum of the absolute differences of their Cartesian coordinates.
 * It is often used in grid-based pathfinding algorithms.
 * @return {number} - The Manhattan distance between points a and b.
 */
export function distance(a, b) {
  const dx = Math.abs(Math.round(a.x) - Math.round(b.x));
  const dy = Math.abs(Math.round(a.y) - Math.round(b.y));
  return dx + dy;
}

/**
 * @param {{x:number, y:number}} a
 * @param {{x:number, y:number}} b
 * @description
 * Calculates the Euclidean distance between two points.
 * The Euclidean distance is the straight-line distance between two points in Euclidean space.
 * It is calculated using the Pythagorean theorem.
 * @return {number} - The Euclidean distance between points a and b.
 */
export function euclidean_distance(a, b) {
  const dx = Math.pow(a.x - b.x, 2);
  const dy = Math.pow(a.y - b.y, 2);
  return Math.sqrt(dx + dy);
}

/**
 * 
 * @param {{x:number, y:number, direction: string}} a
 * @param {{x:number, y:number}} p
 * @description
 * Checks if a player is moving towards a specific parcel based on their direction.
 * The function evaluates the player's direction and compares it with the position of the parcel.
 * If the player is moving in the direction of the parcel, it returns true; otherwise, it returns false.
 * @return {boolean} - True if the player is moving towards the parcel, false otherwise.
 */
export function goingTowardsParcel(a, p) {
  switch(a.direction) {
    case DIRECTIONS.NONE :
      return false;
    case DIRECTIONS.LEFT :
      return p.x < a.x;
    case DIRECTIONS.RIGHT :
      return p.x > a.x;
    case DIRECTIONS.UP :
      return p.y > a.y;
    case DIRECTIONS.DOWN :
      return p.y < a.y;
  }
}