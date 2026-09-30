#!/usr/bin/env bash
# Give roster models their own Softmax players on the signed-in account (names wcwl-<seat>: policy names are
# global, and the wcw-<seat> policies belong to the jt@metatheory.gg account), upload each model's policy as its
# player, and submit it to a league. Player name = policy name, so anyone can match them.
#
#   tools/roster-players.sh <league_id> [policy-name ...]     # default: all nine models
#   IMAGE=wcw-player:local tools/roster-players.sh ...          # player image to build and upload (default shown)
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
    wcwl-chatgpt) echo openai/gpt-5.6-luna ;;
    wcwl-haiku) echo anthropic/claude-haiku-4.5 ;;
    wcwl-gemini) echo google/gemini-3.8-flash ;;
    wcwl-gpt-oss) echo openai/gpt-oss-120b ;;
    wcwl-llama) echo meta-llama/llama-4-maverick ;;
    wcwl-deepseek) echo deepseek/deepseek-v4.1-flash ;;
    wcwl-mistral) echo mistralai/mistral-medium-3.1 ;;
    wcwl-glm) echo z-ai/glm-5.3 ;;
    wcwl-kimi) echo moonshotai/kimi-k3 ;;
  esac
}
# Build the player image from the current source (coworld build does not refresh this tag), then check it
# starts with the hosted sidecar variables alone. A stale image once uploaded policies that died at startup.
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker build -q --target player -t "$IMAGE" . > "$LOG/image.build.log" 2>&1 \
  || { echo "player image build failed (see $LOG/image.build.log)"; exit 1; }
docker run --rm --platform linux/amd64 -e COWORLD_LLM_ENDPOINT=http://127.0.0.1:9 -e COWORLD_LLM_MODEL=check \
  -e COWORLD_PLAYER_WS_URL=ws://127.0.0.1:9/x "$IMAGE" node build/llm-player.mjs 2>&1 | grep -q '"status":"configured"' \
  || { echo "$IMAGE does not start with COWORLD_LLM_* alone; not uploading"; exit 1; }
if [ $# -gt 0 ]; then NAMES=("$@"); else NAMES=(wcwl-chatgpt wcwl-haiku wcwl-gemini wcwl-gpt-oss wcwl-llama wcwl-deepseek wcwl-mistral wcwl-glm wcwl-kimi); fi

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
print(d["id"] if d and not d["name"].startswith("wcw") else "")'
}

for name in "${NAMES[@]}"; do
  model=$(model_of "$name"); [ -n "$model" ] || { echo "$name: not a roster model"; continue; }
  id=$(player_id "$name")
  if [ -z "$id" ] && [ -n "$(player_id "wcw-${name#wcwl-}")" ]; then
    # A player from before the wcwl- names (wcw-<seat>) takes the new name instead of using another slot.
    old=$(player_id "wcw-${name#wcwl-}")
    code=$(curl -s -o "$LOG/$name.rename.json" -w "%{http_code}" -X PATCH -H "Authorization: Bearer $(token)" \
      -H "Content-Type: application/json" -d "{\"name\":\"$name\"}" "$API/players/$old")
    [ "$code" = 200 ] && echo "$name: renamed player $old from wcw-${name#wcwl-}" && id=$old
  fi
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
  # Through tools/coworld-llm-upload.py: hosted LLM access now goes in policy env, not the USE_BEDROCK secret.
  DOCKER_DEFAULT_PLATFORM=linux/amd64 uv run --project /Users/jt/projects/coworld python tools/coworld-llm-upload.py upload-policy "$IMAGE" --name "$name" --run node --run build/llm-player.mjs \
    --use-bedrock --bedrock-model "$model" > "$LOG/$name.upload.log" 2>&1 </dev/null
  ver=$(grep -o "Upload complete: .*" "$LOG/$name.upload.log" | sed 's/Upload complete: //')
  [ -n "$ver" ] || { echo "$name: upload failed (see $LOG/$name.upload.log)"; continue; }
  if "${C[@]}" submit "$ver" --league "$LEAGUE" --no-open-browser > "$LOG/$name.submit.log" 2>&1 </dev/null; then
    echo "$name: player $id, $ver submitted"
  else
    echo "$name: player $id, $ver submit failed (see $LOG/$name.submit.log)"
  fi
done
