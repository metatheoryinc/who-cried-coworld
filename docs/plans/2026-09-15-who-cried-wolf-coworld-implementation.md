# Who Cried Wolf Coworld Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a bounded nine-seat Who Cried Wolf Coworld with independently replaceable scripted and personality-rich policies, private live observations, an allowlisted completed replay, and verified local and authorized hosted execution.

**Architecture:** One game transition owns state and produces derived evidence; the journal never becomes a second judge. Server-side audience projection precedes serialization, and a shared presentation fold/renderer consumes permitted live events or the completed replay export. Separate game and player images come from one root TypeScript package; provider code never enters the game or viewer.

**Tech Stack:** Node 22.14.0, TypeScript, npm with one package-lock.json, strict schema validators with inferred types, ws, React, Vite, Vitest, Playwright, esbuild, AWS Bedrock InvokeModel, Docker Compose linux/amd64, and the independently installed Coworld CLI.

---

## Execution contract and canonical sources

This document plans production work; it does not claim any production behavior exists. Execute in a Manager-assigned implementation worktree, not this documentation worktree. Read `project/operating-guide`, `project/current-program`, and the active promise before starting. Use @superpowers:test-driven-development for implementation, @superpowers:systematic-debugging for unexpected failures, @superpowers:requesting-code-review at coherent batch boundaries, and @superpowers:verification-before-completion before handback. No task authorizes publishing, credentials, or hosted spending without the Manager's separately recorded authorization.

Canonical inputs, in precedence order:

1. [Accepted product contract](../product/v1-contract.md).
2. [Architecture record](../architecture/architecture-record.md) and its [exact system/protocol design](2026-09-15-who-cried-wolf-coworld-design.md), referred to below as **system design**.
3. Rules-parity and spectator/reveal handbacks, to be reconciled before this plan's final commit.
4. Coworld source at `/Users/jt/projects/coworld`, inspected at `6506e676533caab80c9688e877d57355100e98af`: `src/coworld/docs/{roles/GAME.md,roles/PLAYER.md,BEDROCK.md,STATIC_REPLAY_VIEWERS.md,AUTHORING.md,COWORLD_MANIFEST.md}`, `src/coworld/{types.py,bundle.py,certifier.py,play.py}`, `src/coworld/runner/{runner.py,kubernetes_runner.py}`, `COOKBOOK.md`.

The plan chooses implementation filenames and test seams, not a new wire contract. Copy exact schema fields, enum values, bounds, and audience combinations from the reconciled system design. If a test below disagrees with that record, stop that dependency, send the concrete discrepancy and recommendation to the Manager/Architect, and reconcile the record before continuing.

### Permanent constraints

- Exactly Wolf, Alchemist, Seer, Guard, five Sheep; nine authenticated slots independent of names/models.
- Day 1 starts with discussion. A cycle has six public windows, a vote window, four private Wolf windows, and a simultaneous composite night window. No early closure leaks readiness. Absent private turns still consume their fixed windows.
- `maxDays=8` by default; after the final night check ordinary victory first, otherwise draw with nine zero scores. Default bound is 978 seconds including connect/artifact allowances, beneath Coworld's 1,200-second Job limit.
- First valid final response locks. No network-order tie breaking; sorted phase batches, labeled seeded draws. No wall-clock or ambient randomness in domain code.
- Presentation identity is trusted top-level `GameConfig.presentation?: Presentation[9]`, separate from runner-overwritten players[].name: `{kind:'character',characterId,persona}` or `{kind:'neutral'}`. Omission normalizes nine distinct neutral entries; every wire PublicSeat has required normalized presentation. It never asserts bundled/submitted provenance, matches persona by display name, or accepts policy-supplied model/provider metadata.
- No seed, tokens, audience lists, hidden sequence/version counters, private timing, or arbitrary provider objects in live payloads. Export constructs fresh allowlisted objects only after terminal state.
- Public stream stays public after finish. Spoiler controls do not protect downloaded replay bytes. Claims are speech, not authoritative role metadata.
- Bundled policies use bounded authored explanations, never hidden reasoning. Failures use safe enums and remain distinct from strategic passing. The game does not claim to classify arbitrary third-party speech or control that policy's platform-owned logs; it enforces field/size/audience boundaries and the bundled policy's prompt/output discipline.
- No database, event-sourced game recovery, model host, compatibility translator, commissioner, or browser rule engine.

### Work rhythm and commands

Every numbered task ends in one coherent commit. Each enumerated scenario inside a Write red step is a separate small red/green cycle: write that assertion, run the stated focused command, implement only that behavior, rerun; repeat for the next scenario, then commit the coherent set. Do not write the entire matrix first or implement several future behaviors in one pass. Within tasks, each numbered step is one action; keep each edit or focused run around 2–5 minutes and split when it grows larger. Split a large row into a further commit if needed; never commit a knowingly failing implementation. Expected failures below are test-specific: a missing command/module is acceptable only when that task introduces it. An unrelated syntax error, dependency install failure, or broken fixture is not proof of the behavior under test.

