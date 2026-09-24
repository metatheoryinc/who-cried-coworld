import {expect,it} from 'vitest';
import {GameConfig} from '../../src/shared/config.js';
import {HumanSession} from '../../src/game/runtime/human-session.js';
import {playerSystemPrompt} from '../../src/player/prompt.js';
import type {Observation} from '../../src/shared/player.js';
// Setup A3 with this seed: Wolf 1, Alchemist 5, Nobles 4 and 7.
const session=()=>{const s=new HumanSession(GameConfig.parse({mode:'human',setup:'A3',seed:'000102030405060708090a0b0c0d0e0f',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:['Ann','Bo','Cy','Di','Eve','Fay','Gus','Hal','Ivy'][i]!}))}),'e');s.start(0);s.advance(150000);return s;};
const as=(slot:number,request:Observation['request'])=>({...session().observation(slot,150000)!,request}) as Observation;
const nobleChat=as(7,{kind:'noble_chat',turn:0,maxCharacters:480});

it('tells a Noble who its fellow Nobles are and that they are confirmed town',()=>{
 const prompt=playerSystemPrompt(nobleChat,'');
 expect(prompt).toContain('Your fellow Noble: Eve');
 expect(prompt).toMatch(/Eve is confirmed town/);
 expect(prompt).not.toContain("Other players' roles and alignments are unknown unless");
});
it('explains that Noble chat is private to the Nobles and should answer them, not the table',()=>{
 const prompt=playerSystemPrompt(nobleChat,'');
 expect(prompt).toMatch(/Only Eve can read/);
 expect(prompt).toMatch(/Do not address, accuse, or banter with anyone else/);
 expect(prompt).toMatch(/kind "noble_chat"/);
});
it('keeps Noble knowledge in public turns without leaking the private channel framing',()=>{
 const prompt=playerSystemPrompt(as(7,{kind:'vote',targets:[0,1,2],allowPass:true}),'');
 expect(prompt).toContain('Your fellow Noble: Eve');
 expect(prompt).not.toMatch(/Only Eve can read/);
});
it('still gives Wolves their team and private-chat framing',()=>{
 const prompt=playerSystemPrompt(as(1,{kind:'wolf_chat',turn:0,maxCharacters:480}),'');
 expect(prompt).toContain('Your mafia team: Bo, Fay');
 expect(prompt).toMatch(/kind "wolf_chat"/);
});
