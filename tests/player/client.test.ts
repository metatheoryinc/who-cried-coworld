import {expect,it,vi} from 'vitest';
import {WebSocketServer} from 'ws';
import {runPlayerClient} from '../../src/player/client.js';
import {Session} from '../../src/game/runtime/session.js';
import {GameConfig} from '../../src/shared/config.js';
it('deduplicates observations and aborts pending work on shutdown',async()=>{
 const wss=new WebSocketServer({port:0});await new Promise<void>(r=>wss.once('listening',r));
 const address=wss.address();if(!address||typeof address==='string')throw Error('No port');
 const s=new Session(GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`}))}),'test');s.start(0);
 const o=s.observation([...s.pending.keys()][0]!,0)!;
 let signal:AbortSignal|undefined;
 const choose=vi.fn((_o,abort)=>{signal=abort;return new Promise<never>(()=>{});});
 wss.on('connection',ws=>{ws.send(JSON.stringify(o));ws.send(JSON.stringify(o));});
 const client=runPlayerClient(`ws://127.0.0.1:${address.port}`,choose);
 try{await vi.waitFor(()=>expect(choose).toHaveBeenCalledTimes(1));client.stop();await client.done;expect(signal?.aborted).toBe(true);}
 finally{client.stop();for(const ws of wss.clients)ws.terminate();await new Promise<void>(r=>wss.close(()=>r()));}
});
