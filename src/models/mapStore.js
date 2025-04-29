import { areAdjacent } from "../utils/geometry.js";
import { coord2Key } from "../utils/hashMap.js";

/**
 * Manages the whole map (bases, distance between cells)
 */
export class MapStore {
    constructor() {
        /**
         * @type { Map< string, {type : number, distances : Map < string, number > } > }
         */
        this.map = new Map();

        /**
         * @type { Set< string > }
         */
        this.bases = new Set();

        this.mapSize = null;
    }
  
    /**
     * Adds a tile to the map and saves bases
     * @param { {x : number, y : number, type : number} } tile
     */
    addTile (tile) {
        const key = coord2Key({x : tile.x, y : tile.y})   // Converted to string because js handles object by reference

        this.map.set(key, {type : tile.type, distances : new Map()});
        //
        if (tile.type === 2) {
            this.bases.add(coord2Key({x : tile.x, y : tile.y}));
        }

        console.log(tile.x, ", ", tile.y, " -> ", this.map.get(key).type);
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
        let cells = [];
        for (let x = 0; x < this.mapSize; x++) {
            for (let y = 0; y < this.mapSize; y++) {
                if (this.map.get(coord2Key({x : x, y : y})).type !== 0) {
                    cells.push({x, y})
                }
            }
        }

        // 2. Initialize the distance matrix

        // Fill initial distances
        for (const from of cells) {
            for (const to of cells) {
                let dis = Infinity;

                if (from.x === to.x && from.y === to.y) {
                    dis = 0;    // Distance to itself is 0
                }
                else if (areAdjacent(from, to)) {
                    dis = 1;    // Direct neighbor
                }   // Otherwise, initially infinite

                let fromKey = coord2Key({x : from.x, y : from.y});
                let toKey = coord2Key({x : to.x, y : to.y});
                
                this.map.get(fromKey).distances.set(toKey, dis); 
            }
        }

        // 3. Run Floyd-Warshall
        for (const k of cells) {
            let kKey = coord2Key({x : k.x, y : k.y})

            for (const i of cells) {
                let iKey = coord2Key({x : i.x, y : i.y});

                for (const j of cells) {
                    let jKey = coord2Key({x : j.x, y : j.y});

                    if (this.map.get(iKey).distances.get(kKey) + this.map.get(kKey).distances.get(jKey)
                            < this.map.get(iKey).distances.get(jKey)) {
                        
                        this.map.get(iKey).distances.set(jKey,
                            this.map.get(iKey).distances.get(kKey) + this.map.get(kKey).distances.get(jKey)
                        );
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
        let mapFrom = this.map.get(coord2Key(from)).distances;
        
        if (!mapFrom.has(coord2Key(to))) {
            return Infinity;
        }
        
        return this.map.get(coord2Key(from)).distances.get(coord2Key(to));
    }

    /**
     * Just for debug
     */
    printAllDistances() {
        for (const [k, value] of this.map) {
            console.log(k);
        
            for (const [b, dist] of value.distances) {
                console.log("\t", b, " -> ", dist);
            }
        }
    }
    
  }
  