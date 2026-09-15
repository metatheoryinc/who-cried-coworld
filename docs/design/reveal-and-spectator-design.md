# Reveal State and Spectator Experience Design

Owner: [Who Cried Wolf Design Recovery](agent:mt-port-designer-recovery), acting for the durable
[Who Cried Wolf Designer](agent:mt-port-designer) seat. Reconciled by
[Engineering Manager](agent:engineering-manager-4).

Status: **decision-ready design**, with the architecture dependencies in §12 open. This document is
the canonical UI contract for the spectator surface. Build against it rather than inventing a second
one; where it disagrees with the [architecture record](../architecture/architecture-record.md) or the
[v1 product contract](../product/v1-contract.md), those win and this document is wrong.

- Rendered prototype: [`prototype/index.html`](prototype/index.html)
- Rendered evidence: [`evidence/`](evidence/)
- Projection module, projected fixtures, and their assertions: [`prototype/project.mjs`](prototype/project.mjs), [`prototype/build-fixtures.mjs`](prototype/build-fixtures.mjs)

---

## 1. The user we are designing for

A spectator opens a completed episode with no context. Nine agents argued, lied, voted, and killed
each other in the dark, and the person watching wants to know **what happened, who was lying, and
when they could have known**. That is the whole product. Everything below serves it.

Two things make this different from watching people play Mafia:

- The audience can be given a *complete* account afterwards. Nothing is lost to memory. The design's
  job is to make that account legible, not merely available.
- The players are policies. The temptation is to show the audience a machine — channels, logs, model
  names, controller scores. That is the benchmark's producer console, and it is the wrong product.
  The audience should meet **a village**, and only then be shown its machinery.

Success is that a viewer can watch the public episode, feel the misdirection land, then turn on
the reveal and understand exactly how they were fooled — without ever being handed something during
live play that they were merely trusted not to look at.

## 2. Two audiences, one renderer

| Surface | Who | What they hold | Transport |
| --- | --- | --- | --- |
| **Live public** (`/global`, `/client/global`) | anyone watching a running episode | the public projection only, up to now | none; pinned to the present |
| **Live seat** (`/client/player?slot&token`) | one authenticated seat, read-only | public projection plus that seat's own private material | none |
| **Completed replay** (static bundle) | anyone, after the episode | the allowlisted export, whole | scrub, step, play |

These are the same components with different inputs. **Reveal is a property of events, not a mode of
the renderer.** There is no "spectator view" and "omniscient view" codebase; there is one fold over a
projected event list, and two projections.

Decision: **do not build the benchmark's channel tabs** (public / mafia / confessional / bids as
parallel panels). Private material appears *in place*, at the moment it happened, inside the public
timeline. A confessional next to the vote it explains is worth more than a confessional in a drawer,
and parallel panels would force a second renderer for the revealed view.

## 3. The visibility model

Every event carries exactly two declared fields. Everything else is derived.

```
audience : 'public' | 'seat' (+ seats[]) | 'wolves' | 'server'     — who received it live
reveal   : 'public' | 'discarded_bids' | 'confessional' | 'wolf_chat'
         | 'night_choices' | 'failures' | 'roles' | 'never'        — what the export may carry
```

Four presentation states follow from those two fields:

| State | Meaning | Rendering rule |
| --- | --- | --- |
| **Public** | the audience had it live | drawn as content |
| **Hidden** | exists, this audience never received it | **not drawn, not placeheld, not counted, not spaced for.** A projection containing a hidden event must be byte-indistinguishable from one where the event never existed |
| **Inferable** | not delivered, but derivable from public evidence | the design may show the consequence plainly, and must add no further signal |
| **Revealed** | delivered post-game under an allowlist | drawn with the reveal treatment, anchored at its original moment |

**Hidden is a property of the bytes, not of the CSS.** Filtering happens in trusted game code before
serialization. A live viewer that receives a role and declines to render it is not private; it is one
`view-source` away from being a cheat sheet. `prototype/project.mjs` is the executable statement of
this rule, and `build-fixtures.mjs` asserts it (see §11).

**Inferable is a design obligation, not a wire field.** It is the list of things a careful viewer can
deduce anyway. Naming them stops us from *amplifying* them, and stops us from pretending to a secrecy
we do not have.

### 3.1 Per-information-class visibility

