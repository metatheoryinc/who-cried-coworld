import { z } from 'zod';
import { RoleDeck,factionOf } from './roles.js';
import { Slot,Role,Faction,GameText,Id } from './primitives.js';
import { Presentation } from './config.js';
import { Ability,Bid,NightChoice } from './actions.js';
import { Results } from './results.js';
export const Phase=z.enum(['waiting','day','vote','night','finished']);
export type Phase=z.infer<typeof Phase>;
export const Day=z.number().int().min(0).max(32);
export const Code=z.enum(['timeout','disconnected','malformed','illegal','refused','provider_error','throttled','version']);
export const RequestKind=z.enum(['bid','wolf_chat','noble_chat','vote','night']);
export const sortedSlots=(rows:number[])=>rows.every((n,i)=>i===0||n>rows[i-1]!);
export const PublicSeat=z.object({slot:Slot,name:GameText(80,1),policyName:GameText(80,1).optional(),alive:z.boolean(),presentation:Presentation}).strict();
export const Roster=z.array(PublicSeat).length(9).refine(rows=>rows.every((r,i)=>r.slot===i));
export const PrivateResult=z.discriminatedUnion('ability',[
 z.object({day:Day,ability:z.literal('inspect'),target:Slot,result:z.enum(['wolf','not_wolf','no_result'])}).strict(),
 z.object({day:Day,ability:z.literal('check'),target:Slot,result:z.union([Role,z.literal('vanilla'),z.literal('no_result')])}).strict(),
 z.object({day:Day,ability:z.literal('inform'),target:Slot,result:z.literal('town')}).strict(),
 z.object({day:Day,ability:z.literal('track'),target:Slot,result:z.union([z.array(Slot).max(9),z.literal('no_result')])}).strict(),
]);
export type PrivateResult=z.infer<typeof PrivateResult>;
export const VoteRow=z.object({slot:Slot,target:Slot.nullable()}).strict();
const ballotRows=z.array(VoteRow).max(9).refine(rows=>sortedSlots(rows.map(r=>r.slot)));
const roleRow=z.object({slot:Slot,role:Role,faction:Faction}).strict();
const roles=z.array(roleRow).length(9).refine(rows=>{
 return rows.every((r,i)=>r.slot===i&&r.faction===factionOf(r.role))&&RoleDeck.safeParse(rows.map(r=>r.role)).success;
});
export const Payload=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('started'),roster:Roster,rulesVersion:z.string().regex(/^[\x21-\x7e]{1,80}$/)}).strict(),
 z.object({kind:z.literal('phase'),phase:Phase,day:Day,durationMs:z.number().int().min(0).max(978000)}).strict(),
 z.object({kind:z.literal('speech'),speech:z.object({slot:Slot,text:GameText(480,1),replyTo:Id.nullable(),accusation:Slot.nullable()}).strict()}).strict(),
 z.object({kind:z.literal('wolf_chat'),slot:Slot,text:GameText(480,1)}).strict(),
 z.object({kind:z.literal('noble_chat'),slot:Slot,text:GameText(480,1)}).strict(),
 z.object({kind:z.literal('confessional'),slot:Slot,requestKind:RequestKind,text:GameText(300)}).strict(),
 z.object({kind:z.literal('bid'),slot:Slot,window:z.number().int().min(0).max(17),bid:Bid,rank:z.number().int().min(0).max(8).nullable(),selected:z.boolean()}).strict(),
 z.object({kind:z.literal('ballots'),ballots:ballotRows,eliminated:Slot.nullable(),resolution:z.enum(['majority','no_majority','tie','all_abstain'])}).strict(),
 z.object({kind:z.literal('night_choices'),slot:Slot,actions:z.array(NightChoice).max(2)}).strict(),
 z.object({kind:z.literal('night_outcome'),ability:Ability,actor:Slot.nullable(),target:Slot.nullable(),outcome:z.enum(['applied','blocked','protected','passed','actor_dead'])}).strict().refine(p=>p.ability==='kill'||p.actor!==null),
 z.object({kind:z.literal('private_result'),slot:Slot,result:PrivateResult}).strict(),
 z.object({kind:z.literal('elimination'),slot:Slot,cause:z.enum(['vote','wolf']),role:Role.optional(),faction:Faction.optional()}).strict().refine(p=>(p.role===undefined&&p.faction===undefined)||(p.role!==undefined&&p.faction===factionOf(p.role)),'Invalid death reveal'),
 z.object({kind:z.literal('suspicion'),slot:Slot,reports:z.array(z.object({slot:Slot,wolf:z.number().min(0).max(1)}).strict()).min(1).max(8)}).strict(),
 z.object({kind:z.literal('suspicion_dropped'),slot:Slot,reason:z.enum(['missing','wrong_count','unknown_player','duplicate_player','out_of_range']),player:Slot.optional()}).strict(),
 z.object({kind:z.literal('kill_resolution'),targetVotes:z.array(z.object({target:Slot,votes:z.number().int().min(1).max(9)}).strict()).max(9),knifeVotes:z.array(z.object({killer:Slot,votes:z.number().int().min(1).max(9)}).strict()).max(9),targetTie:z.boolean(),knifeTie:z.boolean(),target:Slot.nullable(),killer:Slot.nullable()}).strict(),
 z.object({kind:z.literal('night_resolved'),eliminated:z.array(Slot).max(9).refine(sortedSlots)}).strict(),
 z.object({kind:z.literal('failure'),slot:Slot,requestKind:RequestKind,code:Code,source:z.enum(['game','policy_report']),disposition:z.enum(['retry','fallback']),attempt:z.number().int().min(0).max(2)}).strict(),
 z.object({kind:z.literal('finished'),result:Results}).strict(),
 z.object({kind:z.literal('roles'),roles}).strict(),
 z.object({kind:z.literal('seed'),seed:z.string().regex(/^[0-9a-f]{32}$/),randomVersion:z.literal('sha256-counter/1')}).strict(),
]);
export type Payload=z.infer<typeof Payload>;
export const Reveal=z.enum(['public','roles','wolf_chat','noble_chat','confessional','night_choices','discarded_bids','failures','beliefs','never']);
export const Audience=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('public')}).strict(),z.object({kind:z.literal('server')}).strict(),
 z.object({kind:z.literal('seats'),slots:z.array(Slot).min(1).max(9).refine(sortedSlots)}).strict(),
]);
export type Audience=z.infer<typeof Audience>;
export const revealFor=(p:Payload):z.infer<typeof Reveal>=>{
 switch(p.kind){
  case 'roles':case 'seed':return 'roles';
  case 'wolf_chat':return 'wolf_chat';
  case 'noble_chat':return 'noble_chat';
  case 'confessional':return 'confessional';
  case 'bid':return 'discarded_bids';
  case 'night_choices':case 'night_outcome':case 'kill_resolution':case 'private_result':return 'night_choices';
  case 'failure':case 'suspicion_dropped':return 'failures';
  case 'suspicion':return 'beliefs';
  default:return 'public';
 }
};
export const Event=z.object({schema:z.literal('wcw.events/1'),seq:z.number().int().min(1).max(20000),day:Day,phase:Phase,audience:Audience,reveal:Reveal,payload:Payload}).strict().refine(e=>{
 if(e.reveal!==revealFor(e.payload))return false;
 if(e.reveal==='public')return e.audience.kind==='public';
 if(['roles','seed','night_outcome','kill_resolution','suspicion','suspicion_dropped'].includes(e.payload.kind))return e.audience.kind==='server';
 if(e.audience.kind!=='seats'||!('slot' in e.payload))return false;
 return ['wolf_chat','noble_chat'].includes(e.payload.kind)?e.audience.slots.includes(e.payload.slot):e.audience.slots.length===1&&e.audience.slots[0]===e.payload.slot;
});
export type Event=z.infer<typeof Event>;
export const ProjectedEvent=z.object({schema:z.literal('wcw.events/1'),id:Id,cursor:z.number().int().min(1).max(20000),day:Day,phase:Phase,reveal:Reveal.exclude(['never']),payload:Payload}).strict().refine(e=>e.reveal===revealFor(e.payload));
export type ProjectedEvent=z.infer<typeof ProjectedEvent>;
export const ViewerPacket=z.object({protocol:z.literal('wcw.viewer/1'),type:z.enum(['reset','events']),episodeId:Id,throughCursor:z.number().int().min(0).max(20000),events:z.array(ProjectedEvent).max(20000)}).strict();
