# Who Cried Wolf: Coworld integration and human play

Status: source-based WCW feasibility assessment, supplemented by a verified local Pudge Wars human-plus-bot experiment. Not a WCW implementation or hosted acceptance report.

## Verified local-play update

The [Pudge Wars local test](2026-09-15-pudge-local-play-test.md) succeeded: a browser
claimed slot 0, a bundled bot occupied slot 1, and browser input changed the
authoritative running game. The bot fixture and browser replay also worked.
This used the public package and Docker Desktop, without the full Metta platform.

The standard CLI still rejects explicit human rosters, but a small direct launcher
can reserve a browser seat and start policies for the other seats. Treat the older
CLI restriction below as a limit of that entry point, not a blocker for local
human-play development. The experiment used hosted browser assets and a local
game; it did not reproduce Softmax's account or lobby services.

## Conclusion

Who Cried Wolf fits Coworld's game-owned protocol and independently packaged player model. The existing replay-first design remains a sound base, but its human-play assumption needs updating: the current Coworld checkout already contains human episode participants, runner-injected browser seat tokens, and a Kubernetes runner that skips policy-container creation for human seats.

The recommended human-play target is one person plus eight independently replaceable agent policies in the same nine-seat episode. Human and agent actions reach the same authoritative rules engine. This supports cooperation or opposition according to their assigned factions. A human controlling a seat with an agent adviser is a different mode and should not accidentally permit two controllers to act for one seat.

The current source establishes feasibility, not that an end-to-end lobby is enabled for this game on softmax.com. Account-to-seat authorization, lobby creation/join APIs, deployment availability, and the external browser proxy still need hosted verification.

## What the repositories contribute

| Repository | Reuse | Work still required |
| --- | --- | --- |
| `tofu-tech` | Rules and role semantics, game theme, character and transition art | Separate game rules from Nakama/Discord/FanForge/Cloudflare hosting dependencies; retain only the initial role set |
| `mafia-who-cried-wolf-benchmark` | Show-mode role/personality prompts, visible transcript context, speaking bids, sequential private faction chat, typed votes/actions | Move model behavior into independent player containers; replace centralized provider orchestration and host authority with the game protocol |
| `coworld` | Runtime contracts, policy containers, results/replay packaging, hosted model access, human-seat runner support | Implement and certify the actual Who Cried Wolf game and browser clients; prove hosted participation |
| `mt-port` | Product/protocol designs, projected example fixtures, spectator prototype | This checkout has design evidence, not the production runtime, real model policies, playable human UI, or certified game package |

The current Tofu bot handler chooses random legal targets. It is not the desired conversational agent implementation. The benchmark's show mode is the better reference for personalities and expressive dialogue; its anonymous benchmark mode serves a different purpose.

## Architecture

1. **One authoritative game server:** roles, seeded randomness, turn windows, legal-action validation, votes, night resolution, victory, and results.
2. **One controller per seat:** either a Coworld policy process or an authenticated human browser. Both submit the same game-defined action types. A spectator/inspector connection never gains action authority.
3. **Separate player observations:** own role and private results, permitted faction chat, and public events. The game filters these before sending them.
4. **One audience-tagged event journal:** public speech, private conversations, authored explanations, ballots, choices, outcomes, and safe failure codes.
5. **Three presentation contexts:** participant, public spectator, and completed replay. They can share components, but must receive different authorized data.

Keep the first nine-seat lineup already designed: Wolf, Alchemist, Seer, Guard, and five Sheep. Additional roles remain a separate parity effort.

## Making agents behave like the show

- Supply role, ability, win condition, optional persona, bounded visible conversation, previous votes, and the seat's private knowledge.
- Ask for structured responses: whether to speak, urgency, proposed utterance, target when relevant, and a short explanation intended for the game record.
- Collect public bids concurrently and allocate the floor fairly. Commit the winning utterance directly, rather than generating a different speech afterward.
- Run Wolf conversations sequentially so teammates can respond to each other and settle on a plan.
- Keep votes and night actions typed and deterministic; a model cannot override the judge.
- Bound message length, context size, retries, and phase duration. Invalid or missing responses receive a legal fallback.
- Adapt the benchmark's OpenRouter provider to the supported hosted provider path. Coworld's Bedrock contract requires `AWS_ENDPOINT_URL_BEDROCK_RUNTIME`, `InvokeModel`, and the configured model identity.

"Deliberation" should be explicitly authored, concise explanations or confessionals, not hidden model reasoning. These are what the agent reports about its choice; they are not guaranteed causal accounts of how a model reached it.

## What viewers can see

| Information | Human participant during play | Public spectator during play | Completed replay |
| --- | --- | --- | --- |
| Public discussion, votes, deaths | Yes | Yes | Yes |
| Own role and private ability results | Own seat only | No | Allowed reveals |
| Wolf conversation | Authorized living faction members | No | Yes, if allowlisted |
| Other agents' short explanations and discarded bids | No, unless explicitly public game actions | No | Yes, if allowlisted |
| Prompts, credentials, raw provider diagnostics, hidden reasoning | No | No | No |

