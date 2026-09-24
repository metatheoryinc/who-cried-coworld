import { expect,it } from 'vitest';
import { Results } from '../../src/shared/results.js';
const draw={schema:'wcw.results/1',rulesVersion:'wcw.rules/1',outcome:'draw',reason:'day_cap',daysCompleted:8,scores:Array(9).fill(0)};
it('accepts the three exact outcome/reason pairs',()=>{
 expect(Results.safeParse(draw).success).toBe(true);
 expect(Results.safeParse({...draw,outcome:'town_win',reason:'wolves_eliminated',scores:[0,0,1,1,1,1,1,1,1]}).success).toBe(true);
 expect(Results.safeParse({...draw,outcome:'wolf_win',reason:'wolf_parity',scores:[1,1,0,0,0,0,0,0,0]}).success).toBe(true);
});
it.each([{reason:'wolf_parity'},{scores:Array(9).fill(1)},{scores:[0]},{scores:Array(9).fill(0.5)},{seed:'secret'},{daysCompleted:33},{schema:'wcw.results/2'}])('rejects invalid terminal output %j',patch=>expect(Results.safeParse({...draw,...patch}).success).toBe(false));
const v2={schema:'wcw.results/2',rulesVersion:'wcw.rules/3',outcome:'town_win',reason:'wolves_eliminated',daysCompleted:3,
 scores:[0,0.05,1,0.75,0.8,0.75,0.75,0.9,0.75],metrics:[{win:0,hidden:0},{win:0,hidden:0.2},...Array.from({length:7},()=>({win:1,read:0.5,vote_hit:0.3,survived:1,valid_actions:1}))]};
it('accepts version 2 results with fractional scores and per-seat metrics',()=>{
 expect(Results.safeParse(v2).success).toBe(true);
 expect(Results.safeParse({...v2,outcome:'draw',reason:'day_cap',scores:Array(9).fill(0.1),metrics:Array(9).fill({win:0,read:0.4})}).success).toBe(true);
});
it.each([{scores:Array(9).fill(1.2)},{metrics:[]},{metrics:Array(9).fill({win:1,extra:1})},{outcome:'draw',reason:'day_cap'},{metrics:Array(9).fill({win:0,read:1.5})}])('rejects invalid version 2 results %j',patch=>expect(Results.safeParse({...v2,...patch}).success).toBe(false));