| Information | Live public | Live seat | Replay · as it aired | Replay · everything | Reveal category |
| --- | --- | --- | --- | --- | --- |
| Roles | hidden | own role public; wolves see both wolf identities | hidden until the outcome beat | public | `roles` |
| Wolf chat | hidden | wolves only | hidden | revealed | `wolf_chat` |
| Confessionals / action summaries | hidden | own only | hidden | revealed | `confessional` |
| Speaking bids not taken | hidden | own only | hidden | revealed | `discarded_bids` |
| Winning speech | public | public | public | public | `public` |
| Ballots and tally | public at window close | same | same | same | `public` |
| Why they voted | hidden | own only | hidden | revealed | `confessional` |
| Night choices | hidden | own only | hidden | revealed | `night_choices` |
| Private results (Seer) | hidden | own only | hidden | revealed | `night_choices` |
| Night resolution reasoning | hidden | hidden | hidden | revealed | `night_choices` |
| Eliminations and deaths | public | public | public | public | `public` |
| Role on death | hidden (see §12) | hidden | hidden | public | `roles` |
| Fallback **effect** (abstention, silence) | public | public | public | public | `public` |
| Fallback **provenance** (timeout, provider error) | hidden | own only | hidden | revealed | `failures` |
| Seed, PRNG state, prompts, raw model output | never | never | never | never | `never` |

### 3.2 Things a viewer can infer, and what we do about them

| Inferable | Why | Design response |
| --- | --- | --- |
| A night kill occurred | someone is dead at dawn | announce the death plainly; never hint at the killer |
| The wolf faction's membership, after the result is published | per-seat scores are faction scores | **publish roles in the outcome beat.** Withholding them after publishing scores would be theatre, not secrecy |
| Roughly who the Seer is, from claims | players claim publicly | nothing; that is the game |
| Which seats acted at night | a seat that acted *could* be read from timing or counts | the night is a **fixed public duration** with no readiness, no pending-action count, no per-seat timing, and no sequence gap. See §5.3 |
| That a seat failed rather than chose silence | a policy that never speaks looks broken | accept it. The live audience reads silence as strategy; the replay corrects the record |

The last row is a real cost. Live viewers will misread a timed-out policy as a cagey one. We take it
because the alternative — publishing failure provenance live — tells the audience which seats are
weak in a way the game's own players cannot see, and that is a worse distortion.

### 3.3 The spoiler control is not a security boundary

The replay bundle is public static bytes. Once a viewer has it, they have every allowlisted reveal.

The **Reveal** control (`As it aired` / `Everything`) chooses what to *draw* from bytes already held.
It is labelled as a preference, never as a lock, and the prototype's holdings drawer states plainly
what the browser is carrying in each mode (evidence: `07-holdings-live.png`, `08-holdings-replay.png`).
The only real boundary is the export allowlist, applied server-side after a terminal state.

Consequence for engineering: **never** put something in the export because "the UI hides it by
default". If it must not be seen, it must not be exported.

## 4. The surface

Three regions, one shell.

```
┌──────────────────────────────────────────────────────────────┐
│ masthead   episode · status (LIVE / REPLAY) · Reveal control │
├────────────────┬─────────────────────────────────────────────┤
│  The fold      │  The floor                                  │
│  nine seats    │  phase banners, speech, ballots,            │
│  persistent    │  eliminations, revealed material,           │
│  glanceable    │  night scenes, outcome                      │
├────────────────┴─────────────────────────────────────────────┤
│ transport   day/phase segments · scrub · step · play         │
└──────────────────────────────────────────────────────────────┘
```

The conversation is the product, so the floor is the main column and the fold is a persistent rail.
On wide screens this is an app shell: the fold and transport hold still and the floor scrolls,
pinned to the current beat. Below 1000px it becomes ordinary page flow with the fold as a horizontal
snap-scrolling strip. Below 620px the speech avatar drops and the masthead stacks.

**Rejected: the village ring.** Nine cards in a circle suits the theme and is what Tofu's client
implies. It fragments at narrow widths, fights DOM reading order, and buys atmosphere at the cost of
scanability for the one thing the rail exists to answer — *who is alive, who is speaking, who did
they vote for*. A slot-ordered list wins.

### 4.1 Seat card states

One component. States are additive, never encoded by colour alone.

| State | Signal |
| --- | --- |
| In the fold | full colour identity mark, name, `Seat N` |
| Has the floor | lamp-tinted card, lamp left wash, **Speaking** badge |
| Named by others | `N× named` counter badge |
| Voted | status line reads `Voted <name>` / `Abstained` |
| Voted out | desaturated mark, struck name, `Voted out, day N` |
| Lost at night | desaturated mark, struck name, `Lost in night N` |
| Role known | faction-coloured role badge **with the role word**, dimmed when dead |
| Expanded | persona or submitted-policy note, seat, speech count, status, role when known |

