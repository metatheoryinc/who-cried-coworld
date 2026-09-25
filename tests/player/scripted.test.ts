import { expect,it } from 'vitest';
import { scriptedAction } from '../../src/player/scripted.js';
import { Session } from '../../src/game/runtime/session.js';
import { GameConfig } from '../../src/shared/config.js';
const config=GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`})),seed:'000102030405060708090a0b0c0d0e0f',windowMs:100});
it('plays a complete legal deterministic game with no fallback',()=>{
 function run(){
  const s=new Session(config,'e');s.start(0);
  for(let now=0;!s.state.result&&now<20800;now+=100){
   for(const slot of s.pending.keys()){
    const o=s.observation(slot,now+1)!;
    expect(s.receive(slot,JSON.stringify(scriptedAction(o)),now+1).status).toBe('accepted');
   }
   s.advance(now+100);
  }
  expect(s.state.result).not.toBeNull();expect(s.journal.filter(e=>e.payload.kind==='failure')).toEqual([]);
  expect(s.journal.some(e=>e.payload.kind==='speech')).toBe(true);
  expect(s.journal.some(e=>e.payload.kind==='night_choices')).toBe(true);
  return s.journal;
 }
 expect(run()).toEqual(run());
});

it('votes for a random living player other than itself and uses random legal night targets',()=>{
 const s=new Session(config,'e');s.start(0);
 const targets=new Set<number>();let now=0;
 for(;!s.state.result&&now<20800;now+=100){
  for(const slot of s.pending.keys()){
   const o=s.observation(slot,now+1)!,a=scriptedAction(o);
   if(a.body.kind==='vote'){expect(a.body.target).not.toBeNull();expect(a.body.target).not.toBe(slot);targets.add(a.body.target!);}
   if(a.body.kind==='night'&&o.request.kind==='night')for(const [i,act] of a.body.actions.entries()){const c=o.request.choices[i]!;if(c.targets.length)expect(c.targets).toContain(act.target);}
   s.receive(slot,JSON.stringify(a),now+1);
  }
  s.advance(now+100);
 }
 // Nine baselines no longer all vote the same first seat.
 expect(targets.size).toBeGreaterThan(2);
});
it('acts on an observation that carries fields it does not know',async()=>{
 const {actOnLooseObservation}=await import('../../src/player/scripted.js');
 const s=new Session(config,'e');s.start(0);const slot=[...s.pending.keys()][0]!;
 const o={...s.observation(slot,1)!,futureField:{anything:true}};
 const a=actOnLooseObservation(JSON.stringify(o));
 expect(a?.requestId).toBe(o.requestId);
 expect(s.receive(slot,JSON.stringify(a),2).status).toBe('accepted');
 expect(actOnLooseObservation('{"type":"end"}')).toBeNull();
});
