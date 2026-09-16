import { expect,it } from 'vitest';
import { Results } from '../../src/shared/results.js';
const draw={schema:'wcw.results/1',rulesVersion:'wcw.rules/1',outcome:'draw',reason:'day_cap',daysCompleted:8,scores:Array(9).fill(0)};
it('accepts the three exact outcome/reason pairs',()=>{
 expect(Results.safeParse(draw).success).toBe(true);
 expect(Results.safeParse({...draw,outcome:'town_win',reason:'wolves_eliminated',scores:[0,0,1,1,1,1,1,1,1]}).success).toBe(true);
 expect(Results.safeParse({...draw,outcome:'wolf_win',reason:'wolf_parity',scores:[1,1,0,0,0,0,0,0,0]}).success).toBe(true);
});
it.each([{reason:'wolf_parity'},{scores:Array(9).fill(1)},{scores:[0]},{scores:Array(9).fill(0.5)},{seed:'secret'},{daysCompleted:33},{schema:'wcw.results/2'}])('rejects invalid terminal output %j',patch=>expect(Results.safeParse({...draw,...patch}).success).toBe(false));
