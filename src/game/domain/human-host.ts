/** Public information only: the moderator must never select speakers using roles. */
export function chooseSpeaker(input:{roster:{slot:number;name:string;alive:boolean}[];humanSlot:number;counts:Record<number,number>;recent:number[];humanMessage?:{id:string;text:string}}){
 const candidates=input.roster.filter(p=>p.alive&&p.slot!==input.humanSlot);
 const repeated=input.recent.length>=2&&input.recent.at(-1)===input.recent.at(-2)?input.recent.at(-1):null;
 const eligible=candidates.filter(p=>p.slot!==repeated);
 const pool=eligible.length?eligible:candidates;
 const mentioned=pool.filter(p=>{
  const escaped=p.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return input.humanMessage&&new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`,'iu').test(input.humanMessage.text);
 });
 const ranked=[...(mentioned.length?mentioned:pool)].sort((a,b)=>(input.counts[a.slot]??0)-(input.counts[b.slot]??0)||Number(a.slot===input.recent.at(-1))-Number(b.slot===input.recent.at(-1))||a.slot-b.slot);
 const slot=ranked[0]?.slot;
 return slot===undefined?null:{slot,reason:input.humanMessage?'human_reply' as const:'open_discussion' as const,replyTo:input.humanMessage?.id??null};
}
