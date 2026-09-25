import {DecisionError} from './timed-llm.js';
/** Larger caps are ceilings, not requested answer lengths. */
export function modelSettings(model:string){
 if(model.startsWith('mistralai/'))return {max_tokens:1800,reasoning:{enabled:false,exclude:true}};
 if(model.startsWith('qwen/'))return {max_tokens:1200,reasoning:{enabled:true,effort:'minimal',exclude:true}};
 if(model.startsWith('google/'))return {max_tokens:1600,reasoning:{effort:'minimal',exclude:true}};
 if(model.startsWith('deepseek/'))return {max_tokens:2400,reasoning:{effort:'low',exclude:true}};
 if(/^(moonshotai|z-ai|xiaomi)\//.test(model))return {max_tokens:1600,reasoning:{effort:'low',exclude:true}};
 if(model.startsWith('meta-llama/'))return {max_tokens:800};
 return {max_tokens:1000,reasoning:{effort:'minimal',exclude:true}};
}
/** Every model gets the strict action schema when one is supplied: plain JSON mode let models return `{}` or extra fields. Without require_parameters, providers that cannot enforce it still answer. */
export async function providerCompletion(input:{model:string;messages:unknown[];schema?:Record<string,unknown>;key:string;signal:AbortSignal;metadata:(data:Record<string,unknown>)=>void},fetcher:typeof fetch=fetch){
 const response=await fetcher('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:input.signal,headers:{Authorization:`Bearer ${input.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:input.model,messages:input.messages,...modelSettings(input.model),temperature:.7,response_format:input.schema?{type:'json_schema',json_schema:{name:'game_action',strict:true,schema:input.schema}}:{type:'json_object'},provider:{sort:'throughput'}})});
 input.metadata({httpStatus:response.status});
 if(!response.ok){
  let detail;
  try{detail=await response.json();}catch{}
  const message=typeof detail?.error?.message==='string'?detail.error.message.split(input.key).join('[redacted]').slice(0,500):null;
  input.metadata({providerErrorCode:detail?.error?.code??null,providerErrorMessage:message});
  throw new DecisionError('http_error',`Provider HTTP ${response.status}`,response.status===408||response.status===429||response.status>=500);
 }
 let data;
 try{data=await response.json();}catch{throw new DecisionError('invalid_response','Provider returned invalid JSON');}
 const choice=data.choices?.[0];
 input.metadata({generationId:data.id??null,finishReason:choice?.finish_reason??null,nativeFinishReason:choice?.native_finish_reason??null,usage:data.usage??null,providerErrorCode:data.error?.code??null});
 if(data.error)throw new DecisionError('provider_error','Provider returned an error envelope');
 if(choice?.finish_reason==='length')throw new DecisionError('output_limit','Model reached its output token limit');
 const content=choice?.message?.content;
 if(typeof content!=='string'||!content.trim())throw new DecisionError('empty_response','Provider returned no message content');
 return content;
}
