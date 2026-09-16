import { expect,it } from 'vitest';
import { stageSummary,deathCause } from '../../src/viewer/stage-summary.js';
import type { Payload } from '../../src/shared/events.js';
const roster=[{name:'Ada'},{name:'Bo'}];
it('announces no majority without exposing hidden roles',()=>{
 const events:{day:number;payload:Payload}[]=[{day:1,payload:{kind:'ballots',ballots:[],eliminated:null,resolution:'all_abstain'}}];
 expect(stageSummary({period:'dusk',day:1,events,roster})).toMatchObject({art:'tscreen_day_nodeath',description:'No one received a majority vote. The town could not decide!'});
});
it('uses the preceding night for dawn and distinguishes death causes',()=>{
 const events:{day:number;payload:Payload}[]=[{day:1,payload:{kind:'elimination',slot:0,cause:'vote'}},{day:1,payload:{kind:'elimination',slot:1,cause:'wolf'}},{day:1,payload:{kind:'night_resolved',eliminated:[1]}}];
 expect(stageSummary({period:'dawn',day:2,events,roster})).toMatchObject({art:'tscreen_night_death',description:'Bo was killed by the wolves last night.'});
 expect(deathCause(events,0)).toBe('vote');expect(deathCause(events,1)).toBe('wolf');expect(deathCause(events,2)).toBeNull();
});
it('shows survival art for a night with no deaths',()=>{
 expect(stageSummary({period:'dawn',day:2,events:[{day:1,payload:{kind:'night_resolved',eliminated:[]}}],roster})?.art).toBe('tscreen_night_nodeath');
 expect(stageSummary({period:'discussion',day:2,events:[],roster})).toBeNull();
});
