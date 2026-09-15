# Reveal State and Spectator Experience Design

Owner: [Who Cried Wolf Design Recovery](agent:mt-port-designer-recovery), acting for the durable
[Who Cried Wolf Designer](agent:mt-port-designer) seat. Reconciled by
[Engineering Manager](agent:engineering-manager-4) on 2026-09-15.

Status: **reconciled**, including the two architecture amendments of 2026-09-15 (§10.1). No open
architecture or rules dependencies. This document is the canonical
UI contract for the spectator surface; build against it rather than inventing a second one.

**It is not a wire contract.** The authoritative event, viewer, replay and results schemas are
[the architecture design](../plans/2026-09-15-who-cried-wolf-coworld-design.md) §6–7, maintained by
the Architect. Where this document disagrees with that one or with the
[v1 product contract](../product/v1-contract.md), those win and this is wrong.

- Rendered prototype: [`prototype/index.html`](prototype/index.html)
- Rendered evidence: [`evidence/`](evidence/)
- Projection, fixtures, assertions: [`prototype/project.mjs`](prototype/project.mjs), [`prototype/build-fixtures.mjs`](prototype/build-fixtures.mjs)

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

Success is that a viewer can watch the public episode, feel the misdirection land, then turn on the
reveal and understand exactly how they were fooled — without ever being handed something during live
play that they were merely trusted not to look at.

## 2. Two audiences, one renderer

| Surface | Who | What they hold | Transport |
| --- | --- | --- | --- |
| **Live public** (`/global`, `/client/global`) | anyone watching a running episode | a `wcw.viewer/1` projection, public only, up to now | none; pinned to the present |
| **Live seat** (`/client/player?slot&token`) | one authenticated seat, read-only | the seat projection: public plus that seat's own private material | none |
| **Completed replay** (static bundle) | anyone, after the episode | a `wcw.replay/1` bundle under the post-game allowlist | scrub, step, play |

These are the same components with different inputs. **Reveal is a declared property of events, not a
mode of the renderer.** There is no "spectator view" and "omniscient view" codebase; there is one fold
over projected events, and three projections.

Decision: **do not build the benchmark's channel tabs** (public / mafia / confessional / bids as
parallel panels). Private material appears *in place*, at the moment it happened, inside the public
timeline. A confessional next to the vote it explains is worth more than a confessional in a drawer,
and parallel panels would force a second renderer for the revealed view.

## 3. The visibility model

Two declared fields on every journal event, both owned by the architecture design §6:

```
audience : {kind:'public'} | {kind:'seats', slots:[…]} | {kind:'server'}   — who received it live
reveal   : public | roles | wolf_chat | confessional
         | night_choices | discarded_bids | failures | never              — what the export may carry
```

Four presentation states follow:

| State | Meaning | Rendering rule |
| --- | --- | --- |
| **Public** | the audience had it live | drawn as content |
| **Hidden** | exists, this audience never received it | **not drawn, not placeheld, not counted, not spaced for.** A projection containing a hidden event must be byte-indistinguishable from one where the event never existed |
| **Inferable** | not delivered, but derivable from public evidence | the design may show the consequence plainly, and must add no further signal |
| **Revealed** | delivered post-game under the allowlist | drawn with the reveal treatment, anchored at its original moment |

**Hidden is a property of the bytes, not of the CSS.** Filtering happens in trusted game code before
serialization. A live viewer that receives a role and declines to render it is not private; it is one
`view-source` away from being a cheat sheet. `prototype/project.mjs` is the executable statement of
this rule, and `build-fixtures.mjs` asserts it (§11).

**Inferable is a design obligation, not a wire field.** It is the list of things a careful viewer can
deduce anyway. Naming them stops us from *amplifying* them, and stops us from pretending to a secrecy
we do not have.

### 3.1 Per-information-class visibility

