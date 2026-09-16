import { expect,it } from 'vitest';
import { HumanSession } from '../../src/game/runtime/human-session.js';
import { GameConfig,episodeBudgetSeconds } from '../../src/shared/config.js';
import { scriptedAction } from '../../src/player/scripted.js';
import { project } from '../../src/shared/presentation/project.js';
import { exportReplay } from '../../src/shared/replay.js';
const config=()=>GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`})),mode:'human',humanSlot:1,setup:'A2',seed:'000102030405060708090a0b0c0d0e0f'});
it('keeps public phases fixed while policies get shorter deadlines',()=>{
 const c=config(),s=new HumanSession(c,'episode');s.start(0);
 expect(episodeBudgetSeconds(c)).toBe(2300);
 expect(s.snapshot(1,0).remainingMs).toBe(150000);
 expect(s.observation(5,0)?.remainingMs).toBe(13000);
 expect(s.snapshot(1,0).revealedRoles).toEqual([]);
 s.advance(150000);expect(s.phase).toBe('vote');
 expect(s.observation(1,150000)?.remainingMs).toBe(45000);
 expect(s.observation(0,150000)?.remainingMs).toBe(15000);
 const o=s.observation(1,150001)!;
 expect(s.receive(1,JSON.stringify(scriptedAction(o)),150001).status).toBe('accepted');
 s.disconnect(1);expect(s.snapshot(1,151000).accepted).not.toBeNull();
 s.advance(194999);expect(s.phase).toBe('vote');
 s.advance(195000);expect(s.snapshot(1,195000).period).toBe('dusk');
 expect(s.pending.size).toBe(0);expect(s.snapshot(1,195000).chatEnabled).toBe(false);
 s.advance(199999);expect(s.snapshot(1,199999).period).toBe('dusk');
 s.advance(200000);expect(s.snapshot(1,200000).period).toBe('coordination');
 expect(s.snapshot(1,200000).remainingMs).toBe(30000);
 s.advance(230000);expect(s.snapshot(1,230000).period).toBe('actions');
 expect(s.observation(1,230000)?.remainingMs).toBe(45000);
 s.advance(275000);expect(s.snapshot(1,275000).period).toBe('dawn');expect(s.pending.size).toBe(0);
 s.advance(280000);expect(s.state.day).toBe(2);expect(s.snapshot(1,280000).remainingMs).toBe(150000);
});
it('isolates team chat and rejects duplicate, stale, dead and unauthorized messages',()=>{
 const s=new HumanSession(config(),'episode');s.start(0);
 const packet={protocol:'wcw.human/1',type:'chat',episodeId:'episode',id:'chat_1',phaseKey:'1:discussion',channel:'wolves',text:'Secret accusation plan'};
 expect(s.chat(1,JSON.stringify(packet),1).status).toBe('accepted');
 expect(s.chat(1,JSON.stringify(packet),2).status).toBe('duplicate');
 expect(s.journal.filter(e=>e.payload.kind==='wolf_chat')).toHaveLength(1);
 expect(JSON.stringify(project(s.journal,0))).not.toContain(packet.text);
 expect(JSON.stringify(project(s.journal,5))).toContain(packet.text);
 expect(s.chat(0,JSON.stringify({...packet,id:'chat_2'}),3000).status).toBe('rejected');
 expect(s.chat(1,JSON.stringify({...packet,id:'chat_2',phaseKey:'0:discussion'}),3000).status).toBe('rejected');
 s.state.seats[1]!.alive=false;
 expect(s.chat(1,JSON.stringify({...packet,id:'chat_2'}),3000).status).toBe('rejected');
});
it('expires old actions, preserves disconnected human windows and exports complete replay',()=>{
 const s=new HumanSession(config(),'episode');s.start(0);s.advance(150000);
 const o=s.observation(1,150000)!;s.disconnect(1);
 expect(s.pending.get(1)?.outcome).toBeNull();
 expect(s.receive(1,JSON.stringify(scriptedAction(o)),195000).status).toBe('expired');
 s.advance(8*280000);
 expect(s.state.result?.outcome).toBe('draw');
 expect(s.snapshot(1,8*280000).revealedRoles).toHaveLength(9);
 expect(exportReplay(s.episodeId,8,s.journal,s.state.result!).complete).toBe(true);
 expect(JSON.stringify(s.snapshot(1,8*280000))).not.toMatch(/"seed"|"kind":"roles"|t0/);
});
it('runs scripted decisions with a fractional monotonic clock through transitions and game over',()=>{
 const s=new HumanSession(config(),'episode');let now=173.1234567;s.start(now);
 for(let turns=0;turns<200&&!s.state.result;turns++){
  for(const slot of s.pending.keys()){const o=s.observation(slot,now)!;expect(o.remainingMs).toBeLessThanOrEqual(45000);s.receive(slot,JSON.stringify(scriptedAction(o)),now+1);}
  now=s.deadline;s.advance(now);
 }
 expect(s.state.result).not.toBeNull();expect(s.snapshot(1,now).revealedRoles).toHaveLength(9);
 expect(s.journal.filter(e=>e.payload.kind==='finished')).toHaveLength(1);
});

it('hosts twelve public turns and routes new human chat to the next named speaker',()=>{
 const s=new HumanSession(config(),'episode');s.start(0);
 const bids=()=>[...s.pending.values()].filter(p=>p.request.kind==='bid');
 expect(bids()).toHaveLength(1);
 expect([...s.pending.values()].some(p=>p.request.kind==='wolf_chat')).toBe(true);
 const first=bids()[0]!.slot;
 s.receive(first,JSON.stringify(scriptedAction(s.observation(first,0)!)),1);
 expect(s.chat(1,JSON.stringify({protocol:'wcw.human/1',type:'chat',episodeId:'episode',id:'chat_reply',phaseKey:'1:discussion',channel:'town',text:'Seat 3, who do you suspect?'}),2000).status).toBe('accepted');
 const message=project(s.journal,'public').find(e=>e.payload.kind==='speech'&&e.payload.speech.slot===1)!;
 s.advance(12999);expect(s.journal.filter(e=>e.payload.kind==='speech')).toHaveLength(1);
 s.advance(13000);expect(bids()[0]!.slot).toBe(3);
 expect(bids()[0]!.request).toMatchObject({host:{reason:'human_reply',replyTo:message.id}});
 expect(JSON.stringify(s.observation(3,13000))).toContain('who do you suspect?');
 for(let turn=1;turn<12;turn++){
  expect(bids()).toHaveLength(1);
  const slot=bids()[0]!.slot;
  s.receive(slot,JSON.stringify(scriptedAction(s.observation(slot,turn*13000)!)),turn*13000+1);
  s.advance(Math.min(150000,(turn+1)*13000));
 }
 const speeches=s.journal.filter(e=>e.payload.kind==='speech'&&e.payload.speech.slot!==1);
 expect(speeches).toHaveLength(12);
 expect(speeches[1]!.payload).toMatchObject({speech:{slot:3,replyTo:message.id}});
 expect(s.phase).toBe('vote');
});
it('rotates after timeouts without using private human chat to choose the public speaker',()=>{
 const s=new HumanSession(config(),'episode');s.start(0);
 const first=s.snapshot(1,0).floor!.slot;
 s.chat(1,JSON.stringify({protocol:'wcw.human/1',type:'chat',episodeId:'episode',id:'private_message',phaseKey:'1:discussion',channel:'wolves',text:'Seat 3, coordinate privately'}),1);
 s.advance(13000);
 expect(s.snapshot(1,13000).floor!.slot).not.toBe(first);
 expect(s.snapshot(1,13000).floor!.replyingToHuman).toBe(false);
 expect(s.snapshot(1,13000).remainingMs).toBe(137000);
});
it('hides fixed NewD3 selection and provides only authorized confirmed teammates',()=>{
 for(const setup of ['A2','A3'] as const){
  const s=new HumanSession({...config(),setup},'episode');s.start(0);
  for(const seat of s.state.seats){
   const snap=s.snapshot(seat.slot,0);
   expect(snap.self?.role).toBe(seat.role);
   expect(snap.gameSetup.name).toBe('NewD3');
   expect(snap.gameSetup.decks).toHaveLength(9);
   expect(snap.gameSetup.decks[0]!.roles).toHaveLength(9);
   const expected=s.state.seats.filter(p=>seat.faction==='wolf'?p.faction==='wolf':seat.role==='noble'?p.role==='noble':false).map(p=>p.slot);
   expect(snap.teammates.map(t=>t.slot)).toEqual(expected);
  }
 }
});
it('lists all candidate setups without exposing the random draw or assignments',()=>{
 const s=new HumanSession({...config(),setup:'random'},'episode');s.start(0);
 const guide=s.snapshot(1,0).gameSetup;
 expect(guide.name).toBe('NewD3');expect(guide.decks).toHaveLength(9);
 expect(JSON.stringify(guide)).not.toMatch(/"slot"|"seed"/);
});

it('exposes identical setup guides for every fixed and random NewD3 choice',()=>{
 const guides=['A1','A2','A3','B1','B2','B3','C1','C2','C3','random'].map(setup=>new HumanSession(GameConfig.parse({...config(),setup}),'episode').snapshot(1,0).gameSetup);
 for(const guide of guides)expect(guide).toEqual(guides[0]);
});
