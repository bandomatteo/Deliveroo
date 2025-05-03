import DeliverooClient from "../api/deliverooClient.js"
import { MapStore } from "../models/mapStore.js";
import { ParcelsStore } from "../models/parcelsStore.js";
import { Me } from "../models/me.js";
import { smartMove } from "../actions/movement.js";


const client = new DeliverooClient();

const me = new Me();

/**
 * @param { {id : string, name : string, x : number, y : number, score : number} } payload
 */
client.onYou( (payload, time) => {
    me.update(payload, time);
} )

let seconds_per_move = 0.1  // Starting value, learned on the way

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

client.onParcelsSensing( async ( pp ) => {
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

    // Update ms per move parameter (90% on history, 10% on new values)
    // TODO don't learn for now, leave it here for later (maybe)
    // seconds_per_move = seconds_per_move * 0.9 + timeDiff / 10_000;

    // console.log("Spm: ", seconds_per_move);

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
        await smartMove(client, me, base,mapStore);
        
        if (me.x === base.x && me.y === base.y) {
            client.emitPutdown(parcelStore, me.id);
        }
        
        continue;
    }

    let myParcels = parcelStore.carried(me.id);
    let carried_value = myParcels.reduce((sum, parcel) => sum + parcel.reward, 0);

    // Calculate score of going home
    let [base, minDist] = mapStore.nearestBase(me);
    let home_score = carried_value - minDist * myParcels.length * seconds_per_move;

    // console.log("Home = ", home_score);

    // Calculate score of picking the parcel and then going home
    let pickup_score = carried_value + nearest.reward 
                        - (mapStore.distance(me, nearest) + nearest.baseDistance) * (myParcels.length + 1) * seconds_per_move;

    // console.log("Pickup = ", pickup_score);

    //  Choose accordingly
    if (pickup_score > home_score) { 
        // console.log("-- PICKUP --");      
        await smartMove( client, me, nearest, mapStore )
        await client.emitPickup();
    }
    else if (home_score > 0) {  // sometimes pickup_score is negative
        // console.log("-- GO HOME --");
        let [base, minDist] = mapStore.nearestBase(me);
        await smartMove(client, me, base,mapStore);
        
        if (me.x === base.x && me.y === base.y) {
            client.emitPutdown(parcelStore, me.id);
        }
    }
    else {
        // TODO explore here
    }
    
    // console.log( 'picked up' );
}