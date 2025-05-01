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
client.onYou( (payload, time) => {
    me.update(payload, time);
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

let oldTime = null;

while (true) {

    await new Promise( res => setTimeout( res, 100 ) );

    if ( ! me.id || ! parcelStore.map.size ) {
        continue;
    }

    // Get frame difference
    if (oldTime === null) {
        oldTime = me.ms;
    }
    const timeDiff = me.ms - oldTime;
    oldTime = me.ms;

    console.log(parcelStore.map.size);

    // TODO use function and change logic here
    // get nearest parcel
    const nearest = parcelStore.available
        .sort( (a, b) => {
            const d1 = mapStore.distance( me, a );
            const d2 = mapStore.distance( me, b );
            return d1 - d2;
        } ).shift();

    parcelStore.updateReward(timeDiff / 1000);

    // if no parcels are available
    if ( ! nearest ) {
        // If carrying some parcels go home absolutely
        const carriedByMe = parcelStore.carried(me.id);
        
        if (carriedByMe.length === 0) {
            // TODO here explore (as before)
            continue;
        }

        let [base, minDist] = mapStore.nearestBase(me);
        await blindMove(client, me, base);
        //
        if (me.x === base.x && me.y === base.y) {
            client.emitPutdown(parcelStore, me.id);
        }
        
        continue;
    }

    // else move to nearest parcel
    // console.log( 'nearest', nearest.id, nearest.x, nearest.y );
    
    await blindMove( client, me, nearest )
    // console.log( 'moved to parcel', nearest.id, me.x, me.y );
    
    await client.emitPickup();
    
    // console.log( 'picked up' );
}