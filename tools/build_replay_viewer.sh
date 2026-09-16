#!/usr/bin/env bash
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
case "${1:-}" in /*) ;; *) echo 'Expected absolute output directory' >&2; exit 2;; esac
npm run build
mkdir -p "$1"
cp build/viewer/index.html build/viewer/style.css build/viewer/viewer.js "$1/"

cp -R build/viewer/assets "$1/"
