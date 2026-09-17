import {expect,it,vi} from 'vitest';
import {probeBedrock} from '../../src/player/diagnostic.js';
const env={AWS_ENDPOINT_URL_BEDROCK_RUNTIME:'http://localhost:9100',BEDROCK_MODEL:'test',AWS_SECRET_ACCESS_KEY:'SECRET'};
it('reports missing configuration without making a network call',async()=>{
 const fetcher=vi.fn();const model=vi.fn();
 const text=await probeBedrock({},new AbortController().signal,{fetcher,model});
 expect(text).toContain('endpoint missing');expect(fetcher).not.toHaveBeenCalled();expect(model).not.toHaveBeenCalled();
});
it('checks health and spend and makes exactly one tiny call',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('ok')).mockResolvedValueOnce(Response.json({spend_limit_usd:null,remaining_usd:null}));
 const model=vi.fn().mockResolvedValue('SECRET model output');
 const text=await probeBedrock(env,new AbortController().signal,{fetcher,model});
 expect(text).toContain('health HTTP 200');expect(text).toContain('spend unlimited');expect(text).toContain('model OK');expect(text).not.toMatch(/SECRET|localhost/);
 expect(model).toHaveBeenCalledTimes(1);expect(model.mock.calls[0]![0].maxTokens).toBe(32);
});
it('reports zero allowance and sanitizes errors',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('ok')).mockResolvedValueOnce(Response.json({spend_limit_usd:0,remaining_usd:0}));
 const model=vi.fn().mockRejectedValue(new Error('SECRET token=bad'));
 const text=await probeBedrock(env,new AbortController().signal,{fetcher,model});
 expect(text).toContain('spend exhausted');expect(text).toContain('model failed');expect(text).not.toMatch(/SECRET|token/);
});

import {diagnosticAction} from '../../src/player/diagnostic.js';
import {Session} from '../../src/game/runtime/session.js';
import {GameConfig} from '../../src/shared/config.js';
it('plays a whole protocol cycle legally with diagnostic speech and abstentions',()=>{
 const s=new Session(GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`})),seed:'000102030405060708090a0b0c0d0e0f',windowMs:100,maxDays:1}),'diagnostic');s.start(0);
 for(let now=0;!s.state.result&&now<10000;now+=100){
  for(const slot of s.pending.keys()){
   const o=s.observation(slot,now+1)!;
   expect(s.receive(slot,JSON.stringify(diagnosticAction(o,'endpoint missing; model missing')),now+1).status).toBe('accepted');
  }
  s.advance(now+100);
 }
 expect(s.state.result).not.toBeNull();expect(s.journal.filter(e=>e.payload.kind==='failure')).toEqual([]);
 expect(s.journal.some(e=>e.payload.kind==='speech'&&e.payload.speech.text.includes('endpoint missing'))).toBe(true);
});

import {environmentPages,diagnosticReporter} from '../../src/player/diagnostic.js';
it('paginates every environment name and presence without exposing values',()=>{
 const env:NodeJS.ProcessEnv={EMPTY:'',WHITESPACE:' ',UNSET:undefined,API_KEY:'secret-value',SOFTMAX_NEW_ENDPOINT:'https://secret.example?token=hidden'};
 for(let i=0;i<80;i++)env[`EXTRA_${i}`]='never-print-this';
 const pages=environmentPages(env),text=pages.join('');
 expect(pages.length).toBeGreaterThan(1);
 expect(text).toContain('"EMPTY":empty');expect(text).toContain('"WHITESPACE":populated');expect(text).not.toContain('UNSET');
 expect(text).toContain('"SOFTMAX_NEW_ENDPOINT":populated');expect(text).not.toMatch(/secret-value|secret.example|hidden|never-print/);
 for(const p of pages)expect(p.length).toBeLessThanOrEqual(430);
});
it('advances public pages only once per request and keeps private chat from consuming pages',()=>{
 const s=new Session(GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`}))}),'diag');s.start(0);
 const o=s.observation([...s.pending.keys()][0]!,1)!;
 const report=diagnosticReporter({RENAMED_MODEL:'secret'});
 const bid={...o,request:{kind:'bid' as const,window:0,maxCharacters:480 as const},requestId:'one'};
 expect(report(bid,'probe result')).toContain('ENV 1/1');
 expect(report({...bid,attempt:1},'new result')).toContain('ENV 1/1');
 report({...bid,requestId:'private',request:{kind:'wolf_chat',turn:0,maxCharacters:480}},'private result');
 expect(report({...bid,requestId:'two'},'probe result')).toBe('probe result');
 expect(report({...bid,requestId:'three'},'probe result')).toContain('ENV 1/1');
});

it('compresses Kubernetes discovery noise and prioritizes inference names',()=>{
 const env:NodeJS.ProcessEnv={ZZ_BEDROCK_URL:'private',ZZ_MODEL:'private',AWS_REGION:'private',API_TOKEN:'private',HOME:'private',CUSTOM_PORT:'private'};
 for(let i=0;i<1000;i++){
  env[`COWORLD_PLAY_${i}_PORT`]='tcp://private';
  env[`COWORLD_PLAY_${i}_PORT_8080_TCP_ADDR`]='private';
  env[`COWORLD_PLAY_${i}_SERVICE_HOST`]='private';
 }
 const pages=environmentPages(env),text=pages.join('');
 expect(pages.length).toBeLessThanOrEqual(2);
 expect(pages[0]).toContain('ZZ_BEDROCK_URL');
 expect(text.indexOf('ZZ_MODEL')).toBeLessThan(text.indexOf('HOME'));
 expect(text).toContain('3000 service-discovery variables summarized');
 expect(text).not.toMatch(/COWORLD_PLAY_|private/);
 expect(text).toContain('CUSTOM_PORT');
});
