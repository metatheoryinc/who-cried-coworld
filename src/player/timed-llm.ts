import { Action,type Observation } from '../shared/player.js';
import { fallbackBody } from '../game/domain/requests.js';
import { parseModelAction } from './llm.js';
export class DecisionError extends Error {
 constructor(public code:string,message:string,public retryable=true){super(message);}
}
export type AttemptLog={attempt:number;latencyMs:number;outcome:'accepted'|'failed';errorCode?:string;error?:string;responseExcerpt?:string};
/** Retry early failures only; a slow first attempt owns the whole remaining window, less time to submit. */
export async function timedAction(o:Observation,complete:(signal:AbortSignal,repair:string|null)=>Promise<string>,onAttempt:(log:AttemptLog)=>void=()=>{}):Promise<Action>{
 const action=(body:Action['body'],report:Action['report'])=>Action.parse({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body,report});
 if(o.request.kind==='night'&&o.request.choices.length===0)return action({kind:'night',actions:[],summary:''},null);
 const until=Date.now()+Math.max(0,o.remainingMs-500);
 let repair:string|null=null,attempts:0|1|2=0;
 for(let attempt=0;attempt<2&&Date.now()<until&&(attempt===0||until-Date.now()>=2000);attempt++){
  const controller=new AbortController(),start=Date.now();
  let timer:ReturnType<typeof setTimeout>|undefined,parsing=false,retryable=true,responseText:string|undefined;
  try{
   attempts=attempt===0?1:2;
   const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new DecisionError('timeout','Decision deadline exceeded',false));controller.abort();},until-Date.now());});
   const text=await Promise.race([complete(controller.signal,repair),timeout]);
   responseText=text;parsing=true;
   const result=parseModelAction(text,o);
   onAttempt({attempt:attempts,latencyMs:Date.now()-start,outcome:'accepted'});
   return result;
  }catch(error){
   const code=error instanceof DecisionError?error.code:parsing?(error instanceof Error&&error.message.startsWith('Illegal')?'illegal_action':'invalid_action'):'transport_error';
   const message=error instanceof DecisionError||parsing?(error as Error).message:'Provider transport failed';
   retryable=!(error instanceof DecisionError)||error.retryable;
   onAttempt({attempt:attempts,latencyMs:Date.now()-start,outcome:'failed',errorCode:code,error:message,...(parsing?{responseExcerpt:responseText?.slice(0,4096)}:{})});
   repair=parsing?`${message}. Return only valid JSON matching the offered action schema and legal targets.`:'The previous request failed. Return only the complete JSON action body.';
  }finally{if(timer)clearTimeout(timer);controller.abort();}
  if(!retryable)break;
 }
 return action(fallbackBody(o.request),{code:'provider_error',attempts});
}
