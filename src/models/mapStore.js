import { euclidean_distance } from "../utils/geometry.js";
import { coord2Key } from "../utils/hashMap.js";
import { key2Coord } from "../utils/hashMap.js";
import { TILE_TYPES } from "../utils/tile.js";
import { ServerConfig } from "./serverConfig.js";
import { Me } from "./me.js";
import config from '../utils/gameConfig.js';

/**
 * MapStore class to store the game map and its tiles
 * @class 
 * @description
 * This class is responsible for managing the game map, including adding tiles, calculating distances,
 * and handling spawn tiles. It provides methods to add tiles, set their types, calculate distances,
 * find nearest bases, and perform k-means clustering for spawn tile assignment.
 * It also includes methods to reset k-means assignments and calculate the sparseness of spawn tiles.
 * It uses a Map to store tiles and their types, a Set to store bases, and a Map to store spawn tiles.
 * It also maintains a distance matrix for efficient distance calculations between tiles.
 * @property {Map<string, number>} map - A map where keys are tile coordinates (as strings) and values are tile types.
 * @property {Set<string>} bases - A set of base tile coordinates.
 * @property {Map<string, {coord: string, assignedTo: string, available: boolean}>} spawnTiles - A map of spawn tiles with their coordinates, assigned agent, and availability status.
 * @property {number} mapSize - The size of the map.
 * @property {Array<Array<number>>} distMat - The distance matrix for all valid tiles in the map.
 * @property {Map<string, number>} indexOf - A map to quickly access the index of a tile based on its coordinates.
 * @property {boolean} isSpawnSparse - A flag indicating whether spawn tiles are sparse based on the server configuration.
 * @throws {Error} If the map size is null when calculating distances.
 */
export class MapStore {

    constructor() {
        this.map = new Map();
        this.bases = new Set();
        this.spawnTiles = new Map();
        this.mapSize = null;
        this.distMat = null;   // Will be the distance matrix
        this.indexOf = null;
        this.isSpawnSparse = false; // Check is spawn tiles are sparse
    }

    /**
     * Adds a tile to the map and updates spawn tiles and bases accordingly.
     * @param {Object} tile - The tile object containing coordinates and type.
     * @description
     * This method adds a tile to the map, updates the spawn tiles if the tile is a spawn tile,
     * and adds the tile to the bases set if it is a base tile.
     */
    addTile(tile) {
        const key = coord2Key(tile)   // Converted to string because js handles object by reference

        this.map.set(key, tile.type);

        if (tile.type === TILE_TYPES.SPAWN) {
            this.spawnTiles.set(key, { coord: key, assignedTo: null, available: true });
        }
        else if (tile.type === TILE_TYPES.BASE) {
            this.bases.add(key);
        }
    }

    /**
     * Sets the size of the map.
     * @param {number} size - The size of the map.
     * @description
     * This method sets the size of the map, which is used for distance calculations.
     */
    set size(size) {
        this.mapSize = size
    }

    /**
     * Sets the type of a tile and updates spawn tiles and bases accordingly.
     * @param {Object} tile - The tile object containing coordinates.
     * @param {number} type - The type of the tile to set.
     * @returns {number} - The old type of the tile before the update.
     * @description
     * This method updates the type of a tile in the map. If the old type was SPAWN, it marks the spawn tile as unavailable.
     * If the old type was BASE, it removes the base from the set. It then sets the new type and updates spawn tiles and bases accordingly.
     */
    setType(tile, type) {
        let key = coord2Key(tile);
        let oldType = this.map.get(key);

        if (oldType === TILE_TYPES.SPAWN) {
            this.spawnTiles.get(key).available = false;
        }
        else if (oldType === TILE_TYPES.BASE) {
            this.bases.delete(key);
        }

        this.map.set(key, type);

        if (type === TILE_TYPES.SPAWN) {
            this.spawnTiles.get(key).available = true;
        }
        else if (type === TILE_TYPES.BASE) {
            this.bases.add(key);
        }


        return oldType;
    }


    /**
     * Finds a random spawn tile that is available and assigned to the given agent or unassigned.
     * @description
     * This method filters the spawn tiles to find those that are available and either assigned to the given agent or unassigned.
     * It then selects a random tile from the filtered list and returns its coordinates.
     * @param {Me} me - The agent for whom the spawn tile is being searched.
     * @returns { {x : number, y : number} } - The coordinates of the randomly selected spawn tile.
     * @description
     * This method filters the spawn tiles to find those that are available and either assigned to the given agent or unassigned.
     * It then selects a random tile from the filtered list and returns its coordinates.
     */
    randomSpawnTile(me) {
        let tileArr = Array
            .from(this.spawnTiles.values())
            .filter(t => isFinite(this.distance(me, key2Coord(t.coord))))
            .filter(t => t.available)
            .filter(t => t.assignedTo === me.id || t.assignedTo === null);

        let tile = tileArr[Math.floor(Math.random() * tileArr.length)];
        return key2Coord(tile.coord);
    }

