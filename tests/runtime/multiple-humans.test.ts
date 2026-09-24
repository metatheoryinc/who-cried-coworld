import {expect,it,vi} from 'vitest';
import {GameConfig} from '../../src/shared/config.js';
import {HumanSession} from '../../src/game/runtime/human-session.js';
import {scriptedAction} from '../../src/player/scripted.js';
const config=()=>GameConfig.parse({mode:'human',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`})),setup:'A2',seed:'000102030405060708090a0b0c0d0e0f'});
const game=(slots:number[])=>{const s=new HumanSession(config(),'episode');for(const slot of slots)s.registerHuman(slot);return s;};
const chat=(channel:string,text:string)=>JSON.stringify({protocol:'wcw.human/1',type:'chat',episodeId:'episode',id:'same-id',phaseKey:'1:discussion',channel,text});
it('gives multiple humans independent chat IDs, private team channels, and vote deadlines',()=>{
 const s=game([0,1,5]);s.start(0);
 expect(s.chat(1,chat('wolves','private plan'),1).status).toBe('accepted');
 expect(s.chat(5,chat('wolves','agreed'),1).status).toBe('accepted');
 expect(s.chat(0,chat('wolves','intrusion'),1).status).toBe('rejected');
 expect(JSON.stringify(s.snapshot(0,1))).not.toContain('private plan');
 expect(JSON.stringify(s.snapshot(5,1))).toContain('private plan');
 expect(s.snapshot(0,1).self?.slot).toBe(0);
 expect([...s.pending.keys()].some(slot=>[0,1,5].includes(slot))).toBe(false);
 s.advance(150000);
 for(const slot of [0,1,5])expect(s.observation(slot,150000)?.remainingMs).toBe(45000);
 s.disconnect(1);expect(s.pending.get(1)?.outcome).toBeNull();
 const action=scriptedAction(s.observation(5,150000)!);
 expect(s.receive(5,JSON.stringify(action),150001).status).toBe('accepted');
 expect(s.snapshot(1,150001).accepted).toBeNull();
 s.advance(230000);
 for(const slot of [0,1,5])expect(s.observation(slot,230000)?.remainingMs).toBe(45000);
});
it('runs an all-human game without asking a model to select a human speaker',()=>{
 const s=game(Array.from({length:9},(_,i)=>i));
 s.moderator=vi.fn();s.start(0);expect(s.moderator).not.toHaveBeenCalled();
 expect(s.pending.size).toBe(0);s.advance(150000);expect(s.pending.size).toBe(9);
 s.advance(8*280000);expect(s.state.result?.outcome).toBe('draw');
});
it('prioritizes unanswered public messages from each human without losing another human’s turn',()=>{
 const s=game([0,1]);s.start(0);
 s.chat(0,chat('town','Seat 3, hello'),1);s.chat(1,chat('town','Seat 4, hello'),1);
 s.advance(13000);expect(s.snapshot(0,13000).floor?.slot).toBe(3);
 s.receive(3,JSON.stringify(scriptedAction(s.observation(3,13000)!)),13001);
 s.advance(26000);expect(s.snapshot(0,26000).floor?.slot).toBe(4);
});

it('accepts a late human during voting with the remaining phase time',()=>{
 const s=game([0]);s.start(0);s.advance(150000);
 expect(s.observation(5,150000)?.remainingMs).toBe(15000);
 s.registerHuman(5);s.disconnect(5);
 expect(s.observation(5,170000)?.remainingMs).toBe(25000);
 expect(s.receive(5,JSON.stringify(scriptedAction(s.observation(5,170000)!)),170001).status).toBe('accepted');
 expect(s.phaseDeadline).toBe(195000);
});
it('discards an in-flight moderator choice for a seat that has joined as human',async()=>{
 const s=game([0]);let finish!:(choice:{slot:number;prompt:string})=>void;
 s.moderator=()=>new Promise(resolve=>{finish=resolve;});s.start(0);await Promise.resolve();
 s.registerHuman(4);finish({slot:4,prompt:'Seat 4, what would you like to add?'});
 await vi.waitFor(()=>expect(s.pending.size).toBeGreaterThan(0));
 expect(s.pending.has(4)).toBe(false);
 expect(s.snapshot(0,0).floor?.prompt).toBeNull();
});
it('treats no seat as human until a browser joins',()=>{
 const s=new HumanSession(config(),'episode');
 expect([...s.humanSlots]).toEqual([]);
 s.registerName(0,'Policy');s.registerHuman(3);s.registerName(3,'Impostor');s.start(0);
 expect(s.config.players[0]!.name).toBe('Policy');expect(s.config.players[3]!.name).toBe('Seat 3');
});
