/**
 * Manages the current known parcels.
 */
export class ParcelsStore {
    constructor() {
      this.map = new Map();
    }
  
    /**
     * Update the store from sensing event.
     * @param {Array<{id:string,carriedBy?:string,x:number,y:number,reward:number}>} parcelsArray
     */
    updateAll(parcelsArray) {
      this.map.clear();
      parcelsArray.forEach(p => {
        // use p.id or `${p.x}_${p.y}` as key
        this.map.set(p.id ?? `${p.x}_${p.y}`, p);
      });
    }
  
    /**
     * Returns only parcels not carried by anyone.
     */
    get available() {
      return Array.from(this.map.values())
        .filter(p => !p.carriedBy);
    }
  }
  