import { expect,it } from 'vitest';
import { Session } from '../../src/game/runtime/session.js';
import { GameConfig } from '../../src/shared/config.js';
import { project } from '../../src/shared/presentation/project.js';
const config=()=>GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`token-${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`})),seed:'000102030405060708090a0b0c0d0e0f',maxDays:2,windowMs:100});
it('finishes two full no-response cycles with fixed windows and a legal draw',()=>{
 const session=new Session(config(),'episode');session.start(0);
 expect(session.phase).toBe('day');expect(session.pending.size).toBe(1);
 session.advance(99);expect(session.window).toBe(0);
 session.advance(100);expect(session.window).toBe(1);
 for(let now=200;now<=5200;now+=100)session.advance(now);
 expect(session.state.result).toMatchObject({outcome:'draw',daysCompleted:2,scores:Array(9).fill(0)});
 expect(session.journal.filter(e=>e.payload.kind==='bid')).toHaveLength(108);
 expect(session.journal.filter(e=>e.payload.kind==='finished')).toHaveLength(1);
 const before=JSON.stringify(session.journal);session.advance(99999);expect(JSON.stringify(session.journal)).toBe(before);
 expect(JSON.stringify(project(session.journal,'public'))).not.toMatch(/token-|"seed"|"roles"|"failure"|"night_choices"/);
});
it('does not close early after every answer is accepted',()=>{
 const session=new Session(config(),'episode');session.start(0);session.advance(600);
 for(const [slot,p] of session.pending){
  const o=session.observation(slot,601)!;
  session.receive(slot,JSON.stringify({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:p.requestId,observationId:p.observationId,body:{kind:'bid',wantsToSpeak:false,urgency:0,text:'',replyTo:null,accusation:null,reason:''},report:null}),601);
 }
 session.advance(699);expect(session.window).toBe(0);expect(session.journal.some(e=>e.payload.kind==='bid')).toBe(false);
 session.advance(700);expect(session.window).toBe(1);
});
it('produces identical evidence for reverse response order',()=>{
 function run(reverse:boolean){
  const session=new Session(config(),'episode');session.start(0);session.advance(600);
  const slots=[...session.pending.keys()];if(reverse)slots.reverse();
  for(const slot of slots){const o=session.observation(slot,601)!;session.receive(slot,JSON.stringify({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body:{kind:'bid',wantsToSpeak:true,urgency:1,text:`Hello from ${slot}`,replyTo:null,accusation:null,reason:''},report:null}),601);}
  session.advance(700);return session.journal;
 }
 expect(run(true)).toEqual(run(false));
});
