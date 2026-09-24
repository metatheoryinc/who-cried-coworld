import {build} from 'esbuild';
import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import WebSocket from 'ws';
const allBots=process.argv.includes('--all-bots');
const llm=process.argv.includes('--llm'),smoke=process.argv.includes('--smoke');
if(llm&&smoke)throw new Error('Use scripted opponents for accelerated smoke testing.');
const benchmark=resolve(process.env.WCW_BENCHMARK_PATH??'/Users/jt/projects/mafia-who-cried-wolf-benchmark');
if(llm&&existsSync(`${benchmark}/.env`))loadEnvFile(`${benchmark}/.env`);
const exports=[['./src/game/runtime/server.ts','startServer'],['./src/shared/config.ts','GameConfig'],['./src/shared/player.ts','Observation'],['./src/player/scripted.ts','scriptedAction'],['./src/player/contestants.ts','contestants'],['./src/player/policy.ts','llmAction'],['./src/player/inference.ts','resolveInference'],['./src/player/timed-llm.ts','timedAction'],['./src/player/llm.ts','outputInstruction,actionSchema'],['./src/player/provider.ts','providerCompletion,modelSettings']];

await mkdir('build',{recursive:true});
await build({stdin:{contents:exports.map(([file,names])=>`export {${names}} from ${JSON.stringify(file)};`).join('\n'),resolveDir:process.cwd()},bundle:true,platform:'node',target:'node24',format:'esm',outfile:'build/human-lib.mjs',packages:'external'});
const lib=await import(pathToFileURL(resolve('build/human-lib.mjs')));
const inference=llm?lib.resolveInference():null;
if(llm&&inference.provider==='openrouter'&&!inference.key)throw Error('OpenRouter key missing');
const humanSlots=allBots?[]:(process.env.WCW_HUMAN_SLOTS??process.env.WCW_HUMAN_SLOT??'0').split(',').map(Number);
if(!allBots&&(!humanSlots.length||new Set(humanSlots).size!==humanSlots.length||humanSlots.some(s=>!Number.isInteger(s)||s<0||s>8)))throw Error('WCW_HUMAN_SLOTS must be distinct seats from 0 to 8, such as 0,1,2');
const humanSlot=humanSlots[0]??-1;
const contestants=llm?lib.contestants:[];
const models=contestants.map(p=>inference?.provider==='bedrock'?inference.model:process.env.WCW_MODEL||(p.model?.startsWith('qwen/')?(process.env.WCW_QWEN_MODEL||'openai/gpt-oss-120b'):p.model));
if(llm&&models.some(m=>!m))throw new Error('Every benchmark player must have a model configured.');
const players=llm?contestants.map((p,i)=>({name:p.model?.startsWith('qwen/')&&models[i]==='openai/gpt-oss-120b'?'GPT-OSS':p.displayName})):Array.from({length:9},(_,i)=>({name:`Villager ${i+1}`}));
for(const [index,slot] of humanSlots.entries())players[slot]={name:index===0?(process.env.WCW_HUMAN_NAME??'Human'):`Human-${index+1}`};
const config=lib.GameConfig.parse({mode:allBots?'bots':'human',humanSlot,humanSlots,seed:process.env.WCW_SEED,tokens:Array.from({length:9},()=>randomUUID()),players,setup:process.env.WCW_SETUP??'random',maxDays:8,player_connect_timeout_seconds:30,...(smoke?{humanTimers:allBots?{dayMs:600,voteMs:200,coordinationMs:200,nightMs:200,transitionMs:100}:{dayMs:6000,voteMs:8000,coordinationMs:2000,nightMs:8000}}:{})});
const dir=resolve(process.env.WCW_ARTIFACT_DIR??`artifacts/${allBots?'bots':'human'}-${Date.now()}`);await mkdir(dir,{recursive:true});
const clients=[],calls=[];
let logWrites=Promise.resolve();
const server=await lib.startServer(config,{port:Number(process.env.WCW_PORT??(allBots?8773:8772)),host:'127.0.0.1',moderatorEnvironment:{...process.env,...(!llm?{WCW_MODERATOR:'off'}:{})},onModeratorLog:log=>{logWrites=logWrites.then(()=>appendFile(`${dir}/moderator.jsonl`,JSON.stringify(log)+'\n')).catch(()=>console.error('Could not write moderator diagnostics.'));}});
const joinUrls=humanSlots.map(slot=>`http://127.0.0.1:${server.port}/client/player?slot=${slot}&token=${config.tokens[slot]}`);
const url=allBots?`http://127.0.0.1:${server.port}/client/global`:`http://127.0.0.1:${server.port}/client/player?slot=${humanSlot}&token=${config.tokens[humanSlot]}`;
if(!allBots){await writeFile(`${dir}/join-url.txt`,url+'\n',{mode:0o600});await writeFile(`${dir}/join-urls.txt`,joinUrls.join('\n')+'\n',{mode:0o600});}
await writeFile(`${dir}/run.json`,JSON.stringify({mode:allBots?'bots':'human',opponents:llm?players.flatMap((p,slot)=>humanSlots.includes(slot)?[]:[{slot,name:p.name,model:models[slot]}]):'scripted',setup:config.setup,timers:config.humanTimers,started:new Date().toISOString()},null,2));
if(llm)for(let slot=0;slot<players.length;slot++)if(!humanSlots.includes(slot))console.log(`${players[slot].name}: ${models[slot]}`);

for(let slot=0;slot<9;slot++){
 if(humanSlots.includes(slot))continue;
 const model=models[slot];
 const ws=new WebSocket(`ws://127.0.0.1:${server.port}/player?slot=${slot}&token=${config.tokens[slot]}`);clients.push(ws);
 ws.on('error',()=>console.error(`Policy seat ${slot} disconnected.`));
 ws.on('message',async bytes=>{
  const raw=JSON.parse(bytes.toString());if(raw.type==='end'){ws.close();return;}if(raw.type!=='observation')return;
  const o=lib.Observation.parse(raw);
  const action=llm?await lib.llmAction(o,{...inference,model,onLog:attempt=>{
   const row={slot,model,requestId:o.requestId,requestKind:o.request.kind,...attempt};calls.push(row);
   logWrites=logWrites.then(()=>appendFile(`${dir}/attempts.jsonl`,JSON.stringify(row)+'\n')).catch(()=>console.error('Could not write attempt diagnostics.'));
  }}):lib.scriptedAction(o);
  if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(action));
 });
}
console.log(`Ready with ${llm?'benchmark per-player models':'scripted'} opponents. ${allBots?'All nine bots start automatically.':'Join using a different seat link in each browser. The connection grace period begins with the first human.'}\n${allBots?url:joinUrls.join('\n')}\nArtifacts: ${dir}`);
server.completed.then(async replay=>{
 await logWrites;
 await writeFile(`${dir}/replay.json`,JSON.stringify(replay));await writeFile(`${dir}/results.json`,JSON.stringify(replay.result,null,2));await writeFile(`${dir}/calls.json`,JSON.stringify(calls,null,2));
 if(allBots){for(const ws of clients)ws.terminate();await server.close();}
 console.log(`Game complete: ${replay.result.outcome}. Replay saved to ${dir}/replay.json`);
}).catch(e=>{console.error(e);process.exitCode=1;});
async function shutdown(){for(const ws of clients)ws.terminate();await server.close();await logWrites;process.exit();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
