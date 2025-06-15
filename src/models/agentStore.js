import { DIRECTIONS } from "../utils/directions.js";
import { OpponentAgent } from "./opponentAgent.js";
import { distance } from "../utils/geometry.js";
import { Me } from "./me.js";
import { ServerConfig } from "./serverConfig.js";

/**
 * AgentStore class to store agents in the game
 * @class AgentStore
 * @description
 * This class is responsible for managing the agents in the game.
 * It allows adding, removing, and updating agents, as well as finding visible agents based on the player's position and the game configuration.
 * It uses a Map to store agents, where the key is the agent's ID and the value is an instance of OpponentAgent.
 */
export class AgentStore {
    constructor() {
        this.map = new Map();
    }
    
    /**
     * Add agent to AgentStore
     * @param {*} a - Agent object containing id, x, y, teamName, etc.
     * @param {number} timestamp - Timestamp of the agent's state
     * @description
     * This method adds an agent to the AgentStore. If the agent is already present, it updates its state.
     * If the agent is new, it creates a new OpponentAgent instance and adds it to the map.
     */
    addAgent(a, timestamp) {
        // First time -> creation
        if (!this.map.has(a.id)) {
            let agent = new OpponentAgent(a, timestamp);
            this.map.set(agent.id, agent);
        }
        // Update agent
        else {
            this.updateAgent(a, timestamp);
        }
    }

 
    /**
     * Remove agent from AgentStore
     * @param {*} a - Agent object containing id
     * @description
     * This method removes an agent from the AgentStore based on its ID.
     */
    removeAgent(a) {
        this.map.delete(a.id);
    }

    /**
     * Update agent in AgentStore
     * @param {*} a - Agent object containing id, x, y, etc.
     * @param {number} timestamp - Timestamp of the agent's state
     * @description
     * This method updates the state of an existing agent in the AgentStore.
     * It updates the agent's position, direction, and timestamp.
     */
    updateAgent(a, timestamp) {
        let agent = this.map.get(a.id);

        agent.timestamp = timestamp;
        agent.direction = this.findDirection(agent, a);

        agent.x = a.x;
        agent.y = a.y;
    }

    /**
     * Find the direction of movement from old position to current position
     * @param {OpponentAgent} old - The previous state of the agent
     * @param {OpponentAgent} curr - The current state of the agent
     * @returns {string} - The direction of movement (UP, DOWN, LEFT, RIGHT, NONE)
     * @description
     * This method determines the direction in which an agent has moved based on its previous and current positions.
     */
    findDirection(old, curr) {
        if ( old.x < curr.x ) return DIRECTIONS.RIGHT;
        else if ( old.x > curr.x ) return DIRECTIONS.LEFT;
        else if ( old.y < curr.y ) return DIRECTIONS.UP;
        else if ( old.y > curr.y ) return DIRECTIONS.DOWN;
        else return DIRECTIONS.NONE;
    }

    /**
     * Get all agents in the store
     * @param {Me} me - The current player's agent
     * @param {ServerConfig} config - The server configuration containing game settings
     * @returns {Array} - Array of all agents in the store
     * @description
     * This method returns an array of all agents currently stored in the AgentStore.
     */
    visible(me, config) {
        return Array
            .from(this.map.values())
            .filter(agent => agent.teamName !== me.teamName)
            .filter(agent => {return distance(agent, me) < config.agents_obs_distance});
    }
}
  