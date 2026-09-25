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

## Nine-model roster (September 25, 2026)

Eight per-model policies were uploaded from the v9 image (source `754981e`), one per
roster model: `wcw-chatgpt:v1`, `wcw-gemini:v1`, `wcw-gpt-oss:v1`, `wcw-llama:v1`,
`wcw-deepseek:v1`, `wcw-mistral:v1`, `wcw-glm:v1`, `wcw-kimi:v1`. With
`wcw-bedrock-haiku:v9` they fill all nine seats. Upload logs are in `artifacts/release-roster/`.

**The proxy serves all nine models:** each returned HTTP 200, and no request was
refused.

| Run | Timers | Failures |
| --- | --- | --- |
| `xreq_cc75a80b-c5fd-4ebd-8efb-4c50698c24d7` (`artifacts/hosted-0.2.1-roster/`) | short test timers (vote 20 s) | 9 fallbacks, all timeouts: GPT-OSS 4 of 5 requests, Kimi 2 of 2 (no answer), DeepSeek 1, Gemini 2 |
| `xreq_3bee5891-6238-428c-a677-be463e2eaad2` (`artifacts/hosted-0.2.1-roster-default-timers/`) | defaults (vote 45 s) | 24 fallbacks; see below |

Both runs ended in a day-cap draw with valid `wcw.results/2` results. The
default-timer run cost $0.40, with GPT-5.6 Terra Pro accounting for $0.16.

Failures in the default-timer run:

- **Timeouts:** most failures are timeouts at the player's own 15-second decision cap
  (`src/player/timed-llm.ts`), not the game window. Affected: Kimi (10–13 s when it
  answers), GPT-OSS, DeepSeek and GPT-5.6.
- **GLM 5.3 as a Wolf:** 11 of 21 `wolf_chat` requests failed, from oversized text,
  a stray `""` key, over-8 KB JSON, and timeouts.
- **Haiku:** one over-long `summary`, repaired on retry.
- **Suspicion reports:** 9 of 13 usable. The 4 missing reports all followed timeout
  fallbacks.

Follow-ups:
- Let slow models use more of the window than the 15-second cap.
- Tighten GLM's `wolf_chat` output.

### Roster fixes: v10/v2 and v11/v3

- **v10/v2** (source `fe146d0`, `xreq_f18979a4-609b-4d82-a3e5-b27b391334f4`):
  - Decisions may use the whole window.
  - Hosted chat calls send the per-model reasoning, token and strict-schema settings.
  - The parser drops keys the action schema does not define.
  - Results: GLM failed 1 attempt, which its retry fixed (was 11 of 21 Wolf-chat turns failed). Llama answered 23 of 23 and Kimi 19 of 22.
  - Regression: every GPT-5.6 and Mistral call got HTTP 404, most likely because the proxy finds no provider that supports every requested parameter.
- **v11/v3** (source `a7c3708`, `xreq_5dffd486-19e3-44b7-826d-4b3328e0b250`, `artifacts/hosted-0.2.1-roster-v11/`):
  - After a 404, the policy resends the plain request and keeps using it for that model.
  - Results: GPT-5.6 and Mistral each fell back once, then worked (Mistral 23 of 23). Every model returned accepted actions. 12 of 13 Town suspicion reports were usable.
  - 11 fallbacks, all timeouts except Haiku's: DeepSeek as a Wolf (6 of 17 Wolf-chat turns, answers up to 14 s), Kimi 2, Llama 1, GPT-5.6 1, plus Haiku 2 (both repaired on retry). The game cost $0.25.

Current roster: `wcw-bedrock-haiku:v11` and v3 of `wcw-chatgpt`, `wcw-gemini`,
`wcw-gpt-oss`, `wcw-llama`, `wcw-deepseek`, `wcw-mistral`, `wcw-glm`, `wcw-kimi`.

Remaining issues:
- DeepSeek is too slow for short chat turns.
- Hosted Haiku sometimes writes summaries over 240 characters. Its calls use Anthropic Messages, which does not get the strict schema.

## 0.2.2 — 300-character notes, MiMo seat (September 25, 2026)

Coworld 0.2.2 (`cow_fa854465-e920-4871-8682-bf616bd3d9ad`, source `c30e439`) accepts
`summary`/`reason` notes up to 300 characters, raised from 240. Policies are asked to aim
for about 240. Local and hosted certification passed all 10 checks
(`artifacts/release-0.2.2-certification/`). Roster: `wcw-bedrock-haiku:v12`,
`wcw-mimo:v1` (Xiaomi MiMo v2.6 Pro, replacing DeepSeek), and v4 of the other seven
(`artifacts/release-v12/`).

