import { expect,it } from 'vitest';
import { Session } from '../../src/game/runtime/session.js';
import { GameConfig } from '../../src/shared/config.js';
import { Replay,exportReplay } from '../../src/shared/replay.js';
const config=GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`secret-${i}`),players:Array.from({length:9},()=>({name:'Player'})),seed:'0'.repeat(32),maxDays:1,windowMs:100});
const finished=()=>{const s=new Session(config,'e');s.start(0);s.advance(2600);return s;};
it('exports only complete validated evidence with no auth or internal metadata',()=>{
 const s=finished(),r=exportReplay(s.episodeId,s.config.maxDays,s.journal,s.state.result!);
 expect(Replay.safeParse(r).success).toBe(true);
 expect(r.events.some(e=>e.payload.kind==='roles')).toBe(true);
 expect(r.events.some(e=>e.payload.kind==='seed')).toBe(true);
 expect(JSON.stringify(r)).not.toMatch(/secret-|"audience"|"seq"|"tokens"/);
 expect(r.events.map(e=>e.cursor)).toEqual(r.events.map((_,i)=>i+1));
});
it('refuses incomplete, inconsistent and structurally corrupted replays',()=>{
 const s=finished(),r=exportReplay('e',1,s.journal,s.state.result!);
 expect(()=>exportReplay('e',1,s.journal.slice(0,-1),s.state.result!)).toThrow();
 expect(Replay.safeParse({...r,events:r.events.slice(1)}).success).toBe(false);
 expect(Replay.safeParse({...r,events:[...r.events,r.events.at(-1)]}).success).toBe(false);
 expect(Replay.safeParse({...r,result:{...r.result,daysCompleted:0}}).success).toBe(false);
 expect(Replay.safeParse({...r,events:r.events.map((e,i)=>i===0?{...e,cursor:5}:e)}).success).toBe(false);
});
