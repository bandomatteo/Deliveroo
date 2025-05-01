import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import config from "../../config.js";
import { ParcelsStore } from "../models/parcelsStore.js";

/*
    * This class is just a wrapper around the DeliverooApi class.
    * Whenever we need to call the API, we will use this class.
*/
export default class DeliverooClient {
  constructor() {
    this.client = new DeliverooApi(config.host, config.token);
  }

  onYou(callback) {
    this.client.onYou(callback);
  }

  onParcels(callback) {
    this.client.onParcelsSensing(callback);
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
  emitPutdown(parcelStore, id) {
    const carriedByMe = parcelStore.carried(id);
    this.client.emitPutdown();
    carriedByMe.forEach(p => parcelStore.removeParcel(p));
  }

  onParcelsSensing(callback) {
    return this.client.onParcelsSensing(callback);
  }

}
