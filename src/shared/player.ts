import { z } from 'zod';
import { factionOf } from './roles.js';
import { ActionBody } from './actions.js';
import { Id } from './primitives.js';
export { ActionBody, Bid, Ability } from './actions.js';
export const Action=z.object({
 protocol:z.literal('wcw.player/1'),type:z.literal('action'),episodeId:Id,requestId:Id,observationId:Id,
 body:ActionBody,
 report:z.object({code:z.enum(['refused','provider_error','throttled']),attempts:z.union([z.literal(0),z.literal(1),z.literal(2)])}).strict().nullable(),
}).strict();
export type Action=z.infer<typeof Action>;

import { Slot,Role,Faction } from './primitives.js';
import { Ability } from './actions.js';
import { Phase,Day,Roster,PrivateResult,VoteRow,ProjectedEvent,Code } from './events.js';
import { Results } from './results.js';
export const Choice=z.object({ability:Ability,targets:z.array(Slot).max(9),allowPass:z.literal(true),actors:z.array(Slot).max(3).optional()}).strict();
export const Request=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('bid'),window:z.number().int().min(0).max(17),maxCharacters:z.literal(480),host:z.object({reason:z.enum(['human_reply','open_discussion']),replyTo:Id.nullable(),prompt:z.string().max(240).optional()}).strict().optional()}).strict(),
 z.object({kind:z.literal('wolf_chat'),turn:z.number().int().min(0).max(17),maxCharacters:z.literal(480)}).strict(),
 z.object({kind:z.literal('noble_chat'),turn:z.number().int().min(0).max(17),maxCharacters:z.literal(480)}).strict(),
 z.object({kind:z.literal('vote'),targets:z.array(Slot).max(9),allowPass:z.literal(true)}).strict(),
 z.object({kind:z.literal('night'),choices:z.array(Choice).max(2)}).strict(),
]);
export type Request=z.infer<typeof Request>;
export const Observation=z.object({
 protocol:z.literal('wcw.player/1'),type:z.literal('observation'),episodeId:Id,observationId:Id,requestId:Id,
 attempt:z.union([z.literal(0),z.literal(1)]),remainingMs:z.number().int().min(0).max(45000),phase:Phase,day:Day,
 self:z.object({slot:Slot,role:Role,faction:Faction,alive:z.literal(true)}).strict(),
 roster:Roster,
 teammates:z.array(z.object({slot:Slot,role:z.enum(['wolf','alchemist','track_reader','noble'])}).strict()).max(3),
 privateResults:z.array(PrivateResult).max(288),
 votes:z.array(z.object({day:Day,ballots:z.array(VoteRow).max(9),eliminated:Slot.nullable()}).strict()).max(32),
 transcript:z.array(ProjectedEvent).max(128),transcriptTruncated:z.boolean(),request:Request,
}).strict().refine(o=>o.self.faction===factionOf(o.self.role)&&
 (o.self.faction==='wolf'?o.teammates.every(t=>factionOf(t.role)==='wolf'):o.self.role==='noble'?o.teammates.every(t=>t.role==='noble'):o.teammates.length===0)&&o.roster[o.self.slot]!.alive);
export type Observation=z.infer<typeof Observation>;
export const Control=z.discriminatedUnion('type',[
 z.object({protocol:z.literal('wcw.player/1'),type:z.literal('ready'),episodeId:Id,slot:Slot}).strict(),
 z.object({protocol:z.literal('wcw.player/1'),type:z.literal('receipt'),requestId:Id,status:z.enum(['accepted','duplicate','rejected','expired']),code:Code.nullable(),retry:z.boolean()}).strict(),
 z.object({protocol:z.literal('wcw.player/1'),type:z.literal('end'),episodeId:Id,result:Results}).strict(),
]);
