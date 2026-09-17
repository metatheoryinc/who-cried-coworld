import { expect, it } from 'vitest';
import { GameConfig, episodeBudgetSeconds } from '../../src/shared/config.js';
const input = () => ({tokens:Array.from({length:9},(_,i)=>`token-${i}`),players:Array.from({length:9},()=>({name:'Duplicate name'}))});
it('normalizes exactly nine distinct neutral presentations and bounded defaults',()=>{
 const c=GameConfig.parse(input());
 expect([c.maxDays,c.windowMs,c.player_connect_timeout_seconds,episodeBudgetSeconds(c)]).toEqual([8,3500,180,938]);
 expect(c.presentation).toEqual(Array.from({length:9},()=>({kind:'neutral'})));
 expect(c.presentation[0]).not.toBe(c.presentation[1]);
});
it.each([
 {tokens:Array(9).fill('same')},{tokens:['one']},{players:[]},
 {seed:'A'.repeat(32)},{seed:'0'.repeat(31)},{seed:'g'.repeat(32)},
 {maxDays:33},{maxDays:9,windowMs:10000},{windowMs:99},{windowMs:100.5},{windowMs:10001},
 {player_connect_timeout_seconds:181},{extra:true},{presentation:[]},
 {presentation:Array(9).fill({kind:'neutral',role:'wolf'})},
 {presentation:Array(9).fill({kind:'character',characterId:'../wolf',persona:'x'})},
])('rejects malformed or over-budget configuration %j',patch=>{
 expect(GameConfig.safeParse({...input(),...patch}).success).toBe(false);
});
it('allows the fast fixture and normalized character metadata',()=>{
 const c=GameConfig.parse({...input(),maxDays:32,windowMs:100,seed:'0'.repeat(32),presentation:Array(9).fill({kind:'character',characterId:'wolf-art',persona:'A fictional character'})});
 expect(episodeBudgetSeconds(c)).toBeCloseTo(293.2);
});

it('allows ten-second fast LLM windows within the forty-minute package budget',()=>{
 const c=GameConfig.parse({...input(),mode:'fast',setup:'random',maxDays:8,windowMs:10000,player_connect_timeout_seconds:30});
 expect(episodeBudgetSeconds(c)).toBe(2140);
});
