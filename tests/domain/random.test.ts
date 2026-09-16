import { expect, it } from 'vitest';
import { draw, assignRoles } from '../../src/game/domain/random.js';
const seed='000102030405060708090a0b0c0d0e0f';
it('matches the normative shuffled role fixture',()=>{
 expect(assignRoles(seed)).toEqual(['sheep','wolf','sheep','sheep','guard','alchemist','sheep','seer','sheep']);
 expect(draw(seed,'kill_tie_day_1',0,2).value).toBe(0);
});
it('advances the counter on rejected words',()=>{
 const words=[0xffffffff,8];
 expect(draw(seed,'roles',0,9,()=>words.shift()!)).toEqual({value:8,nextCounter:2});
});
it('keeps labels independent and rejects invalid ranges/seeds',()=>{
 const expected=draw(seed,'kill_tie_day_1',0,2);
 assignRoles(seed);
 expect(draw(seed,'kill_tie_day_1',0,2)).toEqual(expected);
 for(const n of [0,-1,1.5,2**32+1]) expect(()=>draw(seed,'x',0,n)).toThrow();
 expect(draw(seed,'x',0,2**32).value).toBeGreaterThanOrEqual(0);
 expect(()=>assignRoles('nope')).toThrow();
});
