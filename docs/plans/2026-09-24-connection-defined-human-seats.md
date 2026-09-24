# Connection-defined Human Seats Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make a browser join the only thing that makes a seat human, remove `humanSlot`/`humanSlots` config, and give human lobbies a five-minute start wait inside a 60-minute episode limit.

**Architecture:** `Session.isHuman` (false by default) is overridden by `HumanSession`, whose `humanSlots` set starts empty and grows only via `registerHuman`. The floor host and LLM moderator receive only `eligibleSlots`, which already exclude humans. The server starts human games after the first join, when nine seats connect or the wait expires.

**Tech Stack:** TypeScript, Zod 4, Vitest 5, `ws`. Design: `docs/plans/2026-09-24-connection-defined-human-seats-design.md`.

Run single test files with `npx vitest run <path>`. Commit after each task.

---

### Task 1: Host and moderator take only eligible seats

**Files:**
- Modify: `src/game/domain/human-host.ts`, `src/game/domain/moderator.ts:2-14`
- Test: `tests/domain/human-host.test.ts`, create `tests/domain/moderator.test.ts`, `tests/runtime/moderator-runtime.test.ts:5`

**Step 1: Failing tests.** In `tests/domain/human-host.test.ts`, change `base` to omit the human (callers pass only eligible seats):

```ts
const base={roster:[{slot:1,name:'Claude',alive:true},{slot:2,name:'Gemini',alive:true}],counts:{},recent:[]};
```

Create `tests/domain/moderator.test.ts`:

```ts
import {expect,it} from 'vitest';
import {validateModeratorChoice,type ModeratorInput} from '../../src/game/domain/moderator.js';
const input:ModeratorInput={day:1,roster:[{slot:0,name:'Ann',alive:true},{slot:1,name:'Bo',alive:true},{slot:2,name:'Cy',alive:true}],counts:{},eligibleSlots:[1,2],recent:[],humanMessage:null,transcript:[]};
it('accepts only eligible living speakers',()=>{
 expect(validateModeratorChoice({slot:1,prompt:'Bo, anything to add?'},input).slot).toBe(1);
 expect(()=>validateModeratorChoice({slot:0,prompt:'Ann, anything to add?'},input)).toThrow();
});
it('rejects a third consecutive turn only when another speaker is eligible',()=>{
 expect(()=>validateModeratorChoice({slot:1,prompt:'Bo, go on.'},{...input,recent:[1,1]})).toThrow('three times');
 expect(validateModeratorChoice({slot:1,prompt:'Bo, go on.'},{...input,eligibleSlots:[1],recent:[1,1]}).slot).toBe(1);
});
```

In `tests/runtime/moderator-runtime.test.ts:5` delete `humanSlot:-1,`.

**Step 2:** `npx vitest run tests/domain` — type-level only; the new file passes at runtime already. Proceed.

**Step 3: Implement.** `human-host.ts`: remove `humanSlot`/`humanSlots` from the input type; `const candidates=input.roster.filter(p=>p.alive);`. Update the doc comment: roster holds only seats eligible to speak.

`moderator.ts`:

```ts
export type ModeratorInput={day:number;roster:{slot:number;name:string;alive:boolean}[];counts:Record<number,number>;eligibleSlots:number[];recent:number[];humanMessage:{id:string;text:string}|null;transcript:{id:string;slot:number;text:string}[]};
export function validateModeratorChoice(raw:unknown,input:ModeratorInput){
 const choice=ModeratorChoice.parse(raw);
 if(!input.eligibleSlots.includes(choice.slot))throw Error('Host chose a speaker on cooldown');
 const name=input.roster.find(p=>p.slot===choice.slot)?.name;
 if(!name||!choice.prompt.startsWith(name+', '))throw Error('Host prompt must begin with the selected player name followed by a comma');
 if(!input.roster.some(p=>p.slot===choice.slot&&p.alive))throw Error('Host chose an ineligible speaker');
 if(input.recent.length>=2&&input.recent.slice(-2).every(s=>s===choice.slot)&&input.eligibleSlots.length>1)throw Error('Host repeated the same speaker three times');
 return choice;
}
```

**Step 4:** `npx vitest run tests/domain tests/runtime/moderator-runtime.test.ts` → PASS. (`human-session.ts` still passes the removed fields; fixed in Task 2.)

**Step 5:** Commit `Restrict floor host and moderator to eligible seats`.

### Task 2: Seats become human only by joining

