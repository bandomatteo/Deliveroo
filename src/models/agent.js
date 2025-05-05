import { DIRECTIONS } from "../utils/directions.js";

export class Agent {
    /**
     * @param {{id : string, name : string, teamId : string, teamName : string, x : number, y : number, score : number}} agent
     */
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