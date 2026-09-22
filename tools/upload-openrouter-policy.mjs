import {readFileSync} from 'node:fs';
import {parseArgs,parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';

// Keep credentials out of argv, generated files, and diagnostic output.
const {values}=parseArgs({options:{
 'env-file':{type:'string'},python:{type:'string',default:'python3'},
 image:{type:'string',default:'wcw-player:local'},
 name:{type:'string',default:'wcw-openrouter-haiku'},
 model:{type:'string',default:'anthropic/claude-haiku-4.5'},
 'dry-run':{type:'boolean',default:false},
}});
let key;
try{
 key=process.env.OPENROUTER_API_KEY?.trim();
 if(!key&&values['env-file'])key=parseEnv(readFileSync(values['env-file'],'utf8')).OPENROUTER_API_KEY?.trim();
}catch{console.error('Unable to read the environment file.');process.exit(1);}
if(!key){console.error('Missing OPENROUTER_API_KEY. Supply it in the environment or --env-file.');process.exit(1);}
const request={image:values.image,name:values.name,run:['node','build/llm-player.mjs'],secret_env:{
 OPENROUTER_API_KEY:key,WCW_LLM_PROVIDER:'openrouter',WCW_MODEL:values.model,
}};
if(values['dry-run']){
 console.log(JSON.stringify({image:request.image,name:request.name,model:values.model,secretNames:Object.keys(request.secret_env),keyPresent:true}));
}else{
 const code=`import json,sys
from coworld.upload import upload_policy_cmd
try:
    request=json.load(sys.stdin)
    upload_policy_cmd(**request)
except Exception as exc:
    print('Policy upload failed ('+type(exc).__name__+'); details suppressed to protect credentials.',file=sys.stderr)
    sys.exit(1)
`;
 const childEnv={...process.env};delete childEnv.OPENROUTER_API_KEY;
 const child=spawnSync(values.python,['-c',code],{input:JSON.stringify(request),encoding:'utf8',env:childEnv,maxBuffer:8*1024*1024});
 for(const [stream,text] of [[process.stdout,child.stdout],[process.stderr,child.stderr]])if(text)stream.write(text.split(key).join('[redacted]'));
 if(child.error)console.error('Unable to launch the Coworld Python environment. Check --python.');
 process.exitCode=child.status??1;
}
