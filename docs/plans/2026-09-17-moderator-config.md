# Moderator configuration

Expose an optional top-level `moderator` enum: `default`, `llm`, `auto`.
Explicit game config overrides the legacy WCW_MODERATOR environment switch;
omission preserves it. Credentials/model selection remain runtime-only.
`default` never initializes a model. `llm` requires valid runtime provider settings
at startup, then retains deterministic fallback for failed selections. `auto`
permits configuration fallback. All paced variants share this setting; fast mode
uses bid ranking, permits default/auto, and rejects explicit llm.

Implementation: add schema and server wiring; test config precedence and both
paced modes, unavailable credentials, and fast incompatibility; regenerate the
manifest schema and embedded README; run full tests, typecheck and build.
No duplicate variants or scheduler changes. No publication or paid runs.
