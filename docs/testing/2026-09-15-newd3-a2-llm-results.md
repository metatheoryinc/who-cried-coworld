# NewD3 A2 LLM playtest — September 15, 2026

Completed with nine Gemini 3.7 Flash policies via the benchmark OpenRouter
credentials and default personality/player/host prompts. Names are personas;
Claude and DeepSeek below both ran Gemini, not their namesake models.

## Result

- Wolves won at parity after Night 3 (rules `wcw.rules/2`).
- Claude: Wolf; DeepSeek: Alchemist; Llama: Priest; GLM: Chef; others: Sheep.
- 218 player calls and 9 host calls; zero model errors or game fallbacks.
- 329 replay events, including 24 daytime Wolf messages.
- Provider-reported cost: $0.54556275.

## What happened

Day 1 voting split without a majority. The wolves killed ChatGPT that night.
Llama tracked Mistral and received an empty visit list.

Day 2, seven players voted out Qwen. DeepSeek blocked GLM's jail, and Claude
performed the agreed kill on Llama. The Priest died before receiving the next
tracking result.

Day 3, five players voted out Gemini. The wolves killed GLM that night and
reached two wolves versus two town. Claude and DeepSeek both scored 1.

Their daytime channel contained explicit coordination about which players to
pressure, maintaining separate public personas, avoiding obvious mutual defenses,
and responding to public wagons. This verifies that daytime coordination was
used; one run does not establish that it caused the different outcome.

## Timing and replay

This used the previously agreed logical-clock harness. Player-call p95 latency
was 1794ms and maximum was 4036ms; one call exceeded the standard 3500ms window.
Zero fallbacks here therefore does not establish zero fallbacks under real-time
Coworld timing. Host narration remains a separate sidecar supplied to players.

The branded browser viewer loaded the completed replay with the correct outcome
and new role labels, without browser console errors.

Artifacts (local, ignored by Git):

- `artifacts/llm-newd3-a2/replay.json`
- `artifacts/llm-newd3-a2/results.json`
- `artifacts/llm-newd3-a2/report.json`
- `artifacts/llm-newd3-a2/calls.jsonl`
- `artifacts/llm-newd3-a2/host.json`
- `artifacts/llm-newd3-a2/prompt-provenance.json`

Rerun with `WCW_SETUP=A2 npm run episode:llm -- artifacts/<new-directory>`.
