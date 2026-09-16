# NewD3 roles and daytime coordination

Implemented rules version `wcw.rules/2`. Nine seats remain fixed. No new paid
LLM playtest has been run with these changes.

## Configuration

Select `setup: "A1"` through `"C3"`, or `"random"` for a seeded uniform draw of
one of the nine NewD3 setups. Omit setup and roles to retain A1. Alternatively,
provide a nine-entry `roles` deck; it is shuffled, not assigned by input position.
Do not combine a named setup with a custom deck. Tokens and player names remain
nine-entry arrays.

| Role key | Display name | Ability |
| --- | --- | --- |
| wolf | Wolf | Can perform the faction kill |
| alchemist | Alchemist | Block; can also perform kill |
| track_reader | Track Reader | Role check; can also perform kill |
| seer | Seer | Wolf/non-wolf investigation |
| guard | Guard | Protect another player |
| chef | Chef | Block and protect another player |
| dairy_maid | Dairy Maid | Tell another player her confirmed town identity |
| priest | Priest | Learn another player's actual night visits |
| noble | Noble | Mutual town knowledge and private conversation |
| sheep | Sheep | Vote and discuss, no night power |
| jester | Trickster | Wins alone when voted out; custom setups only |

The nine standard presets follow the [NewD3 setup table](https://wiki.mafiascum.net/index.php?title=NewD3).
Custom decks allow 1–3 Wolves, zero or 2–3 Nobles, and at most one Trickster.
They are extensions, not necessarily balanced NewD3 setups.

## Private discussions

Each day starts with six fixed private-chat windows, then three public speech
windows, another six private windows, and three more public speech windows before
the vote. Wolves and Nobles use separate channels in parallel, with two turns per
living member. Empty windows keep public timing independent of surviving roles.
Night includes another six private windows before actions. Dead members receive
no new private messages. Initial teammate knowledge remains available to living
members. All private dialogue is visible in post-game reveal only.

This is the bounded agent scheduling adaptation of day-and-night private threads;
it is not an unrestricted real-time chat UI.

## Resolution and information

A kill action may include `killer`, chosen from the offered living `actors`.
All Wolves should agree on target and killer. If omitted, the submitting Wolf
nominates themself, preserving compatibility with prior policies. Conflicting
(target, killer) pairs use a seeded tally, independent of arrival order. The
selected killer performs one visit; a block on that killer prevents the kill.
Blocked submitters cannot cause the game to reroute the kill to another actor.

Alchemist block resolves before Chef jail, then Guard protection, then kill.
A power Wolf may kill and use its ability on the same night. Priest sees actual
successful visits, including a protected kill attempt; nominations by other pack
members are not visits. Distinct destinations are returned once. A blocked Priest
gets `no_result`; a target with no visits yields an empty list.

Track Reader gets a role, not an alignment field; Sheep and ordinary Wolf both
return `vanilla`. Information results are delivered only to their rightful living
recipient. Dairy Maid's recipient learns the sender's identity as town. Seer
reports Trickster as non-wolf in custom games.

Trickster victory takes precedence after vote elimination and awards only that
seat a score of 1. Night death does not trigger it. Wolf parity counts all living
non-wolves, including a custom Trickster. Town victory scores only town seats.

The game retains explicit port conventions: no self-targeted night powers,
no posthumous information delivery, strict-majority day votes, and a day-cap draw.
These bounded timing and tie conventions are adaptations where the setup page
does not specify executable details.

## Timing and verification

There are 26 windows per day. Default windows are 3500ms, with eight days and a
180-second connection limit: 938 seconds including the artifact allowance, within
the 978-second bound. Faster scripted fixtures use 100ms windows.

```sh
WCW_SETUP=A2 npm run episode:local -- artifacts/newd3-a2
npm test
npm run typecheck
```

All nine presets have full scripted Session/replay tests. Focused tests cover
jail/block order, selected killer, two-target tracking, role checks, information
privacy, Noble knowledge, daytime chat delivery, and custom Trickster victory.
The A2 process test used one game plus nine independent policies and finished
with a Town win on day six, 518 replay events, and zero fallbacks. Artifacts:
`artifacts/newd3-a2/`. For a future
paid test, `WCW_SETUP=A2 npm run episode:llm -- artifacts/llm-newd3-a2` selects the
same setup; do not mistake logical-clock testing for hosted latency validation.

Old rules/1 replays remain readable. Their historical outcomes and certification
reports do not certify the changed rules/2 runtime.
