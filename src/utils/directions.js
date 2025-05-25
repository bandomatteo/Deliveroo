export const DIRECTIONS = {
    NONE:  null,
    UP: "up",
    DOWN: "down",
    LEFT : "left",
    RIGHT : "right"
};

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