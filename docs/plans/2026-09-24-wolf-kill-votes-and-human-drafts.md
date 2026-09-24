# Wolf Kill Votes and Human Drafts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Branch 1 of the phone shell and action stamps design: collective Wolf target and knife votes with a logged resolution, revisable human drafts, and a private pack draft view.

**Architecture:** `resolveNight` tallies targets and knives separately with independent seeded tie-breaks and returns a `kill_resolution` rule event (server audience, `night_choices` reveal). `submit()` gains a revisable mode that `HumanSession` uses for human seats. Wolf snapshots during night actions carry `packDrafts` built from packmates' pending actions.

**Tech Stack:** TypeScript, Zod 4, Vitest 5. Design: `docs/plans/2026-09-24-phone-shell-and-action-stamps-design.md` §4.

---

### Task 1: Collective target and knife votes, `kill_resolution`, rules/3

**Files:** `src/game/domain/rules.ts:92-107,159`, `src/shared/events.ts` (payload, server-only refine), `src/shared/replay.ts:7`, `src/game/runtime/session.ts:56`, `src/viewer/branded.js` (replay card), tests `tests/domain/rules.test.ts`, `tests/protocol/events.test.ts`.

1. Tests (fail first):
   - Three Wolves W0 (target 4, knife 0), W1 (target 4, knife 1), W2 (target 5, knife 2): seat 4 dies; `kill_resolution` has `targetVotes [{4,2},{5,1}]`, `targetTie:false`, `knifeTie:true`, killer ∈ {0,1,2} and equal to the `night_outcome` actor.
   - Knife-only vote: a Wolf with `target:null, killer:k` counts toward the knife.
   - Target without knife counts as a self knife vote.
   - No target votes → no `kill_resolution` target, kill `passed`.
   - Same outcome regardless of row order; blocked knife holder blocks the kill (make knife explicit).
   - Update the pair-rule tests to set explicit knives.
   - `kill_resolution` events validate only with server audience and `night_choices` reveal.
2. Implement tallies (sorted by slot for determinism), labels `kill_tie_day_N` and `knife_tie_day_N`, event `{kind:'kill_resolution',targetVotes,knifeVotes,targetTie,knifeTie,target,killer}`; bump to `wcw.rules/3`; accept `wcw.rules/3` in replay; render in branded replay as "How the pack decided".
3. `npx vitest run` → PASS. Commit.

### Task 2: Revisable human drafts

**Files:** `src/game/domain/requests.ts` (`submit`), `src/game/runtime/session.ts` (`receive`), `src/game/runtime/human-session.ts`, tests `tests/runtime/human-drafts.test.ts`.

1. Tests: human replaces a vote draft; illegal draft rejected and previous kept with no retry consumed; malformed draft same; clearing to pass; deadline finalizes latest draft; snapshot `accepted` is the latest draft; policy seat still rejects a changed answer.
2. Implement `submit(p,s,slot,text,now,{revisable})`; `Session.receive` asks `this.revisable(slot)` (false by default; `HumanSession` returns `isHuman`). In revisable mode an identical draft returns `duplicate`, a different legal one replaces `p.accepted`, and illegal/malformed return `rejected` without calling `reject()`.
3. PASS. Commit.

### Task 3: Pack drafts in Wolf snapshots

**Files:** `src/game/runtime/human-session.ts` (`snapshot`), tests in `tests/runtime/human-drafts.test.ts`.

1. Tests: during `actions`, a human Wolf sees packmates' drafts (human and AI), not their own row; a human Town seat's snapshot has `packDrafts: []`; outside `actions` it is empty; dead packmates excluded.
2. Implement `packDrafts` from `pending` entries of living Wolves other than the recipient with night requests and an `accepted` body.
3. PASS. Commit.

### Task 4: Docs and verification

Architecture record (Night resolution superseded; human drafts), `docs/testing/rules-parity.md`, `docs/testing/newd3.md` (rules/3), `docs/testing/human-play.md` (drafts, pack view). Regenerate manifest if its text changes. `npm test`, `npx tsc --noEmit`, `npm run build`. Commit.
