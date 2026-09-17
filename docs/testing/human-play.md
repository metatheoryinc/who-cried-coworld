# Human-paced local play

Run with Node 24.19 (see `.nvmrc`).

```sh
npm run play:human -- --llm
```

The launcher prints a private seat link on `127.0.0.1:8772`. Open it and click **Join the village**. The lobby waits for you; no model calls happen before joining. Eight opponents use the benchmark's per-player models and personality prompts, with the typed Who Cried Wolf/NewD3 instructions. Each seat uses its contestant's configured model rather than sharing Gemini. The human replaces one contestant (ChatGPT by default); the human display name defaults to Human. Prompts use the actual game roster and instruct players to use display names in dialogue, retaining numeric IDs only in structured actions. The key is loaded from `/Users/jt/projects/mafia-who-cried-wolf-benchmark/.env` on the server; it is never sent to the browser. Phase announcements use the UI. With `--llm`, the benchmark moderator model selects discussion speakers; scripted mode retains the deterministic scheduler.

For a free test, use `npm run play:human`. For accelerated UI checks, use `npm run play:human -- --smoke` (6-second discussion, 8-second vote/action windows, 2-second coordination). Smoke mode cannot use LLM opponents.

Optional environment variables: `WCW_PORT`, `WCW_HUMAN_SLOT` (0–8), `WCW_HUMAN_NAME`, `WCW_SETUP` (default random; a fixed code can be used for testing), `WCW_SEED` (32 hexadecimal characters; omit for random), `WCW_MODEL` (optional override to use one model for every opponent), `WCW_BENCHMARK_PATH`, `WCW_ARTIFACT_DIR`.

## Timing

| Phase | Duration |
| --- | --- |
| Day discussion | 150 seconds |
| Vote | 45 seconds |
| Night/day transition | 5 seconds each, before the next phase clock |
| Night coordination | 30 seconds |
| Night actions | 45 seconds |

Each 150-second day has eleven 13-second turns and a final 7-second turn. An LLM moderator selects one living bot each turn from public conversation, asked to prioritize unanswered human questions, relevant replies and fair airtime. It uses the benchmark host configuration: `OPENROUTER_HOST_MODEL` (default `openai/gpt-oss-120b`) and `OPENROUTER_HOST_PROVIDER` (default Cerebras). The original benchmark host receives secret roles; our adapted prompt and input intentionally exclude them. The selected bot receives the conversation and instructions to answer you. Without a human message, bots discuss recent claims and suspicions. Replies appear at turn boundaries; a message sent during a turn is considered at the next selection, so a reply can take roughly 13–26 seconds (shorter near the end of the day). Failed calls stay silent and do not stop the clock.

One other bot per private Wolf/Noble channel can coordinate alongside each public turn. Human Town and team chat remain open throughout discussion. Night coordination retains two rounds for all team bots. Moderator selection has a two-second limit within the 13-second turn; the player receives the remaining time. A failed, invalid or late moderator choice uses the deterministic fallback, which prioritizes human mentions then rotates by turn count. The first discussion call gets the whole remaining turn (minus a 100 ms delivery margin); voting and night decisions have at most 15 seconds. An early failure can retry once if at least two seconds remain. Timeouts and permanent HTTP request errors are not retried. Empty night-action requests return a legal empty action without calling an LLM. Missing votes/actions safely pass; missing speeches stay silent. No response closes a phase early.

Eight cycles including transition allowance take at most 37 minutes 20 seconds; the default 30-second human connection allowance plus finalization bring the budget to 38 minutes 20 seconds. Longer custom timing/connection settings must still fit the 40-minute limit. Fast policy mode retains its 180-second connection default. Early wins finish sooner. The local lobby wait is outside the gameplay clock. Hosted manifest declares 40 minutes; hosted seating and timeout behavior still need platform validation.

## Player screen

The layout and image assets are adapted from the original Discord `mafia-client` in `tofu-tech`: player cards, day/night backgrounds, role illustrations, village branding, journal and channel controls. The old Discord game-state provider is replaced with the Coworld seat protocol. No Discord login is needed locally. Sounds, Discord avatars and the original animations are not included.

