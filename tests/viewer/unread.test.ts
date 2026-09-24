import {expect,it} from 'vitest';
import {channelMessages,unread,mentions} from '../../src/viewer/unread.js';
import type {Payload} from '../../src/shared/events.js';
const speech=(id:string,slot:number,text:string)=>({id,day:1,payload:{kind:'speech',speech:{slot,text,replyTo:null,accusation:null}} as Payload});
const wolf=(id:string,slot:number,text:string)=>({id,day:1,payload:{kind:'wolf_chat',slot,text} as Payload});
const events=[speech('e1',2,'hello all'),wolf('e2',5,'Bo, who tonight?'),speech('e3',3,'Bo seems quiet'),wolf('e4',1,'my own note'),wolf('e5',5,'still there?')];
it('splits messages by channel',()=>{
 expect(channelMessages(events,'town').map(e=>e.id)).toEqual(['e1','e3']);
 expect(channelMessages(events,'wolves').map(e=>e.id)).toEqual(['e2','e4','e5']);
 expect(channelMessages(events,'nobles')).toEqual([]);
});
it('counts unseen messages from others after the last one read',()=>{
 expect(unread(events,'wolves',undefined,1,'Bo')).toEqual({count:2,mention:true,firstId:'e2'});
 expect(unread(events,'wolves','e2',1,'Bo')).toEqual({count:1,mention:false,firstId:'e5'});
 expect(unread(events,'wolves','e5',1,'Bo')).toEqual({count:0,mention:false,firstId:null});
 expect(unread(events,'town','e1',1,'Bo')).toEqual({count:1,mention:true,firstId:'e3'});
});
it('matches a name as a whole word, case-insensitively',()=>{
 expect(mentions('bo, answer me','Bo')).toBe(true);
 expect(mentions('@Bo?','Bo')).toBe(true);
 expect(mentions('Bobby is odd','Bo')).toBe(false);
 expect(mentions('anything','')).toBe(false);
 expect(mentions('Human-2 wrote this','Human')).toBe(false);
 expect(mentions('Human, and Human-2','Human')).toBe(true);
});
