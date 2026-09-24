import { z } from 'zod';
import { readFile,writeFile } from 'node:fs/promises';
import { GameConfig } from '../src/shared/config.js';
import { ResultsV2 } from '../src/shared/results.js';
import {Registration} from '../src/shared/player-names.js';
import {Action,Observation,Control} from '../src/shared/player.js';
const players=Array.from({length:9},(_,i)=>({name:`Player ${i+1}`}));
const config={mode:'fast',setup:'A1',players,seed:'000102030405060708090a0b0c0d0e0f',maxDays:8,windowMs:1000,player_connect_timeout_seconds:30};
const text=(value:string)=>({type:'text',value});
const configSchema=z.toJSONSchema(GameConfig,{io:'input'});
// Coworld inspects these common fields at the root when injecting seat tokens/names.
const common=(configSchema.anyOf![0] as {properties:Record<string,unknown>}).properties;
Object.assign(configSchema,{type:'object',required:['tokens','players'],properties:{tokens:common.tokens,players:common.players}});
const settingLabels:Record<string,{title:string;description:string}>={
 mode:{title:'Game mode (set by variant)',description:'Selected by the variant. Human play requires human mode; bots and fast are for AI-only games.'},
 setup:{title:'Role setup',description:'Random secretly selects a NewD3 setup. Fixed setup codes are intended for testing and reveal the role composition to anyone who can see this setting.'},
 maxDays:{title:'Maximum game days',description:'The game ends in a draw after this many completed nights if neither side has won. Longer games must fit the episode time limit.'},
 player_connect_timeout_seconds:{title:'Connection wait (seconds)',description:'Connection grace period. Human play waits for the first human to join, then begins when all nine seats connect or this many seconds pass. Late humans can join or reconnect to their own seats.'},
};
for(const branch of configSchema.anyOf??[]){
 const properties=(branch as {properties:Record<string,object>}).properties;
 for(const [key,label] of Object.entries(settingLabels))Object.assign(properties[key]!,label);
 // Variant-owned runtime discriminator, not a player-adjustable setting.
 Object.assign(properties.mode!,{readOnly:true});
}
const readme=await readFile('docs/package/readme.md','utf8');
const manifest={
 episode_timeout_minutes:60,
 tags:['mafia','social-deduction','multiplayer','turn-based'],
 game:{name:'Mafia: Who Cried Wolf?',description:'Nine-seat Mafia with wolves in sheep’s clothing, private team chats, secret roles, and a replay that reveals the whole story. Also play with friends on Discord at https://whocriedwolf.gg/.',owner:'jt',runnable:{type:'game',image:'{{GAME_IMAGE}}',run:['node','build/game.mjs'],env:{WCW_MODERATOR_BEDROCK_MODEL:'anthropic/claude-haiku-4.5'}},
 config_schema:configSchema,results_schema:z.toJSONSchema(ResultsV2),
 protocols:{player:text('Connect to COWORLD_PLAYER_WS_URL. wcw.player/1: receive ready then observation. Optional display-name registration: append registerName=1 to the supplied WebSocket URL; when ready.canRegisterName is true, send {protocol: wcw.player/1, type: register, displayName: your base name} within two seconds. Names lock at game start; duplicates use -2, -3 in seat order. Preserve slot/token query parameters. Reply with action copying episodeId, requestId and observationId, a legal body matching request.kind, and report:null. bid: wantsToSpeak, urgency 0..3, text <=480, replyTo/accusation nullable, reason <=240. vote: target or null, summary <=240; when request.suspicion is true (Town), add suspicion: [{slot, wolf}] giving each other living player a wolf probability from 0 to 1. It is private, never affects the vote, and is scored for calibration (read bonus); invalid or missing reports score as a know-nothing guess. wolf_chat/noble_chat: text <=480, summary <=240. night: ordered actions [{ability,target|null,killer?}] matching offered choices, summary <=240. First valid reply locks; one correction retry. end contains results; exit cleanly. Complete observation, action, and control schemas are included in the player-schemas documentation page.'),global:text('GET /client/global with read-only /global WebSocket. Browser clients honor the platform-supplied address query parameter and preserve proxy paths. wcw.viewer/1 reset/events packets contain recipient-local cursors and public events. Static replay bundle accepts #replay=URL or ?replay=URL. In mode human, /client/player controls any authenticated human seat through the /player WebSocket. After ready, browsers send {protocol: wcw.human/1, type: join} to identify their seat as human; this preserves platform proxy paths; /human remains a local alias. Local links carry slot=N&token=T; hosted proxies must supply upstream seat authorization. Human and spectator proxy paths are locally tested; actual hosted human seating requires a separate integration test.')},
 docs:{readme:text(readme),pages:[{id:'player-schemas',title:'Player protocol JSON schemas',content:text('The authenticated WebSocket exchanges ready, observation, action, receipt, and end messages. Copy request identifiers exactly. All messages are JSON text. Observation and control messages come from the game; actions come from the policy.\n\n'+Object.entries({Observation,Action,Control,Registration}).map(([name,schema])=>'## '+name+'\n\n```json\n'+JSON.stringify(z.toJSONSchema(schema,{io:'input'}),null,2)+'\n```').join('\n\n'))},{id:'discord',title:'Play Who Cried Wolf? on Discord',content:text('Play the original social-deduction party game with friends inside a Discord voice channel. Visit [Who Cried Wolf?](https://whocriedwolf.gg/) to launch the activity, browse roles, and find the support community. The Coworld adaptation uses the rules in this package’s README.')} ]},
 replay_viewer:{bundle:'viewer'}},
 player:[{id:'scripted',name:'Scripted baseline',type:'player',image:'{{PLAYER_IMAGE}}',run:['node','build/player.mjs'],description:'Deterministic no-model policy using only offered observations.'},{id:'llm',name:'Configurable LLM baseline',type:'player',image:'{{PLAYER_IMAGE}}',run:['node','build/llm-player.mjs','--allow-scripted'],description:'One-seat OpenRouter or Bedrock client. Detects the hosted Bedrock endpoint and reads BEDROCK_MODEL; WCW_LLM_PROVIDER can select a backend explicitly. OpenRouter uses WCW_MODEL and a runtime OPENROUTER_API_KEY. WCW_PLAYER_PROMPT sets personality. This bundled certification baseline explicitly permits scripted operation without credentials via --allow-scripted; omit that flag when uploading real LLM policies; bounded legal fallbacks on provider failure.'}],
 variants:[
  {id:'human-llm',name:'Play · LLM host',description:'For one to nine humans, with AI filling the other seats. Play starts when every seat is filled, or five minutes after the first human joins. An LLM host selects speakers; failed or late calls use deterministic fallback. Random NewD3 setup and human-paced turns. Choose opponent policies separately. Requires hosted inference or runtime credentials.',game_config:{mode:'human',moderator:'llm',players,setup:'random',maxDays:8,player_connect_timeout_seconds:300}},
  {id:'human',name:'Play · Classic host',description:'For one to nine humans, with AI filling the other seats. Play starts when every seat is filled, or five minutes after the first human joins. The classic host selects speakers deterministically without model calls. Random NewD3 setup and human-paced turns. Choose opponent policies separately.',game_config:{mode:'human',moderator:'default',players,setup:'random',maxDays:8,player_connect_timeout_seconds:300}},
  {id:'standard',name:'Watch · 9 AI · Human-paced',description:'For spectators: nine AI players, with no human seat. Random NewD3 setup and the same discussion and night timing as human play. Host selection follows runtime configuration unless overridden. Choose opponent policies separately.',game_config:{mode:'bots',players,setup:'random',maxDays:8,player_connect_timeout_seconds:30}},
  {id:'fast-llm',name:'Watch · 9 AI · Fast-paced',description:'For spectators: nine AI players, with no human seat. Fixed ten-second action windows and bid-ranked speakers. Up to about 35 minutes across eight days; windows do not close early. Choose opponent policies separately.',game_config:{mode:'fast',players,setup:'random',maxDays:8,windowMs:10000,player_connect_timeout_seconds:30}},
  {id:'reproducible',name:'Test · 9 AI · Fixed setup A2',description:'For developers: nine AI players, fixed NewD3 A2 setup and seed, and human-paced turns. Model responses remain nondeterministic. Choose opponent policies separately.',game_config:{mode:'bots',players,setup:'A2',seed:config.seed,maxDays:8,player_connect_timeout_seconds:30}},
  {id:'smoke',name:'Test · Scripted verification',description:'For developers: fast, seeded protocol and completion checks with scripted policies. No human seat; not an LLM timing benchmark.',game_config:config},
 ],
 certification:{game_config:config,players:Array.from({length:9},(_,i)=>({player_id:i===0?'llm':'scripted'}))},
};
await writeFile('coworld_manifest_template.json',JSON.stringify(manifest,null,2)+'\n');
