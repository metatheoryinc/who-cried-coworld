import { readFile,writeFile,rename,rm,stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
export async function readUri(uri:string,maxBytes=32*1024*1024):Promise<string>{
 const url=new URL(uri);
 if(url.protocol==='file:'){
  const path=fileURLToPath(url);if((await stat(path)).size>maxBytes)throw new Error('Input exceeds byte limit');
  const data=await readFile(path);if(data.byteLength>maxBytes)throw new Error('Input exceeds byte limit');return data.toString('utf8');
 }
 if(url.protocol!=='http:'&&url.protocol!=='https:')throw new Error('Unsupported input URI');
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 if(!response.ok||!response.body)throw new Error('Input fetch failed');
 const chunks:Uint8Array[]=[];let size=0;
 for await(const chunk of response.body){size+=chunk.byteLength;if(size>maxBytes)throw new Error('Input exceeds byte limit');chunks.push(chunk);}
 return Buffer.concat(chunks).toString('utf8');
}
export async function writeUri(uri:string,data:string,method='PUT'):Promise<void>{
 if(method!=='PUT'&&method!=='POST')throw new Error('Unsupported artifact method');
 const url=new URL(uri);
 if(url.protocol==='file:'){
  const path=fileURLToPath(url),temporary=`${path}.${randomUUID()}.tmp`;
  try{await writeFile(temporary,data,{flag:'wx'});await rename(temporary,path);}
  finally{await rm(temporary,{force:true});}
  return;
 }
 if(url.protocol!=='http:'&&url.protocol!=='https:')throw new Error('Unsupported output URI');
 const response=await fetch(url,{method,body:data,headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Artifact upload failed');
}
