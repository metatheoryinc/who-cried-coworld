#!/usr/bin/env bash
# Give roster models their own Softmax players on the signed-in account, upload each model's policy as its
# player, and submit it to a league. Player name = policy name, so anyone can match them.
#
#   tools/roster-players.sh <league_id> [policy-name ...]     # default: all nine models
#   IMAGE=wcw-player:local tools/roster-players.sh ...          # player image to upload (default shown)
#   RENAME=ply_... tools/roster-players.sh ...                  # player to rename when the account is full
#
# Accounts are limited to 2 active players. When creating a player is refused, the script renames a player
# instead: $RENAME if given, otherwise the account's default player (never one already named after a model).
# Sign in to the right account first (`uv run --project <coworld> softmax login`). See docs/league-accounts.md.
set -euo pipefail
LEAGUE="${1:?league id}"; shift
IMAGE="${IMAGE:-wcw-player:local}"
C=(uv run --project /Users/jt/projects/coworld coworld)
API=https://softmax.com/api/observatory
LOG=artifacts/roster-players; mkdir -p "$LOG"
trap '"${C[@]}" player unset >/dev/null 2>&1 || true' EXIT

model_of() { # macOS ships bash 3.2, which has no associative arrays
  case "$1" in
    wcw-chatgpt) echo openai/gpt-5.6-luna ;;
    wcw-haiku) echo anthropic/claude-haiku-4.5 ;;
    wcw-gemini) echo google/gemini-3.8-flash ;;
    wcw-gpt-oss) echo openai/gpt-oss-120b ;;
    wcw-llama) echo meta-llama/llama-4-maverick ;;
    wcw-deepseek) echo deepseek/deepseek-v4.1-flash ;;
    wcw-mistral) echo mistralai/mistral-medium-3.1 ;;
    wcw-glm) echo z-ai/glm-5.3 ;;
    wcw-kimi) echo moonshotai/kimi-k3 ;;
  esac
}
if [ $# -gt 0 ]; then NAMES=("$@"); else NAMES=(wcw-chatgpt wcw-haiku wcw-gemini wcw-gpt-oss wcw-llama wcw-deepseek wcw-mistral wcw-glm wcw-kimi); fi

token() { uv run --project /Users/jt/projects/coworld python -c "import yaml,pathlib;print(yaml.safe_load((pathlib.Path.home()/'.softmax/credentials.yaml').read_text())['tokens']['https://softmax.com/api'])" 2>/dev/null; }
players_json() { "${C[@]}" player list --json 2>/dev/null; }
player_id() { # id of the active player with this exact name, if any
  players_json | python3 -c '
import json,sys
t=sys.stdin.read(); i=t.find("["); rows=json.loads(t[i:],strict=False) if i>=0 else []
print(next((r["id"] for r in rows if r.get("name")==sys.argv[1] and not r.get("disabled_at")),""))' "$1"
}
rename_target() { # $RENAME, else the default player unless it already carries a model name
  if [ -n "${RENAME:-}" ]; then echo "$RENAME"; return; fi
  players_json | python3 -c '
import json,sys
t=sys.stdin.read(); i=t.find("["); rows=json.loads(t[i:],strict=False) if i>=0 else []
d=next((r for r in rows if r.get("is_default") and not r.get("disabled_at")),None)
print(d["id"] if d and not d["name"].startswith("wcw-") else "")'
}

for name in "${NAMES[@]}"; do
  model=$(model_of "$name"); [ -n "$model" ] || { echo "$name: not a roster model"; continue; }
  id=$(player_id "$name")
  if [ -z "$id" ]; then
    "${C[@]}" player unset >/dev/null 2>&1 || true
    if ! "${C[@]}" player create "$name" > "$LOG/$name.create.log" 2>&1; then
      # Account full (2 active players): rename a player to this model instead.
      target=$(rename_target)
      [ -n "$target" ] || { echo "$name: account is full and has no player to rename (set RENAME=ply_...)"; continue; }
      code=$(curl -s -o "$LOG/$name.rename.json" -w "%{http_code}" -X PATCH -H "Authorization: Bearer $(token)" \
        -H "Content-Type: application/json" -d "{\"name\":\"$name\"}" "$API/players/$target")
      [ "$code" = 200 ] || { echo "$name: rename of $target refused (HTTP $code, see $LOG/$name.rename.json)"; continue; }
      echo "$name: renamed player $target"
    fi
    id=$(player_id "$name")
  fi
  [ -n "$id" ] || { echo "$name: could not create or find the player"; continue; }
  "${C[@]}" player use "$id" > "$LOG/$name.use.log" 2>&1
  DOCKER_DEFAULT_PLATFORM=linux/amd64 "${C[@]}" upload-policy "$IMAGE" --name "$name" --run node --run build/llm-player.mjs \
    --use-bedrock --bedrock-model "$model" > "$LOG/$name.upload.log" 2>&1 </dev/null
  ver=$(grep -o "Upload complete: .*" "$LOG/$name.upload.log" | sed 's/Upload complete: //')
  [ -n "$ver" ] || { echo "$name: upload failed (see $LOG/$name.upload.log)"; continue; }
  if "${C[@]}" submit "$ver" --league "$LEAGUE" --no-open-browser > "$LOG/$name.submit.log" 2>&1 </dev/null; then
    echo "$name: player $id, $ver submitted"
  else
    echo "$name: player $id, $ver submit failed (see $LOG/$name.submit.log)"
  fi
done
