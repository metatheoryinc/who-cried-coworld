import {createRuntimeModerator,type ModeratorLog} from './moderator.js';
import { createServer } from 'node:http';
import { timingSafeEqual,randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WebSocketServer,WebSocket } from 'ws';
import type { GameConfig } from '../../shared/config.js';
import { Session } from './session.js';
import { HumanSession } from './human-session.js';
import { exportReplay,type Replay } from '../../shared/replay.js';
import { project } from '../../shared/presentation/project.js';
import {Registration} from '../../shared/player-names.js';
export async function startServer(config:GameConfig,options:{port:number;host:string;viewerDir?:string;moderatorEnvironment?:NodeJS.ProcessEnv;onModeratorLog?:(log:ModeratorLog)=>void}){
 const session=new (config.mode!=='fast'?HumanSession:Session)(config,`episode_${randomUUID().replaceAll('-','')}`);
 const moderatorEnv=options.moderatorEnvironment??process.env;
 if(session instanceof HumanSession)session.moderator=createRuntimeModerator(config.moderator===undefined?moderatorEnv:{...moderatorEnv,WCW_MODERATOR:config.moderator==='default'?'off':config.moderator},options.onModeratorLog);
 const policies=new Map<number,WebSocket>(),viewers=new Map<WebSocket,{slot:number|'public';cursor:number}>();
 const sent=new Map<WebSocket,string>(),invalid=new Map<WebSocket,{request:string;count:number}>();
 let completed=false,timer:ReturnType<typeof setInterval>|undefined;
 let resolveCompleted!:(r:Replay)=>void,rejectCompleted!:(e:unknown)=>void;
 const completion=new Promise<Replay>((yes,no)=>{resolveCompleted=yes;rejectCompleted=no;});
 const readyAt=performance.now();
 let firstHumanAt:number|undefined;
 const nameDeadlines=new Map<number,number>();
 const authenticate=(url:URL)=>{
  const raw=url.searchParams.get('slot');if(raw===null||! /^[0-8]$/.test(raw))return null;
  const slot=Number(raw),token=Buffer.from(url.searchParams.get('token')??''),expected=Buffer.from(config.tokens[slot]!);
  return token.length===expected.length&&timingSafeEqual(token,expected)?slot:null;
 };
 const http=createServer(async(req,res)=>{
  res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  const url=new URL(req.url??'/','http://localhost');
  if(url.pathname==='/replay.json'){if(!completed||!session.state.result){res.writeHead(409);res.end('Game is still in progress');return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(exportReplay(session.episodeId,config.maxDays,session.journal,session.state.result)));return;}
  if(url.pathname==='/healthz'){res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return;}
  if(url.pathname==='/client/player'&&authenticate(url)===null){res.writeHead(401);res.end('Unauthorized');return;}
  const asset=url.pathname.replace(/^\/client\//,'/');
  const assetFile=/^\/assets\/[a-zA-Z0-9_/-]+\.(png|webp|jpg|svg)$/.test(asset)&&!asset.includes('..')?asset.slice(1):null;
  const file=assetFile??(url.pathname==='/client/player'&&config.mode==='human'?'player.html':['/player.js','/client/player.js'].includes(url.pathname)?'player.js':['/player.css','/client/player.css'].includes(url.pathname)?'player.css':['/client/player','/client/global','/client/replay','/'].includes(url.pathname)?'index.html':['/viewer.js','/client/viewer.js'].includes(url.pathname)?'viewer.js':['/style.css','/client/style.css'].includes(url.pathname)?'style.css':null);
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try{const content=await readFile(resolve(options.viewerDir??'build/viewer',file));res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(content);}
  catch{res.writeHead(503);res.end('Viewer build unavailable');}
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
 const send=(ws:WebSocket,value:unknown)=>{if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>1024*1024){ws.close(1008,'Slow client');return;}ws.send(JSON.stringify(value));}};
 // Seat status and auto-start countdown shown to joined humans before play.
 const lobby=(session:HumanSession,now:number)=>({
  seats:Array.from({length:9},(_,slot)=>!policies.has(slot)?'open':session.isHuman(slot)?'human':'ai'),
  startsInMs:firstHumanAt===undefined?null:Math.max(0,Math.ceil(firstHumanAt+config.player_connect_timeout_seconds*1000-now)),
 });
 const flush=()=>{
  for(const [ws,viewer] of viewers){
   const events=project(session.journal,viewer.slot);
   if(events.length>viewer.cursor){send(ws,{protocol:'wcw.viewer/1',type:'events',episodeId:session.episodeId,throughCursor:events.length,events:events.slice(viewer.cursor)});viewer.cursor=events.length;}
  }
  for(const [slot,ws] of policies){
   const p=session.pending.get(slot);
   if(session instanceof HumanSession&&session.isHuman(slot!)){
    const now=performance.now(),key=`${session.journal.length}:${p?.requestId}:${p?.attempt}:${!!p?.accepted}:${Math.floor(now/1000)}`;
    if(sent.get(ws)!==key){send(ws,{...session.snapshot(slot,now),lobby:session.phase==='waiting'?lobby(session,now):null});sent.set(ws,key);}continue;
   }
   if(!p||p.outcome||p.accepted)continue;
   const key=`${p.requestId}:${p.attempt}`;
   if(sent.get(ws)!==key){const o=session.observation(slot,performance.now());if(o){send(ws,o);sent.set(ws,key);}}
  }
 };
 const tick=()=>{
  try{
   if(completed)return;
   const now=performance.now();
   const namesReady=[...nameDeadlines.values()].every(deadline=>now>=deadline);
   // Human lobbies wait for the first join, then for a full table or the connection wait.
   const humanReady=config.mode!=='human'||firstHumanAt!==undefined;
   if(session.phase==='waiting'&&humanReady&&namesReady&&(policies.size===9||now-(firstHumanAt??readyAt)>=config.player_connect_timeout_seconds*1000))session.start(now);
   session.advance(now);flush();
   if(session.state.result){
    completed=true;if(timer)clearInterval(timer);
    const replay=exportReplay(session.episodeId,config.maxDays,session.journal,session.state.result);
    for(const ws of policies.values())send(ws,{protocol:'wcw.player/1',type:'end',episodeId:session.episodeId,result:session.state.result});
    resolveCompleted(replay);
   }
  }catch(error){completed=true;if(timer)clearInterval(timer);rejectCompleted(error);}
 };
 http.on('upgrade',(req,socket,head)=>{
  const url=new URL(req.url??'/','http://localhost');
  const slot=authenticate(url);
  if(!['/player','/human','/global','/inspect'].includes(url.pathname)||url.pathname!=='/global'&&slot===null){socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  if((url.pathname==='/human'&&(!(session instanceof HumanSession)||config.mode!=='human'))||(['/human','/player'].includes(url.pathname)&&(policies.has(slot!)||(completed&&!(session instanceof HumanSession&&session.isHuman(slot!)))))){socket.write('HTTP/1.1 409 Conflict\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>{
   ws.on('error',()=>{});
   if(url.pathname==='/player'||url.pathname==='/human'){
    if(url.pathname==='/human'&&session instanceof HumanSession)session.registerHuman(slot!);
    policies.set(slot!,ws);
    if(session instanceof HumanSession&&session.isHuman(slot!))firstHumanAt??=performance.now();
    // Let authenticated browser identification arrive before starting a full table.
    if(config.mode==='human'&&session.phase==='waiting')nameDeadlines.set(slot!,performance.now()+1000);
    const naming=url.searchParams.get('registerName')==='1'&&!(session instanceof HumanSession&&session.isHuman(slot!));
    if(naming&&session.phase==='waiting')nameDeadlines.set(slot!,performance.now()+2000);
    send(ws,{protocol:'wcw.player/1',type:'ready',episodeId:session.episodeId,slot,...(naming?{canRegisterName:session.phase==='waiting'}:{})});
    ws.on('message',(bytes,isBinary)=>{
     if(session instanceof HumanSession&&config.mode==='human'&&!isBinary){
      let raw;try{raw=JSON.parse(bytes.toString());}catch{}
      if(raw?.protocol==='wcw.human/1'&&raw.type==='join'){
       session.registerHuman(slot!);firstHumanAt??=performance.now();nameDeadlines.delete(slot!);sent.delete(ws);tick();flush();return;
      }
     }
     if(naming&&!isBinary){
      let raw;try{raw=JSON.parse(bytes.toString());}catch{}
      if(raw?.type==='register'){
       const registration=Registration.safeParse(raw);
       if(registration.success&&!(session instanceof HumanSession&&session.isHuman(slot!))){session.registerName(slot!,registration.data.displayName);nameDeadlines.delete(slot!);}
       return;
      }
     }
     if(session instanceof HumanSession&&session.isHuman(slot!)&&!isBinary){
      let raw;try{raw=JSON.parse(bytes.toString());}catch{}
      if(raw?.type==='chat'){const receipt=session.chat(slot!,bytes.toString(),performance.now());send(ws,{protocol:'wcw.human/1',type:'chat_receipt',id:raw.id,...receipt});if(receipt.status==='rejected'){const n=(invalid.get(ws)?.count??0)+1;invalid.set(ws,{request:'chat',count:n});if(n>=64)ws.close(1008,'Invalid traffic');}flush();return;}
     }
     const pending=session.pending.get(slot!);
     const key=pending?.requestId??'unsolicited';
     const receipt=session.receive(slot!,isBinary?null:bytes.toString(),performance.now());
     if(pending)send(ws,{protocol:'wcw.player/1',type:'receipt',requestId:pending.requestId,...receipt});
     if(receipt.status==='rejected'||!pending){const count=invalid.get(ws)?.request===key?invalid.get(ws)!.count+1:1;invalid.set(ws,{request:key,count});if(count>=16)ws.close(1008,'Invalid traffic');}
     flush();
    });
    ws.on('close',()=>{if(policies.get(slot!)===ws){policies.delete(slot!);nameDeadlines.delete(slot!);session.disconnect(slot!);}sent.delete(ws);invalid.delete(ws);});
    tick();flush();
   }else{
    const recipient=url.pathname==='/global'?'public':slot!;
    const events=project(session.journal,recipient);viewers.set(ws,{slot:recipient,cursor:events.length});
    send(ws,{protocol:'wcw.viewer/1',type:'reset',episodeId:session.episodeId,throughCursor:events.length,events});
    ws.on('message',()=>ws.close(1008,'Read-only viewer'));ws.on('close',()=>viewers.delete(ws));
   }
  });
 });
 await new Promise<void>((yes,no)=>{http.once('error',no);http.listen(options.port,options.host,()=>{http.off('error',no);yes();});});
 timer=setInterval(tick,10);
 const address=http.address();if(!address||typeof address==='string')throw new Error('No TCP address');
 return {port:address.port,session,completed:completion,close:async()=>{
  if(session instanceof HumanSession)session.cancelModerator();
  if(timer)clearInterval(timer);for(const ws of wss.clients)ws.terminate();wss.close();
  await new Promise<void>((yes,no)=>http.close(error=>error?no(error):yes()));
 }};
}
