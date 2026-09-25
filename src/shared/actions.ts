import { z } from 'zod';
import { GameText, Id, Slot } from './primitives.js';
/** Authored notes (summary, reason): accepted up to 512 characters; policies should aim for about 240. */
export const NOTE_MAX=512,NOTE_TARGET=240;
export const NoteText=GameText(NOTE_MAX);
export const Ability=z.enum(['kill','block','inspect','protect','jail','check','inform','track']);
export type Ability=z.infer<typeof Ability>;
export const Bid=z.object({
 kind:z.literal('bid'),wantsToSpeak:z.boolean(),urgency:z.number().int().min(0).max(3),
 text:GameText(480),replyTo:Id.nullable(),accusation:Slot.nullable(),reason:NoteText,
}).strict().refine(b=>b.wantsToSpeak?b.text.trim().length>0:b.text===''&&b.urgency===0&&b.replyTo===null&&b.accusation===null,'Invalid speaking bid');
export type Bid=z.infer<typeof Bid>;
export const NightChoice=z.object({ability:Ability,target:Slot.nullable(),killer:Slot.optional()}).strict();
export const ActionBody=z.discriminatedUnion('kind',[
 Bid,
 z.object({kind:z.literal('wolf_chat'),text:GameText(480),summary:NoteText}).strict(),
 z.object({kind:z.literal('noble_chat'),text:GameText(480),summary:NoteText}).strict(),
 // Optional private wolf probabilities (Town votes). Loosely typed so a bad report can never make the vote malformed;
 // the game validates and drops invalid reports at vote close.
 z.object({kind:z.literal('vote'),target:Slot.nullable(),summary:NoteText,suspicion:z.array(z.object({slot:z.number().int(),wolf:z.number()}).strict()).max(9).optional()}).strict(),
 z.object({kind:z.literal('night'),actions:z.array(NightChoice).max(2).refine(rows=>new Set(rows.map(r=>r.ability)).size===rows.length),summary:NoteText}).strict(),
]);
export type ActionBody=z.infer<typeof ActionBody>;
