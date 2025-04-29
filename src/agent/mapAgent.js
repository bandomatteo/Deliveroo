import DeliverooClient from "../api/deliverooClient.js"
import { MapStore } from "../models/mapStore.js";


const client = new DeliverooClient();

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


let mapStore = new MapStore();

client.onTile( ( {x, y, type} )  => {
    let numType = parseInt(type);
    mapStore.addTile({x : x, y : y, type : numType});
});

client.onMap( async ( map ) => {
    mapStore.size = map;
    mapStore.calculateDistances();
    
    // Test logs
    mapStore.printAllDistances();
    console.log("0, 0 -> 2, 2= ", mapStore.distance({x : 0, y : 0}, {x : 2, y : 2}))
})