| Information | Live public | Live seat | Replay · as it aired | Replay · everything | Reveal category |
| --- | --- | --- | --- | --- | --- |
| Roles | hidden | own role; wolves see both wolf identities | hidden until the outcome beat | shown | `roles` |
| Wolf chat | hidden | living wolves at emission | hidden | shown | `wolf_chat` |
| Confessionals and authored reasons | hidden | own only | hidden | shown | `confessional` |
| Bids, their rank and selection | hidden | own only | hidden | shown | `discarded_bids` |
| Accepted public speech | shown | shown | shown | shown | `public` |
| Ballots and resolution | shown at window close | same | same | same | `public` |
| Submitted night choices | hidden | acting seat | hidden | shown | `night_choices` |
| Private Seer result | hidden | the acting seat, **while it lives** | hidden | shown | `night_choices` |
| An inspection whose actor died before it resolved | hidden | **not emitted to anyone, not even the actor** | hidden | shown, as the night outcome | `night_choices` |
| Night outcome detail | hidden | hidden | hidden | shown | `night_choices` |
| Eliminations, night resolution, result | shown | shown | shown | shown | `public` |
| Role on death | hidden | hidden | hidden | shown | `roles` |
| Fallback **effect** (abstention, silence) | shown | shown | shown | shown | `public` |
| Fallback **provenance** (timeout, provider error) | hidden | own only | hidden | shown | `failures` |
| Seed | hidden | hidden | **never drawn** | **never drawn** | `roles` |
| Prompts, raw model output, provider diagnostics | never emitted | never emitted | never emitted | never emitted | `never` |

The seed is the one row where the bytes and the surface deliberately differ. The architecture exports
it post-game under the `roles` category, which is safe once the episode is terminal — but it is
reproduction metadata, not part of the story, so **no beat draws it in any mode**. That is a
presentation decision, recorded here so nobody adds one later thinking it was an oversight.

### 3.2 Things a viewer can infer, and what we do about them

| Inferable | Why | Design response |
| --- | --- | --- |
| A night kill occurred | someone is dead at dawn | announce the death plainly; never hint at the killer |
| The wolf faction's membership, after the result is published | per-seat scores are faction scores | **publish roles in the outcome beat.** Withholding them after publishing scores would be theatre, not secrecy |
| Roughly who the Seer is, from claims | players claim publicly | nothing; that is the game. Speech is labelled as a claim and never promoted to role metadata |
| Which seats acted at night | a seat that acted *could* be read from timing or counts | the night is a **fixed public duration** with no readiness, no pending-action count, no per-seat timing, and no cursor gap. §5.3 |
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
On wide screens this is an app shell: the fold and transport hold still and the floor scrolls, pinned
to the current beat. Below 1000px it becomes ordinary page flow with the fold as a horizontal
snap-scrolling strip. Below 620px the speech avatar drops and the masthead stacks.

**Rejected: the village ring.** Nine cards in a circle suits the theme and is what Tofu's client
implies. It fragments at narrow widths, fights DOM reading order, and buys atmosphere at the cost of
scanability for the one thing the rail exists to answer — *who is alive, who is speaking, who did
they vote for*. A slot-ordered list wins.

### 4.1 Seat card states

One component. States are additive, never encoded by colour alone.

| State | Signal |
| --- | --- |
| In the fold | identity mark, name, `Seat N`; the mark is a coloured monogram for a character seat and a dashed slot number for a neutral one (§6) |
| Has the floor | lamp-tinted card and left wash, status line reads `Has the floor` |
| Named by others | `N× named` counter badge |
| Voted | status line reads `Voted <name>` / `Abstained` |
| Voted out | desaturated mark, struck name, `Voted out, day N` |
| Lost at night | desaturated mark, struck name, `Lost in night N` |
| Role known | faction-coloured role badge **with the role word**, dimmed when dead |
| Expanded | the character's persona and its caveat, or the neutral note; then seat, speech count, status, and role when known |

There is deliberately no "Speaking" badge: the card's tint and status line already say it, and a third
chip crowded the name out at rail width. Two signals for one state was one too many.

### 4.2 Floor beats

Beats are this design's vocabulary for what the reader sees. They are **not** wire event kinds; the
mapping is §10.2.

