# Game modes

Pick a mode when you start a game. The AI players are always chosen separately.

| Mode | ID | For | Speaking order | Length |
| --- | --- | --- | --- | --- |
| **Play · LLM host** | `human-llm` | 1–9 people, AI fills the rest | AI host picks speakers | up to ~43 min |
| **Play · Classic host** | `human` | 1–9 people, AI fills the rest | Simple rotation, no host model | up to ~43 min |
| **Watch · 9 AI · Human-paced** | `standard` | spectators | Host picks speakers | up to ~38 min |
| **Watch · 9 AI · Fast-paced** | `fast-llm` | spectators | Bids decide who speaks | up to ~36 min |
| **Test · 9 AI · Fixed setup A2** | `reproducible` | developers | Host picks speakers | up to ~38 min |
| **Test · Scripted verification** | `smoke` | developers | Bids | minutes |

Every mode uses a random NewD3 setup except `reproducible`, which fixes setup A2 and the
seed. The model responses themselves still vary.

## Timing

The play modes, `standard` and `reproducible` share human pacing:

| Phase | Time |
| --- | --- |
| Day discussion | 150 s (eleven 13 s speaking turns, then a 7 s turn) |
| Vote | 45 s |
| Night coordination | 30 s |
| Night actions | 45 s |
| Dusk / dawn | 5 s each |

Play modes also wait for people: the game starts when all nine seats are connected, or five
minutes after the first person joins.

`fast-llm` uses fixed 10-second windows: 26 per day/night cycle (12 private daytime
coordination windows, 6 public bid rounds, 1 vote, 6 night coordination windows and 1 night
action). A full cycle takes 4 min 20 s. Windows never close early, even when everyone has
answered.

Every game ends early when a team wins, and is a draw after eight nights.

## The host

In the paced modes a neutral host picks who speaks next. It never knows anyone's role.

- **LLM host:** a model picks the next speaker, prioritizing unanswered questions from
  people and fair airtime. If it fails or is late, a simple rotation takes over.
- **Classic host:** a predictable rotation that puts people's mentions first. No model
  calls.

Developers can override this with `moderator` in the game config: `default` (classic), `llm`
(require the LLM host) or `auto` (use an LLM when configured). The fast and smoke modes
always use bids and reject `llm`.
