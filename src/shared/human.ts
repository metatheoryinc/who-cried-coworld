import { z } from 'zod';
import { Id,GameText } from './primitives.js';
export const HumanChat=z.object({protocol:z.literal('wcw.human/1'),type:z.literal('chat'),episodeId:Id,id:Id,phaseKey:z.string().regex(/^\d+:(discussion|vote|coordination|actions|dusk|dawn)$/),channel:z.enum(['town','wolves','nobles','graveyard']),text:GameText(480,1).refine(t=>t.trim().length>0)}).strict();