| Beat | Carries |
| --- | --- |
| `PhaseBanner` | day/phase mark and one line of fold-authored narration |
| `SpeechBeat` | identity, seat, reply target, the text, declared accusation, and — when revealed — why that bid took the floor |
| `VoteTally` | bars, derived majority, resolution when it is not a plain majority, every ballot as `voter → target` |
| `Knell` | who left and how; secrecy caption only while roles are unknown |
| `NightScene` | a whole hidden night as one container (§5.3) |
| `SealedBeat` | any inline reveal: bids not taken, confessionals, fallbacks |
| `NightHold` | the designed empty state of a public night (§5.3) |
| `OutcomeBeat` | headline, reason, nights completed, full roster with roles and scores |

## 5. Designed states that matter

### 5.1 The vote

Nothing is published while the window is open — a designed *sealed* state, not a live-updating tally,
because the game commits all ballots at close in slot order. At close the whole tally lands at once:
bars ranked, the eliminated seat in wolf red, then every ballot as a chip. Abstentions get a dashed
track and are counted separately; they are never folded into "no vote". The majority threshold is
derived by the fold from the number of living ballots; `resolution` is shown only when it is
something other than a plain majority, so the header never says "majority · majority".

### 5.2 The reveal beat

In `As it aired`, roles stay hidden right through the final elimination, and the outcome beat reveals
the entire roster at once — the rail and the floor flip together. That simultaneity is the payoff of
the whole surface, and it is why role reveal is anchored to the terminal result rather than to a
toggle or to death.

**This beat belongs to the replay, not to live.** The `roles` event has a server audience, so a live
public viewer never receives it: at the end of a live episode they see the public result and its
scores, and no role badges. That is correct rather than a gap — hosted v1 is replay-first, the reveal
is the replay's reason to exist, and faction membership is still inferable from the published scores
for anyone who wants it before the bundle lands.

### 5.3 The night

**Public live and as-aired:** a phase banner and a hold card, which quotes the night's own declared
`durationMs`. The night runs its full fixed length whether or not anyone acts.

**Everything:** the night becomes a **scene** — one container with a sticky header, holding the wolf
channel, night actions, seats with nothing to do, confessionals, and how the night resolved. This is the one place the design departs from "reveals appear inline", and it earns
it: a night has *no* public content to interleave with, so six separate sealed cards read as a stack
of admin panels rather than as a night. Evidence: `01-replay-omniscient-night1.png`.

The public dawn beat stays **outside** the scene, so the public spine of the episode is identical in
both reveal modes.

### 5.4 The result that never arrives

An inspection can fail to produce a result in two different ways, and the design treats them
differently because the *game* treats them differently.

| Case | What the actor is sent | What the replay shows |
| --- | --- | --- |
| **Blocked, and still alive** | a bare `private_result` of `No result`, with no reason attached | the `Private result` panel, plus the block in *How the night resolved* |
| **Killed before it resolved** | **nothing at all** — no `private_result`, no seat-directed update | one row in *How the night resolved*: `Inspect · Coriander → Hollis · no result — the actor died before it resolved` |

The killed case is the stricter one and it is the one that matters here. There is no event to hide,
so there is nothing for a client to leak: the actor's own lane is silent, which is exactly what §3
means by *hidden is a property of the bytes*. The audience still learns what happened, in the one
place that records it, and learns it only after the episode is over.

The distinction is worth the two treatments. "You were stopped" and "you did not live to find out"
are different facts about the night, and collapsing them into one blank result would quietly rewrite
the story the replay is there to tell. Evidence: `01-replay-omniscient-night1.png`.

### 5.5 Failure

A fallback is never dressed as strategy. The sealed beat names the request kind, the code, the legal
fallback the game applied, the attempt, the disposition, and the provenance — `source: 'game'` reads
*The game applied a legal fallback*, `source: 'policy_report'` reads *The policy reported a failure
and supplied a legal action*. Evidence: `11-replay-omniscient-fallback.png`.

### 5.6 Bounded deliberation, and what is never shown

Deliberation means **explicit, bounded, game-facing text a policy authored for the audience**: a bid's
`reason`, a `confessional` attached to a committed action, wolf chat. Every panel carrying it says so
in place — *"Written by each policy for the audience as part of a committed action. Not model
reasoning."* — and each line names the action it rode with.

