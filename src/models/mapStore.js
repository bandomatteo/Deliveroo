import { euclidean_distance } from "../utils/geometry.js";
import { coord2Key } from "../utils/hashMap.js";
import { key2Coord } from "../utils/hashMap.js";
import { TILE_TYPES } from "../utils/tile.js";
import { ServerConfig } from "./serverConfig.js";

/**
 * Manages the whole map (bases, distance between cells)
 */
export class MapStore {
    constructor() {
        /**
         * @type { Map< string, number > }
         */
        this.map = new Map();

        /**
         * @type { Set< string > }
         */
        this.bases = new Set();

        /**
         * @type { Map< string, {coord: string, assignedTo: string } >}
         */
        this.spawnTiles = new Map();

        this.mapSize = null;

        this.distMat = null;   // Will be the distance matrix
        this.indexOf = null;

        this.isSpawnSparse = false; // Check is spawn tiles are sparse
    }
  
    /**
     * Adds a tile to the map and saves bases
     * @param { {x : number, y : number, type : number} } tile
     */
    addTile (tile) {
        const key = coord2Key(tile)   // Converted to string because js handles object by reference

        this.map.set(key, tile.type);
        
        if (tile.type === TILE_TYPES.SPAWN) {
            this.spawnTiles.set(key, {coord: key, assignedTo: null});
        }
        else if (tile.type === TILE_TYPES.BASE) {
            this.bases.add(key);
        }
    }

    /**
     * Saves map size (square)
     */
    set size(size) {
        this.mapSize = size
    }

    setType(tile, type) {
        let key = coord2Key(tile);
        let oldType = this.map.get(key);
        this.map.set(key, type);
        return oldType;
    }

    /**
     * @param {string} agentId
     * @returns {{x : number, y : number}}
     */
    randomSpawnTile(agentId) {
        let tileArr = Array
                    .from(this.spawnTiles.values())
                    .filter(t => t.assignedTo === agentId || t.assignedTo === null);
        
        let tile = tileArr[Math.floor(Math.random() * tileArr.length)];
        return key2Coord(tile.coord);
    }

    /**
     * Calculates distances between each cell using Floyd-Warshall
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
                const key = coord2Key({x,y});

                if (this.map.get(key) !== TILE_TYPES.EMPTY) {
                    const idx = cells.length;
                    cells.push({x,y});
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
            for (const { dx, dy } of [ {dx:1,dy:0}, {dx:-1,dy:0}, {dx:0,dy:1}, {dx:0,dy:-1} ]) {
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
     * Get distance between 2 tiles
     * @param { {x : number, y : number} } from
     * @param { {x : number, y : number} } to
     * @returns {number}
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
     * Find nearest base from starting point
     * @param {{x : number, y : number}} from 
     * @return {[{x: number, y: number}, number]} A tuple: [nearest base coordinate, distance]
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
     * @param {ServerConfig} config 
     */
    calculateSparseness(config) {
        const numCells = Array.from(this.map.values())
                            .filter(type => type > TILE_TYPES.EMPTY)
                            .length;
        const greenCellRatio = this.spawnTiles.size / numCells;
        const spawnRatio =  this.spawnTiles.size / config.parcels_max;  // Vogliamo un ratio < 3 (Es. 10 parcels su 30 spawn tiles)
        
        this.isSpawnSparse = greenCellRatio < 0.2 && spawnRatio < 3;
    }


    /**
     * K-means algorithm to assign tiles to agents
     * @param {number} k - number of clusters
     * @param {Array < string >} ids - Array of agent ids of k length
     * @param {number} max_iterations - Maximum number of iterations
     * @param {number} stab_error - Stabilization error
     */
    kMeans(k, ids, max_iterations, stab_error) {
        if (ids.length !== k) {
            throw new Error(`Array length must be ${k}, but got ${ids.length}`)
        }

        // Create k prototypes with random values

        /**
         * @type {Array < {x: number, y: number} > }
         */
        let prototypes = new Array(k);
        for (let i = 0; i < k; i++)
            prototypes[i] = {x : Math.random() * this.mapSize, y : Math.random() * this.mapSize};

        // Array for calculating means
        /**
         * @type {Array < {x: number, y: number} > }
         */
        let sums = new Array(k);

        let counts = new Array(k);

        let old_prototypes = [];
        let bound_reached = false;

        // Loop until prototypes are stable
        for (let iteration_count = 0; !bound_reached && iteration_count < max_iterations; iteration_count++) {
            
            old_prototypes = structuredClone(prototypes);

            // Resetting sums and counts
            for (let i = 0; i < k; i++)
                sums[i] = {x: 0, y: 0};
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


    resetKmeans() {
        for (let tile of this.spawnTiles.values()) {
            tile.assignedTo = null;
        }
    }


    /**
     * Just for debug
     */
    printAllDistances() {
        for (let i = 0; i < this.mapSize; i++) {
            for (let j = 0; j < this.mapSize; j++) {
                console.log(i, ", ", j);

                for (let k = 0; k < this.mapSize; k++) {
                    for (let h = 0; h < this.mapSize; h++) {
                        console.log("\t", k, ", ", h, " -> ", this.distance({x : i, y : j}, {x : k, y : h}));
                    }
                }
            }
        }
    }
    
  }
  