# Design

| Artifact | What it is |
| --- | --- |
| [`reveal-and-spectator-design.md`](reveal-and-spectator-design.md) | The canonical spectator/reveal design. Visibility model, surface, component model, payload contract, architecture dependencies, acceptance states. |
| [`prototype/`](prototype/) | A runnable design prototype. Open `prototype/index.html` in a browser; no build, no network. |
| [`evidence/`](evidence/) | Rendered captures referenced by the acceptance table. |

## Prototype

```
node docs/design/prototype/build-fixtures.mjs   # rebuild the projections; runs 38 schema and privacy assertions
node docs/design/check.mjs                      # links, code fences, evidence references
bash docs/design/capture.sh                     # regenerate every capture in evidence/
open docs/design/prototype/index.html
```

- `episode-source.mjs` — the authored internal journal, omniscient by construction. **Never loaded by the page.** Shaped to the accepted `wcw.events/1` union; it does not define one.
- `project.mjs` — the projection and the audience/reveal matrix; one constructing projector per accepted payload kind.
- `build-fixtures.mjs` — generates `fixtures/live-public.js` (a `wcw.viewer/1` reset packet), `fixtures/replay-export.js` (a `wcw.replay/1` bundle) and `fixtures/notes.js` (the settled decisions the holdings drawer lists), and asserts schema conformance and privacy.
- `index.html` — the renderer. Folds accepted payload kinds into presentation beats; see §10.2 of the design guide for the mapping.

Deep links for capturing states: `?source=live|replay&reveal=aired|omniscient&cursor=N&deps=1&open=2,4`.
`capture.sh` records the exact viewport and query behind every file in `evidence/`, so a capture is
reproducible rather than remembered. Two traps it encodes: headless Chrome clamps the viewport to a
500px minimum, and the floor's deferred scroll pin needs `--virtual-time-budget` to settle.

This is design evidence, not production code. The authoritative wire schemas live in
`docs/plans/2026-09-15-who-cried-wolf-coworld-design.md` §6-7; this prototype is shaped to them
and never redefines them. Settled decisions and remaining limitations are §12 of the design guide.