Never requested, never emitted, never rendered: raw model output, hidden reasoning, system prompts,
provider responses or diagnostics, credentials. The renderer has no field for them, and the
projectors in `project.mjs` construct payloads field by field so there is no path for one to arrive.
The seed is emitted and exported post-game but never drawn (§3.1).

## 6. Identity

A seat has two independent identities, and the surface must never let one imply the other.

- **Who is playing** — the display name from the `started` roster, plus `Seat N`. Slot is the
  identity; the name is player-supplied configuration.
- **Who they are playing** — the seat's **presentation**, a required field on every `PublicSeat`:

```
presentation : {kind:'character', characterId, persona} | {kind:'neutral'}
```

It originates in trusted `GameConfig.presentation[9]`; the game normalizes it into the roster, and a
slot with no entry arrives as `{kind:'neutral'}` rather than being omitted. The viewer reads it off
the seat and never resolves it itself.

A **character** is a role-play identity the game assigned to a seat or variant. It is *not* a claim
about which policy package, model or provider occupies that seat: an externally submitted policy may
be seated into a configured character and plays it unchanged. Where no trusted presentation exists,
the seat renders **neutral** — and neutral is the default, not an error state.

| | Character seat | Neutral seat |
| --- | --- | --- |
| Mark | coloured monogram | dashed, uncoloured slot number |
| Expanded card | the one-line persona, then *"A character the game assigned to this seat. Not a claim about which policy plays it."* | *"No character is configured for this seat. It is known by its display name and seat number, and nothing else."* |
| Seat rail status | identical — see below | identical |

**The rail carries no presentation class at all.** A seat's status line says only what that seat has
*done* — has the floor, voted X, abstained, lost in night 2, or simply *In the fold*. An earlier
draft used the resting status to mark which seats were "bundled", which quietly turned a
presentation choice into a visible tier. It is gone. The distinction now lives in the seat mark and
in the expanded card, where a viewer has actually asked the question.

**Two things the surface must never do.**

1. **Never resolve presentation from the display name.** The name is user-controlled; matching on it
   would let a submitted policy inherit a character by naming itself after one. The binding is
   `slot → presentation`, made by the game before the roster is serialized. `build-fixtures.mjs`
   asserts that no `characterId` is a display name, and the prototype's config lives in
   `episode-source.mjs` — an input to the game, never loaded by the page.
2. **Never accept self-reported provider or model identity, and never show it.** Model and provider
   appear nowhere in the spectator surface, in any mode. If tournament attribution is ever wanted,
   that is a product decision with its own trusted source — not a renderer change.

**Presentation is not a reveal category.** It is public seat data: live and replay see exactly the
same presentation, and an assertion compares the two rosters to prove it. There is nothing here to
hide, because a character is a costume the game handed out, not a fact about the player wearing it.
Because it is nested twice over inside `started`, `project.mjs` gives it its own constructor and the
sentinel run spikes it directly (§10.1 property 3). Evidence: `09-seat-identity.png`.

## 7. Accessibility

- **Nothing is encoded by colour alone.** Dead = desaturation + strikethrough + explicit status text.
  Faction = role word + colour. Has the floor = tint + status line. Abstain = dashed track + its own
  labelled row. Night outcome = outcome word, with colour only reinforcing a kill that landed.
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
Revisit if the replay is ever embedded in a light host. The token block at the top of
`prototype/index.html` is the only place that would need to change.

## 8. Responsiveness

| Width | Layout |
| --- | --- |
| ≥ 1001px | app shell; fold rail 296px; floor scrolls independently, pinned to the current beat |
| 621–1000px | single column; fold becomes a horizontal snap strip; floor in page flow |
| ≤ 620px | masthead stacks; speech avatars drop; tally label column narrows |

Evidence: `06-live-narrow.png`, `10-replay-medium.png`.

## 9. Component model

One set of components serves all three surfaces. Home is `src/viewer` per the architecture record's
packaging decision, with the pure projection and fold in `src/shared`.

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

- `project(journal, audience | allowlist)` — server-side, the secrecy boundary.
- `fold(projectedEvents, cursor)` — client-side, derives seat states, phase, and beats.

