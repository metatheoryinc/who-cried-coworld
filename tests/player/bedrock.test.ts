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
it('converts messages to Converse and records usage without OpenRouter options',async()=>{
 const send=vi.fn().mockResolvedValue({output:{message:{content:[{text:'{"kind":"vote","target":null,"summary":""}'}]}},stopReason:'end_turn',usage:{inputTokens:25,outputTokens:10},$metadata:{httpStatusCode:200,requestId:'request'}});
 const signal=new AbortController().signal,metadata=vi.fn();
 const text=await bedrockCompletion({model:'test',messages:[{role:'system',content:'Rules'},{role:'user',content:'Decide'}],signal,metadata,maxTokens:600},send);
 expect(JSON.parse(text).kind).toBe('vote');
 expect(send.mock.calls[0]![0].input).toMatchObject({modelId:'test',system:[{text:'Rules'}],messages:[{role:'user',content:[{text:'Decide'}]}],inferenceConfig:{maxTokens:600}});
 expect(send.mock.calls[0]![0].input).not.toHaveProperty('response_format');
 expect(send.mock.calls[0]![1].abortSignal).toBe(signal);
 expect(metadata).toHaveBeenCalledWith(expect.objectContaining({usage:{inputTokens:25,outputTokens:10}}));
});
it('classifies throttle, access denial, and truncated output for bounded fallback',async()=>{
 const input={model:'test',messages:[{role:'user',content:'Decide'}],signal:new AbortController().signal,metadata:vi.fn()};
 await expect(bedrockCompletion(input,vi.fn().mockRejectedValue({name:'ThrottlingException',$metadata:{httpStatusCode:429},message:'sensitive'}))).rejects.toMatchObject({code:'http_error',retryable:true});
 await expect(bedrockCompletion(input,vi.fn().mockRejectedValue({name:'AccessDeniedException',$metadata:{httpStatusCode:403}}))).rejects.toMatchObject({code:'http_error',retryable:false});
 await expect(bedrockCompletion(input,vi.fn().mockResolvedValue({stopReason:'max_tokens'}))).rejects.toMatchObject({code:'output_limit'});
 expect(JSON.stringify(input.metadata.mock.calls)).not.toContain('sensitive');
});
it('sends the real SDK request to the injected endpoint and does not retry HTTP 429',async()=>{
 const {createServer}=await import('node:http');
 let calls=0,path='',body='';
 const server=createServer(async(req,res)=>{calls++;path=req.url??'';for await(const chunk of req)body+=chunk;res.writeHead(429,{'content-type':'application/json','x-amzn-errortype':'ThrottlingException'});res.end(JSON.stringify({message:'Limited'}));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();if(!address||typeof address==='string')throw Error('No port');
 vi.stubEnv('AWS_PROFILE',undefined);vi.stubEnv('AWS_DEFAULT_PROFILE',undefined);vi.stubEnv('AWS_BEARER_TOKEN_BEDROCK',undefined);vi.stubEnv('AWS_BEARER_TOKEN_BEDROCK_FILE',undefined);vi.stubEnv('AWS_SESSION_TOKEN',undefined);vi.stubEnv('AWS_ACCESS_KEY_ID','test');vi.stubEnv('AWS_SECRET_ACCESS_KEY','test');vi.stubEnv('AWS_EC2_METADATA_DISABLED','true');
 try{
  await expect(bedrockCompletion({model:'test-model',endpoint:`http://127.0.0.1:${address.port}`,region:'us-west-2',messages:[{role:'user',content:'Decide'}],metadata:()=>{},signal:AbortSignal.timeout(3000)})).rejects.toMatchObject({code:'http_error',retryable:true});
  expect(calls).toBe(1);expect(path).toContain('/model/test-model/converse');expect(JSON.parse(body).messages[0].content[0].text).toBe('Decide');
 }finally{vi.unstubAllEnvs();await new Promise<void>(r=>server.close(()=>r()));}
});
