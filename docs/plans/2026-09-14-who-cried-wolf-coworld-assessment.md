# Who Cried Wolf Coworld Port Assessment

**Status:** Feasibility assessment; implementation design is not yet approved.

## Outcome

Who Cried Wolf can become a Coworld without changing the core Coworld package if the first hosted showcase is a completed episode replay. Coworld already provides the required game and player container model, game-owned WebSocket protocols, results and replay artifacts, local browser play, certification, and hosted tournament episodes.

The recommended implementation is a standalone Coworld project that selectively combines:

- Who Cried Wolf's tested rules, theme, art, and presentation assets;
- the AI Mafia show's structured agent prompts, floor control, private conversations, and deterministic judge boundaries; and
- Coworld's runtime, player isolation, artifact, replay, and certification contracts.

A public live hosted theater is separate platform scope because Coworld currently supports hosted tournament episodes rather than a supported hosted game-only lobby. Local live viewing is supported through `coworld play`; hosted replay viewing is supported after the episode.

## Evidence from the three repositories

### Who Cried Wolf in Tofu Tech

The portable boundary is the game domain, not the current hosting stack.

- The authoritative rules are an XState machine with lobby, day, night, phase-summary, and results states: `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/machine/mafia-state-machine.ts`.
- Eleven themed roles, alignments, and abilities already exist: `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/shared/types/player-roles.ts`.
- Per-seat state projections already obscure other roles and private game history: `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/match-machine-helpers/state-sync.ts`.
- The existing bots are random, silent, and memoryless. They are not LLM agents: `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/machine/handlers/bot-handler.ts`.
- Chat is routed by audience but stored only in receiving browser state. It is not a durable transcript and therefore cannot drive reconnect, replay, or an omniscient post-game presentation.
- The UI and game packages depend heavily on the Tofu workspace, Nakama, FanForge, Discord identity, analytics, and Cloudflare Durable Objects. Reuse visual assets and selected components rather than importing the packages wholesale.

### Behavior-rich AI Mafia show

The useful reference is the repository's show mode. Its benchmark mode intentionally anonymizes players and removes personality prompts.

The transferable behavior kernel is:

1. Each model receives a bounded role, ability, win condition, personality, strategic bias, phase, audience, living/dead roster, vote history, private ledger, and recent visible transcript.
2. Each response uses a narrow typed contract: `wants_to_respond`, `urgency`, `reason`, `message`, and `target`.
3. Public agents bid concurrently for the floor; a controller rewards direct replies, fresh voices, evidence, concision, and non-repetition.
4. Mafia conversations run sequentially so each reply sees the previous private reply and can converge on a plan.
5. Votes and night actions are forced, typed requests resolved by deterministic domain code.
6. The host model may choose a speaker or add presentation language, but it cannot mutate game truth.
7. One audience-tagged event log drives public, Mafia, confessional, host, bid, and export surfaces.
8. Provider errors become visible error bids and valid fallback actions rather than being disguised as strategic silence.

Relevant sources are under:

- `/Users/jt/projects/mafia-who-cried-wolf-benchmark/packages/engine/src/llm/openRouterProtocol.ts`
- `/Users/jt/projects/mafia-who-cried-wolf-benchmark/packages/engine/src/domain/floorController.ts`
- `/Users/jt/projects/mafia-who-cried-wolf-benchmark/packages/engine/src/orchestration/runners.ts`
- `/Users/jt/projects/mafia-who-cried-wolf-benchmark/apps/web/src/App.tsx`

The exact chat volume should not be copied. A recent show run contained substantially more Mafia messages than public messages, so the port needs tighter phase budgets and convergence limits.

### Coworld

Coworld requires one game container and launches one player container per scheduled seat. The game owns the JSON protocol and browser clients.

- The game serves `/healthz`, `/player`, `/global`, `/client/player`, `/client/global`, and replay routes or a static replay bundle.
- The game writes validated results and opaque replay bytes.
- The game config can define variable player counts and injected display names.
- Hosted player policies can call Bedrock through the per-pod sidecar.
- The game container can call Bedrock for host/showrunner work while remaining separate from the deterministic judge.
- The static replay viewer is an opaque game-owned browser bundle, making it the strongest hosted presentation seam.

Primary contracts:

- `/Users/jt/projects/coworld/src/coworld/docs/roles/GAME.md`
- `/Users/jt/projects/coworld/src/coworld/docs/roles/PLAYER.md`
- `/Users/jt/projects/coworld/src/coworld/docs/BEDROCK.md`
- `/Users/jt/projects/coworld/src/coworld/docs/STATIC_REPLAY_VIEWERS.md`
- `/Users/jt/projects/coworld/src/coworld/docs/AUTHORING.md`

## Recommended first version

Use the nine-player AI Mafia lineup mapped onto existing Who Cried Wolf roles:

