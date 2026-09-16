import { Action, type ActionBody } from '../../shared/player.js';
import { decodeText } from '../../shared/decode.js';
import { validNight, type Choice, type State } from './rules.js';
export type Request=
 | {kind:'bid';window:number;maxCharacters:480;host?:{reason:'human_reply'|'open_discussion';replyTo:string|null;prompt?:string}}
 | {kind:'wolf_chat'|'noble_chat';turn:number;maxCharacters:480}
 | {kind:'vote';targets:number[];allowPass:true}
 | {kind:'night';choices:Choice[]};
export type Code='timeout'|'disconnected'|'malformed'|'illegal'|'refused'|'provider_error'|'throttled'|'version';
export type Failure={code:Code;source:'game'|'policy_report';disposition:'retry'|'fallback';attempt:0|1|2};
export type Outcome={body:ActionBody;fallback:boolean;failures:Failure[]};
export type Pending={slot:number;episodeId:string;requestId:string;observationId:string;deadline:number;request:Request;visibleSpeechIds?:string[];attempt:0|1;accepted:Action|null;outcome:Outcome|null;failures:Failure[]};
export type Receipt={status:'accepted'|'duplicate'|'rejected'|'expired';code:Code|null;retry:boolean};
export function openRequest(input:Omit<Pending,'attempt'|'accepted'|'outcome'|'failures'>):Pending {
 return {...structuredClone(input),attempt:0,accepted:null,outcome:null,failures:[]};
}
export function fallbackBody(r:Request):ActionBody {
 switch(r.kind){
  case 'bid':return {kind:'bid',wantsToSpeak:false,urgency:0,text:'',replyTo:null,accusation:null,reason:''};
  case 'wolf_chat':case 'noble_chat':return {kind:r.kind,text:'',summary:''};
  case 'vote':return {kind:'vote',target:null,summary:''};
  case 'night':return {kind:'night',actions:r.choices.map(c=>({ability:c.ability,target:null})),summary:''};
 }
}
export function closeRequest(p:Pending,code:Code='timeout'):Outcome {
 if(p.outcome)return p.outcome;
 if(p.accepted){
  p.outcome={body:p.accepted.body,fallback:false,failures:[...p.failures]};
 }else{
  const final:Failure={code,source:'game',disposition:'fallback',attempt:p.attempt===1?2:0};
  p.outcome={body:fallbackBody(p.request),fallback:true,failures:[...p.failures,final]};
 }
 return p.outcome;
}
function legal(p:Pending,s:State,b:ActionBody):boolean {
 if(s.result||!s.seats.some(seat=>seat.slot===p.slot&&seat.alive)||b.kind!==p.request.kind)return false;
 const living=(slot:number)=>s.seats.some(seat=>seat.slot===slot&&seat.alive);
 switch(b.kind){
  case 'vote':return p.request.kind==='vote'&&(b.target===null||(p.request.targets.includes(b.target)&&living(b.target)));
  case 'night': {
   const request=p.request;
   if(request.kind!=='night'||!validNight(s,{slot:p.slot,actions:b.actions}))return false;
   return b.actions.length===request.choices.length&&b.actions.every((action,i)=>{
    const offered=request.choices[i]!;
    return action.ability===offered.ability&&(action.target===null||offered.targets.includes(action.target));
   });
  }
  case 'bid':return (b.replyTo===null||(p.visibleSpeechIds??[]).includes(b.replyTo))&&(b.accusation===null||(b.accusation!==p.slot&&living(b.accusation)));
  case 'wolf_chat':return s.seats[p.slot]!.faction==='wolf';
  case 'noble_chat':return s.seats[p.slot]!.role==='noble';
 }
}
function reject(p:Pending,code:Code):Receipt {
 if(p.attempt===0){p.attempt=1;p.failures.push({code,source:'game',disposition:'retry',attempt:1});return {status:'rejected',code,retry:true};}
 closeRequest(p,code);return {status:'rejected',code,retry:false};
}
export function submit(p:Pending,s:State,authenticatedSlot:number,text:unknown,now:number):Receipt {
 if(authenticatedSlot!==p.slot)return {status:'rejected',code:'illegal',retry:false};
 if(now>=p.deadline){closeRequest(p);return {status:'expired',code:'timeout',retry:false};}
 if(p.outcome)return {status:'expired',code:null,retry:false};
 const decoded=decodeText(text,Action);
 if(!decoded.ok)return p.accepted?{status:'rejected',code:'malformed',retry:false}:reject(p,'malformed');
 const a=decoded.value;
 if(a.episodeId!==p.episodeId||a.requestId!==p.requestId||a.observationId!==p.observationId)return {status:'rejected',code:'illegal',retry:false};
 if(p.accepted)return JSON.stringify(p.accepted)===JSON.stringify(a)?{status:'duplicate',code:null,retry:false}:{status:'rejected',code:'illegal',retry:false};
 if(!legal(p,s,a.body))return reject(p,'illegal');
 p.accepted=a;
 if(a.report)p.failures.push({code:a.report.code,source:'policy_report',disposition:'fallback',attempt:a.report.attempts});
 return {status:'accepted',code:null,retry:false};
}
