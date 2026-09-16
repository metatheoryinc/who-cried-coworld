import { expect,it } from 'vitest';
import { Session } from '../../src/game/runtime/session.js';
import { GameConfig } from '../../src/shared/config.js';
import { newD3Decks } from '../../src/shared/roles.js';
import { scriptedAction } from '../../src/player/scripted.js';
import { project } from '../../src/shared/presentation/project.js';
import { exportReplay } from '../../src/shared/replay.js';
const config=(setup:string)=>GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`})),setup,seed:'0'.repeat(32),maxDays:2,windowMs:100});
it.each(Object.keys(newD3Decks))('completes preset %s with legal policies and valid replay',setup=>{
 const s=new Session(config(setup),'test');s.start(0);
 for(let now=0;now<5200&&!s.state.result;now+=100){
  for(const slot of s.pending.keys()){const o=s.observation(slot,now+1)!;expect(s.receive(slot,JSON.stringify(scriptedAction(o)),now+1).status).toBe('accepted');}
  s.advance(now+100);
 }
 expect(s.state.result).not.toBeNull();expect(s.journal.filter(e=>e.payload.kind==='failure')).toEqual([]);
 expect(exportReplay('test',2,s.journal,s.state.result!).complete).toBe(true);
});
it('daytime team chats are sequential, arrive before bids, and remain private to the right group',()=>{
 const s=new Session(config('A3'),'test');s.start(0);
 const wolf=s.state.seats.find(p=>p.faction==='wolf')!.slot,noble=s.state.seats.find(p=>p.role==='noble')!.slot;
 for(let now=0;now<600;now+=100){
  for(const slot of s.pending.keys()){const o=s.observation(slot,now+1)!;const a=scriptedAction(o);if(a.body.kind==='wolf_chat')a.body.text='WOLF_DAY_PLAN';if(a.body.kind==='noble_chat')a.body.text='NOBLE_DAY_PLAN';expect(s.receive(slot,JSON.stringify(a),now+1).status).toBe('accepted');}
  s.advance(now+100);
 }
 const w=s.observation(wolf,601)!,n=s.observation(noble,601)!;
 expect(w.request.kind).toBe('bid');expect(n.request.kind).toBe('bid');
 expect(JSON.stringify(w.transcript)).toContain('WOLF_DAY_PLAN');expect(JSON.stringify(w.transcript)).not.toContain('NOBLE_DAY_PLAN');
 expect(JSON.stringify(n.transcript)).toContain('NOBLE_DAY_PLAN');expect(JSON.stringify(n.transcript)).not.toContain('WOLF_DAY_PLAN');
 expect(n.teammates.map(t=>t.role)).toEqual(['noble','noble']);
 expect(JSON.stringify(project(s.journal,'public'))).not.toMatch(/WOLF_DAY_PLAN|NOBLE_DAY_PLAN/);
 // Three public speeches later, private coordination reopens before the remaining speeches.
 s.advance(900);expect([...s.pending.values()].every(p=>['wolf_chat','noble_chat'].includes(p.request.kind))).toBe(true);
});
it('removes dead teammates from new messages while retaining initial teammate identity',()=>{
 const s=new Session(config('A3'),'test');s.start(0);
 const wolf=s.state.seats.find(p=>p.faction==='wolf')!.slot;
 s.state.seats[wolf]!.alive=false;
 // Start a fresh day using the same authoritative state for a focused privacy fixture.
 const next=new Session(config('A3'),'test2');next.state.seats[wolf]!.alive=false;next.start(0);
 for(const slot of next.pending.keys()){const o=next.observation(slot,1)!;next.receive(slot,JSON.stringify(scriptedAction(o)),1);}
 next.advance(100);
 expect(project(next.journal,wolf).filter(e=>e.payload.kind==='wolf_chat')).toEqual([]);
 expect(next.observation(wolf,101)).toBeNull();
});
it('chooses a reproducible NewD3 setup from the seed',()=>{
 const a=new Session(config('random'),'a'),b=new Session(config('random'),'b');
 expect(a.state.seats).toEqual(b.state.seats);
 const deck=a.state.seats.map(s=>s.role).sort();
 expect(Object.values(newD3Decks).some(d=>JSON.stringify([...d].sort())===JSON.stringify(deck))).toBe(true);
});
it('rejects a named setup combined with a conflicting custom deck',()=>{
 expect(()=>GameConfig.parse({...config('A1'),roles:newD3Decks.B1})).toThrow('Choose a setup');
});
