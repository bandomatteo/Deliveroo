import { DIRECTIONS } from "../utils/directions.js";
import { OpponentAgent } from "./opponentAgent.js";
import { distance } from "../utils/geometry.js";
import { Me } from "./me.js";
import { ServerConfig } from "./serverConfig.js";

/**
 * Manages the agents
 */
export class AgentStore {
    constructor() {
        /**
         * @type { Map< string, OpponentAgent > }
         */
        this.map = new Map();
    }
    

    /**
     * Add agent to AgentStore
     * @param {*} a 
     * @param {number} timestamp 
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
     * @param {*} a 
     */
    removeAgent(a) {
        this.map.delete(a.id);
    }

    /**
     * Update agent values from AgentStore
     * @param {*} a 
     * @param {number} timestamp 
     */
    updateAgent(a, timestamp) {
        let agent = this.map.get(a.id);

        agent.timestamp = timestamp;
        agent.direction = this.findDirection(agent, a);

        agent.x = a.x;
        agent.y = a.y;
    }

    /**
     * Find direction in which the agent is going
     * @param {{x : number, y : number}} old 
     * @param {{x : number, y : number}} curr 
     * @returns direction of the agent
     */
    findDirection(old, curr) {
        if ( old.x < curr.x ) return DIRECTIONS.RIGHT;
        else if ( old.x > curr.x ) return DIRECTIONS.LEFT;
        else if ( old.y < curr.y ) return DIRECTIONS.UP;
        else if ( old.y > curr.y ) return DIRECTIONS.DOWN;
        else return DIRECTIONS.NONE;
    }

    /**
     * @param {Me} me 
     * @param {ServerConfig} config
     * @returns {Array < OpponentAgent >}
     */
    visible(me, config) {
        return Array
            .from(this.map.values())
            .filter(agent => agent.teamName !== me.teamName)
            .filter(agent => {return distance(agent, me) < config.agents_obs_distance});
    }
}
  