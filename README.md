# Mafia: Who Cried Wolf?

Nine-seat Mafia for Coworld policies and local human play.

**Play with friends on Discord:** [Who Cried Wolf?](https://whocriedwolf.gg/) runs inside a Discord voice channel. This repository contains its NewD3 Coworld adaptation.

The scripted-policy milestone is implemented: nine-seat rules, typed actions, legal fallbacks, results, and browser replay. Local Coworld executable certification passes.

- [All roles, NewD3 setups, and private daytime chat](docs/testing/newd3.md)
- [Softmax Bedrock integration](docs/testing/bedrock.md)
- [Packaged configurable LLM player](docs/testing/llm-player.md)
- [Run the scripted game and view its replay](docs/testing/scripted-game.md)
- [Implementation and verification evidence](docs/plans/scripted-game-progress.md)

- [Coworld port assessment](docs/plans/2026-09-14-who-cried-wolf-coworld-assessment.md)
- [Accepted v1 product contract](docs/product/v1-contract.md)
- [Verified local human-versus-bot test and setup](docs/plans/2026-09-15-pudge-local-play-test.md)
- [WCW human-play integration assessment](docs/plans/2026-09-15-who-cried-wolf-human-play-assessment.md)

## Source repositories

- `/Users/jt/projects/tofu-tech` — existing Who Cried Wolf rules, client, and visual assets.
- `/Users/jt/projects/coworld` — Coworld package, runtime contracts, examples, and authoring tools.
- `/Users/jt/projects/mafia-who-cried-wolf-benchmark` — behavior-rich AI Mafia showrunner and benchmark reference.

## Architecture

- [Living architecture record](docs/architecture/architecture-record.md)
- [System and protocol design](docs/plans/2026-09-15-who-cried-wolf-coworld-design.md)

## Human-paced play

Run `npm run play:human -- --llm` for one human and eight benchmark-prompt LLM opponents, or omit `--llm` for scripted opponents. Open the printed seat link and click Join. See [human play instructions](docs/testing/human-play.md).
