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
