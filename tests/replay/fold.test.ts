import { expect,it } from 'vitest';
import { foldEvents } from '../../src/shared/presentation/fold.js';
import { Session } from '../../src/game/runtime/session.js';
import { GameConfig } from '../../src/shared/config.js';
import { scriptedAction } from '../../src/player/scripted.js';
import { project } from '../../src/shared/presentation/project.js';
it('folds the public replay identically to live delivery without revealing roles',()=>{
 const c=GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`})),seed:'0'.repeat(32),windowMs:100,maxDays:1});
 const s=new Session(c,'e');s.start(0);
 for(let t=0;!s.state.result;t+=100){for(const slot of s.pending.keys())s.receive(slot,JSON.stringify(scriptedAction(s.observation(slot,t+1)!)),t+1);s.advance(t+100);}
 const live=project(s.journal,'public'),replay=project(s.journal,'replay');
 expect(foldEvents(live)).toEqual(foldEvents(replay.filter(e=>e.reveal==='public')));
 expect(foldEvents(live).roles).toEqual({});
 expect(Object.keys(foldEvents(replay).roles)).toHaveLength(9);
 expect(foldEvents(replay).result).toEqual(s.state.result);
 expect(foldEvents(replay).messages.length).toBeGreaterThan(0);
});
