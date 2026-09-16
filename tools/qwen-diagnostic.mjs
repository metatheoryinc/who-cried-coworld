// Bounded paid diagnostic. Run explicitly; never invoked by the game launcher.
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {benchmarkSystemFor} from './benchmark-prompts.mjs';
const benchmark=resolve(process.env.WCW_BENCHMARK_PATH??'/Users/jt/projects/mafia-who-cried-wolf-benchmark');
loadEnvFile(`${benchmark}/.env`);
if(!process.env.OPENROUTER_API_KEY)throw Error('Missing OpenRouter credentials');
await mkdir('build',{recursive:true});
await build({stdin:{contents:`export {Observation} from './src/shared/player.ts'; export {outputInstruction,parseModelAction} from './src/player/llm.ts'; export {createInitialGameState} from ${JSON.stringify(`${benchmark}/packages/engine/src/domain/seed.ts`)}; export {buildOpenRouterMessages} from ${JSON.stringify(`${benchmark}/packages/engine/src/llm/openRouterProtocol.ts`)};`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',packages:'external',outfile:'build/qwen-diagnostic.mjs'});
const lib=await import(pathToFileURL(resolve('build/qwen-diagnostic.mjs')));
const dir=resolve(`artifacts/qwen-diagnostic-${Date.now()}`);await mkdir(dir,{recursive:true});
const roster=lib.createInitialGameState().players.map((p,slot)=>({slot,name:slot===0?'Human':p.displayName,alive:true,presentation:{kind:'neutral'}}));
const observation=kind=>lib.Observation.parse({protocol:'wcw.player/1',type:'observation',episodeId:'diagnostic',requestId:`request_${kind}`,observationId:`obs_${kind}`,attempt:0,remainingMs:13000,phase:'day',day:1,self:{slot:3,role:'alchemist',faction:'wolf',alive:true},roster,teammates:[{slot:1,role:'wolf'},{slot:3,role:'alchemist'}],privateResults:[],votes:[],transcript:[{schema:'wcw.events/1',id:'public_1',cursor:1,day:1,phase:'day',reveal:'public',payload:{kind:'speech',speech:{slot:0,text:'Qwen, who do you suspect, and why?',replyTo:null,accusation:null}}}],transcriptTruncated:false,request:kind==='bid'?{kind:'bid',window:0,maxCharacters:480,host:{reason:'human_reply',replyTo:'public_1'}}:{kind:'wolf_chat',turn:0,maxCharacters:480}});
const results=[];
for(const effort of (process.argv.includes('--long-context')?['minimal']:['minimal','low'])){
 await Promise.allSettled(['bid','wolf_chat'].map(async kind=>{
  const o=observation(kind),started=Date.now(),row={effort,kind,model:'qwen/qwen3.8-max',maxTokens:1200,timeoutMs:30000};
  if(process.argv.includes('--long-context')){
   o.transcript=Array.from({length:36},(_,i)=>({schema:'wcw.events/1',id:`public_${i+1}`,cursor:i+1,day:1,phase:'day',reveal:'public',payload:{kind:'speech',speech:{slot:i%9,text:`${roster[(i+2)%9].name}, explain why your read changed. We need evidence from what people said, not just who spoke first. I am keeping my vote open until we hear an answer, and I want everyone to name a suspect and explain what would change their mind.`,replyTo:null,accusation:null}}}));
   o.transcript.push({schema:'wcw.events/1',id:'public_37',cursor:37,day:1,phase:'day',reveal:'public',payload:{kind:'speech',speech:{slot:0,text:'Qwen, who do you suspect, and why?',replyTo:null,accusation:null}}});
   if(o.request.kind==='bid')o.request.host.replyTo='public_37';
   row.context='37 synthetic speeches';
  }
  try{
   const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:row.model,messages:[{role:'system',content:benchmarkSystemFor(o,lib)},{role:'user',content:JSON.stringify(o)}],max_tokens:1200,temperature:.7,response_format:{type:'json_object'},reasoning:{enabled:true,effort,exclude:true},provider:{sort:'throughput'}})});
   row.httpStatus=r.status;const data=await r.json();row.latencyMs=Date.now()-started;row.generationId=data.id??null;row.finishReason=data.choices?.[0]?.finish_reason??null;row.usage=data.usage??null;
   if(data.error)row.providerError=String(data.error.message??data.error.code).split(process.env.OPENROUTER_API_KEY).join('[redacted]').slice(0,500);
   const content=data.choices?.[0]?.message?.content;
   if(r.ok&&row.finishReason!=='length'&&typeof content==='string'){
    try{row.action=lib.parseModelAction(content,o).body;row.valid=true;}catch(e){row.valid=false;row.validationError=e.message;}
   }else row.valid=false;
  }catch(e){row.latencyMs=Date.now()-started;row.error=e.name;row.valid=false;}
  row.fitsTurn=row.valid&&row.latencyMs<=12900;results.push(row);
  console.log(JSON.stringify(row));
 }));
 await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));
}
console.log(`Results: ${dir}/results.json`);
