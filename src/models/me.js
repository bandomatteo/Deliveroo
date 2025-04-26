
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
      this.name = null;
      this.x = null;
      this.y = null;
      this.score = null;
    }
  
    /**
     * Update own state from server payload.
     * @param {{id:string,name:string,x:number,y:number,score:number}} payload
     */
    update(payload) {
      this.id    = payload.id;
      this.name  = payload.name;
      this.x     = payload.x;
      this.y     = payload.y;
      this.score = payload.score;
    }
  }
  