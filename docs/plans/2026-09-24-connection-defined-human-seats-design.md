# Connection-defined human seats

**Status:** Approved 2026-09-24.

## Problem

Human seats are described three ways: legacy `humanSlot` (defaults to 0 in human
mode, forced to -1 in bots mode), optional `humanSlots`, and the runtime set that
grows when a browser joins. Hosted variants already send `humanSlots: []` and rely
on the join handshake, so the config fields only add ways to disagree with reality.
The lobby also auto-starts only 30 seconds after the first human joins, which is
too short for friends to gather.

## Decision

A seat is human only when its authenticated browser joins (`/human` or
`wcw.human/1` `join`). The per-seat token is the identity proof. No config field
reserves or names human seats.

### Config

- Remove `humanSlot` and `humanSlots`, including the bots-mode `-1` literal and the
  human-seats refinement. The schema is strict, so configs that still send either
  field are rejected.
- Human mode: `player_connect_timeout_seconds` defaults to 300 and allows up to 300.
  Fast and bots modes keep their existing defaults and 180-second maximum.
- Episode budget limit rises from 2,400 to 3,600 seconds; manifest
  `episode_timeout_minutes` rises from 40 to 60. Coworld allows 1–100. The default
  human budget is 300 + 2,240 + 30 = 2,570 seconds (42 m 50 s), leaving room for
  longer custom timers.

### Runtime

- `HumanSession.humanSlots` starts empty; `registerHuman` is the only way to add a
  seat. Late-arrival handover is unchanged.
- Start rule in human mode: wait for the first human join, then start when all nine
  seats are connected or `player_connect_timeout_seconds` after that first join.
  The one-second pre-start identification window stays.
- `Session.registerName` asks the session whether a seat is human rather than
  reading config.

### Moderator and classic host

- Remove `humanSlot`/`humanSlots` from `ModeratorInput` and `chooseSpeaker`.
  `eligibleSlots` (already human-free) is the only candidate list, and validation
  checks against it. The runtime still discards any choice that lands on a human.
- The LLM moderator's input JSON loses both fields; its prompt already restricts it
  to `eligibleSlots`.

### Launcher

`WCW_HUMAN_SLOTS` only selects which seats get no bot and which join links print.
It is no longer passed to the game config.

## Testing

- Config: `humanSlot` or `humanSlots` is rejected; human-mode wait defaults to 300;
  a 3,600-second budget is accepted and 3,601 rejected.
- Start: with seats empty, play starts 300 s after the first join; with nine
  connected it starts at once; without any human it keeps waiting.
- Moderator: input has neither field; a choice outside `eligibleSlots` is rejected.
- Existing human-session, server, and multiple-humans tests join seats over
  authenticated sockets instead of reserving them.

## Docs

Regenerate the manifest; update variant and connection-wait descriptions, the
budget numbers in `docs/testing/human-play.md` and `docs/package/readme.md`, and
the architecture record's compatibility note.
