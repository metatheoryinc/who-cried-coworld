> Historical rules/1 contract. The [NewD3 role port](newd3.md) supersedes fixed role composition, kill nomination semantics, chat scheduling, and timing below.

# Who Cried Wolf Coworld v1 rules parity and verification specification

Status: normative, reconciled input to Task 4 TDD. The accepted architecture owns wire and component boundaries; this specification supplies the detailed deterministic rules and verification cases.

## Purpose and authority

This document defines the deterministic game behavior that the v1 judge must implement and the tests that must prove it. It is intentionally narrower than a protocol or UI design: the architecture record owns transport envelopes and durable component boundaries, while this document owns rules, legal outcomes, deterministic choices, and observable secrecy behavior.

Normative words such as **must**, **must not**, and **may** describe v1 requirements. When a reference implementation differs from this document, the explicit v1 divergence in this document wins.

Source precedence is:

1. the accepted [v1 product contract](../product/v1-contract.md);
2. manager-settled decisions recorded here, including the bounded draw rule;
3. the accepted [architecture record](../architecture/architecture-record.md), [system/protocol design](../plans/2026-09-15-who-cried-wolf-coworld-design.md), and [reveal/spectator design](../design/reveal-and-spectator-design.md) for envelopes, runtime boundaries, projection, and settled orchestration mechanics;
4. this specification for reconciled detailed rules and expected outcomes;
5. current Tofu Who Cried Wolf domain behavior as rules evidence;
6. the AI Mafia benchmark domain as behavior and deterministic-judge evidence.

The inspected source snapshots were:

- Tofu Tech commit `bd90913c4b506eda1985c78a4a5f85191a8158c5`;
- AI Mafia benchmark commit `efc993dd9beb762628acf6c3e9a3cb32198b2a06`;
- this repository's accepted product-contract base commit `53c4ce0`;
- accepted architecture/protocol through main commit `ab69fea`, and reveal/spectator reconciliation through main commit `8d33451`.

No Nakama, Discord, FanForge, analytics, provider, or centralized-showrunner behavior is normative for the Coworld judge.

## Fixed v1 setup

### Seats and roles

An episode has exactly nine distinct seats. Seat identity is stable and independent of model or provider configuration.

| Count | Role | Faction | Night capability |
| ---: | --- | --- | --- |
| 1 | Wolf | Wolf (Mafia-aligned) | One faction-kill nomination |
| 1 | Alchemist | Wolf (Mafia-aligned) | One faction-kill nomination and one roleblock |
| 1 | Seer | Town | One alignment inspection |
| 1 | Guard | Town | One protection |
| 5 | Sheep | Town | None |

The Alchemist remains a full Wolf-faction member. It knows the Wolf, joins private Wolf discussion, nominates a kill target, and independently chooses a roleblock target. The two targets may be the same. This preserves Tofu's Mafia-aligned Alchemist behavior rather than reducing the seat to a ceremonial blocker.

Every seat receives its own exact role, faction, ability, and win condition. The Wolf and Alchemist receive each other's slot and exact role as initial knowledge. Town seats receive no other role information except the Seer's later private alignment results.

### Seeded role assignment

The game may receive a 128-bit seed encoded as exactly 32 lowercase hexadecimal digits. If omitted, the game obtains a fresh 128-bit seed from the operating system before role assignment and records it as private authoritative state. Game-controlled choices must not depend on wall-clock time, process-local random state, object iteration order, request completion order, or provider behavior.

All random draws use `sha256-counter/1`, refined here from the architecture recommendation:

1. Each label has an independent decimal counter initialized to 0.
2. For an integer draw in `[0, n)`, compute SHA-256 over the UTF-8 string `<seed>:<label>:<counter>` and read the first four digest bytes as an unsigned 32-bit big-endian integer `x`.
3. Increment the label's counter on every attempt, including a rejected attempt.
4. Let `limit = floor(2^32 / n) * n`. Reject `x >= limit` and repeat; otherwise return `x % n`.

Role assignment starts with `[wolf, alchemist, seer, guard, sheep, sheep, sheep, sheep, sheep]`, performs Fisher-Yates from `i=8` down through `i=1`, draws `j` uniformly from `[0, i]` using label `roles`, and assigns the shuffled array to slots 0 through 8 in ascending order.

The seed and all random counters are secret from live projections because publishing them would reveal or predict reproducible hidden choices. The seed becomes revealable only after the episode is terminal; counters never need to be public.

For the canonical fixture `seed=000102030405060708090a0b0c0d0e0f`, slots map as follows:

| Slot | Role |
| --- | --- |
| 1 | Wolf |
| 5 | Alchemist |
| 7 | Seer |
| 4 | Guard |
| 0, 2, 3, 6, 8 | Sheep |

Tests other than assignment tests may bypass assignment and use the named `standard-nine` fixture:

`0=Wolf, 1=Alchemist, 2=Seer, 3=Guard, 4..8=Sheep`, in ascending canonical slot order. Tests may use `W`, `A`, `S`, `G`, and `T1..T5` as readable aliases for those slots.

