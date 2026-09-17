import {playerStartup,playerEnvironmentStatus} from './startup.js';
import {runPlayerClient} from './client.js';
import {llmAction} from './policy.js';
import {modelDisplayName} from '../shared/player-names.js';
const url=process.env.COWORLD_PLAYER_WS_URL;
if(!url)throw Error('Missing COWORLD_PLAYER_WS_URL');
let inference:ReturnType<typeof playerStartup>;
try{
 inference=playerStartup(process.env,process.argv.includes('--allow-scripted'));
 console.log(JSON.stringify({event:'player_startup',status:'configured',provider:inference.provider,allowScripted:inference.allowScripted,...playerEnvironmentStatus(process.env)}));
}catch{
 console.error(JSON.stringify({event:'player_startup',status:'invalid_configuration',...playerEnvironmentStatus(process.env),message:'LLM configuration missing or invalid. Check provider selection, Bedrock endpoint/model or OpenRouter credentials. Use --allow-scripted only for intentional baseline tests.'}));
 process.exit(1);
}
const personality=process.env.WCW_PLAYER_PROMPT;
const client=runPlayerClient(url,(o,signal)=>llmAction(o,{...inference,personality,onLog:row=>console.log(JSON.stringify({event:'player_attempt',...row}))},signal),modelDisplayName(inference.model,process.env.WCW_PLAYER_NAME));
process.once('SIGTERM',client.stop);process.once('SIGINT',client.stop);
client.done.catch(()=>{console.error('LLM player failed');process.exitCode=1;});
