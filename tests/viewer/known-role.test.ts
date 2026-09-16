import {expect,it} from 'vitest';
import {knownRole} from '../../src/viewer/known-role.js';
import type {Payload} from '../../src/shared/events.js';
const state={self:{slot:0,role:'track_reader' as const},teammates:[{slot:1,role:'wolf' as const}],events:[] as {payload:Payload}[]};
it('reveals self and confirmed teammates but leaves other portraits unknown',()=>{
 expect(knownRole(state,0)).toBe('track_reader');expect(knownRole(state,1)).toBe('wolf');expect(knownRole(state,2)).toBeNull();
 expect(knownRole({...state,self:{slot:0,role:'noble'},teammates:[{slot:2,role:'noble'}]},2)).toBe('noble');
});
it('uses exact private discoveries without guessing from ambiguous results',()=>{
 for(const result of ['seer','vanilla','no_result'] as const){
  const events=[{payload:{kind:'private_result',slot:0,result:{day:1,ability:'check',target:2,result}} as Payload}];
  expect(knownRole({...state,events},2)).toBe(result==='seer'?'seer':null);
 }
 expect(knownRole({...state,events:[{payload:{kind:'private_result',slot:0,result:{day:1,ability:'inspect',target:2,result:'not_wolf'}}}]},2)).toBeNull();
 expect(knownRole({...state,events:[{payload:{kind:'private_result',slot:0,result:{day:1,ability:'inform',target:2,result:'town'}}}]},2)).toBe('dairy_maid');
});
