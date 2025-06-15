
/**
 * Represents the local player in the game.
 * @class 
 * @description
 * This class holds the state of the local player, including their ID, team information, position, score, and penalty.
 * It provides a method to update the player's state based on server payload and time.
 */
export class Me {
  constructor() {
    this.id = null;
    this.teamId = null;
    this.teamName = null;
    this.name = null;
    this.x = null;
    this.y = null;
    this.score = null;
    this.penalty = null;

    this.ms = null;
    this.frame = null;
  }

  /**
   * Updates the player's state based on the provided payload and time.
   * @param {Object} payload - The data received from the server containing player information.
   * @param {Object} time - An object containing the current time in milliseconds and frame number.
   * @description
   * This method updates the player's ID, name, team information, position, score, and penalty,
   * as well as the timestamp and frame number for the current state.
   */
  update(payload, time) {
    this.id    = payload.id;
    this.name  = payload.name;
    this.teamId = payload.teamId;
    this.teamName = payload.teamName;
    this.x     = payload.x;
    this.y     = payload.y;
    this.score = payload.score;
    this.penalty = payload.penalty;

    this.ms = time.ms;
    this.frame = time.frame;
  }
}
  