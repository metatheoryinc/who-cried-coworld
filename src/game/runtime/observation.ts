import { Observation } from '../../shared/player.js';
import type { GameConfig } from '../../shared/config.js';
import type { State } from '../domain/rules.js';
import type { Pending } from '../domain/requests.js';
import type { Event,Phase } from '../../shared/events.js';
import { project } from '../../shared/presentation/project.js';
export function publicRoster(s:State,c:GameConfig){
 return s.seats.map(p=>({slot:p.slot,name:c.players[p.slot]!.name,...(c.players[p.slot]!.policyName?{policyName:c.players[p.slot]!.policyName}:{}),alive:p.alive,presentation:structuredClone(c.presentation[p.slot]!)}));
}
export function buildObservation(s:State,c:GameConfig,journal:Event[],p:Pending,phase:Phase,now:number):Observation{
 const seat=s.seats[p.slot];
 if(!seat?.alive||s.result)throw new Error('No action observation for inactive seat');
 const visible=project(journal,p.slot);
 const speech=visible.filter(e=>e.payload.kind==='speech'||e.payload.kind==='wolf_chat'||e.payload.kind==='noble_chat'||e.payload.kind==='elimination');
 // Preserve every public death even when older conversation leaves the context window.
 const deaths=speech.filter(e=>e.payload.kind==='elimination');
 const recent=new Set(speech.filter(e=>e.payload.kind!=='elimination').slice(-(128-deaths.length)));
 const transcript=speech.filter(e=>e.payload.kind==='elimination'||recent.has(e));
 const observation=Observation.parse({protocol:'wcw.player/1',type:'observation',episodeId:p.episodeId,requestId:p.requestId,observationId:p.observationId,attempt:p.attempt,remainingMs:Math.min(45000,Math.max(0,Math.ceil(p.deadline-now))),phase,day:s.day,
  self:{slot:seat.slot,role:seat.role,faction:seat.faction,alive:seat.alive},roster:publicRoster(s,c).map(({policyName,...seat})=>seat),
  teammates:seat.faction==='wolf'?s.seats.filter(p=>p.faction==='wolf').map(p=>({slot:p.slot,role:p.role})):seat.role==='noble'?s.seats.filter(p=>p.role==='noble').map(p=>({slot:p.slot,role:p.role})):[],
  privateResults:visible.flatMap(e=>e.payload.kind==='private_result'&&e.payload.slot===seat.slot?[e.payload.result]:[]),
  votes:visible.flatMap(e=>e.payload.kind==='ballots'?[{day:e.day,ballots:e.payload.ballots,eliminated:e.payload.eliminated}]:[]),
  transcript,transcriptTruncated:speech.length>128,request:p.request,
 });
 if(new TextEncoder().encode(JSON.stringify(observation)).byteLength>512*1024)throw new Error('Observation exceeds byte limit');
 return observation;
}
