import type { Payload } from '../shared/events.js';
import { deathReveal } from './stage-summary.js';
type VisibleEvent={day:number;payload:Payload};
/** `town` lines appear only in Town chat; `all` lines also mark night and day in team channels. */
export type SystemLine={text:string;scope:'town'|'all'};

/** Game-event lines shown between chat messages, derived only from events the viewer already received. */
export function systemLines(e:VisibleEvent,roster:{name:string}[],events:VisibleEvent[]):SystemLine[]{
 const p=e.payload;
 const name=(slot:number)=>roster[slot]?.name??`Seat ${slot+1}`;
 const reveal=(slot:number)=>{const r=deathReveal(events,slot);return r?` · ${r}`:'';};
 switch(p.kind){
  case 'started':return [{text:'Day 1 begins',scope:'town'}];
  case 'ballots':{
   const votes=p.eliminated===null?0:p.ballots.filter(b=>b.target===p.eliminated).length;
   const text=p.eliminated!==null?`Vote: ${name(p.eliminated)} eliminated (${votes} of ${p.ballots.length})${reveal(p.eliminated)}`
    :{no_majority:'Vote: no majority — nobody eliminated',tie:'Vote: tied — nobody eliminated',all_abstain:'Vote: everyone passed',majority:'Vote: nobody eliminated'}[p.resolution];
   return [{text,scope:'town'},{text:`Night ${e.day} falls`,scope:'all'}];
  }
  case 'night_resolved':{
   const [only]=p.eliminated,deaths=p.eliminated.map(slot=>`${name(slot)}${deathReveal(events,slot)?` (${deathReveal(events,slot)})`:''}`);
   const text=only===undefined?'Dawn: everyone survived the night':p.eliminated.length===1?`Dawn: ${name(only)} was killed in the night${reveal(only)}`:`Dawn: ${deaths.join(' and ')} were killed in the night`;
   const over=events.some(x=>x.payload.kind==='finished');
   return [{text,scope:'town'},...(over?[]:[{text:`Day ${e.day+1} begins`,scope:'all' as const}])];
  }
  case 'finished':return [{text:'The game is over',scope:'town'}];
  default:return [];
 }
}
