# Human host variants implementation plan

**Goal:** Let lobby users select an LLM or classic moderator without overrides.

**Architecture:** Preserve the `human` ID with explicit `moderator: default`; add
`human-llm` with `moderator: llm`. Reuse the same nine-seat runtime and timers,
including existing deterministic fallback for unsuccessful moderator calls.

**Tech stack:** TypeScript manifest generator, Zod config validation, Vitest.

## Approved design and implementation

1. Update `tools/manifest.ts` with the two named variants.
2. Update package and human-play docs with the choices and league-lobby command.
3. Regenerate `coworld_manifest_template.json`.
4. Run existing manifest and moderator tests plus type checking; inspect the diff.

Publishing, the human connection timeout fix, and additional human seats are
separate work. No hosted game is launched as part of this change.
