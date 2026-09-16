import { expect,it } from 'vitest';
import { createState } from '../../src/game/domain/rules.js';
import { GameConfig } from '../../src/shared/config.js';
import { openRequest } from '../../src/game/domain/requests.js';
import { buildObservation } from '../../src/game/runtime/observation.js';
import { Observation } from '../../src/shared/player.js';
const config=GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`secret-${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`}))});
const s=createState('000102030405060708090a0b0c0d0e0f');
const pending=(slot:number)=>openRequest({slot,episodeId:'e',requestId:'r',observationId:'o',deadline:1000,request:{kind:'vote',targets:[0,1,2,3,4,5,6,7,8],allowPass:true}});
it('produces a strict bounded observation without seed, tokens, or other roles',()=>{
 const o=buildObservation(s,config,[],pending(0),'vote',50);
 expect(Observation.safeParse(o).success).toBe(true);expect(o.self.role).toBe('sheep');expect(o.teammates).toEqual([]);
 expect(o.remainingMs).toBe(950);expect(o.roster).toHaveLength(9);
 expect(JSON.stringify(o)).not.toMatch(/secret-|000102|"seed"|"audience"|"seq"/);
 expect(o.roster.every(p=>!('role' in p))).toBe(true);
});
it('provides exact initial faction knowledge only to Wolf seats',()=>{
 expect(buildObservation(s,config,[],pending(1),'vote',50).teammates).toEqual([{slot:1,role:'wolf'},{slot:5,role:'alchemist'}]);
});
it('refuses new action observations for a dead seat',()=>{
 const dead=structuredClone(s);dead.seats[0]!.alive=false;
 expect(()=>buildObservation(dead,config,[],pending(0),'vote',50)).toThrow();
});
it('schema rejects authority leaks and inconsistent team knowledge',()=>{
 const o=buildObservation(s,config,[],pending(0),'vote',50);
 expect(Observation.safeParse({...o,seed:s.seed}).success).toBe(false);
 expect(Observation.safeParse({...o,teammates:[{slot:1,role:'wolf'}]}).success).toBe(false);
});
