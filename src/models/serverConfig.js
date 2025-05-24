/**
 * Manages the server configuration
 */
export class ServerConfig {
    constructor() {
        this.parcels_max = 0;
        this.parcel_reward_avg = 0;
        this.parcels_decaying_interval = 0;  // In seconds
        this.clock = 100;
        this.agents_obs_distance = 0;
        this.parcels_obs_distance = 0;
    }
    

    updateConfig(config) {
        this.parcels_max = config.PARCELS_MAX;
        this.parcel_reward_avg = config.PARCEL_REWARD_AVG;
        this.parcels_decaying_interval = parseInt(config.PARCEL_DECADING_INTERVAL);
        this.clock = config.CLOCK;
        this.agents_obs_distance = config.AGENTS_OBSERVATION_DISTANCE;
        this.parcels_obs_distance = config.PARCELS_OBSERVATION_DISTANCE;
    }
}
  