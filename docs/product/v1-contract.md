# Who Cried Wolf Coworld v1 Product Contract

Status: Accepted for implementation on 2026-09-15.

## Outcome

Ship a replay-first Coworld social-deduction game in which nine independently packaged agent policies play a complete Who Cried Wolf episode and viewers can follow the public conversation, bounded deliberations, votes, night actions, and eventual reveal.

## Product mode

- Coworld player policies are independently replaceable and submitted.
- The repository includes a personality-rich baseline cast inspired by the benchmark's show mode.
- Model/provider identity is configuration, not game logic or seat identity.
- The game container is the only authority for rules, legal actions, phase transitions, results, and audience projections.

## Initial ruleset

The fixed nine-seat v1 role mix is:

- 1 Wolf
- 1 Alchemist, using the role-blocking behavior
- 1 Seer
- 1 Guard
- 5 Sheep

Faction victory is the scored result. Behavioral, cooperation, deception, and pacing measurements are diagnostics and do not alter incentives in v1.

## Viewer contract

- Local live play uses Coworld's supported `coworld play` path.
- Hosted v1 is replay-first; a public hosted live lobby is out of scope.
- The live projection exposes public phase state, public chat, declared accusations, votes, eliminations, and public player status.
- The completed replay may reveal roles, private Wolf chat, bounded confessionals, night choices and outcomes, discarded speaking bids, and failures or fallbacks.
- Raw hidden chain-of-thought is never requested, persisted, or displayed. Deliberation means explicit bounded summaries, reasons, intentions, and confessionals produced for the game.
- Live and replay modes share one presentation model and renderer. Reveal is a declared property of episode events, not a separate renderer.
- Static replay export uses an explicit allowlist. Viewer controls manage spoiler timing but are never a secrecy boundary.

## Reliability contract

- Every player interaction uses a versioned typed observation/action protocol.
- Invalid, malformed, refused, or timed-out actions resolve through deterministic legal fallbacks and remain visible in diagnostic events.
- Seeds make game-controlled randomness reproducible.
- Episodes have a configurable day cap, defaulting to eight days. If neither faction has won at the cap, the episode ends in a draw and every policy receives score `0`.
- Provider failures cannot corrupt authoritative game state or prevent an episode from completing.
- Audience filtering occurs before data reaches a viewer projection.

## Repository and reuse boundary

- Implementation lives in `/Users/jt/projects/mt-port` as a standalone Coworld game package.
- Reuse Tofu Tech rules, terminology, and only verified licensed assets selectively; do not import its Nakama, Discord, FanForge, analytics, or monorepo coupling.
- Adapt benchmark prompt structure, personality context, typed responses, public floor control, sequential Wolf chat, and retry semantics without making its centralized showrunner authoritative.
- Follow the Coworld package contracts and hosted credential path.

## v1 acceptance

v1 is complete only when:

1. a deterministic nine-seat baseline episode finishes and replays identically from its recorded events;
2. independently packaged behavior-rich policies can replace baseline policies without changing the game container;
3. public live projection cannot expose private information;
4. post-game replay reveals configured private events without exposing hidden chain-of-thought;
5. timeouts and malformed policies still produce a legal completed episode;
6. the shared spectator renderer works for both live and replay projections;
7. Coworld build, episode, play, certification, and one supported hosted experience path are verified.

## Deferred

- Full Tofu role parity
- ~~Mixed human and AI seats~~ — delivered after v1; see [Post-v1 additions](#post-v1-additions)
- Public hosted live theater or producer controls
- Richer competitive scoring
- Unverified Tofu asset-tree reuse

## Post-v1 additions

These extend the accepted v1 scope. They do not change the v1 acceptance criteria above.

- **Mixed human and AI seats (2026-09-24).** `mode: human` accepts one to nine authenticated human browsers; policies fill the remaining seats. Each seat's token determines its identity. Humans receive the same projected observations and legal actions as policies. Verified locally; hosted multi-human lobby play is not yet verified.
- **Optional LLM floor moderator (2026-09-22).** Human-paced variants offer a classic deterministic host (`human`) or an LLM host (`human-llm`). The LLM host sees only public information, chooses only eligible non-human speakers, and falls back to the deterministic host on any failure. It never affects rules, legality, or results.
