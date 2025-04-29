/**
 * @param { {x : number, y : number} } coord
 * @returns {string}
 */
export function coord2Key(coord) {
    return `${coord.x},${coord.y}`;
}