**Files:**
- Modify: `src/game/runtime/session.ts:21-23`, `src/game/runtime/human-session.ts:20-21,62,71`
- Test: `tests/runtime/human-session.test.ts`, `tests/runtime/multiple-humans.test.ts`, `tests/runtime/moderator.test.ts`, `tests/player/names.test.ts`

**Step 1: Tests.**
- `multiple-humans.test.ts`: drop `humanSlots` from `config`; add
  `const game=(slots:number[])=>{const s=new HumanSession(config(),'episode');for(const slot of slots)s.registerHuman(slot);return s;};`
  and replace each `new HumanSession(config([...]),'episode')` with `game([...])`.
- `human-session.test.ts`: remove `humanSlot:1` from `config`; after every `new HumanSession(...)` that treats seat 1 as human, call `.registerHuman(1)` before `start`.
- `moderator.test.ts`: remove `humanSlot:0` (line 4) and `humanSlot:-1` (line 40); `make` registers seat 0; expected keys become `['eligibleSlots','counts','day','humanMessage','recent','roster','transcript']`.
- `names.test.ts`: use `HumanSession`, call `s.registerHuman(0)` before registrations, drop `humanSlot:0`.
- Add to `multiple-humans.test.ts`:

```ts
it('treats no seat as human until a browser joins',()=>{
 const s=new HumanSession(config(),'episode');
 expect([...s.humanSlots]).toEqual([]);
 s.registerName(0,'Policy');s.registerHuman(3);s.registerName(3,'Impostor');s.start(0);
 expect(s.config.players[0]!.name).toBe('Policy');expect(s.config.players[3]!.name).toBe('Seat 3');
});
```

**Step 2:** `npx vitest run tests/runtime tests/player/names.test.ts` → new test FAILS (seat 0 starts human).

**Step 3: Implement.**
- `session.ts`: add `isHuman(_slot:number){return false;}` and change the `registerName` guard to `...slot>8||this.isHuman(slot))return;`.
- `human-session.ts`: `readonly humanSlots=new Set<number>();` and `override isHuman(slot:number){return this.humanSlots.has(slot);}`. Remove `humanSlot:this.config.humanSlot,humanSlots:[...this.humanSlots],` from the moderator `input` and from the `chooseSpeaker` call.

**Step 4:** `npx vitest run` → PASS (budget assertion in `human-session.test.ts` is still 2300).

**Step 5:** Commit `Make seats human only when a browser joins`.

### Task 3: Start human lobbies after the first join

**Files:**
- Modify: `src/game/runtime/server.ts:66-68`
- Test: `tests/runtime/server.test.ts:49-71,87-88`

**Step 1: Tests.** Rename the reserved-seat test to `waits for a human, then reconnects with private state`; remove `humanSlot:1`; the slot-1 browser sends `{protocol:'wcw.human/1',type:'join'}` on `ready`, as `connectHuman` does in the hosted test. In the hosted test remove `humanSlots:[],`. Add:

```ts
it('starts a partly filled human lobby only after the first join and wait',async()=>{
 const config=GameConfig.parse({...c(),mode:'human',setup:'A2',player_connect_timeout_seconds:1});
 const server=await startServer(config,{port:0,host:'127.0.0.1'}),clients:WebSocket[]=[];
 try{
  for(const slot of [2,3])clients.push(await new Promise<WebSocket>((yes,no)=>{const ws=new WebSocket(`ws://127.0.0.1:${server.port}/player?slot=${slot}&token=t${slot}`);ws.once('open',()=>yes(ws));ws.once('error',no);}));
  await new Promise(r=>setTimeout(r,1300));expect(server.session.phase).toBe('waiting');
  const ws=new WebSocket(`ws://127.0.0.1:${server.port}/player?slot=0&token=t0`);clients.push(ws);
  ws.on('message',b=>{if(JSON.parse(b.toString()).type==='ready')ws.send(JSON.stringify({protocol:'wcw.human/1',type:'join'}));});
  await new Promise(r=>setTimeout(r,500));expect(server.session.phase).toBe('waiting');
  await new Promise(r=>setTimeout(r,900));expect(server.session.phase).not.toBe('waiting');
 }finally{for(const ws of clients)ws.terminate();await server.close();}
},5000);
```

**Step 2:** `npx vitest run tests/runtime/server.test.ts` → reserved-seat test FAILS or passes depending on join; new test verifies timing.

**Step 3: Implement.**

```ts
   const humanReady=config.mode!=='human'||firstHumanAt!==undefined;
   if(session.phase==='waiting'&&humanReady&&namesReady&&(policies.size===9||now-(firstHumanAt??readyAt)>=config.player_connect_timeout_seconds*1000))session.start(now);
