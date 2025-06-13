export const TILE_TYPES = {
    EMPTY : 0,
    SPAWN : 1,
    BASE : 2,
    WALKABLE : 3,
};

/** 
 * Checks if a tile is walkable.
 * @param {number} tile - The tile type to check.
 * @returns {boolean} - Returns true if the tile is walkable, false otherwise.
 */
export function isWalkableTile(tile) {
  return tile >= TILE_TYPES.SPAWN && tile <= TILE_TYPES.WALKABLE;
}