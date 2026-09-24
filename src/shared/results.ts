import { z } from 'zod';
const Outcome=z.enum(['town_win','wolf_win','jester_win','draw']),Reason=z.enum(['wolves_eliminated','wolf_parity','jester_voted_out','day_cap']);
const consistent=(r:{outcome:z.infer<typeof Outcome>;reason:z.infer<typeof Reason>})=>({town_win:'wolves_eliminated',wolf_win:'wolf_parity',draw:'day_cap',jester_win:'jester_voted_out'}[r.outcome]===r.reason);
const Fraction=z.number().min(0).max(1);
/** Per-seat metric columns; a column is omitted where it does not apply to the seat. */
export const SeatMetrics=z.object({win:z.union([z.literal(0),z.literal(1)]),read:Fraction.optional(),hidden:Fraction.optional(),vote_hit:Fraction.optional(),survived:Fraction.optional(),valid_actions:Fraction.optional()}).strict();
/** Historical win-only results (rules/1–2 replays). */
export const ResultsV1=z.object({
 schema:z.literal('wcw.results/1'),rulesVersion:z.string().regex(/^[\x21-\x7e]{1,80}$/),outcome:Outcome,reason:Reason,
 daysCompleted:z.number().int().min(0).max(32),scores:z.array(z.number().int().min(0).max(1)).length(9),
}).strict().refine(r=>consistent(r)&&(r.outcome!=='draw'||r.scores.every(n=>n===0)),'Inconsistent result');
/** Headline score = 0.75 × win + 0.25 × bonus; draws have win 0 for everyone but keep bonuses. */
export const ResultsV2=z.object({
 schema:z.literal('wcw.results/2'),rulesVersion:z.string().regex(/^[\x21-\x7e]{1,80}$/),outcome:Outcome,reason:Reason,
 daysCompleted:z.number().int().min(0).max(32),scores:z.array(Fraction).length(9),metrics:z.array(SeatMetrics).length(9),
}).strict().refine(r=>consistent(r)&&(r.outcome!=='draw'||r.metrics.every(m=>m.win===0)),'Inconsistent result');
export const Results=z.union([ResultsV2,ResultsV1]);
export type Results=z.infer<typeof Results>;
export type ResultsV2=z.infer<typeof ResultsV2>;