**What the fold may and may not do.** It may add narration, derive the majority threshold from the
number of living ballots, group consecutive same-kind private events into one panel, and choose
playback durations. It may **not** resolve a vote, determine death, infer a hidden role, promote a
public role claim to role metadata, or otherwise redefine event semantics. Every authoritative fact
it renders came from a payload.

There is no design-system package yet and this work does not earn one. What it earns is the token
block and the component list above, which become the seed when a second surface appears. Registering
a catalogue is premature until there is an application importing these components; that is the
Designer's next piece of work, not this one.

## 10. Wire schema and the beat model

### 10.1 The wire is owned elsewhere

The authoritative definitions are the architecture design §6–7: the `wcw.events/1` journal envelope
and `Payload` union, the `wcw.viewer/1` packet, the `wcw.replay/1` bundle, and `wcw.results/1`. This
document does not restate them and must never be read as a second enumeration of them.

Two amendments landed after this document was first reconciled and are folded in here: the
killed-Seer inspection lifecycle (`design/architecture:e76e876`, §5.4) and the required
`PublicSeat.presentation` field (`design/architecture:097b737`, §6).

`prototype/project.mjs` is design evidence *shaped to* that contract. Its `PAYLOADS` map holds one
projector per accepted payload kind; `MATRIX` encodes the accepted audience/reveal table and is
asserted against the fixture. If the architecture design changes, that file is what goes stale.

Six properties of projection the renderer depends on, all of them already required by §6:

1. **Cursors are recipient-local and dense, from 1.** Internal `seq` never leaves the server. A gap
   would itself disclose that something happened and how much of it.
2. **Cross-references use public IDs.** `speech.replyTo` resolves within the same projection or is
   null. Public speech IDs live in their own namespace, independent of private emission.
3. **Payloads are constructed, not copied** — field by field, including inside `roster`,
   `roster[].presentation`, `ballots`, `actions`, `scores`, `roles` and `bid`. A shallow allowlist is
   not sufficient; nested objects carry whatever else they hold, and `presentation` arrives from game
   configuration two levels down.
4. **No `roles` or `seed` event reaches a live projection.**
5. **The replay declares `complete: true` and `revealPolicy`** only after validation, so the renderer
   never implies a result that does not exist and can state what policy produced the bytes it holds.
   `projectReplay` refuses to emit a bundle that fails it: exactly one `started` and one `finished`,
   dense increasing cursors, unique IDs, every `replyTo` resolvable inside the bundle, no `never`
   category, unique roster slots, scores covering the roster as 0 or 1, and an outcome/reason pair
   fixed by the union. A bundle that cannot be validated is a visible failure, never a truncated
   artifact still claiming to be complete.
6. **The roster arrives in `started`,** carrying each seat's `slot`, `name`, `alive` and
   `presentation`, so the fold has both identities (§6) before any beat is drawn.

### 10.2 Payload kind → beat

The fold's entire responsibility, in one table.

| Accepted payload kind | Beat | Fold adds |
| --- | --- | --- |
| `started` | — (seeds the roster) | reads each seat's `presentation` off the roster; never matches on the name |
| `phase` | `PhaseBanner`; a night becomes `NightScene` or `NightHold` | narration; the hold quotes `durationMs` |
| `speech` | `SpeechBeat` | resolves `replyTo` to a name; attaches the selected bid's `reason` when revealed |
| `ballots` | `VoteTally` | derives the majority threshold from ballot count |
| `elimination` | `Knell` when `cause: 'vote'`; state only when `cause: 'wolf'` | — |
| `night_resolved` | `Knell` (dawn) | — |
| `finished` | `OutcomeBeat` | headline and reason copy from `outcome` / `reason` |
| `bid` | `SealedBeat` "N bids not taken"; suppressed when nothing was discarded | ranks rows; marks the seat that took the floor |
| `confessional` | `SealedBeat` "Confessionals" / "Why they voted" | groups by `requestKind` |
| `wolf_chat` | `SealedBeat` "Wolf channel" | numbers turns by order within the night |
| `night_choices` | `SealedBeat` "Night actions" | splits actors from seats with nothing to do |
| `night_outcome` | `SealedBeat` "How the night resolved" | — |
| `private_result` | `SealedBeat` "Private result" | emitted only to a living actor; a killed actor's inspection appears solely as its `night_outcome` (§5.4) |
| `failure` | `SealedBeat` "Fallback" | names the legal fallback implied by `requestKind` |
| `roles` | — (unlocks role badges) | gates on reveal mode or terminal result |
| `seed` | — (never drawn) | — |

