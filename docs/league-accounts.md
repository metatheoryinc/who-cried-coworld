# League accounts: which player holds which policy

Softmax limits each account to **2 active players**, and a league seats one champion per player. So the
nine roster models are spread over five Softmax accounts (signed in through GitHub). Each player has the
same name as the policy it plays, so anyone can match a leaderboard entry to its model.

Names are `wcwl-<seat>`. Policy names are global across Softmax, and the `wcw-<seat>` policies belong to the
jt@metatheory.gg account, so the league policies use a new prefix.

League: **Who Cried Wolf Playtests** (`league_9d8825e1-58ff-48ee-ac3d-c6953e048b9b`). It is public and you
own it. The Competition Pilot (`league_a10c10a8-46da-4f0f-bff6-4087c8dac619`) is private, so other accounts
get 404 there.

| Account | Player (= policy) | Model | Player id | Champion in Playtests |
| --- | --- | --- | --- | --- |
| jt@metatheory.gg | `wcwl-gemini` | `google/gemini-3.8-flash` | `ply_37566da1-f9f6-4131-977c-ef4357c4c9ad` | `wcwl-gemini:v3` |
| jt@entropyfails.com | `wcwl-chatgpt` | `openai/gpt-5.6-luna` | `ply_71d4f92c-2326-4ea0-b180-48956c3700db` | `wcwl-chatgpt:v2` |
|  | `wcwl-haiku` | `anthropic/claude-haiku-4.5` | `ply_ccd0ec92-e97d-4804-808a-c679e9a9623d` | `wcwl-haiku:v2` |
| `jt-sm1-mt` | `wcwl-gpt-oss` | `openai/gpt-oss-120b` | `ply_0f041c65-96ea-41b3-8959-1ef7e4d02236` | `wcwl-gpt-oss:v1` |
|  | `wcwl-llama` | `meta-llama/llama-4-maverick` | `ply_6adb0bee-914d-44f5-af4e-ee82f7ed5f19` | `wcwl-llama:v1` |
| `jt-sm2-mt` | `wcwl-deepseek` | `deepseek/deepseek-v4.1-flash` | `ply_6a6b62c9-2a6b-4cea-a014-d143bef2546c` | `wcwl-deepseek:v1` |
|  | `wcwl-mistral` | `mistralai/mistral-medium-3.1` | `ply_a30ef6a0-13f2-420e-9bba-efdd4008154d` | `wcwl-mistral:v1` |
| `jt-sm3-mt` | `wcwl-glm` | `z-ai/glm-5.3` | `ply_4421cb16-1282-4de2-9bf1-582a3bdf1eca` | `wcwl-glm:v1` |
|  | `wcwl-kimi` | `moonshotai/kimi-k3` | `ply_89337967-d27e-4206-b87e-b3f093d41218` | `wcwl-kimi:v1` |

All nine became champions on October 1, 2026, uploaded with coworld 0.1.56 `--use-llm`.

Uploads use coworld 0.1.56 or later (`uvx --from coworld==0.1.56 coworld`). Its `upload-policy --use-llm
--llm-model <slug>` stores `COWORLD_LLM_ENABLED` and `COWORLD_LLM_MODEL` as policy **secrets**, and that is what
attaches the hosted model sidecar to the player. Policies uploaded the older way (the `USE_BEDROCK` secret, or
those two values as plain policy env) start without `COWORLD_LLM_ENDPOINT` and cannot act. Hence every policy
up to `wcwl-gemini:v2` needs re-uploading. The player reads `COWORLD_LLM_ENDPOINT` and `COWORLD_LLM_MODEL`.

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
(`ply_ab9a5599-9e99-464d-8fee-07acdc46d25d`). In Playtests it is still a champion with
`wcw-bedrock-haiku:v18`. That version was uploaded with the old `USE_BEDROCK` secret, so it gets no hosted
model and plays as a dead seat. Retire it, or re-upload it with `--use-llm`, before ranked rounds.

## Also in the league

- **Seeds** (`seed_policy_number` 0, so they take no seats in ranked games): the nine `EntropyFails` policies
  `wcw-chatgpt:v8`, `wcw-bedrock-haiku:v18`, `wcw-gemini:v8`, `wcw-gpt-oss:v8`, `wcw-llama:v8`,
  `wcw-deepseek:v6`, `wcw-mistral:v8`, `wcw-glm:v8` and `wcw-kimi:v8`. They were added to test lobby
  seating. Lobbies seat players, not seeds, so they did not appear.
- **Older entries under `EntropyFails`**: `wcw-*` v7/v5 submissions from before per-model players. Retire them
  once the per-model champions are in (`coworld retire-membership`).
