# League accounts: which player holds which policy

Softmax limits each account to **2 active players**, and a league seats one champion per player. So
the nine roster models are spread over five Softmax accounts (signed in through GitHub). Each player is
named after the policy it plays, so anyone can match a leaderboard entry to its model.

League: **Who Cried Wolf Competition Pilot** (`league_a10c10a8-46da-4f0f-bff6-4087c8dac619`).

| GitHub account | Player (= policy) | Model | Player id | Policy version |
| --- | --- | --- | --- | --- |
| signed in as jt@metatheory.gg (EntropyFails' account) | `EntropyFails` (personal; Playtests Haiku champion) | Claude Haiku 4.5 (`wcw-bedrock-haiku:v18`, Playtests) | `ply_ab9a5599-9e99-464d-8fee-07acdc46d25d` | — |
|  | `wcw-gemini` (renamed from `EF_gemini`) | `google/gemini-3.8-flash` | `ply_37566da1-f9f6-4131-977c-ef4357c4c9ad` | _fill in_ |
| `jtmetatheory` or `entropyfails` (whichever the account above is not) | `wcw-chatgpt` | `openai/gpt-5.6-luna` | _fill in_ | _fill in_ |
|  | `wcw-haiku` | `anthropic/claude-haiku-4.5` | _fill in_ | _fill in_ |
| `jt-sm1-mt` | `wcw-gpt-oss` | `openai/gpt-oss-120b` | _fill in_ | _fill in_ |
|  | `wcw-llama` | `meta-llama/llama-4-maverick` | _fill in_ | _fill in_ |
| `jt-sm2-mt` | `wcw-deepseek` | `deepseek/deepseek-v4.1-flash` | _fill in_ | _fill in_ |
|  | `wcw-mistral` | `mistralai/mistral-medium-3.1` | _fill in_ | _fill in_ |
| `jt-sm3-mt` | `wcw-glm` | `z-ai/glm-5.3` | _fill in_ | _fill in_ |
|  | `wcw-kimi` | `moonshotai/kimi-k3` | _fill in_ | _fill in_ |

The script prints each player id and policy version as it goes; copy them into the table.

## Uploading an account's two models

Run from the repository root, with Docker running and the player image built (`wcw-player:local`, built
by `coworld build`).

1. **Sign in as the account.** This opens GitHub in your browser:

   ```bash
   uv run --project /Users/jt/projects/coworld softmax login
   ```

   Check it with `uv run --project /Users/jt/projects/coworld softmax status`.

2. **Run the script with that account's two policies.** For example, for `jt-sm1-mt`:

   ```bash
   tools/roster-players.sh league_a10c10a8-46da-4f0f-bff6-4087c8dac619 wcw-gpt-oss wcw-llama
   ```

   For each policy it creates a player with that name, or reuses one, uploads the model's policy as that
   player, and submits it to the league. A new account starts with one default player. When the
   2-player limit refuses a create, the script renames the default player instead.

   **On the EntropyFails account**, rename `EF_gemini`, not the default `EntropyFails`:

   ```bash
   RENAME=ply_37566da1-f9f6-4131-977c-ef4357c4c9ad tools/roster-players.sh league_a10c10a8-46da-4f0f-bff6-4087c8dac619 wcw-gemini
   ```

3. **Check the champions** once the submissions place (a few minutes):

   ```bash
   uv run --project /Users/jt/projects/coworld coworld memberships --league league_a10c10a8-46da-4f0f-bff6-4087c8dac619 --champions-only
   ```

Logs for each step land in `artifacts/roster-players/`. The script always switches the CLI back to
the account's main user when it finishes. Signing in again to your usual account afterwards (step 1)
puts everything back.

## Also in the league

- **Seeds** (`seed_policy_number` 0, so they take no seats in ranked games): the nine `EntropyFails` policies
  `wcw-chatgpt:v8`, `wcw-bedrock-haiku:v18`, `wcw-gemini:v8`, `wcw-gpt-oss:v8`, `wcw-llama:v8`,
  `wcw-deepseek:v6`, `wcw-mistral:v8`, `wcw-glm:v8` and `wcw-kimi:v8`. They were added to test lobby
  seating. Lobbies seat players, not seeds, so they did not appear.
- **Older entries under `EntropyFails`**: `wcw-*` v7/v5 submissions from before per-model players. Retire them
  once the per-model champions are in (`coworld retire-membership`).
