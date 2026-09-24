# Phone shell and action stamps

**Status:** Approved 2026-09-24.

## Goals

- Phones get a conversation-first layout instead of the desktop page stacked into one column.
- Votes and night actions use stamps placed on player cards instead of dropdowns, on every screen size.
- Human decisions stay editable until the phase timer ends.
- Wolf packs see each other's draft stamps.
- The Wolf kill is two collective votes (target, knife), and its resolution is logged for debugging.

The old Tofu `mafia-client` mobile layout is not a reference for this work.

## 1. Phone shell (width ≤ 760 px)

Replaces the current stacked phone layout. Wider screens keep the framed desktop layout.

The shell is exactly one screen tall (`100dvh`, inside safe-area insets). Only the chat list scrolls. Top to bottom:

1. **Top bar (~52 px):** logo mark, phase ("Day 2 · Discuss"), timer, a **?** that opens How to play, and a **role chip** ("🐺 Wolf") that opens the You sheet. Night uses dark colors.
2. **Seat strip (~64 px):** all nine seats in one row (see section 2).
3. **Chat:** channel tabs, then the message list filling remaining height.
4. **Composer:** pinned above the home-indicator inset.

The painted frame and table are dropped on phones. The background is the day or night sky cropped to cover.

**Lobby.** Before joining: top bar reads "Take your seat · Lobby open"; neutral seats; a welcome card in the chat area (role secret, how play starts, phase timings); the composer is a large **Join the village** button. After joining: seats show You / Joined / AI ready / Open seat; the timer shows the auto-start countdown; the welcome card becomes "You have a seat · 8 of 9 filled · 1 human"; the composer says "Chat opens when the game starts."

## 2. Seat strip and player card

- Nine-column grid. At 277 px each token is ~27 px: sheep face (or role art once known) and **seat number 1–9**. From ~400 px, names appear under tokens.
- Chat speaker names carry the same seat number and color accent.
- Marks: gold ring for you; red/blue corner dot for your teammates (own screen only); greyed with claw or meat for dead; role art for known roles; pulsing ring for the host's current speaker; vote-count badge after a vote resolves and a hoof on your own vote; in the lobby, dimmed open seats and a person icon for humans.
- Tokens are buttons with at least 44 px hit height and labels like "Seat 3, Villager 3, alive, 2 votes".
- **Tap a token → player card sheet:** large card, name, seat, status and death cause, known role, "Human" or policy name, and this seat's vote history from your journal. During a vote, tapping a token opens the decision sheet with that seat selected.

## 3. Action stamps (all screen sizes)

**Tray.** Appears when a decision is due: in the action card on desktop, in a bottom sheet on phones. One stamp per decision:

| Decision | Stamp |
| --- | --- |
| Vote | Town hoof (existing art) |
| Kill target | Claw (existing art) |
| Knife (who performs the kill) | Knife |
| Block | Potion |
| Inspect | Eye |
| Protect | Shield |
| Jail | Key |
| Inform | Milk pail |
| Track / Check | Footprints / Magnifier |

New icons are simple inline SVGs in the existing inked style.

**Placing.** Tap a stamp to pick it up; legal targets glow and others dim (for the knife, living Wolves including you). Tap a glowing seat to place it with a short "thunk". Tapping another seat while holding moves it; tapping a placed stamp lifts it off; Esc or tapping the tray cancels. Tap-tap works for touch, mouse, and keyboard.

**Defaults.** No stamp means pass, and the tray says so ("Guard · pass"). A Wolf's knife starts on themselves and can be handed to a packmate.

**Drafts.** Each placement is sent as the current draft. The tray shows Saving… / Saved and "Counts when the timer ends · 0:32". A reload restores stamps from the snapshot.

**Pack view.** Packmates' draft stamps show on cards in their color with their seat number.

**Where stamps land.** Desktop: on the large player cards, reusing vote-stamp positions. Phone: the sheet opens to about half height with a 3×3 grid of large seat cards; the strip shows mini stamps; swiping down collapses the sheet to a "Night actions · 0:41" pill.

