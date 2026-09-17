# Release 0.1.5 verification

Published September 17, 2026, from source commit `13f577c`.

## Published versions

- **Mafia: Who Cried Wolf? 0.1.5**: `cow_49027dc6-1f81-476a-b3cb-ec6ded9a65c9`
- **wcw-bedrock-haiku:v4**: policy version `b97b5df2-aa03-450b-badb-5e9c192b7626`
- **wcw-bedrock-diagnostic:v4**: compact environment-name diagnostics, without environment values.

Both policies were uploaded with `--use-bedrock` and model
`us.anthropic.claude-haiku-4-5-20251001-v1:0`.

The game is canonical. Its manifest hash is
`sha256:3a56c75053a01a6aad74bc017c9bff3cb1feb22369cc3865f1f4b3027b9ce758`.

## Verification

- 252 tests across 40 files passed; typecheck and build passed.
- Staged secret scan found no leaks before the source commit was pushed.
- Local package certification passed all 10 checks.
- Hosted package certification passed all 10 checks and all five smoke episodes.

## Live Bedrock and name registration test

Experience request: `xreq_44807cec-c393-4eb0-8a8c-e894ccdb51de`.
Episode: `ereq_a93088f4-7aca-4e35-8dd4-789535017732`.

Nine Haiku v4 policies played the standard variant with deterministic moderation,
setup A1, and a one-day cap. Discussion lasted 78 seconds, voting 10 seconds,
coordination 20 seconds, and night actions 10 seconds. The game completed with
the expected day-cap draw.

The replay's roster contains `Haiku`, `Haiku-2` through `Haiku-9`, in seat order.
The original platform labels are retained as `policyName` metadata. Public chat
explicitly distinguishes these names, including Haiku-3 discussing Haiku and
Haiku-2. This verifies that resolved names reach the policies as well as the UI.

All nine policy processes reported configured Bedrock access with scripted mode
disabled. All 37 inference attempts returned HTTP 200; median latency was
2,429 ms. Five attempts failed action validation, and retries recovered them.
All 29 distinct policy requests had an accepted response. The replay also records
three game-level illegal-action retries; the run completed without an unrecovered
provider failure.

Evidence is stored locally under the ignored
`artifacts/release-0.1.5-certification/` directory, including the replay, nine policy
logs, request configuration, certification output, and inference summary.

This verifies hosted Experience Requests. It does **not** establish that the
human-lobby launcher now injects Bedrock credentials: earlier diagnostic lobbies
reported no inference-related environment variables. Use the v4 diagnostic policy
to recheck that separate platform path when the hosting fix is available.
