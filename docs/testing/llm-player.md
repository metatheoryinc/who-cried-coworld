# Standalone LLM player

`build/llm-player.mjs` is a single-seat Coworld client. It does not start a game or
other players. The `player` Docker target contains both entrypoints:

- `node build/player.mjs`: original scripted baseline, no LLM.
- `node build/llm-player.mjs`: configurable OpenRouter/Bedrock policy with scripted operation
  when OpenRouter is selected and no credential is supplied, and bounded legal fallbacks on provider failure.

## Runtime configuration

| Variable | Meaning |
| --- | --- |
| `COWORLD_PLAYER_WS_URL` | Required runner-supplied WebSocket URL with seat authentication. |
| `WCW_MODEL` | Model for this process/seat; defaults to `openai/gpt-oss-120b`. |
| `OPENROUTER_API_KEY` | Runtime OpenRouter credential. Missing/empty means scripted play in OpenRouter mode. Bedrock uses the AWS credential chain. |
| `WCW_PLAYER_PROMPT` | Optional personality text; otherwise uses the bundled benchmark personality for that seat. |

Provide each seat its own environment to choose different models or personalities.
Credentials and seat URLs must not be baked into images or manifest environment.

```sh
npm run build
# With the runner's variables already exported:
node build/llm-player.mjs
```

The manifest declares `scripted` and `llm` runnables using the same player image.
Its certification fixture assigns one seat to `llm` and eight to `scripted`; without
credentials this verifies the LLM client's protocol/lifecycle through its scripted path.
That is not evidence of hosted external-provider access.

## Shared implementation

Local mixed-model games and the standalone client use `src/player/policy.ts`:
current action validation, schema-metadata cleanup, Gemini structured outputs,
per-provider settings, one bounded repair retry, and legal fallback actions.
The client deduplicates observations, cancels superseded work, reconnects with a
bounded retry count, and exits on the terminal message. Structured attempt logs go
to stdout; rejected-response excerpts can contain private game information.

Prompt construction is self-contained in `src/player/prompt.ts`. Contestant defaults
and the condensed strategy primer were copied from the benchmark on September 16,
2026; no benchmark checkout is needed to build or run the image. The local launcher
still loads credentials from the benchmark `.env` for convenience.

## Free smoke test

```sh
npm run build
node tools/local-episode.mjs artifacts/llm-client-smoke-02 --llm-baseline
```

This runs the actual bundled LLM client in one seat with credentials explicitly
cleared, plus eight scripted processes, and checks for a complete replay with no
failure events. Use a fresh artifact directory.

For hosted-sidecar detection, Bedrock model IDs, AWS credentials, and provider selection, see [Bedrock integration](bedrock.md).
