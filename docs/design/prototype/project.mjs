/*
 * Projection — the only secrecy boundary.
 *
 * In the product this runs in trusted game code before serialization: the live
 * WebSocket payload and the post-game replay export are two different projections
 * of one journal. The browser is never handed something it is trusted not to draw.
 *
 * Properties this function is responsible for:
 *   1. An event the audience may not have is not emitted at all.
 *   2. Only allowlisted fields of an emitted event survive. Nothing arbitrary is
 *      copied through, so a policy cannot smuggle payload into the artifact.
 *   3. Sequence numbers are re-issued densely over the surviving events. A gap in
 *      the sequence would itself be a disclosure: it tells the viewer that
 *      something happened and how much of it.
 *   4. Cross-references (replyTo) are remapped into the new sequence, or nulled if
 *      they point at something this audience never received.
 *   5. Roles ride on the roster and are gated by the `roles` reveal category.
 */

export const REVEAL_CATEGORIES = [
  'public', 'discarded_bids', 'confessional', 'wolf_chat',
  'night_choices', 'failures', 'roles', 'never',
];

/**
 * Per-kind projectors. Each one CONSTRUCTS a fresh payload field by field and
 * coerces every leaf. Nothing from the authored event is copied by reference, so
 * an extra nested field on an authored object cannot survive into an artifact.
 * A shallow `{...pick(e, allowed)}` would not give this property: `items`,
 * `ballots`, `actions` and `scores` are arrays of objects, and the array would
 * carry whatever else those objects happened to hold.
 */
const str = v => String(v);
const num = v => Number(v);
const slotOrNull = v => (v === null || v === undefined ? null : Number(v));
const noteOrNull = v => (v === null || v === undefined ? null : String(v));

export const PROJECTORS = {
  phase:        e => ({ text: str(e.text) }),
  speech:       e => ({ slot: num(e.slot), window: num(e.window),
                        accusation: slotOrNull(e.accusation), replyTo: slotOrNull(e.replyTo),
                        text: str(e.text) }),
  vote_close:   e => ({ eliminated: slotOrNull(e.eliminated), majority: num(e.majority),
                        ballots: e.ballots.map(b => ({ slot: num(b.slot), target: slotOrNull(b.target) })) }),
  elimination:  e => ({ slot: num(e.slot), cause: str(e.cause) }),
  death_notice: e => ({ slot: num(e.slot) }),
  outcome:      e => ({ result: str(e.result), headline: str(e.headline), detail: str(e.detail),
                        scores: e.scores.map(s => ({ slot: num(s.slot), score: num(s.score) })) }),
  bids:         e => ({ window: num(e.window), note: noteOrNull(e.note),
                        items: e.items.map(i => ({ slot: num(i.slot), urgency: num(i.urgency),
                          rank: num(i.rank), reason: str(i.reason), text: str(i.text) })) }),
  wolf_chat:    e => ({ slot: num(e.slot), turn: num(e.turn), text: str(e.text) }),
  night_action: e => ({ slot: num(e.slot),
                        actions: e.actions.map(a => ({ ability: str(a.ability), target: slotOrNull(a.target) })) }),
  night_pass:   e => ({ slots: e.slots.map(num), note: noteOrNull(e.note) }),
  night_result: e => ({ slot: num(e.slot), ability: str(e.ability), target: num(e.target),
                        result: str(e.result), note: noteOrNull(e.note) }),
  resolution:   e => ({ text: str(e.text) }),
  failure:      e => ({ slot: num(e.slot), request: str(e.request), code: str(e.code),
                        provenance: str(e.provenance), fallback: str(e.fallback), note: noteOrNull(e.note) }),
  deliberation: e => ({ slot: num(e.slot), label: str(e.label), text: str(e.text) }),
};

/** A seat row is constructed the same way; `role` only exists when allowed. */
function projectSeat(s, withRole) {
  const out = { slot: Number(s.slot), name: String(s.name), kind: String(s.kind),
                persona: s.persona == null ? null : String(s.persona) };
  if (withRole) out.role = String(s.role);
  return out;
}

function project(e) {
  const build = PROJECTORS[e.kind];
  if (!build) throw new Error('no projector for event kind "' + e.kind + '"');
  return { day: Number(e.day), phase: String(e.phase), kind: String(e.kind),
           reveal: String(e.reveal), ...build(e) };
}

function resequence(kept) {
  const ord = new Map();
  kept.forEach((e, i) => ord.set(e.seq, i + 1));
  return kept.map((e, i) => {
    const out = project(e);
    out.seq = i + 1;
    if ('replyTo' in out && out.replyTo != null) out.replyTo = ord.get(out.replyTo) ?? null;
    return out;
  });
}

/**
 * What a public spectator holds while the episode is running.
 * `horizon` is exclusive: events at or after it have not happened yet.
 */
export function projectLive(episode, events, horizon = Infinity) {
  const kept = events.filter(e => e.audience === 'public' && e.seq < horizon);
  return {
    projection: 'live.public',
    protocol: episode.protocol,
    episodeId: episode.episodeId,
    title: episode.title,
    variant: episode.variant,
    complete: false,
    // no role field exists on this roster at all
    seats: episode.seats.map(s => projectSeat(s, false)),
    revealed: [],
    events: resequence(kept),
  };
}

/** What the completed static replay bundle contains. */
export function projectReplay(episode, events, allow) {
  const set = new Set(allow);
  const kept = events.filter(e => e.reveal === 'public' || set.has(e.reveal));
  return {
    projection: 'replay.export',
    protocol: episode.protocol,
    episodeId: episode.episodeId,
    title: episode.title,
    variant: episode.variant,
    complete: true,
    seats: episode.seats.map(s => projectSeat(s, set.has('roles'))),
    revealed: [...set],
    events: resequence(kept),
    reconciliationNotes: episode.reconciliationNotes.map(String),
  };
}

/** Evidence helper: what is actually in the bytes a browser was handed. */
export function census(projection) {
  const by = {};
  for (const e of projection.events) by[e.reveal] = (by[e.reveal] || 0) + 1;
  return {
    projection: projection.projection,
    events: projection.events.length,
    rolesOnRoster: projection.seats.some(s => 'role' in s),
    byReveal: by,
    bytes: JSON.stringify(projection).length,
  };
}
