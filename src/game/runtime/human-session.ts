import { validateModeratorChoice,type Moderator,type ModeratorChoice } from '../domain/moderator.js';
import { newD3Decks } from '../../shared/roles.js';
import { chooseSpeaker } from '../domain/human-host.js';
import { Session } from './session.js';
import { closeRequest,openRequest,type Request } from '../domain/requests.js';
import { legalNightChoices } from '../domain/rules.js';
import { publicRoster } from './observation.js';
import { project } from '../../shared/presentation/project.js';
import { HumanChat } from '../../shared/human.js';
import { decodeText } from '../../shared/decode.js';

/** Phase clock and policy decision clock are deliberately independent. */
export class HumanSession extends Session {
 period:'discussion'|'vote'|'coordination'|'actions'|'dusk'|'dawn'='discussion';
 phaseDeadline=0;
 moderator?:Moderator;
 private moderationController?:AbortController;
 cancelModerator(){const controller=this.moderationController;this.moderationController=undefined;controller?.abort();}

 readonly humanSlots=new Set<number>();
 override isHuman(slot:number){return this.humanSlots.has(slot);}
 protected override revisable(slot:number){return this.isHuman(slot);}
 registerHuman(slot:number){
  if(this.config.mode!=='human')return false;
  if(this.isHuman(slot))return true;
  this.humanSlots.add(slot);
  // A browser can arrive after the connection grace period. Drop a pending bot
  // speech request and give its owner the remaining human action window.
  const pending=this.pending.get(slot);
  if(pending){
   if(this.period==='discussion'||this.period==='coordination')this.pending.delete(slot);
   else if(!pending.accepted&&!pending.outcome)pending.deadline=this.phaseDeadline;
  }
  return true;
 }
 private answeredHumanIds=new Set<string>();
 private recentSpeakers:number[]=[];
 private restUntil:Record<number,number>={};
 private hostTurns:Record<number,number>={};
 private chatIds=new Map<string,string>();
 private chatCounts=new Map<string,number>();
 private lastChat=new Map<number,number>();
 protected override enterDay(now:number){
  this.period='discussion';this.stage='bid';this.window=0;this.counts={};
  this.answeredHumanIds.clear();this.recentSpeakers=[];this.hostTurns={};this.restUntil={};
  this.chatIds.clear();this.chatCounts.clear();this.lastChat.clear();
  this.phaseDeadline=now+this.config.humanTimers.dayMs;
  this.phaseEvent('day',this.config.humanTimers.dayMs);this.open(now);
 }
 protected override open(now:number,choice?:ModeratorChoice,moderated=false){
  const t=this.config.humanTimers;
  const interval=this.period==='discussion'?Math.min(13000,t.dayMs/6):this.period==='coordination'?t.coordinationMs/2:this.period==='vote'?t.voteMs:t.nightMs;
  this.pending.clear();this.deadline=Math.min(this.phaseDeadline,now+interval);
  const visible=project(this.journal,'public');
  const publicSpeech=visible.filter(e=>e.payload.kind==='speech').map(e=>e.id);
  const humanMessage=visible.filter(e=>e.day===this.state.day&&!this.answeredHumanIds.has(e.id)&&e.payload.kind==='speech'&&this.isHuman(e.payload.speech.slot)).at(0);
  const livingBots=this.living().filter(s=>!this.isHuman(s));
  const ready= livingBots.filter(s=>(this.restUntil[s]??0)<=this.window);
  const eligibleSlots=ready.length?ready:livingBots;
  if(this.period==='discussion'&&this.moderator&&eligibleSlots.length>0&&!moderated){
   this.cancelModerator();const controller=new AbortController();this.moderationController=controller;
   const day=this.state.day,window=this.window;
   const input={day,eligibleSlots,roster:publicRoster(this.state,this.config).map(({slot,name,alive})=>({slot,name,alive})),counts:{...this.hostTurns},recent:[...this.recentSpeakers],humanMessage:humanMessage?.payload.kind==='speech'?{id:humanMessage.id,text:humanMessage.payload.speech.text}:null,transcript:visible.filter(e=>e.payload.kind==='speech').slice(-40).flatMap(e=>e.payload.kind==='speech'?[{id:e.id,slot:e.payload.speech.slot,text:e.payload.speech.text}]:[])};
   let timeout:ReturnType<typeof setTimeout>;
   const expired=new Promise<never>((_,reject)=>{timeout=setTimeout(()=>{reject(Error('Moderator timed out'));controller.abort();},Math.min(2000,interval/4));});
   Promise.race([Promise.resolve().then(()=>this.moderator!(input,controller.signal)),expired]).then(raw=>validateModeratorChoice(raw,input)).catch(()=>undefined).then(selected=>{
    clearTimeout(timeout);const cancelled=controller.signal.aborted&&this.moderationController!==controller;
    if(!cancelled&&this.moderationController===controller&&!this.state.result&&this.period==='discussion'&&this.state.day===day&&this.window===window)this.open(now,selected,true);
   });
   return;
  }
  let host=this.period==='discussion'?chooseSpeaker({roster:publicRoster(this.state,this.config).filter(p=>eligibleSlots.includes(p.slot)),counts:this.hostTurns,recent:this.recentSpeakers,...(humanMessage?.payload.kind==='speech'?{humanMessage:{id:humanMessage.id,text:humanMessage.payload.speech.text}}:{})}):null;
  if(choice&&this.isHuman(choice.slot))choice=undefined;
  if(host&&choice)host={...host,slot:choice.slot};
  if(host){this.hostTurns[host.slot]=(this.hostTurns[host.slot]??0)+1;this.recentSpeakers=[...this.recentSpeakers,host.slot].slice(-2);}
  const teamActors=new Set<number>();
  for(const faction of ['wolf','noble']){const group=this.state.seats.filter(p=>p.alive&&!this.isHuman(p.slot)&&p.slot!==host?.slot&&(faction==='wolf'?p.faction==='wolf':p.role==='noble'));if(group.length)teamActors.add(group[this.window%group.length]!.slot);}
  for(const slot of this.living()){
   const seat=this.state.seats[slot]!;
   const team=seat.faction==='wolf'?'wolf_chat':seat.role==='noble'?'noble_chat':null;
   let request:Request;
   if(this.period==='discussion'||this.period==='coordination'){
    if(this.isHuman(slot))continue;
    if(this.period==='discussion'&&host?.slot===slot)request={kind:'bid',window:this.window,maxCharacters:480,host:{reason:host.reason,replyTo:host.replyTo,...(choice?{prompt:choice.prompt}:{} )}};
    else if(team&&(this.period==='coordination'||teamActors.has(slot)))request={kind:team,turn:this.window,maxCharacters:480};
    else continue;
   }else request=this.period==='vote'?{kind:'vote',targets:this.living(),allowPass:true}:{kind:'night',choices:legalNightChoices(this.state,slot)};
   const index=++this.counters[slot]!;
   this.pending.set(slot,openRequest({slot,episodeId:this.episodeId,requestId:`r_${slot}_${index}`,observationId:`o_${slot}_${index}`,deadline:this.isHuman(slot)?this.deadline:Math.min(this.deadline,now+15000),request,visibleSpeechIds:publicSpeech}));
  }
 }
 protected override close(){
  if(this.period==='dusk'||this.period==='dawn')return;
  if(this.period==='vote'||this.period==='actions'){super.close();return;}
  for(const [slot,p] of [...this.pending].sort(([a],[b])=>a-b)){
   const outcome=closeRequest(p),b=outcome.body;
   for(const failure of outcome.failures)this.emit({kind:'failure',slot,requestKind:p.request.kind,...failure});
   if('summary' in b&&b.summary)this.emit({kind:'confessional',slot,requestKind:p.request.kind,text:b.summary});
   if(b.kind==='bid'){
    const selected=b.wantsToSpeak;
    if(!selected)this.restUntil[slot]=this.window+3;
    this.emit({kind:'bid',slot,window:this.window,bid:b,rank:selected?0:null,selected});
    if(selected){
     const replyTo=p.request.kind==='bid'?p.request.host?.replyTo??b.replyTo:b.replyTo;
     this.emit({kind:'speech',speech:{slot,text:b.text,replyTo,accusation:b.accusation}});this.counts[slot]=(this.counts[slot]??0)+1;
     if(replyTo){const answered=project(this.journal,'public').find(e=>e.id===replyTo);if(answered?.payload.kind==='speech'&&this.isHuman(answered.payload.speech.slot))this.answeredHumanIds.add(answered.id);}
    }
   }else if((b.kind==='wolf_chat'||b.kind==='noble_chat')&&b.text)this.teamMessage(slot,b.kind,b.text);
  }
 }
 private teamMessage(slot:number,kind:'wolf_chat'|'noble_chat',text:string){
  this.emit({kind,slot,text},{kind:'seats',slots:this.state.seats.filter(p=>p.alive&&(kind==='wolf_chat'?p.faction==='wolf':p.role==='noble')).map(p=>p.slot)});
 }
 protected override next(now:number){
  if(now<this.phaseDeadline){this.window++;this.open(now);return;}
  this.window=0;
  const t=this.config.humanTimers;
  if(this.period==='discussion'){this.period='vote';this.stage='vote';this.phaseDeadline=now+t.voteMs;this.phaseEvent('vote',t.voteMs);}
  else if(this.period==='vote'){this.beginTransition('dusk',now);return;}
  else if(this.period==='dusk'){this.period='coordination';this.stage='wolf_chat';this.phaseDeadline=now+t.coordinationMs;this.phaseEvent('night',t.coordinationMs+t.nightMs);}
  else if(this.period==='coordination'){this.period='actions';this.stage='night';this.phaseDeadline=now+t.nightMs;}
  else if(this.period==='actions'){this.state.day++;this.beginTransition('dawn',now);return;}
  else {this.enterDay(now);return;}
  this.open(now);
 }
 private beginTransition(period:'dusk'|'dawn',now:number){
  this.period=period;this.pending.clear();this.phaseDeadline=now+this.config.humanTimers.transitionMs;this.deadline=this.phaseDeadline;
  this.phaseEvent(period==='dusk'?'night':'day',this.config.humanTimers.transitionMs);
 }
 override disconnect(slot:number){if(!this.isHuman(slot))super.disconnect(slot);}
 chat(slot:number,text:unknown,now:number):{status:'accepted'|'duplicate'|'rejected';message?:string}{
  this.advance(now);
  const parsed=decodeText(text,HumanChat);
  const reject=(message:string)=>({status:'rejected' as const,message});
  if(!parsed.ok)return reject('Invalid chat message.');
  const m=parsed.value,seat=this.state.seats[slot];
  if(!this.isHuman(slot)||!seat?.alive||this.state.result||this.phase==='waiting'||m.episodeId!==this.episodeId||m.phaseKey!==`${this.state.day}:${this.period}`)return reject('This chat window has closed.');
  if(m.channel==='town'?this.period!=='discussion':!['discussion','coordination'].includes(this.period)|| (m.channel==='wolves'?seat.faction!=='wolf':seat.role!=='noble'))return reject('This channel is unavailable.');
  const signature=JSON.stringify(m),prior=this.chatIds.get(`${slot}:${m.id}`);
  if(prior)return prior===signature?{status:'duplicate'}:reject('Message ID already used.');
  const key=`${slot}:${this.period}:${m.channel}`,count=this.chatCounts.get(key)??0;
  if(count>=30||now-(this.lastChat.get(slot)??-Infinity)<2000)return reject('Please wait a moment before sending another message.');
  this.chatIds.set(`${slot}:${m.id}`,signature);this.chatCounts.set(key,count+1);this.lastChat.set(slot,now);
  if(m.channel==='town')this.emit({kind:'speech',speech:{slot,text:m.text,replyTo:null,accusation:null}});
  else this.teamMessage(slot,m.channel==='wolves'?'wolf_chat':'noble_chat',m.text);
  return {status:'accepted'};
 }
 snapshot(slot:number,now:number){
  const seat=this.state.seats[slot]!,p=this.pending.get(slot),started=this.phase!=='waiting';
  const floor=[...this.pending.values()].find(p=>p.request.kind==='bid');
  const channels=['town',...(seat.faction==='wolf'?['wolves']:seat.role==='noble'?['nobles']:[])];
  return {protocol:'wcw.human/1',type:'snapshot',episodeId:this.episodeId,phase:this.phase,period:this.period,day:this.state.day,phaseKey:`${this.state.day}:${this.period}`,remainingMs:started&&!this.state.result?Math.max(0,Math.ceil(this.phaseDeadline-now)):0,
   gameSetup:{name:this.config.setup?'NewD3':'Custom setup',decks:this.config.setup?Object.entries(newD3Decks).map(([name,roles])=>({name,roles})):[{name:'Custom',roles:this.config.roles}],timers:this.config.humanTimers,maxDays:this.config.maxDays},
   floor:this.period==='discussion'&&floor?{slot:floor.slot,turn:this.window,prompt:floor.request.kind==='bid'?floor.request.host?.prompt??null:null,replyingToHuman:floor.request.kind==='bid'&&floor.request.host?.reason==='human_reply'}:null,
   self:started?{slot,role:seat.role,faction:seat.faction,alive:seat.alive}:null,roster:publicRoster(this.state,this.config),
   teammates:started?this.state.seats.filter(p=>seat.faction==='wolf'?p.faction==='wolf':seat.role==='noble'?p.role==='noble':false).map(p=>({slot:p.slot,role:p.role})):[],
   channels:started?channels:['town'],chatEnabled:started&&seat.alive&&!this.state.result&&(this.period==='discussion'||this.period==='coordination'),
   observation:started&&seat.alive?this.observation(slot,now):null,accepted:p?.accepted?.body??null,
   revealedRoles:this.state.result?this.state.seats.map(p=>({slot:p.slot,role:p.role,faction:p.faction})):[],
   events:project(this.journal,slot),result:this.state.result??null};
 }
}