### 4.2 Floor beat types

| Beat | Carries |
| --- | --- |
| `phase` | day/phase mark and one line of deterministic narration |
| `speech` | identity, seat, reply target, the text, declared accusation |
| `vote_close` | tally bars, majority of living, every ballot as `voter → target` |
| `elimination` / `death_notice` | who left and how; secrecy caption only while roles are unknown |
| `night scene` | a whole hidden night as one container (§5.3) |
| `sealed` | any inline reveal: bids not taken, confessionals, fallbacks |
| `hold` | the designed empty state of a public night (§5.3) |
| `outcome` | headline, detail, full roster with roles and scores |

## 5. Designed states that matter

### 5.1 The vote

Nothing is published while the window is open — a designed *sealed* state, not a live-updating tally,
because the game commits all ballots at close in slot order. At close the whole tally lands at once:
bars ranked, the eliminated seat in wolf red, then every ballot as a chip. Abstentions get a dashed
track and are counted separately; they are never folded into "no vote".

### 5.2 The reveal beat

In `As it aired`, roles stay hidden right through the final elimination, and the outcome beat reveals
the entire roster at once — the rail and the floor flip together. That simultaneity is the payoff of
the whole surface, and it is why role reveal is anchored to the outcome event rather than to a toggle.

### 5.3 The night

**Public live and as-aired:** a phase banner and a hold card. The copy says what is happening and why
there is nothing to see. The night runs its full fixed length whether or not anyone acts.

**Omniscient:** the night becomes a **scene** — one container with a sticky header, holding wolf
channel, night actions, seats with nothing to do, confessionals, private results, and how the night
resolved. This is the one place the design departs from "reveals are inline cards", and it earns it:
a night has *no* public content to interleave with, so six separate sealed cards read as a stack of
admin panels rather than as a night. Evidence: `01-replay-omniscient-night1.png`.

### 5.4 Failure

A fallback is never dressed as strategy. The sealed beat names the request, the code, the applied
fallback, and the provenance — `The game applied a legal fallback` versus `The policy reported a
failure and supplied a legal action`. A voluntary pass is a third thing and is labelled as one.

### 5.5 Bounded deliberation, and what is never shown

Deliberation means **explicit, bounded, game-facing text a policy authored for the audience**: the
`reason` on a bid, the `summary` on a vote or night action, wolf chat, confessionals. Every reveal
panel carrying it says so in place — *"Written by each policy for the audience as part of a committed
action. Not model reasoning."*

Never rendered, never exported, never requested: raw model output, hidden reasoning, system prompts,
provider responses or diagnostics, credentials, seeds, PRNG state. The renderer has no field for
them, and the projectors in `project.mjs` construct payloads field by field so there is no path for
one to arrive.

## 6. Identity

- **Every seat** shows a configured display name and `Seat N`. Slot is the identity; the name is
  configuration.
- **Bundled cast** seats get a coloured monogram mark and a one-line persona in the expanded card.
  The persona is published product content, not private game state, so it is public live.
- **Submitted policies** get a dashed, uncoloured slot mark and an explicit note: *"Submitted policy.
  This seat is known by its configured display name and nothing else — no personality, no provider,
  no model."* The distinction is visible at a glance and is never an accusation of blandness; it is
  an honest statement of what the game knows.
- **Model and provider identity appear nowhere in the spectator surface, in any mode.** The product
  contract makes them configuration rather than seat identity. If tournament attribution is wanted
  later, that is a product decision, not a renderer change.

Evidence: `09-seat-identity.png`.

## 7. Accessibility

- **Nothing is encoded by colour alone.** Dead = desaturation + strikethrough + explicit status text.
  Faction = role word + colour. Speaking = badge + tint. Abstain = dashed track + separate row.
- Contrast: body text and every badge label meet 4.5:1 on their own surface; the muted tier is
  reserved for text that is duplicated elsewhere as structure.
- DOM order is slot order in the rail and chronological in the floor, so reading order, tab order and
  visual order agree.
- The floor is an `aria-live="polite"` region with `aria-relevant="additions"` so a live viewer hears
  new public beats. It is not announced while scrubbing.
