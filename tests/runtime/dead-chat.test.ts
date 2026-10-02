import {expect,it} from 'vitest';
import {GameConfig} from '../../src/shared/config.js';
import {HumanSession} from '../../src/game/runtime/human-session.js';
import {project} from '../../src/shared/presentation/project.js';
import type {GhostHost} from '../../src/game/domain/moderator.js';
const config=()=>GameConfig.parse({mode:'human',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`})),setup:'A2',seed:'000102030405060708090a0b0c0d0e0f'});
/** Human at 0; seats in `dead` are eliminated by vote before anyone talks. */
const game=(dead:number[],humans=[0])=>{
 const s=new HumanSession(config(),'episode');for(const h of humans)s.registerHuman(h);s.start(0);
 for(const slot of dead){const seat=s.state.seats[slot]!;seat.alive=false;(s as unknown as {emit:(p:unknown)=>void}).emit({kind:'elimination',slot,cause:'vote',role:seat.role,faction:seat.faction});}
 return s;
};
let n=0;
const chat=(s:HumanSession,channel:string,text:string)=>JSON.stringify({protocol:'wcw.human/1',type:'chat',episodeId:'episode',id:`c${++n}`,phaseKey:`${s.state.day}:${s.period}`,channel,text});
const reply=(s:HumanSession,slot:number,text:string)=>{const o=s.observation(slot,1000)!;return JSON.stringify({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body:{kind:'dead_chat',text,summary:''},report:null});};
const graveyard=(s:HumanSession,slot:number|'replay')=>project(s.journal,slot).filter(e=>e.payload.kind==='dead_chat').map(e=>e.payload.kind==='dead_chat'?`${e.payload.slot}:${e.payload.text}`:'');
const ghostSlots=(s:HumanSession)=>[...s.ghosts.keys()];

it('asks the dead AI the human named, and only the dead can read the answer',()=>{
 const s=game([0,3,4]);
 expect(s.chat(0,chat(s,'graveyard','Seat 4, why did you vote for me?'),100).status).toBe('accepted');
 expect(ghostSlots(s)).toEqual([4]);
 const o=s.observation(4,1000)!;
 expect(o.self.alive).toBe(false);
 expect(o.request).toEqual({kind:'dead_chat',maxCharacters:240});
 expect(JSON.stringify(o.transcript)).toContain('why did you vote for me');
 expect(s.receive(4,reply(s,4,'Your speech was shaky. Sorry!'),1000).status).toBe('accepted');
 expect(ghostSlots(s)).toEqual([]);
 for(const dead of [0,3,4])expect(graveyard(s,dead)).toEqual(['0:Seat 4, why did you vote for me?','4:Your speech was shaky. Sorry!']);
 for(const living of [1,2,5,6,7,8])expect(graveyard(s,living)).toEqual([]);
 expect(graveyard(s,'replay')).toHaveLength(2);
 expect(JSON.stringify(s.snapshot(1,1000))).not.toContain('shaky');
});

it('keeps the dead and the living apart',()=>{
 const s=game([0,3],[0,1]);
 expect(s.chat(1,chat(s,'graveyard','can I listen in?'),100).status).toBe('rejected');
 expect(s.chat(0,chat(s,'town','I was innocent!'),200).status).toBe('rejected');
 expect(project(s.journal,1).some(e=>e.payload.kind==='speech')).toBe(false);
});

it('lets the dead talk in every phase',()=>{
 const s=game([0,3]);
 s.advance(150000);expect(s.period).toBe('vote');
 expect(s.chat(0,chat(s,'graveyard','still here'),150001).status).toBe('accepted');
});

it('asks nobody when no AI is dead, and nothing happens until a dead human types',()=>{
 const lonely=game([0]);
 expect(lonely.chat(0,chat(lonely,'graveyard','hello?'),100).status).toBe('accepted');
 expect(ghostSlots(lonely)).toEqual([]);
 const quiet=game([0,3,4]);
 for(const t of [150000,200000,230000,260000,265000])quiet.advance(t);
 expect(ghostSlots(quiet)).toEqual([]);
});

it('without a host, picks a dead AI at random, reproducibly',()=>{
 const pick=()=>{const s=game([0,3,4,6]);s.chat(0,chat(s,'graveyard','who did this to me'),100);return ghostSlots(s);};
 const first=pick();
 expect(first).toHaveLength(1);
 expect([3,4,6]).toContain(first[0]);
 expect(pick()).toEqual(first);
});

it('holds one reply at a time and at most six per phase',()=>{
 const s=game([0,3]);
 s.chat(0,chat(s,'graveyard','Seat 3?'),100);
 s.chat(0,chat(s,'graveyard','Seat 3??'),3000);
 expect(ghostSlots(s)).toEqual([3]);
 let asked=1;
 for(let i=0;i<10;i++){
  if(ghostSlots(s).length)s.receive(3,reply(s,3,`answer ${i}`),5000+i*3000);
  s.chat(0,chat(s,'graveyard',`Seat 3 again ${i}`),6000+i*3000);
  if(ghostSlots(s).length)asked++;
 }
 expect(asked).toBe(6);
});

it('drops an unanswered or refused Graveyard request without a trace in scores',()=>{
 const s=game([0,3]);
 s.chat(0,chat(s,'graveyard','Seat 3, speak!'),100);
 const before=s.journal.length;
 s.advance(15100);
 expect(ghostSlots(s)).toEqual([]);
 expect(s.journal.slice(before).some(e=>(e.payload.kind==='failure'||e.payload.kind==='confessional')&&e.payload.slot===3)).toBe(false);
});

it('uses the LLM host to pick who answers, and falls back to random on a bad pick',async()=>{
 const good:GhostHost=async input=>{expect(input.candidates.map(c=>c.slot)).toEqual([3,4]);return {slot:4};};
 const s=game([0,3,4]);s.ghostHost=good;
 s.chat(0,chat(s,'graveyard','so who was the wolf?'),100);
 await new Promise(r=>setTimeout(r,0));
 expect(ghostSlots(s)).toEqual([4]);
 const bad=game([0,3,4]);bad.ghostHost=async()=>({slot:1});
 bad.chat(0,chat(bad,'graveyard','anyone?'),100);
 await new Promise(r=>setTimeout(r,0));
 expect(ghostSlots(bad)).toHaveLength(1);
 expect([3,4]).toContain(ghostSlots(bad)[0]);
});

it("gives dead humans the Graveyard tab and the ghost's view",()=>{
 const s=game([0,3],[0,1]);
 const dead=s.snapshot(0,100),living=s.snapshot(1,100);
 expect(dead.channels).toContain('graveyard');
 expect(dead.chatEnabled).toBe(true);
 expect(dead.revealedRoles).toHaveLength(9);
 expect(living.channels).not.toContain('graveyard');
 expect(living.revealedRoles).toEqual([]);
});
