import { DIRECTIONS } from "./directions.js";

/**
 * Manhattan distance between two points.
 * @param {{x:number,y:number}} a 
 * @param {{x:number,y:number}} b 
 * @returns {number}
 */
export function distance(a, b) {
  const dx = Math.abs(Math.round(a.x) - Math.round(b.x));
  const dy = Math.abs(Math.round(a.y) - Math.round(b.y));
  return dx + dy;
}

/**
 * Euclidean distance between two points.
 * @param {{x:number, y:number}} a 
 * @param {{x:number, y:number}} b 
 * @returns {number}
 */
export function euclidean_distance(a, b) {
  const dx = Math.pow(a.x - b.x, 2);
  const dy = Math.pow(a.y - b.y, 2);
  return Math.sqrt(dx + dy);
}

/**
 * @param {{x : number, y : number, direction : string}} a
 * @param {{x : number, y : number}} p
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