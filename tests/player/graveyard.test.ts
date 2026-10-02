import {expect,it} from 'vitest';
import {GameConfig} from '../../src/shared/config.js';
import {HumanSession} from '../../src/game/runtime/human-session.js';
import {playerSystemPrompt} from '../../src/player/prompt.js';
import {actionSchema,parseModelAction} from '../../src/player/llm.js';
import {scriptedAction} from '../../src/player/scripted.js';
import {speechReminder} from '../../src/player/policy.js';
// Setup A3 with this seed: Wolf 1 (Bo). Ann (0) is the human.
const ghost=()=>{
 const s=new HumanSession(GameConfig.parse({mode:'human',setup:'A3',seed:'000102030405060708090a0b0c0d0e0f',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:['Ann','Bo','Cy','Di','Eve','Fay','Gus','Hal','Ivy'][i]!}))}),'e');
 s.registerHuman(0);s.start(0);
 for(const slot of [0,1]){const seat=s.state.seats[slot]!;seat.alive=false;(s as unknown as {emit:(p:unknown)=>void}).emit({kind:'elimination',slot,cause:'vote',role:seat.role,faction:seat.faction});}
 s.chat(0,JSON.stringify({protocol:'wcw.human/1',type:'chat',episodeId:'e',id:'c1',phaseKey:'1:discussion',channel:'graveyard',text:'Bo, were you the wolf all along?'}),100);
 return s.observation(1,200)!;
};

it('tells a dead player it is a ghost answering in the Graveyard',()=>{
 const o=ghost(),prompt=playerSystemPrompt(o,'');
 expect(o.self.alive).toBe(false);
 expect(prompt).toMatch(/You are dead/);
 expect(prompt).toMatch(/Graveyard/);
 expect(prompt).toMatch(/only the dead/i);
 expect(prompt).not.toMatch(/Skipping the night kill/);
});
it('limits a Graveyard reply to 240 characters and reminds Claude to keep it short',()=>{
 const o=ghost();
 expect((actionSchema(o).properties as Record<string,{maxLength?:number}>).text!.maxLength).toBe(240);
 expect(speechReminder(o,'anthropic/claude-haiku-4.5')).toMatch(/200 characters/);
 const action=parseModelAction(JSON.stringify({kind:'dead_chat',text:'Guilty. You were too sharp for us.',summary:''}),o);
 expect(action.body).toEqual({kind:'dead_chat',text:'Guilty. You were too sharp for us.',summary:''});
});
it('keeps the baseline silent in the Graveyard',()=>{
 expect(scriptedAction(ghost()).body).toEqual({kind:'dead_chat',text:'',summary:''});
});
