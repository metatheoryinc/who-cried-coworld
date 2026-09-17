import {expect,it,vi} from 'vitest';
import {createRuntimeModerator} from '../../src/game/runtime/moderator.js';
import {startServer} from '../../src/game/runtime/server.js';
import {GameConfig} from '../../src/shared/config.js';
const input={day:1,humanSlot:-1,roster:[{slot:0,name:'ChatGPT',alive:true}],counts:{},recent:[],eligibleSlots:[0],humanMessage:null,transcript:[]};
it('uses deterministic selection without credentials or when explicitly off',()=>{
 expect(createRuntimeModerator({})).toBeUndefined();
 expect(createRuntimeModerator({WCW_MODERATOR:'off',OPENROUTER_API_KEY:'secret'})).toBeUndefined();
 expect(()=>createRuntimeModerator({WCW_MODERATOR:'llm'})).toThrow('credential');
 expect(()=>createRuntimeModerator({WCW_MODERATOR:'invalid'})).toThrow('WCW_MODERATOR');
});
it('uses runtime credentials and model settings and records a validated choice',async()=>{
 const log=vi.fn(),fetcher=vi.fn().mockResolvedValue(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({slot:0,prompt:'ChatGPT, what would you add?'})}}]}));
 const moderator=createRuntimeModerator({WCW_MODERATOR_API_KEY:'host-secret',OPENROUTER_HOST_MODEL:'test-model',OPENROUTER_HOST_PROVIDER:''},log,fetcher)!;
 expect((await moderator(input,new AbortController().signal)).slot).toBe(0);
 const options=fetcher.mock.calls[0]![1];expect(options.headers.Authorization).toBe('Bearer host-secret');
 expect(JSON.parse(options.body)).toMatchObject({model:'test-model'});
 expect(JSON.parse(options.body)).not.toHaveProperty('provider');
 expect(JSON.stringify(log.mock.calls)).not.toContain('host-secret');
 expect(log).toHaveBeenCalledWith(expect.objectContaining({outcome:'selected'}));
});
it('does not leak transport error details into diagnostics',async()=>{
 const log=vi.fn();const moderator=createRuntimeModerator({OPENROUTER_API_KEY:'secret'},log,vi.fn().mockRejectedValue(Error('secret transport details')))!;
 await expect(moderator(input,new AbortController().signal)).rejects.toThrow('transport');
 expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
 expect(log).toHaveBeenCalledWith(expect.objectContaining({outcome:'fallback'}));
});
it('initializes the moderator through the game server without the local launcher',async()=>{
 const config=GameConfig.parse({mode:'bots',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`}))});
 const server=await startServer(config,{port:0,host:'127.0.0.1',moderatorEnvironment:{OPENROUTER_API_KEY:'test'}});
 try{expect('moderator' in server.session&&typeof server.session.moderator).toBe('function');}
 finally{await server.close();}
});
it('falls back inside the server when the runtime provider fails',async()=>{
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:429}));
 const log=vi.fn();
 const config=GameConfig.parse({mode:'bots',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`}))});
 const server=await startServer(config,{port:0,host:'127.0.0.1',moderatorEnvironment:{OPENROUTER_API_KEY:'secret'},onModeratorLog:log});
 try{
  const now=performance.now();server.session.start(now);
  await vi.waitFor(()=>expect(server.session.pending.get(0)?.request.kind).toBe('bid'));
  expect(server.session.deadline).toBe(now+13000);
  expect(log).toHaveBeenCalledWith(expect.objectContaining({outcome:'fallback',error:'Moderator HTTP 429'}));
 }finally{await server.close();fetcher.mockRestore();}
});
it('uses the game Bedrock endpoint and model without OpenRouter credentials',async()=>{
 const send=vi.fn().mockResolvedValue({body:new TextEncoder().encode(JSON.stringify({content:[{type:'text',text:JSON.stringify({slot:0,prompt:'ChatGPT, what would you add?'})}],stop_reason:'end_turn'}))});
 const log=vi.fn(),http=vi.fn();
 const moderator=createRuntimeModerator({AWS_ENDPOINT_URL_BEDROCK_RUNTIME:'http://127.0.0.1:9100',WCW_MODERATOR_BEDROCK_MODEL:'host-model'},log,http,send)!;
 expect((await moderator(input,new AbortController().signal)).slot).toBe(0);
 expect(http).not.toHaveBeenCalled();expect(send.mock.calls[0]![0].input).toMatchObject({modelId:'host-model'});expect(JSON.parse(send.mock.calls[0]![0].input.body).max_tokens).toBe(600);
 expect(log).toHaveBeenCalledWith(expect.objectContaining({provider:'bedrock',outcome:'selected'}));
});
it('starts a paced game with deterministic moderation when the sidecar has no host model',async()=>{
 const log=vi.fn();
 const config=GameConfig.parse({mode:'bots',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`}))});
 const server=await startServer(config,{port:0,host:'127.0.0.1',moderatorEnvironment:{AWS_ENDPOINT_URL_BEDROCK_RUNTIME:'http://127.0.0.1:9100'},onModeratorLog:log});
 try{
  server.session.start(performance.now());
  expect(server.session.pending.get(0)?.request.kind).toBe('bid');
  expect(log).toHaveBeenCalledWith(expect.objectContaining({outcome:'fallback',reason:'invalid_configuration'}));
 }finally{await server.close();}
});
it('still rejects missing Bedrock models when an LLM moderator is explicitly required',()=>{
 expect(()=>createRuntimeModerator({WCW_MODERATOR:'llm',AWS_ENDPOINT_URL_BEDROCK_RUNTIME:'http://127.0.0.1:9100'})).toThrow('BEDROCK_MODEL');
});
it('keeps automatic configuration fallback safe even if logging fails',()=>{
 const env={AWS_ENDPOINT_URL_BEDROCK_RUNTIME:'not-a-url-secret',BEDROCK_MODEL:'host'};
 const log=vi.fn();expect(createRuntimeModerator(env,log)).toBeUndefined();
 expect(JSON.stringify(log.mock.calls)).not.toContain('not-a-url-secret');
 expect(createRuntimeModerator(env,()=>{throw Error('log unavailable');})).toBeUndefined();
});
it.each(['human','bots'] as const)('honors explicit moderator config over environment in %s mode',async mode=>{
 const base={mode,tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`}))};
 const env={WCW_MODERATOR:'llm',OPENROUTER_API_KEY:'test'};
 const deterministic=await startServer(GameConfig.parse({...base,moderator:'default'}),{port:0,host:'127.0.0.1',moderatorEnvironment:env});
 try{expect('moderator' in deterministic.session&&deterministic.session.moderator).toBeUndefined();expect(env.WCW_MODERATOR).toBe('llm');}
 finally{await deterministic.close();}
 const llm=await startServer(GameConfig.parse({...base,moderator:'llm'}),{port:0,host:'127.0.0.1',moderatorEnvironment:{...env,WCW_MODERATOR:'off'}});
 try{expect('moderator' in llm.session&&typeof llm.session.moderator).toBe('function');}
 finally{await llm.close();}
 await expect(startServer(GameConfig.parse({...base,moderator:'llm'}),{port:0,host:'127.0.0.1',moderatorEnvironment:{}})).rejects.toThrow('credential');
 const auto=await startServer(GameConfig.parse({...base,moderator:'auto'}),{port:0,host:'127.0.0.1',moderatorEnvironment:{WCW_MODERATOR:'llm'}});
 try{expect('moderator' in auto.session&&auto.session.moderator).toBeUndefined();}
 finally{await auto.close();}
});
