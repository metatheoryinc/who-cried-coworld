import { z } from 'zod';
import { ProjectedEvent,type Event } from './events.js';
import { Results } from './results.js';
import { Id } from './primitives.js';
import { project } from './presentation/project.js';
export const Replay=z.object({
 schema:z.literal('wcw.replay/1'),eventSchema:z.literal('wcw.events/1'),gameVersion:z.literal('0.1.0'),rulesVersion:z.enum(['wcw.rules/1','wcw.rules/2','wcw.rules/3']),complete:z.literal(true),
 episodeId:Id,maxDays:z.number().int().min(1).max(32),revealPolicy:z.literal('postgame_allowlist/1'),events:z.array(ProjectedEvent).min(3).max(20000),result:Results,
}).strict().refine(r=>{
 if(r.rulesVersion!==r.result.rulesVersion)return false;
 const start=r.events[0]?.payload;if(start?.kind!=='started'||start.rulesVersion!==r.rulesVersion)return false;
 const kinds=r.events.map(e=>e.payload.kind);
 if(kinds[0]!=='started'||kinds.at(-1)!=='finished'||['started','finished','roles','seed'].some(k=>kinds.filter(x=>x===k).length!==1))return false;
 if(r.result.daysCompleted>r.maxDays||r.result.outcome==='draw'&&r.result.daysCompleted!==r.maxDays)return false;
 const ids=new Set<string>(),speeches=new Set<string>();
 for(const [i,e] of r.events.entries()){
  if(e.cursor!==i+1||ids.has(e.id))return false;ids.add(e.id);
  const p=e.payload;
  const reply=p.kind==='speech'?p.speech.replyTo:p.kind==='bid'?p.bid.replyTo:null;
  if(reply!==null&&!speeches.has(reply))return false;
  if(p.kind==='speech')speeches.add(e.id);
 }
 const end=r.events.at(-1)!.payload;
 if(end.kind!=='finished'||JSON.stringify(end.result)!==JSON.stringify(r.result))return false;
 const roles=r.events.find(e=>e.payload.kind==='roles')!.payload;
 if(roles.kind!=='roles')return false;
 return roles.roles.every(p=>r.result.scores[p.slot]===(r.result.outcome==='draw'?0:r.result.outcome==='town_win'?Number(p.faction==='town'):r.result.outcome==='jester_win'?Number(p.role==='jester'):Number(p.faction==='wolf')));
},'Inconsistent replay evidence');
export type Replay=z.infer<typeof Replay>;
export function exportReplay(episodeId:string,maxDays:number,journal:Event[],result:Results):Replay{
 const replay=Replay.parse({schema:'wcw.replay/1',eventSchema:'wcw.events/1',gameVersion:'0.1.0',rulesVersion:result.rulesVersion,complete:true,episodeId,maxDays,revealPolicy:'postgame_allowlist/1',events:project(journal,'replay'),result});
 if(new TextEncoder().encode(JSON.stringify(replay)).byteLength>32*1024*1024)throw new Error('Replay exceeds byte limit');
 return replay;
}
