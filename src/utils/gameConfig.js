// Sparsity
const MAX_GREEN_CELL_RATIO = 0.2;
const MAX_SPAWN_RATIO = 3;

// K-means
const MAX_TRIES_KMEANS = 5;
const MAX_ITERATIONS_KMEANS = 10;
const ERROR_KMEANS = 0.1;
const USE_MAP_DIVISION = true;

// Parcels
const PARCEL_SURVIVAL_LAMBDA = 0.069;

// Agent
const CAMP_TIME = 3; // camp time in Seconds
const AGENT_TIME = 0;  // camp time for agent collision in Seconds
const GO_AWAY_MOVES = 3;

// Second best base
const BASE_TRIES = 10;   // Number of tries to pick the same base (should be 20 per second)
const BASE_SWITCH_MAX_TRIES = 60;   // Should be 20 per second  (one per frame if agent isn't moving)
const BASE_REMOVAL_TIME = 3000;    // Time which the occupied bases get removed from the map, in Milliseconds

// Options Infitity scores (to sort them)
const DEPOSIT_INSTANTLY = Number.MAX_SAFE_INTEGER;
const FREE_MATE = Number.MAX_SAFE_INTEGER - 1;
const EXCHANGE_PARCELS = Number.MAX_SAFE_INTEGER - 2;
const PICKUP_NEAR_PARCEL = Number.MAX_SAFE_INTEGER - 3;


/**
 * @module gameConfig
 * @description
 * This module exports various constants used in the game configuration.
 * These constants include maximum ratios for green cells and spawn points, parameters for K-means clustering,
 * survival lambda for parcels, agent camp time, and various base and agent configurations.
 * These constants are used throughout the game to ensure consistent behavior and performance.
 */
export default 
{
    MAX_GREEN_CELL_RATIO, 
    MAX_SPAWN_RATIO, 
    MAX_TRIES_KMEANS,
    MAX_ITERATIONS_KMEANS,
    ERROR_KMEANS,
    PARCEL_SURVIVAL_LAMBDA,
    CAMP_TIME,
    AGENT_TIME,
    USE_MAP_DIVISION,
    BASE_TRIES,
    BASE_REMOVAL_TIME,
    BASE_SWITCH_MAX_TRIES,
    GO_AWAY_MOVES,
    FREE_MATE,
    EXCHANGE_PARCELS,
    DEPOSIT_INSTANTLY,
    PICKUP_NEAR_PARCEL
}