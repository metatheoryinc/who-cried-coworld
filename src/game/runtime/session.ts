import { newD3Decks,NewD3Setup } from '../../shared/roles.js';
import { draw } from '../domain/random.js';
import { randomBytes } from 'node:crypto';
import { GameConfig } from '../../shared/config.js';
import { Event,revealFor,type Payload,type Phase,type Audience } from '../../shared/events.js';
import { createState,legalNightChoices,resolveDay,resolveNight,finishIfNeeded,type State } from '../domain/rules.js';
import { openRequest,submit,closeRequest,type Pending,type Request,type Receipt } from '../domain/requests.js';
import { rankBids,wolfSchedule } from '../domain/floor.js';
import { buildObservation,publicRoster } from './observation.js';
import { project } from '../../shared/presentation/project.js';
import type { Bid } from '../../shared/actions.js';

/** One serialized owner. advance() receives monotonic time; no phase closes early. */
export class Session {
 readonly config:GameConfig;
 readonly state:State;
 readonly journal:Event[]=[];
 readonly pending=new Map<number,Pending>();
 phase:Phase='waiting';
 window=0;
 deadline=0;
 protected stage:'bid'|'vote'|'wolf_chat'|'day_chat'|'night'='bid';
 protected dayBidWindow=0;
 protected nobleSchedule:(number|null)[]=[];
 protected counters=Array(9).fill(0) as number[];
 protected counts:Record<number,number>={};
 protected recent:Record<number,string[]>={};
 protected schedule:(number|null)[]=[];
 protected journalBytes=0;
 constructor(config:GameConfig,readonly episodeId:string){
  this.config=GameConfig.parse(config);
  const seed=config.seed??randomBytes(16).toString('hex');
  const setup=config.setup==='random'?NewD3Setup.options[draw(seed,'setup',0,9).value]!:config.setup;
  this.state=createState(seed,config.maxDays,setup?newD3Decks[setup]:config.roles);
 }
 protected emit(payload:Payload,audience?:Audience){
  const reveal=revealFor(payload);
  const resolved=audience??(reveal==='public'?{kind:'public'}:reveal==='roles'||payload.kind==='night_outcome'?{kind:'server'}:'slot' in payload?{kind:'seats',slots:[payload.slot]}:{kind:'server'});
  const event=Event.parse({schema:'wcw.events/1',seq:this.journal.length+1,day:this.state.day,phase:this.phase,audience:resolved,reveal,payload});
  this.journalBytes+=Buffer.byteLength(JSON.stringify(event));
  if(this.journal.length>=20000||this.journalBytes>32*1024*1024)throw new Error('Journal limit exceeded');
  this.journal.push(event);
 }
 start(now:number){
  if(this.phase!=='waiting')throw new Error('Episode already started');
  this.emit({kind:'started',roster:publicRoster(this.state,this.config),rulesVersion:'wcw.rules/2'});
  this.emit({kind:'roles',roles:this.state.seats.map(p=>({slot:p.slot,role:p.role,faction:p.faction}))});
  this.emit({kind:'seed',seed:this.state.seed,randomVersion:'sha256-counter/1'});
  this.enterDay(now);
 }
 protected phaseEvent(phase:Phase,durationMs:number){this.phase=phase;this.emit({kind:'phase',phase,day:this.state.day,durationMs});}
 protected enterDay(now:number){
  this.stage='day_chat';this.window=0;this.dayBidWindow=0;this.counts={};this.prepareChats();this.phaseEvent('day',18*this.config.windowMs);this.open(now);
 }
 protected prepareChats(){
  const schedule=(slots:number[])=>([...slots,...slots,...Array(6).fill(null)] as (number|null)[]).slice(0,6);
  this.schedule=schedule(this.state.seats.filter(p=>p.alive&&p.faction==='wolf').map(p=>p.slot));
  this.nobleSchedule=schedule(this.state.seats.filter(p=>p.alive&&p.role==='noble').map(p=>p.slot));
 }
 protected living(){return this.state.seats.filter(p=>p.alive).map(p=>p.slot);}
 protected open(now:number){
  this.pending.clear();this.deadline=now+this.config.windowMs;
  let actors=this.living();
  if(this.stage==='wolf_chat'||this.stage==='day_chat'){actors=[this.schedule[this.window],this.nobleSchedule[this.window]].filter((x):x is number=>x!==null&&x!==undefined);}
  const publicSpeech=project(this.journal,'public').filter(e=>e.payload.kind==='speech').map(e=>e.id);
  for(const slot of actors){
   let request:Request;
   switch(this.stage){
    case 'bid':request={kind:'bid',window:this.window,maxCharacters:480};break;
    case 'vote':request={kind:'vote',targets:this.living(),allowPass:true};break;
    case 'day_chat':case 'wolf_chat':request={kind:this.state.seats[slot]!.role==='noble'?'noble_chat':'wolf_chat',turn:this.window,maxCharacters:480};break;
    case 'night':request={kind:'night',choices:legalNightChoices(this.state,slot)};break;
   }
   const index=++this.counters[slot]!;
   this.pending.set(slot,openRequest({slot,episodeId:this.episodeId,requestId:`r_${slot}_${index}`,observationId:`o_${slot}_${index}`,deadline:this.deadline,request,visibleSpeechIds:publicSpeech}));
  }
 }
 observation(slot:number,now:number){const p=this.pending.get(slot);return p&&!p.outcome&&!this.state.result?buildObservation(this.state,this.config,this.journal,p,this.phase,now):null;}
 receive(slot:number,text:unknown,now:number):Receipt{
  const p=this.pending.get(slot);
  if(!p||this.state.result)return {status:'expired',code:null,retry:false};
  return submit(p,this.state,slot,text,now);
 }
 disconnect(slot:number){const p=this.pending.get(slot);if(p&&!p.accepted)closeRequest(p,'disconnected');}
 advance(now:number){
  if(this.phase==='waiting')return;
  while(!this.state.result&&now>=this.deadline){const boundary=this.deadline;this.close();if(!this.state.result)this.next(boundary);}
 }
 protected close(){
  const rows=[...this.pending].sort(([a],[b])=>a-b).map(([slot,p])=>({slot,request:p.request,outcome:closeRequest(p)}));
  for(const {slot,request,outcome} of rows){
   for(const failure of outcome.failures)this.emit({kind:'failure',slot,requestKind:request.kind,...failure});
   if('summary' in outcome.body&&outcome.body.summary)this.emit({kind:'confessional',slot,requestKind:request.kind,text:outcome.body.summary});
  }
  if(this.stage==='bid'){
   const bids=rows.map(r=>({slot:r.slot,bid:r.outcome.body as Bid}));
   const lastSpeech=project(this.journal,'public').filter(e=>e.payload.kind==='speech').at(-1)?.id??null;
   const ranking=rankBids(bids,{day:this.state.day,window:this.window,living:this.living(),counts:this.counts,recent:this.recent,lastSpeechId:lastSpeech});
   for(const row of bids)this.emit({kind:'bid',slot:row.slot,window:this.window,bid:row.bid,rank:ranking.includes(row.slot)?ranking.indexOf(row.slot):null,selected:ranking[0]===row.slot});
   const winner=bids.find(row=>row.slot===ranking[0]);
   if(winner){
    const {slot,bid}=winner;
    this.emit({kind:'speech',speech:{slot,text:bid.text,replyTo:bid.replyTo,accusation:bid.accusation}});
    this.counts[slot]=(this.counts[slot]??0)+1;this.recent[slot]=[...(this.recent[slot]??[]),bid.text].slice(-5);
   }
  }else if(this.stage==='vote'){
   const votes=rows.map(({slot,outcome})=>{if(outcome.body.kind!=='vote')throw new Error('Invalid vote batch');return {slot,target:outcome.body.target};});
   for(const event of resolveDay(this.state,votes))this.emit(event);
   this.finish(false);
  }else if(this.stage==='wolf_chat'||this.stage==='day_chat'){
   for(const {slot,outcome} of rows)if((outcome.body.kind==='wolf_chat'||outcome.body.kind==='noble_chat')&&outcome.body.text)this.emit({kind:outcome.body.kind,slot,text:outcome.body.text},{kind:'seats',slots:this.state.seats.filter(p=>p.alive&&(outcome.body.kind==='wolf_chat'?p.faction==='wolf':p.role==='noble')).map(p=>p.slot)});
  }else{
   const choices=rows.map(({slot,outcome})=>{if(outcome.body.kind!=='night')throw new Error('Invalid night batch');this.emit({kind:'night_choices',slot,actions:outcome.body.actions});return {slot,actions:outcome.body.actions};});
   for(const event of resolveNight(this.state,choices))this.emit(event);
   this.finish(true);
  }
 }
 protected finish(afterNight:boolean){
  const result=finishIfNeeded(this.state,afterNight);
  if(result){this.phase='finished';this.emit({kind:'finished',result});this.pending.clear();}
 }
 protected next(boundary:number){
  if(this.stage==='day_chat'){
   this.window++;if(this.window===6){this.stage='bid';this.window=this.dayBidWindow;}
  }else if(this.stage==='bid'){
   this.window++;this.dayBidWindow=this.window;
   if(this.window===3){this.stage='day_chat';this.window=0;this.prepareChats();}
   else if(this.window===6){this.stage='vote';this.window=0;this.phaseEvent('vote',this.config.windowMs);}
  }else if(this.stage==='vote'){
   this.stage='wolf_chat';this.window=0;this.prepareChats();this.phaseEvent('night',7*this.config.windowMs);
  }else if(this.stage==='wolf_chat'){
   this.window++;if(this.window===6){this.stage='night';this.window=0;}
  }else{this.state.day++;this.enterDay(boundary);return;}
  this.open(boundary);
 }
}
