import { describe, expect, it } from 'vitest';
import { createState, legalNightChoices, resolveDay, resolveNight, finishIfNeeded } from '../../src/game/domain/rules.js';
const seed='000102030405060708090a0b0c0d0e0f';
const setup=()=>{
 const s=createState(seed,8);
 const roles=['wolf','alchemist','seer','guard','sheep','sheep','sheep','sheep','sheep'] as const;
 s.seats.forEach((seat,i)=>{seat.role=roles[i]!;seat.faction=i<2?'wolf':'town';});
 return s;
};
const night=(overrides:Partial<Record<number,Array<{ability:string;target:number|null;killer?:number}>>>={})=>{
 const base=[{slot:0,actions:[{ability:'kill',target:null}]},{slot:1,actions:[{ability:'kill',target:null},{ability:'block',target:null}]},{slot:2,actions:[{ability:'inspect',target:null}]},{slot:3,actions:[{ability:'protect',target:null}]},...[4,5,6,7,8].map(slot=>({slot,actions:[]}))];
 return base.map(row=>({...row,actions:overrides[row.slot]??row.actions}));
};
describe('role menus',()=>{
 it('offers exact ordered powers with no self/friendly kill targets',()=>{
  const s=setup();
  expect(legalNightChoices(s,1)).toEqual([{ability:'kill',targets:[2,3,4,5,6,7,8],actors:[0,1],allowPass:true},{ability:'block',targets:[0,2,3,4,5,6,7,8],allowPass:true}]);
  expect(legalNightChoices(s,4)).toEqual([]);
  s.seats[3]!.alive=false;
  expect(legalNightChoices(s,3)).toEqual([]);
  expect(legalNightChoices(s,0)[0]!.targets).not.toContain(3);
 });
});
describe('majority vote',()=>{
 it('eliminates only at strict majority and publicly reveals the eliminated role',()=>{
  const s=setup(); const ev=resolveDay(s,s.seats.map((p,i)=>({slot:p.slot,target:i<5?4:null})));
  expect(s.seats[4]!.alive).toBe(false);
  expect(ev).toContainEqual({kind:'elimination',slot:4,cause:'vote',role:s.seats[4]!.role,faction:s.seats[4]!.faction});
  expect(ev[0]).toMatchObject({kind:'ballots',resolution:'majority',eliminated:4});
 });
 it.each([[[4,4,4,4,5,5,5,null,null],'no_majority'],[[4,4,4,4,5,5,5,5,null],'tie'],[Array(9).fill(null),'all_abstain']] as const)('classifies non-eliminating votes', (targets,resolution)=>{
  const s=setup();expect(resolveDay(s,targets.map((target,slot)=>({slot,target})))[0]).toMatchObject({resolution,eliminated:null});
  expect(s.seats.every(p=>p.alive)).toBe(true);
 });
 it('rejects duplicate voters or illegal targets without mutation',()=>{
  const s=setup(); const before=structuredClone(s);
  expect(()=>resolveDay(s,[{slot:0,target:4},{slot:0,target:5}])).toThrow();
  expect(()=>resolveDay(s,[{slot:0,target:10}])).toThrow(); expect(s).toEqual(before);
 });
});
describe('night ordering',()=>{
 it('resolves a seeded tied faction kill independently of response order',()=>{
  const a=setup(),b=setup();const rows=night({0:[{ability:'kill',target:4}],1:[{ability:'kill',target:5},{ability:'block',target:null}]});
  const ev=resolveNight(a,rows);expect(resolveNight(b,[...rows].reverse())).toEqual(ev);
  expect(a.seats[4]!.alive).toBe(false);expect(a).toEqual(b);
 });
 it('blocks the selected killer instead of redirecting the kill to another nomination',()=>{
  const s=setup();resolveNight(s,night({0:[{ability:'kill',target:4,killer:0}],1:[{ability:'kill',target:5,killer:0},{ability:'block',target:0}]}));
  expect(s.seats[4]!.alive).toBe(true);expect(s.seats[5]!.alive).toBe(true);
 });
 it('allows Alchemist to kill and block the same target',()=>{
  const s=setup();resolveNight(s,night({1:[{ability:'kill',target:4},{ability:'block',target:4}]}));expect(s.seats[4]!.alive).toBe(false);
 });
 it.each([false,true])('protection is suppressed only when Guard is blocked (%s)',blocked=>{
  const s=setup();const ev=resolveNight(s,night({0:[{ability:'kill',target:4}],1:[{ability:'kill',target:4,killer:0},{ability:'block',target:blocked?3:null}],3:[{ability:'protect',target:4}]}));
  expect(s.seats[4]!.alive).toBe(!blocked);
  expect(ev).toContainEqual({kind:'night_outcome',ability:'kill',actor:0,target:4,outcome:blocked?'applied':'protected'});
 });
 it('applies protection before Guard dies',()=>{
  const s=setup();const ev=resolveNight(s,night({0:[{ability:'kill',target:3}],3:[{ability:'protect',target:4}]}));
  expect(s.seats[3]!.alive).toBe(false);expect(ev).toContainEqual({kind:'night_outcome',ability:'protect',actor:3,target:4,outcome:'applied'});
 });
 it.each([[0,'wolf'],[1,'wolf'],[4,'not_wolf']] as const)('delivers alignment to Seer only', (target,result)=>{
  const s=setup();const ev=resolveNight(s,night({2:[{ability:'inspect',target}]}));
  expect(ev).toContainEqual({kind:'private_result',slot:2,result:{day:1,ability:'inspect',target,result}});
 });
 it('gives blocked living Seer no_result without the cause',()=>{
  const s=setup();const ev=resolveNight(s,night({1:[{ability:'kill',target:null},{ability:'block',target:2}],2:[{ability:'inspect',target:0}]}));
  expect(ev).toContainEqual({kind:'private_result',slot:2,result:{day:1,ability:'inspect',target:0,result:'no_result'}});
 });
 it('suppresses private results for a killed Seer, even when also blocked',()=>{
  const s=setup();const ev=resolveNight(s,night({1:[{ability:'kill',target:2},{ability:'block',target:2}],2:[{ability:'inspect',target:0}]}));
  expect(ev.some(e=>e.kind==='private_result')).toBe(false);
  expect(ev).toContainEqual({kind:'night_outcome',ability:'inspect',actor:2,target:0,outcome:'actor_dead'});
 });
 it('can inspect a target killed in the same resolution',()=>{
  const s=setup();const ev=resolveNight(s,night({0:[{ability:'kill',target:4}],2:[{ability:'inspect',target:4}]}));
  expect(ev).toContainEqual({kind:'private_result',slot:2,result:{day:1,ability:'inspect',target:4,result:'not_wolf'}});
 });
 it('rejects invalid composite, self targets and friendly kills atomically',()=>{
  for(const overrides of [{1:[{ability:'kill',target:4},{ability:'block',target:1}]},{0:[{ability:'kill',target:1}]},{2:[{ability:'inspect',target:2}]},{3:[{ability:'protect',target:3}]}]){
   const s=setup(),before=structuredClone(s);expect(()=>resolveNight(s,night(overrides))).toThrow();expect(s).toEqual(before);
  }
 });
 it('all pass causes no death and advances completed nights',()=>{
  const s=setup();const ev=resolveNight(s,night());expect(ev.at(-1)).toEqual({kind:'night_resolved',eliminated:[]});expect(s.daysCompleted).toBe(1);
 });
});
describe('termination',()=>{
 it('scores dead faction members and checks victory before day cap',()=>{
  const s=setup();s.daysCompleted=8;s.seats.forEach(p=>{p.alive=p.slot<4;});
  expect(finishIfNeeded(s,true)).toMatchObject({outcome:'wolf_win',reason:'wolf_parity',scores:[1,1,0,0,0,0,0,0,0]});
  const t=setup();t.seats[0]!.alive=false;t.seats[1]!.alive=false;t.seats[4]!.alive=false;
  expect(finishIfNeeded(t,false)).toMatchObject({outcome:'town_win',daysCompleted:0,scores:[0,0,1,1,1,1,1,1,1]});
 });
 it('draws only after the last night and is terminal-idempotent',()=>{
  const s=setup();s.daysCompleted=8;expect(finishIfNeeded(s,false)).toBeNull();
  const r=finishIfNeeded(s,true);expect(r).toMatchObject({outcome:'draw',reason:'day_cap',scores:Array(9).fill(0)});
  expect(finishIfNeeded(s,true)).toEqual(r);
  const before=structuredClone(s);expect(resolveDay(s,[])).toEqual([]);expect(resolveNight(s,[])).toEqual([]);expect(s).toEqual(before);
 });
});

