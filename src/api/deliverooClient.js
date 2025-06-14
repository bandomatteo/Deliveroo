import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import config from "../../config.js";
import { ParcelsStore } from "../models/parcelsStore.js";


/**
 * @class DeliverooClient
 * @description
 * This class is used to interact with the Deliveroo API.
 * It allows the agent to send and receive events related to the game.
 */
 class DeliverooClient {
  /**
   * Creates an instance of DeliverooClient.
   * @param {boolean} isMaster - Indicates whether this client is the master or slave.
   * @description
   * This class is used to interact with the Deliveroo API.
   * It allows the agent to send and receive events related to the game.
   */
  constructor(isMaster = true) {
    if (isMaster === true)
      this.client = new DeliverooApi(config.host, config.token);
    else
      this.client = new DeliverooApi(config.host, config.tokenSlave);
  }


  /**
   * @param {*} callback - The callback function to be called when the agent's ID is received.
   * @description
   * This method is used to set up the client with the agent's ID.
   * It is typically called at the start of the game to ensure the client is ready to send and receive events.
   */
  onYou(callback) {
    this.client.onYou(callback);
  }

  /**
   * @description
   * This method is used to move the agent in the specified direction.
   * It emits a move event to the server, which updates the agent's position on the map.
   */
  emitMove(direction) {
    return this.client.emitMove(direction);
  }

  /**
   * 
   * @description
   * This method is used to emit a pickup event for the agent.
   * It is typically called when the agent is on a tile with a parcel and wants to pick it up.
   * The server will then update the agent's state to reflect that it is carrying the parcel.
   */
  emitPickup() {
    return this.client.emitPickup();
  }

  /**
   * @description 
   * This method is used to emit a drop event for the agent.
   * It is typically called when the agent is on a tile with a base and wants to drop off parcels.
   * The server will then update the agent's state to reflect that it has dropped off the parcels.
   */
  onTile(callback) {
    this.client.onTile(callback);
  }

  /**
    * @description
    * This method is used to listen for map updates from the server.
    * It allows the agent to receive updates about the game map, including the positions of parcels and bases.
    * 
   */
  onMap(callback) {
    this.client.onMap(callback);
  }


  /**
   * Emits a putdown event for the given parcel ID.
   * It removes all parcels carried by the agent from the parcel store.
   * @param {ParcelsStore} parcelStore - The store containing parcels.
   * @param {string} id - The ID of the parcel to put down.
   * @returns {Promise<void>} - A promise that resolves when the putdown event is emitted.
   * @description
   * This method is used to put down parcels at the agent's current location.
   * It emits a putdown event to the server and removes all parcels carried by the agent from the parcel store.
   * It is typically called when the agent reaches a base tile and needs to drop off parcels.
   */
  async emitPutdown(parcelStore, id) {
    const carriedByMe = parcelStore.carried(id);
    await this.client.emitPutdown();
    carriedByMe.forEach(p => parcelStore.removeParcel(p));
  }

  /**
   * @description
   * This method is used to listen for updates on parcels in the game.
   * It allows the agent to receive updates about the state of parcels, including their positions and whether they have been picked up or delivered.
   */
  onParcelsSensing(callback) {
    return this.client.onParcelsSensing(callback);
  }

  /**
   * @description
   * This method is used to listen for updates on agents in the game.
   * It allows the agent to receive updates about the state of other agents, including their positions and actions.
   */
  onAgentsSensing(callback) {
    return this.client.onAgentsSensing(callback);
  }

  /**
   * @description
   * This method is used to listen for configuration updates from the server.
   * It allows the agent to receive updates about the game configuration, such as the map size and other settings.
   */

  onConfig(config) {
    return this.client.onConfig(config);
  }
}
export default DeliverooClient;