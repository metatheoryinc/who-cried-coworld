# Who Cried Wolf Visual Integration Design

## Intent

Make the spectator prototype feel like *Who Cried Wolf* while preserving the
Coworld-specific ability to understand the episode: public conversation,
discarded deliberations, wolf chat, night choices, votes, outcomes, and replay
position remain legible and navigable.

The user confirmed that the graphics in `tofu-tech` are theirs and authorized
their reuse in this prototype.

## Chosen direction: game-first hybrid

The illustrated village is the stage, not decorative wallpaper around a
dashboard. Day, vote, night, and finished states change the world behind the
episode. Player identity and episode evidence remain structured overlays so the
surface still answers “what happened?” without reconstructing the game from
animation alone.

The alternatives were rejected for this pass:

- A skin over the current dark theater would keep too much dashboard character.
- A near-copy of the original play UI would subordinate chat history and replay
  evidence, which are central to this Coworld.

## Visual system

- Use the original day and night village backgrounds and illustrated frame.
- Use the title artwork in the masthead.
- Use original player-card layers for the seat rail and role icon artwork after
  roles become visible.
- Use paper/chat textures for speech, deliberation, vote, and outcome panels.
- Preserve a dark translucent treatment for material that was private during
  play, keeping its different epistemic status obvious.
- Use the original transition compositions as full-width episode beats at day
  and night boundaries. The transition text remains derived from accepted event
  evidence; the illustration never invents an outcome.
- Keep the replay transport fixed and readable over both day and night art.

## Behavior and boundaries

The presentation fold remains the only place that maps projected events to UI
beats. No wire shape, redaction rule, game decision, or replay export changes.
Live public bytes remain public-only. Completed replay reveal controls remain a
viewing preference over already-exported material.

Phase artwork is selected only from public phase and elimination evidence:

- day start: first-day or night-result transition art;
- night start: day-result transition art;
- active day/night stage: matching village background;
- finished: matching original game-over treatment.

Reduced-motion users get static transitions. Narrow layouts keep the horizontal
seat rail and single-column evidence flow.

## Asset scope

Copy a bounded set into `docs/design/prototype/assets/wcw/`; do not depend on
absolute paths into `tofu-tech`. Record the source repository revision in the
prototype asset README. The prototype will not copy the unused high-resolution
tree.

## Acceptance

- The first viewport is recognizably *Who Cried Wolf* without opening a panel.
- Day and night states use their corresponding illustrated world.
- A phase boundary displays the corresponding original transition artwork.
- Speech, private reveals, votes, and replay controls remain readable.
- Existing 45 projection/privacy assertions still pass unchanged.
- Design checks pass and refreshed screenshots demonstrate day, night,
  transition, outcome, and responsive states.

