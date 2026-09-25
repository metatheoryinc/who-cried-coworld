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

const speech=(id:string,slot:number)=>({schema:'wcw.events/1',id,cursor:1,day:1,phase:'day',reveal:'public',payload:{kind:'speech',speech:{slot,text:'hi',replyTo:null,accusation:null}}});
const bidObs={episodeId:'e',requestId:'r',observationId:'o',self:{slot:7,role:'guard',faction:'town',alive:true},
 roster:Array.from({length:9},(_,slot)=>({slot,name:`P${slot}`,alive:slot!==2})),transcript:[speech('public_3',3),speech('public_5',6)],
 request:{kind:'bid',window:3,maxCharacters:480}} as unknown as Observation;
const bid=(extra:Record<string,unknown>)=>JSON.stringify({kind:'bid',wantsToSpeak:true,urgency:1,text:'Hello',replyTo:null,accusation:null,reason:'',...extra});
it('checks a bid reply against visible speech ids before sending, naming the valid ids',()=>{
 expect(parseModelAction(bid({replyTo:'public_5'}),bidObs).body).toMatchObject({replyTo:'public_5'});
 expect(()=>parseModelAction(bid({replyTo:'6'}),bidObs)).toThrow('replyTo must be null or one of: public_3, public_5');
});
it('checks a bid accusation names a living player other than yourself',()=>{
 expect(parseModelAction(bid({accusation:4}),bidObs).body).toMatchObject({accusation:4});
 expect(()=>parseModelAction(bid({accusation:7}),bidObs)).toThrow('accusation must be null or a living player other than you');
 expect(()=>parseModelAction(bid({accusation:2}),bidObs)).toThrow('accusation must be null or a living player other than you');
});
