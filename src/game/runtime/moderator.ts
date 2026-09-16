import {resolveInference} from '../../player/inference.js';
import {bedrockCompletion,type BedrockSender} from '../../player/bedrock.js';
import {moderatorPrompt,validateModeratorChoice,type Moderator} from '../domain/moderator.js';
export type ModeratorLog=Record<string,unknown>;
/** Runtime-only secrets: never part of the game config, observations, or replay. */
export function createRuntimeModerator(env:NodeJS.ProcessEnv=process.env,onLog:(log:ModeratorLog)=>void=log=>console.log(JSON.stringify({event:'moderator',...log})),fetcher:typeof fetch=fetch,bedrockSender?:BedrockSender):Moderator|undefined {
 const mode=env.WCW_MODERATOR?.trim()||'auto';
 if(!['auto','off','llm'].includes(mode))throw Error('WCW_MODERATOR must be auto, off, or llm');
 if(mode==='off')return;
 const inference=resolveInference(env,'moderator');
 const {key,model}=inference;
 if(inference.provider==='openrouter'&&!key){if(mode==='llm')throw Error('LLM moderator requires a runtime credential');return;}
 const provider=env.OPENROUTER_HOST_PROVIDER===undefined?'Cerebras':env.OPENROUTER_HOST_PROVIDER.trim();
 return async(input,signal)=>{
  const started=Date.now(),log:ModeratorLog={model,day:input.day,humanMessageId:input.humanMessage?.id??null};
  let stage='transport';
  try{
   if(inference.provider==='bedrock'){
    const content=await bedrockCompletion({...inference,messages:[{role:'system',content:moderatorPrompt},{role:'user',content:JSON.stringify(input)}],maxTokens:600,signal,metadata:data=>Object.assign(log,data)},bedrockSender);
    stage='invalid choice';const choice=validateModeratorChoice(JSON.parse(content),input);log.choice=choice;log.outcome='selected';return choice;
   }
   const response=await fetcher('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:moderatorPrompt},{role:'user',content:JSON.stringify(input)}],max_tokens:600,temperature:.45,reasoning:{effort:'minimal',exclude:true},response_format:{type:'json_object'},...(provider?{provider:{order:[provider]}}:{})})});
   log.httpStatus=response.status;
   if(!response.ok){stage=`HTTP ${response.status}`;throw Error();}
   stage='invalid response';
   const data=await response.json();log.usage=data.usage??null;log.finishReason=data.choices?.[0]?.finish_reason??null;
   if(data.error||log.finishReason==='length')throw Error();
   stage='invalid choice';
   const choice=validateModeratorChoice(JSON.parse(data.choices?.[0]?.message?.content??''),input);
   log.choice=choice;log.outcome='selected';return choice;
  }catch{
   const message=signal.aborted?'Moderator deadline exceeded':`Moderator ${stage}`;
   log.outcome='fallback';log.error=message;throw Error(message);
  }finally{
   log.latencyMs=Date.now()-started;
   // Logging must never change a valid selection or break fallback behavior.
   try{onLog(log);}catch{console.error('Could not write moderator diagnostics.');}
  }
 };
}
