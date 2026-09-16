import type { Payload } from '../shared/events.js';
/** Presentation only: a timed pause and its following phase share one banner. */
export function foldPhaseBanners<T extends {day:number;payload:Payload}>(events:T[]):T[]{
 const banners=new Map<string,T>();
 const output:T[]=[];
 for(const event of events){
  if(event.payload.kind!=='phase'){output.push(event);continue;}
  const key=`${event.day}:${event.payload.phase}`;
  const prior=banners.get(key);
  if(prior?.payload.kind==='phase'){
   prior.payload.durationMs+=event.payload.durationMs;
  }else{
   const copy={...event,payload:{...event.payload}};
   banners.set(key,copy);output.push(copy);
  }
 }
 return output;
}
