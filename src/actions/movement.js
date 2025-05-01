import DeliverooClient from "../api/deliverooClient.js";
import { Me } from "../models/me.js";


//FIXME: has several bugs
/**
 * Move one step toward the target, waiting until the move is acknowledged.
 * @param {DeliverooClient} client 
 * @param {Me} me 
 * @param {{x:number,y:number}} target 
 */
export async function blindMove(client, me, target) {
    // console.log(`${me.name} goes from (${me.x},${me.y}) to (${target.x},${target.y})`);
  
    // Promise that resolves when server reports me.x and me.y are integer again
    const moved = new Promise(res => {
      client.onYou(state => {
        if (state.x % 1 === 0 && state.y % 1 === 0) {
          res();
        }
      });
    });
  
    if (me.x < target.x)      
      await client.emitMove('right');
    else if (me.x > target.x) 
      await client.emitMove('left');
  
    if (me.y < target.y)      
      await client.emitMove('up');
    else if (me.y > target.y) 
      await client.emitMove('down');
  
    await moved;
  }
  