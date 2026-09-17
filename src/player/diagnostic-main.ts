import {runPlayerClient} from './client.js';
import {diagnosticAction,diagnosticPresence,diagnosticReporter,probeBedrock} from './diagnostic.js';
const url=process.env.COWORLD_PLAYER_WS_URL;
if(!url)throw Error('Missing COWORLD_PLAYER_WS_URL');
const controller=new AbortController();
const report=diagnosticReporter(process.env);
let started=false,status=`${diagnosticPresence(process.env)}; probe pending`;
const client=runPlayerClient(url,async o=>{
 if(!started){
  started=true;
  void probeBedrock(process.env,controller.signal,{},value=>{status=value;console.log(JSON.stringify({event:'diagnostic',status}));}).catch(()=>{status='probe failed';});
 }
 return diagnosticAction(o,report(o,status));
});
const stop=()=>{controller.abort();client.stop();};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
client.done.catch(()=>{console.error('Diagnostic player connection failed');process.exitCode=1;}).finally(()=>controller.abort());
