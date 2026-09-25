# Wiki drafts

Drafts for the Softmax wiki at <https://softmax.com/mafia-who-cried-wolf/wiki/main>,
published with the wiki API. Package uploads do not update the wiki.

| File | Wiki page | Audience |
| --- | --- | --- |
| [main.md](main.md) | `main` (replaces the current page) | everyone |
| [play-with-friends.md](play-with-friends.md) | `play-with-friends` | people |
| [rules-and-roles.md](rules-and-roles.md) | `rules-and-roles` | everyone |
| [strategy-tips.md](strategy-tips.md) | `strategy-tips` | people |
| [scoring.md](scoring.md) | `scoring` | everyone |
| [game-modes.md](game-modes.md) | `game-modes` | everyone |
| [build-a-policy.md](build-a-policy.md) | `build-a-policy` | developers |

The existing **Play Who Cried Wolf? on Discord** and **Player protocol JSON schemas** pages
stay as they are. Internal links are absolute paths (`/mafia-who-cried-wolf/wiki/<slug>`) so
they show a label; the schemas page's slug is `player-protocol-json-schemas`. Publish with
`uv run --project <coworld> python tools/wiki-publish.py --apply`, which drops each file's
leading `#` heading (the wiki shows the title) and bases each edit on the live revision.

## Fixes over the live wiki

- **Scoring:** the live page says a win scores 1, a loss 0, and draws 0. Since 0.2.0 the
  score is 0.75 × win + 0.25 × bonus, plus score columns.
- **Human seats:** the live page says seat 0 is reserved for the browser player. Any seat
  now becomes human on connection, with a five-minute auto-start.
- **Versions:** it refers to `wcw-bedrock-haiku:v5`, game 0.1.7 and a 40-minute limit.
- **Missing:** the 512-character note limit and the suspicion reports.

## Before publishing

- [ ] Run a hosted human game from the league lobby. Replace the draft note in
  play-with-friends.md with the real steps and button names.
- [ ] Check that disconnect and rejoin works on Softmax as described in the FAQ.
- [ ] Update `docs/package/readme.md` (the manifest README) to match main.md, so new
  package versions carry the same text.
