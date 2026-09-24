import {roleNames} from '../shared/roles.js';
import type { Payload } from '../shared/events.js';
type VisibleEvent={day:number;payload:Payload};
export function deathCause(events:VisibleEvent[],slot:number){
 const event=events.find(e=>e.payload.kind==='elimination'&&e.payload.slot===slot)?.payload;
 return event?.kind==='elimination'?event.cause:null;
}
export function deathReveal(events:VisibleEvent[],slot:number){
 const p=events.find(e=>e.payload.kind==='elimination'&&e.payload.slot===slot)?.payload;
 return p?.kind==='elimination'&&p.role&&p.faction?`${roleNames[p.role]} · ${p.faction==='wolf'?'Wolves':p.faction==='town'?'Town':'Independent'}`:null;
}
export function stageSummary(s:{period:string;day:number;events:VisibleEvent[];roster:{name:string}[]}){
 const name=(slot:number)=>{const n=s.roster[slot]?.name??`Seat ${slot+1}`,reveal=deathReveal(s.events,slot);return reveal?`${n} (${reveal})`:n;};
 if(s.period==='dusk'){
  const p=s.events.filter(e=>e.day===s.day&&e.payload.kind==='ballots').at(-1)?.payload;
  const target=p?.kind==='ballots'?p.eliminated:null;
  return {title:'The Night Begins…',art:target===null?'tscreen_day_nodeath':'tscreen_day_death',description:target===null?'No one received a majority vote. The town could not decide!':`${name(target)} was eliminated by the town.`};
 }
 if(s.period==='dawn'){
  const p=s.events.filter(e=>e.day===s.day-1&&e.payload.kind==='night_resolved').at(-1)?.payload;
  const killed=p?.kind==='night_resolved'?p.eliminated:[];
  return {title:'The Day Begins…',art:killed.length?'tscreen_night_death':'tscreen_night_nodeath',description:killed.length?`${killed.map(name).join(', ')} ${killed.length===1?'was':'were'} killed by the wolves last night.`:'Morning breaks. Everyone survived the night.'};
 }
 return null;
}