## Canonical state and phase flow

The judge is the only authority for current phase, living status, admitted actions, resolution, faction result, and draw result. A policy response is only a proposal until validated and recorded by the judge.

The semantic phase graph is:

```text
setup
  -> day.discussion
  -> day.vote
  -> day.resolve
       -> terminal (faction victory)
       -> night.wolf-discussion
  -> night.actions
  -> night.resolve
       -> terminal (faction victory)
       -> terminal (draw after Night maxDays)
       -> next day.discussion
```

The episode begins on Day 1. It does not open with a playable night. This follows the current Tofu state machine; older Tofu tests that still narrate a first night are stale relative to that production transition.

The default `maxDays` is 8 and must be configurable as an integer from 1 through 32. A cycle is Day N followed, if no faction has already won, by Night N. After Night `maxDays` resolves, the judge checks faction victory first. If neither faction has won, it emits a draw and never enters Day `maxDays + 1`. Hosted configuration must also satisfy the architecture's total 978-second budget formula; the standard eight-second preset therefore permits at most eight days.

Faction victory is checked immediately after each `day.resolve` and `night.resolve`. No discussion, vote, or action window opens after a terminal result.

### Bounded windows

The v1 defaults are:

| Window | Count per cycle | Deadline per window |
| --- | ---: | ---: |
| Public discussion floor | 6 | 8 seconds |
| Sequential Wolf discussion | 4 | 8 seconds |
| Day vote | 1 | 8 seconds |
| Night actions | 1 | 8 seconds |

This is at most 96 seconds of policy-facing windows per complete cycle. Connection and finalization budgets belong to the architecture record; the current design target is 180 seconds for connection and 30 seconds for finalization, yielding a 978-second upper bound for eight complete cycles before platform overhead.

An individual request may reach a terminal accepted-or-fallback state early, but its batch resolves only at the fixed window boundary. The public phase duration must not shrink when roles die, policies answer early, or fewer actors are eligible; otherwise timing becomes a role/activity side channel. Timeouts are game inputs recorded as diagnostic events, not reasons to extend a phase.

## Action admission

Every action must be associated with the authenticated seat and an outstanding request ID. The game derives actor, phase, role, faction, and available actions from authoritative state; it must not trust corresponding policy-supplied claims.

All actions share these admission rules:

- the request is outstanding and belongs to the authenticated seat;
- the action kind is allowed by the current phase and the seat's authoritative role;
- the actor was living when the window opened and remains eligible for that action;
- each referenced target exists and is living;
- each role-action target is a seat other than the actor;
- a kill target is Town-aligned, never Wolf or Alchemist;
- the first admitted valid response is final for its request ID;
- an identical retransmission is idempotent, while a changed retransmission is rejected;
- a late response cannot change state;
- malformed payloads never enter domain state.

The day vote is the one exception to the non-self-target rule: a living player may vote for itself. A vote target is any living slot or `null` abstention.

The action window requests one role-shaped response from each living seat:

| Role | Required typed fields |
| --- | --- |
| Wolf | one `kill` row with target slot or `null` pass |
| Alchemist | one `kill` row and one `block` row, each with target slot or `null` pass |
| Seer | one `inspect` row with target slot or `null` pass |
| Guard | one `protect` row with target slot or `null` pass |
| Sheep | an empty action list |

All living seats receive the composite night request at the same public-relative time. A response must contain exactly the offered abilities in the offered order with no duplicates. For the Alchemist, one omitted or illegal row invalidates the composite response; after retry exhaustion both fields receive their deterministic pass fallback. The judge never silently admits half of a malformed composite response.

## Day discussion and floor control

Each of the six public windows asks every living player for one typed bid concurrently. Dead players are never eligible. Request completion order must not influence the result.

A valid bid contains boolean `wantsToSpeak`, integer `urgency` in `[0, 3]`, bounded `reason` and `text` fields, plus optional typed `replyTo` and `accusation` references. `wantsToSpeak=false` is a valid pass and requires empty text, null reply/accusation, and urgency 0. A speaking bid requires nonempty text. All admitted bids, including discarded bids, are durable revealable episode events; only the selected text enters the public live transcript.

`replyTo` must be null or identify a speech event visible to that seat. `accusation` must be null or name another living slot. Neither field changes rules state; accusation is explicit presentation metadata, not an inferred vote.

Before ranking, exclude a bid when the seat has already spoken twice that day or its trimmed, lowercased text exactly repeats one of that seat's five most recent public messages. Rank the remaining `wantsToSpeak=true` bids lexicographically by:

1. ascending number of times the seat has spoken this day;
2. a valid direct reply to the last public speech before a bid without that reply;
3. urgency descending;
4. rotating priority `((slot - ((day - 1 + window) % 9)) + 9) % 9` ascending.

Discussion windows are numbered 0 through 5. The rank is a tuple comparison, not a weighted score, and text keywords never affect it. If no eligible bid wants to speak, the window records only unselected bids and emits no public speech. The window still counts toward the six-window bound.

