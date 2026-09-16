import { expect,it } from 'vitest';
import { mkdtemp,readFile,readdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readUri,writeUri } from '../../src/game/runtime/artifacts.js';
it('writes atomically to a file URI and leaves no temporary sibling',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wcw-'));
 try{const uri=pathToFileURL(join(dir,'results.json')).href;await writeUri(uri,'{"scores":[]}');expect(await readUri(uri,100)).toBe('{"scores":[]}');expect(await readdir(dir)).toEqual(['results.json']);await expect(readUri(uri,2)).rejects.toThrow();}
 finally{await rm(dir,{recursive:true,force:true});}
});
it('rejects unsupported URI schemes and HTTP artifact methods',async()=>{
 await expect(readUri('ftp://example.com',100)).rejects.toThrow();
 await expect(writeUri('https://example.com','x','GET')).rejects.toThrow();
});

it('uploads HTTP artifacts once and enforces download limits and error responses',async()=>{
 const {createServer}=await import('node:http');
 const calls:{method:string;body:string}[]=[];
 const server=createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  calls.push({method:req.method!,body});
  if(req.url==='/fail'){res.writeHead(503);res.end('Unavailable');return;}
  res.end('download');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw new Error('Missing port');
 const base=`http://127.0.0.1:${address.port}`;
 try{
  await writeUri(base,'{"complete":true}');
  await writeUri(base,'{"complete":true}','POST');
  expect(calls.slice(0,2)).toEqual([{method:'PUT',body:'{"complete":true}'},{method:'POST',body:'{"complete":true}'}]);
  expect(await readUri(base,8)).toBe('download');
  await expect(readUri(base,2)).rejects.toThrow('byte limit');
  await expect(readUri(base+'/fail')).rejects.toThrow('fetch failed');
  const before=calls.length;
  await expect(writeUri(base+'/fail','{}')).rejects.toThrow('upload failed');
  expect(calls.length).toBe(before+1);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
