
/**
 * Model of the player.
 * 
 * @property {string} id - Player ID
 * @property {string} name - Player name
 * @property {number} x - Player X coordinate
 * @property {number} y - Player Y coordinate
 * @property {number} score - Player score
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
   * Update own state from server payload.
   * @param {{id:string, name:string, teamId: string, teamName: string, x:number, y:number, score:number, penalty:number}} payload
   * @param {{ms: number, frame: number}} time
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
  