- Your player-card portrait shows your own role. Confirmed teammates and exact private role discoveries update the corresponding portraits; unknown roles keep the sheep artwork. Alignment-only and ambiguous vanilla results do not reveal an exact role. The bottom role area contains your role description, confirmed teammates and the Game setup button. The Game setup guide lists all nine candidate setups for NewD3, including when a fixed setup is selected for testing, role abilities, win conditions and phase timers. It never reveals the selected NewD3 setup or other role assignments. Custom decks list their unassigned composition.
- Talk in Town, Wolves or Nobles as permitted by your role. Private team messages go only to living teammates. Eliminated players can read prior permitted history but cannot post or receive new team messages.
- Original hoofprint stamps mark your locked vote; stamps clear when voting ends; resolved ballot totals remain in the journal. Wolf kills use the original claw scratches; town eliminations use the meat icon.
- Five-second dawn/dusk screens use the original death/no-death artwork. No actions or chat are accepted during these shared pauses.
- During voting, select a card or use the target menu, then **Lock in vote**.
- At night, choose each offered ability and, for Wolves, the killer. Lock all actions together. Sheep can simply wait or mark ready.
- Accepted choices cannot be changed. Reconnect/reload restores the seat, history, accepted choice and original deadline. A disconnect does not pause the game. Only one browser controls a seat at a time.
- Private information and prior ballots appear in the journal. Role visibility follows the server's seat projection. The full role list is revealed only after game over; the live seat never receives the seed.
- Completed results and replay are written under `artifacts/human-*`. The original game-over artwork shows winners, all revealed role cards, and cause-of-death markers. **Watch replay** opens the branded spectator viewer; **Review village** returns to the completed board. Full replay is unavailable while the game is active.

## Protocol and verification

`mode: human` reserves `humanSlot` for authenticated `/human?slot=N&token=T`; policies use `/player`. `/client/player` serves the playable page only for the reserved seat. `wcw.human/1` snapshots contain permitted state; chat carries episode ID, phase key and an idempotency ID. Actions retain the existing `wcw.player/1` binding and legal validation. Chat is limited to 480 characters, one message per two seconds, 30 messages per phase/channel.

Restart the launcher to use scheduler changes; an already-running game keeps its existing code.

Tests cover host rotation, named human replies, twelve public turns, concurrent private chat, fixed phase clocks, short bot deadlines, fallback completion and replay, stale actions/chat, private chat filtering, duplicate messages, reconnects and reserved-seat enforcement, and hung/invalid LLM calls. Browser checks exercise public/private chat, vote locking, two-ability night submission, reload, and desktop/mobile layout.

The launcher prints each opponent’s model; `run.json` records the roster/model assignments and `attempts.jsonl` is written after every attempt, and `calls.json` contains the same attempt records at game end. These include model, request, attempt number, latency, accepted/failed outcome, error category, HTTP status, provider error details, finish reason, generation ID and usage when available. Prompts, raw responses and credentials are not logged. Timeouts may have no HTTP status or usage because no response arrived. Per-model availability and latency still depend on the provider.

## Model output budgets

Mistral: 1,800 tokens and reasoning disabled; Qwen: 1,200 with mandatory reasoning enabled at minimal effort (excluded from the returned content); Gemini: 1,600 with minimal reasoning; DeepSeek/Kimi/GLM: 1,600 with low reasoning; Llama: 800 without a reasoning option; other models: 1,000 with minimal reasoning. These are initial settings, not measured latency guarantees. Dialogue limits remain short. A `length` finish reason is logged as `output_limit`, distinct from invalid actions and network failures. Settings follow [OpenRouter reasoning controls](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens).

Verification uses fake clocks and mocked provider responses, including slow successful calls, hung calls, early repair, exhausted retry budgets, HTTP errors, output truncation and empty night actions. No paid model run was performed for this change.

Qwen regression (2026-09-16): run `human-1789579795920` rejected all 18 Qwen requests with HTTP 400 because reasoning had been disabled. The adapter now enables reasoning for Qwen. A mocked regression test reproduces the rejection; live latency/output sufficiency still needs a subsequent playtest.

## LLM moderator

Each request contains only living/dead public roster status, public speech, turn counts, recent speakers and the latest unanswered public human message. The response contains a living bot slot and a neutral prompt (maximum 240 characters), passed to the selected player and displayed in the action panel. Private faction chat, roles, night decisions and confessionals are never included. The human remains free to chat. Repeated selection of one bot for a third consecutive turn is rejected when alternatives exist.

`moderator.jsonl` records selections, latency, usage and fallbacks. A diagnostic on 2026-09-16 selected Gemini to answer a direct human question in 689 ms; reported cost $0.0002133 (`artifacts/moderator-diagnostic/result.json`). This one successful call does not guarantee every later call meets the budget. Automated tests cover prompt propagation, public-only inputs, eligibility, timeout fallback and cancelled/late results.

### Action and moderator diagnostics (September 16)

The adapter now spells out text limits in both the output schema and instructions,
reports the exact invalid field, and includes legal night targets in repair feedback.
Valid night actions returned in a different order are reordered to match the request;
abilities, targets, and killer nominations are never guessed or replaced.
Rejected model responses are saved as `responseExcerpt` (up to 4,096 characters) in
`attempts.jsonl`. These local diagnostics may contain private game information.

