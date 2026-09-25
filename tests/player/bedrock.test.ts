import {expect,it,vi} from 'vitest';
import {resolveInference} from '../../src/player/inference.js';
import {bedrockCompletion} from '../../src/player/bedrock.js';
it('detects hosted Bedrock and keeps explicit OpenRouter selectable',()=>{
 const env={AWS_ENDPOINT_URL_BEDROCK_RUNTIME:'http://127.0.0.1:9100',BEDROCK_MODEL:'bedrock-model',OPENROUTER_API_KEY:'key',AWS_REGION:'us-west-2'};
 expect(resolveInference(env)).toMatchObject({provider:'bedrock',model:'bedrock-model',endpoint:env.AWS_ENDPOINT_URL_BEDROCK_RUNTIME});
 expect(resolveInference({...env,WCW_LLM_PROVIDER:'openrouter'})).toMatchObject({provider:'openrouter',model:'openai/gpt-oss-120b'});
 expect(resolveInference({USE_BEDROCK:'true',BEDROCK_MODEL:'direct'})).toMatchObject({provider:'bedrock',model:'direct',endpoint:undefined});
 expect(()=>resolveInference({WCW_LLM_PROVIDER:'bedrock'})).toThrow('BEDROCK_MODEL');
 expect(resolveInference({...env,WCW_MODERATOR_BEDROCK_MODEL:'host'},'moderator').model).toBe('host');
});
const response=(body:unknown)=>({body:new TextEncoder().encode(JSON.stringify(body)),$metadata:{httpStatusCode:200,requestId:'request'}});
it('converts messages to Anthropic InvokeModel and records usage without OpenRouter options',async()=>{
 const send=vi.fn().mockResolvedValue(response({content:[{type:'text',text:'{"kind":"vote","target":null,"summary":""}'}],stop_reason:'end_turn',usage:{input_tokens:25,output_tokens:10}}));
 const signal=new AbortController().signal,metadata=vi.fn();
 const text=await bedrockCompletion({model:'test',messages:[{role:'system',content:'Rules'},{role:'user',content:'Decide'}],signal,metadata,maxTokens:600},send);
 expect(JSON.parse(text).kind).toBe('vote');
 expect(send.mock.calls[0]![0].input).toMatchObject({modelId:'test',contentType:'application/json',accept:'application/json'});
 expect(JSON.parse(send.mock.calls[0]![0].input.body)).toMatchObject({anthropic_version:'bedrock-2023-05-31',system:'Rules',messages:[{role:'user',content:[{type:'text',text:'Decide'}]}],max_tokens:600});
 expect(send.mock.calls[0]![0].input).not.toHaveProperty('response_format');
 expect(send.mock.calls[0]![1].abortSignal).toBe(signal);
 expect(metadata).toHaveBeenCalledWith(expect.objectContaining({usage:{inputTokens:25,outputTokens:10}}));
});
it('classifies throttle, access denial, and truncated output for bounded fallback',async()=>{
 const input={model:'test',messages:[{role:'user',content:'Decide'}],signal:new AbortController().signal,metadata:vi.fn()};
 await expect(bedrockCompletion(input,vi.fn().mockRejectedValue({name:'ThrottlingException',$metadata:{httpStatusCode:429},message:'sensitive'}))).rejects.toMatchObject({code:'http_error',retryable:true});
 await expect(bedrockCompletion(input,vi.fn().mockRejectedValue({name:'AccessDeniedException',$metadata:{httpStatusCode:403}}))).rejects.toMatchObject({code:'http_error',retryable:false});
 await expect(bedrockCompletion(input,vi.fn().mockResolvedValue(response({stop_reason:'max_tokens'})))).rejects.toMatchObject({code:'output_limit'});
 expect(JSON.stringify(input.metadata.mock.calls)).not.toContain('sensitive');
});
it('sends the hosted Messages request to the injected endpoint and does not retry HTTP 429',async()=>{
 const {createServer}=await import('node:http');
 let calls=0,path='',body='',succeed=false;
 const server=createServer(async(req,res)=>{calls++;path=req.url??'';body='';for await(const chunk of req)body+=chunk;if(succeed){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({content:[{type:'text',text:'Model reply'}],stop_reason:'end_turn',usage:{input_tokens:2,output_tokens:3}}));return;}res.writeHead(429,{'content-type':'application/json','x-amzn-errortype':'ThrottlingException'});res.end(JSON.stringify({message:'Limited'}));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();if(!address||typeof address==='string')throw Error('No port');
 vi.stubEnv('AWS_PROFILE',undefined);vi.stubEnv('AWS_DEFAULT_PROFILE',undefined);vi.stubEnv('AWS_BEARER_TOKEN_BEDROCK',undefined);vi.stubEnv('AWS_BEARER_TOKEN_BEDROCK_FILE',undefined);vi.stubEnv('AWS_SESSION_TOKEN',undefined);vi.stubEnv('AWS_ACCESS_KEY_ID','test');vi.stubEnv('AWS_SECRET_ACCESS_KEY','test');vi.stubEnv('AWS_EC2_METADATA_DISABLED','true');
 try{
  await expect(bedrockCompletion({model:'anthropic/claude-haiku-4.5',endpoint:`http://127.0.0.1:${address.port}`,region:'us-west-2',messages:[{role:'user',content:'Decide'}],metadata:()=>{},signal:AbortSignal.timeout(3000)})).rejects.toMatchObject({code:'http_error',retryable:true});
  expect(calls).toBe(1);expect(path).toBe('/v1/messages');expect(JSON.parse(body)).not.toHaveProperty('anthropic_version');expect(JSON.parse(body).model).toBe('anthropic/claude-haiku-4.5');expect(JSON.parse(body).messages[0].content[0].text).toBe('Decide');
  succeed=true;
  await expect(bedrockCompletion({model:'anthropic/claude-haiku-4.5',endpoint:`http://127.0.0.1:${address.port}`,region:'us-west-2',messages:[{role:'user',content:'Decide'}],metadata:()=>{},signal:AbortSignal.timeout(3000)})).resolves.toBe('Model reply');
  expect(calls).toBe(2);
 }finally{vi.unstubAllEnvs();await new Promise<void>(r=>server.close(()=>r()));}
});

it('rejects malformed JSON responses and distinguishes empty or refused content',async()=>{
 const input={model:'test',messages:[{role:'user',content:'Decide'}],signal:new AbortController().signal,metadata:vi.fn()};
 await expect(bedrockCompletion(input,vi.fn().mockResolvedValue({body:new TextEncoder().encode('not json')}))).rejects.toMatchObject({code:'invalid_response'});
 await expect(bedrockCompletion(input,vi.fn().mockResolvedValue(response({content:[],stop_reason:'end_turn'})))).rejects.toMatchObject({code:'empty_response'});
 await expect(bedrockCompletion(input,vi.fn().mockResolvedValue(response({content:[],stop_reason:'refusal'})))).rejects.toMatchObject({code:'refused',retryable:false});
});

it('routes non-Claude hosted models to chat completions without personal credentials',async()=>{
 const fetcher=vi.fn(async(_url:string,_init:any)=>new Response(JSON.stringify({choices:[{message:{content:'reply'},finish_reason:'stop'}]})));
 vi.stubGlobal('fetch',fetcher);
 try{
  await expect(bedrockCompletion({model:'google/gemini-test',endpoint:'http://localhost:9100/',messages:[{role:'user',content:'Hi'}],signal:AbortSignal.timeout(1000),metadata:()=>{}})).resolves.toBe('reply');
  expect(fetcher.mock.calls[0]![0]).toBe('http://localhost:9100/v1/chat/completions');
  expect(fetcher.mock.calls[0]![1].headers.Authorization).toBe('Bearer sidecar');
  expect(JSON.parse(fetcher.mock.calls[0]![1].body).stream).toBe(false);
  // Hosted chat models get the same per-model settings and strict schema as direct OpenRouter calls.
  await bedrockCompletion({model:'z-ai/glm-test',endpoint:'http://localhost:9100',schema:{type:'object'},messages:[{role:'user',content:'Hi'}],signal:AbortSignal.timeout(1000),metadata:()=>{}});
  expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toMatchObject({max_tokens:1600,reasoning:{effort:'low',exclude:true},response_format:{type:'json_schema',json_schema:{name:'game_action',strict:true,schema:{type:'object'}}}});
  await expect(bedrockCompletion({model:'us.anthropic.old-model:0',endpoint:'http://localhost:9100',messages:[],signal:AbortSignal.timeout(1000),metadata:()=>{}})).rejects.toMatchObject({code:'invalid_request',retryable:false});
  expect(fetcher).toHaveBeenCalledTimes(2);
 }finally{vi.unstubAllGlobals();}
});
