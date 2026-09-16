# Bedrock inference for players and moderator

The shared adapter uses the AWS SDK's Bedrock Runtime Converse API. Select a model
or inference profile that supports Converse. The client explicitly uses HTTP/1.1
for compatibility with loopback sidecars. Hosted calls go
to `AWS_ENDPOINT_URL_BEDROCK_RUNTIME`; the SDK uses the platform's injected
credentials and region. There is no public-AWS retry if the sidecar fails.

## Backend selection

| Setting | Meaning |
| --- | --- |
| `WCW_LLM_PROVIDER=auto` | Default: prefer Bedrock when its endpoint is present; otherwise use Bedrock for `USE_BEDROCK=true`/`1`, or OpenRouter. |
| `WCW_LLM_PROVIDER=openrouter` | Explicitly use personal OpenRouter credits, even if a sidecar is present. |
| `WCW_LLM_PROVIDER=bedrock` | Explicit Bedrock: sidecar if supplied, otherwise direct AWS via the SDK credential chain. |
| `BEDROCK_MODEL` | Required Bedrock model/inference-profile ID; never an OpenRouter model slug. |
| `WCW_MODERATOR_PROVIDER` | Optional moderator-only backend override. |
| `WCW_MODERATOR_BEDROCK_MODEL` | Optional separate host model ID; otherwise uses `BEDROCK_MODEL`. |
| `WCW_BEDROCK_MAX_TOKENS` | Player output ceiling, default 1,600, configurable from 1 to 16,384. Host stays capped at 600. |

`AWS_ENDPOINT_URL_BEDROCK_RUNTIME` is the hosted signal. `USE_BEDROCK` alone selects
direct AWS for local testing; it does not prove hosted access. Explicit Bedrock or
sidecar detection without a model fails startup with a configuration error. The host
can be disabled with `WCW_MODERATOR=off`. No automatic model-ID substitution occurs.
OpenRouter settings, including the Gemini schema and DeepSeek output cap, remain
unchanged. Bedrock uses portable Converse parameters rather than sending unsupported
OpenRouter reasoning or response-format fields. JSON instructions and local action
validation still apply.

## Hosted setup

Upload each policy version with Softmax's `--use-bedrock --bedrock-model MODEL_ID`
options. That configures the player pod; game-container moderation is configured
separately with `WCW_MODERATOR_BEDROCK_MODEL` (a public model ID, not a credential).
The game uses the sidecar injected into its own container. Model access and regional
availability must be verified on the platform. The existing OpenRouter roster does
not imply the same models are available through Bedrock.

Never bake AWS/OpenRouter credentials or a sidecar URL into the image or manifest.
Use runtime credential injection. Direct local AWS testing uses your AWS credential
chain and may incur charges. The packaged client needs `COWORLD_PLAYER_WS_URL` as
usual; for local mixed-model launchers a single `BEDROCK_MODEL` selects the model
for all policy seats. Independently hosted player processes can each select their
own model. Names remain display names, not provider guarantees.

## Deadlines and fallback

The SDK has one attempt per call. Our decision loop retains its bounded repair
retry, unchanged deadline, and legal fallback. HTTP 429/5xx are retryable within
that budget; 400/403 are not. Truncated/empty/filtered responses receive classified
diagnostics. SDK exception bodies are not logged. Bedrock usage uses native token
counts; it does not provide OpenRouter's dollar-cost field.

Moderator calls retain their two-second budget and deterministic fallback. They
are attributed to the game; no player-slot header is sent for neutral moderation.
This integration targets platform-hosted policy containers, not game-hosted file
policies that require per-seat request attribution.

## Verification

Tests cover backend selection, missing model configuration, Converse translation,
usage extraction, truncation, throttling, permission failures, and both player and
moderator use without an OpenRouter key. A real SDK request is exercised against a
local HTTP stub to check endpoint routing and that 429 does not trigger SDK retries.
No paid AWS or hosted Bedrock call was made during implementation. Hosted access and
model-specific response latency remain to be verified.

References: [Softmax Bedrock guide](https://docs.softmax.com/coworld/build-a-player/bedrock),
[game runtime contract](https://github.com/Metta-AI/coworld/blob/main/src/coworld/docs/roles/GAME.md#bedrock-and-aws-access),
[AWS Converse examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_bedrock-runtime_code_examples.html).