Resolved stamps remain on cards, in the journal, and in replay.

## 4. Server, rules, and protocol

**Human drafts.** `submit()` gains a revisable mode used only for seats that have joined as human. A legal action replaces the current draft; an illegal or malformed draft is rejected without discarding the previous draft or consuming the policy retry allowance. Clearing all stamps sends a legal all-pass action. `closeRequest` at the deadline finalizes the current draft. Policies keep first-valid-answer locking. Drafts never enter the journal.

**Pack drafts.** During night actions, Wolf snapshots include `packDrafts: [{slot, actions:[{ability, target, killer?}]}]` for every living packmate's current or accepted night action, including AI packmates. It is built per recipient, omitted for non-Wolves, and never reaches public or replay output.

**Kill resolution (supersedes the (target, killer) pair tally in `rules.ts`).** Two independent collective votes among living Wolves:

- **Target:** each Wolf's kill target is one vote. Most votes wins; ties use the seeded draw (`kill_tie_day_N`).
- **Knife:** each Wolf's `killer` choice is one vote, independent of that Wolf's target. A Wolf who nominates a target without a knife choice votes for themselves. Most votes wins; ties use a separate seeded draw (`knife_tie_day_N`).
- No target votes means no kill. A blocked knife holder blocks the kill, as today. Protection and other outcomes are unchanged.

Example: W1 (target 3, knife 1), W2 (target 3, knife 2), W3 (target 5, knife 5) → seat 3 dies; knife is a seeded tie among 1, 2, 5.

**Kill log.** A new server-only event `kill_resolution {day, targetVotes:[{target,votes}], knifeVotes:[{killer,votes}], targetTie:boolean, knifeTie:boolean, target, killer}` is revealed after the game under `night_choices`. Existing `night_choices` and `night_outcome` events are unchanged.

**Client transport.** Placements are sent as ordinary `wcw.player/1` actions, debounced to ~250 ms.

## 5. Chat system lines, interstitials, game over, How to play

**System lines** (all screen sizes, from existing snapshot events): Town shows "Day 2 begins", "Villager 4 was killed in the night · Seer", "Vote: Villager 6 eliminated (5 of 7)" or "No majority", "Night falls". Team channels show night starts only.

**Interstitial (phone):** existing transition card, full screen inside safe areas, art scaled to width, reduced margins.

**Game over (phone):** winners in a two-column card grid, then the rest of the village; **Watch replay** and **Review village** pinned above the home indicator.

**How to play** (renamed from "Game setup"). Title "How to play" with the setup as a subtitle ("This game: one of 9 NewD3 role mixes"). Sections: Roles in this game, How to win, Voting & chat, Timing. The explanation of voting and night actions describes stamps, drafts until the timer ends, and the two Wolf kill votes. Desktop: button in the role card. Phone: full-height sheet from the **?** in the top bar and from the You sheet.

## Testing

- **Unit:** revisable drafts (replace, reject-and-keep, clear to pass, finalize at deadline); policies still lock first; `packDrafts` only for Wolves at night and absent from Town and public snapshots; target and knife tallies with seeded ties including the example above; `kill_resolution` hidden during play and revealed after; system-line construction.
- **Browser** at 277×1488, 375×812, 1022×596, 2000×1104 with the local launcher and fixed seeds: lobby and join, discussion shell, place/move/lift a vote stamp, two human Wolf tabs seeing each other's drafts, a Guard or Seer stamp, interstitial, game over, How to play.

## Docs

Architecture record: kill resolution supersedes the pair tally in "Night resolution"; human drafts supersede first-answer locking for human seats. Update `docs/testing/human-play.md` and `docs/testing/rules-parity.md`.

## Delivery

Three branches, each merged after verification:

1. Rules and drafts: kill resolution, `kill_resolution` event, revisable human drafts, `packDrafts`.
2. Action stamps on desktop, system lines, How to play.
3. Phone shell, player card sheet, phone interstitial and game over.
