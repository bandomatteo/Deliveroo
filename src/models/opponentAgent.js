import { DIRECTIONS } from "../utils/directions.js";

/**
 * OpponentAgent class to represent an opponent agent in the game
 * @class 
 * @description
 * This class is used to represent an opponent agent in the game.
 * It contains properties such as id, name, teamId, teamName, x, y, score, timestamp, and direction.
 * It is typically used to store information about the agents that are not controlled by the player.
 * * @param {Object} agent - The agent object containing id, name, teamId, teamName, x, y, score
 * @param {number} timestamp - The timestamp of the agent's state
 * @property {string} id - The unique identifier of the agent.
 * @property {string} name - The name of the agent.
 * @property {string} teamId - The ID of the team the agent belongs to.
 * @property {string} teamName - The name of the team the agent belongs to.
 * @property {number} x - The x-coordinate of the agent's position.
 * @property {number} y - The y-coordinate of the agent's position.
 * @property {number} score - The current score of the agent.
 * @property {number} timestamp - The timestamp in milliseconds when the agent's state was last updated.
 * @property {string} direction - The direction the agent is facing (UP, DOWN, LEFT, RIGHT, NONE).
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