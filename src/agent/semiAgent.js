import DeliverooClient from "../api/deliverooClient.js"
import { MapStore } from "../models/mapStore.js";
import { ParcelsStore } from "../models/parcelsStore.js";
import { Me } from "../models/me.js";
import { blindMove } from "../actions/movement.js";


const client = new DeliverooClient();

const me = new Me();

/**
 * @param { {id : string, name : string, x : number, y : number, score : number} } payload
 */
client.onYou( (payload) => {
    me.update(payload);
} )


let mapStore = new MapStore();
let parcelStore = new ParcelsStore();

client.onTile( ( {x, y, type} )  => {
    let numType = parseInt(type);
    mapStore.addTile({x : x, y : y, type : numType});
});

client.onMap( async ( map ) => {
    mapStore.mapSize = map;
    mapStore.calculateDistances();
})

client.onParcels( async ( pp ) => {
    for ( let p of pp ) {
        parcelStore.addParcel(p, mapStore);
    }
} )


while (true) {

    await new Promise( res => setTimeout( res, 100 ) );

    if ( ! me.id || ! parcelStore.map.size ) {
        // TODO here explore
        continue;
    }

    // TODO use function and change logic here
    // get nearest parcel
    const nearest = Array.from( parcelStore.map.values() )
    .filter( p => ! p.carriedBy )
    .sort( (a, b) => {
        const d1 = mapStore.distance( me, a );
        const d2 = mapStore.distance( me, b );
        return d1 - d2;
    } ).shift();

    // if no parcels are available
    if ( ! nearest ) {
        // TODO here go home absolutely
        continue;
    }
    
    // else move to nearest parcel
    console.log( 'nearest', nearest.id, nearest.x, nearest.y );
    
    await blindMove( client, me, nearest )
    console.log( 'moved to parcel', nearest.id, me.x, me.y );
    
    await client.emitPickup();
    
    console.log( 'picked up' );
}