import type { Payload } from '../shared/events.js';
type ChatEvent={id:string;day:number;payload:Payload};
export type Channel='town'|'wolves'|'nobles';
const kinds:Record<Channel,Payload['kind']>={town:'speech',wolves:'wolf_chat',nobles:'noble_chat'};
export function channelMessages<E extends ChatEvent>(events:E[],channel:Channel){return events.filter(e=>e.payload.kind===kinds[channel]);}
const author=(p:Payload)=>p.kind==='speech'?p.speech.slot:'slot' in p?p.slot:-1;
const text=(p:Payload)=>p.kind==='speech'?p.speech.text:'text' in p?String(p.text):'';
export function mentions(message:string,name:string){
 if(!name)return false;
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 // Duplicate names get numeric suffixes (Human-2), which must not count as mentioning Human.
 return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?!-\\d)($|[^\\p{L}\\p{N}_])`,'iu').test(message);
}
/** Messages from others after `lastSeenId`; `mention` flags any that name you. */
export function unread(events:ChatEvent[],channel:Channel,lastSeenId:string|undefined,self:number,selfName:string){
 const messages=channelMessages(events,channel),seen=lastSeenId===undefined?-1:messages.findIndex(e=>e.id===lastSeenId);
 const fresh=messages.slice(seen+1).filter(e=>author(e.payload)!==self);
 return {count:fresh.length,mention:fresh.some(e=>mentions(text(e.payload),selfName)),firstId:fresh[0]?.id??null};
}
