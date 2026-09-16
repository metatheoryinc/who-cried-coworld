import { expect,it } from 'vitest';
import { createState,legalNightChoices } from '../../src/game/domain/rules.js';
import { openRequest,submit,closeRequest } from '../../src/game/domain/requests.js';
const state=()=>createState('000102030405060708090a0b0c0d0e0f');
const vote=()=>openRequest({slot:0,episodeId:'e',requestId:'r',observationId:'o',deadline:1000,request:{kind:'vote',targets:[0,1,2,3,4,5,6,7,8],allowPass:true}});
const message=(body:unknown,patch={})=>JSON.stringify({protocol:'wcw.player/1',type:'action',episodeId:'e',requestId:'r',observationId:'o',body,report:null,...patch});
it('locks first valid choice, permits identical retry, rejects replacement',()=>{
 const s=state(),r=vote(),m=message({kind:'vote',target:0,summary:''});
 expect(submit(r,s,0,m,50).status).toBe('accepted');
 expect(submit(r,s,0,m,100).status).toBe('duplicate');
 expect(submit(r,s,0,message({kind:'vote',target:1,summary:''}),150).status).toBe('rejected');
 expect(closeRequest(r)).toMatchObject({body:{kind:'vote',target:0},fallback:false});
});
it('rejects unauthorized sockets and mismatched request IDs without consuming retries',()=>{
 const s=state(),r=vote(),m=message({kind:'vote',target:0,summary:''});
 expect(submit(r,s,1,m,50).status).toBe('rejected');
 expect(submit(r,s,0,message({kind:'vote',target:0,summary:''},{requestId:'other'}),50).status).toBe('rejected');
 expect(r.attempt).toBe(0);expect(submit(r,s,0,m,60).status).toBe('accepted');
});
it('one schema retry then valid response retains original deadline',()=>{
 const r=vote();expect(submit(r,state(),0,'bad secret payload',20)).toMatchObject({status:'rejected',retry:true,code:'malformed'});
 expect(r.attempt).toBe(1);expect(r.deadline).toBe(1000);
 expect(submit(r,state(),0,message({kind:'vote',target:null,summary:''}),30).status).toBe('accepted');
 expect(closeRequest(r).failures).toEqual([{code:'malformed',source:'game',disposition:'retry',attempt:1}]);
});
it('two malformed replies produce one fallback with sanitized diagnostic evidence',()=>{
 const r=vote();submit(r,state(),0,'secret',1);submit(r,state(),0,'secret',2);
 const result=closeRequest(r);expect(result.body).toEqual({kind:'vote',target:null,summary:''});expect(result.fallback).toBe(true);
 expect(result.failures).toHaveLength(2);expect(JSON.stringify(result)).not.toContain('secret');
});
it('timeout and disconnect fallbacks remain distinguishable and final',()=>{
 const r=vote();expect(submit(r,state(),0,message({kind:'vote',target:1,summary:''}),1000).status).toBe('expired');
 expect(closeRequest(r)).toMatchObject({fallback:true,failures:[{code:'timeout'}]});
 const other=vote();expect(closeRequest(other,'disconnected')).toMatchObject({failures:[{code:'disconnected'}]});
 expect(submit(other,state(),0,message({kind:'vote',target:1,summary:''}),50).status).toBe('expired');
});
it('checks actual living targets even when the offered list is stale',()=>{
 const r=vote(),s=state();s.seats[1]!.alive=false;
 expect(submit(r,s,0,message({kind:'vote',target:1,summary:''}),5)).toMatchObject({status:'rejected',code:'illegal'});
});
it('falls back atomically for an illegal Alchemist composite',()=>{
 const s=state(),r=openRequest({slot:5,episodeId:'e',requestId:'r',observationId:'o',deadline:1000,request:{kind:'night',choices:legalNightChoices(s,5)}});
 const m=message({kind:'night',actions:[{ability:'kill',target:0},{ability:'block',target:5}],summary:''});
 submit(r,s,5,m,1);submit(r,s,5,m,2);
 expect(closeRequest(r).body).toEqual({kind:'night',actions:[{ability:'kill',target:null},{ability:'block',target:null}],summary:''});
});
it('requires bid replies to reference visible speech and accusations to target another living seat',()=>{
 const r=openRequest({slot:0,episodeId:'e',requestId:'r',observationId:'o',deadline:1000,request:{kind:'bid',window:0,maxCharacters:480},visibleSpeechIds:['public_1']});
 const b={kind:'bid',wantsToSpeak:true,urgency:1,text:'Hello',reason:'',replyTo:'secret_2',accusation:null};
 expect(submit(r,state(),0,message(b),5).code).toBe('illegal');
 expect(submit(r,state(),0,message({...b,replyTo:'public_1'}),6).status).toBe('accepted');
});
it('rejects dead actors and wrong kinds',()=>{
 const s=state(),r=vote();s.seats[0]!.alive=false;
 expect(submit(r,s,0,message({kind:'vote',target:1,summary:''}),1).code).toBe('illegal');
 expect(submit(vote(),state(),0,message({kind:'night',actions:[],summary:''}),1).code).toBe('illegal');
});
