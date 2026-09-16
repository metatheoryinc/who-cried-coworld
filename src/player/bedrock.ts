import {NodeHttpHandler} from '@smithy/node-http-handler';
import {BedrockRuntimeClient,ConverseCommand,type ConverseCommandOutput,type Message} from '@aws-sdk/client-bedrock-runtime';
import {DecisionError} from './timed-llm.js';
export type BedrockInput={model:string;messages:{role:string;content:string}[];signal:AbortSignal;metadata:(data:Record<string,unknown>)=>void;endpoint?:string;region?:string;maxTokens?:number};
export type BedrockSender=(command:ConverseCommand,options:{abortSignal:AbortSignal})=>Promise<ConverseCommandOutput>;
export async function bedrockCompletion(input:BedrockInput,sender?:BedrockSender):Promise<string>{
 const messages:Message[]=[],system:{text:string}[]=[];
 for(const message of input.messages){
  if(message.role==='system'){system.push({text:message.content});continue;}
  if(message.role!=='user'&&message.role!=='assistant')throw new DecisionError('invalid_request','Unsupported message role',false);
  const previous=messages.at(-1);
  if(previous?.role===message.role)previous.content!.push({text:message.content});
  else messages.push({role:message.role,content:[{text:message.content}]});
 }
 // Disable SDK retries: timedAction owns retry count and the decision deadline.
 const client=sender?undefined:new BedrockRuntimeClient({endpoint:input.endpoint,region:input.region,maxAttempts:1,requestHandler:new NodeHttpHandler()});
 input.metadata({provider:'bedrock',endpoint:input.endpoint??'AWS default endpoint'});
 let data:ConverseCommandOutput;
 try{
  const command=new ConverseCommand({modelId:input.model,system,messages,inferenceConfig:{maxTokens:input.maxTokens??1600}});
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
 input.metadata({httpStatus:data.$metadata?.httpStatusCode??200,generationId:data.$metadata?.requestId??null,finishReason:data.stopReason??null,usage:data.usage??null});
 if(data.stopReason==='max_tokens')throw new DecisionError('output_limit','Model reached its output token limit');
 if(data.stopReason==='guardrail_intervened'||data.stopReason==='content_filtered')throw new DecisionError('refused','Bedrock declined the request',false);
 const text=data.output?.message?.content?.map(block=>block.text??'').join('')??'';
 if(!text.trim())throw new DecisionError('empty_response','Bedrock returned no message content');
 return text;
}
