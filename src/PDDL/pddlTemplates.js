import { isWalkableTile, TILE_TYPES } from "../utils/tile.js"; 


/**
 * Sanitizes a raw PDDL name by trimming, converting to lowercase,
 * replacing non-alphanumeric characters with underscores, and removing
 * leading and trailing underscores.
 * @param {string} raw - The raw name to sanitize. 
 * @return {string} - The sanitized PDDL name.
 * @description
 * This function is useful for ensuring that names used in PDDL (Planning Domain Definition Language)
 * are valid and follow the naming conventions required by PDDL, such as using lowercase letters,
 * numbers, and underscores, while avoiding spaces and special characters. 
 * @example
 * sanitizePddlName("  My Name!  "); // returns "my_name"
 * sanitizePddlName("Invalid@Name#123"); // returns "invalid_name_123"
 * sanitizePddlName("  __Extra__Underscores__  "); // returns "extra_underscores"
 * sanitizePddlName("1234"); // returns "1234"
 * sanitizePddlName("!@#$%^&*()"); // returns ""
 */
export function sanitizePddlName(raw) {
  return raw
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Returns a static PDDL domain definition (deliveroo-domain.pddl).
 */
export function generateDeliverooDomain() {
  return `
(define (domain deliveroo)
  (:requirements :strips :typing)
  (:types 
    agent
    parcel
    tile
    base
  )

  (:predicates
    ;; agent ?a is on tile ?t
    (at ?a - agent ?t - tile)

    ;; parcel ?p is on tile ?t (not yet picked up)
    (parcel-at ?p - parcel ?t - tile)

    ;; agent ?a is carrying parcel ?p
    (carrying ?a - agent ?p - parcel)

    ;; base ?b is located on tile ?t
    (base-at ?b - base ?t - tile)

    ;; parcel ?p has been delivered 
    (delivered ?p - parcel)

    ;; adjacency relation between tiles
    (adjacent ?t1 - tile ?t2 - tile)
  )

  ;; =====================================================
  ;; 1) move: move an agent from one tile to an adjacent tile
  (:action move
    :parameters (?a - agent ?from - tile ?to - tile)
    :precondition (and 
      (at ?a ?from)
      (adjacent ?from ?to)
    )
    :effect (and
      (not (at ?a ?from))
      (at ?a ?to)
    )
  )

  ;; =====================================================
  ;; 2) pickup: agent picks up a parcel on its tile
  (:action pickup
    :parameters (?a - agent ?p - parcel ?t - tile)
    :precondition (and
      (at ?a ?t)
      (parcel-at ?p ?t)
    )
    :effect (and
      (not (parcel-at ?p ?t))
      (carrying ?a ?p)
    )
  )

  ;; =====================================================
  ;; 3) deposit: agent deposits a carried parcel at a base tile
  (:action deposit
    :parameters (?a - agent ?p - parcel ?b - base ?t - tile)
    :precondition (and
      (at ?a ?t)
      (base-at ?b ?t)
      (carrying ?a ?p)
    )
    :effect (and
      (not (carrying ?a ?p))
      (delivered ?p)
    )
  )
)
`.trim();
}

/**
 * Predicates that I have in the domain-file:
 * - (at ?a - agent ?t - tile)
 *  -(parcel-at ?p - parcel ?t - tile)
 * - (carrying ?a - agent ?p - parcel)
 * - (base-at ?b - base ?t - tile)
 * - (delivered ?p - parcel)
 * -(adjacent ?t1 - tile ?t2 - tile)
 * 
 * So I need to use these predicates to build the problem
 * 
 * The PDDL problem definition has the following structure:
 * define (problem PROBLEM_NAME)
  (:domain DOMAIN_NAME)
  (:objects OBJ1 OBJ2 ... OBJ_N)
  (:init ATOM1 ATOM2 ... ATOM_N)
  (:goal CONDITION_FORMULA)
  )
 */
export function generateDeliverooProblem(mapStore, parcelsStore, me, serverConfig) {
  
  // Helper functions to create names for tiles, bases, and parcels
  function tileNameFromCoordinates(coordinates) {
    const [x, y] = coordinates.split(","); // coordinates torna tipo "3,5" or "7,2"
    return sanitizePddlName(`t_${x}_${y}`);
  }
  // Helper function to create base names from coordinates
  // e.g. "3,5" --> "base_3_5"
  function baseNameFromCoordinates(coordinates) {
    const [x, y] = coordinates.split(",");
    return sanitizePddlName(`base_${x}_${y}`);
  }
  // Helper function to create parcel names
  // e.g. {id: "p1", x: 3, y: 5} --> "p1"
  function parcelName(p) {
    return sanitizePddlName(`${p.id}`);
  }

   // get all walkable tiles (type != EMPTY)
  const walkableTiles = [];
  // mapStore.map.entries() returns an iterator of [key, value] pairs where coordinates is a string like "3,5" and value is a TILE_TYPE

  for (const [coordinates, tileType] of mapStore.map.entries()) {
    
    //console.log(`Tile at ${coordinates} is of type ${tileType}`);
    
    //tileType !== TILE_TYPES.EMPTY
    if (isWalkableTile(tileType)) {
      const [x, y] = coordinates.split(",").map(Number);
      //console.log(`Adding walkable tile: ${coordKey} (${xs}, ${ys})`);
      walkableTiles.push({ coordinates: coordinates, x: x, y: y });
    }
  }

  //get  adjacency facts for every walkable tile 
  const adjacencyFacts = [];
  const directions = [
    { dx: +1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: +1 },
    { dx: 0, dy: -1 },
  ];
  function isWalkable(x, y) {
    const k = `${x},${y}`;
    return mapStore.map.has(k) && mapStore.map.get(k) !== TILE_TYPES.EMPTY;
  }
  // Loop through all walkable tiles and check adjacent ones
  for (const tile of walkableTiles) {
    const fromName = tileNameFromCoordinates(tile.coordinates);
    for (const { dx, dy } of directions) {
      const nx = tile.x + dx,
        ny = tile.y + dy,
        nKey = `${nx},${ny}`;
      if (isWalkable(nx, ny)) {
        const toName = tileNameFromCoordinates(nKey);
        adjacencyFacts.push(`(adjacent ${fromName} ${toName})`);
      }
    }
  }

  // declare base objects + “(base-at …)” facts
  const baseCoords = Array.from(mapStore.bases); // e.g. ["3,5", "7,2", …]
  const baseObjects = baseCoords.map((ck) => baseNameFromCoordinates(ck));
  const baseAtFacts = baseCoords.map((ck) => {
    const tileAtom = tileNameFromCoordinates(ck);
    const baseAtom = baseNameFromCoordinates(ck);
    return `(base-at ${baseAtom} ${tileAtom})`;
  });

  // declare parcel objects + “(parcel-at …)” facts (only not‐carried) ──
  const parcelEntries = Array.from(parcelsStore.map.values()); // e.g. [{id: "p1", x: 3, y: 5, carriedBy: null}, {id: "p2", x: 7, y: 2, carriedBy: "agent_42"}, …]
  const parcelObjects = [];
  const parcelAtFacts = [];
  for (const p of parcelEntries) {
    if (!p.carriedBy) {
      const parcelPDDL = parcelName(p); // for PPDL
      parcelObjects.push(parcelPDDL);
      const tilePDDL = sanitizePddlName(`t_${p.x}_${p.y}`); //For PPDL e.g. "t_3_5"
      parcelAtFacts.push(`(parcel-at ${parcelPDDL} ${tilePDDL})`); // e.g. "(parcel-at p1 t_3_5)"
    }
  }

  // declare the single agent + its “(at …)” fact 
  const agentPDDL = sanitizePddlName(`agent_${me.id}`);
  const agentTile = sanitizePddlName(`t_${Math.round(me.x)}_${Math.round(me.y)}`);
  const atAgentFact = `(at ${agentPDDL} ${agentTile})`;

  //building the “:objects” section 
  const allTileNames = walkableTiles.map((t) => tileNameFromCoordinates(t.coordinates)); 
  const objectsSection = `
  (:objects
    ${agentPDDL}                       - agent
    ${parcelObjects.join(" ")}         - parcel
    ${baseObjects.join(" ")}           - base
    ${allTileNames.join(" ")}          - tile
  )
  `.trim();

  //building the “:init” section 
  const initLines = [
    atAgentFact,
    ...parcelAtFacts,
    ...baseAtFacts,
    ...adjacencyFacts,
  ];
  const initSection = `
  (:init
    ${initLines.join("\n    ")}
  )
  `.trim();

  //building the “:goal” section: deliver every known parcel 
  const deliveredGoals = parcelObjects.map((pid) => `(delivered ${pid})`);
  const goalSection = `
  (:goal (and
    ${deliveredGoals.join("\n    ")}
  ))
  `.trim();

  //combine into a full PDDL problem 
  const problemName = sanitizePddlName(`deliveroo_problem`);
  const pddl = `
(define (problem ${problemName})
  
  (:domain deliveroo)

  ${objectsSection}

  ${initSection}

  ${goalSection}
)
  `.trim();

  return pddl;
}
