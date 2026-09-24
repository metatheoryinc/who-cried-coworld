import {describe,expect,it} from 'vitest';
import {scoreEpisode,type ScoringInput} from '../../src/game/domain/scoring.js';
// Seats 0,1 are wolves; 2..8 town. One day, everyone alive at the vote.
const living=[0,1,2,3,4,5,6,7,8];
const base=(over:Partial<ScoringInput>={}):ScoringInput=>({
 factions:['wolf','wolf','town','town','town','town','town','town','town'],winners:[2,3,4,5,6,7,8],daysCompleted:1,deathDay:Array(9).fill(null),
 votes:[],reports:[],asked:[2,3,4,5,6,7,8].map(slot=>({day:1,slot,living,livingWolves:2})),requests:Array(9).fill(4),fallbacks:Array(9).fill(0),...over});
const perfect=(slot:number)=>Object.fromEntries(living.filter(s=>s!==slot).map(s=>[s,s<2?1:0]));
const chance=(slot:number)=>Object.fromEntries(living.filter(s=>s!==slot).map(s=>[s,2/8]));
describe('read (Town bonus)',()=>{
 it('is 1 for a perfect report, 0 for the know-nothing report or no report',()=>{
  const r=scoreEpisode(base({reports:[{day:1,slot:2,probs:perfect(2)},{day:1,slot:3,probs:chance(3)}]}));
  expect(r.metrics[2]!.read).toBe(1);expect(r.metrics[3]!.read).toBe(0);expect(r.metrics[4]!.read).toBe(0);
 });
 it('clamps worse-than-chance reports to 0 and omits read for wolves',()=>{
  const wrong=Object.fromEntries(living.filter(s=>s!==2).map(s=>[s,s<2?0:1]));
  const r=scoreEpisode(base({reports:[{day:1,slot:2,probs:wrong}]}));
  expect(r.metrics[2]!.read).toBe(0);expect(r.metrics[0]).not.toHaveProperty('read');
 });
});
describe('hidden (Wolf bonus)',()=>{
 it('is 1 when Town never suspects the wolf and 0 at chance or without reports',()=>{
  const clear=(slot:number)=>Object.fromEntries(living.filter(s=>s!==slot).map(s=>[s,s===0?0:s===1?2/8:2/8]));
  expect(scoreEpisode(base({reports:[{day:1,slot:2,probs:clear(2)},{day:1,slot:3,probs:clear(3)}]})).metrics[0]!.hidden).toBe(1);
  expect(scoreEpisode(base({reports:[{day:1,slot:2,probs:chance(2)}]})).metrics[1]!.hidden).toBe(0);
  expect(scoreEpisode(base()).metrics[0]!.hidden).toBe(0);
  expect(scoreEpisode(base()).metrics[2]).not.toHaveProperty('hidden');
 });
});
describe('headline and columns',()=>{
 it('weights win 0.75 and bonus 0.25, and keeps bonuses on a draw',()=>{
  const r=scoreEpisode(base({reports:[{day:1,slot:2,probs:perfect(2)}]}));
  expect(r.scores[2]).toBe(1);expect(r.scores[3]).toBe(0.75);expect(r.scores[0]).toBe(0);
  const draw=scoreEpisode(base({winners:[],reports:[{day:1,slot:2,probs:perfect(2)}]}));
  expect(draw.scores[2]).toBe(0.25);expect(draw.metrics[2]!.win).toBe(0);
 });
 it('normalizes vote hits against chance and omits it without non-skip votes',()=>{
  const r=scoreEpisode(base({votes:[{day:1,slot:2,target:0,living,livingWolves:2},{day:1,slot:3,target:4,living,livingWolves:2},{day:1,slot:4,target:null,living,livingWolves:2}]}));
  expect(r.metrics[2]!.vote_hit).toBe(1);expect(r.metrics[3]!.vote_hit).toBe(0);expect(r.metrics[4]).not.toHaveProperty('vote_hit');
 });
 it('reports survival and valid actions',()=>{
  const r=scoreEpisode(base({daysCompleted:4,deathDay:[null,3,...Array(7).fill(null)],requests:[4,4,0,4,4,4,4,4,4],fallbacks:[1,0,0,0,0,0,0,0,0]}));
  expect(r.metrics[1]!.survived).toBe(0.5);expect(r.metrics[0]!.survived).toBe(1);
  expect(r.metrics[0]!.valid_actions).toBe(0.75);expect(r.metrics[2]).not.toHaveProperty('valid_actions');
 });
});