describe('collective Wolf kill votes',()=>{
 const pack=()=>{
  const s=createState(seed,8);
  const roles=['wolf','alchemist','wolf','guard','sheep','sheep','sheep','sheep','sheep'] as const;
  s.seats.forEach((seat,i)=>{seat.role=roles[i]!;seat.faction=[0,1,2].includes(i)?'wolf':'town';});
  return s;
 };
 const rows=(k:Record<number,{target:number|null;killer?:number}>)=>[
  {slot:0,actions:[{ability:'kill',...k[0]??{target:null}}]},
  {slot:1,actions:[{ability:'kill',...k[1]??{target:null}},{ability:'block',target:null}]},
  {slot:2,actions:[{ability:'kill',...k[2]??{target:null}}]},
  {slot:3,actions:[{ability:'protect',target:null}]},
  ...[4,5,6,7,8].map(slot=>({slot,actions:[]})),
 ];
 const resolution=(ev:any[])=>ev.find(e=>e.kind==='kill_resolution');
 it('counts target votes separately from knife votes',()=>{
  const s=pack();const ev=resolveNight(s,rows({0:{target:4,killer:0},1:{target:4,killer:1},2:{target:5,killer:2}}));
  expect(s.seats[4]!.alive).toBe(false);expect(s.seats[5]!.alive).toBe(true);
  const r=resolution(ev);
  expect(r).toMatchObject({targetVotes:[{target:4,votes:2},{target:5,votes:1}],knifeVotes:[{killer:0,votes:1},{killer:1,votes:1},{killer:2,votes:1}],targetTie:false,knifeTie:true,target:4});
  expect([0,1,2]).toContain(r.killer);
  expect(ev).toContainEqual({kind:'night_outcome',ability:'kill',actor:r.killer,target:4,outcome:'applied'});
 });
 it('lets the pack agree on a knife holder regardless of target',()=>{
  const s=pack();const ev=resolveNight(s,rows({0:{target:4,killer:2},1:{target:5,killer:2},2:{target:null,killer:2}}));
  expect(resolution(ev)).toMatchObject({knifeVotes:[{killer:2,votes:3}],knifeTie:false,killer:2,targetTie:true});
 });
 it('treats a target without a knife choice as a vote to perform the kill yourself',()=>{
  const s=pack();const ev=resolveNight(s,rows({1:{target:6}}));
  expect(resolution(ev)).toMatchObject({targetVotes:[{target:6,votes:1}],knifeVotes:[{killer:1,votes:1}],target:6,killer:1});
 });
 it('kills no one without target votes',()=>{
  const s=pack();const ev=resolveNight(s,rows({0:{target:null,killer:0}}));
  expect(resolution(ev)).toMatchObject({targetVotes:[],target:null,killer:null});
  expect(ev).toContainEqual({kind:'night_outcome',ability:'kill',actor:null,target:null,outcome:'passed'});
 });
 it('resolves identically regardless of response order',()=>{
  const k={0:{target:4,killer:0},1:{target:5,killer:1},2:{target:6,killer:2}};
  const a=pack(),b=pack();expect(resolveNight(b,[...rows(k)].reverse())).toEqual(resolveNight(a,rows(k)));expect(a).toEqual(b);
 });
});
