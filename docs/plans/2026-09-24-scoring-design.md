# Scoring: win plus read/hidden bonus, with metric columns

**Status:** Approved 2026-09-24.

## Problem

Scores are 1 for the winning faction and 0 otherwise (all 0 on a draw). For Town
that is a weak signal: seven seats share one outcome, and in the benchmark's
200-game batch (`mafia-who-cried-wolf-benchmark/packages/engine/runs/batch-200`)
Day-1 Town votes hit a wolf 24.7% of the time against a 25.0% chance baseline
(42.0% vs 28.3% over all days, driven by flips and cop results). Coworld requires
scores that separate better play from worse, or improvement loops have nothing to
learn from.

## Headline score

`score = 0.75 × win + 0.25 × bonus`, bonus in [0, 1], same scale for both sides.

**Town bonus — `read`.** With each vote a living Town player may privately submit
a wolf probability for every other living player. Each report gets a Brier score
(mean squared error against truth: 1 for a wolf, 0 otherwise) and is compared with
a know-nothing report that gives every player `living wolves ÷ other living
players`. `read = max(0, 1 − Brier ÷ baseline Brier)`, averaged over the player's
vote requests; a missing or invalid report counts as the baseline (0). Using
private results (Seer, Dairy Maid clears) to sharpen reports is good play.

**Wolf bonus — `hidden`.** For each day, the mean probability that submitted Town
reports put on the wolf. `hidden = max(0, (chance − that mean) ÷ chance)`, averaged
over days the wolf was alive at the vote; a day with no Town reports counts as 0.

**Draws.** `win = 0` for everyone, but bonuses still count. This supersedes the v1
rule that every policy scores 0 on a draw.

Weights: any winner (≥ 0.75) outranks any loser (≤ 0.25); within a side the bonus
separates skilled from lucky play.

## Metric columns

Per seat under `metrics`, omitted where not applicable (never 0-filled):

| Column | Applies to | Meaning |
| --- | --- | --- |
| `win` | all | 1 if your faction won |
| `read` | Town | as above |
| `hidden` | Wolves | as above |
| `vote_hit` | Town with ≥ 1 non-skip vote | `max(0, (hit rate − mean chance) ÷ (1 − mean chance))` over your non-skip votes, chance per vote = living wolves ÷ other living players |
| `survived` | all | days completed alive ÷ days completed |
| `valid_actions` | all | requests answered with an accepted action ÷ requests received |

Results schema becomes `wcw.results/2`: `scores` (headline) plus `metrics`.

## Protocol

- Town seats' vote requests carry `suspicion: true`; Wolves' do not.
- The vote action body accepts optional `suspicion`: an object mapping every other
  living player's slot (as a string key) to a probability in [0, 1].
- A missing, extra-key, missing-key, or out-of-range map is recorded as missing; it
  never makes the vote illegal. Human drafts keep the latest map.
- Each accepted map is journaled as a `suspicion` event with server audience and a
  new `beliefs` reveal category: never in live observations or snapshots, revealed
  in replay.
- Scores are computed at game end from the journal and true roles.

## Confessionals

The vote's `summary` is already its confessional ("Why they voted"). The suspicion
map arrives in the same action: words and numbers from the same reasoning. The
confessional stays unscored.

## Policies, humans, replay

- **LLM prompt (Town votes):** explain the private, calibrated, scored suspicion
  field, that it does not affect the vote, that exaggerating or hedging lowers the
  score, and that private results should inform it. The strict schema includes it.
- **Scripted baseline:** omits it (read 0, the reference to beat).
- **Humans:** not asked in v1 (read 0).
- **Replay:** "Why they voted" shows each Town player's suspicion bars beside the
  confessional; a final "Scores" card shows each seat's score and columns.

## Testing

Formula tests (perfect = 1, baseline = 0, clamping, Wolf mirror, draws, omitted
columns); invalid maps never break votes; suspicion absent from live observations
and snapshots; results schema; scripted episode; small live LLM calibration check.

## Docs

Architecture record: scoring decision superseding "draws score 0" and the contract's
"diagnostics do not alter incentives". Package README and manifest describe scores.
