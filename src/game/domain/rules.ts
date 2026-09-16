import { assignRoles, draw } from './random.js';
import { ActionBody, type Ability } from '../../shared/actions.js';
import { factionOf,defaultRoles } from '../../shared/roles.js';
export { factionOf } from '../../shared/roles.js';
import type { Faction, Role } from '../../shared/primitives.js';

import { Results } from '../../shared/results.js';
export type { Results } from '../../shared/results.js';
export type Seat={slot:number;role:Role;faction:Faction;alive:boolean};
export type State={seed:string;day:number;daysCompleted:number;maxDays:number;seats:Seat[];randomCounters:Record<string,number>;result:Results|null;jesterWinner?:number};
export type Choice={ability:Ability;targets:number[];allowPass:true;actors?:number[]};
export type NightRow={slot:number;actions:{ability:string;target:number|null;killer?:number}[]};
export type VoteRow={slot:number;target:number|null};
export type { PrivateResult } from '../../shared/events.js';
import type { PrivateResult } from '../../shared/events.js';
export type RuleEvent=
 | {kind:'ballots';ballots:VoteRow[];eliminated:number|null;resolution:'majority'|'no_majority'|'tie'|'all_abstain'}
 | {kind:'elimination';slot:number;cause:'vote'|'wolf'}
 | {kind:'night_outcome';ability:Ability;actor:number|null;target:number|null;outcome:'applied'|'blocked'|'protected'|'passed'|'actor_dead'}
 | {kind:'private_result';slot:number;result:PrivateResult}
 | {kind:'night_resolved';eliminated:number[]};
