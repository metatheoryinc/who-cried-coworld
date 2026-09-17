import {resolveInference} from './inference.js';
export function playerEnvironmentStatus(env:NodeJS.ProcessEnv){
 return {
  bedrockEndpointConfigured:!!env.AWS_ENDPOINT_URL_BEDROCK_RUNTIME?.trim(),
  bedrockModelConfigured:!!env.BEDROCK_MODEL?.trim(),
  bedrockOptIn:['1','true'].includes(env.USE_BEDROCK?.toLowerCase()??''),
  openRouterKeyConfigured:!!env.OPENROUTER_API_KEY?.trim(),
  awsCredentialsConfigured:!!(env.AWS_ACCESS_KEY_ID&&env.AWS_SECRET_ACCESS_KEY||env.AWS_BEARER_TOKEN_BEDROCK),
 };
}
export function playerStartup(env:NodeJS.ProcessEnv,allowScripted=false){
 const inference=resolveInference(env);
 if(inference.provider==='openrouter'&&!inference.key&&!allowScripted)throw Error('LLM player requires inference credentials; use --allow-scripted only for intentional baseline tests');
 return {...inference,allowScripted};
}
