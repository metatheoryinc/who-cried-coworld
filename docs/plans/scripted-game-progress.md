# Complete game with scripted policies

Implemented September 15, 2026 on `codex/scripted-game`, then copied into the main
workspace for review. See [running the game](../testing/scripted-game.md).

## Delivered

- Nine seats: Wolf, Alchemist, Seer, Guard, and five Sheep. Seeded role assignment,
  public speech floor, strict-majority voting, private Wolf chat, roleblock,
  protection, faction kill, inspection, faction victory, and bounded day-cap draw.
- Strict versioned action, observation, event, result, and replay schemas. Actions
  are authenticated to seats and bound to requests. First valid response locks;
  invalid responses get one retry without extending the deadline, then a legal
  pass. Missing/disconnected players also fall back safely.
- Public and seat-private event projections, bounded observations, terminal
  results, and post-game replay. Raw malformed input is not recorded.
- One authoritative game process and nine independent scripted policy processes.
  Policy decisions use observations only. No provider keys or LLM calls are used.
- Static replay viewer with playback, seeking, speed, public/reveal views, chats,
  votes, private choices, and results. The new runtime viewer is deliberately a
  functional test UI; the illustrated design prototype remains separate.
- Docker game/player images, generated Coworld manifest, certification policies,
  and static replay bundle.

## Evidence

- 117 tests pass, including rules, schemas, deterministic randomness, request
  fallbacks, projection privacy, session completion, real WebSocket policies,
  silent/malformed players, and file/HTTP artifact handling. TypeScript passes.
- Local Node run: `artifacts/local-1789513584196/`, Town victory after three resolved
  nights (day-four vote), 303 replay events, zero failure events, ten clean exits.
- Docker Coworld run: `artifacts/coworld-first/`, same result and zero failures.
- Coworld certification: all 10 executable checks pass. Evidence copied to
  `artifacts/certification/`. Static replay bundle declaration passes; Coworld
  explicitly skips its container replay liveness probe for this mode.
- Browser review verifies playback, pause, terminal seek, public role hiding,
  post-game roles/private chat, and responsive layout.

Outputs are ignored machine-local artifacts; rerun the commands to regenerate.
Certification used a temporary local clone because Coworld build requires an
origin remote, while this repository has none. The clone points to the local
implementation worktree; nothing was published or pushed.

## Scope boundaries

This completes the scripted-policy milestone. LLM adapters using personal API
credits, differing personas, human input controls, hosted publication, and visual
integration with the illustrated prototype remain subsequent work. The seat
protocol is independent of those policy implementations. This is local executable
certification, not confirmation of acceptance onto the hosted platform.
