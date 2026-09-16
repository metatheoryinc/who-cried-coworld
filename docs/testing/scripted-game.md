# Run the scripted Who Cried Wolf game

## Local process test

Requires Node 24.19.0 and npm 11 (see `.nvmrc`). From the repository root:

```sh
nvm use
npm ci
npm test
npm run typecheck
npm run episode:local -- artifacts/review
```

The last command builds the game and viewer, starts a game plus nine separate
scripted policy processes, and exits after completion. It writes `results.json`,
`replay.json`, config, and per-process logs to `artifacts/review`. It fails if a
process fails or the episode records a fallback. No API keys are needed.

The fixture produces a Town win on day four, three completed nights, 303 replay
events and scores `[1,0,1,1,1,0,1,1,1]`. Scripted dialogue is intentionally basic.
Rules and timeout tests also exercise outcomes other than this fixture.

## Review the replay

Replays start automatically and loop after showing the final result for one
playback interval (1.4 seconds). Pause, stepping, and seeking stop automatic
playback. Explicit `cursor` deep links open paused at the requested event.
Live streams continue following incoming events without looping.

Serve only the built viewer and a copy of the recorded replay:

```sh
cp artifacts/review/replay.json build/viewer/replay.json
python3 -m http.server 8771 --bind 127.0.0.1 --directory build/viewer
```

Open <http://127.0.0.1:8771/?replay=replay.json>. Use Pause, the timeline, and
Reveal private information to inspect the complete episode. The default public
view hides roles and private chat. Expanded evidence shows recorded choices and
rule resolution. A finished replay includes private data by design; the live
public stream does not.

## Coworld Docker test

Requires Docker and the local Coworld CLI. From a checkout with an origin remote:

```sh
DOCKER_DEFAULT_PLATFORM=linux/amd64 coworld build --project . --version 0.1.0
DOCKER_DEFAULT_PLATFORM=linux/amd64 coworld run-episode dist/coworld_manifest.json -o artifacts/coworld --timeout-seconds 120
DOCKER_DEFAULT_PLATFORM=linux/amd64 coworld certify dist/coworld_manifest.json --no-open-report --timeout-seconds 120
```

The fixture uses 100ms decision windows for fast scripted tests; the normal
variant uses 3.5-second windows. Build creates separate game and policy images and
a static replay viewer. Generated outputs are ignored by Git.

If the source has no origin, Coworld build currently fails while collecting Git
metadata. Use a temporary local clone of a committed implementation branch (its
origin will be the local source), install dependencies there, then build. Do not
invent a public source URL. Certification does not publish anything.

## Implementation map

- `src/game/domain`: authoritative rules, random draws, speech floor, requests.
- `src/game/runtime`: session, private observations, WebSocket server, artifacts.
- `src/shared`: versioned schemas, replay validation, shared projections/fold.
- `src/player`: independent scripted policy and socket runner.
- `src/viewer`: functional live/read-only inspector and recorded replay UI.
- `tests`: contracts, rules, session, transport, privacy, and artifact checks.

A future LLM adapter can replace the scripted decision function and emit the same
`wcw.player/1` actions. Human input can use the same authenticated seat boundary;
this milestone does not implement human action controls.

## LLM playtest

```sh
npm run episode:llm -- artifacts/llm-playtest
```

Uses the benchmark repository's `.env` in memory and imports its current default
player personalities, strategy prompt builder, and public host statement builder.
Set `WCW_BENCHMARK_PATH` to change the benchmark location and `WCW_MODEL` to change
the default `google/gemini-3.7-flash`. All seats use that model; contestant names
are personas, not claims that different model providers played. Calls use the
benchmark OpenRouter key and throughput routing. This incurs API usage charges.

This behavioral harness runs the authoritative Session with a logical clock,
waiting for model responses before advancing the game. It does not validate
the configured Coworld wall-clock action budget. Each API call has a 45-second
limit and each decision gets at most one repair attempt. Unresolved decisions
use the game's recorded legal fallback. No scripted strategic decisions replace
model decisions. Inspect `report.json` to verify the actual failure count.

`replay.json` is the standard complete game replay. `host.json` contains public
host announcements supplied to players; narration is a separate sidecar and is
not yet displayed by the standard viewer. `calls.jsonl` records model, latency,
and provider-reported usage, without keys or request headers. `partial-journal.json`
is an internal debugging artifact with hidden roles and private events; it is
post-game evidence and must not be served to live players.

For all roles and NewD3 setups, see [NewD3 configuration and behavior](newd3.md). The historical fixture outcome above was recorded before the rules/2 role port.
