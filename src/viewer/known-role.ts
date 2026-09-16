import type {Role} from '../shared/roles.js';
import type {Payload} from '../shared/events.js';
/** Exact role knowledge only; alignment checks and 'vanilla' are ambiguous. */
export function knownRole(s:{self:{slot:number;role:Role}|null;teammates:{slot:number;role:Role}[];events:{payload:Payload}[];result?:unknown;revealedRoles?:{slot:number;role:Role}[]}|null,slot:number):Role|null{
 if(!s)return null;
 if(s.self?.slot===slot)return s.self.role;
 const teammate=s.teammates.find(t=>t.slot===slot);if(teammate)return teammate.role;
 if(s.result){const revealed=s.revealedRoles?.find(t=>t.slot===slot);if(revealed)return revealed.role;}
 for(const e of s.events){
  if(e.payload.kind!=='private_result'||e.payload.slot!==s.self?.slot)continue;
  const r=e.payload.result;if(r.target!==slot)continue;
  if(r.ability==='check'&&r.result!=='vanilla'&&r.result!=='no_result')return r.result;
  if(r.ability==='inform')return 'dairy_maid';
 }
 return null;
}