    /**
     * Calculates distances between all tiles in the map using the Floyd-Warshall algorithm.
     * @description
     * This method computes the distance matrix for all valid tiles in the map. It first collects all valid (non-hole) positions,
     * initializes the distance matrix, and then applies the Floyd-Warshall algorithm to compute the shortest distances between all pairs of tiles.
     * @throws {Error} If the map size is null.
     * @returns {void}
     * @description
     * This method computes the distance matrix for all valid tiles in the map. It first collects all valid (non-hole) positions,
     * initializes the distance matrix, and then applies the Floyd-Warshall algorithm to compute the shortest distances between all pairs of tiles.
     */
    calculateDistances() {
        if (this.mapSize === null) {
            throw new Error("Map size is null");
        }

        // 1. Collect all valid (non-hole) positions
        const cells = [];
        this.indexOf = new Map();
        for (let x = 0; x < this.mapSize; x++) {
            for (let y = 0; y < this.mapSize; y++) {
                const key = coord2Key({ x, y });

                if (this.map.get(key) !== TILE_TYPES.EMPTY) {
                    const idx = cells.length;
                    cells.push({ x, y });
                    this.indexOf.set(key, idx);
                }
            }
        }
        const N = cells.length;

        // 2. Initialize the distance matrix

        // Build & initialize dist[][] as a plain 2D array
        this.distMat = Array.from({ length: N }, () => new Array(N).fill(Infinity));
        for (let i = 0; i < N; i++) {
            this.distMat[i][i] = 0;
            const { x, y } = cells[i];

            // only 4 neighbors on a grid
            for (const { dx, dy } of [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]) {
                const nx = x + dx, ny = y + dy;
                const nKey = coord2Key({ x: nx, y: ny });

                if (this.indexOf.has(nKey)) {
                    const j = this.indexOf.get(nKey);
                    this.distMat[i][j] = 1;
                }
            }
        }

        // 3. Run Floyd-Warshall with row-caching and early skips
        for (let k = 0; k < N; k++) {
            const rowK = this.distMat[k];

            for (let i = 0; i < N; i++) {
                const rowI = this.distMat[i];
                const dik = rowI[k];

                if (dik === Infinity) continue;      // nothing to gain through k from i

                for (let j = 0; j < N; j++) {
                    const via = dik + rowK[j];

                    if (via < rowI[j]) {
                        rowI[j] = via;
                    }
                }
            }
        }
    }

    /**
     * Calculates the distance between two coordinates using the precomputed distance matrix.
     * @param {{x : number, y : number}} from - The starting coordinates.
     * @param {{x : number, y : number}} to - The destination coordinates.
     * @returns {number} - The distance between the two coordinates.
     * @description
     * This method retrieves the indices of the given coordinates from the indexOf map and uses them to access the distance matrix.
     * If either coordinate is not found in the indexOf map, it returns Infinity.
     */
    distance(from, to) {
        const fromKey = coord2Key(from);
        const toKey = coord2Key(to);

        const fromIdx = this.indexOf.get(fromKey);
        const toIdx = this.indexOf.get(toKey);

        if (fromIdx === undefined || toIdx === undefined) {
            return Infinity;
        }

        return this.distMat[fromIdx][toIdx];
    }

    /**
     * Finds the nearest base from a given coordinate.
     * @param {{x : number, y : number}} from - The starting coordinates.
     * @returns {Array} - An array containing the coordinates of the nearest base and the distance to it.
     * @description
     * This method iterates through all bases in the map, calculates the distance from the given coordinates to each base,
     * and returns the coordinates of the nearest base along with the minimum distance found.
     */
    nearestBase(from) {
        let base;
        let minDist = Infinity;

        for (const key of this.bases) {
            let coords = key2Coord(key);

            let distance = this.distance(from, coords);

            if (distance <= minDist) {
                minDist = distance;
                base = coords;
            }
        }

        return [base, minDist];
    }

