import { expect,it } from 'vitest';
import { Event } from '../../src/shared/events.js';
const wrap=(payload:unknown,audience:unknown={kind:'public'},reveal='public')=>({schema:'wcw.events/1',seq:1,day:1,phase:'day',audience,reveal,payload});
const bid={kind:'bid',slot:0,window:0,bid:{kind:'bid',wantsToSpeak:false,urgency:0,text:'',replyTo:null,accusation:null,reason:''},rank:null,selected:false};
it('enforces originating-seat visibility for bids, choices and diagnostics',()=>{
 expect(Event.safeParse(wrap(bid,{kind:'seats',slots:[0]},'discarded_bids')).success).toBe(true);
 for(const audience of [{kind:'public'},{kind:'server'},{kind:'seats',slots:[1]},{kind:'seats',slots:[0,1]}])expect(Event.safeParse(wrap(bid,audience,'discarded_bids')).success).toBe(false);
});
it('rejects roles or seeds in a public envelope',()=>{
 const seed={kind:'seed',seed:'0'.repeat(32),randomVersion:'sha256-counter/1'};
 expect(Event.safeParse(wrap(seed)).success).toBe(false);
 expect(Event.safeParse(wrap(seed,{kind:'server'},'roles')).success).toBe(true);
});
it('rejects extra payload fields and malformed actor identities',()=>{
 expect(Event.safeParse(wrap({kind:'elimination',slot:0,cause:'vote',role:'wolf'})).success).toBe(false);
 expect(Event.safeParse(wrap({kind:'night_outcome',ability:'inspect',actor:null,target:2,outcome:'applied'},{kind:'server'},'night_choices')).success).toBe(false);
});
it('requires canonical roster and role slots and faction mapping',()=>{
 const roles=['wolf','alchemist','seer','guard','sheep','sheep','sheep','sheep','sheep'].map((role,slot)=>({slot,role,faction:slot<2?'wolf':'town'}));
 expect(Event.safeParse(wrap({kind:'roles',roles},{kind:'server'},'roles')).success).toBe(true);
 expect(Event.safeParse(wrap({kind:'roles',roles:[...roles].reverse()},{kind:'server'},'roles')).success).toBe(false);
 expect(Event.safeParse(wrap({kind:'roles',roles:roles.map(r=>({...r,faction:'town'}))},{kind:'server'},'roles')).success).toBe(false);
});
it('keeps kill resolution server-only and revealed with night choices',()=>{
 const r={kind:'kill_resolution',targetVotes:[{target:4,votes:2}],knifeVotes:[{killer:0,votes:2}],targetTie:false,knifeTie:false,target:4,killer:0};
 expect(Event.safeParse(wrap(r,{kind:'server'},'night_choices')).success).toBe(true);
 for(const audience of [{kind:'public'},{kind:'seats',slots:[0]}])expect(Event.safeParse(wrap(r,audience,'night_choices')).success).toBe(false);
});
