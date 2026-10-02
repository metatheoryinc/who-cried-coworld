import { expect, it } from 'vitest';
import { Action, Request } from '../../src/shared/player.js';
import { Event } from '../../src/shared/events.js';
import { HumanChat } from '../../src/shared/human.js';
import { project } from '../../src/shared/presentation/project.js';
const envelope=(body:unknown)=>({protocol:'wcw.player/1',type:'action',episodeId:'e1',requestId:'r1',observationId:'o1',body,report:null});
const event=(seq:number,payload:unknown,audience:unknown,reveal:string)=>({schema:'wcw.events/1',seq,day:1,phase:'day',audience,reveal,payload});
const graveyard=(seq:number,slot:number,text:string)=>event(seq,{kind:'dead_chat',slot,text},{kind:'dead'},'dead_chat');
const death=(seq:number,slot:number)=>event(seq,{kind:'elimination',slot,cause:'vote',role:'sheep',faction:'town'},{kind:'public'},'public');

it('accepts a Graveyard reply up to 240 characters, including an empty one',()=>{
 expect(Action.safeParse(envelope({kind:'dead_chat',text:'You got me.',summary:''})).success).toBe(true);
 expect(Action.safeParse(envelope({kind:'dead_chat',text:'',summary:''})).success).toBe(true);
 expect(Action.safeParse(envelope({kind:'dead_chat',text:'x'.repeat(241),summary:''})).success).toBe(false);
 expect(Request.safeParse({kind:'dead_chat',maxCharacters:240}).success).toBe(true);
});
it('only lets Graveyard messages use the dead audience',()=>{
 expect(Event.safeParse(graveyard(1,3,'boo')).success).toBe(true);
 expect(Event.safeParse(event(1,{kind:'dead_chat',slot:3,text:'boo'},{kind:'public'},'dead_chat')).success).toBe(false);
 expect(Event.safeParse(event(1,{kind:'dead_chat',slot:3,text:'boo'},{kind:'seats',slots:[3]},'dead_chat')).success).toBe(false);
 expect(Event.safeParse(event(1,{kind:'wolf_chat',slot:3,text:'boo'},{kind:'dead'},'wolf_chat')).success).toBe(false);
});
it('accepts Graveyard chat in any period',()=>{
 const chat=(phaseKey:string,channel='graveyard')=>HumanChat.safeParse({protocol:'wcw.human/1',type:'chat',episodeId:'e1',id:'c1',phaseKey,channel,text:'hello'}).success;
 for(const period of ['discussion','vote','coordination','actions','dusk','dawn'])expect(chat(`2:${period}`)).toBe(true);
 expect(chat('2:somewhere')).toBe(false);
});
it('shows Graveyard messages to dead seats only, including seats that die later',()=>{
 const journal=[death(1,3),graveyard(2,3,'is anyone here?'),death(3,5)].map(e=>Event.parse(e));
 const sees=(recipient:'public'|'replay'|number)=>project(journal,recipient).some(e=>e.payload.kind==='dead_chat');
 expect(sees(3)).toBe(true);
 expect(sees(5)).toBe(true);
 expect(sees(0)).toBe(false);
 expect(sees('public')).toBe(false);
 expect(sees('replay')).toBe(true);
});
