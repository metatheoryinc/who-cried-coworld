import type { Faction } from '../../shared/roles.js';

/** Plain facts about a finished episode, gathered from the journal by the runtime. */
export type ScoringInput={
 factions:Faction[];
 /** Slots on the winning side; empty on a draw. */
 winners:number[];
 daysCompleted:number;
 /** Day on which each seat died, or null if alive at the end. */
 deathDay:(number|null)[];
 /** Every ballot, with who was alive and how many wolves were alive when it was cast. */
 votes:{day:number;slot:number;target:number|null;living:number[];livingWolves:number}[];
 /** Accepted private suspicion reports: wolf probability per other living slot. */
 reports:{day:number;slot:number;probs:Record<number,number>}[];
 /** Every Town vote request that invited a suspicion report. */
 asked:{day:number;slot:number;living:number[];livingWolves:number}[];
 requests:number[];
 fallbacks:number[];
};
export type SeatMetrics={win:number;read?:number;hidden?:number;vote_hit?:number;survived?:number;valid_actions?:number};

const WIN=0.75,BONUS=0.25;
const round=(n:number)=>Math.round(n*1e4)/1e4;
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;

/** Headline = 0.75 × win + 0.25 × bonus; Town's bonus is `read`, a Wolf's is `hidden`. */
export function scoreEpisode(input:ScoringInput):{scores:number[];metrics:SeatMetrics[]}{
 const wolf=(slot:number)=>input.factions[slot]==='wolf';
 const metrics=input.factions.map((faction,slot):SeatMetrics=>{
  const m:SeatMetrics={win:Number(input.winners.includes(slot))};
  if(faction==='town'){
   const asked=input.asked.filter(a=>a.slot===slot);
   if(asked.length)m.read=round(mean(asked.map(a=>readSkill(a,input.reports.find(r=>r.day===a.day&&r.slot===slot)?.probs,wolf))));
   const cast=input.votes.filter(v=>v.slot===slot&&v.target!==null);
   if(cast.length){
    const rate=cast.filter(v=>wolf(v.target!)).length/cast.length,chance=mean(cast.map(v=>v.livingWolves/(v.living.length-1)));
    m.vote_hit=round(Math.max(0,(rate-chance)/(1-chance)));
   }
  }
  if(faction==='wolf'){
   const days=[...new Set(input.asked.filter(a=>a.living.includes(slot)).map(a=>a.day))];
   if(days.length)m.hidden=round(mean(days.map(day=>hiddenOn(day,slot,input))));
  }
  if(input.daysCompleted>0){const died=input.deathDay[slot];m.survived=round(Math.min(died===null||died===undefined?input.daysCompleted:died-1,input.daysCompleted)/input.daysCompleted);}
  if(input.requests[slot])m.valid_actions=round((input.requests[slot]!-(input.fallbacks[slot]??0))/input.requests[slot]!);
  return m;
 });
 const scores=metrics.map((m,slot)=>round(WIN*m.win+BONUS*(input.factions[slot]==='town'?m.read??0:input.factions[slot]==='wolf'?m.hidden??0:0)));
 return {scores,metrics};
}

/** 1 − Brier ÷ know-nothing Brier, floored at 0; a missing report scores as the know-nothing report. */
function readSkill(a:ScoringInput['asked'][number],probs:Record<number,number>|undefined,wolf:(slot:number)=>boolean){
 if(!probs)return 0;
 const others=a.living.filter(s=>s!==a.slot),p0=a.livingWolves/others.length;
 const brier=(p:(s:number)=>number)=>mean(others.map(s=>(p(s)-Number(wolf(s)))**2));
 const baseline=brier(()=>p0);
 return baseline>0?Math.max(0,1-brier(s=>probs[s]??p0)/baseline):0;
}

/** How far below chance Town's submitted suspicion of this wolf stayed on one day; 0 without reports. */
function hiddenOn(day:number,wolf:number,input:ScoringInput){
 const asked=input.asked.filter(a=>a.day===day&&a.living.includes(wolf));
 const seen=input.reports.filter(r=>r.day===day&&asked.some(a=>a.slot===r.slot)&&wolf in r.probs).map(r=>r.probs[wolf]!);
 if(!seen.length)return 0;
 const a=asked[0]!,chance=a.livingWolves/(a.living.length-1);
 return Math.max(0,(chance-mean(seen))/chance);
}

export type DropReason='missing'|'wrong_count'|'unknown_player'|'duplicate_player'|'out_of_range';
/** A report must give exactly one probability in [0, 1] to each other living player; otherwise it is dropped with a reason. */
export function checkSuspicion(raw:{slot:number;wolf:number}[]|undefined,others:number[]):{ok:true;reports:{slot:number;wolf:number}[]}|{ok:false;reason:DropReason;player?:number}{
 if(!raw)return {ok:false,reason:'missing'};
 const seen=new Set<number>();
 for(const r of raw){
  if(!others.includes(r.slot))return {ok:false,reason:'unknown_player',...(r.slot>=0&&r.slot<=8?{player:r.slot}:{})};
  if(seen.has(r.slot))return {ok:false,reason:'duplicate_player',player:r.slot};
  if(!Number.isFinite(r.wolf)||r.wolf<0||r.wolf>1)return {ok:false,reason:'out_of_range',player:r.slot};
  seen.add(r.slot);
 }
 if(raw.length!==others.length)return {ok:false,reason:'wrong_count'};
 return {ok:true,reports:[...raw].sort((a,b)=>a.slot-b.slot).map(({slot,wolf})=>({slot,wolf}))};
}
