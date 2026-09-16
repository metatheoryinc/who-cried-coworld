import { expect,it } from 'vitest';
import WebSocket from 'ws';
import { startServer } from '../../src/game/runtime/server.js';
import { GameConfig } from '../../src/shared/config.js';
import { scriptedAction } from '../../src/player/scripted.js';
import { Observation } from '../../src/shared/player.js';
const c=()=>GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`})),seed:'000102030405060708090a0b0c0d0e0f',maxDays:1,windowMs:100,player_connect_timeout_seconds:1});
it('runs authenticated policy sockets to a complete replay and rejects bad credentials',async()=>{
 const server=await startServer(c(),{port:0,host:'127.0.0.1'});
 const clients:WebSocket[]=[];
 try{
  expect((await fetch(`http://127.0.0.1:${server.port}/healthz`)).status).toBe(200);
  expect((await fetch(`http://127.0.0.1:${server.port}/client/player?slot=0&token=bad`)).status).toBe(401);
  const pong=new Promise<void>((resolve,reject)=>{
   const viewer=new WebSocket(`ws://127.0.0.1:${server.port}/global`);clients.push(viewer);
   viewer.on('error',reject);viewer.on('open',()=>viewer.ping('sentinel'));viewer.on('pong',data=>{expect(data.toString()).toBe('sentinel');resolve();});
  });
  await pong;
  for(let slot=0;slot<9;slot++){
   const ws=new WebSocket(`ws://127.0.0.1:${server.port}/player?slot=${slot}&token=t${slot}`);clients.push(ws);
   ws.on('message',bytes=>{const raw=JSON.parse(bytes.toString());if(raw.type==='observation')ws.send(JSON.stringify(scriptedAction(Observation.parse(raw))));if(raw.type==='end')ws.close();});
  }
  const replay=await server.completed;
  expect(replay.complete).toBe(true);expect(replay.events.some(e=>e.payload.kind==='speech')).toBe(true);
  expect(replay.events.filter(e=>e.payload.kind==='failure')).toEqual([]);
 }finally{for(const ws of clients)ws.terminate();await server.close();}
},10000);
it('completes with silent and malformed policies without leaking their failures publicly',async()=>{
 const server=await startServer(c(),{port:0,host:'127.0.0.1'});
 const clients:WebSocket[]=[],publicPackets:string[]=[];
 try{
  const viewer=new WebSocket(`ws://127.0.0.1:${server.port}/global`);clients.push(viewer);viewer.on('message',b=>publicPackets.push(b.toString()));
  for(let slot=0;slot<9;slot++){
   const ws=new WebSocket(`ws://127.0.0.1:${server.port}/player?slot=${slot}&token=t${slot}`);clients.push(ws);
   ws.on('message',bytes=>{const raw=JSON.parse(bytes.toString());if(raw.type==='observation'){
    if(slot===0)return;
    if(slot===1){ws.send('{"secret":"DO_NOT_EXPORT"}');return;}
    ws.send(JSON.stringify(scriptedAction(Observation.parse(raw))));
   }if(raw.type==='end')ws.close();});
  }
  const replay=await server.completed;
  const failures=replay.events.filter(e=>e.payload.kind==='failure').map(e=>e.payload);
  expect(failures.some(e=>e.kind==='failure'&&e.code==='timeout')).toBe(true);
  expect(failures.some(e=>e.kind==='failure'&&e.code==='malformed'&&e.disposition==='fallback')).toBe(true);
  expect(JSON.stringify(replay)).not.toContain('DO_NOT_EXPORT');
  expect(publicPackets.join('')).not.toMatch(/DO_NOT_EXPORT|"roles"|"seed"|"failure"|"night_choices"|"audience"/);
 }finally{for(const ws of clients)ws.terminate();await server.close();}
},10000);
it('reserves a human seat, waits in lobby, and reconnects with private state',async()=>{
 const config=GameConfig.parse({...c(),mode:'human',humanSlot:1});
 const server=await startServer(config,{port:0,host:'127.0.0.1'}),clients:WebSocket[]=[];
 const connect=(path:string)=>new Promise<WebSocket>((yes,no)=>{const ws=new WebSocket(`ws://127.0.0.1:${server.port}${path}`);clients.push(ws);ws.once('open',()=>yes(ws));ws.once('error',no);});
 try{
  await expect(connect('/player?slot=1&token=t1')).rejects.toThrow();
  for(const slot of [0,2,3,4,5,6,7,8])await connect(`/player?slot=${slot}&token=t${slot}`);
  await new Promise(r=>setTimeout(r,1100));expect(server.session.phase).toBe('waiting');
  const snapshot=new Promise<any>((yes,no)=>{const ws=new WebSocket(`ws://127.0.0.1:${server.port}/human?slot=1&token=t1`);clients.push(ws);ws.on('error',no);ws.on('message',b=>{const p=JSON.parse(b.toString());if(p.type==='snapshot'&&p.self)yes(p);});});
  const first=await snapshot;expect(first.self.slot).toBe(1);expect(first.remainingMs).toBeGreaterThan(140000);
  expect(JSON.stringify(first)).not.toMatch(/"seed"|"kind":"roles"|"tokens"/);
  clients.at(-1)!.close();await new Promise(r=>setTimeout(r,40));
  const again=new Promise<any>((yes,no)=>{const ws=new WebSocket(`ws://127.0.0.1:${server.port}/human?slot=1&token=t1`);clients.push(ws);ws.on('error',no);ws.on('message',b=>{const p=JSON.parse(b.toString());if(p.type==='snapshot')yes(p);});});
  expect((await again).self).toEqual(first.self);
 }finally{for(const ws of clients)ws.terminate();await server.close();}
},5000);
