import type { z } from 'zod';

/** Reject ambiguity before JSON.parse can discard duplicate keys or round integers. */
function inspectJson(text: string) {
 let at=0;
 const fail=():never=>{throw new Error('Malformed JSON');};
 const whitespace=()=>{while(/[\x20\t\r\n]/.test(text[at]??'!')) at++;};
 const string=():string=>{
  const start=at++;
  while(at<text.length){
   const ch=text[at++];
   if(ch==='"') return JSON.parse(text.slice(start,at)) as string;
   if(ch==='\\') at++;
  }
  return fail();
 };
 const value=(depth:number):void=>{
  if(depth>64) fail();
  whitespace();
  const ch=text[at];
  if(ch==='"'){string();return;}
  if(ch==='{' || ch==='['){
   at++;
   const end=ch==='{'?'}':']';
   const keys=new Set<string>();
   whitespace();
   if(text[at]===end){at++;return;}
   while(at<text.length){
    whitespace();
    if(ch==='{'){
     if(text[at]!=='"') fail();
     const key=string();
     if(keys.has(key)) fail();
     keys.add(key); whitespace();
     if(text[at++]!==':') fail();
    }
    value(depth+1); whitespace();
    if(text[at]===end){at++;return;}
    if(text[at++]!==',') fail();
   }
   fail();
  }
  const token=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at))?.[0];
  if(!token) return fail();
  if(!['true','false','null'].includes(token)){
   const n=Number(token);
   if(!Number.isFinite(n)||(Number.isInteger(n)&&!Number.isSafeInteger(n))) fail();
  }
  at+=token.length;
 };
 value(0); whitespace();
 if(at!==text.length) fail();
}
export function decodeText<T>(text:unknown,schema:z.ZodType<T>,maxBytes=8192):{ok:true;value:T}|{ok:false;code:'malformed'} {
 try {
  if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>maxBytes) throw new Error();
  inspectJson(text);
  const parsed=schema.safeParse(JSON.parse(text));
  return parsed.success?{ok:true,value:parsed.data}:{ok:false,code:'malformed'};
 } catch {return {ok:false,code:'malformed'};}
}
