import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import {default as config} from "../../config.js"


const client = new DeliverooApi(
    config.host,
    config.token
)



/**
 * @type { {id:string, name:string, x:number, y:number, score:number} }
 */
const me = {id: null, name: null, x: null, y: null, score: null};

client.onYou( ( {id, name, x, y, score} ) => {
    // console.log( 'me:', me.x, me.y );
    me.id = id;
    me.name = name;
    me.x = x;
    me.y = y;
    me.score = score;
} )



/**
 * @type { Map< string, {id: string, carriedBy?: string, x:number, y:number, reward:number} > }
 */
const parcels = new Map();

client.onParcelsSensing( async ( pp ) => {
    for ( let p of pp ) {
        parcels.set( `${p.x}_${p.y}`, p );
    }
} )



function distance( {x:x1, y:y1}, {x:x2, y:y2} ) {
    const dx = Math.abs( Math.round(x1) - Math.round(x2) )
    const dy = Math.abs( Math.round(y1) - Math.round(y2) )
    return dx + dy;
}



async function blindMove ( target ) {
    
    console.log(me.name, 'goes from', me.x, me.y, 'to', target.x, target.y);

    var m = new Promise( res => client.onYou( m => m.x % 1 != 0 || m.y % 1 != 0 ? null : res() ) );

    if ( me.x < target.x )
        await client.emitMove('right');
    else if ( me.x > target.x )
        await client.emitMove('left');
    
    if ( me.y < target.y )
        await client.emitMove('up');
    else if ( me.y > target.y )
        await client.emitMove('down');

    await m;

}



while (true) {

    await new Promise( res => setTimeout( res, 100 ) );

    if ( ! me.id || ! parcels.size ) {
        continue;
    }

    console.log( `me(${me.x},${me.y})`,
        Array.from( parcels.values() )
        .map( p => `${p.reward}@(${p.x},${p.y})` )
        .join( ' ' )
    );

    // get nearest parcel
    const nearest = Array.from( parcels.values() )
    .filter( p => ! p.carriedBy )
    .sort( (a, b) => {
        const d1 = distance( me, a );
        const d2 = distance( me, b );
        return d1 - d2;
    } ).shift();

    // if no parcels are available
    if ( ! nearest ) {
        console.log( 'no parcels' );
        continue;
    }
    
    // else move to nearest parcel
    console.log( 'nearest', nearest.id, nearest.x, nearest.y );
    
    await blindMove( nearest )
    console.log( 'moved to parcel', nearest.id, me.x, me.y );
    
    await client.emitPickup();
    
    console.log( 'picked up' );

}