Hosted run `xreq_47d4a9e0-aafb-4fe4-bbb9-dba3ed32391a` (`artifacts/hosted-0.2.2-roster/`):
the Town voted out the Wolf on day 1, and the game ended in a draw at the day cap. It cost $0.16.

- **MiMo v2.6 Pro:** answered 0 of 27 requests. Every call ran to the decision deadline
  (5–14 s) with no HTTP status, so it is either very slow through the proxy or the proxy
  holds the request. Not usable as configured.
- **Haiku:** the 300-character limit saved only the notes between 241 and 300 characters.
  Haiku still wrote four notes of 316–463 characters, and one vote and one night action fell
  back.
- **GPT-5.6:** 2 vote timeouts (answers take about 10 s).
- **Kimi:** answered 4 of 4, but the median answer took 13 s.
- **Gemini:** one HTTP 429, which its retry fixed.
- GPT-OSS, Llama, Mistral and GLM answered every request.
- **Suspicion reports:** 11 of 14 usable.

## 0.2.3 — 512-character notes, MiMo Flash (September 25, 2026)

Coworld 0.2.3 (`cow_ca1c2eba-7cc0-4333-a931-63fcd5814f20`, source `5015163`) accepts notes
up to 512 characters and asks for about 240. The baseline player keeps its own
300-character limit and shortens longer notes at a word boundary. Local and hosted
certification passed. Roster: `wcw-bedrock-haiku:v13`, `wcw-mimo:v2` (MiMo v2.6 Flash),
and v5 of the other seven (`artifacts/release-v13/`).

Hosted run `xreq_270bf8f7-8833-423d-94d2-49bba0642809` (`artifacts/hosted-0.2.3-roster/`):
draw at the day cap. It cost $0.67, of which GPT-5.6 as a Wolf cost $0.58 (24 requests,
about 9 s each).

- **Note failures are gone.** No action was rejected for its note length (0.2.2 had
  four). One note was shortened, and the longest confessional was 297 characters.
- **MiMo v2.6 Flash:** answered 0 of 7 requests, and like v2.6 Pro, no call returned an
  HTTP status before the deadline. Neither Xiaomi model is served in time through the
  hosted proxy.
- **Gemini:** the platform deleted its container before log collection. Its bid was
  accepted, but two later requests timed out on the game side.
- **GPT-OSS:** one illegal accusation (its retry timed out) and two timeouts.
- **Kimi:** one timeout.
- Llama (22 of 22), GLM, Mistral and Haiku answered every request.

### Luna Pro and DeepSeek V4.1 Flash (v14/v6)

The player now sends each model only the parameters it supports (source `065d70b`):
GPT-5.x gets no `temperature`, and Mistral Medium 3.1 gets no `reasoning`. The ChatGPT seat
moves to GPT-5.6 Luna Pro, and DeepSeek returns on V4.1 Flash. Roster:
`wcw-bedrock-haiku:v14`, `wcw-deepseek:v4`, and v6 of the other seven (`artifacts/release-v14/`).

Hosted run `xreq_b37366eb-3e45-4117-8c97-55c00b1a0e03` on 0.2.3
(`artifacts/hosted-0.2.3-roster-v14/`): the Town voted out a Wolf (the Alchemist), and the game
ended in a draw at the day cap. It cost $0.34, of which Haiku, as the busiest Wolf, cost $0.22.

- **4 fallbacks in total, all timeouts:** Kimi 2 (night), GPT-OSS 1, Luna Pro 1. No request
  hit the plain-request fallback.
- **All 13 Town suspicion reports were usable.** One note was shortened.
- **DeepSeek V4.1 Flash:** answered 3 of 3 (about 4 s). **Luna Pro:** answered 4 of 5
  (about 9 s) for $0.01.
- **Haiku:** six speech texts ran over 480 characters (503–645); every one was fixed on retry.

### Haiku v15: speech-length reminder

Claude models get no strict schema, so `wcw-bedrock-haiku:v15` (source `0a5abeb`) adds a
closing reminder on bid and chat turns: keep text to at most 300 characters (the game rejects
anything over 480). Before this, Haiku's seat in the last roster game wrote 6 over-long speeches
in 31 attempts, all fixed on retry.

