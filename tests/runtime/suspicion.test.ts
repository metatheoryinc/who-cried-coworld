import {expect,it} from 'vitest';
import {GameConfig} from '../../src/shared/config.js';
import {HumanSession} from '../../src/game/runtime/human-session.js';
import {Event} from '../../src/shared/events.js';
// Setup A2 with this seed: Wolf 1, Alchemist 5, everyone else Town.
const game=()=>{const s=new HumanSession(GameConfig.parse({mode:'human',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`})),setup:'A2',seed:'000102030405060708090a0b0c0d0e0f'}),'episode');s.registerHuman(0);s.start(0);s.advance(150000);return s;};
const vote=(s:HumanSession,slot:number,body:Record<string,unknown>)=>{const o=s.observation(slot,150000)!;return s.receive(slot,JSON.stringify({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body:{kind:'vote',target:1,summary:'',...body},report:null}),150001);};
const others=[1,2,3,4,5,6,7,8];
const report=(p:(s:number)=>number)=>others.map(slot=>({slot,wolf:p(slot)}));
const suspicions=(s:HumanSession)=>s.journal.filter(e=>e.payload.kind==='suspicion');
it('invites suspicion reports from Town votes only',()=>{
 const s=game();
 expect(s.observation(0,150000)?.request).toMatchObject({kind:'vote',suspicion:true});
 expect(s.observation(1,150000)?.request).not.toHaveProperty('suspicion');
});
it('journals a valid report privately and keeps the vote',()=>{
 const s=game();
 expect(vote(s,0,{suspicion:report(x=>x===1?0.9:0.1)}).status).toBe('accepted');
 s.advance(195000);
 const e=suspicions(s);expect(e).toHaveLength(1);
 expect(e[0]).toMatchObject({audience:{kind:'server'},reveal:'beliefs',payload:{kind:'suspicion',slot:0}});
 expect(Event.safeParse(e[0]).success).toBe(true);
 expect(JSON.stringify(s.snapshot(0,195000))+JSON.stringify(s.observation(2,195000))).not.toContain('"suspicion"');
});
it.each([
 ['out of range',report(x=>x===1?1.5:0.1)],['missing a player',report(()=>0.2).slice(1)],['includes yourself',[...report(()=>0.2),{slot:0,wolf:0}]],['duplicate player',[...report(()=>0.2).slice(1),{slot:2,wolf:0.3}]],
])('drops a report that is %s but still counts the vote',(_,bad)=>{
 const s=game();expect(vote(s,0,{suspicion:bad}).status).toBe('accepted');s.advance(195000);
 expect(suspicions(s)).toHaveLength(0);
 const ballots=s.journal.find(e=>e.payload.kind==='ballots')!.payload;expect(ballots.kind==='ballots'&&ballots.ballots.find(b=>b.slot===0)?.target).toBe(1);
});
it('keeps suspicion events server-only in the event schema',()=>{
 const payload={kind:'suspicion',slot:0,reports:report(()=>0.25)};
 const wrap=(audience:unknown)=>({schema:'wcw.events/1',seq:1,day:1,phase:'vote',audience,reveal:'beliefs',payload});
 expect(Event.safeParse(wrap({kind:'server'})).success).toBe(true);
 expect(Event.safeParse(wrap({kind:'seats',slots:[0]})).success).toBe(false);
 expect(Event.safeParse(wrap({kind:'public'})).success).toBe(false);
});
