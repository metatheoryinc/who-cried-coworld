# Bedrock inference for players and moderator

The shared adapter uses the AWS SDK's Bedrock Runtime `InvokeModel` API with the
Anthropic Messages body (`anthropic_version: bedrock-2023-05-31`). Select an Anthropic
Claude model or inference profile, such as the uploaded Haiku policy; other model
families require their own request/response adapter. The client explicitly uses HTTP/1.1
for compatibility with loopback sidecars. Hosted calls go
to `AWS_ENDPOINT_URL_BEDROCK_RUNTIME`; the SDK uses the platform's injected
credentials and region. There is no public-AWS retry if the sidecar fails.

## Backend selection

| Setting | Meaning |
| --- | --- |
| `WCW_LLM_PROVIDER=auto` | Default: prefer Bedrock when its endpoint is present; otherwise use Bedrock for `USE_BEDROCK=true`/`1`, or OpenRouter. |
| `WCW_LLM_PROVIDER=openrouter` | Explicitly use personal OpenRouter credits, even if a sidecar is present. |
| `WCW_LLM_PROVIDER=bedrock` | Explicit Bedrock: sidecar if supplied, otherwise direct AWS via the SDK credential chain. |
| `BEDROCK_MODEL` | Required Bedrock model/inference-profile ID; never an OpenRouter model slug. |
| `WCW_MODERATOR_PROVIDER` | Optional moderator-only backend override. |
| `WCW_MODERATOR_BEDROCK_MODEL` | Optional separate host model ID; otherwise uses `BEDROCK_MODEL`. |
| `WCW_BEDROCK_MAX_TOKENS` | Player output ceiling, default 1,600, configurable from 1 to 16,384. Host stays capped at 600. |

`AWS_ENDPOINT_URL_BEDROCK_RUNTIME` is the hosted signal. `USE_BEDROCK` alone selects
direct AWS for local testing; it does not prove hosted access. Players using Bedrock without a model fail startup with a configuration error.
The optional host (`WCW_MODERATOR=auto`) logs a configuration fallback and uses
deterministic scheduling if its inference configuration is missing or invalid.
`WCW_MODERATOR=llm` requires valid configuration and fails startup otherwise. The
host can be disabled with `WCW_MODERATOR=off`. No automatic model-ID substitution occurs.
OpenRouter settings, including the Gemini schema and DeepSeek output cap, remain
unchanged. Bedrock uses Anthropic Messages parameters rather than sending unsupported
OpenRouter reasoning or response-format fields. JSON instructions and local action
validation still apply.

## Hosted setup

Upload each policy version with Softmax's `--use-bedrock --bedrock-model MODEL_ID`
options. That configures the player pod; game-container moderation is configured
separately with `WCW_MODERATOR_BEDROCK_MODEL` (a public model ID, not a credential).
The game uses the sidecar injected into its own container. Model access and regional
availability must be verified on the platform. The existing OpenRouter roster does
not imply the same models are available through Bedrock.

Never bake AWS/OpenRouter credentials or a sidecar URL into the image or manifest.
Use runtime credential injection. Direct local AWS testing uses your AWS credential
chain and may incur charges. The packaged client needs `COWORLD_PLAYER_WS_URL` as
usual; for local mixed-model launchers a single `BEDROCK_MODEL` selects the model
for all policy seats. Independently hosted player processes can each select their
own model. Names remain display names, not provider guarantees.

## Deadlines and fallback

The SDK has one attempt per call. Our decision loop retains its bounded repair
retry, unchanged deadline, and legal fallback. HTTP 429/5xx are retryable within
that budget; 400/403 are not. Truncated/empty/filtered responses receive classified
diagnostics. SDK exception bodies are not logged. Bedrock usage uses native token
counts; it does not provide OpenRouter's dollar-cost field.

Moderator calls retain their two-second budget and deterministic fallback. They
are attributed to the game; no player-slot header is sent for neutral moderation.
This integration targets platform-hosted policy containers, not game-hosted file
policies that require per-seat request attribution.

## Verification

Tests cover backend selection, missing model configuration, InvokeModel request/response translation,
usage extraction, truncation, throttling, permission failures, and both player and
moderator use without an OpenRouter key. A real SDK request is exercised against a
local HTTP stub to check endpoint routing and that 429 does not trigger SDK retries.
No paid AWS or hosted Bedrock call was made during implementation. Hosted access and
model-specific response latency remain to be verified.

