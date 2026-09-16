# Pudge Wars local human-play test

## Result

Verified on September 15, 2026 using Docker Desktop on Apple Silicon with
`DOCKER_DEFAULT_PLATFORM=linux/amd64`. No full Metta platform was needed.

The participation guide selected `cow_01b9f22d-5255-4d22-a111-af7ed5861fac`,
Pudge Wars 0.3.21. The downloaded game image has digest
`sha256:0f2f493bb8e980e685acc73380a2e8e1d007a6b5cdb7593f5fc33f3275d27e5b`.

## Evidence

- Standard `coworld run-episode` completed the bundled 160-tick fixture.
  Six seats each threw three hooks; the short episode ended in a 0–0 draw.
  Results, replay bytes, and all six policy logs exist in `.local/pudge-smoke/`.
- Directly launched the same game image with the `duel-1v1` configuration,
  two local seat tokens, and just one bot container (Rusher, slot 1).
- Opened `/client/player?slot=0&token=local-human` in the browser. Its launcher
  redirected to the version-pinned hosted WASM client with the local `/ws` address.
- Server logged `coworld ws seat 0 joined: Player` and `starting with 2/2 players`.
- Right-clicking terrain moved the human-controlled character visibly.
- The authoritative `/global` stream reported `started:true`, `paused:false`,
  advancing ticks, slot 0 at x=52.681/y=39.516, and an active slot 1 bot with
  its hook on cooldown. A subsequent state snapshot is saved at
  `.local/pudge-human/verified-state.json`.
- Opened the baseline replay in the pinned WASM viewer with a loopback HTTP
  artifact server allowing the viewer origin through CORS. The six named bots,
  arena, event feed, and advancing replay timeline rendered (observed tick 49/160).
  The older sibling CLI's replay-container route returned 404; the static viewer
  path worked.
- Ran the saved launcher successfully and opened a fresh duel for user review.

This proves local browser control alongside a bot and baseline replay rendering.
It does not prove the full Softmax lobby/account workflow or a complete
human-played match.

### Durable state excerpt

The later saved snapshot reported tick 1084, seed 658317673, `started:true`,
`paused:false`, and `done:false`. Human slot 0 was at (40.328, 50.356) with
1128 HP; Rusher slot 1 was at (92.5, 84.286) with 1200 HP. These values are
recorded here because `.local/` contains ignored, machine-local artifacts.

## Connection layout

```text
Human browser (slot 0) -- binary /ws ---------+
                                            |
                                     Local game :8766
                                            |
Rusher container (slot 1) -- JSON /player ----+

Read-only observer ---------------- /global
```

The launcher supplies two tokens in the game config and starts only the slot 1
policy container. The browser claims slot 0; the game starts when both seats
connect. This is a direct game connection, not a locally replicated Observatory
account, matchmaking, or lobby service.

## Reproduce

Run `bash scripts/pudge-local.sh` from this repository. It downloads the pinned
package, creates a fresh artifact directory, and starts a game and bot.
Open the printed player URL within ten minutes. Right-click terrain to move.
The duel runs up to eight minutes or ten kills.

```bash
# From the mt-port repository:
bash scripts/pudge-local.sh

# Human player:
# http://127.0.0.1:8766/client/player?slot=0&token=local-human

# Live spectator:
# http://127.0.0.1:8766/client/global
```

Launcher: [scripts/pudge-local.sh](../../scripts/pudge-local.sh).
The URLs work only while the local game container is running. Reaching the
match deadline requires starting a fresh episode, not just refreshing the tab.

To repeat the standard bot smoke test, use a fresh output directory:

```bash
export DOCKER_DEFAULT_PLATFORM=linux/amd64
export COWORLD_CLI=/Users/jt/projects/coworld/.venv/bin/coworld
"$COWORLD_CLI" download cow_01b9f22d-5255-4d22-a111-af7ed5861fac --output-dir .local/coworld
"$COWORLD_CLI" run-episode \
  .local/coworld/cow_01b9f22d-5255-4d22-a111-af7ed5861fac/coworld_manifest.json \
  -o .local/pudge-smoke-repeat --timeout-seconds 120
```

Use `bash scripts/pudge-local.sh stop` to stop the two experiment containers.
After stopping, remove those containers with
`docker rm mt-port-pudge-duel mt-port-pudge-bot` before starting again.
Logs stay in Docker until container removal; episode files stay in `.local/`.
The launcher defaults to the existing sibling Coworld CLI; set `COWORLD_CLI`
to use another installed executable. It uses Docker Desktop's
`host.docker.internal` to connect the bot to the loopback-published game port.

The game is local, but its browser assets are served from the package's pinned
Vercel URL. This is not an offline setup. Fixed tokens are for this loopback-only
experiment; they are not production credentials.

## Implication for Who Cried Wolf

The public CLI's explicit human-roster rejection is a launcher restriction,
not evidence that game containers cannot accept a local human. A small local
launcher can allocate a browser seat and launch bots for the other seats.
Who Cried Wolf still needs its own authenticated player interface, shared action
validation, private observations, and human-appropriate decision deadlines.
Pudge Wars' binary browser protocol is game-specific; we need not copy it.

**Next WCW milestone:** implement the authoritative game and participant client,
then reproduce one human action alongside a scripted bot before adding LLM
policies. Local verification can proceed independently of access to the private
Metta monorepo. Hosted human-plus-agent acceptance remains a separate test.

Sources: [participation guide](https://softmax.com/api/observatory/v2/participate?league_id=league_84ab9f1e-5fb8-4b62-a3ac-e49026bd12d0),
[published package](https://softmax.com/observatory/v2?detail=coworld:cow_01b9f22d-5255-4d22-a111-af7ed5861fac).
