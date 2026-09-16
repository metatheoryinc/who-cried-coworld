import { z } from 'zod';
import { RoleDeck,defaultRoles,NewD3Setup } from './roles.js';
import { GameText } from './primitives.js';
export const Presentation = z.discriminatedUnion('kind', [
 z.object({kind:z.literal('neutral')}).strict(),
 z.object({kind:z.literal('character'),characterId:z.string().regex(/^[a-z0-9][a-z0-9_-]{0,47}$/),persona:GameText(240,1)}).strict(),
]);
export type Presentation = z.infer<typeof Presentation>;
export const HumanTimers=z.object({transitionMs:z.number().int().min(100).max(10000).default(5000),dayMs:z.number().int().min(600).max(180000).default(150000),voteMs:z.number().int().min(100).max(45000).default(45000),coordinationMs:z.number().int().min(200).max(30000).default(30000),nightMs:z.number().int().min(100).max(45000).default(45000)}).strict();
export function episodeBudgetSeconds(c: {maxDays:number;windowMs:number;player_connect_timeout_seconds:number;mode?:string;humanTimers?:z.infer<typeof HumanTimers>}) {
 if(c.mode==='human'||c.mode==='bots'){const t=c.humanTimers??HumanTimers.parse({});return c.player_connect_timeout_seconds+c.maxDays*(t.dayMs+t.voteMs+t.coordinationMs+t.nightMs+2*t.transitionMs)/1000+30;}
 return c.player_connect_timeout_seconds + c.maxDays * 26 * c.windowMs / 1000 + 30;
}
const ConfigFields = z.object({
 mode:z.enum(['fast','human']).default('fast'),
 humanSlot:z.number().int().min(0).max(8).default(0),
 humanTimers:HumanTimers.default(()=>HumanTimers.parse({})),
 tokens:z.array(z.string().min(1)).length(9).refine(t=>new Set(t).size===9,'Tokens must be distinct'),
 players:z.array(z.object({name:GameText(80,1)}).strict()).length(9),
 presentation:z.array(Presentation).length(9).default(()=>Array.from({length:9},()=>({kind:'neutral' as const}))),
 setup:NewD3Setup.or(z.literal('random')).optional(),
 roles:RoleDeck.default(()=>[...defaultRoles]),
 seed:z.string().regex(/^[0-9a-f]{32}$/).optional(),
 maxDays:z.number().int().min(1).max(32).default(8),
 player_connect_timeout_seconds:z.number().int().min(1).max(180).default(180),
 windowMs:z.number().int().min(100).max(8000).default(3500),
}).strict();
export const GameConfig=z.union([
 ConfigFields.extend({mode:z.literal('fast').default('fast')}),
 ConfigFields.extend({mode:z.literal('bots'),humanSlot:z.literal(-1).default(-1),player_connect_timeout_seconds:z.number().int().min(1).max(180).default(30)}),
 ConfigFields.extend({mode:z.literal('human'),player_connect_timeout_seconds:z.number().int().min(1).max(180).default(30)}),
]).refine(c=>!c.setup||JSON.stringify(c.roles)===JSON.stringify(defaultRoles),'Choose a setup or a custom role deck, not both').refine(c=>episodeBudgetSeconds(c)<=(c.mode!=='fast'?2400:978),'Episode exceeds time budget');
export type GameConfig = z.infer<typeof GameConfig>;