References: [Softmax Bedrock guide](https://docs.softmax.com/coworld/build-a-player/bedrock),
[game runtime contract](https://github.com/Metta-AI/coworld/blob/main/src/coworld/docs/roles/GAME.md#bedrock-and-aws-access),
[Coworld Bedrock contract](https://github.com/Metta-AI/coworld/blob/main/src/coworld/docs/BEDROCK.md).

## Hosted Haiku response-format regression (2026-09-16)

The v0.1.1 nine-Haiku run completed with deterministic moderation, but many model
responses were rejected for formatting. Both backends use `playerSystemPrompt`;
OpenRouter additionally requests JSON-object output (JSON Schema for Gemini),
whereas the Bedrock adapter currently relies on prompt instructions.

The shared output instruction now explicitly requests a bare JSON object with no
Markdown fences, XML, or prose. The player parser tolerates one JSON action inside
a single Markdown fence or following leading prose. It does not rewrite fields,
truncate strings, extract multiple competing objects, or weaken the strict JSON
and action validators. The original 8 KiB limit applies before wrapper removal.
The wire-protocol decoder remains unchanged.

An offline check against 434 rejected response excerpts recovered 390 for format
and schema validation. This used broad synthetic legal targets, so it does not
prove those actions were legal in their original game states. Remaining failures
include excessive text length, invalid IDs, misspelled fields, and unsupported or
malformed wrappers. They still use the existing bounded repair retry and fallback.
Tests also verify identical system prompts across the two provider adapters.

Rebuild and upload the player image as a new policy version before the next hosted
run; existing `wcw-bedrock-haiku:v1` instances cannot pick up local changes. The
game release can stay at v0.1.1 for this player-only fix. No new hosted inference
run has validated the updated prompt or parser yet.

## No silent scripted LLM policy (2026-09-17)

`node build/llm-player.mjs` fails startup if no usable inference configuration is
selected. It emits `player_startup` with configuration-presence booleans, never
credential values or a seat URL. These identify whether a hosted lobby supplied
`AWS_ENDPOINT_URL_BEDROCK_RUNTIME`, `BEDROCK_MODEL`, and Bedrock opt-in, or an
OpenRouter key. This does not prove the endpoint is reachable; successful model
attempts remain the evidence for that.

Intentional credential-free checks may add `--allow-scripted`. The manifest's
bundled `llm` baseline explicitly includes that flag so certification remains free.
Actual uploaded LLM policies must omit it. Provider failures after startup retain
bounded retries and legal passes, not the scripted discussion text. Both players
and runtime moderators now use InvokeModel. No public-AWS fallback is attempted
when an injected sidecar fails. This update does not establish whether Softmax's
browser-lobby launcher supplies the required environment; production verification
is still needed with a newly uploaded policy.

## Published InvokeModel verification (2026-09-17 UTC)

Released game **0.1.4**, `cow_762aeedc-995f-4518-8021-4c3a89ef748a`,
and policy **wcw-bedrock-haiku:v3** (policy version ID
`402fc78a-83f7-42c4-a907-c7ef47b9f943`) from commit `40d2832`.
The game is canonical, passed all 10 local and hosted certification checks,
and completed all five hosted smoke episodes. The source verification passed
241 tests, type checking, build, and a staged secret scan.

The separate paid inference check used nine v3 policies, deterministic moderation,
setup A1, and a one-day cap. Timers were 78 seconds for discussion, 10 for voting,
20 for coordination, 10 for night actions, and 0.1 for each transition. The day
length preserves 13-second discussion turns; reducing it below 78 seconds also
shortens individual discussion deadlines.

- Request: `xreq_82ca261d-28b9-4a15-ae38-53346fb9e159`.
- Episode: `ereq_2bf197d7-3ef3-4dd7-824c-de2cc1b674ba`, completed successfully.
- All nine policy logs reported Bedrock endpoint/model/credentials present and
  `allowScripted: false`. All nine had at least one accepted model decision.
- 35 model attempts: 34 HTTP 200 responses and one deadline timeout. Median
  attempt latency was 2,205 ms. No HTTP permission or throttling errors occurred.
- 27 of 29 decisions produced accepted actions. Repair retries recovered five
  initial validation failures. One wolf repeatedly targeted an eliminated player;
  one vote timed out at the shortened 10-second deadline. These two decisions
  used legal fallback behavior, not scripted discussion.
- Calls covered public bids, votes, wolf chat, and night actions. The shared
  adapter uses InvokeModel; this check does not exercise the optional LLM moderator.

Local evidence is saved under the ignored
`artifacts/release-0.1.4-certification/` directory. The hosted check verifies the
Experience Request execution path. It does **not** establish that the separate
human-lobby launcher injects Bedrock configuration. Use v3 for a future lobby
check: missing configuration now fails visibly instead of silently emitting
scripted dialogue. Existing lobbies and previously uploaded policy versions do
not inherit these changes.

## Human-lobby diagnostic policy

Select **wcw-bedrock-diagnostic:v1** in the bot seats of a new human lobby using
existing game 0.1.4. This is a diagnostic policy, not a competitive player. It
connects before checking credentials, reports safe status in public speaking
turns, and abstains from votes and night actions. Private chat also reports only
diagnostics. With all eight bot seats selected, each policy performs at most one
tiny Haiku call per process (eight calls total absent process restarts).

The first message may show only environment presence; subsequent speaking turns
include the completed probe. Each process probes health and spend once (two-second
limits each), then makes one 32-output-token model request with a five-second
limit. The probe runs independently of game action deadlines. No endpoint means
no network probe or direct AWS call. Shutdown cancels the probe.

Interpret the messages:

- **endpoint/model missing**: policy connected, but hosted inference configuration
  was not supplied completely.
- **health HTTP 200**: the health endpoint responded; model access is checked separately.
- **spend exhausted**: the sidecar reported zero allowance or nonpositive remaining funds.
- **model OK**: a nonempty model response passed through the normal Bedrock adapter.
- **model HTTP 403/429/etc.**: provider/sidecar returned that HTTP status.
- **model failed**: timeout, transport, or response error; no raw error is exposed.
- **no diagnostic speech**: investigate container launch, WebSocket connection,
  or observations; this does not establish a Bedrock failure.

The diagnostic policy deliberately overrides provider selection to Bedrock and
never publishes credentials, endpoint URLs, raw response bodies, or model text.
Spend/health endpoints can be unavailable while inference still works, so the
model probe runs even if either preliminary check fails. This policy cannot recover
logs from old sessions. Terminate the test once the status is visible.

Build/upload independently of the game package:

```sh
docker build --platform linux/amd64 --target player -t wcw-diagnostic:local .
DOCKER_DEFAULT_PLATFORM=linux/amd64 uv run --project /Users/jt/projects/coworld coworld upload-policy wcw-diagnostic:local \
  --name wcw-bedrock-diagnostic \
  --run node --run build/diagnostic-player.mjs \
  --use-bedrock \
  --bedrock-model us.anthropic.claude-haiku-4-5-20251001-v1:0
```

Current upstream documentation supports both Converse and InvokeModel. The earlier
API switch alone does not explain the human-lobby failure; runtime probe evidence
is required.

### Diagnostic v2: environment names

`wcw-bedrock-diagnostic:v2` also cycles through numbered `ENV 1/N` pages in
public speaking turns. Each page lists environment-variable **names only**, with
`empty` or `populated`. Values are never included. Empty means a zero-length
string; whitespace counts as populated. Keys with undefined values are omitted.
Names are sorted, JSON-escaped, and paginated to fit the game's chat limit.
Unusually long names may continue on the next page.

The first public turn reports probe status; subsequent turns list the environment
pages, then the cycle repeats with current probe status. Private chats and
correction retries do not advance this sequence. Group messages by bot name:
each process reports its own environment. A full list can take multiple speaking
turns or days. Existing lobby processes retain their old policy version; select
v2 explicitly in a new lobby. The one-probe-per-process limit is unchanged.

### Diagnostic v3: compact environment report first

The compact report was introduced in v3; select `wcw-bedrock-diagnostic:v4`
for new lobby tests with the current release. Public turns start
with ENV pages, followed by the probe result, then repeat. Names containing
BEDROCK, AWS, MODEL, LLM, PROXY, SECRET, TOKEN, ENDPOINT, or API_KEY appear first.
If none are present, the report says so explicitly. Values remain excluded.

Kubernetes service-link variables (SERVICE_HOST, SERVICE_PORT and numbered
PORT_TCP/UDP/SCTP families, including their matching base PORT) are replaced by
a count. Other variables, including unrelated custom PORT names, remain listed.
This avoids hundreds of chat pages from the hosted cluster's service discovery.
Each bot still reports its own environment; read numbered pages from one bot.
