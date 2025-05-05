/**
 * @param { {x : number, y : number} } coord
 * @returns {string}
 */
export function coord2Key(coord) {
    return `${coord.x},${coord.y}`;
}

/**
 * @param {string} key
 * @returns { {x : number, y : number} }
 */
export function key2Coord(key) {
    let [x, y] = key.split(',').map(Number);
    return { x, y };
}