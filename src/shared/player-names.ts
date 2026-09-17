import {z} from 'zod';
export const DisplayName=z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/);
export const Registration=z.object({protocol:z.literal('wcw.player/1'),type:z.literal('register'),displayName:DisplayName}).strict();
export function assignDisplayNames(original:string[],requested:ReadonlyMap<number,string>):string[]{
 const used=new Set(original.filter((_,slot)=>!requested.has(slot)).map(name=>name.toLowerCase()));
 return original.map((name,slot)=>{
  const base=requested.get(slot);if(!base)return name;
  let candidate=base,n=2;
  while(used.has(candidate.toLowerCase()))candidate=`${base}-${n++}`;
  used.add(candidate.toLowerCase());return candidate;
 });
}
export function modelDisplayName(model:string,override?:string):string|undefined{
 if(override!==undefined)return DisplayName.parse(override);
 const lower=model.toLowerCase();
 for(const [pattern,name] of [['sonnet','Sonnet'],['haiku','Haiku'],['opus','Opus'],['gemini','Gemini'],['deepseek','DeepSeek'],['qwen','Qwen'],['llama','Llama'],['mistral','Mistral'],['kimi','Kimi'],['glm','GLM'],['gpt','GPT'],['claude','Claude']] as const)if(lower.includes(pattern))return name;
 return undefined;
}
