import { z } from 'zod';
export const Results=z.object({
 schema:z.literal('wcw.results/1'),rulesVersion:z.string().regex(/^[\x21-\x7e]{1,80}$/),
 outcome:z.enum(['town_win','wolf_win','jester_win','draw']),reason:z.enum(['wolves_eliminated','wolf_parity','jester_voted_out','day_cap']),
 daysCompleted:z.number().int().min(0).max(32),scores:z.array(z.number().int().min(0).max(1)).length(9),
}).strict().refine(r=>({town_win:'wolves_eliminated',wolf_win:'wolf_parity',draw:'day_cap',jester_win:'jester_voted_out'}[r.outcome]===r.reason)&&
 (r.outcome!=='draw'||r.scores.every(n=>n===0)),'Inconsistent result');
export type Results=z.infer<typeof Results>;