## 11. Verification

`node docs/design/prototype/build-fixtures.mjs` regenerates the fixtures and asserts, in order:

```
every journal event satisfies the accepted audience/reveal matrix
journal events declare wcw.events/1
the fixture exercises every accepted payload kind except private_result
no private_result is staged: a killed Seer gets none, and no living Seer is blocked here
live artifact is a wcw.viewer/1 reset packet
live projection carries only public events
live projection carries no roles and no seed
live cursors are dense, so gaps cannot be counted
throughCursor matches the packet
internal seq never leaves the server
live bytes contain no private vocabulary
live bytes contain no private authored text (0 leaks)
every live replyTo resolves inside the live packet
replay artifact is a complete wcw.replay/1 bundle
replay declares the post-game allowlist policy
replay export is a superset of public material
replay carries roles from the first frame, so the spoiler toggle is presentation only
no never-category event is exported
results agree with the accepted wcw.results/1 shape
scores are faction scores in slot order
a Seer killed before resolution leaves one server-audience night_outcome actor_dead, exported under night_choices
the killed Seer receives nothing after it: no private_result, no seat-directed update
eliminations carry no role, so roles stay hidden on death
the Alchemist submits kill and block together, either nullable
every public night declares the same fixed duration
every PublicSeat carries a presentation of kind character or neutral
an unconfigured slot normalizes to neutral rather than being omitted
every characterId matches /^[a-z0-9][a-z0-9_-]*$/ within 48 characters
every persona is 1 to 240 Unicode code points
a neutral seat carries no characterId and no persona
no characterId is a display name, so a seat can never inherit a character by naming itself after one
live and replay see the same presentation; it is not a reveal category
export refuses a bundle with no finished event
export refuses a bundle with no started event
export refuses a bundle whose outcome and reason disagree
injected nested field does not survive into the live packet
injected nested field does not survive into the replay bundle
the sentinel run still produced a real projection
```

The sentinel assertions inject a value at the top level of every event and inside every nested
`roster` / `roster[].presentation` / `ballots` / `actions` / `scores` / `roles` / `bid` / `result` /
`speech` object, then prove it appears in neither artifact. The check for private authored text deliberately exempts a *selected*
bid, whose text is committed directly as the public speech.

These are prototype-weight checks. Their job is to make the design's privacy claim falsifiable today
and to hand engineering a shape for the real `tests/privacy/` suite — not to substitute for it.

## 12. Settled decisions

All previously open dependencies were closed by the Engineering Manager on 2026-09-15. Recorded here
because each one is visible in the design.

| Decision | Effect on this design |
| --- | --- |
| A Seer killed before inspection resolution is sent **nothing** — no `private_result`, no seat-directed update. The only record is a server-audience `night_outcome(inspect, actor_dead)`, exported under `night_choices`. A living blocked Seer still receives a bare `private_result` of `no_result` | §5.4 carries both cases. The killed case produces no private beat at all; the night's resolution panel reads `Inspect · Coriander → Hollis · no result — the actor died before it resolved` |
| `PublicSeat` requires `presentation` — `{kind:'character', characterId, persona}` or `{kind:'neutral'}` — normalized by the game from `GameConfig.presentation[9]`, never inferred from the display name, and never a claim about the occupying policy, model or provider. `characterId` matches `/^[a-z0-9][a-z0-9_-]*$/` within 48 characters; `persona` is 1–240 code points | §6 was rewritten around it. The "bundled vs submitted" axis is gone from the surface, including from the seat rail's resting status. Six assertions cover the shape, the neutral default and the no-name-matching rule |
| Roles stay hidden on death until the terminal outcome | the knell carries "Their role stays secret until the episode ends" while roles are unknown, and drops it once they are. No `roleRevealedAt` field is needed |
| The Alchemist submits `kill` and `block` together, either nullable; blocks resolve before the kill nomination tally | the night-actions panel shows a composite row with "Offered but passed", and the resolution panel is ordered block → protect → kill |
| The public night runs a fixed duration regardless of what is submitted | §3.2 and §5.3 hold. The hold card quotes the declared `durationMs` |
| Architecture reveal categories, export allowlist, and `src/viewer` / `src/shared` placement accepted | §3, §9, §10 adopt them unchanged |