The floor controller may select speech but cannot submit votes, choose targets, change status, or declare results. A host may add public transition copy, but host output has the same non-authoritative restriction.

## Voting and elimination

At `day.vote`, every living seat receives one private vote request concurrently. Votes remain private until the window closes; the public reveal then lists every accepted vote or abstention in ascending slot order. The first valid response is final, deliberately replacing Tofu's mutable pre-lock vote/cancel behavior so response arrival timing cannot become authority.

The fallback for any missing terminal vote is a `null` abstention. Abstentions do not count toward any candidate.

Let `L` be the number of living players when the vote window opens. Elimination requires a unique candidate with at least `floor(L / 2) + 1` votes.

- A unique leader at or above the threshold is eliminated.
- A unique leader below the threshold produces `no_majority` and no elimination.
- Equal top counts produce `tie` and no elimination, even though they necessarily also lack a strict majority.
- All abstentions or fallbacks produce `all_abstain` and no elimination.

The explicit `tie` classification improves event truth over Tofu's branch ordering, which labels below-majority ties as `no-majority`; the elimination outcome is unchanged.

An eliminated player becomes dead with public cause `vote`. Its role and faction remain hidden in all live public projections.

## Wolf discussion and night actions

If the game continues after the day result, determine the living Wolf-faction slots in ascending order and run two rounds over that fixed list. Each living actor therefore receives exactly two sequential Wolf-discussion turns. If both faction seats live, actor order is the lower slot, higher slot, lower slot, higher slot. If one survives, actor order is survivor, survivor, idle, idle. The schedule always contains four private windows; unused windows remain silent rather than giving the survivor extra turns. Each new actor response observes every prior admitted Wolf message. A pass or failure consumes its allotted actor turn without a message.

The externally observable night schedule remains four eight-second Wolf windows plus one eight-second action window even when a Wolf-faction seat is dead or all requests become terminal early. Public events must not reveal which actor owned or answered a private window.

Wolf discussion is advisory. Text cannot itself choose a kill, roleblock, or any other rule action. Only the later typed action response can do so.

### Faction-kill selection

After roleblock status is known, the judge gathers valid non-null kill nominations from living Wolf-faction actors that are not blocked. Null nominations are ignored. The candidate with the most nominations becomes the faction-kill target.

If top candidates tie, sort their slots ascending and draw one index with `sha256-counter/1` under label `kill_tie_day_<dayNumber>`. Under the explicit `standard-nine` roster, seed `000102030405060708090a0b0c0d0e0f`, Day 1, and tied target slots `[4, 5]`, the draw selects slot 4. No target is selected when all valid nominations are `null` or no unblocked Wolf-faction nomination remains.

### Resolution order

All eligibility is based on the living roster at the opening of `night.actions`, except where the explicit sequence below suppresses a later effect. The judge resolves exactly once in this order:

1. **Roleblock.** An admitted Alchemist target becomes blocked. The Alchemist ability is roleblock-immune, matching Tofu. In the fixed v1 set self-targeting is illegal, so that immunity is observable only as a future-proof invariant or if an external effect targets it.
2. **Guard protection.** If the Guard is not blocked, its valid target becomes protected for this night. A Guard killed later in the same resolution still protected its target.
3. **Faction kill.** Discard kill nominations from blocked Wolf-faction actors, tally the remaining nominations, apply the seeded tie rule, and attack the selected target. A protected target survives; otherwise it becomes dead with public cause `wolf`.
4. **Seer inspection.** A living blocked Seer receives a private `no_result` with no causal field, while server/replay evidence records the blocked outcome. A Seer killed by step 3 receives no live `private_result` and no new dead-seat update, preserving Tofu's kill-before-inspection ordering. The server journal records `night_outcome(ability=inspect, actor=<seer>, target=<target>, outcome=actor_dead)`, revealable postgame as night-choice evidence. Otherwise the Seer privately learns `wolf` for Wolf or Alchemist and `not_wolf` for Guard or Sheep.

Roleblock, protection, and inspection never persist beyond the current night. Targeted players are not told live that they were blocked, protected, or attacked. Except for the Seer's deliberately private result, an actor learns only that its normalized choice was admitted, not whether the ability applied, was blocked, or prevented another effect.

Concrete interactions follow from the order:

- blocking the Guard prevents protection, so the kill lands if otherwise valid;
- blocking the Seer yields no alignment result;
- blocking the Wolf discards the Wolf's kill nomination, but an unblocked Alchemist nomination may still produce the faction kill;
- blocking a Sheep has no downstream effect;
- protecting the selected kill target prevents death;
- the Alchemist may nominate and roleblock the same Town target;
- one surviving Wolf-faction seat can still make the faction kill;
- simultaneous multi-kill, revival, poison, tracking, jailing, role-cop, neighbor, and Trickster behavior do not exist in v1.

## Death, victory, scoring, and termination