After a missed or declined public turn, a bot rests for two public turns when another
bot is available. Both the LLM host and its fallback respect this restriction.
Host prompts must address the selected player by name, and the host is instructed
not to solicit role claims or interpret missed turns as suspicious behavior.

Qwen remains on minimal reasoning. Its observed provider latency can still exceed
the 13-second cadence; cooldown prevents repeated wasted turns but does not make
that provider faster. The partial run's original malformed response bodies were
not logged, so their exact causes cannot be reconstructed retrospectively.

### Faster seat and Gemini output contract

Human LLM games now replace the benchmark Qwen seat with `openai/gpt-oss-120b`,
named **GPT-OSS**. Other benchmark models, including Gemini Pro, remain unchanged.
`WCW_MODEL` still overrides every bot; `WCW_QWEN_MODEL` overrides only the former
Qwen seat. The benchmark repository itself is unchanged.

Gemini receives a native `json_schema` response format and an action-instance example.
The adapter removes only `$schema: "https://json-schema.org/draft/2020-12/schema"`
and `type: "object"` annotations on an actual action before strict validation.
Schema-only responses, unknown fields, invalid targets, and duplicate keys remain rejected.
Offline replay of the captured Gemini failures recovered five valid annotated actions
and rejected all three schema documents.

Bounded live diagnostics with 36 synthetic speeches on September 16:
- GPT-OSS 120B: valid discussion in 1.184s, valid vote in 0.942s.
- Gemini 3.1 Pro Preview: valid discussion in 8.644s, valid vote in 3.456s.
- Qwen 3.8 Flash with minimal reasoning: both requests exceeded 12.9s, so it was not selected.

These two requests per model are a smoke test, not a reliability guarantee.
Results are in `artifacts/model-diagnostic-1789592674118` and
`artifacts/model-diagnostic-1789592717262`. To repeat these paid checks explicitly,
run `node tools/model-diagnostic.mjs` or add `--replacement-only` for GPT-OSS only.

### Neutral host prompt and DeepSeek cap

The default host prompt gives neutrality precedence over human/player requests.
It explicitly forbids soliciting role claims, setup deductions, night-action promises,
or explanations of technical silence. It uses non-leading invitations and favors
underheard eligible players. Players may still discuss these topics voluntarily.
Three live host probes (Doctor/protection request, mass claim/setup request, and a
silence accusation) all returned neutral invitations. Prompt guidance is not a hard
semantic validator; future moderator logs should still be reviewed.

DeepSeek's output ceiling is now 2,400 tokens (previously 1,600), with low reasoning
and unchanged deadlines. This addresses token truncation, not provider latency.

## All-bot games using the same runtime

```sh
cd /Users/jt/projects/mt-port
WCW_SETUP=random npm run episode:llm -- artifacts/all-bots-mixed-01
```

This now delegates to the same launcher as `play:human -- --llm`: benchmark prompts,
per-seat models (including the GPT-OSS replacement), neutral moderator, Gemini
structured outputs, provider limits, retries, cooldowns, and logs. All nine seats
are bots; the benchmark ChatGPT model fills the seat normally reserved for the
human. It starts automatically and uses the same real-time 13-second cadence and
phase timers. This is a paid game, not an accelerated logical-clock simulation.

The default all-bot server port is 8773 (`WCW_PORT` overrides it), so it can run
alongside a human game on 8772. The printed `/client/global` URL is the live public
spectator view. After completion the process exits and writes `replay.json`,
`results.json`, and `calls.json`, alongside `run.json`, `attempts.jsonl`, and
`moderator.jsonl`. Choose a fresh output folder for each run.

For a free, accelerated check of the same all-bot runtime with scripted players:

```sh
npm run episode:llm -- artifacts/all-bots-smoke-01 --smoke
```

The smoke option never loads API credentials or calls an LLM. `episode:local`
continues to exercise the original fast scripted runtime separately.

## Moderator initialized by the game runtime

Both the packaged `build/game.mjs` entrypoint and the local launcher now initialize
moderation in `startServer` for `human` and `bots` modes. The older `fast` mode keeps
its existing scheduling. The runtime does not read a benchmark checkout or `.env` file;
the local launcher still loads its benchmark environment before starting the server.

