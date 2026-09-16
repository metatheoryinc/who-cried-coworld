import type { Bid } from '../../shared/actions.js';
export type FloorContext={day:number;window:number;living:number[];counts:Record<number,number>;recent:Record<number,string[]>;lastSpeechId:string|null};
export function rankBids(rows:{slot:number;bid:Bid}[],c:FloorContext):number[]{
 const normalized=(text:string)=>text.trim().toLowerCase();
 const rotation=(c.day-1+c.window)%9;
 const priority=(slot:number)=>(slot-rotation+9)%9;
 return rows.filter(({slot,bid})=>c.living.includes(slot)&&bid.wantsToSpeak&&(c.counts[slot]??0)<2&&!(c.recent[slot]??[]).slice(-5).some(text=>normalized(text)===normalized(bid.text)))
  .sort((a,b)=>(c.counts[a.slot]??0)-(c.counts[b.slot]??0)||
   Number(c.lastSpeechId!==null&&b.bid.replyTo===c.lastSpeechId)-Number(c.lastSpeechId!==null&&a.bid.replyTo===c.lastSpeechId)||
   b.bid.urgency-a.bid.urgency||priority(a.slot)-priority(b.slot))
  .map(row=>row.slot);
}
export function wolfSchedule(livingWolves:number[]):(number|null)[]{
 const slots=[...livingWolves].sort((a,b)=>a-b);
 if(slots.length>2||new Set(slots).size!==slots.length)throw new Error('Invalid Wolf roster');
 const turns=[...slots,...slots] as (number|null)[];
 while(turns.length<4)turns.push(null);
 return turns;
}
