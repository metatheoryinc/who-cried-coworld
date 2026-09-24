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

const withResults=(slot:number,privateResults:Observation['privateResults'])=>({...as(slot,{kind:'vote',targets:[0,1,2],allowPass:true}),privateResults}) as Observation;
it('turns a Dairy Maid visit into a plain confirmed-town statement',()=>{
 const prompt=playerSystemPrompt(withResults(2,[{day:1,ability:'inform',target:6,result:'town'}]),'');
 expect(prompt).toContain('Night 1: Gus (the Dairy Maid) visited you. Gus is confirmed town.');
 expect(prompt).toMatch(/Besides Gus, other players' roles and alignments are unknown/);
});
it('states Seer, Track Reader and Priest results in plain language',()=>{
 const prompt=playerSystemPrompt(withResults(2,[
  {day:1,ability:'inspect',target:1,result:'wolf'},{day:2,ability:'inspect',target:3,result:'not_wolf'},{day:3,ability:'inspect',target:0,result:'no_result'},
  {day:1,ability:'check',target:4,result:'noble'},{day:2,ability:'check',target:5,result:'vanilla'},
  {day:1,ability:'track',target:6,result:[0,3]},{day:2,ability:'track',target:6,result:[]},
 ]),'');
 for(const line of ['Night 1: you inspected Bo: WOLF.','Night 2: you inspected Di: not a wolf.','Night 3: your inspect was blocked, so you learned nothing.',
  'Night 1: you checked Eve: Noble.','Night 2: you checked Fay: vanilla (a Sheep or an ordinary Wolf).',
  'Night 1: you tracked Gus: they visited Ann and Di.','Night 2: you tracked Gus: they visited no one.'])expect(prompt).toContain(line);
 expect(prompt).toContain('Your private results (only you know these; treat them as hard evidence)');
});
it('adds nothing when there are no private results',()=>{
 expect(playerSystemPrompt(withResults(2,[]),'')).not.toContain('Your private results');
});
