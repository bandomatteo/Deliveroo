import { DIRECTIONS } from "../utils/directions.js";
import { OpponentAgent } from "./opponentAgent.js";
import { distance } from "../utils/geometry.js";
import { Me } from "./me.js";

/**
 * Manages the agents
 */
export class AgentStore {
    constructor() {
        /**
         * @type { Map< string, OpponentAgent > }
         */
        this.map = new Map();

        this.agentObsDistance = 5;  // TODO get this from settings if possible
    }
    

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

    removeAgent(a) {
        this.map.delete(a.id);
    }

    updateAgent(a, timestamp) {
        let agent = this.map.get(a.id);

        agent.timestamp = timestamp;
        agent.direction = this.findDirection(agent, a);

        agent.x = a.x;
        agent.y = a.y;
    }

    findDirection(old, curr) {
        if ( old.x < curr.x ) return DIRECTIONS.RIGHT;
        else if ( old.x > curr.x ) return DIRECTIONS.LEFT;
        else if ( old.y < curr.y ) return DIRECTIONS.UP;
        else if ( old.y > curr.y ) return DIRECTIONS.DOWN;
        else return DIRECTIONS.NONE;
    }

    /**
     * @param {Me} me 
     * @returns {Array < OpponentAgent >}
     */
    visible(me) {
        return Array
            .from(this.map.values())
            .filter(agent => {return distance(agent, me) < this.agentObsDistance});
    }
}
  