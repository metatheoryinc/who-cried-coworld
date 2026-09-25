# Release 0.2.0 — scoring, stamps, phone shell

Coworld 0.2.0 is a breaking release, versioned as a minor bump rather than the
platform-suggested 0.1.10:

- **Results `wcw.results/2`:** headline `0.75 × win + 0.25 × bonus` (Town `read`,
  Wolf `hidden`) plus per-seat `metrics` columns. See the architecture record's
  Scoring section.
- **Rules `wcw.rules/3`:** the Wolf kill is two collective votes (target, knife),
  logged as `kill_resolution`.
- **Player protocol:** Town vote requests carry `suspicion: true` and accept an
  optional `suspicion` list. Policies that parse observations strictly must be
  rebuilt; `wcw-bedrock-haiku:v6` and earlier reject Town vote requests.
- **Episode limit** raised to 60 minutes; human lobbies auto-start five minutes
  after the first human joins.
- Human play: action stamps with drafts, pack stamps, vote reveal, phone shell,
  expandable frame, parchment journal, chat channel tabs and per-channel drafts.

Source commit: `5093ab8` (pushed to `origin/main`). All 340 tests, typecheck and
build passed. A full local nine-model LLM game completed with valid `wcw.results/2`
results and replay (`artifacts/scoring-llm-01/`, cost $2.41 before the roster's
cheaper-model swap).

## Certification

Local certification: all 10 steps passed with a 180-second limit
(`artifacts/release-0.2.0-certification/wcw-certify-0.2.0.log`).

Uploaded Coworld: `cow_bde9fa1a-de85-4e95-a471-58e909d3299e` (canonical),
manifest `sha256:d9fb2ec7e34cc12bec71d9468077d5ed50d786f7731a50de245ec956c6e0bc50`.
All 10 hosted certification checks and the hosted smoke episodes passed:
`ereq_56a7d013-e6c2-4258-850d-953b905047b7`, `ereq_59683749-49ad-457c-8771-713ec341a19d`,
`ereq_b9a034da-dda6-463b-92a0-ed16d87d82bb`, `ereq_cfafb5ed-1464-48aa-907d-3c379507c3d6`,
and one more listed in `wcw-upload-0.2.0.log`.

## Policy

Uploaded `wcw-bedrock-haiku:v7` from the same `wcw-player:local` image, with
`--use-bedrock --bedrock-model anthropic/claude-haiku-4.5` (hosted OpenRouter-backed
proxy). Use v7 or later with 0.2.0.

## Not yet verified

- A hosted LLM Experience Request with v7 (proxy calls, suspicion reports, scores).
- Per-model policies for the rest of the roster: model availability depends on the
  Softmax proxy allowlist.
- Hosted multi-human lobby (five-minute auto-start) and phone full-screen safe areas.

## 0.2.1 and Haiku v8 — September 25, 2026

The first hosted LLM check on 0.2.0 (`xreq_ada10dd6-fb0f-43ff-aa1e-c61eb1bc8a2c`,
nine `wcw-bedrock-haiku:v7`, two-day cap) completed with valid results, but only 2
of 12 Town suspicion reports were usable: 8 were dropped as `unknown_player` because
Haiku listed itself (hosted Claude calls use Anthropic Messages without our strict
schema), and 2 were missing after proxy `provider_error` retries.

0.2.1 ignores report entries for yourself or eliminated players, counts actions whose
policy reports its own failure against `valid_actions`, and `wcw-bedrock-haiku:v8`
lists exactly which players a report must include. Source `c10d7fc`; 343 tests,
typecheck, and build passed; local and hosted certification passed all 10 checks.
Coworld 0.2.1: `cow_0349d8e1-7976-4cf2-b643-f0d3f0ab3373` (canonical).

Hosted recheck `xreq_05ddae31-3929-4a98-a7bb-8cfba572911c` (episode
`ereq_46869597-bdf9-4624-bb3c-3d30fc6b1158`, same config with v8): 12 of 13 Town
reports usable; the one miss followed a proxy `provider_error`. `valid_actions`
now reflects policy-reported failures (0.33–0.67 for three seats). Remaining issues:
eight illegal day-speech bid attempts across four seats (five retried; three ended in
fallbacks, so that bot stayed silent for the turn) and three proxy `provider_error` failures. Evidence:
`artifacts/hosted-0.2.0-v7/`, `artifacts/hosted-0.2.1-v8/`,
`artifacts/release-0.2.1-certification/`. Use 0.2.1 with v8 or later.

## Haiku v9 — bid legality (September 25, 2026)

Hosted Haiku v8 bids were rejected as illegal because `replyTo` sometimes held a
player number instead of a speech id; the player did not check bid legality, so its
retry failed blindly. `wcw-bedrock-haiku:v9` (source `754981e`, player-only; game
0.2.1 unchanged) defines `replyTo` in the prompt and validates `replyTo` and
`accusation` before sending, repairing with the exact valid ids. A local no-schema
Haiku reproduction went from 7/8 to 12/12 legal bids.

Hosted recheck `xreq_e81b6542-5a88-4364-aa7c-9732e618e3b7` (episode
`ereq_6284a1d0-cc21-4dda-a529-a1661fe3fe7a`, 0.2.1, nine v9, two-day cap): **0 illegal
bid attempts** (v8: 8). 11 of 13 Town suspicion reports usable; both misses followed
proxy `provider_error` fallbacks (3 in total across the game). Five Town seats
earned a nonzero `read` (Seer 0.17). Evidence: `artifacts/hosted-0.2.1-v9/`,
`artifacts/release-v9/`. Use 0.2.1 with v9 or later.
