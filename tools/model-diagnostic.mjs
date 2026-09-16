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
await build({stdin:{contents:`export {providerCompletion} from './src/player/provider.ts'; export {Observation} from './src/shared/player.ts'; export {outputInstruction,parseModelAction,actionSchema} from './src/player/llm.ts'; export {createInitialGameState} from ${JSON.stringify(`${benchmark}/packages/engine/src/domain/seed.ts`)}; export {buildOpenRouterMessages} from ${JSON.stringify(`${benchmark}/packages/engine/src/llm/openRouterProtocol.ts`)};`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',packages:'external',outfile:'build/model-diagnostic.mjs'});
const lib=await import(pathToFileURL(resolve('build/model-diagnostic.mjs')));
const dir=resolve(`artifacts/model-diagnostic-${Date.now()}`);await mkdir(dir,{recursive:true});
const roster=lib.createInitialGameState().players.map((p,slot)=>({slot,name:slot===0?'Human':p.displayName,alive:true,presentation:{kind:'neutral'}}));
const observation=kind=>lib.Observation.parse({protocol:'wcw.player/1',type:'observation',episodeId:'diagnostic',requestId:`request_${kind}`,observationId:`obs_${kind}`,attempt:0,remainingMs:13000,phase:'day',day:1,self:{slot:3,role:'alchemist',faction:'wolf',alive:true},roster,teammates:[{slot:1,role:'wolf'},{slot:3,role:'alchemist'}],privateResults:[],votes:[],transcript:[{schema:'wcw.events/1',id:'public_1',cursor:1,day:1,phase:'day',reveal:'public',payload:{kind:'speech',speech:{slot:0,text:'Qwen, who do you suspect, and why?',replyTo:null,accusation:null}}}],transcriptTruncated:false,request:kind==='bid'?{kind:'bid',window:0,maxCharacters:480,host:{reason:'human_reply',replyTo:'public_1'}}:{kind:'wolf_chat',turn:0,maxCharacters:480}});
const results=[];
for(const model of (process.argv.includes('--replacement-only')?['openai/gpt-oss-120b']:['qwen/qwen3.8-flash','google/gemini-3.1-pro-preview'])){
 for(const kind of ['bid','vote']){
  const o=observation('bid');
  if(kind==='vote')o.request={kind:'vote',targets:[0,1,2,3,4,5,6,7,8],allowPass:true};
  o.roster[3].name=model.startsWith('google/')?'Gemini':'Qwen';
  o.transcript=Array.from({length:36},(_,i)=>({schema:'wcw.events/1',id:`public_${i+1}`,cursor:i+1,day:1,phase:'day',reveal:'public',payload:{kind:'speech',speech:{slot:i%9,text:`${roster[(i+2)%9].name}, explain why your read changed. We need evidence from what people said, not just who spoke first. I am keeping my vote open until we hear an answer. Name a suspect and explain what would change your mind.`,replyTo:null,accusation:null}}}));
  const started=Date.now(),row={model,kind};
  try{
   const content=await lib.providerCompletion({model,messages:[{role:'system',content:benchmarkSystemFor(o,lib)},{role:'user',content:JSON.stringify(o)}],schema:lib.actionSchema(o),key:process.env.OPENROUTER_API_KEY,signal:AbortSignal.timeout(12900),metadata:d=>Object.assign(row,d)});
   row.action=lib.parseModelAction(content,o).body;row.valid=true;
  }catch(e){row.valid=false;row.error=e.name+': '+e.message;}
  row.latencyMs=Date.now()-started;results.push(row);
  console.log(JSON.stringify({model,kind,valid:row.valid,latencyMs:row.latencyMs,error:row.error}));
 }
}
await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(dir);
