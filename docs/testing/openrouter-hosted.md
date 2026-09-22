# Hosted OpenRouter policy with a personal key

The existing LLM player supports OpenRouter. No game rebuild is required.
Upload a separate policy with `OPENROUTER_API_KEY`, `WCW_LLM_PROVIDER=openrouter`,
and `WCW_MODEL` in Softmax's policy-scoped secret environment. This explicitly
selects OpenRouter even if a Bedrock endpoint is present.

Softmax stores policy secret environments in AWS Secrets Manager and injects them
into that policy version's process. The key is entrusted to Softmax and the policy
process; it is not part of the Docker image, public manifest, browser UI, or replay.
OpenRouter calls consume the personal account's credits. A dedicated, capped key
can limit the budget independently from other uses of the account.

## Repeat the upload

Use Node 24 and a Python environment with Coworld installed. From this repository:

```sh
node tools/upload-openrouter-policy.mjs \
  --python /Users/jt/projects/coworld/.venv/bin/python \
  --env-file /Users/jt/projects/mafia-who-cried-wolf-benchmark/.env \
  --name wcw-openrouter-haiku \
  --model anthropic/claude-haiku-4.5
```

The image defaults to `wcw-player:local`; `--image` overrides it. Add `--dry-run`
to verify the inputs without uploading. An existing `OPENROUTER_API_KEY` in the
environment takes precedence over the file. Only the key is read from the file;
unrelated credentials are not uploaded.

The helper passes credentials to the Python uploader through stdin, never argv,
and redacts the key from captured uploader output. It writes no credential files.
Do not run with shell tracing or paste a key into a command or chat.

Use the exact version printed by the uploader for subsequent games. Do not select
the diagnostic policy with personal credentials: it is unnecessary for this test.
The normal player reports credential presence and provider status without values.

## Verification scope

A successful upload alone does not prove that the human-lobby launcher injects
policy secrets. First verify an Experience Request's logs show provider
`openrouter`, credential presence, and successful responses. Then separately test
the human lobby. If it also omits `OPENROUTER_API_KEY`, changing providers cannot
repair that launcher behavior.

## First hosted check — September 17, 2026

Uploaded `wcw-openrouter-haiku:v1` using the existing player image and personal
OpenRouter key via policy secret storage. No game rebuild was needed.

- Experience request: `xreq_238b6f6d-35c9-4834-a717-49719ed36375`
- Episode: `ereq_de928bab-2c2f-458f-bf73-d359b1b37166`
- All nine processes reported `provider=openrouter`, `openRouterKeyConfigured=true`,
  and `allowScripted=false`.
- All 41 inference attempts failed without an HTTP status: 12 transport errors
  and 29 timeouts. None of the 29 distinct requests had an accepted model response.
- The episode completed via legal fallbacks; completion is not evidence of working
  inference.
- A local call with the same key and model returned HTTP 200 and model content in
  971 ms. This confirms the key/model worked locally at verification time.

Secret injection is verified for Experience Requests. Hosted outbound connectivity
to OpenRouter remains unresolved; these logs do not distinguish DNS, connection,
TLS, or platform network restrictions. Human-lobby injection is also unverified.
Do not treat this policy version as a working hosted LLM until that is resolved.
Evidence is under ignored `artifacts/openrouter-hosted-v1/`.

The upload helper passed syntax checking and a synthetic-secret check verifying
stdin transport, absence from child argv/environment, and stdout/stderr redaction.
All 12 targeted startup/provider/policy tests passed.
