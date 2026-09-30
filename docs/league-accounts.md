# League accounts: which player holds which policy

Softmax limits each account to **2 active players**, and a league seats one champion per player. So the
nine roster models are spread over five Softmax accounts (signed in through GitHub). Each player has the
same name as the policy it plays, so anyone can match a leaderboard entry to its model.

Names are `wcwl-<seat>`. Policy names are global across Softmax, and the `wcw-<seat>` policies belong to the
jt@metatheory.gg account, so the league policies use a new prefix.

League: **Who Cried Wolf Playtests** (`league_9d8825e1-58ff-48ee-ac3d-c6953e048b9b`). It is public and you
own it. The Competition Pilot (`league_a10c10a8-46da-4f0f-bff6-4087c8dac619`) is private, so other accounts
get 404 there.

| Account | Player (= policy) | Model | Player id | Policy version |
| --- | --- | --- | --- | --- |
| jt@metatheory.gg | `wcwl-gemini` (renamed from `wcw-gemini`) | `google/gemini-3.8-flash` | `ply_37566da1-f9f6-4131-977c-ef4357c4c9ad` | `wcwl-gemini:v2` (submitted to Playtests) |
| jt@entropyfails.com | `wcwl-chatgpt` | `openai/gpt-5.6-luna` | `ply_71d4f92c-2326-4ea0-b180-48956c3700db` | `wcwl-chatgpt:v1`, stale image: re-upload |
|  | `wcwl-haiku` | `anthropic/claude-haiku-4.5` | `ply_ccd0ec92-e97d-4804-808a-c679e9a9623d` | `wcwl-haiku:v1`, stale image: re-upload |
| `jt-sm1-mt` | `wcwl-gpt-oss` | `openai/gpt-oss-120b` | _to do_ | _to do_ |
|  | `wcwl-llama` | `meta-llama/llama-4-maverick` | _to do_ | _to do_ |
| `jt-sm2-mt` | `wcwl-deepseek` | `deepseek/deepseek-v4.1-flash` | _to do_ | _to do_ |
|  | `wcwl-mistral` | `mistralai/mistral-medium-3.1` | _to do_ | _to do_ |
| `jt-sm3-mt` | `wcwl-glm` | `z-ai/glm-5.3` | _to do_ | _to do_ |
|  | `wcwl-kimi` | `moonshotai/kimi-k3` | _to do_ | _to do_ |

The script prints each player id and policy version as it goes; copy them into the table.

Uploads go through `tools/coworld-llm-upload.py`. Softmax now rejects the `USE_BEDROCK` policy secret that
the released coworld CLI (0.1.55) sends, and enables the hosted model sidecar from non-secret policy env
(`COWORLD_LLM_ENABLED`, `COWORLD_LLM_MODEL`). The wrapper sends that instead. The player reads
`COWORLD_LLM_ENDPOINT` and `COWORLD_LLM_MODEL`, and falls back to the older Bedrock variable names.

## Uploading an account's two models

Run from the repository root, with Docker running. The script builds the player image
(`wcw-player:local`) from the current source and checks that it starts before uploading.

1. **Sign in as the account.** This opens GitHub in your browser:

   ```bash
   uv run --project /Users/jt/projects/coworld softmax login
   ```

   Check it with `uv run --project /Users/jt/projects/coworld softmax status`.

2. **Run the script with that account's two policies.** For example, for `jt-sm1-mt`:

   ```bash
   tools/roster-players.sh league_9d8825e1-58ff-48ee-ac3d-c6953e048b9b wcwl-gpt-oss wcwl-llama
   ```

   For each policy it creates a player with that name, or reuses one, uploads the model's policy as that
   player, and submits it to the league. A new account starts with one default player. When the
   2-player limit refuses a create, the script renames the default player instead.

   **On jt@metatheory.gg** the existing player `wcw-gemini` was renamed to `wcwl-gemini` automatically (done):

   ```bash
   tools/roster-players.sh league_9d8825e1-58ff-48ee-ac3d-c6953e048b9b wcwl-gemini
   ```

3. **Check the champions** once the submissions place (a few minutes):

   ```bash
   uv run --project /Users/jt/projects/coworld coworld memberships --league league_9d8825e1-58ff-48ee-ac3d-c6953e048b9b --champions-only
   ```

Logs for each step land in `artifacts/roster-players/`. The script always switches the CLI back to
the account's main user when it finishes. Signing in again to your usual account afterwards (step 1)
puts everything back.

The account signed in as jt@metatheory.gg also keeps your personal player `EntropyFails`
(`ply_ab9a5599-9e99-464d-8fee-07acdc46d25d`). It fields no model in this league. In the separate
**Playtests** league (`league_9d8825e1-58ff-48ee-ac3d-c6953e048b9b`) it holds the Haiku champion,
`wcw-bedrock-haiku:v18`, which lobbies there seat.

## Also in the league

- **Seeds** (`seed_policy_number` 0, so they take no seats in ranked games): the nine `EntropyFails` policies
  `wcw-chatgpt:v8`, `wcw-bedrock-haiku:v18`, `wcw-gemini:v8`, `wcw-gpt-oss:v8`, `wcw-llama:v8`,
  `wcw-deepseek:v6`, `wcw-mistral:v8`, `wcw-glm:v8` and `wcw-kimi:v8`. They were added to test lobby
  seating. Lobbies seat players, not seeds, so they did not appear.
- **Older entries under `EntropyFails`**: `wcw-*` v7/v5 submissions from before per-model players. Retire them
  once the per-model champions are in (`coworld retire-membership`).
