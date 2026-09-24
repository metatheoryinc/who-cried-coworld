import {expect,it} from 'vitest';
import {systemLines} from '../../src/viewer/system-lines.js';
import type {Payload} from '../../src/shared/events.js';
const roster=['Ada','Bo','Cy','Di','Ed'].map(name=>({name}));
const at=(day:number,payload:Payload)=>({day,payload});
it('announces the first day and game over in Town',()=>{
 expect(systemLines(at(1,{kind:'started',roster:[] as any,rulesVersion:'wcw.rules/3'}),roster,[])).toEqual([{text:'Day 1 begins',scope:'town'}]);
 expect(systemLines(at(3,{kind:'finished',result:{} as any}),roster,[])).toEqual([{text:'The game is over',scope:'town'}]);
});
it('summarizes each vote outcome, then nightfall for every channel',()=>{
 const elim=at(2,{kind:'elimination',slot:1,cause:'vote',role:'wolf',faction:'wolf'});
 const ballots=at(2,{kind:'ballots',ballots:[{slot:0,target:1},{slot:2,target:1},{slot:3,target:1},{slot:1,target:null}],eliminated:1,resolution:'majority'});
 expect(systemLines(ballots,roster,[elim])).toEqual([{text:'Vote: Bo eliminated (3 of 4) · Wolf · Wolves',scope:'town'},{text:'Night 2 falls',scope:'all'}]);
 const none=(resolution:'no_majority'|'tie'|'all_abstain')=>systemLines(at(1,{kind:'ballots',ballots:[],eliminated:null,resolution}),roster,[])[0]!.text;
 expect([none('no_majority'),none('tie'),none('all_abstain')]).toEqual(['Vote: no majority — nobody eliminated','Vote: tied — nobody eliminated','Vote: everyone passed']);
});
it('reports the night, then the next day unless the game ended',()=>{
 const elim=at(1,{kind:'elimination',slot:3,cause:'wolf',role:'seer',faction:'town'});
 expect(systemLines(at(1,{kind:'night_resolved',eliminated:[3]}),roster,[elim])).toEqual([{text:'Dawn: Di was killed in the night · Seer · Town',scope:'town'},{text:'Day 2 begins',scope:'all'}]);
 expect(systemLines(at(1,{kind:'night_resolved',eliminated:[]}),roster,[])).toEqual([{text:'Dawn: everyone survived the night',scope:'town'},{text:'Day 2 begins',scope:'all'}]);
 const finished=at(1,{kind:'finished',result:{} as any});
 expect(systemLines(at(1,{kind:'night_resolved',eliminated:[]}),roster,[finished]).map(l=>l.text)).toEqual(['Dawn: everyone survived the night']);
});
it('ignores other events',()=>{expect(systemLines(at(1,{kind:'speech',speech:{slot:0,text:'hi',replyTo:null,accusation:null}}),roster,[])).toEqual([]);});
