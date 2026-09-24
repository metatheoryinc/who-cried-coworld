import {expect,it,vi} from 'vitest';
import {createAssetCache} from '../../src/viewer/asset-cache.js';
it('retains image bytes as object URLs after the server disappears',async()=>{
 const fetcher=vi.fn(async()=>new Response(new Blob(['image'],{type:'image/png'})));
 const objectURL=vi.fn(()=> 'blob:retained-image');
 const assets=createAssetCache(fetcher,objectURL);
 await assets.preload(['Role_Wolf_outline','Role_Wolf_outline']);
 fetcher.mockRejectedValue(new Error('server stopped'));
 expect(assets.url('Role_Wolf_outline')).toBe('blob:retained-image');
 expect(fetcher).toHaveBeenCalledTimes(1);
 expect(objectURL).toHaveBeenCalledWith(expect.any(Blob));
});
it('allows a failed preload to retry instead of caching broken assets',async()=>{
 const fetcher=vi.fn(async()=>new Response('',{status:503}));
 const assets=createAssetCache(fetcher,()=> 'blob:ready');
 await expect(assets.preload(['base_rolecard_blue'])).rejects.toThrow();
 fetcher.mockImplementation(async()=>new Response(new Blob(['image'])));
 await assets.preload(['base_rolecard_blue']);
 expect(assets.url('base_rolecard_blue')).toBe('blob:ready');
});
