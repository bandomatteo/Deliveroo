/*
    * I'm using this class just to test stuff
*/
import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import {default as config} from "../../config.js"


const client = new DeliverooApi(
    config.host,
    config.token
)

const me = {id: null, name: null, x: null, y: null, score: null};
const parcels = new Map();

client.onYou( ( {id, name, x, y, score} ) => {
    me.id = id;
    me.name = name;
    me.x = x;
    me.y = y;
    me.score = score;
} )

/*client.onParcelsSensing( async ( pp ) => {
    for ( let p of pp ) {
        parcels.set( `${p.x}_${p.y}`, p );
    }
} )*/

client.onTile ( async ( tile ) => {
    console.log( 'tile:', tile );
})
