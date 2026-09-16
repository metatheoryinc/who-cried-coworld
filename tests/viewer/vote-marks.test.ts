import { expect,it } from 'vitest';
import { voteMarks } from '../../src/viewer/vote-marks.js';
import type { Payload } from '../../src/shared/events.js';
const events:{day:number;payload:Payload}[]=[{day:1,payload:{kind:'ballots',ballots:[{slot:0,target:2},{slot:1,target:2},{slot:2,target:null}],eliminated:2,resolution:'majority'}}];
it('marks only the human locked vote while ballots are sealed',()=>{
 const state={day:1,phase:'vote',accepted:{kind:'vote' as const,target:1,summary:''},events};
 expect(voteMarks(state,1)).toEqual({count:1,majority:0,own:true});
 expect(voteMarks(state,2).count).toBe(0);
});
it('clears ballot stamps at night and keeps results in the journal',()=>{
 expect(voteMarks({day:1,phase:'night',accepted:null,events},2)).toEqual({count:0,majority:0,own:false});
 expect(voteMarks({day:2,phase:'day',accepted:null,events},2).count).toBe(0);
});
it('does not turn an abstention or night nomination into a public vote stamp',()=>{
 expect(voteMarks({day:1,phase:'vote',accepted:{kind:'vote',target:null,summary:''},events:[]},0).count).toBe(0);
 expect(voteMarks({day:1,phase:'night',accepted:{kind:'night',actions:[{ability:'kill',target:0}],summary:''},events:[]},0).count).toBe(0);
});
