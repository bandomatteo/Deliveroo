import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import config from "../../config.js";
import { ParcelsStore } from "../models/parcelsStore.js";

/*
    * This class is just a wrapper around the DeliverooApi class.
    * Whenever we need to call the API, we will use this class.
*/
export default class DeliverooClient {
  constructor(isMaster = true) {
    if (isMaster === true)
      this.client = new DeliverooApi(config.host, config.token);
    else 
      this.client = new DeliverooApi(config.host, config.tokenSlave);
  }

  onYou(callback) {
    this.client.onYou(callback);
  }

  emitMove(direction) {
    return this.client.emitMove(direction);
  }

  emitPickup() {
    return this.client.emitPickup();
  }

  onTile(callback) {
    this.client.onTile(callback);
  }

  onMap(callback) {
    this.client.onMap(callback);
  }

  /**
   * @param {ParcelsStore} parcelStore
   * @param {string} id
   */
  async emitPutdown(parcelStore, id) {
    const carriedByMe = parcelStore.carried(id);
    await this.client.emitPutdown();
    carriedByMe.forEach(p => parcelStore.removeParcel(p));
  }

  onParcelsSensing(callback) {
    return this.client.onParcelsSensing(callback);
  }

  onAgentsSensing(callback) {
    return this.client.onAgentsSensing(callback);
  }

  onConfig(config) {
    return this.client.onConfig(config);
  }
}