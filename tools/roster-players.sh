#!/usr/bin/env bash
# Give each roster model its own Softmax player, upload that model's policy as the player,
# and submit it to a league. Player name = policy name, so anyone can match them.
#   tools/roster-players.sh <league_id> [image]
# Existing players with the same name are reused. The CLI is returned to the main user at the end.
set -euo pipefail
LEAGUE="${1:?league id}"; IMAGE="${2:-wcw-player:local}"
C=(uv run --project /Users/jt/projects/coworld coworld)
LOG=artifacts/roster-players; mkdir -p "$LOG"
trap '"${C[@]}" player unset >/dev/null 2>&1 || true' EXIT

ROSTER=(
  "wcw-chatgpt openai/gpt-5.6-luna"
  "wcw-haiku anthropic/claude-haiku-4.5"
  "wcw-gemini google/gemini-3.8-flash"
  "wcw-gpt-oss openai/gpt-oss-120b"
  "wcw-llama meta-llama/llama-4-maverick"
  "wcw-deepseek deepseek/deepseek-v4.1-flash"
  "wcw-mistral mistralai/mistral-medium-3.1"
  "wcw-glm z-ai/glm-5.3"
  "wcw-kimi moonshotai/kimi-k3"
)

player_id() { # id of the existing player with this exact name, if any
  "${C[@]}" player list --json 2>/dev/null | python3 -c '
import json,sys
t=sys.stdin.read(); i=t.find("[")
rows=json.loads(t[i:],strict=False) if i>=0 else []
print(next((r["id"] for r in rows if r.get("name")==sys.argv[1] and not r.get("disabled_at")),""))' "$1"
}

for row in "${ROSTER[@]}"; do
  read -r name model <<<"$row"
  id=$(player_id "$name")
  if [ -z "$id" ]; then
    "${C[@]}" player unset >/dev/null 2>&1 || true
    # Report a refused create (for example the account's active-player limit) instead of stopping silently under set -e.
    "${C[@]}" player create "$name" > "$LOG/$name.create.log" 2>&1 \
      || { echo "$name: player create refused: $(grep -o "Client error '[0-9]* [A-Za-z ]*'" "$LOG/$name.create.log" | head -1)"; continue; }
    id=$(player_id "$name")
  fi
  [ -n "$id" ] || { echo "$name: could not create or find the player (see $LOG/$name.create.log)"; continue; }
  "${C[@]}" player use "$id" > "$LOG/$name.use.log" 2>&1
  DOCKER_DEFAULT_PLATFORM=linux/amd64 "${C[@]}" upload-policy "$IMAGE" --name "$name" --run node --run build/llm-player.mjs \
    --use-bedrock --bedrock-model "$model" > "$LOG/$name.upload.log" 2>&1 </dev/null
  ver=$(grep -o "Upload complete: .*" "$LOG/$name.upload.log" | sed 's/Upload complete: //')
  [ -n "$ver" ] || { echo "$name: upload failed (see $LOG/$name.upload.log)"; continue; }
  "${C[@]}" submit "$ver" --league "$LEAGUE" --no-open-browser > "$LOG/$name.submit.log" 2>&1 </dev/null \
    && echo "$name ($id): $ver submitted" || echo "$name ($id): $ver submit failed (see $LOG/$name.submit.log)"
done
