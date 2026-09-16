import { Action,type ActionBody,type Observation } from '../shared/player.js';
/** A legal baseline using only the seat's observation, never server state. */
export function scriptedAction(o:Observation):Action {
 let body:ActionBody;
 const first=(targets:number[])=>targets[0]??null;
 switch(o.request.kind){
  case 'bid':body={kind:'bid',wantsToSpeak:true,urgency:1,text:`Day ${o.day}, round ${o.request.window+1}: ${o.roster[o.self.slot]!.name} is reviewing the public votes.`,replyTo:null,accusation:null,reason:'Scripted baseline discussion.'};break;
  case 'noble_chat':case 'wolf_chat':body={kind:o.request.kind,text:`${o.phase==='day'?'Day':'Night'} ${o.day}, turn ${o.request.turn+1}: Let us compare the public claims before choosing our next move.`,summary:'Coordinate with living teammates.'};break;
  case 'vote':body={kind:'vote',target:first(o.request.targets),summary:'Vote for the first living seat.'};break;
  case 'night':body={kind:'night',actions:o.request.choices.map(c=>({ability:c.ability,target:first(c.targets),...(c.ability==='kill'?{killer:c.actors?.[0]??o.self.slot}:{})})),summary:'Use each offered ability on its first legal target.'};break;
 }
 return Action.parse({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body,report:null});
}
