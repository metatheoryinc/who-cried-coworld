/*
 * Projection — the only secrecy boundary.
 *
 * Shaped to the ACCEPTED `wcw.events/1` / `wcw.viewer/1` / `wcw.replay/1` schemas in
 * ../../plans/2026-09-15-who-cried-wolf-coworld-design.md §6-7. This module is design
 * evidence for that contract, not a second definition of it. Where the two disagree,
 * the architecture design is right and this file is wrong.
 *
 * In the product this runs in trusted game code before serialization: the live viewer
 * packet and the post-game replay bundle are two projections of one journal. The
 * browser is never handed something it is trusted not to draw.
 *
 * Responsibilities:
 *   1. Authorize first. An event this audience may not have is not emitted at all.
 *   2. Construct allowlisted payloads field by field, including inside nested arrays.
 *      Nothing from the journal is copied by reference.
 *   3. Assign recipient-local cursors starting at 1. Internal `seq` never leaves.
 *      A gap would itself disclose that something happened, and how much.
 *   4. Assign opaque IDs from a public namespace. Public speech keeps a stable ID so
 *      `replyTo` survives; every other event gets an ID derived from its own cursor.
 *   5. Drop references that point at something this audience never received.
 */

export const REVEAL_CATEGORIES = [
  'public', 'roles', 'wolf_chat', 'confessional',
  'night_choices', 'discarded_bids', 'failures', 'never',
];

/** Accepted audience/reveal matrix, §6. A payload kind may only ever pair as listed. */
export const MATRIX = {
  started:       { audience: ['public'], reveal: ['public'] },
  phase:         { audience: ['public'], reveal: ['public'] },
  speech:        { audience: ['public'], reveal: ['public'] },
  ballots:       { audience: ['public'], reveal: ['public'] },
  elimination:   { audience: ['public'], reveal: ['public'] },
  night_resolved:{ audience: ['public'], reveal: ['public'] },
  finished:      { audience: ['public'], reveal: ['public'] },
  bid:           { audience: ['seats'],  reveal: ['discarded_bids'] },
  confessional:  { audience: ['seats'],  reveal: ['confessional'] },
  wolf_chat:     { audience: ['seats'],  reveal: ['wolf_chat'] },
  night_choices: { audience: ['seats'],  reveal: ['night_choices'] },
  private_result:{ audience: ['seats'],  reveal: ['night_choices'] },
  night_outcome: { audience: ['server'], reveal: ['night_choices'] },
  failure:       { audience: ['seats'],  reveal: ['failures'] },
  roles:         { audience: ['server'], reveal: ['roles'] },
  seed:          { audience: ['server'], reveal: ['roles'] },
};

/* `presentation` is nested two levels deep inside `started`, so it gets its own constructor.
   Anything the config happened to carry alongside these fields stops here. */
const presentation = v => (v && v.kind === 'character'
  ? { kind: 'character', characterId: String(v.characterId), persona: String(v.persona) }
  : { kind: 'neutral' });

const str = v => String(v);
const num = v => Number(v);
const orNull = v => (v === null || v === undefined ? null : Number(v));
const txtOrNull = v => (v === null || v === undefined ? null : String(v));

/**
 * Per-kind payload projectors. Each CONSTRUCTS a fresh payload and coerces every leaf.
 * A shallow `{...pick(payload, allowed)}` would not give this property: `roster`,
 * `ballots`, `actions`, `scores`, `roles` and `bid` are nested structures, and the copy
 * would carry whatever else those objects happened to hold. `roster[].presentation` is
 * nested twice over and is constructed by its own projector.
 */
export const PAYLOADS = {
  started: p => ({ kind: 'started', rulesVersion: str(p.rulesVersion),
    roster: p.roster.map(r => ({ slot: num(r.slot), name: str(r.name), alive: Boolean(r.alive),
      presentation: presentation(r.presentation) })) }),

  phase: p => ({ kind: 'phase', phase: str(p.phase), day: num(p.day), durationMs: num(p.durationMs) }),

  speech: (p, ref) => ({ kind: 'speech', speech: {
    slot: num(p.speech.slot), text: str(p.speech.text),
    replyTo: ref(p.speech.replyTo), accusation: orNull(p.speech.accusation) } }),

  ballots: p => ({ kind: 'ballots', eliminated: orNull(p.eliminated), resolution: str(p.resolution),
    ballots: p.ballots.map(b => ({ slot: num(b.slot), target: orNull(b.target) })) }),

  elimination: p => ({ kind: 'elimination', slot: num(p.slot), cause: str(p.cause) }),

  night_resolved: p => ({ kind: 'night_resolved', eliminated: p.eliminated.map(num) }),

  finished: p => ({ kind: 'finished', result: {
    schema: str(p.result.schema), rulesVersion: str(p.result.rulesVersion),
    outcome: str(p.result.outcome), reason: str(p.result.reason),
    daysCompleted: num(p.result.daysCompleted), scores: p.result.scores.map(num) } }),

  bid: (p, ref) => ({ kind: 'bid', slot: num(p.slot), window: num(p.window),
    rank: orNull(p.rank), selected: Boolean(p.selected),
    bid: { kind: 'bid', wantsToSpeak: Boolean(p.bid.wantsToSpeak), urgency: num(p.bid.urgency),
      text: str(p.bid.text), replyTo: ref(p.bid.replyTo),
      accusation: orNull(p.bid.accusation), reason: str(p.bid.reason) } }),

  confessional: p => ({ kind: 'confessional', slot: num(p.slot),
    requestKind: str(p.requestKind), text: str(p.text) }),

  wolf_chat: p => ({ kind: 'wolf_chat', slot: num(p.slot), text: str(p.text) }),

  night_choices: p => ({ kind: 'night_choices', slot: num(p.slot),
    actions: p.actions.map(a => ({ ability: str(a.ability), target: orNull(a.target) })) }),

  night_outcome: p => ({ kind: 'night_outcome', ability: str(p.ability),
    actor: orNull(p.actor), target: orNull(p.target), outcome: str(p.outcome) }),

  private_result: p => ({ kind: 'private_result', slot: num(p.slot), result: {
    day: num(p.result.day), ability: str(p.result.ability),
    target: num(p.result.target), result: str(p.result.result) } }),

  failure: p => ({ kind: 'failure', slot: num(p.slot), requestKind: str(p.requestKind),
    code: str(p.code), source: str(p.source), disposition: str(p.disposition), attempt: num(p.attempt) }),

  roles: p => ({ kind: 'roles', roles: p.roles.map(r => ({
    slot: num(r.slot), role: str(r.role), faction: str(r.faction) })) }),

  seed: p => ({ kind: 'seed', seed: str(p.seed), randomVersion: str(p.randomVersion) }),
};

