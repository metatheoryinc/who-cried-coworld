import { Action,type ActionBody,type Observation } from '../shared/player.js';
/** A seeded random stream per request: games are reproducible, yet baselines do not all pick the same seat. */
function chooser(seed:string){
 let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
 return <T,>(items:readonly T[]):T|null=>{
  if(!items.length)return null;
  h=(h+0x6d2b79f5)>>>0;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
  return items[((t^(t>>>14))>>>0)%items.length]!;
 };
}
/** A legal baseline using only the seat's observation, never server state. It votes for a random
 * living player other than itself and uses each night ability on a random legal target, so a table
 * of baselines still reaches majorities and kills and games end. */
export function scriptedAction(o:Pick<Observation,'episodeId'|'requestId'|'observationId'|'request'|'self'|'roster'|'day'|'phase'>):Action {
 const pick=chooser(`${o.episodeId}:${o.requestId}:${o.self.slot}`);
 let body:ActionBody;
 switch(o.request.kind){
  case 'bid':body={kind:'bid',wantsToSpeak:true,urgency:1,text:`Day ${o.day}, round ${o.request.window+1}: ${o.roster[o.self.slot]!.name} is reviewing the public votes.`,replyTo:null,accusation:null,reason:'Scripted baseline discussion.'};break;
  case 'noble_chat':case 'wolf_chat':body={kind:o.request.kind,text:`${o.phase==='day'?'Day':'Night'} ${o.day}, turn ${o.request.turn+1}: Let us compare the public claims before choosing our next move.`,summary:'Coordinate with living teammates.'};break;
  case 'vote':{const others=o.request.targets.filter(t=>t!==o.self.slot);body={kind:'vote',target:pick(others.length?others:o.request.targets),summary:'Vote for a random living player.'};break;}
  case 'night':body={kind:'night',actions:o.request.choices.map(c=>({ability:c.ability,target:pick(c.targets),...(c.ability==='kill'?{killer:pick(c.actors??[])??o.self.slot}:{})})),summary:'Use each offered ability on a random legal target.'};break;
 }
 return Action.parse({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body,report:null});
}
/** Forward compatibility: when a newer game adds observation fields this build does not know, still act
 * from the ids and request instead of dropping the connection (older baselines passed every decision). */
export function actOnLooseObservation(text:string):Action|null{
 try{
  const o=JSON.parse(text);
  if(o?.type!=='observation'||typeof o.requestId!=='string'||!o.request||!o.self||!Array.isArray(o.roster))return null;
  return scriptedAction(o);
 }catch{return null;}
}
