import {NodeHttpHandler} from '@smithy/node-http-handler';
import {BedrockRuntimeClient,InvokeModelCommand,type InvokeModelCommandOutput} from '@aws-sdk/client-bedrock-runtime';
import {DecisionError} from './timed-llm.js';
export type BedrockInput={model:string;messages:{role:string;content:string}[];signal:AbortSignal;metadata:(data:Record<string,unknown>)=>void;endpoint?:string;region?:string;maxTokens?:number};
export type BedrockSender=(command:InvokeModelCommand,options:{abortSignal:AbortSignal})=>Promise<InvokeModelCommandOutput>;
export async function bedrockCompletion(input:BedrockInput,sender?:BedrockSender):Promise<string>{
 const messages:{role:'user'|'assistant';content:{type:'text';text:string}[]}[]=[],system:string[]=[];
 for(const message of input.messages){
  if(message.role==='system'){system.push(message.content);continue;}
  if(message.role!=='user'&&message.role!=='assistant')throw new DecisionError('invalid_request','Unsupported message role',false);
  const previous=messages.at(-1);
  if(previous?.role===message.role)previous.content!.push({type:'text',text:message.content});
  else messages.push({role:message.role,content:[{type:'text',text:message.content}]});
 }
 // The historical endpoint variable now identifies Softmax's OpenRouter proxy.
 if(input.endpoint&&!sender){
  if(!/^[a-z0-9-]+\/[a-z0-9][a-z0-9._:-]*$/i.test(input.model))throw new DecisionError('invalid_request','Hosted model must be a canonical OpenRouter slug',false);
  const claude=input.model.startsWith('anthropic/');
  const url=`${input.endpoint.replace(/\/$/,'')}/v1/${claude?'messages':'chat/completions'}`;
  input.metadata({provider:'softmax',endpoint:url});
  let response:Response;
  try{
   response=await fetch(url,{method:'POST',redirect:'error',signal:input.signal,headers:{'Content-Type':'application/json',...(claude?{'x-api-key':'sidecar','anthropic-version':'2023-06-01'}:{Authorization:'Bearer sidecar'})},body:JSON.stringify(claude?{model:input.model,system:system.join('\n\n'),messages,max_tokens:input.maxTokens??1600,stream:false}:{model:input.model,messages:input.messages,max_tokens:input.maxTokens??1600,stream:false})});
  }catch{
   throw new DecisionError(input.signal.aborted?'timeout':'transport_error','Hosted proxy request failed',!input.signal.aborted);
  }
  input.metadata({httpStatus:response.status});
  let body:any;
  try{body=await response.json();}catch{
   if(!response.ok)throw new DecisionError('http_error',`Hosted proxy HTTP ${response.status}`,response.status===408||response.status===429||response.status>=500);
   throw new DecisionError('invalid_response','Hosted proxy returned invalid JSON');
  }
  if(!response.ok){
   // Error types are useful diagnostics; never echo arbitrary response bodies.
   const code=body?.error?.type??body?.error?.code;
   input.metadata({providerErrorCode:typeof code==='string'&&/^[a-z0-9_-]{1,80}$/i.test(code)?code:null});
   throw new DecisionError('http_error',`Hosted proxy HTTP ${response.status}`,response.status===408||response.status===429||response.status>=500);
  }
  if(!body||typeof body!=='object'||Array.isArray(body))throw new DecisionError('invalid_response','Hosted proxy returned invalid JSON object');
  const finish=claude?body.stop_reason:body.choices?.[0]?.finish_reason;
  input.metadata({generationId:body.id??null,finishReason:finish??null,usage:body.usage??null});
  if(finish==='max_tokens'||finish==='length')throw new DecisionError('output_limit','Model reached its output token limit');
  if(['refusal','content_filter'].includes(finish))throw new DecisionError('refused','Hosted model declined the request',false);
  const text=claude?(Array.isArray(body.content)?body.content.filter((b:any)=>b?.type==='text'&&typeof b.text==='string').map((b:any)=>b.text).join(''):''):body.choices?.[0]?.message?.content;
  if(typeof text!=='string'||!text.trim())throw new DecisionError('empty_response','Hosted proxy returned no message content');
  return text;
 }
 // Disable SDK retries: timedAction owns retry count and the decision deadline.
 const client=sender?undefined:new BedrockRuntimeClient({endpoint:input.endpoint,region:input.region,maxAttempts:1,requestHandler:new NodeHttpHandler()});
 input.metadata({provider:'bedrock',endpoint:input.endpoint??'AWS default endpoint'});
 let data:InvokeModelCommandOutput;
 try{
  const command=new InvokeModelCommand({modelId:input.model,contentType:'application/json',accept:'application/json',body:JSON.stringify({anthropic_version:'bedrock-2023-05-31',system:system.join('\n\n'),messages,max_tokens:input.maxTokens??1600})});
  data=await (sender?sender(command,{abortSignal:input.signal}):client!.send(command,{abortSignal:input.signal}));
 }catch(error){
  if(input.signal.aborted)throw new DecisionError('timeout','Bedrock request deadline exceeded',false);
  const e=error as {name?:string;$metadata?:{httpStatusCode?:number}};
  const status=e.$metadata?.httpStatusCode;
  // Never log the exception body: SDK diagnostics may contain request details.
  input.metadata({httpStatus:status??null,providerErrorCode:e.name??'BedrockError'});
  if(status)throw new DecisionError('http_error',`Bedrock HTTP ${status}`,status===408||status===429||status>=500);
  throw new DecisionError('transport_error','Bedrock transport failed');
 }finally{client?.destroy();}
 let response:{content?:{type?:string;text?:string}[];stop_reason?:string;usage?:{input_tokens?:number;output_tokens?:number};id?:string};
 try{
  const parsed:unknown=JSON.parse(new TextDecoder().decode(data.body));
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();
  response=parsed;
 }catch{throw new DecisionError('invalid_response','Bedrock returned invalid JSON');}
 input.metadata({httpStatus:data.$metadata?.httpStatusCode??200,generationId:data.$metadata?.requestId??response.id??null,finishReason:response.stop_reason??null,usage:response.usage?{inputTokens:response.usage.input_tokens,outputTokens:response.usage.output_tokens}:null});
 if(response.stop_reason==='max_tokens')throw new DecisionError('output_limit','Model reached its output token limit');
 if(['refusal','guardrail_intervened','content_filtered'].includes(response.stop_reason??''))throw new DecisionError('refused','Bedrock declined the request',false);
 const text=Array.isArray(response.content)?response.content.filter(block=>block?.type==='text'&&typeof block.text==='string').map(block=>block.text).join(''):'';
 if(!text.trim())throw new DecisionError('empty_response','Bedrock returned no message content');
 return text;
}
