import type { StampId } from './stamps.js';
export const stampLabels:Record<StampId,string>={vote:'Vote',kill:'Kill target',knife:'Knife',block:'Block',inspect:'Inspect',protect:'Protect',jail:'Jail',check:'Check role',inform:'Inform',track:'Track'};
/** Painted art: the original client's icons, plus a knife drawn to match (docs/design/art/knife_icon.svg). */
const art:Record<StampId|'skip',string>={vote:'vote_banner_town_hoof',kill:'vote_banner_wolfs_claw',knife:'knife_icon',block:'potion_icon',inspect:'seer_icon',protect:'guard_icon',jail:'chef_icon',check:'track_icon',inform:'milk_icon',track:'priest_icon',skip:'abstain_town'};
export function stampArt(id:StampId|'skip'){return art[id];}
export function stampIcon(id:StampId|'skip',asset:(name:string)=>string){return `<img src="${asset(art[id])}" alt="">`;}
/** A stable pseudo-random spot (percent of the card) and tilt for a stamp, so redraws never move it. */
export function scatter(key:string){
 let h=2166136261;for(const c of key){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
 const pick=(shift:number,range:number)=>((h>>>shift)&255)/255*range;
 return {x:Math.round(12+pick(0,46)),y:Math.round(8+pick(8,38)),r:Math.round(pick(16,70)-35)};
}
