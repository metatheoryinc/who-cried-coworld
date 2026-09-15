# Who Cried Wolf Visual Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the original Who Cried Wolf graphics into the spectator prototype without weakening its Coworld replay, evidence, or privacy behavior.

**Architecture:** Keep the accepted projected artifacts and presentation fold unchanged as sources of truth. Add a bounded local asset package and phase-aware presentation components around the existing beats, with transition artwork selected from public episode evidence.

**Tech Stack:** Static HTML/CSS/JavaScript, existing Node fixture assertions, Playwright capture script, PNG assets from the local `tofu-tech` repository.

---

### Task 1: Establish bounded visual assets

**Files:**
- Create: `docs/design/prototype/assets/wcw/README.md`
- Create: `docs/design/prototype/assets/wcw/*.png`
- Modify: `docs/design/check.mjs`

**Step 1: Write the failing check**

Extend `docs/design/check.mjs` to require the documented source revision and the
exact referenced visual asset set.

**Step 2: Run it to verify it fails**

Run: `node docs/design/check.mjs`

Expected: FAIL because the bounded asset directory and provenance record do not
exist.

**Step 3: Copy the minimal assets and record provenance**

Copy the day/night worlds, frame, title, paper/chat textures, player-card layers,
role icons, transition images, and game-over images actually referenced by the
prototype. Record source paths and `tofu-tech` revision.

**Step 4: Run the check**

Run: `node docs/design/check.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add docs/design/check.mjs docs/design/prototype/assets
git commit -m "design: add bounded Who Cried Wolf prototype assets"
```

### Task 2: Build the illustrated game stage

**Files:**
- Modify: `docs/design/prototype/index.html`
- Modify: `docs/design/check.mjs`

**Step 1: Write the failing structural checks**

Require the game-stage, world-layer, original title asset, phase state, and
original player-card/role artwork hooks in the rendered prototype source.

**Step 2: Run it to verify it fails**

Run: `node docs/design/check.mjs`

Expected: FAIL on missing game-first visual hooks.

**Step 3: Implement the stage**

Reshape CSS and markup around the existing seat rail, floor, and transport. Add
phase-aware day/night/finished background selection in `renderChrome`, parchment
public beats, darker private-evidence panels, illustrated seat treatments, and
role icons. Do not change artifact filtering or game derivation.

**Step 4: Run all checks**

Run:

```bash
node docs/design/prototype/build-fixtures.mjs
node docs/design/check.mjs
```

Expected: 45/45 assertions and design checks PASS.

**Step 5: Commit**

```bash
git add docs/design/prototype/index.html docs/design/check.mjs
git commit -m "design: make spectator prototype feel like Who Cried Wolf"
```

### Task 3: Add illustrated phase transitions

**Files:**
- Modify: `docs/design/prototype/index.html`
- Modify: `docs/design/check.mjs`

**Step 1: Write the failing transition checks**

Require a distinct transition beat, all four public outcome variants, and a
reduced-motion path.

**Step 2: Run it to verify it fails**

Run: `node docs/design/check.mjs`

Expected: FAIL on missing transition behavior.

**Step 3: Implement transition beats**

Render full-width transition compositions at phase boundaries. Select imagery
only from public phase/elimination evidence and derive captions from those same
events. Keep ordinary event cards immediately below the transition.

**Step 4: Run all checks**

Run:

```bash
node docs/design/prototype/build-fixtures.mjs
node docs/design/check.mjs
```

Expected: 45/45 assertions and design checks PASS.

**Step 5: Commit**

```bash
git add docs/design/prototype/index.html docs/design/check.mjs
git commit -m "design: add illustrated day and night transitions"
```

### Task 4: Refresh visual evidence and integrate

**Files:**
- Modify: `docs/design/capture.sh`
- Modify: `docs/design/evidence/*.png`
- Modify: `docs/design/reveal-and-spectator-design.md`

**Step 1: Add exact day/night/transition capture states**

Update the capture script so evidence covers the illustrated day stage, public
night hold, omniscient night evidence, a phase transition, outcome, and narrow
layout.

**Step 2: Generate evidence**

Run: `bash docs/design/capture.sh`

Expected: all declared screenshots regenerate without browser errors.

**Step 3: Inspect representative renders**

Open the day, night, transition, and narrow screenshots. Correct clipping,
contrast, or hierarchy problems in the responsible CSS.

**Step 4: Run the full verification set**

Run:

```bash
node docs/design/prototype/build-fixtures.mjs
node docs/design/check.mjs
git diff --check
git status --short
```

Expected: 45/45 assertions, design checks PASS, no whitespace errors, and only
the intentional visual/design changes staged for integration.

**Step 5: Commit, merge to main, and remove the worktree**

```bash
git add docs/design
git commit -m "docs: record illustrated spectator design evidence"
git -C /Users/jt/projects/mt-port merge --ff-only design/wcw-visual-integration
git -C /Users/jt/projects/mt-port worktree remove .worktrees/wcw-visual-integration
git -C /Users/jt/projects/mt-port branch -d design/wcw-visual-integration
```