Remaining limitations, which are not dependencies:

- **`private_result` is not staged.** Under the settled lifecycle its only remaining case is a
  *living blocked* Seer, and this episode has one Seer who dies on night 1. Restaging it would mean
  rewriting both nights and the day-2 spine that the killed case exists to demonstrate, so the
  absence is asserted rather than papered over, and the renderer still implements the beat (§5.4).
  A rules-level fixture should cover it.
- The fixture is an abridged three-day episode built as design evidence. Its mechanics are
  illustrative — do not derive a rules test from it.
- Playback durations are not yet tuned against the architecture's suggested values (speech 4s, phase
  1s, ballots/elimination/night summary 2s, finished 4s, reveals 0s). They are presentation
  configuration and belong to this seat; the prototype uses a flat step for scrubbing evidence.

## 13. Browser acceptance states

A build satisfies this design when each is demonstrable.

| # | Acceptance | Evidence |
| --- | --- | --- |
| A1 | Live bytes contain no role, no seed, no private event, no internal `seq`, and no cursor gap | assertions 5–13; `07-holdings-live.png` |
| A2 | A sentinel nested field injected into any authored payload, `roster[].presentation` included, is absent from both projections | assertions 36–38 |
| A3 | Live and replay render through the same components; the only difference is the projection and the transport | `02-live-public-night1.png` vs `03-replay-asaired-day2.png` |
| A4 | A public night shows the hold state and is indistinguishable from a night in which nothing happened | `02-live-public-night1.png` |
| A5 | Everything-mode shows wolf chat, night actions, passes, confessionals and the night outcome at their original moment | `01-replay-omniscient-night1.png` |
| A6 | Bids not taken reveal with rank, urgency and authored reason, mark who took the floor, and say the ranking used public evidence only | `04-replay-omniscient-day2.png` |
| A7 | A timeout renders publicly as an abstention and reveals code, source, attempt and disposition only in replay | `11-replay-omniscient-fallback.png` |
| A8 | Roles appear in the as-aired replay exactly at the outcome beat, in rail and floor together | `05-replay-outcome.png` |
| A9 | Character and neutral seats are distinguishable in the seat mark and the expanded card, the seat rail's status line carries no presentation class, and no model or provider name appears anywhere | assertions 26–32; `09-seat-identity.png` |
| A10 | No horizontal page scroll and no clipped content from 500px to 1440px | `06-live-narrow.png`, `10-replay-medium.png` |
| A11 | Nothing conveys alive/dead, faction, abstention or night outcome by colour alone | §4.1, all captures |
| A12 | The UI states what the browser is holding, and never implies the spoiler toggle is a boundary | `07-holdings-live.png`, `08-holdings-replay.png` |
| A13 | An inspection whose actor died before it resolved produces no private beat, and reads as `no result — the actor died before it resolved` in the night's resolution panel | assertions 21–22; `01-replay-omniscient-night1.png` |

---

## Appendix: reuse boundary

Tofu Tech's client and the benchmark's web app were read as references only. Nothing was copied.

- **From Tofu:** the vocabulary — fold, seat card, role badge, ballot, elimination mark. No asset,
  sprite, font or component was reused; none has a verified licence record, and the product contract
  requires one. All identity marks here are generated from slot and name.
- **From the benchmark:** the shape of the behaviour — typed bids with urgency and reason, floor
  arbitration, sequential wolf chat, audience-tagged events. Its producer console (channel tabs,
  controller scores, approve/edit/regenerate, raw provider response) is explicitly **not** the model
  for a spectator surface, and its `rawOpenRouterResponse` field is exactly the class of payload §5.6
  forbids.
