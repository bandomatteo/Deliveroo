
/**
 * ServerConfig class to manage server configuration settings.
 * @class ServerConfig
 * @description
 * This class is used to manage the server configuration settings for the game.
 * It includes properties such as parcels_max, parcel_reward_avg, parcels_decaying_interval, clock,
 * agents_obs_distance, and parcels_obs_distance.
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
    
    /**
     * Update the server configuration with new settings.
     * @param {Object} config - The configuration object containing new settings.
     * @description
     * This method updates the server configuration properties based on the provided config object.
     * It sets the maximum number of parcels, average parcel reward, decaying interval for parcels,
     * clock time, and observation distances for agents and parcels.
     */
    updateConfig(config) {
        this.parcels_max = config.PARCELS_MAX;
        this.parcel_reward_avg = config.PARCEL_REWARD_AVG;
        this.parcels_decaying_interval = parseInt(config.PARCEL_DECADING_INTERVAL);
        this.clock = config.CLOCK;
        this.agents_obs_distance = config.AGENTS_OBSERVATION_DISTANCE;
        this.parcels_obs_distance = config.PARCELS_OBSERVATION_DISTANCE;
    }
}
  