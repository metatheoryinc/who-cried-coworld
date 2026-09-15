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
const ASSET_ROOT = 'docs/design/prototype/assets/wcw';
const ASSETS = [
  'README.md',
  'backgrounds/bg_day.png',
  'backgrounds/bg_night.png',
  'backgrounds/bg_frame.png',
  'backgrounds/bg_gameover_day.png',
  'backgrounds/bg_gameover_night.png',
  'backgrounds/Text_paper.png',
  'backgrounds/tscreen_base.png',
  'backgrounds/tscreen_frame.png',
  'backgrounds/tscreen_first_day.png',
  'backgrounds/tscreen_day_death.png',
  'backgrounds/tscreen_day_nodeath.png',
  'backgrounds/tscreen_night_death.png',
  'backgrounds/tscreen_night_nodeath.png',
  'chat/Chat_background_01.png',
  'player-card/base_playercard.png',
  'player-card/base_playercard_outline.png',
  'player-card/Player_sheep_base.png',
  'roles/Role_Wolf_outline.png',
  'roles/Role_Alchemist_outline.png',
  'roles/Role_Seer_outline.png',
  'roles/Role_Guard_outline.png',
  'roles/Role_Villager_outline.png',
  'title_logo.png',
];
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

for (const file of ASSETS) {
  if (!fs.existsSync(path.join(ASSET_ROOT, file))) bad.push('prototype asset missing: ' + file);
}
const assetReadme = path.join(ASSET_ROOT, 'README.md');
if (fs.existsSync(assetReadme)) {
  const text = fs.readFileSync(assetReadme, 'utf8');
  if (!text.includes('bd90913c4b506eda1985c78a4a5f85191a8158c5')) {
    bad.push('prototype asset provenance does not pin the tofu-tech source revision');
  }
}

const prototype = fs.readFileSync('docs/design/prototype/index.html', 'utf8');
const VISUAL_HOOKS = [
  ['class="world-layer"', 'game-first world layer'],
  ['data-world=', 'phase-aware world state'],
  ['assets/wcw/title_logo.png', 'original title artwork'],
  ['assets/wcw/player-card/base_playercard.png', 'original player-card artwork'],
  ['ROLE_ART', 'original role artwork mapping'],
];
for (const [needle, label] of VISUAL_HOOKS) {
  if (!prototype.includes(needle)) bad.push(`prototype visual hook missing: ${label}`);
}

if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log('ok    links, fences and evidence references all resolve');
