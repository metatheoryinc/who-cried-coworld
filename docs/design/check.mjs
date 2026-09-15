/*
 * Local checks for the design guide. Run: node docs/design/check.mjs
 * Verifies relative links resolve (on this branch or on main, since the architecture
 * design lives on another branch until these merge), code fences balance, and every
 * cited evidence capture exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DOCS = ['docs/design/reveal-and-spectator-design.md', 'docs/design/README.md'];
const bad = [];
const onMain = p => {
  try { execSync(`git cat-file -e main:${p}`, { stdio: 'ignore' }); return true; } catch { return false; }
};

for (const md of DOCS) {
  const text = fs.readFileSync(md, 'utf8');
  if (text.split('```').length % 2 === 0) bad.push(`${md}: unbalanced code fences`);
  for (const m of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const t = m[1];
    if (/^(https?:|#|agent:)/.test(t)) continue;
    const rel = path.normalize(path.join(path.dirname(md), t.split('#')[0]));
    if (fs.existsSync(rel)) continue;
    if (onMain(rel)) { console.log(`note  ${md} -> ${t} (resolves on main, not yet on this branch)`); continue; }
    bad.push(`${md} -> ${t} (missing here and on main)`);
  }
}

const guide = fs.readFileSync(DOCS[0], 'utf8');
for (const name of [...new Set([...guide.matchAll(/`(\d\d-[a-z0-9-]+\.png)`/g)].map(m => m[1]))].sort()) {
  if (!fs.existsSync(path.join('docs/design/evidence', name))) bad.push('cited evidence missing: ' + name);
}
const cited = new Set([...guide.matchAll(/`(\d\d-[a-z0-9-]+\.png)`/g)].map(m => m[1]));
for (const f of fs.readdirSync('docs/design/evidence')) if (!cited.has(f)) console.log('note  uncited capture: ' + f);

if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log('ok    links, fences and evidence references all resolve');
