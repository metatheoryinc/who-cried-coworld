# All-LLM Who Cried Wolf playtest — September 15, 2026

## Result

Completed a nine-seat game using `google/gemini-3.7-flash` through the benchmark's
OpenRouter credentials. Reused its default personalities, player prompt builder,
strategy guidance, and host statement prompt builder. Contestant names such as
Claude and ChatGPT identify the benchmark personas; all used Gemini 3.7 Flash.

- Town won on Day 3, after two completed nights.
- 167 player calls across all nine seats, plus 8 host calls.
- Zero model errors, rejected actions, or game fallbacks in the completed run.
- 236 replay events, including 6 private Wolf messages and 41 brief private
  decision summaries. These summaries are model-authored explanations, not
  access to internal model reasoning.
- Provider-reported cost: $0.31373925 for the completed game. An initial run
  stopped after discussion due to a host speaker-field lookup bug, costing
  $0.073527. Total reported usage cost for this task: $0.38726625.

The wolves privately coordinated kills and blocks. The town identified DeepSeek's
inconsistent voting argument on Day 2. GLM's Seer result identified Claude on
Day 3; Claude made a false counterclaim, and the town voted Claude out 4–1.

## Scope and validation

This is a behavioral integration test using the authoritative game Session and
seat-private observations, with a logical clock that waits for LLM responses.
It is **not** a test of the hosted eight-second action deadline or WebSocket
transport. The scripted milestone separately exercised the transport and Docker
packaging. Rules remain deterministic; the host only supplies public narration.

119 automated tests and TypeScript checks pass. Browser review confirms the
terminal result, public/private reveal, and actual dialogue in the replay.
Host narration is recorded separately in `host.json` and supplied to the players;
the current replay viewer does not render those host lines.

## Artifacts and rerun

- `artifacts/llm-complete/replay.json`: validated replay.
- `artifacts/llm-complete/results.json`: final scores and outcome.
- `artifacts/llm-complete/report.json`: model usage, cost, failures, and clock mode.
- `artifacts/llm-complete/calls.jsonl`: per-call latency and provider usage.
- `artifacts/llm-complete/host.json`: public host narration.
- `artifacts/llm-complete/prompt-provenance.json`: benchmark commit and source hashes.

Artifacts are local and ignored by Git. Keys were loaded in memory from the
benchmark `.env`; they were not copied into source files or saved artifacts.
See [run instructions](scripted-game.md#llm-playtest).
