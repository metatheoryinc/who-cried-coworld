#!/bin/bash
# Regenerates every capture in evidence/ from the prototype. Run: bash docs/design/capture.sh
# Headless Chrome clamps the viewport to a 500px minimum, so --window-size=390 really is 500.
# --virtual-time-budget lets the floor's deferred scroll pin settle before the shot.
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"
PAGE="file://$HERE/prototype/index.html"
OUT="$HERE/evidence"

shot () { # shot <file> <window-size> <query>
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-color-profile=srgb \
    --force-device-scale-factor=2 --virtual-time-budget=4000 \
    --window-size="$2" --screenshot="$OUT/$1" "$PAGE?$3" >/dev/null 2>&1
  echo "  $1  ($2)  ?$3"
}

shot 01-replay-omniscient-night1.png   1440,1900 "source=replay&reveal=omniscient&cursor=47"
shot 02-live-public-night1.png         1440,1100 "source=live&reveal=aired"
shot 03-replay-asaired-day2.png        1440,1100 "source=replay&reveal=aired&cursor=60"
shot 04-replay-omniscient-day2.png     1440,1100 "source=replay&reveal=omniscient&cursor=56"
shot 05-replay-outcome.png             1440,1100 "source=replay&reveal=aired&cursor=86"
shot 06-live-narrow.png                 500,900  "source=live&reveal=aired"
shot 07-holdings-live.png              1440,1100 "source=live&reveal=aired&deps=1"
shot 08-holdings-replay.png            1440,1100 "source=replay&reveal=omniscient&deps=1"
shot 09-seat-identity.png              1440,1100 "source=replay&reveal=aired&cursor=61&open=2,4"
shot 10-replay-medium.png               860,1000 "source=replay&reveal=omniscient&cursor=60"
shot 11-replay-omniscient-fallback.png 1440,1100 "source=replay&reveal=omniscient&cursor=26"
