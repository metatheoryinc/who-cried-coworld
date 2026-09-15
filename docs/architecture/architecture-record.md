# Architecture Record

Maintainer: [Who Cried Wolf Architect](agent:mt-port-architect).

## Convention and authority

This is the canonical entry point for architectural guidance. Organize decisions by stable concern, with status, rationale, consequences, and supersession here; keep exact wire contracts in the linked design. Statuses are **Accepted**, **Proposed**, **Superseded**, and **Declined**. A changed decision replaces its prior guidance explicitly. Implementation divergence alone does not amend a decision.

The [v1 product contract](../product/v1-contract.md) is accepted product direction. Local technical decisions are delegated to the team; [Engineering Manager](agent:engineering-manager-4) reconciles this design with runtime, rules, and spectator work before production implementation. The Architect advises and maintains this record, without owning implementation acceptance or correctness certification.

## Current guidance

| Concern | Decision | Status | Earlier guidance |
| --- | --- | --- | --- |
| State and events | Game process owns one state; append-only events are derived evidence | Accepted product/task constraint | Clarifies assessment's ambiguous “source of episode truth” |
| Policy/runtime | One replaceable Coworld policy container per seat; no centralized model player | Accepted product contract | Selects assessment's distributed option |
| Visibility | Server projects before delivery; export allowlists post-game replay content | Accepted product contract | Narrows assessment's omniscient replay wording |
| Presentation | Shared event projection, presentation fold, and renderer; replay does not execute game mechanics | Proposed technical design | Selects event presentation option from Coworld static viewer contract |
| Packaging | One root TypeScript package, one lockfile, one Dockerfile with game/player targets, static bundle | Accepted Manager decision | Replaces wholesale Tofu/benchmark imports |
| Failure/time | Bounded requests/fallbacks; maxDays defaults to 8, then draw with all scores 0 | Day cap accepted; budget details proposed | Closes unbounded abstention gap in source games |
| Night resolution | Block first; discard blocked kill nominations; seeded sorted-target tie break; no last-voter actor | Accepted Manager decision | Replaces Tofu arrival-order execution |
| Protocol | Strict `wcw.player/1`, `wcw.events/1`, `wcw.replay/1` | Proposed technical design | No backward compatibility obligation to source protocols |

Exact design: [Who Cried Wolf Coworld system and protocol](../plans/2026-09-15-who-cried-wolf-coworld-design.md).
Historical context: [port assessment](../plans/2026-09-14-who-cried-wolf-coworld-assessment.md). Its effort estimate and proposals are historical evidence, not an additional governing design.

## State and episode evidence

**Context:** The assessment calls the event log a source of episode truth, while the accepted contract makes the game container the only authority.

**Decision:** One deterministic game transition function owns roles, legal choices, phase changes, results, and pending requests. It returns new state and derived events together. An append-only journal records those events for observations and presentation. Neither a transcript fold nor a viewer may resolve votes, determine death, or replace game state. Scoring artifacts are derived from terminal game state.

**Reasoning and consequences:** This avoids two competing judges and does not require an event-sourcing framework, database, message bus, or browser implementation of rules. An episode process crash is an infrastructure failure; resuming games from the journal is outside v1. Reconstructing presentation from events is supported and distinct from resuming authoritative gameplay. Journal/export failure cannot be disguised as a successful complete replay.

## Policy and runtime ownership

**Context:** The benchmark owns all model calls centrally; Coworld's improvement loop substitutes policies per seat.

**Decision:** The game validates typed requests/responses and arbitrates the floor; each policy owns its provider, prompts, personality, retries, and local memory. The baseline is replaceable through the same protocol. No model can mutate game state, interpret an invalid action into legality, or control phase progression. Use deterministic narration for v1; an optional model host would add cost without an accepted need.

**Tradeoff:** A slightly larger protocol buys independent policy authorship and attribution. No game import of provider packages, source workspace dependencies, or submitted policy images. Coworld owns pod scheduling and infrastructure failures, which game fallbacks cannot repair.

## Audience and reveal

**Context:** Hidden roles and private plans are essential during play. Static replay bytes are publicly served by Coworld after the episode.

**Decision:** Trusted game code assigns each event's live audience and post-game reveal category. Live player/global data is filtered before serialization. Export emits only replay-approved fields and events after a terminal state; raw model output, hidden reasoning, prompts, credentials, and provider diagnostics are excluded. The same presentation model covers public and revealed views. Spoiler controls are presentation preferences, not access control over already downloaded replay bytes.

**Tradeoff:** Allowlisted bounded authored summaries are useful and publishable; arbitrary provider objects are not. The game cannot prove that a third-party policy's text contains no internal reasoning, nor control its private implementation or platform-owned logs. The bundled policy must never request or save hidden reasoning; the game accepts only explicit game-facing fields and never copies arbitrary payloads into artifacts.

## Package and compatibility

**Context:** Both reuse sources are TypeScript, but coupled to incompatible hosts. Coworld's protocol is language agnostic.

**Decision (Manager, 2026-09-15):** Use one root TypeScript package organized as `src/shared`, `src/game`, `src/player`, and `src/viewer`, one `package-lock.json`, one Dockerfile with game/player targets, and one shared browser application. Separate workspace packages are not justified by this bounded game. Designer ownership of renderer/components remains intact. Import selected rules and verified assets by adaptation with source/license attribution, not by runtime dependency on either source project. Keep Coworld manifest and URI handling at the boundary. Version game, wire, events, and replay explicitly; reject unsupported versions rather than introducing speculative translators.

**Alternatives declined:** Whole Tofu lift carries Nakama/Discord/FanForge coupling; centralized benchmark hosting defeats policy replacement; event-sourced game plus browser rules engine adds a second reconstruction concern without a v1 recovery need. A database or separate projection service is not earned for a bounded nine-seat episode.

## Bounded termination and night resolution

**Decision (Manager, 2026-09-15):** `maxDays` is configurable and defaults to 8. Check normal victory after Night 8 (or configured cap), then declare a draw with zero scores for all seats if no faction won. Bound phase/action budgets beneath Coworld's episode deadline. This closes the indefinite-abstention failure class without inventing a faction victory. A process/storage/platform failure remains a failure, not a draw.

Resolve Alchemist blocks first; remove blocked actors' kill nominations before tallying. Living Wolf and Alchemist nominate; select a tied target using labeled seeded randomness over sorted targets; no valid nomination means no kill. This explicitly supersedes Tofu's last-arriving kill actor. The tradeoff is a documented parity deviation in return for reproducible simultaneous actions.

## Open reconciliation

- Remaining exact deterministic rules, including final-response locking and inspection outcomes, must agree with the rules-parity specification. A timeout cannot claim a faction won when no victory condition holds.
- Align package paths and manifest packaging with runtime reconnaissance, and reveal fields with spectator design.
- Fixed public night duration prevents private actor count/response timing from becoming an unintended observation. This costs idle time and must fit the hosted deadline.
- Hosted startup failures and the public replay/tooling boundaries remain platform limitations; local completion is not hosted proof.

Maintainers update this record and the detailed design together when these settle. Program status stays in `project/current-program` and `project/active-assignments`.