Hosted run `xreq_7e86b20f-fac6-4d21-9d7f-7829a713ea8b` on 0.2.3 with nine v15 seats
(`artifacts/hosted-0.2.3-haiku-v15/`):

- **Speech:** 0 of 56 attempts ran over (median 249 characters, maximum 310).
- **Failures:** none. All 80 attempts were accepted first time, with no fallbacks.
- **Suspicion reports:** all 13 usable.
- The game cost $0.54, or $0.06 per seat.

The roster now uses `wcw-bedrock-haiku:v15`.

### Current roster, full run (September 25, 2026)

Hosted run `xreq_622c601e-1382-419f-9e0a-72f0aebdf682` on 0.2.3 (episode
`ereq_bfa7e147-394c-4432-a16d-3bba57f9be9c`, `artifacts/hosted-0.2.3-roster-v15/`), using
`wcw-bedrock-haiku:v15`, `wcw-deepseek:v4` and v6 of `wcw-chatgpt`, `wcw-gemini`,
`wcw-gpt-oss`, `wcw-llama`, `wcw-mistral`, `wcw-glm` and `wcw-kimi`.

Result: the Town voted out the Alchemist (a Wolf), and the game ended in a draw at the
two-day cap. It cost $0.31.

- **Fallbacks:** 3 of 74 requests, all single timeouts: GPT-OSS bid, GLM bid, DeepSeek vote.
  No invalid actions and no plain-request fallbacks.
- **Every model answered.** Haiku, the busiest Wolf, answered 25 of 25 requests with no over-long
  speech.
- **Suspicion reports:** 11 of 12 usable. The miss followed DeepSeek's vote timeout.
- **Town `read` scores:** 0.16–0.48 for seven of the eight Town seats; the eighth had no usable report.

### Full-length game (September 25, 2026)

Hosted run `xreq_d91de08e-c665-4d9f-9a9a-47b17af99710` on 0.2.3 with the current roster and no
day cap (episode `ereq_65a0b204-6bb8-4a30-85f5-56ec9b517f81`,
`artifacts/hosted-0.2.3-roster-full/`). **Town won on day 5 after 23 minutes.** The game cost
$0.80.

Wolves: Haiku (Alchemist) and Mistral (Wolf). Seer: Llama. Guard: Luna Pro.

| Day | Vote | Night |
| --- | --- | --- |
| 1 | GPT-OSS (Sheep) voted out | Wolves chose not to kill |
| 2 | no majority | DeepSeek (Sheep) killed |
| 3 | Haiku (Alchemist) voted out | Kimi (Sheep) killed |
| 4 | Llama (Seer) voted out | Luna Pro (Guard) killed |
| 5 | Mistral (Wolf) voted out: Town wins | |

The Seer found Haiku on night 2, and Haiku was voted out the next day.

- **Scores:** Town winners scored 0.75–0.85, led by Gemini (`read` 0.39) and GLM (0.26). The
  Wolves scored 0.003 (Haiku) and 0.07 (Mistral, `hidden` 0.29).
- **Every model answered.** Mistral answered 63 of 63 requests, Haiku 31 of 31, and Gemini
  and GLM every request.
- **GPT-5.6 Luna Pro:** 8 of its 16 requests timed out (5 bids, 2 votes, 1 night action),
  with a median answer of 9 s. It is the slowest seat now.
- **Other timeouts:** 1 each for GPT-OSS, Llama, DeepSeek and Kimi.
- **Suspicion reports:** 18 of 24 usable. The 6 "missing" reports are exactly the vote
  timeouts: the policy's own fallback vote carries no report.
- **Strategy:** on night 1 both Wolves deliberately chose not to kill ("let town settle"). It
  is legal but helps Town.

## 0.2.4 — replay scrolling, one count per failed vote (September 25, 2026)

Coworld 0.2.4 (`cow_56ab5fc4-8467-4cf1-b3d4-e9e65e73a782`, source `33d2331`). Local and hosted
certification passed all 10 checks (`artifacts/release-0.2.4-certification/`).

- **Replay:** the viewer no longer scrolls the page. At widths up to 1000px it called
  `scrollIntoView` on each step. Embedded on softmax.com, that scrolled the host page and moved
  the pause button away. The viewer now scrolls only its own event list.
- **Suspicion diagnostics:** a vote whose policy reported its own failure (a timeout) is
  recorded once, as a failure, not also as a missing suspicion report. `valid_actions` and the
  report check share one rule for a failed decision.
