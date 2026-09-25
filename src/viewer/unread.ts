import type { Payload } from '../shared/events.js';
import { mentionsName } from '../shared/player-names.js';
type ChatEvent={id:string;day:number;payload:Payload};
export type Channel='town'|'wolves'|'nobles';
const kinds:Record<Channel,Payload['kind']>={town:'speech',wolves:'wolf_chat',nobles:'noble_chat'};
export function channelMessages<E extends ChatEvent>(events:E[],channel:Channel){return events.filter(e=>e.payload.kind===kinds[channel]);}
const author=(p:Payload)=>p.kind==='speech'?p.speech.slot:'slot' in p?p.slot:-1;
const text=(p:Payload)=>p.kind==='speech'?p.speech.text:'text' in p?String(p.text):'';
/** Duplicate names (Human B) never count as mentioning Human; see mentionsName. */
export function mentions(message:string,name:string,names:readonly string[]=[]){return mentionsName(message,name,names);}
/** Messages from others after `lastSeenId`; `mention` flags any that name you. */
export function unread(events:ChatEvent[],channel:Channel,lastSeenId:string|undefined,self:number,selfName:string,names:readonly string[]=[]){
 const messages=channelMessages(events,channel),seen=lastSeenId===undefined?-1:messages.findIndex(e=>e.id===lastSeenId);
 const fresh=messages.slice(seen+1).filter(e=>author(e.payload)!==self);
 return {count:fresh.length,mention:fresh.some(e=>mentions(text(e.payload),selfName,names)),firstId:fresh[0]?.id??null};
}
