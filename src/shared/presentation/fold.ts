import type { ProjectedEvent,Phase } from '../events.js';
import type { Role } from '../roles.js';
import type { Presentation } from '../config.js';
import type { Results } from '../results.js';
export type View={day:number;phase:Phase;roster:{slot:number;name:string;alive:boolean;presentation:Presentation}[];roles:Record<number,Role>;messages:{id:string;slot:number;text:string;private:boolean;channel?:string;day:number}[];ballots:{slot:number;target:number|null}[];resolution:string;details:{id:string;kind:string;day:number;payload:unknown}[];result:Results|null};
export function foldEvents(events:ProjectedEvent[]):View{
 const view:View={day:0,phase:'waiting',roster:[],roles:{},messages:[],ballots:[],resolution:'',details:[],result:null};
 for(const e of events){
  const p=e.payload;view.day=e.day;view.phase=e.phase;
  switch(p.kind){
   case 'started':view.roster=structuredClone(p.roster);break;
   case 'phase':view.day=p.day;view.phase=p.phase;break;
   case 'roles':for(const row of p.roles)view.roles[row.slot]=row.role;break;
   case 'speech':view.messages.push({id:e.id,slot:p.speech.slot,text:p.speech.text,private:false,day:e.day});break;
   case 'noble_chat':case 'wolf_chat':view.messages.push({id:e.id,slot:p.slot,text:p.text,private:true,channel:p.kind==='noble_chat'?'Noble chat':'Wolf chat',day:e.day});break;
   case 'ballots':view.ballots=structuredClone(p.ballots);view.resolution=p.resolution;break;
   case 'elimination':{const seat=view.roster.find(s=>s.slot===p.slot);if(seat)seat.alive=false;break;}
   case 'finished':view.result=structuredClone(p.result);view.phase='finished';break;
   default:if(e.reveal!=='public')view.details.push({id:e.id,kind:p.kind,day:e.day,payload:structuredClone(p)});
  }
 }
 return view;
}