Dead status is permanent. Dead seats cannot bid, speak, vote, join new Wolf discussion, submit actions, or receive any new private update. They retain only information delivered before death. A Seer killed before inspection resolution gets no live `private_result`; the cause remains server-only until completed replay.

After each resolution, count living Wolf-faction players (`W`) and living Town (`T`) and apply checks in this order:

1. if `W == 0`, Town wins;
2. else if `W >= T`, the Wolf faction wins;
3. else the episode continues, subject to the `maxDays` draw rule after night resolution.

Every seat on the winning faction receives score 1, including faction members that died earlier. Every seat on the losing faction receives score 0. On a draw, every policy receives score 0.

A terminal result is exactly one of `town_win/wolves_eliminated`, `wolf_win/wolf_parity`, or `draw/day_cap`. `daysCompleted` counts fully resolved nights, so a Day 1 victory reports 0 and a default-cap draw reports 8. The result contains per-seat scores; completed replay reveal separately contains final roles. Terminal state is idempotent and final: subsequent policy responses are ignored and recorded only as late diagnostic input.

## Invalid, malformed, refused, and timed-out responses

The protocol adapter may make at most two attempts for one request within the original eight-second window: the initial request and one schema-correction retry. Retrying does not extend the deadline. The judge admits at most one terminal outcome per request; a composite night response is accepted or falls back as a whole.

On exhaustion, disconnection, refusal, or timeout, the judge emits a sanitized `failure` event with slot, request kind, attempt count, source, disposition, and reason code. It must not include raw provider payloads, credentials, system prompts, hidden reasoning, or stack traces in a player or public projection.

Deterministic legal fallbacks are:

| Interaction | Fallback |
| --- | --- |
| Public bid | `wantsToSpeak=false` |
| Wolf discussion | `pass` |
| Day vote | `null` abstention |
| Wolf/Alchemist kill nomination | `null` pass |
| Alchemist roleblock | `null` pass |
| Seer inspection | `null` pass |
| Guard protection | `null` pass |

Fallbacks deliberately avoid inventing a strategic target for a failed policy. The bounded draw rule, rather than random forced moves, guarantees termination. A valid explicit pass is recorded as a policy choice; an error-derived pass is separately visible as a failure plus fallback.

Wrong-phase, unauthorized-role, dead-actor, self-target, Wolf-faction-targeted kill, nonexistent-target, duplicate, and late actions are rejected without mutation. A rejection tied to an outstanding request can exhaust that request and cause its fallback; unsolicited input creates no new request or fallback.

## Episode events and observable outcomes

The `wcw.events/1` envelope and exact validators live in the system/protocol design. The domain must produce the following payload kinds and semantic distinctions so tests and replay do not infer truth from presentation strings:

| Payload kind | Minimum rules payload | Live audience | Reveal after completion |
| --- | --- | --- | --- |
| `started` | roster and rules version | public | yes |
| `roles` | all slot/role/faction assignments | server only | yes |
| `phase` | day, public phase, fixed duration | public | yes |
| `bid` | slot, bounded bid, rank, selected | originating seat | yes |
| `speech` | slot, text, reply, accusation | public | yes |
| `wolf_chat` | slot, text | living Wolf faction | yes |
| `ballots` | ordered ballots, eliminated slot, resolution | public at close | yes |
| `night_choices` | actor and complete normalized action list | actor only | yes |
| `night_outcome` | ability, actor when individual, target, applied/blocked/protected/passed/actor_dead | server only | yes |
| `private_result` | living Seer slot/target and `wolf`/`not_wolf`/`no_result` | living Seer only | yes |
| `elimination` | slot, `vote` or `wolf` cause | public | yes |
| `night_resolved` | publicly eliminated slots only | public | yes |
| `failure` | sanitized request kind, code, source, retry/fallback disposition, attempt | acting seat | sanitized summary only |
| `finished` | result, reason, days completed, scores | public | yes |
| `seed` | seed and random version | server only | yes |

Every authoritative event has a strictly increasing sequence number. Wall-clock timestamps may be recorded as metadata but must not participate in judge state, random draws, replay equivalence, or test equality.

## Secrecy and redaction invariants

Audience projection is a server-side derivation from authenticated viewer identity, current authoritative role/status, event audience, and terminal reveal policy. A client or policy-supplied channel name is never trusted.

Before terminal reveal:

- the global/live viewer receives only public phase state, public messages, public vote reveal, deaths, living/dead status, and terminal public result;
- no public payload contains seed, roles, factions, legal-action menus for another seat, Wolf chat, kill nominations, roleblock/protect/inspect targets, Seer results, discarded bids, or failure details;
- a seat receives its own role and own action acknowledgments;
- a living Wolf-faction seat retains its initial teammate identities/roles and receives new Wolf chat; submitted night choices remain actor-private until replay;
- a Seer result is visible only to the living Seer; same-resolution death produces no private result or dead-seat update;
- Guard and action targets receive no inference-producing success information beyond their own action admission;
- a dead seat gains no omniscient role or private-channel access and receives no new Wolf traffic or private action result;
- projection filtering occurs before serialization or bytes reach the viewer connection.

