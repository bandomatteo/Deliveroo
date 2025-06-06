import { onlineSolver, PddlExecutor } from "@unitn-asa/pddl-client";
import { generateDeliverooDomain, generateDeliverooProblem } from "./utils/pddlTemplates.js";

/**
 * Returns a PddlExecutor configured to handle exactly three action names:
 *    "MOVE"   → calls onMove(targetX, targetY)
 *    "PICKUP" → calls onPickup()
 *    "DEPOSIT"→ calls onDeposit()
 */
function buildExecutor(onMove, onPickup, onDeposit) {
  const executor = new PddlExecutor();

  // 1) Handler for MOVE
  // Signature: executor(agent, fromTile, toTile) <--- like in the PDDL domain
  executor.addAction({
    name: "MOVE",  //we used move in the ppddl domain, but it wants MOVE here :/
    executor: (agent, fromTile, toTile) => {
      // Example values:
      // agent    = "AGENT_0D4EA4"
      // fromTile = "T_4_4"
      // toTile   = "T_5_4"

      // Extract numeric x/y from the destination tile string "T_5_4"
      const [_, sx, sy] = toTile.split("_").map((v) => Number(v));
      // Call the onMove callback with the target coordinates
      return onMove(sx, sy); // must return a Promise
    },
  });

  // 2) Handler for PICKUP
  // Signature: executor(agent, parcel, atTile)
  executor.addAction({
    name: "PICKUP",
    executor: (agent, parcel, atTile) => {
      // Example values:
      // agent  = "AGENT_0D4EA4"
      // parcel = "P13324"
      // atTile = "T_0_6"

      // Simply invoke onPickup
      return onPickup(); // must return a Promise
    },
  });

  // Handler for DEPOSIT
  // Signature: executor(agent, parcel, base, atTile)
  executor.addAction({
    name: "DEPOSIT",
    executor: (agent, parcel, base, atTile) => {
      // Example values:
      // agent  = "AGENT_0D4EA4"
      // parcel = "P13324"
      // base   = "BASE_1_9"
      // atTile = "T_1_9"

      // Simply invoke onDeposit
      return onDeposit(); // must return a Promise
    },
  });

  return executor;
}


export async function getPlan(mapStore, parcelsStore, me, serverConfig) {
  const domainText = generateDeliverooDomain();
  const problemText = generateDeliverooProblem(mapStore,parcelsStore,me,serverConfig);

  const rawPlan = await onlineSolver(domainText, problemText);

  return rawPlan;
}

export async function executePlan(rawPlan, onMove, onPickup, onDeposit) {
  // If rawPlan is not a valid non-empty array, we DONT?t do anything
  if (!Array.isArray(rawPlan) || rawPlan.length === 0) {
    console.warn("executePlan: No actions to exec.");
    return;
  }

  // Build the PddlExecutor with the three handlers
  const pddlExecutor = buildExecutor(onMove, onPickup, onDeposit);

  try {
    // Calling exec causes PddlExecutor to invoke executor(agent, ...) on each object in rawPlan
    await pddlExecutor.exec(rawPlan);
    console.log("Plan execution completed successfully");
  } catch (error) {
    console.error("Error during the execution:", error);
    throw error;
  }
}
