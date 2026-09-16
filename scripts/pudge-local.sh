#!/usr/bin/env bash
# Reproduce the verified local human-versus-bot experiment.
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cli="${COWORLD_CLI:-/Users/jt/projects/coworld/.venv/bin/coworld}"
id=cow_01b9f22d-5255-4d22-a111-af7ed5861fac
image="coworld/$id/pudge-wars-0.3.21-0:downloaded"
game=mt-port-pudge-duel
bot=mt-port-pudge-bot
if [[ "${1:-start}" == stop ]]; then
  docker stop "$bot" "$game" 2>/dev/null || true
  exit 0
fi
if [[ "${1:-start}" != start ]]; then
  echo 'Usage: pudge-local.sh [start|stop]' >&2
  exit 2
fi
for container in "$game" "$bot"; do
  if docker inspect "$container" >/dev/null 2>&1; then
    echo "$container already exists; stop it first, then remove the stopped container with docker rm $container." >&2
    exit 1
  fi
done
export DOCKER_DEFAULT_PLATFORM=linux/amd64
"$cli" download "$id" --output-dir "$root/.local/coworld"
episode="$(mktemp -d "$root/.local/pudge-duel-XXXXXX")"
python3 - "$root/.local/coworld/$id/coworld_manifest.json" "$episode" <<'PY'
import json, pathlib, sys
m = json.loads(pathlib.Path(sys.argv[1]).read_text())
c = next(v['game_config'] for v in m['variants'] if v['id'] == 'duel-1v1')
c.update(tokens=['local-human', 'local-bot'], players=[{'name': 'Human'}, {'name': 'Rusher'}],
         player_connect_timeout_seconds=600)
pathlib.Path(sys.argv[2], 'config.json').write_text(json.dumps(c))
PY
docker run -d --name "$game" -p 127.0.0.1:8766:8080 \
  -v "$episode:/episode" \
  -e COGAME_HOST=0.0.0.0 -e COGAME_PORT=8080 \
  -e COGAME_CONFIG_URI=file:///episode/config.json \
  -e COGAME_RESULTS_URI=file:///episode/results.json \
  -e COGAME_SAVE_REPLAY_URI=file:///episode/replay \
  -e PUDGE_WARS_CLIENT_URL=https://pudge-wars-site-theta.vercel.app/play/bundles/16ee23ead8a7ca64/pw.html \
  "$image" pwcoworld
ready=false
for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:8766/healthz >/dev/null; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$game"
  echo 'Game failed to become healthy; inspect the container before retrying.' >&2
  exit 1
fi
docker run -d --name "$bot" \
  -e COWORLD_PLAYER_WS_URL='ws://host.docker.internal:8766/player?slot=1&token=local-bot' \
  -e PUDGE_PERSONALITY=rusher -e PUDGE_POLICY_ARM=combined \
  "$image" python -m coworld.examples.pudgewars.player.player
echo "Artifacts: $episode"
echo 'Play: http://127.0.0.1:8766/client/player?slot=0&token=local-human'
echo 'Watch: http://127.0.0.1:8766/client/global'
echo 'Right-click terrain to move. Join within 10 minutes; the duel runs up to 8 minutes.'
