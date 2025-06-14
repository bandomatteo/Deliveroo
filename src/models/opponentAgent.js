import { DIRECTIONS } from "../utils/directions.js";

/**
 * OpponentAgent class to represent an opponent agent in the game
 * @class OpponentAgent
 * @description
 * This class is used to represent an opponent agent in the game.
 * It contains properties such as id, name, teamId, teamName, x, y, score, timestamp, and direction.
 * It is typically used to store information about the agents that are not controlled by the player.
 */
export class OpponentAgent {
    
    constructor(agent, timestamp) {
        this.id = agent.id;
        this.name = agent.name;
        this.teamId = agent.teamId;
        this.teamName = agent.teamName;
        this.x = agent.x;
        this.y = agent.y,
        this.score = agent.score,
        this.timestamp = timestamp,
        this.direction = DIRECTIONS.NONE;
    }
}