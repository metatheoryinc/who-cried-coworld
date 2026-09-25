import WebSocket from 'ws';
import { Observation,Control } from '../shared/player.js';
import { decodeText } from '../shared/decode.js';
import { scriptedAction,actOnLooseObservation } from './scripted.js';
const url=process.env.COWORLD_PLAYER_WS_URL;
if(!url)throw new Error('Missing COWORLD_PLAYER_WS_URL');
let finished=false,failures=0;
function connect(){
 const ws=new WebSocket(url!,{maxPayload:512*1024,perMessageDeflate:false});
 ws.on('error',()=>{});
 ws.on('message',(bytes,isBinary)=>{
  if(isBinary){ws.close(1003,'Text required');return;}
  const text=bytes.toString();
  const observation=decodeText(text,Observation,512*1024);
  if(observation.ok){ws.send(JSON.stringify(scriptedAction(observation.value)));return;}
  const control=decodeText(text,Control,512*1024);
  if(!control.ok){
   const action=actOnLooseObservation(text);
   if(action){ws.send(JSON.stringify(action));return;}
   ws.close(1008,'Invalid server message');return;
  }
  if(control.value.type==='end'){finished=true;console.log(JSON.stringify({event:'finished',outcome:control.value.result.outcome}));ws.close();}
 });
 ws.on('close',()=>{
  if(finished)return;
  if(++failures>20){console.error('Player connection failed');process.exitCode=1;return;}
  setTimeout(connect,250);
 });
}
connect();