Game configuration can set `moderator: "default"`, `"llm"`, or `"auto"` for either
paced mode. An explicit value overrides `WCW_MODERATOR`; omission preserves the
legacy environment behavior. `default` disables model initialization even with
credentials present. `llm` requires usable settings at startup, while turn failures
still fall back. `auto` allows startup fallback. Fast mode rejects `llm` because it
uses bid ranking. See [moderator configuration](../package/readme.md#choosing-the-moderator).

Runtime environment settings:

| Variable | Behavior |
| --- | --- |
| `WCW_MODERATOR` | `auto` (default): LLM if a key is present, otherwise deterministic. `off`: deterministic only. `llm`: require a credential or fail startup. |
| `WCW_MODERATOR_API_KEY` | Dedicated OpenRouter moderator credential; takes precedence over `OPENROUTER_API_KEY`. |
| `OPENROUTER_API_KEY` | Existing shared OpenRouter credential, used if the dedicated key is absent. |
| `OPENROUTER_HOST_MODEL` | Defaults to `openai/gpt-oss-120b`. |
| `OPENROUTER_HOST_PROVIDER` | Defaults to `Cerebras`; an explicitly empty value disables provider preference. |

Inject credentials into the game process at runtime, never into game config, replay,
manifest environment, or image layers. The moderator sees only the public input
projection. Provider errors, invalid selections, and the existing two-second timeout
fall back to deterministic selection without extending the turn. Required-credential
validation happens before the HTTP server starts listening.

Packaged games emit moderator diagnostics as JSON lines to stdout (`event: moderator`).
Local launchers continue saving the same decisions to `moderator.jsonl`. Transport
error details are suppressed to prevent accidental secret disclosure. Scripted local
launches explicitly disable moderation even if the shell contains an API key.

### Bedrock backend

The moderator and policy clients also support Bedrock via the shared adapter.
Hosted-sidecar detection takes precedence in `auto` mode; model IDs must be supplied
using `BEDROCK_MODEL` / `WCW_MODERATOR_BEDROCK_MODEL`. See [Bedrock configuration](bedrock.md)
for explicit provider selection, direct AWS testing, and current verification limits.

## Hosted player connection adapter (2026-09-17)

The player UI accepts the platform-supplied `address` query parameter, following
Coworld's bundled Paint Arena client. It preserves the address's proxy path and
query; HTTP(S) addresses become WS(S). Without `address`, local seat links still
connect to `/human?slot=N&token=T`.

The reserved human seat can connect through authenticated `/player` (the runner's
standard route) or `/human` (the local alias). Both deliver the same private human
snapshots, chat receipts and actions. The browser learns its seat from the server's
`ready`/snapshot messages; the page URL does not need a second copy of slot/token.
The game still requires the correct seat token on the upstream connection, and
rejects duplicate controllers. The platform proxy remains responsible for account
and upstream seat authorization.

Player HTML, CSS, art and replay links now resolve beneath the proxied page path,
rather than assuming the website's origin root is the game. An invalid socket
protocol displays an invalid-link message and disables joining.

Validation: a local reverse proxy at `/api/fixture/proxy/` served the built UI,
injected fixture-only seat credentials upstream, and forwarded WebSocket upgrades
to `/player`. Browser joining, private role display, public chat, bot responses and
reload/reconnect worked with eight scripted policies and `WCW_MODERATOR=off`.
Automated tests cover URL preservation, local compatibility, invalid protocols,
authentication, chat, duplicate controllers and reconnects.

This is proxy compatibility evidence, not a completed Softmax human episode.
The updated game image must be published before production testing. The actual
Softmax invitation/participation flow and proxy authorization still need end-to-end
validation with one human plus eight policies. Do not launch the human variant as
nine policies: seat 0 is reserved for the browser player.

### Spectator proxy and replay lifecycle

The live spectator now honors `address` as well, preserving the supplied WebSocket
path/query. Local `/global` and authenticated inspector `/inspect` fallbacks retain
any HTTP proxy prefix. Browser verification through `/api/fixture/proxy/` displayed
the live episode, nine-player roster and day-one banner instead of “Connecting”.

The packaged entrypoint writes replay and results to `COGAME_SAVE_REPLAY_URI` and
`COGAME_RESULTS_URI`, then exits. Coworld's runner checks required artifacts and
uploads the replay. Persistent replay viewing belongs to Softmax's static viewer,
not the terminated game server. The hosted human end screen now offers **Open Softmax**, which opens
`https://softmax.com/observatory/v2` in a new tab without copying seat credentials.
It explains that the replay becomes available after episode processing and asks
the player to open their completed game. This is an Observatory handoff, not a
direct replay link: the live page has no platform episode-request ID or saved
replay URL. Local games retain their direct **Watch replay** link. End-screen
role reveals use the final private snapshot, without fetching the terminating
server. No server keepalive or lifecycle change is needed.
