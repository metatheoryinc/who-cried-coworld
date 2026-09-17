import { expect,it } from 'vitest';
import { parseModelAction,outputInstruction } from '../../src/player/llm.js';
import type { Observation } from '../../src/shared/player.js';
const o={episodeId:'e',requestId:'r',observationId:'o',request:{kind:'night',choices:[{ability:'inspect',targets:[2,3],allowPass:true}]}} as Observation;
it('binds model output to the current request and validates offered targets',()=>{
 const a=parseModelAction('{"kind":"night","actions":[{"ability":"inspect","target":2}],"summary":"Check the claim."}',o);
 expect(a.requestId).toBe('r');expect(a.report).toBeNull();
 expect(()=>parseModelAction('{"kind":"night","actions":[{"ability":"inspect","target":0}],"summary":""}',o)).toThrow('Illegal night');
 expect(()=>parseModelAction('{"kind":"night","actions":[],"summary":""}',o)).toThrow('Illegal night');
 expect(()=>parseModelAction('not json',o)).toThrow('Malformed');
});
it('provides the correct typed output contract',()=>{
 expect(outputInstruction(o)).toContain('inspect');expect(outputInstruction(o)).toContain('zero-based');
});
it('reports the specific invalid field and supplies explicit text limits',()=>{
 expect(()=>parseModelAction(JSON.stringify({kind:'night',actions:[],summary:'x'.repeat(241)}),o)).toThrow(/summary/);
 expect(outputInstruction(o)).toContain('summary and reason: 240');
});
it('canonicalizes ability order without changing targets or permitting illegal targets',()=>{
 const two={...o,request:{kind:'night',choices:[{ability:'kill',targets:[2],actors:[1],allowPass:true},{ability:'block',targets:[3],allowPass:true}]}} as Observation;
 const body={kind:'night',actions:[{ability:'block',target:3},{ability:'kill',target:2,killer:1}],summary:''};
 expect(parseModelAction(JSON.stringify(body),two).body).toMatchObject({actions:[{ability:'kill',target:2,killer:1},{ability:'block',target:3}]});
 body.actions[0]!.target=8;
 expect(()=>parseModelAction(JSON.stringify(body),two)).toThrow(/block.*3/);
});
it('accepts harmless schema metadata but rejects schema documents and unrelated keys',()=>{
 const action={kind:'night',actions:[{ability:'inspect',target:2}],summary:''};
 expect(parseModelAction(JSON.stringify({...action,$schema:'https://json-schema.org/draft/2020-12/schema',type:'object'}),o).body).toEqual(action);
 expect(()=>parseModelAction(JSON.stringify({$schema:'https://json-schema.org/draft/2020-12/schema',type:'object',properties:{kind:{const:'night'}}}),o)).toThrow();
 expect(()=>parseModelAction(JSON.stringify({...action,unexpected:true}),o)).toThrow();
});
it('accepts one fenced JSON action or a single action after prose without rewriting text',()=>{
 const body={kind:'night',actions:[{ability:'inspect',target:2}],summary:'Check {the claim} and "quotes".'};
 const json=JSON.stringify(body);
 for(const text of ['```json\n'+json+'\n```','```\r\n'+json+'\r\n```','I will inspect the claim.\n'+json,'I will inspect the claim.\n```json\n'+json+'\n```']){
  expect(parseModelAction(text,o).body).toEqual(body);
 }
});
it('rejects ambiguous wrappers, duplicate keys, unsafe integers, arrays, and oversized output',()=>{
 const json='{"kind":"night","actions":[{"ability":"inspect","target":2}],"summary":""}';
 for(const text of [json+'\n'+json,'```json\n'+json+'\n```\n```json\n'+json+'\n```','['+json+']','```json\n'+json.replace('"target":2','"target":2,"target":3')+'\n```', 'I choose:\n'+json.replace('"target":2','"target":9007199254740993'),'x'.repeat(8192)+'\n'+json])expect(()=>parseModelAction(text,o)).toThrow();
 expect(()=>parseModelAction('```json\n'+json.replace('"target":2','"target":0')+'\n```',o)).toThrow('Illegal night');
});
