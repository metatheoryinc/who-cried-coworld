# Dead chat (the Graveyard) — design

Status: agreed design, not yet implemented. October 2, 2026.

## Why

A human who dies early in Who Cried Wolf can only watch. Most Mafia games give the dead a chat of their own. With
mostly AI tables, a dead human would be talking to nobody, so dead AI players join in, and the human can ask the
Wolf who was voted out after them why it did what it did. The cost of AI replies must be zero unless a dead human
is actually talking.

## Rules

- **The Graveyard** is a chat channel for every dead player, human or AI. It is on by default in every game.
- **The dead still cannot speak to the living.** Living players never see the Graveyard during the game, and
  nothing in it reaches a living player's observation. Town, Wolf and Noble chat stay closed to the dead.
- **Dead humans can post at any time**, in every phase, until the game ends. The existing per-sender chat limits
  apply: 30 messages per phase, at least 2 seconds apart.
- **AI only reply to people.** Each human message triggers at most one dead AI reply. AI never reply to each
  other and never start a conversation.
- **The ghost's view.** Dead humans see every player's role. Dead AI do not; they only talk to the dead and don't
  need it.
- **No scoring effect.** Graveyard messages are not scored, and missing or failed replies are not counted as
  failures or invalid actions.
- **Replay.** Graveyard messages appear as their own channel under Everything. No spoilers hides them, like Wolf
  and Noble chat.

## Who answers

When a dead human posts and at least one dead AI exists:

1. **Named.** If the message names a dead AI (`mentionsName` from `src/shared/player-names.ts`; lettered names like
   Haiku and Haiku B keep this unambiguous), that AI answers. Costs no model call.
2. **AI host.** Otherwise, with the LLM host, the host picks among the dead AI. Its input lists each dead AI with
   its link to the human: voted for them, killed them, or none. The host runs inside the game, so it knows who
   held the knife; its pick only ever shows in the Graveyard, which only the dead (who see all roles) can read.
   The host prefers a linked AI. The host call has the same 2-second limit as speaker selection; on
   timeout or an invalid choice, fall through to step 3.
3. **Random.** Without the LLM host, or as the fallback, a random dead AI, drawn from the game's seeded RNG so
   replays are reproducible.

If no AI is dead yet, nobody replies and the dead humans talk to each other.

**Rate limits.** At most one AI reply is outstanding at a time. Human messages that arrive while a reply is
pending do not trigger another; the replying AI sees them in its observation anyway. At most 6 AI replies per
phase across the whole Graveyard. Together these cap Graveyard model use per phase at 6 player calls plus, with the
LLM host, 6 host calls.

## Cost gate

The game is the only thing that starts a model call. A dead AI's process stays connected until the game ends but
receives no requests, so it costs nothing. Graveyard requests are created only in response to a dead human's
message. All-AI games, and human games where no human has died, make no extra calls.

## Protocol

New optional request kind, sent only to dead AI seats:

```ts
{kind:'dead_chat', maxCharacters:240}
```

Reply:

```ts
{kind:'dead_chat', text:GameText(240), summary:NoteText}
```

- Deadline: 15 seconds, the same per-request limit as other AI requests. It is not tied to the phase clock, so a
  reply can land after a phase change.
- A policy that does not support `dead_chat` (an older or third-party policy) answers with an error or not at all.
  The game drops the request silently: no `failure` event, no effect on `valid_actions`.
- 240 characters, not 480: Graveyard lines are banter, and short replies keep cost and latency down.

## Observations for dead seats

Today `buildObservation` refuses dead seats (`src/game/runtime/observation.ts:12`). It changes to allow exactly
one case: a dead seat answering `dead_chat`. That observation is `project(journal, slot)` as usual, so a dead AI
sees:

- all public events up to now: live Town chat, ballots once revealed at dusk, deaths and each victim's role,
  night outcomes that were announced;
- its own past actions and private results (a dead Seer remembers what it learned);
- team chat only up to its death (team messages go to the living team members at the time they are sent);
- the Graveyard conversation;
- `self.alive: false`, which the prompt uses to tell it that it is a ghost.

It does not see draft votes (nobody does before dusk) or other players' roles.

## Visibility

Team chat uses a fixed seat list chosen when the message is sent. The Graveyard needs a rule that follows deaths:
a player who dies later should see the Graveyard's history. Add a visibility kind:

```ts
{kind:'dead'}  // visible to any seat that is dead when the journal is projected
```

`project(journal, slot)` resolves it against the seat's current alive state. Living seats never match, so the
"dead cannot speak" invariant is enforced in one place. The replay treats `dead` like the team channels:
shown under Everything, hidden under No spoilers.

The ghost's view for dead humans is a snapshot change, not a journal change: a dead human's snapshot includes the
roles event's contents.

## Player (our policy)

- `src/player/policy.ts` and `prompt.ts`: handle `dead_chat`. The prompt says the player is dead, gives its role and
  how it died, and asks for one short in-character reply to the latest human message. A dead Wolf may confess;
  nothing it says can affect the game.
- `src/player/scripted.ts` (baseline): no reply. The baseline makes no model calls, and canned lines add nothing.

## Player page and replay viewer

- **Player page (`src/viewer/player.js`).** When the seat dies, a **Graveyard** chat tab opens and becomes the
  default tab. Town and team tabs stay readable but cannot be typed into, as today. Role cards for every seat
  appear (the ghost's view). Unread badges work as for team chats.
- **Replay (`src/viewer/branded.js`).** Graveyard messages get their own filter tab next to Public and Private,
  styled as ghostly (dimmed avatars). Hidden under No spoilers.

## Docs

- Wiki: Rules and roles (the Graveyard and the ghost's view), Play with friends (what happens when you die), Build a
  policy (`dead_chat` is optional, 240 characters, never scored).
- Manifest protocol and readme text, regenerated.

## Testing

- A dead human's message creates exactly one `dead_chat` request, to the named dead AI; else the host's pick; else
  a seeded random pick.
- No dead human: no `dead_chat` requests in a full game.
- Living seats never see a Graveyard event, in observations or snapshots, before or after more deaths.
- A seat that dies later sees the Graveyard's earlier messages.
- Outstanding-reply and 6-per-phase limits hold under a burst of human messages.
- A policy that rejects `dead_chat` produces no failure event and no change to scores or metrics.
- A dead AI's observation contains Town chat from after its death and no team chat from after its death.
- Replay: Graveyard under Everything, absent under No spoilers.

## Rollout

Ship in the same release as the 30-second night (0.2.9). League champions need re-uploading from each account
(`tools/roster-players.sh`) to answer in the Graveyard; until then they simply stay silent there.

## Not doing

- An epilogue where the living and dead chat after the game.
- Living AI hearing the Graveyard (its memory could carry dead information into the live game).
- A lobby setting to turn the Graveyard off.
