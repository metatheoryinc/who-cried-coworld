import { expect, it } from 'vitest';
import { z } from 'zod';
import { decodeText } from '../../src/shared/decode.js';
const schema=z.object({a:z.unknown()}).strict();
it.each(['{"a":1,"a":2}','{"a":{"x":1,"x":2}}','{"a":[{"x":1,"\\u0078":2}]}','{"a":1} trailing','{','{"a":9007199254740993}','{"a":1e400}'])('rejects ambiguous JSON: %s',s=>{
 expect(decodeText(s,schema).ok).toBe(false);
});
it('accepts escaped keys, strings, nested arrays and unrelated repeated keys',()=>{
 const s='{"\\u0061":[{"x":"a\\\"b"},{"x":2}]}';
 expect(decodeText(s,schema)).toEqual({ok:true,value:{a:[{x:'a"b'},{x:2}]}});
});
it('does not return raw data in safe errors',()=>{
 expect(decodeText('{secret',schema)).toEqual({ok:false,code:'malformed'});
 expect(decodeText(new Uint8Array([1]),schema)).toEqual({ok:false,code:'malformed'});
 expect(decodeText(JSON.stringify({a:'🐺'.repeat(2100)}),schema)).toEqual({ok:false,code:'malformed'});
 expect(decodeText('{"a":1,"unknown":1}',schema)).toEqual({ok:false,code:'malformed'});
});
