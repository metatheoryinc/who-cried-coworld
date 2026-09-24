import {expect,it,vi} from 'vitest';
import {HumanSession} from '../../src/game/runtime/human-session.js';
import {GameConfig} from '../../src/shared/config.js';
const make=()=>new HumanSession(GameConfig.parse({mode:'human',setup:'A2',humanSlot:0,tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`}))}),'test');
it('uses a moderator selection and prompt with only public context',async()=>{
 const s=make();let captured:any;
 s.moderator=async input=>{captured=input;return {slot:4,prompt:'P4, what claim needs an answer?'};};
 s.start(0);await vi.waitFor(()=>expect(s.pending.get(4)?.request).toMatchObject({kind:'bid',host:{prompt:'P4, what claim needs an answer?'}}));
 expect(Object.keys(captured).sort()).toEqual(['eligibleSlots','counts','day','humanMessage','humanSlot','humanSlots','recent','roster','transcript'].sort());
 expect(captured.roster.every((p:any)=>Object.keys(p).sort().join(',')==='alive,name,slot')).toBe(true);
 expect(s.deadline).toBe(13000);expect(s.phaseDeadline).toBe(150000);
});
it('falls back after a hung moderator and ignores its late result',async()=>{
 vi.useFakeTimers();try{
  const s=make();let finish!:(value:any)=>void;
  s.moderator=()=>new Promise(resolve=>{finish=resolve;});s.start(0);
  await vi.advanceTimersByTimeAsync(2000);
  expect(s.pending.get(1)?.request.kind).toBe('bid');
  finish({slot:5,prompt:'Late choice'});await vi.advanceTimersByTimeAsync(0);
  expect(s.pending.get(1)?.request.kind).toBe('bid');expect(s.deadline).toBe(13000);
 }finally{vi.useRealTimers();}
});
it('rejects selecting the human and prevents completion after cancellation',async()=>{
 const s=make();s.moderator=async()=>({slot:0,prompt:'Human speaks'});s.start(0);
 await vi.waitFor(()=>expect(s.pending.get(1)?.request.kind).toBe('bid'));
 const other=make();let finish!:(value:any)=>void;other.moderator=()=>new Promise(resolve=>{finish=resolve;});other.start(0);await Promise.resolve();other.cancelModerator();finish({slot:4,prompt:'Cancelled'});await new Promise(resolve=>setTimeout(resolve,0));expect(other.pending.size).toBe(0);
});
it('rejects a prompt addressed to a different player',async()=>{
 const s=make();s.moderator=async()=>({slot:4,prompt:'P0, explain your vote.'});s.start(0);
 await vi.waitFor(()=>expect(s.pending.get(1)?.request.kind).toBe('bid'));
});
it('rests a speaker for two turns after a missed public response',async()=>{
 const s=make();s.moderator=async()=>({slot:4,prompt:'P4, explain your vote.'});s.start(0);
 await vi.waitFor(()=>expect(s.pending.get(4)?.request.kind).toBe('bid'));
 s.advance(13000);
 await vi.waitFor(()=>expect([...s.pending.values()].some(p=>p.request.kind==='bid')).toBe(true));
 expect(s.pending.get(4)?.request.kind).not.toBe('bid');
});
it('allows the former human seat to speak in an all-bot paced game',async()=>{
 const config=GameConfig.parse({mode:'bots',humanSlot:-1,tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`}))});
 const s=new HumanSession(config,'bots');s.moderator=async()=>({slot:0,prompt:'P0, what would you like to add?'});s.start(0);
 await vi.waitFor(()=>expect(s.pending.get(0)?.request.kind).toBe('bid'));
 expect(s.deadline).toBe(13000);expect(s.phaseDeadline).toBe(150000);
});
it('gives all nine bots vote and night requests without reserving a human seat',()=>{
 const config=GameConfig.parse({mode:'bots',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`}))});
 const s=new HumanSession(config,'bots');s.start(0);
 for(let t=13000;t<=143000;t+=13000)s.advance(t);
 s.advance(150000);
 expect(s.period).toBe('vote');expect([...s.pending.keys()]).toEqual([0,1,2,3,4,5,6,7,8]);
 expect(s.pending.get(0)?.deadline).toBe(165000);
 s.advance(195000);s.advance(200000);s.advance(215000);s.advance(230000);
 expect(s.period).toBe('actions');expect(s.pending.get(0)?.request.kind).toBe('night');
 expect(s.pending.get(0)?.deadline).toBe(245000);
});
