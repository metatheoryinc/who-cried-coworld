import { expect,it } from 'vitest';
import { createState,legalNightChoices,resolveNight,resolveDay,finishIfNeeded,type State,type NightRow } from '../../src/game/domain/rules.js';
import { factionOf,newD3Decks,RoleDeck,type Role } from '../../src/shared/roles.js';
const state=(roles:Role[])=>{const s=createState('0'.repeat(32),8,roles);s.seats=roles.map((role,slot)=>({slot,role,faction:factionOf(role),alive:true}));return s;};
const rows=(s:State,choices:Record<number,NightRow['actions']>={})=>s.seats.filter(p=>p.alive).map(p=>({slot:p.slot,actions:choices[p.slot]??legalNightChoices(s,p.slot).map(c=>({ability:c.ability,target:null}))}));
it.each(Object.entries(newD3Decks))('defines NewD3 %s as exactly two wolves and seven town',(_,deck)=>{
 expect(RoleDeck.parse(deck)).toHaveLength(9);expect(deck.filter(r=>factionOf(r)==='wolf')).toHaveLength(2);
});
it('Chef blocks the chosen killer even when the unjailed partner submits the nomination',()=>{
 const s=state(newD3Decks.A2);resolveNight(s,rows(s,{0:[{ability:'kill',target:4,killer:0}],1:[{ability:'kill',target:4,killer:0},{ability:'block',target:null}],2:[{ability:'jail',target:0}]}));
 expect(s.seats[4]!.alive).toBe(true);
});
it('Alchemist blocks Chef first and can kill while blocking',()=>{
 const s=state(newD3Decks.A2);resolveNight(s,rows(s,{1:[{ability:'kill',target:4,killer:1},{ability:'block',target:2}],2:[{ability:'jail',target:1}]}));expect(s.seats[4]!.alive).toBe(false);
});
it('Chef protects the jailed victim and prevents their inspection',()=>{
 const s=state(['wolf','alchemist','chef','seer','sheep','sheep','sheep','sheep','sheep']);
 const events=resolveNight(s,rows(s,{0:[{ability:'kill',target:3,killer:0}],2:[{ability:'jail',target:3}],3:[{ability:'inspect',target:0}]}));
 expect(s.seats[3]!.alive).toBe(true);expect(events).toContainEqual({kind:'private_result',slot:3,result:{day:1,ability:'inspect',target:0,result:'no_result'}});
});
it('Priest sees a Rolecop visit two targets, only the selected killer visits the kill',()=>{
 const s=state(newD3Decks.B1);const events=resolveNight(s,rows(s,{0:[{ability:'kill',target:4,killer:1}],1:[{ability:'kill',target:4,killer:1},{ability:'check',target:5}],2:[{ability:'track',target:1}]}));
 expect(events).toContainEqual({kind:'private_result',slot:2,result:{day:1,ability:'track',target:1,result:[4,5]}});
 expect(events).toContainEqual({kind:'private_result',slot:1,result:{day:1,ability:'check',target:5,result:'vanilla'}});
});
it('Track Reader sees ordinary Wolf as vanilla, without faction',()=>{
 const s=state(newD3Decks.B1);expect(resolveNight(s,rows(s,{1:[{ability:'kill',target:null},{ability:'check',target:0}]}))).toContainEqual({kind:'private_result',slot:1,result:{day:1,ability:'check',target:0,result:'vanilla'}});
});
it('Dairy Maid informs only the living recipient of her identity',()=>{
 const s=state(newD3Decks.B1);const results=resolveNight(s,rows(s,{3:[{ability:'inform',target:4}]})).filter(e=>e.kind==='private_result');
 expect(results).toEqual([{kind:'private_result',slot:4,result:{day:1,ability:'inform',target:3,result:'town'}}]);
});
it('blocked and killed information roles cannot send successful private results',()=>{
 const s=state(['wolf','alchemist','dairy_maid','priest','sheep','sheep','sheep','sheep','sheep']);
 const events=resolveNight(s,rows(s,{0:[{ability:'kill',target:3,killer:0}],1:[{ability:'kill',target:3,killer:0},{ability:'block',target:2}],2:[{ability:'inform',target:4}],3:[{ability:'track',target:0}]}));
 expect(events.filter(e=>e.kind==='private_result')).toEqual([]);
});
it('Trickster wins on vote elimination only, with a single winning score',()=>{
 const deck:Role[]=['wolf','alchemist','jester','seer','guard','sheep','sheep','sheep','sheep'];
 const s=state(deck);resolveDay(s,s.seats.map(p=>({slot:p.slot,target:2})));expect(finishIfNeeded(s,false)).toMatchObject({outcome:'jester_win',scores:[0,0,1,0,0,0,0,0,0]});
 const n=state(deck);resolveNight(n,rows(n,{0:[{ability:'kill',target:2,killer:0}]}));expect(finishIfNeeded(n,true)).toBeNull();
});
