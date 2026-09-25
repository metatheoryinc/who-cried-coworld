import {bedrockCompletion,type BedrockSender} from './bedrock.js';
import type {InferenceConfig} from './inference.js';
import type {Observation,Action} from '../shared/player.js';
import {scriptedAction} from './scripted.js';
import {timedAction,DecisionError} from './timed-llm.js';
import {providerCompletion} from './provider.js';
import {actionSchema} from './llm.js';
import {playerSystemPrompt} from './prompt.js';
export type PolicyOptions=Omit<InferenceConfig,'provider'>&{provider?:InferenceConfig['provider'];allowScripted?:boolean;bedrockSender?:BedrockSender;personality?:string;onLog?:(row:Record<string,unknown>)=>void;fetcher?:typeof fetch};
export async function llmAction(o:Observation,options:PolicyOptions,signal?:AbortSignal):Promise<Action>{
 if(options.provider!=='bedrock'&&!options.key){if(!options.allowScripted)throw new DecisionError('missing_credentials','LLM player requires inference credentials; scripted mode must be explicitly enabled',false);options.onLog?.({slot:o.self.slot,requestId:o.requestId,outcome:'scripted',reason:'no_credentials'});return scriptedAction(o);}
 let metadata:Record<string,unknown>={};
 return timedAction(o,async(attemptSignal,repair)=>{
  if(signal?.aborted)throw new DecisionError('cancelled','Player request cancelled',false);
  const messages=[{role:'system',content:playerSystemPrompt(o,options.personality)},{role:'user',content:JSON.stringify(o)},...(repair?[{role:'user',content:repair}]:[])];
  metadata={};
  if(options.provider==='bedrock')return bedrockCompletion({model:options.model,messages,schema:actionSchema(o),endpoint:options.endpoint,region:options.region,maxTokens:options.maxTokens,signal:signal?AbortSignal.any([signal,attemptSignal]):attemptSignal,metadata:data=>Object.assign(metadata,data)},options.bedrockSender);
  return providerCompletion({model:options.model,messages,schema:actionSchema(o),key:options.key!,signal:signal?AbortSignal.any([signal,attemptSignal]):attemptSignal,metadata:data=>Object.assign(metadata,data)},options.fetcher);
 },attempt=>options.onLog?.({slot:o.self.slot,model:options.model,requestId:o.requestId,requestKind:o.request.kind,...metadata,...attempt}));
}
