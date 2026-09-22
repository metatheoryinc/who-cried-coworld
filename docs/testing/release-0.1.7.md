# Hosted LLM moderator release

Coworld 0.1.7 updates the game-side moderator to use Softmax's OpenRouter-backed
proxy. Its public model setting is `anthropic/claude-haiku-4.5`; the proxy supplies
credentials. Select `moderator: "llm"` in a paced variant. `default` keeps the
deterministic host; fast mode retains bid ranking. Haiku v5 player policies work
with either choice.

The initial 0.1.6 hosted test reached the proxy but rejected Haiku's Markdown-fenced
JSON. Local reproduction confirmed the formatting mismatch. Version 0.1.7 accepts
a single fenced JSON response while retaining strict schema, speaker eligibility,
name, size, and duplicate-key validation. Slow or invalid choices still fall back.

Source commit: `fe9b1dd`. All 254 tests and typecheck passed. Local certification
passed all 10 checks with a 180-second limit. A prior 60-second local certification
attempt for 0.1.6 timed out while its scripted fixture was still progressing.

Evidence for the initial hosted failure is in ignored
`artifacts/release-0.1.6-certification/`. Final release evidence is in
`artifacts/release-0.1.7-certification/`.

## Published verification

Coworld: `cow_6b9031bc-97aa-411f-8bbd-e548835b9a3d` (canonical).
All 10 hosted certification checks and five hosted smoke episodes passed.

Experience request: `xreq_46afefda-36b7-4c2e-8a15-c7de656ff545`.
Episode: `ereq_707301fc-3a10-461a-aea4-716fe7535f62`.
The one-day test completed with nine Haiku v5 policies and `moderator: "llm"`.
All six moderator calls selected a valid speaker, with no fallbacks. Latencies
were 934, 1002, 1506, 893, 1024, and 1066 ms. Invitations used the registered Haiku
names and remained neutral in the sampled turns. This verifies the game-side
proxy and moderator response handling, not human-lobby connectivity.

For new games select Coworld 0.1.7, the human or standard variant,
`moderator: "llm"`, and `wcw-bedrock-haiku:v5` policies.
