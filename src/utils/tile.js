export const TILE_TYPES = {
    EMPTY : 0,
    SPAWN : 1,
    BASE : 2,
    WALKABLE : 3,
};

export function isWalkableTile(tile) {
  return tile >= TILE_TYPES.SPAWN && tile <= TILE_TYPES.WALKABLE;
}