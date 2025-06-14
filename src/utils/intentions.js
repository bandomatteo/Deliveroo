/**
 * @module intentions
 * @description
 * This module defines a set of constants representing different intentions or actions
 * that a player can take in a game. These intentions are used to guide the player's behavior
 * and decision-making process during gameplay. Each intention is represented as a string constant.
 * The intentions include actions like picking up items, depositing items, exploring the game world,
 * dropping items and moving away, and simply moving away without any specific action.
 * @example
 * // Example usage:
 * const playerIntention = INTENTIONS.GO_PICKUP;
 * if (playerIntention === INTENTIONS.GO_PICKUP) {
 *     console.log("Player intends to pick up an item.");
 */
export const INTENTIONS = {
    GO_PICKUP:  "GO_PICKUP",
    GO_DEPOSIT: "GO_DEPOSIT",
    EXPLORE:    "EXPLORE",
    DROP_AND_GO_AWAY: "DROP_AND_GO_AWAY",
    GO_AWAY:  "GO_AWAY"
  };