```

**Step 4:** `npx vitest run` → PASS.

**Step 5:** Commit `Start human lobbies from the first join`.

### Task 4: Remove config fields; five-minute wait; 60-minute budget

**Files:**
- Modify: `src/shared/config.ts:17-18,32-34`
- Test: `tests/protocol/config.test.ts`, `tests/runtime/human-session.test.ts` (budget assertion)

**Step 1: Tests** in `config.test.ts`:
- Replace rejected patch `{maxDays:9,windowMs:10000}` with `{maxDays:14,windowMs:10000}`; add `{humanSlot:0}`, `{humanSlots:[]}`, `{mode:'human',player_connect_timeout_seconds:301}`.
- Rename the forty-minute test to sixty-minute and add:

```ts
it('gives human lobbies a five-minute wait within the sixty-minute budget',()=>{
 const c=GameConfig.parse({...input(),mode:'human'});
 expect([c.player_connect_timeout_seconds,episodeBudgetSeconds(c)]).toEqual([300,2570]);
 expect(GameConfig.safeParse({...input(),maxDays:13,windowMs:10000}).success).toBe(true);
});
```

- `human-session.test.ts`: budget `2300` → `2570`.

**Step 2:** `npx vitest run tests/protocol/config.test.ts` → FAIL.

**Step 3: Implement** in `config.ts`: delete the `humanSlot` and `humanSlots` fields, the bots-mode `humanSlot:z.literal(-1).default(-1),`, and the `'Human seats require human mode'` refinement. Human branch: `player_connect_timeout_seconds:z.number().int().min(1).max(300).default(300)`. Budget refine: `<=3600`.

**Step 4:** `npx vitest run` then `npx tsc --noEmit` → PASS / no output.

**Step 5:** Commit `Remove human seat config and allow a five-minute lobby wait`.

### Task 5: Launcher and manifest

**Files:**
- Modify: `tools/human-play.mjs:23,29`, `tools/manifest.ts:18,28,37-38`
- Test: `tests/manifest.test.ts`

**Step 1: Test** in `manifest.test.ts`:

```ts
it('gives human lobbies a five-minute wait inside a sixty-minute episode',()=>{
 expect(manifest.episode_timeout_minutes).toBe(60);
 for(const id of ['human','human-llm']){const config=manifest.variants.find(v=>v.id===id)!.game_config;
  expect(config).toMatchObject({mode:'human',player_connect_timeout_seconds:300});expect(config).not.toHaveProperty('humanSlots');}
});
```

**Step 2:** `npx vitest run tests/manifest.test.ts` → FAIL.

**Step 3: Implement.**
- `human-play.mjs`: remove `humanSlot,humanSlots,` from `GameConfig.parse`; keep local `humanSlots` for bot skipping and links.
- `manifest.ts`: `episode_timeout_minutes:60`; human variants drop `humanSlots:[]` and use `player_connect_timeout_seconds:300`; their descriptions replace "Claim human seats in the lobby before starting." with "Play starts when every seat is filled, or five minutes after the first human joins."; connection-wait label: "Play waits for the first human to join, then begins when all nine seats connect or this many seconds pass. Late humans can join or reconnect to their own seats."
- Regenerate: `node tools/manifest.ts`.

**Step 4:** `npx vitest run` → PASS.

**Step 5:** Commit `Publish five-minute human lobby wait and sixty-minute episodes`.

### Task 6: Docs and final verification

**Files:** `docs/testing/human-play.md` (budget paragraph ~29, protocol paragraph ~47), `docs/package/readme.md` (~88), `docs/architecture/architecture-record.md` (Human seats section), `coworld_manifest_template.json` (regenerated).

1. Budget: default human worst case 42 m 50 s (300 s wait + 37 m 20 s play + 30 s), limit 60 minutes.
2. Protocol paragraph: delete the `humanSlots`/`humanSlot` sentences; say seats become human only by joining and local launchers simply leave those seats without bots.
3. Architecture record: replace the config-reservation and compatibility text with the removal decision.
4. `node tools/manifest.ts` (README is embedded), then `npm test`, `npx tsc --noEmit`, `npm run build`.
5. Commit `Document connection-defined human seats`.
