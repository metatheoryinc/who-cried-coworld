import {bedrockCompletion,type BedrockInput} from './bedrock.js';
import {resolveInference} from './inference.js';
import {Action,type Observation} from '../shared/player.js';
import {fallbackBody} from '../game/domain/requests.js';

type Dependencies={fetcher?:typeof fetch;model?:(input:BedrockInput)=>Promise<string>};
/** Enumerate keys only; never interpolate environment values into diagnostic text. */
export function environmentPages(env:NodeJS.ProcessEnv):string[]{
 const names=Object.keys(env).filter(name=>env[name]!==undefined);
 const all=new Set(names);
 // Match Kubernetes service-link shapes, without hiding unrelated custom *_PORT settings.
 const discovery=(name:string)=>/_SERVICE_(HOST|PORT(?:_[A-Z0-9_]+)?)$/.test(name)||/_PORT_\d+_(TCP|UDP|SCTP)(?:_(ADDR|PORT|PROTO))?$/.test(name)||name.endsWith('_PORT')&&(all.has(`${name.slice(0,-5)}_SERVICE_HOST`)||names.some(other=>other.startsWith(`${name}_`)&&/_PORT_\d+_(TCP|UDP|SCTP)(?:_(ADDR|PORT|PROTO))?$/.test(other)));
 const hidden=names.filter(discovery).length;
 const priority=(name:string)=>/BEDROCK|AWS|MODEL|LLM|PROXY|SECRET|TOKEN|ENDPOINT|API_KEY/i.test(name);
 const visible=names.filter(name=>!discovery(name)).sort((a,b)=>Number(priority(b))-Number(priority(a))||a.localeCompare(b));
 const entries=[...visible.map(name=>`${JSON.stringify(name)}:${env[name]===''?'empty':'populated'}`),`${hidden} service-discovery variables summarized`];
 if(!visible.some(priority))entries.unshift('No inference-related variable names found');
 const chunks:string[]=[];let chunk='';
 for(const value of entries){
  const entry=value.replace(/[\u007f-\uffff]/g,c=>`\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`);
  if(chunk.length+entry.length+2>360&&chunk){chunks.push(chunk);chunk='';}
  // Escape non-ASCII characters so unusually long names can be split safely.
  let rest=entry;
  while(rest.length>360){chunks.push(rest.slice(0,360));rest=rest.slice(360);}
  chunk+=(chunk?'; ':'')+rest;
 }
 if(chunk)chunks.push(chunk);
 if(!chunks.length)chunks.push('(none)');
 return chunks.map((text,i)=>`ENV ${i+1}/${chunks.length}: ${text}`);
}
/** Public turns cycle through status and pages; retries and private chat consume no pages. */
export function diagnosticReporter(env:NodeJS.ProcessEnv){
 const pages=environmentPages(env);let index=0,lastId='',lastText='';
 return (o:Observation,status:string)=>{
  if(o.request.kind!=='bid')return status;
  const id=`${o.episodeId}:${o.requestId}`;
  if(id===lastId)return lastText;
  lastId=id;lastText=index<pages.length?pages[index]!:status;
  index=(index+1)%(pages.length+1);
  return lastText;
 };
}
export function diagnosticPresence(env:NodeJS.ProcessEnv){
 return `endpoint ${env.AWS_ENDPOINT_URL_BEDROCK_RUNTIME?.trim()?'present':'missing'}; model ${env.BEDROCK_MODEL?.trim()?'present':'missing'}`;
}
/** One hosted-only probe. Never expose raw responses, credentials, URLs or model output. */
export async function probeBedrock(env:NodeJS.ProcessEnv,signal:AbortSignal,deps:Dependencies={},progress:(text:string)=>void=()=>{}){
 const parts=[diagnosticPresence(env)];
 const publish=()=>{const text=parts.join('; ');progress(text);return text;};
 publish();
 if(!env.AWS_ENDPOINT_URL_BEDROCK_RUNTIME?.trim()||!env.BEDROCK_MODEL?.trim())return publish();
 let config;
 try{config=resolveInference({...env,WCW_LLM_PROVIDER:'bedrock'});}catch{parts.push('invalid configuration');return publish();}
 const fetcher=deps.fetcher??fetch;
 for(const path of ['healthz/core-v1','spend']){
  if(signal.aborted)return publish();
  try{
   const response=await fetcher(`${config.endpoint!.replace(/\/$/,'')}/${path}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(2000)]),redirect:'error'});
   if(path==='spend'&&response.ok){
    const d:unknown=await response.json();
    const v=d as {spend_limit_usd?:unknown;remaining_usd?:unknown};
    parts.push(v?.spend_limit_usd===0||typeof v?.remaining_usd==='number'&&v.remaining_usd<=0?'spend exhausted':v?.spend_limit_usd===null?'spend unlimited':typeof v?.spend_limit_usd==='number'&&Number.isFinite(v.spend_limit_usd)?'spend capped':'spend unknown');
   }else{parts.push(`${path==='spend'?'spend':'health'} HTTP ${response.status}`);await response.body?.cancel();}
  }catch{parts.push(`${path==='spend'?'spend':'health'} unavailable`);}
  publish();
 }
 if(signal.aborted)return publish();
 let status:number|undefined;
 try{
  await (deps.model??bedrockCompletion)({model:config.model,endpoint:config.endpoint,region:config.region,maxTokens:32,messages:[{role:'user',content:'Reply with OK.'}],signal:AbortSignal.any([signal,AbortSignal.timeout(5000)]),metadata:d=>{if(typeof d.httpStatus==='number')status=d.httpStatus;}});
  parts.push('model OK');
 }catch{parts.push(status?`model HTTP ${status}`:'model failed (timeout, transport or response)');}
 return publish();
}
export function diagnosticAction(o:Observation,status:string):Action{
 let body=fallbackBody(o.request);
 const text=`[Diagnostic] Connected; ${status}`.slice(0,480);
 if(o.request.kind==='bid')body={kind:'bid',wantsToSpeak:true,urgency:3,text,replyTo:null,accusation:null,reason:'Hosted integration diagnostic; no gameplay reasoning.'};
 if(o.request.kind==='wolf_chat'||o.request.kind==='noble_chat')body={kind:o.request.kind,text,summary:'Hosted integration diagnostic.'};
 return Action.parse({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body,report:null});
}
