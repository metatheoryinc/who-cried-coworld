#!/usr/bin/env bash
set -euo pipefail

# Serve only the prototype, on this computer. Override with PORT=9000 if needed.
prototype_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/prototype" && pwd)"
exec python3 -m http.server "${PORT:-8765}" --bind 127.0.0.1 --directory "$prototype_dir"
