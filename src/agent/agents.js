import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import {default as config} from "../../config.js"

const client = new DeliverooApi(
    config.host,
    config.token
)

const me = {};

client.onYou( ( {id, name, x, y, score} ) => {
    me.id = id
    me.name = name
    me.x = x
    me.y = y
    me.score = score
} )