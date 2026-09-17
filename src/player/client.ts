import WebSocket from 'ws';
import {Observation,Control,type Action} from '../shared/player.js';
import {decodeText} from '../shared/decode.js';
/** One independent seat client: no game initialization or other player orchestration. */
export function runPlayerClient(url:string,choose:(o:Observation,signal:AbortSignal)=>Promise<Action>,displayName?:string){
 const parsed=new URL(url);if(!['ws:','wss:'].includes(parsed.protocol))throw Error('Expected a player WebSocket URL');
 if(displayName){parsed.searchParams.set('registerName','1');url=parsed.toString();}
 let socket:WebSocket,ended=false,failures=0,timer:ReturnType<typeof setTimeout>|undefined,active:AbortController|undefined,last='';
 let resolve!:()=>void,reject!:(e:Error)=>void;
 const done=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});
 const stop=()=>{ended=true;active?.abort();if(timer)clearTimeout(timer);socket?.terminate();resolve();};
 const connect=()=>{
  if(ended)return;
  const ws=new WebSocket(url,{maxPayload:512*1024,perMessageDeflate:false});socket=ws;last='';
  ws.on('error',()=>{});
  ws.on('message',async(bytes,binary)=>{
   if(ended)return;
   if(binary){ws.close(1003,'Text required');return;}
   const text=bytes.toString(),observation=decodeText(text,Observation,512*1024);
   if(observation.ok){
    const o=observation.value,id=`${o.episodeId}:${o.requestId}:${o.attempt}`;
    if(last===id)return;last=id;active?.abort();const controller=new AbortController();active=controller;
    try{const action=await choose(o,controller.signal);if(!ended&&!controller.signal.aborted&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(action));}
    catch{if(!controller.signal.aborted)ws.close(1011,'Policy failed');}
    return;
   }
   const control=decodeText(text,Control,512*1024);
   if(!control.ok){ws.close(1008,'Invalid server message');return;}
   if(control.value.type==='ready'&&control.value.canRegisterName&&displayName)ws.send(JSON.stringify({protocol:'wcw.player/1',type:'register',displayName}));
   if(control.value.type==='end'){ended=true;active?.abort();ws.close();resolve();}
  });
  ws.on('close',()=>{
   active?.abort();if(ended)return;
   if(++failures>20){ended=true;reject(Error('Player connection failed'));return;}
   timer=setTimeout(connect,250);
  });
 };
 connect();return {done,stop};
}
