
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