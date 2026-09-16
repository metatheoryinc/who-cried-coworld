import { expect,it } from 'vitest';
import { Event } from '../../src/shared/events.js';
import { project } from '../../src/shared/presentation/project.js';
const speech=(seq:number)=>Event.parse({schema:'wcw.events/1',seq,day:1,phase:'day',audience:{kind:'public'},reveal:'public',payload:{kind:'speech',speech:{slot:0,text:'Hello',replyTo:null,accusation:null}}});
const hidden=Event.parse({schema:'wcw.events/1',seq:2,day:1,phase:'night',audience:{kind:'seats',slots:[1,5]},reveal:'wolf_chat',payload:{kind:'wolf_chat',slot:1,text:'SECRET'}});
it('private events create no public cursor gaps or identifier changes',()=>{
 expect(project([speech(1),hidden,speech(3)],'public')).toEqual(project([speech(1),speech(2)],'public'));
 expect(project([speech(1),hidden,speech(3)],'public').map(e=>e.cursor)).toEqual([1,2]);
});
it('uses fixed recipients and never exports internal metadata',()=>{
 expect(project([hidden],0)).toEqual([]);expect(project([hidden],1)).toHaveLength(1);
 const later=Event.parse({...hidden,seq:3,audience:{kind:'seats',slots:[1]}});
 expect(project([hidden,later],5)).toHaveLength(1);
 const json=JSON.stringify(project([speech(1),hidden],1));
 expect(json).not.toMatch(/"seq"|"audience"|"slots"/);
});
it('refuses unvalidated journal entries instead of leaking arbitrary payloads',()=>{
 expect(()=>project([{...speech(1),payload:{...speech(1).payload,secret:'SECRET'}}] as never,'public')).toThrow();
});
