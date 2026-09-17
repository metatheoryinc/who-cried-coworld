import { z } from 'zod';
import { readFile,writeFile } from 'node:fs/promises';
import { GameConfig } from '../src/shared/config.js';
import { Results } from '../src/shared/results.js';
import {Action,Observation,Control} from '../src/shared/player.js';
const players=Array.from({length:9},(_,i)=>({name:`Player ${i+1}`}));
const config={mode:'fast',setup:'A1',players,seed:'000102030405060708090a0b0c0d0e0f',maxDays:8,windowMs:1000,player_connect_timeout_seconds:30};
const text=(value:string)=>({type:'text',value});
const configSchema=z.toJSONSchema(GameConfig,{io:'input'});
// Coworld inspects these common fields at the root when injecting seat tokens/names.
const common=(configSchema.anyOf![0] as {properties:Record<string,unknown>}).properties;
Object.assign(configSchema,{type:'object',required:['tokens','players'],properties:{tokens:common.tokens,players:common.players}});
const readme=await readFile('docs/package/readme.md','utf8');
const manifest={
 episode_timeout_minutes:40,
 tags:['mafia','social-deduction','multiplayer','turn-based'],
 game:{name:'Mafia: Who Cried Wolf?',description:'Nine-seat Mafia with wolves in sheep’s clothing, private team chats, secret roles, and a replay that reveals the whole story. Also play with friends on Discord at https://whocriedwolf.gg/.',owner:'jt',runnable:{type:'game',image:'{{GAME_IMAGE}}',run:['node','build/game.mjs']},
 config_schema:configSchema,results_schema:z.toJSONSchema(Results),
 protocols:{player:text('Connect to COWORLD_PLAYER_WS_URL. wcw.player/1: receive ready then observation. Reply with action copying episodeId, requestId and observationId, a legal body matching request.kind, and report:null. bid: wantsToSpeak, urgency 0..3, text <=480, replyTo/accusation nullable, reason <=240. vote: target or null, summary <=240. wolf_chat/noble_chat: text <=480, summary <=240. night: ordered actions [{ability,target|null,killer?}] matching offered choices, summary <=240. First valid reply locks; one correction retry. end contains results; exit cleanly. Complete observation, action, and control schemas are included in the player-schemas documentation page.'),global:text('GET /client/global with read-only /global WebSocket. Browser clients honor the platform-supplied address query parameter and preserve proxy paths. wcw.viewer/1 reset/events packets contain recipient-local cursors and public events. Static replay bundle accepts #replay=URL or ?replay=URL. In mode human, /client/player controls the reserved humanSlot through the authenticated /player WebSocket; /human remains a local alias. Local links carry slot=N&token=T; hosted proxies must supply upstream seat authorization. Human and spectator proxy paths are locally tested; actual hosted human seating requires a separate integration test.')},
 docs:{readme:text(readme),pages:[{id:'player-schemas',title:'Player protocol JSON schemas',content:text('The authenticated WebSocket exchanges ready, observation, action, receipt, and end messages. Copy request identifiers exactly. All messages are JSON text. Observation and control messages come from the game; actions come from the policy.\n\n'+Object.entries({Observation,Action,Control}).map(([name,schema])=>'## '+name+'\n\n```json\n'+JSON.stringify(z.toJSONSchema(schema,{io:'input'}),null,2)+'\n```').join('\n\n'))},{id:'discord',title:'Play Who Cried Wolf? on Discord',content:text('Play the original social-deduction party game with friends inside a Discord voice channel. Visit [Who Cried Wolf?](https://whocriedwolf.gg/) to launch the activity, browse roles, and find the support community. The Coworld adaptation uses the rules in this package’s README.')} ]},
 replay_viewer:{bundle:'viewer'}},
 player:[{id:'scripted',name:'Scripted baseline',type:'player',image:'{{PLAYER_IMAGE}}',run:['node','build/player.mjs'],description:'Deterministic no-model policy using only offered observations.'},{id:'llm',name:'Configurable LLM baseline',type:'player',image:'{{PLAYER_IMAGE}}',run:['node','build/llm-player.mjs','--allow-scripted'],description:'One-seat OpenRouter or Bedrock client. Detects the hosted Bedrock endpoint and reads BEDROCK_MODEL; WCW_LLM_PROVIDER can select a backend explicitly. OpenRouter uses WCW_MODEL and a runtime OPENROUTER_API_KEY. WCW_PLAYER_PROMPT sets personality. This bundled certification baseline explicitly permits scripted operation without credentials via --allow-scripted; omit that flag when uploading real LLM policies; bounded legal fallbacks on provider failure.'}],
 variants:[
  {id:'standard',name:'NewD3 · Nine policy players',description:'Random NewD3 setup, fresh seed, and the same paced discussion and night coordination as human play.',game_config:{mode:'bots',players,setup:'random',maxDays:8,player_connect_timeout_seconds:30}},
  {id:'fast-llm',name:'NewD3 · Fast LLM play',description:'Random NewD3 setup with fixed ten-second action windows and bid-ranked speakers. Up to about 35 minutes across eight days; windows do not close early. Choose LLM policies separately.',game_config:{mode:'fast',players,setup:'random',maxDays:8,windowMs:10000,player_connect_timeout_seconds:30}},
  {id:'human',name:'NewD3 · One human + eight policies',description:'Seat 0 is the browser player; eight seats are policies. Locally verified; hosted human seating remains to be verified.',game_config:{mode:'human',humanSlot:0,players,setup:'random',maxDays:8,player_connect_timeout_seconds:30}},
  {id:'reproducible',name:'NewD3 A2 · Reproducible fixture',description:'Fixed A2 setup and seed for comparisons; model output remains nondeterministic.',game_config:{mode:'bots',players,setup:'A2',seed:config.seed,maxDays:8,player_connect_timeout_seconds:30}},
  {id:'smoke',name:'Scripted protocol check',description:'Fast seeded protocol and completion check. Use scripted policies; not an LLM timing benchmark.',game_config:config},
 ],
 certification:{game_config:config,players:Array.from({length:9},(_,i)=>({player_id:i===0?'llm':'scripted'}))},
};
await writeFile('coworld_manifest_template.json',JSON.stringify(manifest,null,2)+'\n');