/** Throws if a journal event pairs a payload kind with a disallowed audience or reveal. */
export function assertMatrix(journal) {
  for (const e of journal) {
    const rule = MATRIX[e.payload.kind];
    if (!rule) throw new Error('unknown payload kind "' + e.payload.kind + '"');
    if (!rule.audience.includes(e.audience.kind))
      throw new Error(`seq ${e.seq}: ${e.payload.kind} may not have audience ${e.audience.kind}`);
    if (!rule.reveal.includes(e.reveal))
      throw new Error(`seq ${e.seq}: ${e.payload.kind} may not have reveal ${e.reveal}`);
  }
}

/* Cursor and ID assignment, shared by both projections. */
function emit(kept) {
  const publicIds = new Set(kept.filter(e => e.publicId).map(e => e.publicId));
  const ref = id => (id != null && publicIds.has(id) ? String(id) : null);
  return kept.map((e, i) => {
    const cursor = i + 1;
    return {
      schema: 'wcw.events/1',
      id: e.publicId ? String(e.publicId) : 'x' + cursor,
      cursor,
      day: Number(e.day),
      phase: String(e.phase),
      reveal: String(e.reveal),
      payload: PAYLOADS[e.payload.kind](e.payload, ref),
    };
  });
}

/**
 * `wcw.viewer/1` reset packet: the full bounded state a public spectator holds while
 * the episode is running. `horizon` is exclusive.
 */
export function projectLive(episode, journal, horizon = Infinity) {
  const kept = journal.filter(e => e.audience.kind === 'public' && e.seq < horizon);
  const events = emit(kept);
  return {
    protocol: 'wcw.viewer/1',
    type: 'reset',
    episodeId: episode.episodeId,
    throughCursor: events.length,
    events,
  };
}

/** `wcw.replay/1` bundle: exported only after terminal resolution. */
export function projectReplay(episode, journal, allow) {
  const set = new Set(allow);
  const kept = journal.filter(e => e.reveal === 'public' || set.has(e.reveal));
  const events = emit(kept);
  /* Terminal-safe export, per architecture design §7: complete:true is set only after
     validation. A bundle that cannot be validated is a visible failure, never a
     silently truncated artifact that still claims to be a complete replay. */
  const count = k => events.filter(e => e.payload.kind === k).length;
  const fin = events.find(e => e.payload.kind === 'finished');
  const ids = new Set(events.map(e => e.id));
  const problems = [];
  if (count('started') !== 1) problems.push('expected exactly one started event');
  if (count('finished') !== 1) problems.push('expected exactly one finished event');
  if (!events.every((e, i) => e.cursor === i + 1)) problems.push('cursors are not dense and increasing');
  if (new Set(events.map(e => e.id)).size !== events.length) problems.push('event ids are not unique');
  if (!events.every(e => e.payload.kind !== 'speech' || e.payload.speech.replyTo === null
      || ids.has(e.payload.speech.replyTo))) problems.push('a replyTo points outside the bundle');
  if (events.some(e => e.reveal === 'never')) problems.push('a never-category event reached the export');
  if (fin) {
    const r = fin.payload.result;
    const roster = events.find(e => e.payload.kind === 'started');
    const n = roster ? roster.payload.roster.length : 0;
    if (r.scores.length !== n) problems.push('scores do not cover the roster');
    if (!r.scores.every(v => v === 0 || v === 1)) problems.push('scores are not 0 or 1');
    if (roster && new Set(roster.payload.roster.map(x => x.slot)).size !== n) problems.push('roster slots are not unique');
    const PAIR = { town_win: 'wolves_eliminated', wolf_win: 'wolf_parity', draw: 'day_cap' };
    if (PAIR[r.outcome] !== r.reason) problems.push('outcome and reason disagree');
  } else problems.push('refusing to export a replay with no finished event');
  if (problems.length) throw new Error('replay export failed validation: ' + problems.join('; '));
  return {
    schema: 'wcw.replay/1',
    eventSchema: 'wcw.events/1',
    gameVersion: episode.gameVersion,
    rulesVersion: episode.rulesVersion,
    complete: true,
    episodeId: episode.episodeId,
    maxDays: episode.maxDays,
    revealPolicy: 'postgame_allowlist/1',
    events,
    result: fin.payload.result,
  };
}

/** Evidence helper: what is actually in the bytes a browser was handed. */
export function census(projection) {
  const by = {};
  for (const e of projection.events) by[e.reveal] = (by[e.reveal] || 0) + 1;
  return {
    artifact: projection.schema || projection.protocol,
    events: projection.events.length,
    carriesRoles: projection.events.some(e => e.payload.kind === 'roles'),
    byReveal: by,
    bytes: JSON.stringify(projection).length,
  };
}
