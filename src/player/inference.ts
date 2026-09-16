export type InferenceConfig={provider:'openrouter'|'bedrock';model:string;key?:string;endpoint?:string;region?:string;maxTokens?:number};
export function resolveInference(env:NodeJS.ProcessEnv=process.env,role:'player'|'moderator'='player'):InferenceConfig {
 const selected=(role==='moderator'?env.WCW_MODERATOR_PROVIDER:undefined)??env.WCW_LLM_PROVIDER??'auto';
 if(!['auto','openrouter','bedrock'].includes(selected))throw Error('LLM provider must be auto, openrouter, or bedrock');
 const endpoint=env.AWS_ENDPOINT_URL_BEDROCK_RUNTIME?.trim()||undefined;
 const provider=selected==='auto'?(endpoint||['1','true'].includes(env.USE_BEDROCK?.toLowerCase()??'')?'bedrock':'openrouter'):selected;
 if(provider==='bedrock'){
  const model=(role==='moderator'?env.WCW_MODERATOR_BEDROCK_MODEL:undefined)?.trim()||env.BEDROCK_MODEL?.trim();
  if(!model)throw Error('Bedrock requires BEDROCK_MODEL (or WCW_MODERATOR_BEDROCK_MODEL for the host)');
  if(endpoint){const url=new URL(endpoint);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('Invalid Bedrock endpoint');}
  const maxTokens=env.WCW_BEDROCK_MAX_TOKENS===undefined?undefined:Number(env.WCW_BEDROCK_MAX_TOKENS);
  if(maxTokens!==undefined&&(!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>16384))throw Error('WCW_BEDROCK_MAX_TOKENS must be 1..16384');
  return {provider,model,endpoint,region:env.AWS_REGION||env.AWS_DEFAULT_REGION,maxTokens};
 }
 return {provider:'openrouter',model:(role==='moderator'?env.OPENROUTER_HOST_MODEL:env.WCW_MODEL)?.trim()||'openai/gpt-oss-120b',key:(role==='moderator'?env.WCW_MODERATOR_API_KEY:undefined)?.trim()||env.OPENROUTER_API_KEY?.trim()};
}
