import { Event,ProjectedEvent } from '../events.js';
export type Recipient='public'|'replay'|number;
/** Public IDs count public events only; private journal traffic cannot affect them. */
export function project(journal:Event[],recipient:Recipient):ProjectedEvent[]{
 const output:ProjectedEvent[]=[];
 let publicCounter=0;
 for(const raw of journal){
  const e=Event.parse(raw);
  const isPublic=e.audience.kind==='public';
  if(isPublic)publicCounter++;
  const allowed=isPublic||recipient==='replay'||typeof recipient==='number'&&e.audience.kind==='seats'&&e.audience.slots.includes(recipient);
  if(!allowed)continue;
  const cursor=output.length+1;
  output.push(ProjectedEvent.parse({schema:'wcw.events/1',id:isPublic?`public_${publicCounter}`:`private_${cursor}`,cursor,day:e.day,phase:e.phase,reveal:e.reveal,payload:e.payload}));
 }
 return output;
}
