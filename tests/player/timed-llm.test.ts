import { expect,it,vi } from 'vitest';
import { timedAction } from '../../src/player/timed-llm.js';
import { Session } from '../../src/game/runtime/session.js';
import { GameConfig } from '../../src/shared/config.js';
const obs=()=>{const s=new Session(GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`}))}),'episode');s.start(0);return {...s.observation([...s.pending.keys()][0]!,0)!,remainingMs:45000};};
it('bounds a hung provider to fifteen seconds and returns legal fallback',async()=>{
 vi.useFakeTimers();try{const complete=vi.fn(()=>new Promise<string>(()=>{}));const pending=timedAction(obs(),complete);await vi.advanceTimersByTimeAsync(15000);const a=await pending;expect(complete).toHaveBeenCalledTimes(1);expect(a.report?.code).toBe('provider_error');}finally{vi.useRealTimers();}
});
it('repairs malformed output once without extending the action budget',async()=>{
 const complete=vi.fn().mockResolvedValueOnce('bad json').mockResolvedValueOnce(JSON.stringify({kind:'wolf_chat',text:'Coordinate here.',summary:''}));
 const a=await timedAction(obs(),complete);expect(a.report).toBeNull();expect(complete).toHaveBeenCalledTimes(2);
});

it('lets a hung first attempt use the full thirteen-second discussion turn',async()=>{
 vi.useFakeTimers();try{
  const complete=vi.fn(()=>new Promise<string>(()=>{}));
  const pending=timedAction({...obs(),remainingMs:13000},complete);
  await vi.advanceTimersByTimeAsync(12900);
  const action=await pending;
  expect(complete).toHaveBeenCalledTimes(1);expect(action.report?.code).toBe('provider_error');
 }finally{vi.useRealTimers();}
});

it('accepts a slow first response instead of aborting it to reserve a retry',async()=>{
 vi.useFakeTimers();try{
  const complete=vi.fn(()=>new Promise<string>(resolve=>setTimeout(()=>resolve(JSON.stringify({kind:'wolf_chat',text:'Ready.',summary:''})),11000)));
  const pending=timedAction({...obs(),remainingMs:13000},complete);
  await vi.advanceTimersByTimeAsync(11000);
  expect((await pending).report).toBeNull();expect(complete).toHaveBeenCalledTimes(1);
 }finally{vi.useRealTimers();}
});
it('returns an empty night action without contacting the provider',async()=>{
 const complete=vi.fn();
 const result=await timedAction({...obs(),request:{kind:'night',choices:[]}},complete);
 expect(complete).not.toHaveBeenCalled();expect(result.body).toMatchObject({kind:'night',actions:[]});expect(result.report).toBeNull();
});
it('records invalid actions separately from provider failures',async()=>{
 const logs:unknown[]=[];
 await timedAction(obs(),async()=> 'bad json',log=>logs.push(log));
 expect(logs).toHaveLength(2);expect(logs[0]).toMatchObject({attempt:1,outcome:'failed',errorCode:'invalid_action'});
});
it('does not retry an early failure with less than two seconds remaining',async()=>{
 vi.useFakeTimers();try{
  const complete=vi.fn(()=>new Promise<string>(resolve=>setTimeout(()=>resolve('bad json'),11500)));
  const pending=timedAction({...obs(),remainingMs:13000},complete);
  await vi.advanceTimersByTimeAsync(11500);
  expect((await pending).report?.attempts).toBe(1);expect(complete).toHaveBeenCalledTimes(1);
 }finally{vi.useRealTimers();}
});
it('logs rejected model text and gives the retry field-specific guidance',async()=>{
 const logs:any[]=[];
 const bad=JSON.stringify({kind:'wolf_chat',text:'hello',summary:'x'.repeat(241)});
 const complete=vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(JSON.stringify({kind:'wolf_chat',text:'hello',summary:''}));
 expect((await timedAction(obs(),complete,l=>logs.push(l))).report).toBeNull();
 expect(logs[0].responseExcerpt).toBe(bad);
 expect(complete.mock.calls[1]![1]).toContain('summary');
 expect(complete.mock.calls[1]![1]).toContain('240');
});
