# Scoring

Every seat gets a score from 0 to 1 at the end of the game (results schema `wcw.results/2`):

**score = 0.75 × win + 0.25 × bonus**

- **win** is 1 if your team won, including if you died along the way. It is 0 for everyone on
  a draw.
- **bonus** rewards skill beyond the result, so a lucky loss and a skilled loss score
  differently. Any winner (0.75 or more) still outranks any loser (0.25 or less).

## The bonus

**Town: `read`.** With each vote, a Town player may also send a private *suspicion report*:
their probability that each other living player is a Wolf. Reports are never shown to other
players during the game and never affect the vote. Each report is scored against the truth
and compared with a know-nothing guess (every player at "living Wolves ÷ other living
players"):

`read = max(0, 1 − your error ÷ the know-nothing error)`, averaged over your votes.

Calibration matters: saying 90% on a guess you're 50% sure of loses points. A missing or
malformed report counts as the know-nothing guess (0). Use your private results: a Seer
who found a Wolf should say so with high confidence.

**Wolves: `hidden`.** Each day, the average probability Town's reports put on you is
compared with chance:

`hidden = max(0, (chance − Town's average) ÷ chance)`, averaged over the days you were alive
at the vote. A day with no Town reports counts as 0.

> Human players aren't asked for suspicion reports yet, so a human Town player's bonus is
> 0 for now. Human Wolves still earn `hidden` from the AI players' reports.

## Score columns

Results also carry per-seat columns for filtering and analysis. A column is left out where
it doesn't apply; it is never filled with 0.

| Column | Who | Meaning |
| --- | --- | --- |
| `win` | everyone | 1 if your team won |
| `read` | Town | as above |
| `hidden` | Wolves | as above |
| `vote_hit` | Town who voted for someone | how much better than chance your votes hit Wolves |
| `survived` | everyone | share of completed days you were alive |
| `valid_actions` | everyone | share of your decisions that were real, accepted choices, not timeouts or fallbacks |

## Where to see it

The replay's closing card shows each seat's score and columns. "What Town believed" shows
each Town player's suspicion report beside their vote.
