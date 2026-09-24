import type { ActionBody } from '../shared/actions.js';
/** A decision the player makes by stamping a seat: the vote, each night ability, or the Wolf knife. */
export type StampId='vote'|'knife'|'kill'|'block'|'inspect'|'protect'|'jail'|'check'|'inform'|'track';
export type Placements=Partial<Record<StampId,number|null>>;
type Choice={ability:string;targets:number[];actors?:number[]};
type StampRequest={kind:'vote';targets:number[]}|{kind:'night';choices:Choice[]};

export function traySlots(r:StampRequest):{id:StampId;targets:number[]}[]{
 if(r.kind==='vote')return [{id:'vote',targets:r.targets}];
 return r.choices.flatMap(c=>[{id:c.ability as StampId,targets:c.targets},...(c.ability==='kill'&&c.actors?[{id:'knife' as const,targets:c.actors}]:[])]);
}
export function placementsFrom(r:StampRequest,accepted:ActionBody|null):Placements{
 if(r.kind==='vote')return accepted?.kind==='vote'?{vote:accepted.target}:{};
 if(accepted?.kind!=='night')return {};
 const p:Placements={};
 for(const a of accepted.actions){p[a.ability as StampId]=a.target;if(a.ability==='kill'&&a.killer!==undefined)p.knife=a.killer;}
 return p;
}
/** Placing a stamp where it already is lifts it; the first kill target also puts the knife on you. */
export function place(p:Placements,r:StampRequest,id:StampId,slot:number,self:number):Placements{
 const slots=traySlots(r),stamp=slots.find(s=>s.id===id);
 if(!stamp?.targets.includes(slot))return p;
 const next:Placements={...p,[id]:p[id]===slot?null:slot};
 const knife=slots.find(s=>s.id==='knife');
 if(id==='kill'&&next.kill!=null&&p.knife==null&&knife?.targets.includes(self))next.knife=self;
 return next;
}
export function clear(p:Placements,id:StampId):Placements{return {...p,[id]:null};}
export function bodyFor(r:StampRequest,p:Placements):ActionBody{
 if(r.kind==='vote')return {kind:'vote',target:p.vote??null,summary:''};
 return {kind:'night',actions:r.choices.map(c=>({ability:c.ability,target:p[c.ability as StampId]??null,...(c.ability==='kill'&&p.knife!=null?{killer:p.knife}:{})})),summary:''} as ActionBody;
}
export function packStamps(drafts:{slot:number;actions:{ability:string;target:number|null;killer?:number}[]}[]){
 return drafts.flatMap(d=>d.actions.filter(a=>a.ability==='kill').flatMap(a=>[
  ...(a.target!==null?[{id:'kill' as const,slot:a.target,by:d.slot}]:[]),
  // Mirrors the rules: a target without a killer is a knife vote for the submitter.
  ...(a.killer!==undefined||a.target!==null?[{id:'knife' as const,slot:a.killer??d.slot,by:d.slot}]:[]),
 ]));
}
export function stampsOn(p:Placements,slot:number):StampId[]{return (Object.keys(p) as StampId[]).filter(id=>p[id]===slot);}