export function createState(seed:string,maxDays=8,deck:Role[]=defaultRoles):State {
 if(!Number.isInteger(maxDays)||maxDays<1||maxDays>32) throw new Error('Invalid day cap');
 return {seed,day:1,daysCompleted:0,maxDays,seats:assignRoles(seed,deck).map((role,slot)=>({slot,role,faction:factionOf(role),alive:true})),randomCounters:{},result:null};
}
export function legalNightChoices(s:State,slot:number):Choice[]{
 const actor=s.seats.find(p=>p.slot===slot);
 if(!actor?.alive||s.result) return [];
 const abilities:Record<Role,Ability[]>={wolf:['kill'],alchemist:['kill','block'],seer:['inspect'],guard:['protect'],chef:['jail'],track_reader:['kill','check'],dairy_maid:['inform'],priest:['track'],noble:[],jester:[],sheep:[]};
 return abilities[actor.role].map(ability=>({ability,allowPass:true,...(ability==='kill'?{actors:s.seats.filter(p=>p.alive&&p.faction==='wolf').map(p=>p.slot)}:{}),targets:s.seats.filter(p=>p.alive&&p.slot!==slot&&(ability!=='kill'||p.faction!=='wolf')).map(p=>p.slot).sort((a,b)=>a-b)}));
}
function livingActor(s:State,slot:number):Seat {
 const actor=s.seats.find(p=>p.slot===slot);
 if(!actor?.alive) throw new Error('Illegal actor');
 return actor;
}
function uniqueActors(s:State,rows:{slot:number}[]) {
 const seen=new Set<number>();
 for(const row of rows){livingActor(s,row.slot);if(seen.has(row.slot))throw new Error('Duplicate actor');seen.add(row.slot);}
}
/** Admission completes before mutation, so malformed composite responses are atomic. */
export function validNight(s:State,row:NightRow):boolean {
 if(!s.seats.some(p=>p.slot===row.slot&&p.alive)||s.result) return false;
 const parsed=ActionBody.safeParse({kind:'night',actions:row.actions,summary:''});
 if(!parsed.success) return false;
 const choices=legalNightChoices(s,row.slot);
 return row.actions.length===choices.length&&row.actions.every((a,i)=>a.ability===choices[i]!.ability&&(a.target===null||choices[i]!.targets.includes(a.target))&&(a.killer===undefined||(a.ability==='kill'&&s.seats.some(p=>p.slot===a.killer&&p.alive&&p.faction==='wolf'))));
}
export function resolveDay(s:State,rows:VoteRow[]):RuleEvent[]{
 if(s.result)return [];
 uniqueActors(s,rows);
 for(const r of rows)if(r.target!==null&&!s.seats.some(p=>p.slot===r.target&&p.alive))throw new Error('Illegal vote');
 const ballots=s.seats.filter(p=>p.alive).map(p=>({slot:p.slot,target:rows.find(r=>r.slot===p.slot)?.target??null})).sort((a,b)=>a.slot-b.slot);
 const counts=new Map<number,number>();
 for(const b of ballots)if(b.target!==null)counts.set(b.target,(counts.get(b.target)??0)+1);
 const leaders=[...counts].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
 let resolution:'majority'|'no_majority'|'tie'|'all_abstain'='all_abstain';
 let eliminated:number|null=null;
 if(leaders.length){
  if(leaders[1]?.[1]===leaders[0]![1])resolution='tie';
  else if(leaders[0]![1]>=Math.floor(ballots.length/2)+1){resolution='majority';eliminated=leaders[0]![0];}
  else resolution='no_majority';
 }
 const events:RuleEvent[]=[{kind:'ballots',ballots,eliminated,resolution}];
 if(eliminated!==null){if(s.seats[eliminated]!.role==='jester')s.jesterWinner=eliminated;livingActor(s,eliminated).alive=false;events.push({kind:'elimination',slot:eliminated,cause:'vote'});}
 return events;
}
export function resolveNight(s:State,rows:NightRow[]):RuleEvent[]{
 if(s.result)return [];
 uniqueActors(s,rows);
 for(const row of rows)if(!validNight(s,row))throw new Error('Illegal night action');
 const alive=s.seats.filter(p=>p.alive).sort((a,b)=>a.slot-b.slot);
 const choice=(slot:number,ability:Ability)=>rows.find(r=>r.slot===slot)?.actions.find(a=>a.ability===ability)?.target??null;
 const events:RuleEvent[]=[];
 const outcome=(ability:Ability,actor:number|null,target:number|null,result:Extract<RuleEvent,{kind:'night_outcome'}>['outcome'])=>events.push({kind:'night_outcome',ability,actor,target,outcome:result});
 const blocked=new Set<number>(),protectedSlots=new Set<number>();
 for(const a of alive.filter(p=>p.role==='alchemist')){
  const target=choice(a.slot,'block');
  if(target!==null&&s.seats[target]!.role!=='alchemist')blocked.add(target);
  outcome('block',a.slot,target,target===null?'passed':'applied');
 }
 for(const chef of alive.filter(p=>p.role==='chef')){
  const target=choice(chef.slot,'jail');
  if(target!==null&&!blocked.has(chef.slot)){blocked.add(target);protectedSlots.add(target);}
  outcome('jail',chef.slot,target,target===null?'passed':blocked.has(chef.slot)?'blocked':'applied');
 }
 for(const guard of alive.filter(p=>p.role==='guard')){
  const target=choice(guard.slot,'protect');
  if(target!==null&&!blocked.has(guard.slot))protectedSlots.add(target);
  outcome('protect',guard.slot,target,target===null?'passed':blocked.has(guard.slot)?'blocked':'applied');
 }
 const nominations=new Map<string,{target:number;killer:number;votes:number}>();
 for(const wolf of alive.filter(p=>p.faction==='wolf')){
  const action=rows.find(r=>r.slot===wolf.slot)?.actions.find(a=>a.ability==='kill');
  if(action?.target!==null&&action?.target!==undefined){
   const killer=action.killer??wolf.slot,key=`${action.target}:${killer}`;
   nominations.set(key,{target:action.target,killer,votes:(nominations.get(key)?.votes??0)+1});
  }
 }
 let target:number|null=null,killer:number|null=null;
 if(nominations.size){
  const most=Math.max(...[...nominations.values()].map(n=>n.votes));
  const tied=[...nominations.values()].filter(n=>n.votes===most).sort((a,b)=>a.target-b.target||a.killer-b.killer);
  const label=`kill_tie_day_${s.day}`;
  const d=draw(s.seed,label,s.randomCounters[label]??0,tied.length);
  if(tied.length>1)s.randomCounters[label]=d.nextCounter;
  const selected=tied[d.value]!;target=selected.target;killer=selected.killer;
 }
 const eliminated:number[]=[];
 if(target===null)outcome('kill',null,null,'passed');
 else if(blocked.has(killer!))outcome('kill',killer,target,'blocked');
 else if(protectedSlots.has(target))outcome('kill',killer,target,'protected');
 else{
  outcome('kill',killer,target,'applied');s.seats[target]!.alive=false;eliminated.push(target);events.push({kind:'elimination',slot:target,cause:'wolf'});
 }
 for(const seer of alive.filter(p=>p.role==='seer')){
  const inspected=choice(seer.slot,'inspect');
  if(!seer.alive){outcome('inspect',seer.slot,inspected,'actor_dead');continue;}
  if(inspected===null){outcome('inspect',seer.slot,null,'passed');continue;}
  const isBlocked=blocked.has(seer.slot);
  outcome('inspect',seer.slot,inspected,isBlocked?'blocked':'applied');
  events.push({kind:'private_result',slot:seer.slot,result:{day:s.day,ability:'inspect',target:inspected,result:isBlocked?'no_result':s.seats[inspected]!.faction==='wolf'?'wolf':'not_wolf'}});
 }
 const visits=new Map<number,Set<number>>();
 for(const e of events){
  if(e.kind==='night_outcome'&&e.actor!==null&&e.target!==null&&['applied','protected'].includes(e.outcome)){
   const set=visits.get(e.actor)??new Set<number>();set.add(e.target);visits.set(e.actor,set);
  }
 }
 for(const actor of alive.filter(p=>['track_reader','dairy_maid','priest'].includes(p.role))){
  const ability=actor.role==='track_reader'?'check':actor.role==='dairy_maid'?'inform':'track';
  const t=choice(actor.slot,ability);
  if(!actor.alive){outcome(ability,actor.slot,t,'actor_dead');continue;}
  if(t===null){outcome(ability,actor.slot,null,'passed');continue;}
  const denied=blocked.has(actor.slot);outcome(ability,actor.slot,t,denied?'blocked':'applied');
  if(!denied){const set=visits.get(actor.slot)??new Set<number>();set.add(t);visits.set(actor.slot,set);}
  if(ability==='check')events.push({kind:'private_result',slot:actor.slot,result:{day:s.day,ability,target:t,result:denied?'no_result':['wolf','sheep'].includes(s.seats[t]!.role)?'vanilla':s.seats[t]!.role}});
  if(ability==='inform'&&!denied&&s.seats[t]!.alive)events.push({kind:'private_result',slot:t,result:{day:s.day,ability,target:actor.slot,result:'town'}});
 }
 // Compute tracking after every visit, so two trackers see one another independently of seat order.
 for(const actor of alive.filter(p=>p.role==='priest'&&p.alive)){
  const t=choice(actor.slot,'track');if(t===null)continue;
  events.push({kind:'private_result',slot:actor.slot,result:{day:s.day,ability:'track',target:t,result:blocked.has(actor.slot)?'no_result':[...(visits.get(t)??[])].sort((a,b)=>a-b)}});
 }
 s.daysCompleted=s.day;
 events.push({kind:'night_resolved',eliminated});
 return events;
}
export function finishIfNeeded(s:State,afterNight:boolean):Results|null {
 if(s.result)return s.result;
 const wolves=s.seats.filter(p=>p.alive&&p.faction==='wolf').length;
 const town=s.seats.filter(p=>p.alive&&p.faction!=='wolf').length;
 let outcome:Results['outcome'];let reason:Results['reason'];let winner:Faction|null;
 if(s.jesterWinner!==undefined){outcome='jester_win';reason='jester_voted_out';winner='solo';}
 else if(wolves===0){outcome='town_win';reason='wolves_eliminated';winner='town';}
 else if(wolves>=town){outcome='wolf_win';reason='wolf_parity';winner='wolf';}
 else if(afterNight&&s.daysCompleted>=s.maxDays){outcome='draw';reason='day_cap';winner=null;}
 else return null;
 s.result=Results.parse({schema:'wcw.results/1',rulesVersion:'wcw.rules/2',outcome,reason,daysCompleted:s.daysCompleted,scores:s.seats.map(p=>outcome==='jester_win'?Number(p.slot===s.jesterWinner):p.faction===winner?1:0)});
 return s.result;
}
