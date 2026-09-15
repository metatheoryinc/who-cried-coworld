/*
 * Generates the two artifacts the prototype page is allowed to load, and asserts the
 * privacy properties the design claims.  Run: node build-fixtures.mjs
 *
 * The page never imports episode-source.mjs. If it did, the live demo would be a lie:
 * it would hold every private event and merely decline to draw them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { JOURNAL, EPISODE, CAST, PRESENTATION_CONFIG } from './episode-source.mjs';
import { projectLive, projectReplay, census, assertMatrix, MATRIX } from './project.mjs';

/* The six private categories the accepted export allowlist permits, plus public. */
const REPLAY_ALLOWLIST = [
  'discarded_bids', 'confessional', 'wolf_chat', 'night_choices', 'failures', 'roles',
];

let failures = 0;
const assert = (ok, msg) => {
  if (!ok) { console.error('FAIL  ' + msg); failures++; } else console.log('ok    ' + msg);
};

/* ---------------------------------------------------- schema conformance -- */
try { assertMatrix(JOURNAL); assert(true, 'every journal event satisfies the accepted audience/reveal matrix'); }
catch (e) { assert(false, 'audience/reveal matrix: ' + e.message); }

assert(JOURNAL.every(e => e.schema === 'wcw.events/1'), 'journal events declare wcw.events/1');
/* `private_result` is deliberately unexercised: its only remaining case is a LIVING
   blocked Seer, and this episode's one Seer dies on night 1. Asserted, not ignored. */
const UNSTAGED = ['private_result'];
assert(Object.keys(MATRIX).filter(k => !UNSTAGED.includes(k)).every(k => JOURNAL.some(e => e.payload.kind === k)),
  'the fixture exercises every accepted payload kind except private_result');
assert(!JOURNAL.some(e => e.payload.kind === 'private_result'),
  'no private_result is staged: a killed Seer gets none, and no living Seer is blocked here');

const live = projectLive(EPISODE, JOURNAL, EPISODE.liveHorizon);
const replay = projectReplay(EPISODE, JOURNAL, REPLAY_ALLOWLIST);
const liveText = JSON.stringify(live);

/* ------------------------------------------------------------- live is public -- */
assert(live.protocol === 'wcw.viewer/1' && live.type === 'reset', 'live artifact is a wcw.viewer/1 reset packet');
assert(live.events.every(e => e.reveal === 'public'), 'live projection carries only public events');
assert(!live.events.some(e => ['roles', 'seed'].includes(e.payload.kind)), 'live projection carries no roles and no seed');
assert(live.events.every((e, i) => e.cursor === i + 1), 'live cursors are dense, so gaps cannot be counted');
assert(live.throughCursor === live.events.length, 'throughCursor matches the packet');
assert(!/"seq"/.test(liveText), 'internal seq never leaves the server');
assert(!/wolf faction|confessional|inspect/i.test(liveText), 'live bytes contain no private vocabulary');

/* A selected bid's text IS the public speech - the game commits the winning text
   directly rather than generating again - so only unselected bid text is private. */
const leaked = JOURNAL
  .filter(e => e.audience.kind !== 'public')
  .flatMap(e => [
    e.payload.text,
    e.payload.kind === 'bid' && e.payload.selected !== true ? e.payload.bid.text : null,
    e.payload.bid?.reason,
    e.payload.seed,
  ].filter(t => typeof t === 'string' && t.length > 12))
  .filter(t => liveText.includes(t));
assert(leaked.length === 0, 'live bytes contain no private authored text (' + leaked.length + ' leaks)');

const liveRefs = new Set(live.events.map(e => e.id));
assert(live.events.every(e => e.payload.kind !== 'speech' || e.payload.speech.replyTo === null
  || liveRefs.has(e.payload.speech.replyTo)), 'every live replyTo resolves inside the live packet');