After terminal state, a configured completed replay may reveal the seed, all roles, Wolf chat, bounded confessionals, night choices and outcomes, discarded bids, and sanitized failure/fallback summaries. It must never contain raw chain-of-thought, hidden scratchpads, system prompts, provider request/response bodies, credentials, or unsanitized diagnostics. Such data is neither requested as game state nor persisted in the episode event log.

Replaying the same recorded authoritative event sequence must produce the same presentation model as the completed live episode. Reveal is event metadata and projection policy, not a second source of game truth.

## Test harness contract

Task 4 tests should separate three layers:

1. pure judge tests for assignment, admission, vote/night resolution, victory, draw, and deterministic ordering;
2. state-machine tests for phase sequencing, deadlines, fallback completion, and terminal idempotence;
3. projection/replay tests that assert allowlists for each audience and compare normalized live/replay presentation state.

Fixtures should use a fake clock and deterministic policy responses. Tests must not sleep, call a model provider, depend on object iteration, or assert wall-clock timestamps. Where a test starts from `standard-nine`, roles are assigned explicitly; only assignment fixtures exercise the seed mapping.

### Concrete test matrix

Source abbreviations in the final column are expanded in [Evidence references](#evidence-references).

| Fixture name | Inputs / setup | Expected authoritative events and result | Source |
| --- | --- | --- | --- |
| `roles/fixed-nine-counts` | `standard-nine` | Exactly 2 Wolf faction and 7 Town; one of each power role and five Sheep | P; TR |
| `roles/fisher-yates-known-seed` | seed `000102030405060708090a0b0c0d0e0f`, slots 0-8 | `1=Wolf,5=Alchemist,7=Seer,4=Guard`; remaining Sheep; terminal `roles` payload matches | P; AR |
| `roles/invalid-seed-rejected` | seeds with uppercase hex, nonhex text, or lengths 31/33 | configuration fails before role assignment or readiness; no episode events | P; AR |
| `roles/roster-input-order-irrelevant` | same seed/seat set in reverse input order | Same role map and normalized events as canonical input order | P |
| `roles/seed-hidden-live` | assigned episode, public projection | No seed/role/faction fields before terminal; completed replay contains seed and roles | P; TS |
| `random/rejection-sampling-counter` | fake digest words `[0xffffffff, 8]`, `n=9`, fresh label | first word rejected, second returns 8, and that label's next counter is 2 | AR; D |
| `random/label-isolation` | consume all `roles` draws, then draw Day 1 tie; compare with fresh helper's Day 1 tie | both tie draws select index 0 because label counters are independent | AR; D |
| `phase/starts-day-one` | initialized nine-seat episode | `started`, `phase(day=1, day)`; first requests are bids, not night actions | TM; AR |
| `phase/six-public-windows` | all bids pass | Six windows of unselected `bid` payloads, no `speech`, then vote phase at the fixed boundary | BFC; AR |
| `phase/day-to-night-to-next-day` | no-majority vote; all night actions pass; `maxDays>1` | day resolve -> four Wolf windows -> night actions/resolve -> Day 2 | TM |
| `phase/day-victory-skips-night` | last living Wolf-faction seat is majority-eliminated | `elimination(cause=vote)`, `finished(town_win)`; no Wolf/night window | TV |
| `phase/night-victory-skips-next-day` | kill reduces state to `W >= T` | `elimination(cause=wolf)`, `finished(wolf_win)`; no next day | TV |
| `phase/max-days-draw` | `maxDays=8`; no winner after Night 8 | `finished(draw,day_cap)`, all nine scores 0; no Day 9 | P; M |
| `floor/living-public-eligibility` | one dead seat submits highest bid | dead bid rejected; winner chosen only among living seats | BFC |
| `floor/lexicographic-speech-count-first` | slot 4 has speech count 0/urgency 0; slot 5 has count 1/direct reply/urgency 3 | slot 4 ranks first because speech count is the first key; one `speech` event | AR |
| `floor/direct-reply-before-urgency` | equal speech counts; slot 5 directly replies at urgency 0, slot 4 does not at urgency 3 | slot 5 ranks first | AR |
| `floor/rotating-priority-tie` | otherwise equal bids complete in reverse order | Day 1/window 0 selects slot 0; Day 1/window 1 selects slot 1 | AR |
| `floor/twice-per-day-cap` | seat has already spoken twice and submits highest urgency | bid excluded; another eligible bidder wins or window has no speech | AR |
| `floor/own-repeat-excluded` | trimmed/lowercased text repeats one of that seat's last five public messages | repeated bid excluded without affecting other seats' equal text | AR; BFC |
| `floor/all-pass` | every living bid has `wantsToSpeak=false` | no selected `bid`; no public `speech` | BFC |
| `floor/timeout-fallback` | one policy never returns; others pass | sanitized `failure(timeout,fallback)`; unselected fallback bid; window closes at 8s | P; AR |
| `wolf-chat/sequential-visibility` | four valid messages from W/A rotation | Actor order W,A,W,A; each request sees prior admitted message; no public-live message | P; TC |
| `wolf-chat/one-wolf-left` | A dead, W alive | turn pattern W,W,silent,silent; W gets two messages, not four; public night remains fixed | AR |
| `vote/strict-majority-eliminates` | 9 living; five votes T1, four abstentions | threshold 5, ordered `ballots(majority)`, `elimination(T1,vote)` | TD; TU |
| `vote/plurality-below-majority` | 9 living; T1=4, T2=3, two abstentions | threshold 5, `ballots(no_majority)`, no elimination | TD; TU; BV |
| `vote/tie-no-elimination` | 8 living; T1=4, T2=4 | `ballots(tie)`, no elimination, continue to night | TU; BV |
| `vote/all-abstain-or-fallback` | valid abstentions plus timed-out votes | `ballots(all_abstain)`; `failure` distinguishes timeout from choice; no elimination | BV; P |
| `vote/self-vote-legal` | T1 votes T1 | vote admitted and counted | TD |
| `vote/dead-or-nonexistent-target` | dead voter; living voter targets missing slot | both rejected; corresponding outstanding request falls back to null; no invalid state | P |
| `night/same-kill-nomination` | W and A nominate T1; all powers pass | faction-kill target T1; `elimination(T1,wolf)` | TN; BS |
| `night/split-kill-seeded-tie` | `standard-nine`, seed `000102030405060708090a0b0c0d0e0f`, Day 1; W->4, A->5 | sorted Town targets `[4,5]`; `sha256-counter/1` selects index 0/slot 4 | TU; AR |
| `night/all-kill-pass` | W and A pass kill | no attack/death; night completes | TU; P |
| `night/blocked-wolf-nomination-discarded` | A blocks W; W->T1; A->T2 | only A nomination counts; T2 is selected | TN; D |
| `night/alchemist-kill-and-block-same` | W passes; A kill T1 and block T1 | both fields admitted; T1 dies; roleblock has no protective effect | TA |
| `night/alchemist-kill-and-block-different` | W passes; A kill T1 and block S | T1 dies; S receives private blocked no-result | TA; TN |
| `night/alchemist-composite-all-or-fallback` | A submits legal kill plus illegal self-block; retry also malformed | neither row is admitted; one failure/fallback disposition records both null actions | P; AR |
| `night/roleblock-guard` | A blocks G; G protects T1; kill targets T1 | block applied, protection not applied, T1 dies | TN; BN |
| `night/roleblock-seer` | A blocks S; S inspects W | S sees `private_result(no_result)` with no cause; replay `night_outcome(inspect,blocked)` preserves cause; no alignment elsewhere | TN; BN; AR |
| `night/roleblock-sheep-no-effect` | A blocks T1; kill targets T2 | block recorded; no other effect; T2 dies | TN |
| `night/guard-prevents-kill` | G protects T1; kill targets T1 | protection applied, attack recorded, no `elimination` | TN; BN |
| `night/guard-dies-protection-holds` | G protects T1; kill targets G | G dies, protection of T1 remains an applied event | TN; D |
| `night/seer-wolf-and-town-results` | two isolated runs: S inspects W, then T1 | private result `wolf`, then `not_wolf`; replay reveals both after completion | TR; TN; BN |
| `night/seer-target-killed-still-resolves` | S inspects T1 while the faction kill kills T1 | living S receives `not_wolf`; target eligibility and alignment use the action-window roster despite later death | TN; D |
| `night/seer-killed-no-live-result` | S inspects W; G protects nobody; kill targets S | no live `private_result` or dead-seat update; server/replay has `night_outcome(inspect,actor_dead)`; no alignment emitted | TN; AR |
| `night/sheep-empty-actions-fixed-duration` | only Sheep and one Wolf-faction seat remain; all answer immediately | every living seat receives night request, Sheep submits empty list; public night remains 40s with no private-progress leak | AR |
| `night/self-targets-rejected` | W kills W; A blocks A; S inspects S; G protects G | each field rejected and falls back to pass; no self effect | TN; TST |
| `night/kill-mafia-target-rejected` | W nominates A or A nominates W | invalid nomination rejected/fallback; no friendly-fire death | D |
| `night/dead-actor-rejected` | dead power role sends otherwise valid action | rejection/fallback diagnostic only; no domain mutation | BN; P |
| `failure/malformed-then-valid-retry` | invalid schema attempt then valid reply within 8s | `failure(malformed,retry)`, then admitted action; no fallback; deadline unchanged | P; AR |
| `failure/two-malformed-responses` | two invalid attempts | `failure(malformed,fallback)`, one whole-request fallback; phase completes | P; AR |
| `failure/refusal-and-timeout-differ` | explicit untyped refusal vs no response | reason categories differ; deterministic fallback is identical; no raw provider text in public/replay | P |
| `failure/late-duplicate-idempotent` | valid response, then duplicate and post-deadline alternatives | first terminal outcome only; later inputs cannot alter events or result | D |
| `victory/town-at-zero-wolves` | last Wolf-faction seat dies by vote or permitted resolution | `finished(town_win,wolves_eliminated)` and Town seats score 1, including dead Town | TV; BV |
| `victory/wolves-at-parity` | resolution leaves 2 Wolf / 2 Town | `finished(wolf_win,wolf_parity)` and both Wolf-faction seats score 1 | TV; BV |
| `victory/check-before-cap-draw` | Night 8 kill creates Wolf parity | Wolf victory, not draw | M; TV |
| `projection/public-live-allowlist` | one full cycle containing every action type and failures | public payload has only public phase/chat/vote/death/status data; forbidden-field recursive scan is empty | P; TS |
| `projection/wolf-live-private` | living W and A, then A dies | both see earlier Wolf events; dead A receives no subsequent Wolf events | TS; TC |
| `projection/seer-result-private` | S successfully inspects A | only S live projection contains alignment; global/other seats do not | TS; TR |
| `projection/death-does-not-reveal-role` | W eliminated by vote | live public event says dead/cause but not role/faction; replay later reveals Wolf | P; TS |
| `projection/completed-reveal-excludes-hidden-reasoning` | terminal episode with bids, private actions, and provider failure fixture containing sentinel secrets | replay includes configured private events and sanitized failure; excludes sentinel CoT/prompt/payload/credential values | P |
| `replay/normalized-parity` | run deterministic fixture; replay recorded events from empty state | normalized presentation model and authoritative terminal result equal live completion; event sequences identical | P; D |
| `determinism/repeated-run-byte-stable-domain` | same seed, roster, config, fake clock, and policy replies twice | authoritative events excluding allowed wall-clock metadata are byte-identical | P; D |
| `determinism/reverse-response-completion-order` | identical replies complete in opposite orders | roles, floor winner, vote, night target, and terminal result are identical | P; BFC; D |

`M` in the table denotes the manager-settled `maxDays` decision recorded in this document.

## Intentional v1 divergences

| Reference behavior | v1 decision | Reason |
| --- | --- | --- |
| Tofu uses unseeded Lodash/`Math.random()` role shuffle | `sha256-counter/1` labeled draws plus Fisher-Yates into ascending slots | Reproducible episodes and fixtures |
| Tofu faction-kill ties use `Math.random()` | Sort tied slots, then use a `sha256-counter/1` draw labeled by day | Reproducibility |
| Tofu's last kill-vote submitter becomes the kill actor, making roleblock outcome arrival-order-dependent | Discard blocked actors' nominations, then resolve the faction tally independent of arrival order | Distributed policies must not turn network timing into rules truth |
| Tofu action handlers rely on upstream/UI legality and accept broad action maps | Judge validates authenticated actor, phase, role, target, liveness, and request | Untrusted independently packaged policies |
| Tofu combines long timer-driven day/night phases | Six public, four Wolf, one vote, and one action window per cycle, each eight seconds and resolved at a fixed boundary | Coworld deadline, pacing bound, and timing secrecy |
| Tofu permits vote/action replacement and cancellation before phase lock | First valid final response is immutable; identical retry is idempotent and changed retry is rejected | Network arrival order must not become authority |
| Tofu records a generic `pass` action for no-action roles | Every living seat receives the same-timed composite request; Sheep answer with the protocol's empty action list | Typed role-shaped actions while preserving timing secrecy |
| Tofu classifies a below-majority tie as `no-majority` because it checks threshold first | Emit `tie` when top counts are equal, while still eliminating nobody | Accurate event semantics without gameplay change |
| Benchmark eliminates by plurality | Require Tofu's strict living-player majority | Rules parity and reduced low-consensus eliminations |
| Benchmark default action inference can accept an explicit mismatched action kind | Role-shaped protocol and judge authorization | A policy cannot grant itself another role's power |
| Benchmark uses a weighted controller with float urgency, display-name matching, and lexical heuristics | `wcw.player/1` uses ordinal urgency, typed `replyTo`, lexicographic speech-count/reply/urgency/rotating-slot priority, a twice/day cap, and exact-own-repeat exclusion | Deterministic opportunity without treating wording as strategic truth; duplicate names remain legal |
| Tofu gives dead players/spectators a ghost channel and reveals roles in the game-over sync | Dead players gain no live omniscience; completed replay performs the reveal | Accepted replay-first secrecy model |
| Tofu and benchmark have no bounded draw | Configurable `maxDays`, default 8; unresolved episode draws after Night 8 and all scores are 0 | Guaranteed Coworld episode completion |
| Benchmark show mode centralizes policies and host orchestration | Nine independently replaceable policies; game remains the deterministic authority | Accepted Coworld product mode |
| Reference systems may persist provider-oriented logs | Only bounded authored deliberation and sanitized failure categories enter revealable events | Raw hidden reasoning and credentials are prohibited |

## Evidence references

The references below are evidence, not dependencies to import.

- **P — Product contract:** `docs/product/v1-contract.md`, especially fixed roles, independent policies, viewer secrecy, deterministic fallbacks, and seeded randomness.
- **AR — Accepted system designs:** `docs/architecture/architecture-record.md` and `docs/plans/2026-09-15-who-cried-wolf-coworld-design.md` through main commit `ab69fea`, plus `docs/design/reveal-and-spectator-design.md` reconciled on main at `8d33451`, define `sha256-counter/1`, fixed windows, compact player results, event payloads, transport authority, and projection behavior.
- **TM — Tofu machine:** `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/machine/mafia-state-machine.ts:76-132` and `mafia-machine-setup.ts:211-255` define the alternating phase graph and current Day-first start.
- **TR — Tofu roles/projections:** `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/shared/types/player-roles.ts:4-67` maps Wolf, Alchemist, Seer, Guard, Sheep and factions; `server/utilities/player-sort-helper.ts:114-173` shows self, Mafia-peer, and Seer knowledge projection.
- **TD — Tofu day:** `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/machine/handlers/day-handler.ts:12-149` records phases and elimination; lines 193-231 detect completion/majority.
- **TU — Tofu vote utilities:** `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/machine/handlers/utilities.ts:7-36` requires strict majority and eliminates nobody on tie/no-majority; lines 38-65 show the unseeded Mafia tie behavior v1 replaces.
- **TN — Tofu night:** `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/machine/handlers/night-handler.ts:73-92` defines resolution ordering; lines 242-382 define roleblock and kill; lines 431-478 define Seer resolution; lines 532-588 define Guard protection; lines 595-627 reject self-targets; lines 680-742 define Alchemist immunity and action completion.
- **TA — Tofu Alchemist tests:** `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/machine/tests/alchemist.test.ts:27-163` and `:165-299` prove that Alchemist may kill and block the same or different players.
- **TST — Tofu self-target test:** `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/machine/tests/role-self-target-check.test.ts:21-219` covers all retained v1 power roles.
- **TV — Victory:** `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/machine/handlers/check-game-over.ts:5-29` and `/Users/jt/projects/mafia-who-cried-wolf-benchmark/packages/engine/src/domain/victory.ts:8-26` both establish Town-at-zero-Mafia and Mafia-at-parity.
- **TS — Tofu secrecy/chat:** `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/match-machine-helpers/state-sync.ts:10-35,99-128` and `chat-utilities.ts:21-45` show role/action filtering and Mafia/dead channel routing, from which v1 keeps Mafia privacy but intentionally changes dead knowledge.
- **BS — Benchmark seed/roles:** `/Users/jt/projects/mafia-who-cried-wolf-benchmark/packages/engine/src/domain/seed.ts:3-37,115-178` defines the same nine-role behavior kernel and shared faction kill.
- **BV — Benchmark votes:** `/Users/jt/projects/mafia-who-cried-wolf-benchmark/packages/engine/src/domain/votes.ts:95-165` defines structured skip, tally, and explicit tie behavior; its plurality threshold is not adopted.
- **BN — Benchmark night judge:** `/Users/jt/projects/mafia-who-cried-wolf-benchmark/packages/engine/src/domain/nightActions.ts:20-100` provides typed role actions, roleblock-before-protection/kill behavior, and private Seer results.
- **BFC — Benchmark floor controller:** `/Users/jt/projects/mafia-who-cried-wolf-benchmark/packages/engine/src/domain/floorController.ts:22-92` supplies living/audience eligibility and the behavior reference for fair speaking opportunities; its weighted lexical score is intentionally non-normative.
- **TC — Tofu chat:** `/Users/jt/projects/tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/match-machine-helpers/chat-utilities.ts:21-45` confirms living Mafia-private chat and shows the dead/spectator behavior v1 rejects.
- **D — Deterministic v1 design:** explicit decision in this document where neither reference has a suitable deterministic distributed-policy rule.

## Discrepancies and residual risks

- Several current Tofu tests still navigate to a first-night phase even though the production state machine was changed to start on Day. Task 4 must assert the production Day-first rule and must not port those stale test assumptions.
- Tofu's low-level action handler does not fully authorize actor role, target liveness, or action kind. Copying it directly would make malformed or adversarial policies capable of illegal state transitions; v1 must enforce legality at the judge boundary.
- The reference Alchemist/faction-kill path depends on last-submit arrival order. The actor-neutral tally rule above is necessary for deterministic distributed execution but requires focused parity tests because it is a deliberate structural change.
- A public seed would reveal roles under the specified assignment algorithm. Projection tests must treat the seed as private until terminal replay reveal.
- Passing on all failures can create low-action games; the eight-day cap guarantees completion, but baseline-policy verification should separately measure excessive fallback/draw rates as diagnostics rather than silently changing rules.
- The accepted architecture specifies the `sha256-counter/1` construction while this rules specification owns the exact labels and per-label counter initialization needed by Task 4 fixtures. Implementations must use these fixture details rather than independently reinterpreting the random stream.
