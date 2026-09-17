import {expect,it} from 'vitest';
import {playerStartup,playerEnvironmentStatus} from '../../src/player/startup.js';
it('requires inference configuration unless scripted testing is explicitly enabled',()=>{
 expect(()=>playerStartup({})).toThrow('credentials');
 expect(playerStartup({},true)).toMatchObject({provider:'openrouter',allowScripted:true});
 expect(playerStartup({AWS_ENDPOINT_URL_BEDROCK_RUNTIME:'http://localhost:9100',BEDROCK_MODEL:'hosted'})).toMatchObject({provider:'bedrock',allowScripted:false,model:'hosted'});
 expect(()=>playerStartup({USE_BEDROCK:'true'},true)).toThrow('BEDROCK_MODEL');
});
it('reports presence only, without exposing credentials, model, endpoint or seat URL',()=>{
 const report=playerEnvironmentStatus({OPENROUTER_API_KEY:'secret-key',AWS_ACCESS_KEY_ID:'access-secret',AWS_SECRET_ACCESS_KEY:'aws-secret',AWS_ENDPOINT_URL_BEDROCK_RUNTIME:'http://private-endpoint:9100',BEDROCK_MODEL:'private-model',COWORLD_PLAYER_WS_URL:'ws://private?token=secret'});
 expect(report).toMatchObject({bedrockEndpointConfigured:true,bedrockModelConfigured:true,openRouterKeyConfigured:true,awsCredentialsConfigured:true});
 expect(JSON.stringify(report)).not.toMatch(/secret|private/);
});
