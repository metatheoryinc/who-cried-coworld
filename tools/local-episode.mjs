import { spawn } from 'node:child_process';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const directory=resolve(process.argv[2]??`artifacts/local-${Date.now()}`);
await mkdir(directory,{recursive:true});
const config={setup:process.env.WCW_SETUP,tokens:Array.from({length:9},(_,i)=>`local-seat-${i}`),players:Array.from({length:9},(_,i)=>({name:`Scripted ${i+1}`})),seed:'000102030405060708090a0b0c0d0e0f',windowMs:100,maxDays:8,player_connect_timeout_seconds:10};
await writeFile(`${directory}/config.json`,JSON.stringify(config));
const children=[];
function launch(file,env,label){
 const child=spawn(process.execPath,[file],{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});children.push(child);
 let log='';child.stdout.on('data',b=>{log+=b;});child.stderr.on('data',b=>{log+=b;});
 const done=new Promise((yes,no)=>{child.on('error',no);child.on('exit',async code=>{await writeFile(`${directory}/${label}.log`,log);code===0?yes():no(new Error(`${label} exited ${code}`));});});
 done.catch(()=>{});return {child,done};
}
const timeout=setTimeout(()=>{for(const child of children)child.kill();},30000);
try{
 const game=launch('build/game.mjs',{COGAME_CONFIG_URI:pathToFileURL(`${directory}/config.json`).href,COGAME_RESULTS_URI:pathToFileURL(`${directory}/results.json`).href,COGAME_SAVE_REPLAY_URI:pathToFileURL(`${directory}/replay.json`).href,COGAME_HOST:'127.0.0.1',COGAME_PORT:'0'},'game');
 const port=await new Promise((yes,no)=>{
  let text='';game.child.stdout.on('data',b=>{text+=b;const line=text.split('\n').find(x=>x.includes('"listening"'));if(line)yes(JSON.parse(line).port);});game.child.on('exit',()=>no(new Error('Game stopped before readiness')));
 });
 const players=config.tokens.map((token,slot)=>launch(process.argv.includes('--llm-baseline')&&slot===0?'build/llm-player.mjs':'build/player.mjs',{...(process.argv.includes('--llm-baseline')?{OPENROUTER_API_KEY:'',WCW_LLM_PROVIDER:'openrouter'}:{}),COWORLD_PLAYER_WS_URL:`ws://127.0.0.1:${port}/player?slot=${slot}&token=${token}`},`player-${slot}`));
 await Promise.all([game.done,...players.map(p=>p.done)]);
 const result=JSON.parse(await readFile(`${directory}/results.json`,'utf8'));
 const replay=JSON.parse(await readFile(`${directory}/replay.json`,'utf8'));
 const failures=replay.events.filter(e=>e.payload.kind==='failure');
 if(!replay.complete||failures.length)throw new Error(`Incomplete or fallback episode: ${failures.length}`);
 console.log(JSON.stringify({directory,result,events:replay.events.length,failures:failures.length},null,2));
}finally{clearTimeout(timeout);for(const child of children)if(child.exitCode===null)child.kill();}