/* ---------------------------------------------------------- replay is a superset -- */
assert(replay.schema === 'wcw.replay/1' && replay.complete === true, 'replay artifact is a complete wcw.replay/1 bundle');
assert(replay.revealPolicy === 'postgame_allowlist/1', 'replay declares the post-game allowlist policy');
assert(replay.events.length > live.events.length, 'replay export is a superset of public material');
assert(replay.events.some(e => e.payload.kind === 'roles'),
  'replay carries roles from the first frame, so the spoiler toggle is presentation only');
assert(replay.events.every(e => e.reveal !== 'never'), 'no never-category event is exported');
assert(replay.result.outcome === 'town_win' && replay.result.scores.length === 9
  && replay.result.scores.every(s => s === 0 || s === 1), 'results agree with the accepted wcw.results/1 shape');
assert(replay.result.scores.every((s, i) =>
  s === (['wolf', 'alchemist'].includes(CAST[i].role) ? 0 : 1)), 'scores are faction scores in slot order');

/* ------------------------------------------- settled rules reflected in the fixture -- */
const inspect = JOURNAL.find(e => e.payload.kind === 'night_outcome' && e.payload.ability === 'inspect');
assert(inspect && inspect.payload.outcome === 'actor_dead' && inspect.audience.kind === 'server'
  && inspect.reveal === 'night_choices',
  'a Seer killed before resolution leaves one server-audience night_outcome actor_dead, exported under night_choices');
assert(!JOURNAL.some(e => e.audience.kind === 'seats' && e.audience.slots.includes(inspect.payload.actor)
  && e.seq >= inspect.seq), 'the killed Seer receives nothing after it: no private_result, no seat-directed update');
assert(!live.events.some(e => e.payload.kind === 'elimination' && e.payload.role),
  'eliminations carry no role, so roles stay hidden on death');
const alch = JOURNAL.find(e => e.payload.kind === 'night_choices' && e.payload.slot === 6);
assert(alch.payload.actions.length === 2 && alch.payload.actions.some(a => a.ability === 'kill')
  && alch.payload.actions.some(a => a.ability === 'block'),
  'the Alchemist submits kill and block together, either nullable');
assert(JOURNAL.filter(e => e.payload.kind === 'phase' && e.payload.phase === 'night')
  .every(e => e.payload.durationMs === 40000), 'every public night declares the same fixed duration');

/* ------------------------------------------------------- presentation identity -- */
const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
const cp = t => [...t].length;
const roster = live.events.find(e => e.payload.kind === 'started').payload.roster;
const chars = roster.filter(r => r.presentation.kind === 'character');

assert(roster.length === 9 && roster.every(r => r.presentation
  && ['character', 'neutral'].includes(r.presentation.kind)),
  'every PublicSeat carries a presentation of kind character or neutral');
assert(roster.every((r, i) => (PRESENTATION_CONFIG[i] ? r.presentation.kind === 'character'
  : r.presentation.kind === 'neutral')),
  'an unconfigured slot normalizes to neutral rather than being omitted');
assert(chars.every(r => ID_RE.test(r.presentation.characterId) && cp(r.presentation.characterId) <= 48
  && cp(r.presentation.characterId) >= 1), 'every characterId matches /^[a-z0-9][a-z0-9_-]*$/ within 48 characters');
assert(chars.every(r => cp(r.presentation.persona) >= 1 && cp(r.presentation.persona) <= 240),
  'every persona is 1 to 240 Unicode code points');
assert(roster.every(r => r.presentation.kind === 'character'
  || (r.presentation.characterId === undefined && r.presentation.persona === undefined)),
  'a neutral seat carries no characterId and no persona');

/* The binding is slot -> presentation, from trusted config. Nothing resolves by name. */
const NAMES = new Set(CAST.map(c => c.name));
assert(!chars.some(r => NAMES.has(r.presentation.characterId)),
  'no characterId is a display name, so a seat can never inherit a character by naming itself after one');
