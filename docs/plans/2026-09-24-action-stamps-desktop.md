# Action Stamps (Desktop), Chat System Lines, How to Play — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Branch 2 of `2026-09-24-phone-shell-and-action-stamps-design.md`: replace vote/night dropdowns with stamps placed on player cards, add game-event lines to chat, and rename the setup guide to How to play.

**Architecture:** Pure, tested TypeScript modules in `src/viewer/` hold the logic (`stamps.ts`, `system-lines.ts`); `player.js` renders and wires events. Drafts use branch 1's revisable human submissions; pack stamps come from `packDrafts`.

**Tech Stack:** Vanilla JS + TS modules bundled by esbuild, Vitest, browser checks via the local launcher.

---

### Task 1: Stamp model (`src/viewer/stamps.ts`)

Tests `tests/viewer/stamps.test.ts` first:
- `traySlots(request)`: vote → `[{id:'vote',targets}]`; night → one per choice in order, plus `knife` (targets = `actors`) after `kill`.
- `placementsFrom(request, accepted)`: reads vote target, each night action target, and `killer` as knife; empty when `accepted` is null or of another kind.
- `place(p, id, slot, self)`: sets; placing on the stamp's current slot removes it; placing `kill` when knife is empty puts the knife on `self` if self is an actor; illegal targets are ignored.
- `clear(p, id)`.
- `bodyFor(request, p)`: legal `ActionBody` (vote target or null; night actions in offered order, `killer` only on `kill` and only when the knife is set).
- `packStamps(packDrafts)`: `[{slot:target, by, id}]` for kill targets and knives.
- `stampsOn(p, slot)`: own stamp ids on a seat.

### Task 2: Chat system lines (`src/viewer/system-lines.ts`)

Tests first. `systemLine(event, roster, events)` returns `{text, scope:'town'|'all'}[]`:
- `started` → "Day 1 begins" (town).
- `ballots` → "Vote: Name eliminated (n of m) · Role · Faction" / "Vote: no majority — nobody eliminated" / "Vote: tied — nobody eliminated" / "Vote: everyone passed" (town), then "Night d falls" (all).
- `night_resolved` → "Dawn: Name was killed in the night · Role" or "Dawn: everyone survived the night" (town), then "Day d+1 begins" (all) unless the game finished.
- `finished` → "The game is over" (town).

### Task 3: Stamp tray and card stamping in `player.js`/`player.css`

- Tray in `#action` for vote and night requests: stamp buttons (icon, label, target or "pass", × clear), status "Saving… / Saved · Counts when the timer ends".
- Holding a stamp: legal cards glow and become clickable; others dim; Esc or clicking the held stamp cancels.
- Clicking a card with your stamp while not holding picks that stamp up.
- Cards render own stamps and pack stamps (seat-number badge).
- Debounced (250 ms) send of `bodyFor`; restore from snapshot `accepted` unless a local change is unsent.
- Icons: hoof and claw PNGs; inline SVGs for knife, potion, eye, shield, key, pail, footprints, magnifier (`src/viewer/stamp-icons.ts`).
- Remove the dropdown forms and the "Choice locked in" state for votes and night actions.

### Task 4: System lines in chat, How to play

- `drawChat` interleaves messages and system lines in event order; team channels show `scope:'all'` lines.
- Rename Game setup → How to play; title "How to play", subtitle with the setup; sections Roles in this game, How to win, Voting & chat (stamps, drafts, two Wolf votes), Timing.

### Task 5: Verify and document

Browser at 1022×596 and 2000×1104 with two human seats (a Wolf and a Town seat, setup A2, seed fixed): vote stamp place/move/lift, night stamps incl. knife, pack stamps across tabs, system lines, How to play. Update `docs/testing/human-play.md`. `npm test`, `tsc`, build. Commit.