The current prototype loads both example fixtures for demonstration. A real live player or spectator page must never load the completed replay export while the game is running. Hiding it behind a toggle is insufficient. With human participants, live replay publication and access to policy logs/artifacts also need review to prevent an external source of spoilers.

## Human support: source evidence and limits

- [`CoworldHumanPlayerSpec`](../../../coworld/src/coworld/types.py) accepts `type: "human"` and a private browser seat token.
- [`episode_player_tokens`](../../../coworld/src/coworld/runner/runner.py) preserves the supplied human token in the game's roster.
- [`_run_kubernetes_episode`](../../../coworld/src/coworld/runner/kubernetes_runner.py) launches containers only for policy seats, retains slot positions, and recognizes mixed episodes as lobbies.
- The same runner optionally exposes `COWORLD_HUMAN_PLAYER_PROXY_PORT` on its service. This is evidence of an integration seam, not the complete external proxy implementation.
- [`V2EpisodeRequestHumanParticipant`](../../../coworld/src/coworld/api_client.py) records human identity alongside policy participants; episode rows include `live_url`.
- [`Runner tests`](../../../coworld/tests/test_coworld_kubernetes_runner.py) exercise a human plus policy roster and the proxy service port. These are mocked unit tests, not evidence of a successful hosted browser session.
- [`play_coworld`](../../../coworld/src/coworld/play.py) explicitly rejects human-seat requests: they require the hosted Kubernetes runner. A browser inspector under `coworld play` is not proof of local mixed-seat support.

Some package prose still says hosted execution runs all player containers. The explicit human models and runner branches are more specific evidence. Neither the public website's general human/agent language nor this checkout proves production availability for a new game.

## Changes needed in the current WCW design

1. Replace the v1 read-only `/client/player` experience with a separately authorized controller mode for human seats. Keep inspector mode read-only.
2. Add role/ability briefing, public speech submission, vote selection, private faction chat, night-action controls, deadline status, and action acknowledgments.
3. Add lobby readiness and reconnect behavior. A disconnected human must not hang the episode; a stale tab must not replay an old action. Decide explicitly whether duplicate controller connections replace or reject each other.
4. Add a human-paced preset. The existing maximum eight-second window and total episode budget cannot simply be reused for someone reading and typing. Tune discussion and action deadlines, then recalculate the maximum episode duration against the platform timeout.
5. Decide how humans request the floor. Preserve fair speech opportunities without requiring a person to produce machine-oriented urgency/reason JSON.
6. Verify the platform lobby/create/join and proxy contracts with one hosted human seat before committing to that user journey. Do not invent a supported CLI command from the presence of a runner schema.
7. Keep mixed games unranked initially unless the league explicitly supports their attribution, timing, and scoring rules.

These are proposed amendments. The existing product contract still defers mixed human/AI seats until that scope is deliberately adopted.

## Recommended delivery sequence and effort

1. **Local capability proof — completed in Pudge Wars:** browser input alongside a bot works with a direct launcher. Use this pattern for the WCW vertical slice. Separately confirm the hosted lobby entry point before hosted acceptance; access to the full Metta environment is not a prerequisite for local development.
2. **WCW vertical slice:** nine-seat deterministic engine, legal baseline policies, authenticated observations, human controls, and one complete day/night cycle.
3. **Behavior-rich policies:** adapt show prompts, bids, faction dialogue, bounded explanations, and hosted model access.
4. **Spectator/replay product:** connect the prototype to real projected events and build the immutable replay bundle.
5. **Acceptance:** complete episodes, malformed/late action handling, reconnects, secrecy tests, certification, and a recorded human-plus-eight-agent hosted episode.

The prior 5–8 engineer-week estimate for a polished agent/replay version remains a planning range, not measured remaining work. Budget roughly another 1–3 engineer-weeks for human controls and mixed-session reliability if the hosted lobby path is available. Platform work is unestimated until the capability proof; browser validation and current design work reduce uncertainty but do not replace runtime implementation.

## Sources and confidence

Inspected working-tree code at Coworld `6506e67`, Tofu `bd90913c4`, and benchmark `efc993d`; commit IDs identify HEAD, not an assertion that each tree is clean. Also reviewed the existing assessment, product contract, system design, and implementation plan in this repository.

Key source files: [Tofu bots](../../../tofu-tech/apps/@hotpot-arcade/packages/games/mafia/src/server/machine/handlers/bot-handler.ts), [benchmark prompts](../../../mafia-who-cried-wolf-benchmark/packages/engine/src/llm/openRouterProtocol.ts), [floor controller](../../../mafia-who-cried-wolf-benchmark/packages/engine/src/domain/floorController.ts), [Coworld game contract](../../../coworld/src/coworld/docs/roles/game.md), [hosted model contract](../../../coworld/src/coworld/docs/BEDROCK.md), and [current WCW system design](2026-09-15-who-cried-wolf-coworld-design.md).

Public context: [Softmax](https://softmax.com/) describes humans and coding agents participating in multiplayer games; [its documentation](https://docs.softmax.com/) describes packaging, competing, and replay inspection. No hosted game was launched and no production human-play entitlement was verified during this assessment.
