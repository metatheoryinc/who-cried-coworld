import { expect, it } from 'vitest';
import { Action } from '../../src/shared/player.js';
const envelope=(body:unknown)=>({protocol:'wcw.player/1',type:'action',episodeId:'e1',requestId:'r1',observationId:'o1',body,report:null});
const pass={kind:'bid',wantsToSpeak:false,urgency:0,text:'',replyTo:null,accusation:null,reason:''};
it.each([
 pass,{...pass,wantsToSpeak:true,text:'Vote for me.',urgency:3},
 {kind:'wolf_chat',text:'',summary:''},{kind:'vote',target:0,summary:'Self vote'},
 {kind:'vote',target:null,summary:''},{kind:'night',actions:[],summary:''},
 {kind:'night',actions:[{ability:'kill',target:4},{ability:'block',target:4}],summary:''},
])('accepts canonical action %j',body=>expect(Action.safeParse(envelope(body)).success).toBe(true));
it.each([
 {...pass,text:'secret'}, {...pass,urgency:1}, {...pass,replyTo:'x'}, {...pass,accusation:1},
 {...pass,wantsToSpeak:true}, {...pass,reason:'x'.repeat(513)},
 {kind:'vote',target:9,summary:''}, {kind:'vote',target:1},
 {kind:'night',actions:[{ability:'kill',target:4},{ability:'kill',target:5}],summary:''},
 {kind:'night',actions:[{ability:'poison',target:4}],summary:''},
 {kind:'wolf_chat',text:'x'.repeat(481),summary:''},
])('rejects malformed action %j',body=>expect(Action.safeParse(envelope(body)).success).toBe(false));
it('rejects authority fields, foreign protocols and arbitrary failure reports',()=>{
 for(const patch of [{slot:0},{protocol:'wcw.player/2'},{report:{code:'bad',attempts:1}},{report:{code:'refused',attempts:1,raw:'secret'}}])
  expect(Action.safeParse({...envelope(pass),...patch}).success).toBe(false);
 expect(Action.safeParse({...envelope(pass),report:{code:'refused',attempts:1}}).success).toBe(true);
});
