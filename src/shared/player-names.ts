import {z} from 'zod';
export const DisplayName=z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/);
export const Registration=z.object({protocol:z.literal('wcw.player/1'),type:z.literal('register'),displayName:DisplayName}).strict();
export function assignDisplayNames(original:string[],requested:ReadonlyMap<number,string>):string[]{
 const used=new Set(original.filter((_,slot)=>!requested.has(slot)).map(name=>name.toLowerCase()));
 return original.map((name,slot)=>{
  const base=requested.get(slot);if(!base)return name;
  // Duplicates take letters (Haiku, Haiku B, Haiku C), never digits, which read as seat numbers.
  let candidate=base,n=1;
  while(used.has(candidate.toLowerCase()))candidate=`${base.slice(0,30)} ${String.fromCharCode(65+n++)}`;
  used.add(candidate.toLowerCase());return candidate;
 });
}
export function modelDisplayName(model:string,override?:string):string|undefined{
 if(override!==undefined)return DisplayName.parse(override);
 const lower=model.toLowerCase();
 for(const [pattern,name] of [['sonnet','Sonnet'],['haiku','Haiku'],['opus','Opus'],['gemini','Gemini'],['deepseek','DeepSeek'],['qwen','Qwen'],['llama','Llama'],['mistral','Mistral'],['kimi','Kimi'],['mimo','MiMo'],['glm','GLM'],['gpt','GPT'],['claude','Claude']] as const)if(lower.includes(pattern))return name;
 return undefined;
}
/** Whether `message` names `name` as a whole word. Longer player names that contain it (Haiku B contains
 * Haiku) are blanked out first, so they never count as mentioning the shorter name. */
export function mentionsName(message:string,name:string,names:readonly string[]=[]):boolean{
 if(!name)return false;
 const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 let text=message;
 for(const other of names)if(other.length>name.length&&other.toLowerCase().includes(name.toLowerCase()))
  text=text.replace(new RegExp(`(^|[^\\p{L}\\p{N}_])${esc(other)}(?=$|[^\\p{L}\\p{N}_])`,'giu'),(m,pre:string)=>pre+' '.repeat(m.length-pre.length));
 // Older games used numeric suffixes (Human-2); those never count as mentioning Human either.
 return new RegExp(`(^|[^\\p{L}\\p{N}_])${esc(name)}(?!-\\d)($|[^\\p{L}\\p{N}_])`,'iu').test(text);
}
