import {expect,it} from 'vitest';
import {chooseSpeaker} from '../../src/game/domain/human-host.js';
const base={roster:[{slot:0,name:'You',alive:true},{slot:1,name:'Claude',alive:true},{slot:2,name:'Gemini',alive:true}],humanSlot:0,counts:{},recent:[]};
it('prioritizes the named bot over the usual fair rotation',()=>{
 expect(chooseSpeaker({...base,counts:{2:4},humanMessage:{id:'public_4',text:'Gemini, why do you suspect Claude?'}})?.slot).toBe(1);
 expect(chooseSpeaker({...base,counts:{2:4},humanMessage:{id:'public_4',text:'@Gemini: explain your vote.'}})).toEqual({slot:2,reason:'human_reply',replyTo:'public_4'});
});
it('lets bots discuss without a human prompt and balances their turns',()=>{
 expect(chooseSpeaker({...base,counts:{1:2,2:1}})).toEqual({slot:2,reason:'open_discussion',replyTo:null});
});
it('excludes dead players and prevents three consecutive turns by one bot',()=>{
 expect(chooseSpeaker({...base,recent:[1,1],humanMessage:{id:'public_4',text:'Claude?'}})?.slot).toBe(2);
 expect(chooseSpeaker({...base,roster:base.roster.map(p=>({...p,alive:p.slot!==1})),humanMessage:{id:'public_4',text:'Claude?'}})?.slot).toBe(2);
});
