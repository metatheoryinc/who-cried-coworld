import { z } from 'zod';
import { Action, ActionBody, type Observation } from '../shared/player.js';
import { NOTE_MAX, NOTE_TARGET } from '../shared/actions.js';
import { fallbackBody } from '../game/domain/requests.js';
import { decodeText } from '../shared/decode.js';
export function actionSchema(o:Observation){
 const body=ActionBody.options.find(x=>x.shape.kind.value===o.request.kind)!;
 const schema=z.toJSONSchema(body);
 for(const [key,limit] of Object.entries({text:480,summary:NOTE_MAX,reason:NOTE_MAX})){
  const property=schema.properties?.[key];if(property&&typeof property==='object')property.maxLength=limit;
 }
 // Town votes must include the private suspicion list; every other request omits it.
 const props=schema.properties as Record<string,unknown>|undefined;
 if(o.request.kind==='vote'&&o.request.suspicion)schema.required=[...(schema.required??[]),'suspicion'];
 else if(props)delete props.suspicion;
 delete schema.$schema;
 return schema;
}
export function outputInstruction(o:Observation){
 const example=o.request.kind==='bid'?{kind:'bid',wantsToSpeak:true,urgency:1,text:'Your own brief contribution goes here.',replyTo:null,accusation:null,reason:'Your brief explanation.'}
  :o.request.kind==='vote'&&o.request.suspicion?{...fallbackBody(o.request),suspicion:o.roster.filter(p=>p.alive&&p.slot!==o.self.slot).map(p=>({slot:p.slot,wolf:0.25}))}:fallbackBody(o.request);
 return `Return exactly one bare JSON object: the ACTION INSTANCE, never a JSON Schema document. Start with { and end with }. Do not wrap it in Markdown code fences, XML tags, or quotation marks. Do not add prose, analysis, or commentary before or after the object. Do not output $schema, type, properties, required, or additionalProperties. Example of the response shape (replace values with your decision): ${JSON.stringify(example)}. Contract describing allowed fields, not the answer: ${JSON.stringify(actionSchema(o))}\nUse numeric zero-based slot targets from the offered request, or null to pass. For a non-pass kill, include killer: the numeric slot of the living Wolf agreed to perform it, selected from actors. All Wolf nominations should agree on target AND killer. Include every offered night ability in the offered order. No extra keys. Text limits: text: 480 characters; summary and reason: aim for about ${NOTE_TARGET} characters, never over ${NOTE_MAX}. No tabs or control characters. Keep speech under 30 words, other text under 40 words and all character limits. urgency is an INTEGER 0..3. A silent bid must have empty text, urgency 0, replyTo null, accusation null. Summary/reason is a brief decision explanation, not hidden chain-of-thought. For sheep with no night abilities return actions: []. Current legal request: ${JSON.stringify(o.request)}.`;
}
export function parseModelAction(content:string,o:Observation){
 // Normalize presentation only, never repair JSON or change action values.
 // Check the original size before removing prose/fences so the limit cannot be bypassed.
 if(new TextEncoder().encode(content).byteLength>8192)throw new Error('Malformed model action: output is over 8192 bytes; return one short JSON object');
 let json=content.trim();
 const fence=/^([^`{}\[\]]*)```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(json);
 if(fence)json=fence[2]!.trim();
 else if(/^[A-Za-z]/.test(json)){
  const start=json.indexOf('{');
  // Only leading prose is tolerated. The strict decoder rejects trailing prose,
  // multiple objects, malformed JSON, duplicate keys, and unsafe numbers.
  if(start>0&&!/[`\[\]]/.test(json.slice(0,start)))json=json.slice(start);
 }
 const decoded=decodeText(json,z.unknown());
 if(!decoded.ok)throw new Error('Malformed model action: not one valid JSON object; check quotes, commas and brackets, and give each key once');
 const value=decoded.value;
 // Drop keys the action's schema does not define (schema annotations, or stray keys from providers
 // that ignore the strict schema); this removes noise without changing any action value.
 const shape=value&&typeof value==='object'&&!Array.isArray(value)?ActionBody.options.find(x=>x.shape.kind.value===(value as {kind?:unknown}).kind)?.shape:undefined;
 if(shape)for(const key of Object.keys(value as object))if(!(key in shape))delete (value as Record<string,unknown>)[key];
 const parsed=ActionBody.safeParse(value);
 if(!parsed.success){
  const long=Object.entries({text:480,summary:NOTE_MAX,reason:NOTE_MAX}).flatMap(([key,limit])=>{const v=(value as Record<string,unknown>)?.[key];return typeof v==='string'&&[...v].length>limit?[`${key} is ${[...v].length} characters; the limit is ${limit}`]:[];});
  throw new Error('Malformed model action: '+[...long,...parsed.error.issues.map(i=>`${i.path.join('.')||'body'}: ${i.message}`)].join('; ').slice(0,1200));
 }
 const b=parsed.data;
 if(b.kind!==o.request.kind)throw new Error('Wrong action kind');
 if(b.kind==='vote'&&o.request.kind==='vote'&&b.target!==null&&!o.request.targets.includes(b.target))throw new Error('Illegal vote');
 // Mirror the game's bid legality so a bad reply id or accusation gets a precise repair retry instead of a blind rejection.
 if(b.kind==='bid'){
  const ids=o.transcript.filter(e=>e.payload.kind==='speech').map(e=>e.id);
  if(b.replyTo!==null&&!ids.includes(b.replyTo))throw new Error(`Illegal bid: replyTo must be null or one of: ${ids.join(', ')||'(no speech yet)'}; it is a speech id, not a player number`);
  if(b.accusation!==null&&(b.accusation===o.self.slot||!o.roster.some(p=>p.slot===b.accusation&&p.alive)))throw new Error('Illegal bid: accusation must be null or a living player other than you');
 }
 if(b.kind==='night'&&o.request.kind==='night'){
  const choices=o.request.choices;
  if(b.actions.length!==choices.length||b.actions.some(a=>!choices.some(c=>c.ability===a.ability)))throw new Error('Illegal night choice: include exactly these abilities: '+choices.map(c=>c.ability).join(', '));
  b.actions=choices.map(c=>b.actions.find(a=>a.ability===c.ability)!);
  for(const [i,a] of b.actions.entries()){
   const c=choices[i]!;
   if(a.target!==null&&!c.targets.includes(a.target))throw new Error(`Illegal night choice: ${a.ability} target must be null or one of ${c.targets.join(', ')}`);
   if(a.killer!==undefined&&(a.ability!=='kill'||!c.actors?.includes(a.killer)))throw new Error(`Illegal night choice: killer is only permitted for kill, and must be one of ${c.actors?.join(', ')??'none'}`);
  }
 }
 return Action.parse({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body:b,report:null});
}
