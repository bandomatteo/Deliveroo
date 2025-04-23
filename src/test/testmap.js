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


/*client.onMap( async ( map ) => {
    console.log( 'map:', map );
    //console.log( 'me:', me.x, me.y );
    
} )*/

client.onTile ( async ( tile ) => {
    console.log( 'tile:', tile );
    //console.log( 'me:', me.x, me.y );
    
})