All commands run from the implementation worktree root. Before npm/node commands in each execution shell:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use 22.14.0
node --version
```

Expected Node version: `v22.14.0`. When a tool starts a fresh noninteractive shell, use `nvm exec 22.14.0 <command>` after sourcing nvm instead of assuming shell selection persisted. `npm test -- <file>` means `vitest run <file>` using the pinned local install. `npm run test:browser -- <file>` means Playwright. Avoid `npx` downloading unspecified tooling. After each pass run `npm run typecheck` and `git diff --check`; fix failures introduced by the task before the stated commit. Keep tests independent of wall-clock sleeps by injecting monotonic clocks into runtime code; real-network/browser/process tests use bounded waits and clean up in `finally`/test teardown.

Tooling installation is a prerequisite, not product behavior. The Manager supplied current registry evidence on 2026-09-15; use the exact pins in Task 1, verify their compatibility and audit immediately, then commit one lock and use npm ci thereafter. The system Node is 23.11.0; do not use it accidentally. Source the existing nvm setup and select 22.14.0 before every execution shell; pin its exact Docker digest during packaging. If a security or compatibility finding requires another Node 22 patch, resolve it once in Task 1, update all runtime pins and record why. Do not silently upgrade the Coworld checkout. Its existing `.venv/bin/coworld` works, but package metadata is `0.0.0`; record the source SHA instead of treating that as a release pin.

Recommended batch reviews: after Tasks 6, 12, 17, 22, 25, 28, and 33. Reviews add evidence; they do not transfer implementation correctness.

### Exact script contract as tasks introduce it

Do not invoke a future script before the task that creates its implementation. The final package scripts are:

```json
{
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "build:node": "node tools/build-node.mjs",
  "dev:viewer": "vite --config vite.config.ts",
  "build:viewer": "WCW_CATALOGUE=0 vite build --config vite.config.ts --outDir ../../build/viewer",
  "test:browser": "playwright test",
  "prepare:manifest": "node tools/prepare-manifest.mjs",
  "build": "npm run build:node && npm run build:viewer && npm run prepare:manifest"
}
```

Tasks 1, 21, 26, 30 and 31 respectively introduce these scripts and their prerequisites. The worktree is macOS and container shell is Linux; the environment assignment is intentional. Every Node subprocess uses argv arrays and an explicit env object, never interpolated source/model text.

### Concrete assertion starters

These snippets are initial assertions to paste into the named test files; extend them with the scenario matrices in the tasks, rather than replacing behavior tests with source-text checks. Proposed exported function names below are internal implementation seams, not additional public protocols.

`tests/fixtures/config.ts` (Task 3):

```ts
export const seed = '00000000000000000000000000000000';
export function rawConfig() {
  return {
    tokens: Array.from({ length: 9 }, (_, slot) => `token-${slot}`),
    players: Array.from({ length: 9 }, (_, slot) => ({ name: `Seat ${slot + 1}` })),
    seed,
  };
}
```

`tests/protocol/config.test.ts` (Task 3, export `normalizeConfig` from config.ts):

```ts
import { expect, it } from 'vitest';
import { normalizeConfig } from '../../src/shared/config.js';
import { rawConfig } from '../fixtures/config.js';
it('defaults to a bounded eight-day game', () => {
  const config = normalizeConfig(rawConfig());
  expect(config.maxDays).toBe(8);
  expect(config.player_connect_timeout_seconds).toBe(180);
  expect(config.windowMs).toBe(8000);
  expect(config.player_connect_timeout_seconds +
    config.maxDays * 12 * config.windowMs / 1000 + 30).toBe(978);
});
it('rejects a configuration outside the episode budget', () => {
  expect(() => normalizeConfig({ ...rawConfig(), maxDays: 32, windowMs: 8000 })).toThrow();
});
```

`tests/protocol/results.test.ts` (Task 5; re-export Results from shared/replay.ts):

```ts
import { expect, it } from 'vitest';
import { Results } from '../../src/shared/replay.js';
it('requires zero scores for a day-cap draw', () => {
  const result = { schema: 'wcw.results/1', rulesVersion: 'wcw.rules/1',
    outcome: 'draw', reason: 'day_cap', daysCompleted: 8,
    scores: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
  expect(Results.safeParse(result).success).toBe(true);
  expect(Results.safeParse({ ...result, scores: [1, 0, 0, 0, 0, 0, 0, 0, 0] }).success).toBe(false);
  expect(Results.safeParse({ ...result, reason: 'wolf_parity' }).success).toBe(false);
  expect(Results.safeParse({ ...result, seed: 'SECRET' }).success).toBe(false);
});
```

`tests/privacy/projection.test.ts` (Task 13, export `project(journal,audience)` returning ProjectedEvent[]):

```ts
import { expect, it } from 'vitest';
import { project } from '../../src/shared/presentation/project.js';
import type { Event } from '../../src/shared/events.js';
it('hidden evidence changes neither public bytes nor public cursors', () => {
  const started: Event = { schema: 'wcw.events/1', seq: 1, day: 1, phase: 'day',
    audience: { kind: 'public' }, reveal: 'public', payload: {
      kind: 'started', rulesVersion: 'wcw.rules/1', roster: Array.from({ length: 9 }, (_, slot) => ({
        slot: slot as 0|1|2|3|4|5|6|7|8, name: `Seat ${slot+1}`, alive: true,
        presentation: { kind: 'neutral' as const },
      })),
    } };
  const hidden: Event = { schema: 'wcw.events/1', seq: 2, day: 1, phase: 'day',
    audience: { kind: 'seats', slots: [0] }, reveal: 'confessional',
    payload: { kind: 'confessional', slot: 0, requestKind: 'vote', text: 'SECRET' } };
  const phase: Event = { schema: 'wcw.events/1', seq: 2, day: 1, phase: 'vote',
    audience: { kind: 'public' }, reveal: 'public',
    payload: { kind: 'phase', phase: 'vote', day: 1, durationMs: 100 } };
  const before = project([started, phase], { kind: 'public' });
  const after = project([started, hidden, { ...phase, seq: 3 }], { kind: 'public' });
  expect(after).toEqual(before);
  expect(after.map(event => event.cursor)).toEqual([1, 2]);
  expect(JSON.stringify(after)).not.toContain('SECRET');
  expect(after.every(event => !('seq' in event) && !('audience' in event))).toBe(true);
});
```

The projection assertion uses the canonical required PublicSeat.presentation shape from architecture update ab69fea (source 097b737). Its metadata comes from normalized top-level GameConfig.presentation, not players[].name. Task 33 additionally injects sentinels into nested arrays and inspects actual network/export bytes; this unit test alone cannot prove privacy.

## Task 1: Root tooling and first executable schema

**Files:** Create `.nvmrc`, `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `src/shared/primitives.ts`, `tests/protocol/primitives.test.ts`; modify `.gitignore`.

1. **Write red:** Create a private ESM package with `engines.node: ">=22.14.0 <23"`, `engines.npm` matching the installed npm major, and `.nvmrc` containing `22.14.0`. Install with `nvm exec 22.14.0 npm install --save-exact zod@4.6.5 ws@8.21.3 react@19.3.0 react-dom@19.3.0` and `nvm exec 22.14.0 npm install --save-dev --save-exact typescript@7.0.2 vitest@5.0.0 vite@8.3.0 esbuild@0.28.2 @types/node@22.20.2 @types/ws @types/react@19.3.0 @types/react-dom@19.3.0 @playwright/test@1.63.0`. `@types/ws` resolves once to an exact version via --save-exact; record it with all others in package/lock. These pins are Manager-provided registry evidence, not a security guarantee. Run `nvm exec 22.14.0 npm audit` immediately and review all engine warnings; Vite/Vitest require at least Node 22.12. Verify Zod 4 built-in `z.toJSONSchema` with a strict-object schema including required/bounded array fields; use it instead of zod-to-json-schema. Stop on incompatible engines/API or material applicable advisories, resolve once with current official evidence, update exact pins, and commit lock plus evidence. Do not use --force or defer this check to Task 33. Add scripts `test: vitest run`, `typecheck: tsc --noEmit`. Set TypeScript strict, target ES2022, module ESNext, moduleResolution Bundler, jsx react-jsx, esModuleInterop, noUncheckedIndexedAccess, resolveJsonModule; include src/tests/tools TS, exclude generated directories. Vitest includes `tests/**/*.test.ts`, uses Node environment, and excludes `tests/browser/**`. Write:

   ```ts
   import { expect, it } from 'vitest';
   import { Slot } from '../../src/shared/primitives.js';
   it('accepts only integer slots zero through eight', () => {
     expect(Slot.parse(8)).toBe(8);
     for (const value of [-1, 9, 1.5, '1', NaN]) {
       expect(Slot.safeParse(value).success).toBe(false);
     }
   });
   ```

2. **Run red:** `npm test -- tests/protocol/primitives.test.ts`. Expect failure resolving `src/shared/primitives.js`, not a missing Vitest executable.
3. **Implement minimally:** Export `const Slot = z.number().int().min(0).max(8)` and `type Slot = z.infer<typeof Slot>` from the same definition. Ignore `node_modules/`, `build/`, `dist/`, `artifacts/`, `playwright-report/`, `test-results/`.
4. **Run green:** `npm test -- tests/protocol/primitives.test.ts` then `npm run typecheck`. Expect one passing test and exit 0.
5. **Commit:** `git add .nvmrc package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/shared/primitives.ts tests/protocol/primitives.test.ts` then `git commit -m "build: establish typed test harness and slot contract"`.

## Task 2: Strict JSON and bounded text at ingress

**Files:** Create `src/shared/decode.ts`, `tests/protocol/decode.test.ts`; extend `src/shared/primitives.ts`.

1. **Write red:** Test generic `decodeText(text, schema, maxBytes)` rejects duplicate keys at any nesting depth, trailing content, binary frames and >8192 UTF-8 bytes. Supply a small local strict fixture schema to prove unknown keys, unsafe integers, control characters and version enums are rejected; the real Action schema is introduced in Task 4, avoiding a dependency on future work. Add valid escaped-key and escaped-string cases so a regular expression cannot masquerade as a parser. Test `GameText(480)` accepts 480 Unicode code points and rejects 481; emoji count by code point, byte bound separately.
2. **Run red:** `npm test -- tests/protocol/decode.test.ts`. Expect missing decoder, then specific accepted-invalid-input assertions as each case is enabled.
3. **Implement minimally:** One JSON lexical scanner tracks object key sets and decoded string keys before `JSON.parse`; account for escaped quotes, escapes, arrays and nested objects. Delegate syntax/number validation to JSON.parse plus strict schemas. Do not salvage fenced JSON, aliases, or prose. Return typed safe rejection codes, never include raw frame/error text. Put shared name/text/ID validators here or primitives; all object schemas use `.strict()`.
4. **Run green:** `npm test -- tests/protocol/decode.test.ts tests/protocol/primitives.test.ts`. Expect valid text preserved and every malformed row rejected.
5. **Commit:** `git add src/shared/decode.ts src/shared/primitives.ts tests/protocol/decode.test.ts` then `git commit -m "feat: reject ambiguous and oversized protocol input"`.

## Task 3: Validated nine-seat config and budget

**Files:** Create `src/shared/config.ts`, `tests/protocol/config.test.ts`, `tests/fixtures/config.ts`.

1. **Write red:** Fixture has nine distinct tokens `token-0`…`token-8`, nine `{name:'Seat N'}` objects, optional 32-lowercase-hex seed. Assert defaults produce maxDays 8/connect 180/window 8000 and bound 978; reject duplicate tokens, 8/10 seats, invalid seed, maxDays 33, unexpected config fields, noninteger windows, and any bound >978. Accept maxDays 32 only with shorter windows fitting the same bound. Allow duplicate display names. Validate the canonical top-level optional presentation array: exactly nine strict objects when present; omission only defaults to nine neutral entries. Reject null, partial/wrong-length arrays, extra fields, characterId outside 1–48 ASCII `/^[a-z0-9][a-z0-9_-]*$/`, persona outside 1–240 code points/allowed controls, and dynamic asset URLs. Changing names, policies or secret role seed must not change character assignment.
2. **Run red:** `npm test -- tests/protocol/config.test.ts`. Expect config module missing; after shape implementation expect budget/default assertions to fail until implemented.
3. **Implement minimally:** Strict raw config schema, then explicit normalization and cross-field budget validation from system design §8. Keep seed optional here; operating-system entropy is a runtime concern. Manifest config_schema must still require tokens. If a token-free authored-instance helper is needed, derive it only for validating variant/certification input instances, then inject nine placeholder tokens and validate against the real runtime config schema. Never export that helper as manifest config_schema.
4. **Run green:** `npm test -- tests/protocol/config.test.ts`. Expect defaults and boundary cases pass; no seed fabricated by schema defaulting.
5. **Commit:** `git add src/shared/config.ts tests/protocol/config.test.ts tests/fixtures/config.ts` then `git commit -m "feat: bound nine-seat configuration and episode duration"`.

## Task 4: Canonical player/control contracts

**Files:** Create `src/shared/player.ts`, `tests/protocol/player.test.ts`; extend primitives. Observation/Inspection and end schemas wait until the event/results graph exists in Task 5.

1. **Write red:** Add one valid specimen for each bid/wolf_chat/vote/night request/body and ready/receipt control; mutate each with unknown fields, wrong protocol, excessive text, wrong slots and bounds. Define Action and Request schemas now, not Observation or end (which depend on Task 5 events/results). The runtime legality tests will follow; this task proves the closed action contract.
2. **Run red:** `npm test -- tests/protocol/player.test.ts`. Expect missing schema export, then exact invalid specimen rejection failures.
3. **Implement minimally:** Derive TS types from closed Zod discriminated unions exactly matching system design §4. Declined bids require empty text, zero urgency and null metadata. Keep actual target membership, request identity and living eligibility in the domain request validator, not client-provided authority. Fixtures use known values rather than calling implementation to manufacture expected observations.
4. **Run green:** `npm test -- tests/protocol/player.test.ts tests/protocol/decode.test.ts`. Expect every union case accepted and every mutation rejected.
5. **Commit:** `git add src/shared/player.ts src/shared/primitives.ts tests/protocol/player.test.ts` then `git commit -m "feat: define strict versioned policy wire contract"`.

## Task 5: Evidence, results, and replay schemas

**Files:** Create `src/shared/events.ts`, `src/shared/replay.ts`, `src/shared/results.ts`, `src/shared/actions.ts`, `tests/protocol/events.test.ts`, `tests/protocol/results.test.ts`, `tests/fixtures/observations.ts`; complete Observation/Inspection/end in `src/shared/player.ts` and their tests after event/result definitions exist.

1. **Write red:** Table-test every payload kind and its permitted audience/reveal combination against system design §6. A public bid, public failure, live roles/seed, server-only public speech, duplicate role slots, and unknown payload fields must fail. Results test exact outcome/reason pairs, nine 0/1 scores, no seed/text/diagnostic fields, and draw all-zero; terminal-state score ownership is tested later.
2. **Run red:** `npm test -- tests/protocol/events.test.ts tests/protocol/results.test.ts`. Expect missing modules then incorrect taxonomy/cross-field assertions.
3. **Implement minimally:** Define Payload, internal Event, ProjectedEvent, ViewerPacket, Results and Replay in one shared schema graph. Export discriminated types from validators. Avoid circular runtime schemas by defining Results independently before finished-event/replay assembly. After Events and Results exist, finish Observation/Inspection/end schemas and fixtures; assert nine unique ordered roster slots, Town empty teammates, ledger ownership shape and all bounded fields. Avoid runtime import cycles: put shared Bid/Action schemas in `src/shared/actions.ts` owned by this task, and re-export them from player.ts; events imports actions, player imports events, replay imports events/results. Put independent Results in `src/shared/results.ts` and re-export from replay. Separate structural replay validation from terminal export eligibility. Never spread an input object into an output event.
4. **Run green:** `npm test -- tests/protocol/events.test.ts tests/protocol/results.test.ts tests/protocol/player.test.ts`. Expect all combinations pass/fail as prescribed, including the now-complete Observation/Inspection/end shapes.
5. **Commit:** `git add src/shared/events.ts src/shared/replay.ts src/shared/results.ts src/shared/actions.ts src/shared/player.ts tests/protocol/player.test.ts tests/fixtures/observations.ts tests/protocol/events.test.ts tests/protocol/results.test.ts` then `git commit -m "feat: define audience-bound evidence and terminal schemas"`.

## Task 6: Versioned deterministic randomness

**Files:** Create `src/game/domain/random.ts`, `tests/domain/random.test.ts`.

1. **Write red:** Golden-vector tests for SHA-256 UTF-8 `seed:label:counter`, first unsigned 32 bits big-endian, rejection sampling, and separate counters for role/tie labels. Independently calculate fixture digests with `node --input-type=module -e 'import {createHash} from "node:crypto"; console.log(createHash("sha256").update("00000000000000000000000000000000:roles:0").digest("hex"))'` and paste expected digest bytes into tests. Inject a digest test seam to force a rejection and verify counter increments on rejected draws; reject range 0 and 2^32+1, accept 2^32.
2. **Run red:** `npm test -- tests/domain/random.test.ts`. Expect random module missing, then wrong golden draw/counter assertion.
3. **Implement minimally:** Pure helper accepting seed/label/counter/range and returning `{value,nextCounter}`; range must be an integer in 1..2^32; reject larger values before sampling to prevent a zero-acceptance loop. Fisher–Yates over the canonical fixed role array uses only the roles label. Do not import browser code or use Math.random.
4. **Run green:** `npm test -- tests/domain/random.test.ts`. Expect same inputs match every run; unrelated labeled draws do not perturb role assignment.
5. **Commit:** `git add src/game/domain/random.ts tests/domain/random.test.ts` then `git commit -m "feat: add labeled reproducible game randomness"`.

## Task 7: Role assignment and legal choices

**Files:** Create `src/game/domain/state.ts`, `src/game/domain/rules.ts`, `tests/domain/roles.test.ts`, `tests/fixtures/domain.ts`.

1. **Write red:** Test exact nine-role multiset, factions, slot identity despite equal names, private teammate knowledge, required normalized PublicSeat.presentation in started/Observation/Inspection/export, and legal-target matrices from the final rules-parity record. Fixture builder takes explicit role/alive arrays for focused rule tests and never enters production. Assert dead actors have no requests and no self-targeting; Alchemist offers ordered kill+block rows, Sheep offers `[]`.
2. **Run red:** `npm test -- tests/domain/roles.test.ts`. Expect missing state/rules then wrong target/faction assertions.
3. **Implement minimally:** `createState(config,seed)` creates game-owned roles/alive/pending/counters/phase/day/result, without a duplicate mutable transcript. `legalChoices(state,slot,kind)` derives exact allowed rows from the canonical rules. Role assignment uses Task 6, starts Day 1 after waiting.
4. **Run green:** `npm test -- tests/domain/roles.test.ts tests/domain/random.test.ts`. Expect no role mechanics depend on names, policy identities, or arrival order.
5. **Commit:** `git add src/game/domain/state.ts src/game/domain/rules.ts tests/domain/roles.test.ts tests/fixtures/domain.ts` then `git commit -m "feat: assign roles and enumerate authoritative legal choices"`.

## Task 8: Simultaneous day vote resolution

**Files:** Extend `src/game/domain/rules.ts`; create `tests/domain/day.test.ts`.

1. **Write red:** Port the final rules specification's strict-majority, null abstention, tie, all-abstain, dead-voter/target and locked-ballot examples one at a time. Test network-order permutations yield identical normalized resolution. Verify no public ballot before closure; that delivery assertion belongs to Task 15, while this test checks no resolution command means no death.
2. **Run red:** `npm test -- tests/domain/day.test.ts`. Expect absent resolver or wrong elimination/threshold.
3. **Implement minimally:** Pure `resolveDay(state,acceptedBallots)` reads the living electorate snapshot, counts only legal locked ballots, chooses the canonical outcome, and emits ballots/elimination evidence with no private summaries. Do not reuse benchmark plurality rules or invent tie randomness for day voting.
4. **Run green:** `npm test -- tests/domain/day.test.ts`. Expect every named canonical scenario and permutation passes with unchanged input state.
5. **Commit:** `git add src/game/domain/rules.ts tests/domain/day.test.ts` then `git commit -m "feat: resolve closed day ballots by canonical majority rules"`.

## Task 9: Simultaneous night resolution

**Files:** Extend `src/game/domain/rules.ts`; create `tests/domain/night.test.ts`.

1. **Write red:** Add canonical scenarios for block before protect/kill/inspect; blocked Alchemist kill nomination removal; surviving nominations only; sorted seeded tied targets; no nominations no attack; no self-targets; protected attack; killed-before-resolution Seer receives no new live/private_result and no dead-seat knowledge update; only server-audience night_outcome(inspect, actor=Seer, outcome=actor_dead) is replay-revealable. A living blocked Seer receives wire `no_result` without a cause field; and canonical Wolf versus Alchemist inspection results. Vary submission order without changing inputs. Reserve malformed composite ingress assertions for Task 11; this pure resolver receives only normalized legal actions, so do not make it another wire validator.
2. **Run red:** `npm test -- tests/domain/night.test.ts`. Expect missing night resolver or incorrect resolution/knowledge delta.
3. **Implement minimally:** Normalize by actor slot, resolve blocks, remove blocked kill nominations, seeded target selection, guard effect/attack/deaths, then Seer result under the final parity record. Faction kill outcome actor is null; individual outcomes have their actor. Derive separate public night summary, actor knowledge and server-only detail; never broadcast complete outcomes.
4. **Run green:** `npm test -- tests/domain/night.test.ts tests/domain/random.test.ts`. Expect canonical outcome/knowledge/evidence and seed stability for all rows.
5. **Commit:** `git add src/game/domain/rules.ts tests/domain/night.test.ts` then `git commit -m "feat: resolve blocked nominations and ordered night abilities"`.

## Task 10: Terminal outcomes and day cap

**Files:** Extend rules/state; create `src/game/domain/transition.ts`, `tests/domain/terminal.test.ts`.

1. **Write red:** Town wins with no living Wolves; Wolf faction wins at parity; dead winners still score 1; cap draw only after final night and only if neither faction won. Day 1 victory has daysCompleted 0; default cap draw has 8. Add a cap-night normal-victory case to prevent draw taking precedence. Unknown command and command after finish cannot mutate state.
2. **Run red:** `npm test -- tests/domain/terminal.test.ts`. Expect missing transition/outcome or wrong scores/daysCompleted.
3. **Implement minimally:** `transition(state,command)` is the sole state mutation seam returning new state plus derived events. Results come from terminal state, not a transcript fold. Trigger victory checks after closed day/night resolution; cap after night only. Transport failure is not a draw.
4. **Run green:** `npm test -- tests/domain/terminal.test.ts tests/domain/day.test.ts tests/domain/night.test.ts`. Expect outcomes and results schema agree.
5. **Commit:** `git add src/game/domain/state.ts src/game/domain/rules.ts src/game/domain/transition.ts tests/domain/terminal.test.ts` then `git commit -m "feat: finish episodes with faction results or bounded draw"`.

## Task 11: Request locking, rejection, and deterministic fallback

**Files:** Create `src/game/domain/requests.ts`, `tests/protocol/requests.test.ts`; extend state/transition.

1. **Write red:** Test exact episode/request/observation/socket binding, wrong phase, composite night ordering/completeness, visible reply targets, first accepted body lock, identical resend duplicate, changed resend rejection, expired reply, one retry with same IDs/deadline, and second invalid action fallback. Test voluntary pass, provider-reported fallback and server fallback remain distinguishable. A reconnect cannot unlock accepted actions.
2. **Run red:** `npm test -- tests/protocol/requests.test.ts`. Expect missing request reducer or wrong receipt/state transition.
3. **Implement minimally:** One pending request per seat owns stored legal choices, original deadline, attempt, accepted body and bounded diagnostic facts. Pure fallback bodies are decline/empty chat/abstain/null-per-ability respectively. Receipt generation does not append evidence; closure appends at most first rejection then final disposition in slot order. Do not emit Coworld terminal GamePlayerFailure for recoverable policy mistakes.
4. **Run green:** `npm test -- tests/protocol/requests.test.ts`. Expect malformed composite applies no action; retries consume original budget only.
5. **Commit:** `git add src/game/domain/requests.ts src/game/domain/state.ts src/game/domain/transition.ts tests/protocol/requests.test.ts` then `git commit -m "feat: lock requests and apply bounded legal fallbacks"`.

## Task 12: Public floor selection and private conversation ordering

**Files:** Create `src/game/domain/floor.ts`, `tests/domain/floor.test.ts`; extend transition. Test next-request visibility at the domain evidence seam here; exercise actual Observation delivery in Tasks 14–15, after its builder exists.

1. **Write red:** Rank equal candidates by speech count ascending, valid direct reply, urgency descending, rotating slot priority; max two speeches/day. Reject exact repeat after trim/lowercase among own last five public messages. Winner text is exactly committed bid text, with no second provider call. Wolf turns use two rounds of ascending living faction slots; a lone living Wolf receives exactly two active turns and two fixed idle windows, never four active turns. Each next observation sees previous accepted team speech, with idle windows retained.
2. **Run red:** `npm test -- tests/domain/floor.test.ts`. Expect missing floor function or incorrect deterministic winner/order.
3. **Implement minimally:** Pure rank function uses public evidence and explicit counters. No lexical quality scoring or natural-language plan-lock detection. Bid reasons stay private; accepted public speech is a fresh object. Wolf text and confessional summary become separate authorized events.
4. **Run green:** `npm test -- tests/domain/floor.test.ts tests/protocol/requests.test.ts`. Expect arrival permutations select identical public speech.
5. **Commit:** `git add src/game/domain/floor.ts src/game/domain/transition.ts tests/domain/floor.test.ts` then `git commit -m "feat: arbitrate bounded speech and sequential wolf turns"`.

## Task 13: Separate audience projections and safe cursors

**Files:** Create `src/shared/presentation/project.ts`, `tests/privacy/projection.test.ts`, `tests/fixtures/events.ts`.

1. **Write red:** Construct journal fixtures with sentinel secret strings in bid reason, confession, private chat, roles, seed and diagnostics. For public and each seat assert exact allowed fields, contiguous local cursors, stable public speech IDs/references, no internal seq/audience/request IDs/timestamps, and no gaps when hidden events are inserted. Resolve Wolf recipient slots at emission; death never creates access to new team chats.
2. **Run red:** `npm test -- tests/privacy/projection.test.ts`. Expect missing projector or secret/reference/cursor mismatch.
3. **Implement minimally:** Pure authorize-then-allowlist projection, with independent public ID namespace and per-recipient cursor assignment. Materialize fresh payloads by known kind. Reject invalid kind/audience combinations before append. Keep the internal journal API server-owned; the same pure projection helpers may filter already-approved replay events but cannot grant access.
4. **Run green:** `npm test -- tests/privacy/projection.test.ts`. Expect two journals differing only in unobservable events produce byte-equal public projections.
5. **Commit:** `git add src/shared/presentation/project.ts tests/privacy/projection.test.ts tests/fixtures/events.ts` then `git commit -m "feat: project evidence before delivery with private cursors"`.

## Task 14: Seat observations and read-only inspector snapshots

**Files:** Create `src/game/runtime/observations.ts`, `tests/privacy/observations.test.ts`.

1. **Write red:** Test each role receives its self/teammates/legal choices and only its authorized result ledger; Town has no generic role map. More than 128 permitted speech events truncates recent transcript in original order and sets transcriptTruncated, while full bounded vote/result ledgers remain. Dead inspectors retain prior knowledge plus public changes and receive no action observations/new private knowledge, including no killed-Seer result. Only a living blocked Seer receives no_result; cause stays server/replay-only. Bound complete observation to 512 KiB.
2. **Run red:** `npm test -- tests/privacy/observations.test.ts`. Expect missing observation builder or forbidden fields/incorrect limits.
3. **Implement minimally:** Construct fresh strict Observation/Inspection from authoritative state and Task 13 projected journal. Use independent seat-local request/observation counters. remainingMs derives from the injected monotonic deadline; no raw wall timestamp. Validate before send; never spread state/config.
4. **Run green:** `npm test -- tests/privacy/observations.test.ts tests/privacy/projection.test.ts`. Expect role/seed/token sentinels absent outside explicit own/faction knowledge.
5. **Commit:** `git add src/game/runtime/observations.ts tests/privacy/observations.test.ts` then `git commit -m "feat: construct bounded authorized seat snapshots"`.

## Task 15: Serialized runtime and timing privacy

**Files:** Create `src/game/runtime/session.ts`, `tests/runtime/session.test.ts`, `tests/privacy/timing.test.ts`, `tests/helpers/clock.ts`.

1. **Write red:** With an injected manual monotonic clock, advance one window at a time. Assert accepted state and corresponding journal append complete before broadcast; delayed replies cannot apply after deadline; no early public ballots; all four Wolf windows occur even with zero/one living Wolf; all living seats receive night request at the same public-relative instant. Insert private replies with different timing and assert identical public packets/cadence.
2. **Run red:** `npm test -- tests/runtime/session.test.ts tests/privacy/timing.test.ts`. Expect missing session or closure/cadence assertions.
3. **Implement minimally:** One serialized dispatcher calls transition, appends bounded journal, then delivers authorized effects. Timers issue explicit closure commands rather than directly mutating state. Connection deadline starts the episode; game windows remain fixed. Buffer diagnostics per request and cap invalid/unsolicited frames at 16 per connection/window. Do not create journal entries per spam frame. Enforce 20,000 events/32 MiB limits as visible failures, never silent truncation.
4. **Run green:** `npm test -- tests/runtime/session.test.ts tests/privacy/timing.test.ts`. Expect fixed bounded completion and no private progress in heartbeat/waiting packets.
5. **Commit:** `git add src/game/runtime/session.ts tests/runtime/session.test.ts tests/privacy/timing.test.ts tests/helpers/clock.ts` then `git commit -m "feat: serialize timed windows without leaking private progress"`.

## Task 16: Terminal allowlist export and replay validation

**Files:** Create `src/game/runtime/export.ts`, `tests/replay/export.test.ts`; extend `src/shared/replay.ts`.

1. **Write red:** Export a terminal fixture and assert public + six approved private categories only. Preterminal export, unknown/never payload, copied raw state/config, token/prompt/provider object, missing started/finished, duplicate IDs/slots, invalid references/cursors and >32 MiB must fail. Validate exactly one started/finished, strict versions and outcome parity with terminal state. Public stream remains public after export.
2. **Run red:** `npm test -- tests/replay/export.test.ts`. Expect missing exporter or forbidden-field/completeness failure.
3. **Implement minimally:** Build Results from state and Replay from allowlisted journal payloads using explicit constructors; preserve public IDs while assigning replay-local contiguous cursors. Emit roles/seed only for completed artifact. Verify completed public evidence against terminal result; set complete true only after all validations. No raw diagnostics, append-only artifact trickle, or snapshot dump.
4. **Run green:** `npm test -- tests/replay/export.test.ts tests/privacy/projection.test.ts`. Expect permitted private fields included and every prohibited sentinel absent from serialized bytes.
5. **Commit:** `git add src/game/runtime/export.ts src/shared/replay.ts tests/replay/export.test.ts` then `git commit -m "feat: export only validated completed replay evidence"`.

## Task 17: Shared presentation fold and public replay parity

**Files:** Create `src/shared/presentation/fold.ts`, `tests/replay/presentation.test.ts`, `tests/fixtures/presentation.ts`.

1. **Write red:** Fold captured public events, then filter/reload completed replay and compare presentation after each public event ID. Assert claims do not reveal roles; ballots/eliminations/results come from explicit evidence rather than inferred votes. Test resets, duplicate packets, gap signaling, revealed categories and refold-to-cursor without any domain import.
2. **Run red:** `npm test -- tests/replay/presentation.test.ts`. Expect missing fold or differing public presentation.
3. **Implement minimally:** Empty presentation state plus total reducer over permitted event kinds; no random draw, victory check, game transition or policy call. Separate live receipt cursor handling from replay reveal-category filtering so intentionally hidden categories do not look like transport gaps. Use final Designer payload/presentation decisions without copying a second fold into UI.
4. **Run green:** `npm test -- tests/replay/presentation.test.ts tests/replay/export.test.ts`. Expect exact public parity, including terminal result and cursor-independent public IDs.
5. **Commit:** `git add src/shared/presentation/fold.ts tests/replay/presentation.test.ts tests/fixtures/presentation.ts` then `git commit -m "feat: reconstruct live and replay presentation with one fold"`.

## Task 18: Coworld URI IO and artifact atomicity

**Files:** Create `src/game/runtime/artifacts.ts`, `tests/runtime/artifacts.test.ts`.

1. **Write red:** Use temporary directories and a local HTTP server. Test plain path/file URI with URL-escaped filename, HTTP GET config, PUT default/POST override output, exact bytes/content type, timeout/non-2xx failures, unsupported scheme, and ambiguous POST failure without duplicate retry. Observe destination during write to prove no partial final file. Ensure secrets/query strings do not appear in errors.
2. **Run red:** `npm test -- tests/runtime/artifacts.test.ts`. Expect missing IO adapter or partial/method/error assertions.
3. **Implement minimally:** Node fileURLToPath/readFile, sibling temporary file then rename, fetch with AbortSignal and bounded response reads. Validate method enums from COGAME_RESULTS_METHOD/COGAME_SAVE_REPLAY_METHOD, no storage SDK. Complete replay first, results last; failure remains runtime failure. No cross-destination transaction or blind POST retry.
4. **Run green:** `npm test -- tests/runtime/artifacts.test.ts`. Expect success bytes exact; failures explicit and temporary files cleaned.
5. **Commit:** `git add src/game/runtime/artifacts.ts tests/runtime/artifacts.test.ts` then `git commit -m "feat: honor portable Coworld artifact URIs and atomic files"`.

## Task 19: HTTP/WebSocket control ownership

**Files:** Create `src/game/runtime/server.ts`, `tests/runtime/server.test.ts`, `tests/helpers/server.ts`.

1. **Write red:** Start on an ephemeral port with in-memory config/clock. Probe /healthz, immediate /global reset before play, matching Ping/Pong, /player invalid token/slot rejection, one control socket per slot, ready/current observation ordering and reconnect with unchanged pending request. Send binary/oversized/duplicate-key frames and verify safe bounded rejection without token/raw-payload logs. Test startup without config fails before readiness.
2. **Run red:** `npm test -- tests/runtime/server.test.ts`. Expect missing server factory or handshake/probe failures.
3. **Implement minimally:** Export testable `createServer` and separate main entry guard. Bind env host/port, validate config before health ready, authenticate before WS upgrade, wire session dispatch. Fresh seed only at startup through injected entropy (production crypto.randomBytes(16)); redact query-bearing URLs. ws handles RFC control frames while application owns size/identity/state validation.
4. **Run green:** `npm test -- tests/runtime/server.test.ts tests/runtime/session.test.ts`. Expect real loopback WS assertions and no hanging sockets after test cleanup.
5. **Commit:** `git add src/game/runtime/server.ts tests/runtime/server.test.ts tests/helpers/server.ts` then `git commit -m "feat: serve authenticated Coworld game and public streams"`.

## Task 20: Inspector delivery is separate from policy authority

**Files:** Extend server/observations; create `tests/runtime/inspector.test.ts`.

1. **Write red:** Require auth for both /client/player and `/player?slot=...&token=...&mode=inspect`. Connect inspector while controller lives; confirm authorized snapshots arrive, controller is unchanged, inspector actions are rejected, death gives no new private knowledge, public stays public after finish. HTML response has Referrer-Policy no-referrer and local-only resources.
2. **Run red:** `npm test -- tests/runtime/inspector.test.ts`. Expect missing inspector route or incorrect ownership/headers.
3. **Implement minimally:** Separate inspect connection collection and read-only send path. Serve a small testable loading shell until Task 26 renderer exists; do not claim UI acceptance yet. No human start/action controls, no global-to-omniscient upgrade.
4. **Run green:** `npm test -- tests/runtime/inspector.test.ts tests/privacy/observations.test.ts`. Expect simultaneous inspection/control and rejected inspector action.
5. **Commit:** `git add src/game/runtime/server.ts src/game/runtime/observations.ts tests/runtime/inspector.test.ts` then `git commit -m "feat: inspect seats without taking policy control"`.

## Task 21: Independently running scripted policies

**Files:** Create `src/player/main.ts`, `src/player/scripted.ts`, `tools/build-node.mjs`, `tests/player/scripted.test.ts`, `tests/runtime/player-process.test.ts`; modify `package.json`.

1. **Write red:** For every legal Observation specimen, scripted policy returns schema-valid legal body and only uses enumerated targets. Test clean end/normal close, one outstanding response, bounded reconnect retaining request IDs, and no reconnect after terminal. Spawn two separate Node policy processes against loopback server; each must authenticate only its assigned COWORLD_PLAYER_WS_URL and act as that slot. No import from src/game.
2. **Run red:** `npm test -- tests/player/scripted.test.ts tests/runtime/player-process.test.ts`. Expect missing policy client/entrypoint or no replies.
3. **Implement minimally:** Deterministic observation-only heuristic and explicit all-pass test mode. A player need not know secret game seed. Validate outgoing actions, respond within remainingMs, retain duplicate receipt handling, abort work on end and exit 0. Create `tools/build-node.mjs` now: esbuild bundles `src/game/runtime/server.ts` and `src/player/main.ts` independently to `build/game/server.cjs` and `build/player/main.cjs`, platform node, target node22, format cjs, metafile true; write each graph beside its bundle. Externalize only ws optional native accelerators `bufferutil`/`utf-8-validate`. Add `build:node: node tools/build-node.mjs`; the process-test helper awaits that command before spawn and always terminates children after each test. Do not let scripted baseline silently stand in for promised successful LLM behavior.
4. **Run green:** `npm test -- tests/player/scripted.test.ts tests/runtime/player-process.test.ts`. Expect distinct OS processes produce legal replies and clean exits.
5. **Commit:** `git add src/player/main.ts src/player/scripted.ts tools/build-node.mjs package.json tests/player/scripted.test.ts tests/runtime/player-process.test.ts` then `git commit -m "feat: run observation-only scripted policies per seat"`.

## Task 22: Full nine-seat episode and shutdown

**Files:** Modify `tools/build-node.mjs`; create `tests/runtime/episode.test.ts`, `tests/fixtures/policies/malformed.ts`, `tests/fixtures/policies/timeout.ts`; update package scripts/server.

1. **Write red:** Build and spawn one game plus nine independent scripted processes with fast windowMs=100, connect timeout 5, fixed seed and temporary artifact URIs. Assert legal terminal results, nine scores, complete validated replay, end notifications before final outputs, clean exits and captured public/replay parity. Repeat identical seed+scripted normalized choices for state/result parity; do not require OS scheduling metadata byte equality. Repeat with a malformed policy that eventually exits 0 and a silent policy that exits on end; game still finishes. A separate nonzero crash case expects legal artifacts but documents runner-level failure later.
2. **Run red:** `npm test -- tests/runtime/episode.test.ts`. Expect missing build outputs/episode never reaches terminal or artifact-order mismatch.
3. **Implement minimally:** Reuse the Task 21 entrypoint builds and process helper; do not create a second build path. Session orchestrates full bounded cycles, sends end and gives <=2 s client grace, closes sockets, validates/export/writes both artifacts then shuts server down/exits 0. Do not leave a long-running HTTP process after rollout completion.
4. **Run green:** `npm test -- tests/runtime/episode.test.ts tests/runtime/player-process.test.ts` and `npm run typecheck`. Expect normal and recoverable-failure episodes terminate with valid results/replay; trace difference only where injected faults require it.
5. **Commit:** `git add tools/build-node.mjs package.json src/game/runtime/server.ts tests/runtime/episode.test.ts tests/fixtures/policies/malformed.ts tests/fixtures/policies/timeout.ts` then `git commit -m "feat: complete nine independent policy episodes and finalize artifacts"`.

## Task 23: Personality-rich policy with deterministic provider mock

**Files:** Create `src/player/show.ts`, `src/player/provider.ts`, `src/player/mock.ts`, `src/player/personalities.ts`, `tests/player/show.test.ts`, `tests/fixtures/provider/responses.json`; extend main.

1. **Write red:** Inject a recording provider. Assert prompt contains only permitted self/role/goals/personality/visible public/team context, bounded transcript and requested action shape. A configured public character persona comes from `observation.roster[self.slot].presentation`, never a display-name lookup or secret role. Policy-local strategic style may be configured, but cannot redefine public character metadata. It must never request chain-of-thought or include hidden state. Feed valid authored bid/chat/vote/night responses and malformed/refused/extra-field responses; assert strict mapping or legal fallback with safe report. Sequential Wolf request includes previous visible Wolf speech, and confessionals are capped summaries, not an extra model call.
2. **Run red:** `npm test -- tests/player/show.test.ts`. Expect missing show policy or wrong prompt/action/report.
3. **Implement minimally:** Provider interface returns bounded raw response only in ephemeral memory to strict local decoder. Copy/adapt benchmark prompt concepts with source attribution; do not import its centralized runner or persist provider response objects. Player CLI is now explicit: `--policy scripted|show` (default scripted), `--provider mock|bedrock` (required with show), `--personality <id>` (optional known catalogue ID; otherwise select deterministic seat-local persona). Validate unsupported combinations before connecting. Personality selection uses explicit config/seat identity, not role/model name coupling. Mock fixtures exercise distinct authored personalities and exact typed responses. Mock mode maps the request synchronously, with no provider retry/reserve path, so a 100 ms certification window can contain successful mock speech. Only remote Bedrock requests need the 500 ms send reserve; do not fake a successful provider call when budget is unavailable. All provider failure paths return a legal action plus enum report.
4. **Run green:** `npm test -- tests/player/show.test.ts tests/player/scripted.test.ts`. Expect no provider call beyond requested count and no hidden/raw data in emitted actions/logs.
5. **Commit:** `git add src/player/show.ts src/player/provider.ts src/player/mock.ts src/player/personalities.ts src/player/main.ts tests/player/show.test.ts tests/fixtures/provider/responses.json` then `git commit -m "feat: add bounded personality policy and deterministic provider fixtures"`.

## Task 24: Bedrock adapter, real HTTP mock, and deadline proof

**Files:** Create `src/player/bedrock.ts`, `tests/player/bedrock.test.ts`; update dependency lock/provider selection.

1. **Write red:** Add a loopback fake Bedrock endpoint recording path/headers/body and controllable responses. Configure AWS_ENDPOINT_URL_BEDROCK_RUNTIME to it, BEDROCK_MODEL to a fixture model, placeholder credentials, and a finite deadline. Assert InvokeModel path, no Converse/real AWS call, max two attempts, retry-after honored only within budget, SDK retry multiplication disabled, 500 ms send reserve, no retry for auth/config errors, and fallback on timeout/429/malformed/refusal. Confirm model ID is config, not hardcoded, and end cancels in-flight calls.
2. **Run red:** `npm test -- tests/player/bedrock.test.ts`. Expect missing adapter or wrong route/retry/budget assertions; tests must need no real credentials/network.
3. **Implement minimally:** Add pinned `@aws-sdk/client-bedrock-runtime` to package/lock with `npm install --save-exact @aws-sdk/client-bedrock-runtime` (save the actual resolved exact version, never leave a range). Use InvokeModelCommand, explicit endpoint when sidecar env exists, env model, maxAttempts 1 and per-call AbortSignal. Support a documented model-family request/response codec; reject unsupported families before call rather than assuming every model uses Anthropic JSON. Direct local AWS mode must be explicit and separately authorized during real verification. Return safe policy codes without raw provider text. Budget may be too short to call at all in fast certification; then fallback honestly.
4. **Run green:** `npm test -- tests/player/bedrock.test.ts tests/player/show.test.ts`. Expect all HTTP calls remain loopback and failure simulation finishes inside request budget.
5. **Commit:** `git add src/player/bedrock.ts src/player/main.ts package.json package-lock.json tests/player/bedrock.test.ts` then `git commit -m "feat: route bounded InvokeModel calls through configured Bedrock endpoint"`.

## Task 25: Behavior-rich substitution and failure episode

**Files:** Create `tests/runtime/show-episode.test.ts`, `tests/privacy/policy-output.test.ts`; extend provider fixtures.

1. **Write red:** Run nine policy processes using explicit show+mock mode against the unchanged game build. Capture public bid winner, distinct authored speech, sequential Wolf chat, private summaries, vote/night choices and terminal replay. Inject throttle/malformed/refusal per configured fixture and assert visible safe diagnostic events, legal outcomes and bounded completion. Fail the test if every request merely fell back without any successful mock generation. Search game/public/policy logs and replay for prompt/raw-response/token sentinels.
2. **Run red:** `npm test -- tests/runtime/show-episode.test.ts tests/privacy/policy-output.test.ts`. Expect missing provider selection/substitution or leaked/missing evidence.
3. **Implement minimally:** Wire policy mode/provider config into player entrypoint only; game protocol/build unchanged. Use deterministic mock responses that depend on current permitted request targets, while expected scenario claims in tests remain independently specified. Sanitize log enums at source; no raw provider debugging dump.
4. **Run green:** `npm test -- tests/runtime/show-episode.test.ts tests/privacy/policy-output.test.ts tests/runtime/episode.test.ts`. Expect successful authored turns and separately identified failure fallbacks in one complete replay.
5. **Commit:** `git add src/player/main.ts src/player/mock.ts tests/runtime/show-episode.test.ts tests/privacy/policy-output.test.ts tests/fixtures/provider/responses.json` then `git commit -m "test: prove replaceable show policies and provider failure completion"`.

## Task 26: Shared spectator components and canonical catalogue

Use the final [spectator design](../design/reveal-and-spectator-design.md) §9 components and §10 payload-to-beat mapping; its prototype is design evidence, not a second production schema. Component paths are:

- `src/viewer/components/EpisodeTheater.tsx`, `RevealControl.tsx`, `SeatRail.tsx`, `SeatCard.tsx`, `Floor.tsx`.
- `src/viewer/components/PhaseBanner.tsx`, `SpeechBeat.tsx`, `VoteTally.tsx`, `Knell.tsx`, `NightHold.tsx`, `NightScene.tsx`, `SealedBeat.tsx`, `OutcomeBeat.tsx`.
- `src/viewer/components/Transport.tsx`, `HoldingsDrawer.tsx`.

Each comma-separated basename above is within the explicitly stated `src/viewer/components/` directory. Components consume the one shared presentation model. App routes transport inputs into EpisodeTheater; it does not create another rendering hierarchy. `src/viewer/styles.css` is the single token/style source seeded from approved design tokens. The developer-only `catalogue.html`/`catalogue.tsx` becomes the canonical catalogue when these application components exist; document this home with Designer/Manager, without a separate design-system package.

Before Step 1, populate `tests/fixtures/presentation.ts` with the final design's named states. At minimum: waiting, Day 1 public speech, sealed voting, public quiet night, revealed night scene, failed vote, terminal replay, terminal public live, character seat, neutral seat. These fixtures must use canonical Payloads and the real fold, not handcrafted DOM.

**Files:** Create `src/viewer/App.tsx`, `src/viewer/main.tsx`, `src/viewer/index.html`, `src/viewer/styles.css`, `vite.config.ts`, `playwright.config.ts`, `tests/browser/components.spec.ts`, `src/viewer/catalogue.tsx`, `src/viewer/catalogue.html`, and the concrete component files listed below; modify package scripts.

1. **Write red:** Render the actual App against representative presentation fixtures in the agreed catalogue. Real-browser assertions cover waiting, public day, quiet night, eliminated speaker, vote resolution, ended draw and replay reveal states. Role claims remain labeled speech; dead seats remain inspectable without appearing alive. Assert readable status text, keyboard focus, small viewport layout and plain escaped malicious text. Final Designer handback governs names/layout/tokens, reconciled to trusted character/neutral identity. A configured character remains the same when its occupying policy is replaced; a matching display name alone cannot acquire character styling.
2. **Run red:** `npm run test:browser -- tests/browser/components.spec.ts`. Expect missing App/catalogue/visible states, not missing browser installation. Prerequisite: add `test:browser: playwright test`, install pinned Chromium with `npm exec -- playwright install chromium`, and configure Playwright webServer.command as `npm run dev:viewer -- --host 127.0.0.1 --port 4173 --strictPort`, url http://127.0.0.1:4173/catalogue.html, reuseExistingServer false. Add scripts `dev:viewer: vite --config vite.config.ts`, `build:viewer: WCW_CATALOGUE=0 vite build --config vite.config.ts --outDir ../../build/viewer`, `test:browser: playwright test`. Vite root is `src/viewer`, base './'; enable esbuild JSX automatic transform and declare index.html/catalogue.html as separate build inputs. Production builds exclude catalogue via a WCW_CATALOGUE=0 build flag; test/dev catalogue is local developer-only.
3. **Implement minimally:** Compose the shared components and token system from final design. Use React text children, no dangerouslySetInnerHTML/Markdown/remote embeds/model URLs. Canonical catalogue renders the same exported components as App; use Storybook only if the final design establishes no equivalent. No showcase-only replicas. Configure Vite base './', strict local server binding and build output passed by hook later.
4. **Run green:** `npm run test:browser -- tests/browser/components.spec.ts`. Expect all states readable/keyboard reachable without console errors; save screenshots under ignored artifacts/browser and attach selected evidence.
5. **Commit:** `git add src/viewer/App.tsx src/viewer/main.tsx src/viewer/index.html src/viewer/styles.css src/viewer/catalogue.tsx src/viewer/catalogue.html src/viewer/components vite.config.ts playwright.config.ts tests/browser/components.spec.ts tests/fixtures/presentation.ts package.json` then `git commit -m "feat: compose shared spectator states and component catalogue"`. The components directory is wholly new in this task; inspect its staged contents before committing.

## Task 27: Live and inspector UI adapters

**Files:** Create `src/viewer/live.ts`, `tests/browser/live.spec.ts`, `tests/helpers/browser-game.ts`; modify `playwright.config.ts`, server static assets, App/main.

1. **Write red:** Browser connects to real game /client/global before start, sees waiting then public events without reload. Disconnect/reconnect yields full reset without duplicate speech; injected cursor gap triggers reconnect/reset. Inspector page receives only its seat view and cannot send actions. Inspect raw network messages alongside rendered UI for private sentinel leaks, including after game finish.
2. **Run red:** `npm run test:browser -- tests/browser/live.spec.ts`. Expect missing live adapter or reset/state transitions.
3. **Implement minimally:** Thin WS adapter validates ViewerPacket/Inspection, dispatches shared fold and exposes connection status. Derive WS origin from page environment, preserve only needed auth for inspector, never expose query in logs/referrers. Serve the same compiled App for public and inspector routes. No game commands or separate live rendering branch. `tests/helpers/browser-game.ts` starts/stops the real game with child-process cleanup in test teardown; its setup first runs `npm run build:viewer`; bind tests to a real temporary game instance and point Playwright at its URL, while catalogue-only tests use the configured dev webServer. Keep these as named Playwright projects, with browser tests isolated from Vitest.
4. **Run green:** `npm run test:browser -- tests/browser/live.spec.ts` and `npm test -- tests/runtime/inspector.test.ts`. Expect reconnect parity and public-after-finish secrecy at network boundary.
5. **Commit:** `git add src/viewer/live.ts src/viewer/App.tsx src/viewer/main.tsx src/game/runtime/server.ts tests/browser/live.spec.ts tests/helpers/browser-game.ts playwright.config.ts` then `git commit -m "feat: connect shared spectator UI to authorized live streams"`.

## Task 28: Static replay playback and browser parity

**Files:** Create `src/viewer/replay.ts`, `tools/serve-replay.mjs`, `tests/browser/replay.spec.ts`, `tests/replay/clock.test.ts`; update App/main/package scripts.

1. **Write red:** Run `npm run build:viewer` and generate the deterministic replay in test setup using the Task 22 process helper; then serve only `build/viewer` and that produced replay, with no game process running. Load `index.html?replay=<encoded URL>`; assert autoplay, pause, seek, speed, loop, category controls, resize and Designer reveal semantics. Test 404, corrupt JSON, unsupported version, inconsistent references and decoded >32 MiB produce visible errors. Compare public presentation at matching public IDs to captured live data; private category filtering must not report transport gaps. Verify no model/game call during replay.
2. **Run red:** `npm test -- tests/replay/clock.test.ts` and `npm run test:browser -- tests/browser/replay.spec.ts`. Expect missing clock/loader or playback/parity/error assertions.
3. **Implement minimally:** Read replay query, stream with decoded byte cap, strict validator, shared fold. Clock assigns durations by public event kind from design; private evidence attaches to phase, no runtime timestamps. Seek refolds bounded events rather than running game rules. Local serve tool takes `--bundle <directory> --replay <file> --port <integer>` (port defaults 0), binds 127.0.0.1, exposes the one replay at `/episode.replay`, and prints `{url,port}` JSON with a fully encoded `?replay=` query. It serves only files beneath the bundle and that selected replay, includes correct MIME/CORS headers, and closes on SIGINT/SIGTERM; no directory listing or arbitrary path serving. Keep optional gzip disabled; raw bytes only until separately implemented magic-byte detection/limits.
4. **Run green:** `npm test -- tests/replay/clock.test.ts tests/replay/presentation.test.ts` and `npm run test:browser -- tests/browser/replay.spec.ts`. Expect matching public states, correct reveals, functional controls, visible failures and no game process dependency.
5. **Commit:** `git add src/viewer/replay.ts src/viewer/App.tsx src/viewer/main.tsx tools/serve-replay.mjs package.json tests/browser/replay.spec.ts tests/replay/clock.test.ts` then `git commit -m "feat: play validated static replays with live presentation parity"`.

## Task 29: Separate game and player container builds

**Files:** Create `Dockerfile`, `compose.yaml`, `.dockerignore`, `tests/packaging/images.test.ts`; extend `tools/build-node.mjs`.

1. **Write red:** Build target smoke test expects separate game/player images launch with their explicit commands, linux/amd64 metadata, no provider code in game bundle and no game domain in player/viewer bundle. Test import boundaries using esbuild metafile rather than searching minified text; fixture deliberate forbidden import must fail. Initially run the image command expecting missing Dockerfile: `docker compose build game player`.
2. **Run red:** `npm test -- tests/packaging/images.test.ts`. Expect absent metafiles/build graph checks. Docker absence is environment blockage, not a red behavioral test.
3. **Implement minimally:** One Node 22.14.0 digest-pinned multi-stage Dockerfile with builder and two final targets. Builder uses npm ci; esbuild bundles game/player independently to CJS (optional ws native accelerators external, never required). Final game copies only game bundle plus compiled browser assets; final player copies only player bundle. No entire source tree or builder node_modules in final images. Compose game/player services use distinct local image tags, targets and linux/amd64. Resolve/pin base digest before commit, record it; never fabricate digest.
4. **Run green:** `npm test -- tests/packaging/images.test.ts` then `docker compose build game player`. Expect build/import checks and both images succeed; inspect metadata with `docker image inspect wcw-game:local wcw-player:local`.
5. **Commit:** `git add Dockerfile compose.yaml .dockerignore tools/build-node.mjs tests/packaging/images.test.ts` then `git commit -m "build: isolate game and policy container dependency graphs"`.

### Task 29 build file skeleton

Use this shape after replacing the base reference with the verified digest; the placeholder is not a buildable or committed final value. The two final images contain only their own bundle and, for game, approved viewer assets.

```dockerfile
ARG NODE_BASE=node:22.14.0-slim@sha256:REPLACE_WITH_VERIFIED_DIGEST
FROM ${NODE_BASE} AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY tools ./tools
COPY tsconfig.json vite.config.ts ./
RUN npm run build:node && npm run build:viewer
FROM ${NODE_BASE} AS game
WORKDIR /app
COPY --from=builder /app/build/game/server.cjs ./build/game/server.cjs
COPY --from=builder /app/build/viewer ./build/viewer
CMD ["node", "build/game/server.cjs"]
FROM ${NODE_BASE} AS player
WORKDIR /app
COPY --from=builder /app/build/player/main.cjs ./build/player/main.cjs
CMD ["node", "build/player/main.cjs", "--policy", "scripted"]
```

```yaml
services:
  game:
    image: wcw-game:local
    platform: linux/amd64
    build:
      context: .
      target: game
  player:
    image: wcw-player:local
    platform: linux/amd64
    build:
      context: .
      target: player
```

`.dockerignore` excludes `.git`, `.worktrees`, `node_modules`, `build`, `dist`, `artifacts`, `test-results`, `playwright-report`, `.env*` and credential files. Build only the explicitly copied inputs above. Do not deny the checked-in tools or source assets the build needs. The role entrypoints resolve viewer assets relative to `/app/build/viewer`, not the host working directory.

## Task 30: Generated manifest contracts and nine-seat fixture

**Files:** Create `coworld_manifest.template.json`, `src/shared/manifest.ts`, `tools/prepare-manifest.mjs`, `tests/packaging/manifest.test.ts`, `docs/protocol/player.md`, `docs/protocol/global.md`, `docs/protocol/replay.md`; update package scripts/README.

1. **Write red:** Test generator output against Coworld's local generated JSON schema. Assert >=3 tags, only game/player roles, no template game.version, exact config/results schema derivation, text docs embedded from Markdown, one seed-free default variant carrying trusted slot-ordered presentation and an explicit fast seeded certification fixture with nine seats covering scripted and show/mock runnables. Their run argv are `['node','build/player/main.cjs','--policy','scripted']` and `['node','build/player/main.cjs','--policy','show','--provider','mock']`; no credentials in either. Choose five scripted plus four show/mock fixture entries (IDs `scripted` and `show-mock`), exactly nine total. Test document/schema source changes regenerate output rather than drift silently.
2. **Run red:** `npm test -- tests/packaging/manifest.test.ts`. Expect missing manifest generator/template or invalid generated contract. Schema validation uses local pinned Coworld source, not an unpinned remote $schema fetch.
3. **Implement minimally:** Keep `coworld_manifest.template.json` as authored metadata with explicit `{{CONFIG_SCHEMA}}`, `{{RESULTS_SCHEMA}}` and document-text placeholders. `src/shared/manifest.ts` exports JSON schemas derived with Zod 4 built-in z.toJSONSchema from canonical validators. `tools/prepare-manifest.mjs` uses esbuild to compile that entry to `build/manifest.cjs`, loads it with createRequire, fills placeholders and reads docs, then writes generated/ignored root `coworld_manifest_template.json`. Never emit a second editable schema or intermediate manifest. Root output preserves Coworld's hook cwd. Add `prepare:manifest: node tools/prepare-manifest.mjs`. Use {{GAME_IMAGE}} and {{PLAYER_IMAGE}}, run Node CJS entrypoints, replay_viewer.bundle 'replay-viewer'. Coworld JSON-schema cannot encode every semantic refinement; retain runtime semantic checks and independent config/results tests. Omit invented source_url until public provenance exists.
4. **Run green:** `npm run prepare:manifest` then `npm test -- tests/packaging/manifest.test.ts`. Expect local schema validation and all fixture/source-of-truth assertions pass. The Vitest test invokes `PYTHONDONTWRITEBYTECODE=1 /Users/jt/projects/coworld/.venv/bin/python -c 'import json; from coworld.manifest import validate_upload_manifest; m=json.load(open("coworld_manifest_template.json")); m["game"]["version"]="0.1.0.dev0"; m["game"]["runnable"]["image"]="wcw-game:local"; [p.update(image="wcw-player:local") for p in m["player"]]; validate_upload_manifest(m); print("manifest valid")'` through a subprocess with separate argv/env; never shell-interpolate document text; do not copy their Python package into runtime.
5. **Commit:** `git add coworld_manifest.template.json src/shared/manifest.ts tools/prepare-manifest.mjs tests/packaging/manifest.test.ts docs/protocol/player.md docs/protocol/global.md docs/protocol/replay.md package.json README.md .gitignore` then `git commit -m "build: generate Coworld manifest from canonical schemas and docs"`.

## Task 31: Clean static replay build hook

**Files:** Create `tools/build_replay_viewer.sh`, `tests/packaging/replay-build.test.ts`; update package build scripts.

1. **Write red:** Test executes hook with temporary absolute output path, inserts sentinel stale.js, rebuilds and expects sentinel gone, index.html present, only relative bundled assets, no symlinks/escaping files, and nonzero on failed build. Reject unsafe root/source output paths. Hook must accept its supplied output path rather than assuming root/build.
2. **Run red:** `npm test -- tests/packaging/replay-build.test.ts`. Expect missing/nonexecutable hook or stale output survives.
3. **Implement minimally:** Executable bash hook validates output, invokes pinned local Vite with output argument and clean directory recreation, propagates exit code. Coworld bundle.py resolves replay-viewer beside hydrated manifest: dist/replay-viewer. Build both container viewer and hook viewer from identical source+lock. Earlier tasks already own `build:node`, `build:viewer` and `prepare:manifest`; now add `build: npm run build:node && npm run build:viewer && npm run prepare:manifest`. Hook invokes `npm exec -- vite build --config vite.config.ts --outDir "$1" --emptyOutDir` with WCW_CATALOGUE=0; no upload.
4. **Run green:** `npm test -- tests/packaging/replay-build.test.ts` then `npm run build`. Expect clean self-contained generated viewer and manifest inputs, all generated output ignored.
5. **Commit:** `git add tools/build_replay_viewer.sh tests/packaging/replay-build.test.ts package.json` then `git commit -m "build: regenerate immutable replay bundle through Coworld hook"`.

## Task 32: Actual Coworld build, episode, play, and certify

**Files:** Create `docs/verification/local-coworld.md`, `tools/verify-local.mjs`; update only files implicated by observed failures.

1. **Establish red:** Read prerequisites and execute each rung in order. This is an integration acceptance cycle: preserve the first actual failure/log and add a focused failing regression test at that boundary before changing code. Do not manufacture an integration failure if the rung already passes; record the existing pass and continue. Use the existing CLI explicitly to avoid modifying the reference repo's environment:

   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run build
   /Users/jt/projects/coworld/.venv/bin/coworld build --project . --version 0.1.0
   /Users/jt/projects/coworld/.venv/bin/coworld run-episode dist/coworld_manifest.json --timeout-seconds 300 -o artifacts/coworld/seed-a
   /Users/jt/projects/coworld/.venv/bin/coworld run-episode dist/coworld_manifest.json --timeout-seconds 300 -o artifacts/coworld/seed-b
   /Users/jt/projects/coworld/.venv/bin/coworld run-episode dist/coworld_manifest.json --variant default -n 3 --timeout-seconds 1100 -o artifacts/coworld/varied
   /Users/jt/projects/coworld/.venv/bin/coworld play dist/coworld_manifest.json --timeout-seconds 300 -o artifacts/coworld/play
   /Users/jt/projects/coworld/.venv/bin/coworld certify dist/coworld_manifest.json --timeout-seconds 300 --no-open-report
   ```

2. **Read red/evidence:** Expect failures only if a boundary is broken; inspect results.json, replay and all game/policy logs, not merely exit status. Repeat seeded runs test same normalized scripted/mock behavior; Coworld only increments existing integer seeds; WCW uses optional hex-string seeds, so this seed-free batch mints fresh OS entropy per episode. Verify different exported seeds/opening assignments without asserting every random permutation must differ. It does not prove same-seed repeatability. Capture screenshots from real play and standalone static viewer; no --verify-replay/container replay flags for static-only v1.
3. **Implement minimally:** Fix observed root cause with focused regression test and rerun that test. Add verify-local script to validate saved results/replay, compare seeded public presentation/outcomes, confirm complete nine-seat logs without secrets, and print artifact locations. Script reads artifacts rather than reimplementing game scoring. Document nonzero crashed-policy runner semantics separately from recoverable malformed/timeout clients that exit cleanly.
4. **Run green:** Rerun every failed rung after fix; read certification transcript and browser evidence. `node tools/serve-replay.mjs --bundle dist/replay-viewer --replay artifacts/coworld/seed-a/replay` must print a local URL and remain serving until stopped. `npm run test:browser` verifies current produced replay. Expect scored completed artifacts and real presentation; certification alone does not prove static viewer liveness.
5. **Commit:** `git add docs/verification/local-coworld.md tools/verify-local.mjs` plus the exact individually reviewed regression fix/test paths, then `git commit -m "test: verify Coworld local episode and static replay ladder"`. Record CLI source SHA, image digests, Node/npm versions, commands, artifact paths and remaining limitations, without credentials or full config/token dumps.

## Task 33: Security, licensing, public docs, and final local review

**Files:** Create `tests/privacy/export-boundary.test.ts`, `tests/packaging/dependencies.test.ts`, `docs/verification/privacy.md`, `docs/verification/licensing.md`, `THIRD_PARTY_NOTICES.md`; update README and protocol docs.

1. **Write red:** Exercise real HTTP/WS/export boundaries with explicit secret sentinels and model text resembling HTML, URLs, role claims and hidden reasoning fields. Assert tokens/seed/private data never enter public live bytes, inspector auth holds, unknown/raw objects never reach replay, private event count/timing stays unobservable, canonical presentation metadata survives nested allowlisting while injected identity/provenance fields do not, and game/player/viewer import restrictions hold. Asset inventory test fails on every shipped asset without an explicit source/license/permission entry.
2. **Run red:** `npm test -- tests/privacy/export-boundary.test.ts tests/packaging/dependencies.test.ts`. Expect unlisted assets or boundary failures if any; if all already pass, retain the evidence rather than weakening production to force red. Run `npm audit --omit=dev` and `npm audit` as dependency evidence, not a sole security gate; these contact registry metadata but use no credentials. Resolve material applicable advisories with reviewed exact upgrades and regression verification.
3. **Implement minimally:** Use original neutral placeholders whenever Tofu asset rights are unverified; do not infer permission from a local file. Attribute adapted rules/prompts with source revision and license evidence. README teaches exact rules, strategy, policy authoring/config, fallback semantics and live/replay disclosure. Generated docs derive from their canonical source; reconcile the architecture pointer if exact wire docs move. No raw prompts, query tokens or provider errors in evidence publication.
4. **Run green:** `npm run typecheck`, `npm test`, `npm run test:browser`, `npm run build`, `git diff --check`; rerun Coworld rungs only if modified surface/image invalidated earlier evidence. Request review with current commit range and all seven product acceptance items. Expect no unresolved correctness/privacy/license blockers; explicitly list any remaining provider/hosted uncertainty.
5. **Commit:** `git add tests/privacy/export-boundary.test.ts tests/packaging/dependencies.test.ts docs/verification/privacy.md docs/verification/licensing.md THIRD_PARTY_NOTICES.md README.md docs/protocol/player.md docs/protocol/global.md docs/protocol/replay.md` plus exact reviewed fix paths, then `git commit -m "docs: record privacy licensing and local acceptance evidence"`. Manager reconciles completion; do not declare v1 shipped while hosted proof is absent.

## Task 34: Authorized hosted proof and final handback

**Files:** Create `fixtures/xp-request.example.json`, `docs/verification/hosted-coworld.md`; do not commit actual secret/config credentials.

1. **Prepare reviewable inputs:** Record manifest/image/bundle digests and successful unchanged certification, policy command/provider/model, nine-seat XP request and expected spend/time bounds. Request only the remaining specific publication/credential/hosted authority through the Manager if not already granted. Local reversible work is already complete before that decision. No external action on timeout or silence.
2. **Run hosted acceptance:** Once authorized, use the pinned CLI:

   ```bash
   /Users/jt/projects/coworld/.venv/bin/softmax login
   /Users/jt/projects/coworld/.venv/bin/coworld upload-coworld dist/coworld_manifest.json
   /Users/jt/projects/coworld/.venv/bin/coworld upload-policy wcw-player:local --name wcw-show --run node --run build/player/main.cjs --run=--policy --run show --run=--provider --run bedrock --use-bedrock --bedrock-model "$WCW_BEDROCK_MODEL"
   /Users/jt/projects/coworld/.venv/bin/coworld xp-request create artifacts/hosted/xp-request.json
   /Users/jt/projects/coworld/.venv/bin/coworld xp-request get "$WCW_XP_REQUEST_ID" --json
   /Users/jt/projects/coworld/.venv/bin/coworld xp-request episodes "$WCW_XP_REQUEST_ID"
   /Users/jt/projects/coworld/.venv/bin/coworld replay-open "$WCW_EPISODE_ID" --hosted
   ```

   Set task-specific variables from authorized enabled model/returned IDs; never repurpose HOME. Policy env/command must explicitly select show + Bedrock mode rather than default scripted/mock. XP body is `{coworld_id, variant_id, num_episodes:1, roster:[{slot:0,player:{policy_ref:...}}, ... through slot 8]}` with returned uploaded refs, not player_id strings. Example JSON contains nine concrete placeholder entries, no ellipsis. Use a seed-free production variant; known seed is only a diagnostic fixture.
3. **If red:** Retain safe failure codes/owned-seat logs, distinguish policy errors from game artifacts, fix root cause locally with focused regression then rerun affected local ladder before republish. Verify model calls actually succeeded; a completed all-fallback episode is reliability evidence, not behavior-rich Bedrock proof. No endpoint/model guessing or credential workaround.
4. **Verify green:** XP reaches completed with >=1 scored episode, replay URL is non-null, browser plays the uploaded immutable bundle, all nine players acted, successful provider turns and bounded failure behavior are distinguishable. Inspect game and owned policy logs without leaking secret payloads. Hosted sidecar verification is distinct from optional local direct `--use-bedrock` credential tests. Check role reveal is approved postgame data and public live remained private.
5. **Commit/hand back:** `git add fixtures/xp-request.example.json docs/verification/hosted-coworld.md` then `git commit -m "docs: record verified hosted Coworld experience"`. Run `git status --short --branch`, report commit/image/bundle versions, exact checks and all acceptance evidence to Manager. If authorization/environment blocks hosted proof, document that truthful limit; do not create a success-titled evidence commit or close the v1 outcome.

## Acceptance-to-evidence index

| Product acceptance | Required evidence |
| --- | --- |
| Complete deterministic baseline, identical recorded replay | Tasks 6–10, 15–17, 22, 32: same normalized trace/domain result and every public replay state |
| Independently replaceable behavior-rich policies | Tasks 21–25, 29, 34: separate processes/images, unchanged game, successful mock and hosted provider turns |
| Public live cannot expose private information | Tasks 13–15, 19–20, 27, 33: actual bytes/cursors/timing/auth, not only UI |
| Replay reveals approved content only | Tasks 5, 16–17, 28, 33: exact allowlist, terminal gating, no arbitrary provider data |
| Malformed/timeout actions complete legally | Tasks 11, 15, 22, 24–25, 32: legal game artifacts and separate runner-process acceptance |
| Shared renderer works live and replay | Tasks 17, 26–28: catalogue components, public parity and real browser controls/failures |
| Coworld build/run/play/certify/hosted | Tasks 29–34: saved artifact/transcript/browser evidence; hosted authorization remains explicit |

## Plan reconciliation and verification record

This plan is reconciled to the accepted product contract at `53c4ce0`, architecture and protocol through `ab69fea`, the spectator/reveal design and byte-stable evidence through `6459236`, and the deterministic rules-parity specification at `755994f`. The canonical inputs are `docs/product/v1-contract.md`, `docs/architecture/architecture-record.md`, `docs/plans/2026-09-15-who-cried-wolf-coworld-design.md`, `docs/design/reveal-and-spectator-design.md`, and `docs/testing/rules-parity.md`. Reconciliation preserves the settled Day-first flow, lexicographic floor control, two Wolf-chat rounds with fixed idle windows, block-before-actor-neutral-kill tally, killed-Seer server/replay-only evidence, strict trusted seat presentation, completed-replay allowlist, and eight-day all-zero draw. Plan checks cover 34 uniquely numbered tasks, canonical links, balanced fences, dependency order, and acceptance-to-evidence coverage. No production tests ran during plan authoring; every red/green result above remains an execution expectation until implementation supplies the named evidence.