    /**
     * Calculates the sparseness of spawn tiles based on the server configuration.
     * @param {ServerConfig} serverConfig - The server configuration containing the maximum number of parcels.
     * @description
     * This method calculates the ratio of spawn tiles to the total number of cells in the map that are not empty.
     * It also calculates the ratio of spawn tiles to the maximum number of parcels allowed in the server configuration.
     * If both ratios are below the defined thresholds in the config, it sets isSpawnSparse to true.
     * @returns {void}
     * @description
     * This method calculates the ratio of spawn tiles to the total number of cells in the map that are not empty.
     * It also calculates the ratio of spawn tiles to the maximum number of parcels allowed in the server configuration.
     * If both ratios are below the defined thresholds in the config, it sets isSpawnSparse to true.
     */
    calculateSparseness(serverConfig) {
        const numCells = Array.from(this.map.values())
            .filter(type => type > TILE_TYPES.EMPTY)
            .length;
        const greenCellRatio = this.spawnTiles.size / numCells;
        const spawnRatio = this.spawnTiles.size / serverConfig.parcels_max;  // Vogliamo un ratio < 3 (Es. 10 parcels su 30 spawn tiles)

        this.isSpawnSparse = greenCellRatio < config.MAX_GREEN_CELL_RATIO && spawnRatio < config.MAX_SPAWN_RATIO;
    }


    /**
     * Performs k-means clustering on spawn tiles to assign them to k prototypes.
     * @param {number} k - The number of clusters (prototypes).
     * @param {Array<string>} ids - The IDs of the agents to assign the spawn tiles to.
     * @param {number} max_iterations - The maximum number of iterations for the k-means algorithm.
     * @param {number} stab_error - The threshold for stability of prototypes.
     * @throws {Error} If the length of ids is not equal to k.
     * @description
     * This method initializes k prototypes with random values, associates each spawn tile to the nearest prototype using Euclidean distance,
     * and updates the prototypes to the means of the associated tiles. It continues iterating until the prototypes are stable or the maximum number of iterations is reached.
    */
    kMeans(k, ids, max_iterations, stab_error) {
        if (ids.length !== k) {
            throw new Error(`Array length must be ${k}, but got ${ids.length}`)
        }

        // Create k prototypes with random values


        // @type {Array < {x: number, y: number} > }

        let prototypes = new Array(k);
        for (let i = 0; i < k; i++)
            prototypes[i] = { x: Math.random() * this.mapSize, y: Math.random() * this.mapSize };

        // Array for calculating means

        // @type {Array < {x: number, y: number} > }

        let sums = new Array(k);

        let counts = new Array(k);

        let old_prototypes = [];
        let bound_reached = false;

        // Loop until prototypes are stable
        for (let iteration_count = 0; !bound_reached && iteration_count < max_iterations; iteration_count++) {

            old_prototypes = structuredClone(prototypes);

            // Resetting sums and counts
            for (let i = 0; i < k; i++)
                sums[i] = { x: 0, y: 0 };
            counts.fill(0);

            // Associate each tile to nearest prototype (with Euclidian distance)
            for (let tile of this.spawnTiles.values()) {
                let coords = key2Coord(tile.coord);

                let min_distance = Infinity;
                let assigned_prototype_index = -1;

                for (let p = 0; p < k; p++) {
                    const prot = prototypes[p];

                    const distance = euclidean_distance(coords, prot);

                    if (distance < min_distance) {
                        min_distance = distance;
                        assigned_prototype_index = p;
                    }
                }

                tile.assignedTo = ids[assigned_prototype_index];

                sums[assigned_prototype_index].x += coords.x;
                sums[assigned_prototype_index].y += coords.y;
                counts[assigned_prototype_index]++;
            }


            // Update values of the prototypes to the means of the associated pixels
            for (let i = 0; i < k; i++) {
                if (counts[i] !== 0) {
                    prototypes[i].x = sums[i].x / counts[i];
                    prototypes[i].y = sums[i].y / counts[i];
                }
            }

            // Calculate differences
            bound_reached = true;

            for (let i = 0; i < k; i++) {
                const prot = prototypes[i];
                const old_prot = old_prototypes[i];

                const distance = euclidean_distance(prot, old_prot);

                if (distance > stab_error) {
                    bound_reached = false;
                    break;
                }
            }
        }
    }


    /**
     * Resets the k-means assignments for all spawn tiles.
     * @description
     * This method iterates through all spawn tiles and sets their assignedTo property to null,
     * effectively resetting the k-means clustering assignments.
     * @returns {void}
     */
    resetKmeans() {
        for (let tile of this.spawnTiles.values()) {
            tile.assignedTo = null;
        }
    }


    /**
     * Prints all distances between tiles in the map.
     * @description
     * This method iterates through all pairs of coordinates in the map and logs the distance between them.
     * It is useful for debugging and understanding the distance relationships in the map.
     * @returns {void}
     */
    printAllDistances() {
        for (let i = 0; i < this.mapSize; i++) {
            for (let j = 0; j < this.mapSize; j++) {
                console.log(i, ", ", j);

                for (let k = 0; k < this.mapSize; k++) {
                    for (let h = 0; h < this.mapSize; h++) {
                        console.log("\t", k, ", ", h, " -> ", this.distance({ x: i, y: j }, { x: k, y: h }));
                    }
                }
            }
        }
    }

}