- Transport keyboard: `←`/`→` step a beat, `Space` play/pause, `Home`/`End` jump. Seat cards are
  native `<details>`, so disclosure is keyboard- and screen-reader-native.
- `prefers-reduced-motion` disables the live pulse and every transition.
- Visible focus ring on every interactive element, offset from the control.
- No horizontal page scroll at any width; the seat strip is the only horizontal scroller and it
  declares `overscroll-behavior-x: contain`.

**Deferred, deliberately:** a light theme. The surface is a theatre and dark is the designed default.
Revisit if the replay is ever embedded in a light host. When we do, the token block in
`prototype/index.html` is the only place that must change.

## 8. Responsiveness

| Width | Layout |
| --- | --- |
| ≥ 1001px | app shell; fold rail 296px; floor scrolls independently, pinned to the current beat |
| 621–1000px | single column; fold becomes a horizontal snap strip; floor in page flow |
| ≤ 620px | masthead stacks; speech avatars drop; tally label column narrows |

Evidence: `06-live-narrow.png`, `10-replay-medium.png`.

## 9. Component model

One set of components serves all three surfaces. Proposed home is `src/viewer` per the architecture
record's packaging decision, with pure projection and fold in `src/shared`.

| Component | Input | Notes |
| --- | --- | --- |
| `EpisodeTheater` | projection, reveal preference | shell; owns layout and the scroll pin |
| `RevealControl` | reveal preference | disabled with a reason when the source is live |
| `SeatRail` / `SeatCard` | derived seat model | states in §4.1 |
| `Floor` | projected events, reveal preference | dispatches beats; groups consecutive same-kind reveals |
| `PhaseBanner`, `SpeechBeat`, `VoteTally`, `Knell`, `NightHold`, `NightScene`, `SealedBeat`, `OutcomeBeat` | one beat each | |
| `Transport` | day/phase segments, cursor | hidden controls and a status line when live |
| `HoldingsDrawer` | projection | states what the browser holds; keeps §3.3 honest in the product, not only in this document |

Two pure functions carry the logic, and only these two:

- `project(episode, events, audience | allowlist)` — server-side, the secrecy boundary.
- `fold(projectedEvents, cursor)` — client-side, derives seat states, phase, and beats. Never decides
  legality, never resolves a vote, never determines death.

There is no design-system package yet and this work does not earn one. What it earns is the token
block and the component list above, which become the seed when a second surface appears. Registering
a catalogue is premature until there is an application importing these components; that is the
Designer's next piece of work, not this one.

## 10. Presentation payload contract

What the renderer needs from the export, as a request to the Architect. Field names are a proposal;
the shape is the requirement.

```ts
type Projection = {
  projection: 'live.public' | 'replay.export';
  protocol: 'wcw.events/1';
  episodeId: string;
  title: string;
  variant: string;            // human-readable preset summary
  complete: boolean;          // false ⇒ no terminal beat exists yet
  revealed: RevealCategory[]; // categories present in THESE bytes
  seats: Seat[];              // exactly nine, slot order
  events: ProjectedEvent[];   // dense seq 1..n, chronological
};

type Seat = { slot: 0..8; name: string; kind: 'bundled' | 'submitted';
              persona: string | null; role?: Role };  // role present iff 'roles' allowed

type ProjectedEvent = { seq: number; day: number; phase: Phase;
                        kind: Kind; reveal: RevealCategory } & KindPayload;
```

Required properties, each of which the renderer depends on:

1. **`seq` is dense, 1..n, per projection.** A gap is a disclosure: it tells a live viewer that
   something happened and how much of it. Re-issue sequence numbers after filtering.
2. **Cross-references are remapped or nulled.** `speech.replyTo` must point at a `seq` in the same
   projection, or be `null`.
3. **Payloads are constructed, not copied.** Per-kind projectors that build each field, including
   inside `items`, `ballots`, `actions` and `scores`. A shallow field allowlist is not sufficient —
   nested objects carry whatever else they hold.
4. **`role` is absent from the live roster**, not null, not empty string.
5. **`complete` distinguishes a running episode from a finished one**, so the renderer never implies
   a result that does not exist.
6. **`revealed` declares what these bytes contain**, so the holdings drawer can tell the truth without
   inferring it.

Event kinds and payloads are enumerated in `prototype/project.mjs` (`PROJECTORS`). That file is
executable and is the precise version of this section.

## 11. Verification

`node docs/design/prototype/build-fixtures.mjs` regenerates both fixtures and asserts, in order:

