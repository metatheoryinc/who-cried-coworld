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
