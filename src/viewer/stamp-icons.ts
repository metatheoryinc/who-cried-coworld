import type { StampId } from './stamps.js';
export const stampLabels:Record<StampId,string>={vote:'Vote',kill:'Kill target',knife:'Knife',block:'Block',inspect:'Inspect',protect:'Protect',jail:'Jail',check:'Check role',inform:'Inform',track:'Track'};
const svg=(body:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const drawn:Partial<Record<StampId,string>>={
 knife:svg('<path d="M3 21l6-6"/><path d="M9 15l9.5-9.5a2.1 2.1 0 0 1 3 3L12 18z"/>'),
 block:svg('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>'),
 inspect:svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
 protect:svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
 jail:svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>'),
 inform:svg('<path d="M5 9h14l-2 11H7z"/><path d="M6 9a6 6 0 0 1 12 0"/>'),
 track:svg('<path d="M8 3c2 0 3 2 3 5s-1 4-3 4-3-1-3-4 1-5 3-5z"/><path d="M16 11c2 0 3 2 3 5s-1 4-3 4-3-1-3-4 1-5 3-5z"/>'),
 check:svg('<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>'),
};
/** Stamp artwork: existing hoof and claw art for vote and kill, inked line icons for the rest. */
export function stampIcon(id:StampId,asset:(name:string)=>string){
 if(id==='vote')return `<img src="${asset('vote_banner_town_hoof')}" alt="">`;
 if(id==='kill')return `<img src="${asset('dead_icon_claw')}" alt="">`;
 return drawn[id]??'';
}