| AI Mafia role | Who Cried Wolf role | Count |
| --- | --- | ---: |
| Mafia Goon | Wolf | 1 |
| Mafia Roleblocker | Alchemist | 1 |
| Town Cop | Seer | 1 |
| Town Doctor | Guard | 1 |
| Vanilla Townie | Sheep | 5 |

This creates a coherent first Coworld while deferring Chef, Dairy Maid, Priest, Noble, Track Reader, and Trickster until the core protocol and replay are proven.

## Recommended target architecture

### Game container

The game container owns seeded role assignment, legal state transitions, deadlines, audience projection, floor arbitration, victory, and episode artifacts. LLMs never mutate authoritative state.

### Player policy containers

Each seat runs an independently replaceable Coworld player policy. The game sends only that seat's permitted observation. The policy returns one structured bid, utterance, vote, night action, or pass. Every wait is bounded and every failure has a legal fallback.

### Typed episode event log

The game records one append-only source of episode truth containing:

- phase changes;
- public, Mafia, and confessional speech;
- proposed and rejected response bids;
- bounded deliberation summaries;
- votes and night actions;
- private results and final reveals;
- deaths and victory;
- provider failures and fallbacks.

The transcript is projected by audience. The server derives channel access from authenticated seat, role, and phase rather than trusting a player-supplied channel name.

### Live and replay presentation

The live global viewer and static replay viewer share one presentation model and renderer. The primary surface should show player cards, alive/dead state, active speaker, public conversation, phase, votes, accusations, and eliminations.

During play, the global stream contains public events only. After completion, the replay may reveal roles, Mafia chat, confessionals, discarded bids, and explicitly authored deliberation summaries. Raw chain-of-thought, system prompts, and provider diagnostics are not public replay content.

## Alternatives considered

1. **Distributed Coworld player policies — recommended.** Preserves independent policy improvement, player isolation, hosted attribution, and tournament compatibility.
2. **Centralized showrunner in the game container.** Fastest way to reproduce the benchmark, but makes Coworld player containers ceremonial and weakens the policy-development loop.
3. **Lift the complete Tofu game into Coworld.** Highest initial feature parity, but carries substantial Nakama, Discord, FanForge, analytics, and workspace coupling.

## Implementation workstreams

1. Settle the initial product mode, visibility policy, scoring, and repository boundary.
2. Extract or adapt the deterministic game rules and add Coworld's game server contract.
3. Define the versioned player protocol and implement a deterministic non-LLM baseline.
4. Adapt the show-mode agent policy to Coworld player containers and hosted Bedrock.
5. Add the floor controller and optional non-authoritative host model.
6. Define the reveal-state model and spectator information architecture before projection behavior is fixed in code.
7. Build the audience-tagged event log, results, replay, and redaction projections.
8. Build the shared live/replay spectator experience using selected Who Cried Wolf assets.
9. Add the manifest, Docker/Compose build, protocol docs, variants, and certification fixture.
10. Prove deterministic seeds, redaction, timeout and malformed-player fallback, full nine-seat play, replay parity, `coworld build`, `run-episode`, `play`, `certify`, and one hosted experience run.

## Estimate

| Workstream | Estimated effort |
| --- | ---: |
| Product and protocol decisions | 3–5 engineer-days |
| Reveal-state model and spectator information architecture | 3–5 designer-days |
| Game runtime and Coworld adapter | 1.5–2.5 engineer-weeks |
| Agent policy and reliability | 1–2 engineer-weeks |
| Spectator and replay UI | 1.5–2.5 engineer-weeks |
| Packaging, certification, and hosted proof | About 1 engineer-week |

The replay-first nine-agent version is approximately **5–8 engineer-weeks plus 3–5 designer-days**, or roughly **3–5 calendar weeks with independent engineering and design work proceeding in parallel**. Full role parity, mixed human/AI seats, and a public live hosted theater are separate follow-on arcs.

## Principal risks and open decisions

- **Product mode:** independently submitted Coworld policies versus a fixed cast of named models presented as a show.
- **Visibility:** public live state versus post-game omniscient reveal. An authenticated live producer view would require additional platform work.
- **Scoring:** binary faction victory is simple and honest; richer cooperation or deception measures should be diagnostic/reporting outputs unless their incentives are validated.
- **Model portability:** the benchmark uses OpenRouter, while hosted Coworld policies should use the Bedrock sidecar or another explicitly supported credential path.
- **Asset scope:** reuse only referenced, licensed assets; avoid carrying the large apparently unused high-resolution image tree.
- **Behavior pacing:** cap discussion rounds, private-chat turns, retries, and token budgets so nine LLM seats finish comfortably inside Coworld's episode deadline.

## Product decision

The accepted v1 direction is independently submitted Coworld policies with a polished replay-first spectator experience and a bundled show-style baseline cast. This preserves Coworld's policy-improvement loop without giving up the presentation value. The complete contract is recorded in `docs/product/v1-contract.md`.
