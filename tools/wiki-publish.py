#!/usr/bin/env python3
"""Publish docs/wiki/*.md to the live Softmax wiki for this Coworld.

    uv run --project <coworld> python tools/wiki-publish.py            # dry run
    uv run --project <coworld> python tools/wiki-publish.py --apply    # write live

Fetch, then PUT with the current revision as base_revision_id (a stale base
returns 409 and nothing is overwritten), then read back and compare. Uses curl
because other HTTP clients get a Cloudflare 403. The token is read from
~/.softmax/credentials.yaml and only passed in the Authorization header.
"""
import json, subprocess, sys, time, urllib.parse
from pathlib import Path
import yaml

WIKI = "Mafia: Who Cried Wolf?"
API = "https://softmax.com/api/observatory/v2/wikis/" + urllib.parse.quote(WIKI, safe="") + "/pages/"
ROOT = Path(__file__).resolve().parents[1] / "docs" / "wiki"
PAGES = {  # repo file -> (slug, title)
    "main.md": ("main", "Mafia: Who Cried Wolf?"),
    "play-with-friends.md": ("play-with-friends", "Play with friends"),
    "rules-and-roles.md": ("rules-and-roles", "Rules and roles"),
    "strategy-tips.md": ("strategy-tips", "Strategy tips"),
    "scoring.md": ("scoring", "Scoring"),
    "game-modes.md": ("game-modes", "Game modes"),
    "build-a-policy.md": ("build-a-policy", "Build a policy"),
}

def token():
    return yaml.safe_load((Path.home() / ".softmax" / "credentials.yaml").read_text())["tokens"]["https://softmax.com/api"]

def curl(method, slug, tok, body=None):
    args = ["curl", "-s", "-o", "-", "-w", "\n%{http_code}", "-X", method, "-H", f"Authorization: Bearer {tok}", API + slug]
    if body is not None:
        args[-1:-1] = ["-H", "Content-Type: application/json", "--data-binary", "@-"]
    out = subprocess.run(args, input=json.dumps(body) if body is not None else None, capture_output=True, text=True).stdout
    text, _, code = out.rpartition("\n")
    try: data = json.loads(text) if text.strip() else None
    except json.JSONDecodeError: data = None
    return int(code or 0), data

def main():
    apply = "--apply" in sys.argv
    tok = token()
    for file, (slug, title) in PAGES.items():
        # The wiki shows the page title as the heading, so drop the file's own leading H1.
        body = (ROOT / file).read_text().split("\n", 1)[1].lstrip("\n") if (ROOT / file).read_text().startswith("# ") else (ROOT / file).read_text()
        code, page = curl("GET", slug, tok)
        base = page.get("current_revision_id") if code == 200 and page else None
        live = (page or {}).get("current_revision", {}).get("body") if base else None
        if live == body:
            print(f"{slug}: unchanged"); continue
        if not apply:
            print(f"{slug}: would {'update' if base else 'create'}"); continue
        payload = {"title": title, "body": body, "idempotency_key": f"wcw-wiki-{slug}-{int(time.time())}"}
        if base: payload["base_revision_id"] = base
        code, resp = curl("PUT", slug, tok, payload)
        time.sleep(2.2)
        if code not in (200, 201):
            print(f"{slug}: PUT failed HTTP {code} {json.dumps(resp)[:300]}"); continue
        code, after = curl("GET", slug, tok)
        ok = code == 200 and after and after.get("current_revision", {}).get("body") == body
        print(f"{slug}: {'updated' if base else 'created'}{'' if ok else ' BUT read-back differs'}")

if __name__ == "__main__":
    main()
