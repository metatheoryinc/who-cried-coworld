/** Retain image bytes for end screens after the hosted game process exits. */
export function createAssetCache(fetcher:typeof fetch=fetch,objectURL:(blob:Blob)=>string=blob=>URL.createObjectURL(blob)){
 const urls=new Map<string,string>(),pending=new Map<string,Promise<void>>();
 const url=(name:string)=>urls.get(name)??`assets/play/${name}.png`;
 const preload=(names:string[])=>Promise.all([...new Set(names)].map(name=>{
  if(urls.has(name))return Promise.resolve();
  if(!pending.has(name))pending.set(name,(async()=>{
   const response=await fetcher(url(name),{signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw new Error(`Image unavailable: ${name}`);
   urls.set(name,objectURL(await response.blob()));
  })().finally(()=>pending.delete(name)));
  return pending.get(name)!;
 }));
 return {url,preload};
}