assert(JSON.stringify(roster) === JSON.stringify(
  projectReplay(EPISODE, JOURNAL, REPLAY_ALLOWLIST).events.find(e => e.payload.kind === 'started').payload.roster),
  'live and replay see the same presentation; it is not a reveal category');

/* The export guard must actually refuse, not merely exist. */
const refuses = (label, mutate) => {
  try { projectReplay(EPISODE, mutate(JOURNAL.map(e => ({ ...e }))), REPLAY_ALLOWLIST); return false; }
  catch { return true; }
};
assert(refuses('no terminal', j => j.filter(e => e.payload.kind !== 'finished')),
  'export refuses a bundle with no finished event');
assert(refuses('no roster', j => j.filter(e => e.payload.kind !== 'started')),
  'export refuses a bundle with no started event');
assert(refuses('bad result', j => j.map(e => e.payload.kind === 'finished'
  ? { ...e, payload: { ...e.payload, result: { ...e.payload.result, reason: 'day_cap' } } } : e)),
  'export refuses a bundle whose outcome and reason disagree');

/* --------------------------------------------------------- constructed, not copied -- */
const SENTINEL = 'SENTINEL_MUST_NOT_SURVIVE';
const spike = o => (o && typeof o === 'object' ? { ...o, smuggled: SENTINEL } : o);
const spikeArrays = p => {
  const out = { ...p, smuggled: SENTINEL };
  for (const key of ['roster', 'ballots', 'actions', 'scores', 'roles', 'eliminated']) {
    if (Array.isArray(p[key])) out[key] = p[key].map(spike);
  }
  /* roster[].presentation is nested twice; spike it too. */
  if (Array.isArray(p.roster)) out.roster = out.roster.map(r => ({ ...r, presentation: spike(r.presentation) }));
  if (p.bid) out.bid = spike(p.bid);
  if (p.result) out.result = spike(p.result);
  if (p.result?.scores) out.result = { ...out.result, scores: p.result.scores.map(spike) };
  if (p.speech) out.speech = spike(p.speech);
  return out;
};
const spiked = JOURNAL.map(e => ({ ...e, smuggled: SENTINEL, payload: spikeArrays(e.payload) }));
const spikedLive = JSON.stringify(projectLive(EPISODE, spiked, EPISODE.liveHorizon));
const spikedReplay = JSON.stringify(projectReplay(EPISODE, spiked, REPLAY_ALLOWLIST));
assert(!spikedLive.includes(SENTINEL), 'injected nested field does not survive into the live packet');
assert(!spikedReplay.includes(SENTINEL), 'injected nested field does not survive into the replay bundle');
assert(spikedReplay.includes('Coriander is reading you'), 'the sentinel run still produced a real projection');

/* ----------------------------------------------------------------------- emit -- */
const dir = path.join(import.meta.dirname, 'fixtures');
fs.mkdirSync(dir, { recursive: true });
const emit = (file, name, value) => {
  fs.writeFileSync(path.join(dir, file),
    '/* GENERATED by build-fixtures.mjs - do not edit. Source: episode-source.mjs */\n' +
    'const ' + name + ' = ' + JSON.stringify(value, null, 2) + ';\n');
};
emit('live-public.js', 'LIVE_PUBLIC', live);
emit('replay-export.js', 'REPLAY_EXPORT', replay);

/* Prototype chrome: the settled decisions the holdings drawer lists. Presentation is NOT
   emitted here — it reaches the viewer on `started.roster[].presentation`, like the product. */
emit('notes.js', 'DESIGN_NOTES', EPISODE.reconciliationNotes);
fs.rmSync(path.join(dir, 'cast.js'), { force: true });

console.log('');
console.log('live   ' + JSON.stringify(census(live)));
console.log('replay ' + JSON.stringify(census(replay)));
if (failures) { console.error('\n' + failures + ' assertion(s) failed'); process.exitCode = 1; }
