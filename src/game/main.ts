import { GameConfig } from '../shared/config.js';
import { decodeText } from '../shared/decode.js';
import { readUri,writeUri } from './runtime/artifacts.js';
import { startServer } from './runtime/server.js';
const required=(name:string)=>{const value=process.env[name];if(!value)throw new Error(`Missing ${name}`);return value;};
async function main(){
 const configUri=required('COGAME_CONFIG_URI'),resultsUri=required('COGAME_RESULTS_URI'),replayUri=required('COGAME_SAVE_REPLAY_URI');
 const resultMethod=process.env.COGAME_RESULTS_METHOD??'PUT',replayMethod=process.env.COGAME_SAVE_REPLAY_METHOD??'PUT';
 if(!['PUT','POST'].includes(resultMethod)||!['PUT','POST'].includes(replayMethod))throw new Error('Invalid artifact method');
 for(const uri of [configUri,resultsUri,replayUri])if(!['file:','http:','https:'].includes(new URL(uri).protocol))throw new Error('Unsupported artifact URI');
 const decoded=decodeText(await readUri(configUri,65536),GameConfig,65536);if(!decoded.ok)throw new Error('Invalid game configuration');
 const port=Number(process.env.COGAME_PORT??8080);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port');
 const server=await startServer(decoded.value,{port,host:process.env.COGAME_HOST??'0.0.0.0'});
 console.log(JSON.stringify({event:'listening',port:server.port}));
 try{
  const replay=await server.completed;
  await new Promise(resolve=>setTimeout(resolve,100));
  await server.close();
  await writeUri(replayUri,JSON.stringify(replay),replayMethod);
  await writeUri(resultsUri,JSON.stringify(replay.result),resultMethod);
  console.log(JSON.stringify({event:'finished',outcome:replay.result.outcome,daysCompleted:replay.result.daysCompleted}));
 }catch(error){await server.close().catch(()=>{});throw error;}
}
main().catch(()=>{console.error('Game failed; configuration, runtime, or artifact contract was not satisfied.');process.exitCode=1;});
