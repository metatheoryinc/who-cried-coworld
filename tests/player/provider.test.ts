import {expect,it,vi} from 'vitest';
import {providerCompletion,modelSettings} from '../../src/player/provider.js';
const input=(metadata=vi.fn())=>({model:'mistralai/test',messages:[],key:'test-key',signal:new AbortController().signal,metadata});
it('records HTTP failures and does not retry permanent request errors',async()=>{
 const i=input();
 await expect(providerCompletion(i,vi.fn().mockResolvedValue(new Response('',{status:400})))).rejects.toMatchObject({code:'http_error',retryable:false});
 expect(i.metadata).toHaveBeenCalledWith({httpStatus:400});
});
it('records truncation, finish reason and usage even when completion fails',async()=>{
 const i=input();
 await expect(providerCompletion(i,vi.fn().mockResolvedValue(Response.json({id:'g1',choices:[{finish_reason:'length',message:{content:'{'}}],usage:{completion_tokens:1800}})))).rejects.toMatchObject({code:'output_limit'});
 expect(i.metadata).toHaveBeenLastCalledWith(expect.objectContaining({finishReason:'length',generationId:'g1',usage:{completion_tokens:1800}}));
});
it('uses per-model settings in the outgoing request and returns content',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({choices:[{finish_reason:'stop',message:{content:'{}'}}]}));
 expect(await providerCompletion(input(),fetcher)).toBe('{}');
 const body=JSON.parse(fetcher.mock.calls[0]![1].body);
 expect(body).toMatchObject({max_tokens:1800,temperature:.7});expect(body).not.toHaveProperty('reasoning');
 expect(modelSettings('openai/gpt-5.6-luna-pro')).not.toHaveProperty('temperature');expect(modelSettings('openai/gpt-oss-120b')).toHaveProperty('temperature');
 expect(modelSettings('meta-llama/test')).not.toHaveProperty('reasoning');
 expect(modelSettings('google/test')).toMatchObject({max_tokens:1600,reasoning:{effort:'minimal'}});
});
it('keeps mandatory reasoning enabled at minimal effort for Qwen',async()=>{
 expect(modelSettings('qwen/qwen3.8-max')).toMatchObject({reasoning:{enabled:true,effort:'minimal',exclude:true}});
 const fetcher=vi.fn(async(_url:unknown,init:any)=>{
  const body=JSON.parse(init.body);
  return body.reasoning?.enabled===false
   ?Response.json({error:{code:400,message:'Reasoning is mandatory for this endpoint and cannot be disabled.'}},{status:400})
   :Response.json({choices:[{finish_reason:'stop',message:{content:'{}'}}]});
 });
 await expect(providerCompletion({...input(),model:'qwen/qwen3.8-max'},fetcher)).resolves.toBe('{}');
});
it.each(['google/gemini-3.1-pro-preview','z-ai/glm-5.3','openai/gpt-oss-120b','anthropic/claude-opus-5'])('sends %s the action schema as a strict structured output contract',async model=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({choices:[{finish_reason:'stop',message:{content:'{}'}}]}));
 await providerCompletion({...input(),model,schema:{type:'object'}},fetcher);
 const body=JSON.parse(fetcher.mock.calls[0]![1].body);
 expect(body.response_format).toMatchObject({type:'json_schema',json_schema:{name:'game_action',strict:true,schema:{type:'object'}}});
 // Unsupported providers fall back to unconstrained output instead of failing the request.
 expect(body.provider).not.toHaveProperty('require_parameters');
});
it('falls back to JSON mode when no action schema is supplied',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({choices:[{finish_reason:'stop',message:{content:'{}'}}]}));
 await providerCompletion({...input(),model:'z-ai/glm-5.3'},fetcher);
 expect(JSON.parse(fetcher.mock.calls[0]![1].body).response_format).toEqual({type:'json_object'});
});
