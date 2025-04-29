import { coord2Key } from "../utils/hashMap.js";

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

        this.mapSize = null;

        this.distMat = null;   // Will be the distance matrix
        this.indexOf = null;
    }
  
    /**
     * Adds a tile to the map and saves bases
     * @param { {x : number, y : number, type : number} } tile
     */
    addTile (tile) {
        const key = coord2Key({x : tile.x, y : tile.y})   // Converted to string because js handles object by reference

        this.map.set(key, tile.type);
        
        if (tile.type === 2) {
            this.bases.add(coord2Key({x : tile.x, y : tile.y}));
        }

        // console.log(tile.x, ", ", tile.y, " -> ", this.map.get(key));
    }

    /**
     * Saves map size (square)
     */
    set size(size) {
        this.mapSize = size
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

                if (this.map.get(key) !== 0) {
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
  