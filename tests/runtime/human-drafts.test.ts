import {expect,it} from 'vitest';
import {GameConfig} from '../../src/shared/config.js';
import {HumanSession} from '../../src/game/runtime/human-session.js';
const config=()=>GameConfig.parse({mode:'human',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`})),setup:'A2',seed:'000102030405060708090a0b0c0d0e0f'});
const game=(humans:number[])=>{const s=new HumanSession(config(),'episode');for(const slot of humans)s.registerHuman(slot);s.start(0);return s;};
const action=(s:HumanSession,slot:number,body:unknown,now:number)=>{const o=s.observation(slot,now)!;return JSON.stringify({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body,report:null});};
const vote=(target:number|null)=>({kind:'vote',target,summary:''});
const ballot=(s:HumanSession,slot:number)=>{const e=s.journal.find(e=>e.payload.kind==='ballots');return e?.payload.kind==='ballots'?e.payload.ballots.find(b=>b.slot===slot)?.target:undefined;};
const VOTE=150000,VOTE_END=195000;

it('lets a human replace a vote draft until the timer ends',()=>{
 const s=game([0]);s.advance(VOTE);
 expect(s.receive(0,action(s,0,vote(3),VOTE),VOTE+1).status).toBe('accepted');
 expect(s.receive(0,action(s,0,vote(5),VOTE),VOTE+2).status).toBe('accepted');
 expect(s.receive(0,action(s,0,vote(5),VOTE),VOTE+3).status).toBe('duplicate');
 expect(s.snapshot(0,VOTE+3).accepted).toMatchObject({kind:'vote',target:5});
 s.advance(VOTE_END);expect(ballot(s,0)).toBe(5);
});
it('keeps the previous draft when a revision is illegal or malformed, without closing the request',()=>{
 const s=game([0]);s.advance(VOTE);
 s.receive(0,action(s,0,vote(3),VOTE),VOTE+1);
 for(let i=0;i<3;i++){
  expect(s.receive(0,action(s,0,{kind:'night',actions:[],summary:''},VOTE),VOTE+2)).toMatchObject({status:'rejected',retry:false});
  expect(s.receive(0,'{not json',VOTE+2).status).toBe('rejected');
 }
 expect(s.pending.get(0)?.outcome).toBeNull();
 expect(s.receive(0,action(s,0,vote(4),VOTE),VOTE+3).status).toBe('accepted');
 s.advance(VOTE_END);expect(ballot(s,0)).toBe(4);
});
it('treats a cleared draft as a pass',()=>{
 const s=game([0]);s.advance(VOTE);
 s.receive(0,action(s,0,vote(3),VOTE),VOTE+1);s.receive(0,action(s,0,vote(null),VOTE),VOTE+2);
 s.advance(VOTE_END);expect(ballot(s,0)).toBeNull();
});
it('still locks a policy seat on its first valid answer',()=>{
 const s=game([0]);s.advance(VOTE);
 expect(s.receive(1,action(s,1,vote(3),VOTE),VOTE+1).status).toBe('accepted');
 expect(s.receive(1,action(s,1,vote(5),VOTE),VOTE+2)).toMatchObject({status:'rejected',code:'illegal'});
 s.advance(VOTE_END);expect(ballot(s,1)).toBe(3);
});
