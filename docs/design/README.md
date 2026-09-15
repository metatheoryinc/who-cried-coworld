# Design

| Artifact | What it is |
| --- | --- |
| [`reveal-and-spectator-design.md`](reveal-and-spectator-design.md) | The canonical spectator/reveal design. Visibility model, surface, component model, payload contract, architecture dependencies, acceptance states. |
| [`prototype/`](prototype/) | A runnable design prototype. Open `prototype/index.html` in a browser; no build, no network. |
| [`evidence/`](evidence/) | Rendered captures referenced by the acceptance table. |

## Prototype

```
node docs/design/prototype/build-fixtures.mjs     # rebuild the two projections and run the privacy assertions
open docs/design/prototype/index.html
```

- `episode-source.mjs` — authored, omniscient episode. **Never loaded by the page.**
- `project.mjs` — the projection; per-kind projectors that construct allowlisted payloads.
- `build-fixtures.mjs` — generates `fixtures/live-public.js` and `fixtures/replay-export.js`, and asserts the privacy properties.
- `index.html` — the renderer, fed only by the two generated projections.

Deep links for capturing states: `?source=live|replay&reveal=aired|omniscient&cursor=N&deps=1&open=2,8`.

This is design evidence, not production code, and its mocked mechanics are abridged — see
§12 of the design guide for what is still unreconciled.