```
live projection carries only public events
live roster carries no roles
live sequence is dense, so gaps cannot be counted
live bytes contain no private vocabulary
live bytes contain no private authored text (0 leaks)
replay export is a superset of public material
replay is marked complete
replay roster carries roles, so the spoiler toggle is presentation only
injected nested field does not survive into the live projection
injected nested field does not survive into the replay export
the sentinel run still produced a real projection
```

The last three inject a sentinel value at the top level of every event and inside every nested
`items` / `ballots` / `actions` / `scores` / seat object, then prove it appears in neither artifact.
These are prototype-weight checks, deliberately: their job is to make the design's privacy claim
falsifiable today, and to hand engineering a shape for the real `tests/privacy/` suite.

## 12. Architecture dependencies

Open, and named here so nobody mistakes a prototype placeholder for an accepted rule.

| # | Dependency | Owner | Blocks |
| --- | --- | --- | --- |
| 1 | The `wcw.events/1` kind and payload enumeration must match §10 and `PROJECTORS` | Architect | renderer implementation |
| 2 | Whether a Seer who dies that night still receives the result. The prototype shows `wolf`; the renderer already supports `wolf` / `not_wolf` / `no_result` | Rules parity | fixture correctness only |
| 3 | **Role secrecy on death.** The design renders roles as secret until the outcome. If parity requires public-on-death, the payload needs `roleRevealedAt` per elimination and §3.1 changes | Rules parity | a visible design decision |
| 4 | Alchemist composite night action: the prototype shows `kill` + `block` submitted together with either nullable, and blocks resolving first | Rules parity | night scene copy |
| 5 | Fixed public night duration with no readiness, count, or timing published | Architect (already recorded) | §3.2 and §5.3 hold only while this does |
| 6 | Export allowlist categories are exactly those in §3, applied after a terminal state | Architect | §3.3 |
| 7 | `src/viewer` and `src/shared` as the home for renderer and fold | Architecture record (accepted) | component placement |

## 13. Browser acceptance states

A build satisfies this design when each is demonstrable.

| # | Acceptance | Evidence today |
| --- | --- | --- |
| A1 | Live public bytes contain no role, no wolf chat, no confessional, no bid, no night choice, no failure provenance, and no sequence gap | `build-fixtures.mjs` assertions; `07-holdings-live.png` |
| A2 | A sentinel nested field injected into any authored event is absent from both projections | `build-fixtures.mjs` assertions |
| A3 | Live and replay render through the same components; the only difference is the projection and the transport | `02` vs `03` |
| A4 | A public night shows the hold state and is indistinguishable from a night in which nothing happened | `02-live-public-night1.png` |
| A5 | Omniscient replay shows wolf chat, night actions, passes, confessionals, private results and resolution at their original moment | `01-replay-omniscient-night1.png` |
| A6 | Discarded bids reveal with rank, urgency and authored reason, and say the ranking used public evidence only | `04-replay-omniscient-day2.png` |
| A7 | A timeout renders publicly as an abstention and reveals its provenance only in replay | `11-replay-omniscient-fallback.png` |
| A8 | Roles appear in the as-aired replay exactly at the outcome beat, in rail and floor together | `05-replay-outcome.png` |
| A9 | Bundled and submitted seats are distinguishable, and no model or provider name appears anywhere | `09-seat-identity.png` |
| A10 | No horizontal page scroll and no clipped content from 500px to 1440px | `06`, `10` |
| A11 | Nothing conveys alive/dead, faction or abstention by colour alone | §4.1, all captures |
| A12 | The UI states what the browser is holding, and never implies the spoiler toggle is a boundary | `07`, `08` |

---

## Appendix: reuse boundary

Tofu Tech's client and the benchmark's web app were read as references only. Nothing was copied.

- **From Tofu:** the vocabulary — fold, seat card, role badge, speech indicator, ballot, elimination
  mark. No asset, sprite, font or component was reused; none has a verified licence record, and §
  "Repository and reuse boundary" of the product contract requires one. All identity marks here are
  generated from slot and name.
- **From the benchmark:** the shape of the behaviour — typed bids with urgency and reason, floor
  arbitration, sequential wolf chat, audience-tagged events. Its producer console (channel tabs,
  controller scores, approve/edit/regenerate, raw provider response) is explicitly **not** the model
  for a spectator surface, and its `rawOpenRouterResponse` field is exactly the class of payload §5.5
  forbids.
