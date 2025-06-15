/**
 * @module tile
 * @description
 * This module defines constants representing different types of tiles in a grid-based game.
 * The tile types include EMPTY, SPAWN, BASE, and WALKABLE.
 * Each tile type is represented by a unique integer value.
 * These constants are used to identify the nature of each tile in the game world,
 * allowing for efficient game logic and rendering.
 */
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
 * @description
 * This function checks if the given tile type is within the range of walkable tiles.
 * It returns true for SPAWN, BASE, and WALKABLE tiles, and false for EMPTY tiles.
 */
export function isWalkableTile(tile) {
  return tile >= TILE_TYPES.SPAWN && tile <= TILE_TYPES.WALKABLE;
}