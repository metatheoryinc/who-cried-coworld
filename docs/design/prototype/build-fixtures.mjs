/*
 * Generates the two artifacts the prototype page is allowed to load, and asserts the
 * privacy properties the design claims.  Run: node build-fixtures.mjs
 *
 * The page never imports episode-source.mjs. If it did, the live demo would be a lie:
 * it would hold every private event and merely decline to draw them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { JOURNAL, EPISODE, CAST } from './episode-source.mjs';
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
assert(Object.keys(MATRIX).every(k => JOURNAL.some(e => e.payload.kind === k)),
  'the fixture exercises every accepted payload kind');

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
const seerResult = JOURNAL.find(e => e.payload.kind === 'private_result');
assert(seerResult.payload.result.result === 'no_result',
  'a Seer killed before resolution receives wire-level no_result');
assert(JOURNAL.some(e => e.payload.kind === 'night_outcome' && e.payload.outcome === 'actor_dead'
  && e.audience.kind === 'server'), 'the cause is retained server-side as night_outcome actor_dead');
assert(!live.events.some(e => e.payload.kind === 'elimination' && e.payload.role),
  'eliminations carry no role, so roles stay hidden on death');
const alch = JOURNAL.find(e => e.payload.kind === 'night_choices' && e.payload.slot === 6);
assert(alch.payload.actions.length === 2 && alch.payload.actions.some(a => a.ability === 'kill')
  && alch.payload.actions.some(a => a.ability === 'block'),
  'the Alchemist submits kill and block together, either nullable');
assert(JOURNAL.filter(e => e.payload.kind === 'phase' && e.payload.phase === 'night')
  .every(e => e.payload.durationMs === 40000), 'every public night declares the same fixed duration');

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

/* Presentation configuration, not episode data. See §6 of the design guide. */
emit('cast.js', 'CAST_CATALOGUE', {
  note: 'Ships with the viewer, keyed by display name. A seat absent from this catalogue renders as a submitted policy.',
  personas: {
    Bramble:   'Anxious hedge-keeper. Counts the flock twice, then counts again.',
    Coriander: 'Retired schoolteacher. Asks one question more than is comfortable.',
    Elowen:    'Warm, generous, remembers every birthday in the village.',
    Fennimore: 'Night watch. Speaks rarely and plainly.',
    Garnet:    'Runs the market stall. Trades in rumour as much as wool.',
    Hollis:    'Village apothecary. Fond of precision, impatient with feeling.',
    Isolde:    'Youngest of the flock. Earnest to a fault.',
  },
  notes: EPISODE.reconciliationNotes,
});

console.log('');
console.log('live   ' + JSON.stringify(census(live)));
console.log('replay ' + JSON.stringify(census(replay)));
if (failures) { console.error('\n' + failures + ' assertion(s) failed'); process.exitCode = 1; }
