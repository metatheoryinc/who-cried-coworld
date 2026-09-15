/*
 * AUTHORED INTERNAL JOURNAL — omniscient by construction.
 *
 * Design authoring input. The prototype page never loads this file. build-fixtures.mjs
 * runs it through project.mjs to produce the two artifacts a browser is actually given.
 *
 * Event envelope and payload kinds follow the ACCEPTED `wcw.events/1` union in
 * ../../plans/2026-09-15-who-cried-wolf-coworld-design.md §6. This file does not define
 * a wire contract; it is a fixture shaped to one.
 *
 *   audience : {kind:'public'} | {kind:'seats', slots:[...]} | {kind:'server'}
 *   reveal   : public | roles | wolf_chat | confessional | night_choices
 *            | discarded_bids | failures | never
 *
 * Abridged design evidence, not a rules fixture.
 *
 * One accepted payload kind is absent: `private_result`. It still carries every result a
 * living actor receives — wolf, not_wolf, and a bare no_result when blocked — but this
 * episode's one Seer inspects once, on night 1, and dies before it resolves. The renderer
 * still implements the beat; build-fixtures.mjs asserts the absence deliberately.
 */

import { normalizePresentation } from './project.mjs';

const RULES = 'wcw.rules/1-standard-9';

export const CAST = [
  { slot: 0, name: 'Bramble',   role: 'sheep' },
  { slot: 1, name: 'Coriander', role: 'seer' },
  { slot: 2, name: 'Quillon',   role: 'sheep' },
  { slot: 3, name: 'Elowen',    role: 'wolf' },
  { slot: 4, name: 'Fennimore', role: 'guard' },
  { slot: 5, name: 'Garnet',    role: 'sheep' },
  { slot: 6, name: 'Hollis',    role: 'alchemist' },
  { slot: 7, name: 'Isolde',    role: 'sheep' },
  { slot: 8, name: 'Marlowe',   role: 'sheep' },
];
const FACTION = { wolf: 'wolf', alchemist: 'wolf', seer: 'town', guard: 'town', sheep: 'town' };

/*
 * GameConfig.presentation[9] — trusted game configuration, an input to the game and never
 * loaded by the page. The game normalizes it into each `PublicSeat.presentation`; a missing
 * entry becomes {kind:'neutral'}. A character is a role-play identity assigned to the seat,
 * not a claim about which policy occupies it, and it is never matched from the display name.
 * A supplied array is exactly nine valid entries in slot order — absence is the only
 * defaulting case, so slots 2 and 8 are written out as explicit neutrals rather than holes.
 */
export const PRESENTATION_CONFIG = [
  { kind: 'character', characterId: 'hedge-keeper',  persona: 'Anxious hedge-keeper. Counts the flock twice, then counts again.' },
  { kind: 'character', characterId: 'schoolteacher', persona: 'Retired schoolteacher. Asks one question more than is comfortable.' },
  { kind: 'neutral' },
  { kind: 'character', characterId: 'neighbour',     persona: 'Warm, generous, remembers every birthday in the village.' },
  { kind: 'character', characterId: 'night-watch',   persona: 'Night watch. Speaks rarely and plainly.' },
  { kind: 'character', characterId: 'stallholder',   persona: 'Runs the market stall. Trades in rumour as much as wool.' },
  { kind: 'character', characterId: 'apothecary',    persona: 'Village apothecary. Fond of precision, impatient with feeling.' },
  { kind: 'character', characterId: 'youngest',      persona: 'Youngest of the flock. Earnest to a fault.' },
  { kind: 'neutral' },
];
/* Normalized once, before readiness, then carried unchanged into every PublicSeat. */
const SEAT_PRESENTATION = normalizePresentation(PRESENTATION_CONFIG);

let seq = 0;
const J = [];
const push = (day, phase, audience, reveal, payload, publicId) => {
  J.push({ schema: 'wcw.events/1', seq: ++seq, day, phase, audience, reveal, payload, publicId });
};
const PUB = { kind: 'public' };
const SRV = { kind: 'server' };
const seats = (...slots) => ({ kind: 'seats', slots: [...slots].sort((a, b) => a - b) });

/* public */
const started = () => push(0, 'waiting', PUB, 'public',
  { kind: 'started', rulesVersion: RULES, roster: CAST.map(c =>
    ({ slot: c.slot, name: c.name, alive: true, presentation: SEAT_PRESENTATION[c.slot] })) });
const phase = (day, p, durationMs) => push(day, p, PUB, 'public', { kind: 'phase', phase: p, day, durationMs });
const speech = (day, slot, text, replyTo, accusation, id) =>
  push(day, 'day', PUB, 'public', { kind: 'speech', speech: { slot, text, replyTo, accusation } }, id);
const ballots = (day, rows, eliminated, resolution) =>
  push(day, 'vote', PUB, 'public', { kind: 'ballots', ballots: rows, eliminated, resolution });
const elimination = (day, p, slot, cause) => push(day, p, PUB, 'public', { kind: 'elimination', slot, cause });
const nightResolved = (day, eliminated) => push(day, 'night', PUB, 'public', { kind: 'night_resolved', eliminated });
const finished = (day, result) => push(day, 'finished', PUB, 'public', { kind: 'finished', result });

/* private */
const bid = (day, slot, window, b, rank, selected) =>
  push(day, 'day', seats(slot), 'discarded_bids', { kind: 'bid', slot, window, bid: b, rank, selected });
const wolfChat = (day, living, slot, text) =>
  push(day, 'night', seats(...living), 'wolf_chat', { kind: 'wolf_chat', slot, text });
const confessional = (day, p, slot, requestKind, text) =>
  push(day, p, seats(slot), 'confessional', { kind: 'confessional', slot, requestKind, text });
const nightChoices = (day, slot, actions) =>
  push(day, 'night', seats(slot), 'night_choices', { kind: 'night_choices', slot, actions });
const nightOutcome = (day, ability, actor, target, outcome) =>
  push(day, 'night', SRV, 'night_choices', { kind: 'night_outcome', ability, actor, target, outcome });
const failure = (day, p, slot, requestKind, code, source, disposition, attempt) =>
  push(day, p, seats(slot), 'failures', { kind: 'failure', slot, requestKind, code, source, disposition, attempt });
const roles = (day) => push(day, 'finished', SRV, 'roles',
  { kind: 'roles', roles: CAST.map(c => ({ slot: c.slot, role: c.role, faction: FACTION[c.role] })) });
const seed = (day) => push(day, 'finished', SRV, 'roles',
  { kind: 'seed', seed: '4f1c9a02be7d5318a6c04e7f2b9d1836', randomVersion: 'sha256-counter/1' });

const B = (wantsToSpeak, urgency, text, replyTo, accusation, reason) =>
  ({ kind: 'bid', wantsToSpeak, urgency, text, replyTo, accusation, reason });

/* ========================================================================= */

started();

/* ---------------------------------------------------------------- Day 1 -- */
phase(1, 'day', 48000);

bid(1, 7, 1, B(true, 2, "Nobody knows anything yet, so I'll say the obvious thing: whoever talks least today is hiding behind the quiet.", null, null, 'Opens the floor rather than waiting for someone braver.'), 1, true);
bid(1, 3, 1, B(true, 2, "Let's not start by punishing shyness. Some of us just think slowly.", null, null, 'Wants to set a friendly tone early.'), 2, false);
bid(1, 0, 1, B(true, 1, 'I agree with whatever Isolde says.', null, null, 'Nervous, prefers to follow.'), 3, false);
bid(1, 5, 1, B(true, 1, 'I heard something at the stall. Later.', null, null, 'Holding a rumour back for later.'), 4, false);
speech(1, 7, "Nobody knows anything yet, so I'll say the obvious thing: whoever talks least today is hiding behind the quiet.", null, null, 's1');

bid(1, 3, 2, B(true, 2, "Let's not start by punishing shyness, Isolde. Some of us think slowly and love this village anyway.", 's1', null, 'Answering directly earns the floor.'), 1, true);
failure(1, 'day', 2, 'bid', 'provider_error', 'policy_report', 'fallback', 1);
speech(1, 3, "Let's not start by punishing shyness, Isolde. Some of us think slowly and love this village anyway.", 's1', null, 's2');

bid(1, 1, 3, B(true, 3, 'Hollis, you have not said a word and you are the only one of us who could quietly end someone. I would like to hear you.', null, 6, 'Nobody has pressed the quiet seat yet.'), 1, true);
speech(1, 1, 'Hollis, you have not said a word and you are the only one of us who could quietly end someone. I would like to hear you.', null, 6, 's3');

bid(1, 6, 4, B(true, 3, 'I have not spoken because nothing has been said worth answering. Coriander, you named me first and fastest. That is a choice, not an observation.', 's3', 1, 'Named directly; must answer.'), 1, true);
bid(1, 4, 4, B(true, 2, 'One accusation is not evidence. Let it breathe.', null, null, 'Wants to slow the pile-on.'), 2, false);
bid(1, 8, 4, B(true, 1, 'Too early for me.', null, null, 'No read yet.'), 3, false);
speech(1, 6, 'I have not spoken because nothing has been said worth answering. Coriander, you named me first and fastest. That is a choice, not an observation.', 's3', 1, 's4');

bid(1, 0, 5, B(true, 2, 'Coriander asked the first hard question and then went quiet. I have counted the flock twice today and I keep coming back to that.', 's3', 1, 'Finally has something of his own.'), 1, true);
speech(1, 0, 'Coriander asked the first hard question and then went quiet. I have counted the flock twice today and I keep coming back to that.', 's3', 1, 's5');

phase(1, 'vote', 8000);
failure(1, 'vote', 8, 'vote', 'timeout', 'game', 'fallback', 2);
confessional(1, 'vote', 3, 'vote', 'Bramble is harmless and the room already leaned. Cheap day, no attention on me.');
confessional(1, 'vote', 4, 'vote', 'I do not believe Bramble is a wolf. I believe the room was going there anyway and I wanted to watch who pushed.');
confessional(1, 'vote', 6, 'vote', 'Following Elowen without appearing to follow Elowen.');
confessional(1, 'vote', 1, 'vote', 'Hollis answered an accusation with a critique of the accusation. I am keeping that.');
ballots(1, [
  { slot: 0, target: 1 }, { slot: 1, target: 6 }, { slot: 2, target: 0 },
  { slot: 3, target: 0 }, { slot: 4, target: 0 }, { slot: 5, target: 0 },
  { slot: 6, target: 0 }, { slot: 7, target: 1 }, { slot: 8, target: null },
], 0, 'majority');
elimination(1, 'vote', 0, 'vote');

/* -------------------------------------------------------------- Night 1 -- */
phase(1, 'night', 40000);
wolfChat(1, [3, 6], 3, 'Coriander is reading you and she is not wrong. She goes tonight.');
wolfChat(1, [3, 6], 6, 'Agreed. But Fennimore watches, and he watched me all day. I will take him off the board for the night.');
wolfChat(1, [3, 6], 3, 'Then it is clean. Tomorrow I grieve loudly and you say very little.');
wolfChat(1, [3, 6], 6, 'I say very little regardless.');
nightChoices(1, 3, [{ ability: 'kill', target: 1 }]);
nightChoices(1, 6, [{ ability: 'kill', target: null }, { ability: 'block', target: 4 }]);
nightChoices(1, 1, [{ ability: 'inspect', target: 6 }]);
nightChoices(1, 4, [{ ability: 'protect', target: 1 }]);
[2, 5, 7, 8].forEach(s => nightChoices(1, s, []));
confessional(1, 'night', 4, 'night', 'If Coriander is the Seer, she dies tonight. So I stand over her and hope I am wrong about being right.');
confessional(1, 'night', 1, 'night', 'Hollis. If it comes back wolf I say it at first light and I accept what follows.');
nightOutcome(1, 'block', 6, 4, 'applied');
nightOutcome(1, 'protect', 4, 1, 'blocked');
nightOutcome(1, 'kill', null, 1, 'applied');
/* Coriander inspected Hollis and was killed before it resolved. Per the settled lifecycle
   she receives nothing at all — no private_result, no seat-directed update. This
   server-audience row is the only record that the inspection ever existed. */
nightOutcome(1, 'inspect', 1, 6, 'actor_dead');
elimination(1, 'night', 1, 'wolf');
nightResolved(1, [1]);

/* ---------------------------------------------------------------- Day 2 -- */
phase(2, 'day', 48000);
bid(2, 4, 1, B(true, 3, 'I guarded Coriander last night. She died anyway. That is not luck, that is someone stopping me, and only one of us can do that.', null, 6, 'Has the only hard evidence in the room.'), 1, true);
speech(2, 4, 'I guarded Coriander last night. She died anyway. That is not luck, that is someone stopping me, and only one of us can do that.', null, 6, 's6');
bid(2, 3, 2, B(true, 3, "Or you are telling us a story that makes your failure someone else's fault, Fennimore. Grief is loud. I should know, I have been crying since dawn.", 's6', 4, 'Must blunt the blocker claim immediately.'), 1, true);
speech(2, 3, "Or you are telling us a story that makes your failure someone else's fault, Fennimore. Grief is loud. I should know, I have been crying since dawn.", 's6', 4, 's7');
bid(2, 6, 3, B(true, 3, 'A blocker claim with no blocker named is just weather.', null, null, 'Wants to answer the blocker claim directly.'), 2, false);
bid(2, 2, 3, B(true, 1, 'Listening.', null, null, 'Still assembling a read.'), 3, false);
bid(2, 7, 3, B(true, 3, 'Elowen, you have comforted everyone and accused the one person who did something. I am voting you and I am sorry.', 's7', 3, 'Has not spoken today and is answering directly.'), 1, true);
speech(2, 7, 'Elowen, you have comforted everyone and accused the one person who did something. I am voting you and I am sorry.', 's7', 3, 's8');

phase(2, 'vote', 8000);
confessional(2, 'vote', 6, 'vote', 'If I defend her I go with her. She was always the one who could be spent.');
ballots(2, [
  { slot: 2, target: 3 }, { slot: 3, target: 4 }, { slot: 4, target: 6 },
  { slot: 5, target: 3 }, { slot: 6, target: 4 }, { slot: 7, target: 3 },
  { slot: 8, target: 3 },
], 3, 'majority');
elimination(2, 'vote', 3, 'vote');

/* -------------------------------------------------------------- Night 2 -- */
phase(2, 'night', 40000);
wolfChat(2, [6], 6, 'Alone, then. Fennimore is the only one building a case, so he stays blocked and Garnet goes quiet.');
nightChoices(2, 6, [{ ability: 'kill', target: 5 }, { ability: 'block', target: 4 }]);
nightChoices(2, 4, [{ ability: 'protect', target: 7 }]);
[2, 7, 8].forEach(s => nightChoices(2, s, []));
nightOutcome(2, 'block', 6, 4, 'applied');
nightOutcome(2, 'protect', 4, 7, 'blocked');
nightOutcome(2, 'kill', null, 5, 'applied');
elimination(2, 'night', 5, 'wolf');
nightResolved(2, [5]);

/* ---------------------------------------------------------------- Day 3 -- */
phase(3, 'day', 48000);
bid(3, 4, 1, B(true, 3, 'Two nights. Two blocks. I have named the same person both mornings and I am going to keep naming him until one of us is gone.', null, 6, 'The case has not changed and neither has he.'), 1, true);
speech(3, 4, 'Two nights. Two blocks. I have named the same person both mornings and I am going to keep naming him until one of us is gone.', null, 6, 's9');
bid(3, 6, 2, B(true, 3, "Quillon has spoken four words in three days and voted with the crowd every time. That is a wolf's day, not mine.", 's9', 2, 'Needs a target that is not himself.'), 1, true);
speech(3, 6, "Quillon has spoken four words in three days and voted with the crowd every time. That is a wolf's day, not mine.", 's9', 2, 's10');
bid(3, 2, 3, B(true, 3, 'I have been quiet because I was counting. You are the only living seat who was never a target of the night. Hollis.', 's10', 6, 'Named, and the count finally resolves.'), 1, true);
speech(3, 2, 'I have been quiet because I was counting. You are the only living seat who was never a target of the night. Hollis.', 's10', 6, 's11');

phase(3, 'vote', 8000);
confessional(3, 'vote', 2, 'vote', 'Three nights of targets and he was never one of them. That is not luck either.');
ballots(3, [
  { slot: 2, target: 6 }, { slot: 4, target: 6 }, { slot: 6, target: 4 },
  { slot: 7, target: 6 }, { slot: 8, target: 6 },
], 6, 'majority');
elimination(3, 'vote', 6, 'vote');

finished(3, {
  schema: 'wcw.results/1', rulesVersion: RULES,
  outcome: 'town_win', reason: 'wolves_eliminated', daysCompleted: 2,
  scores: [1, 1, 1, 0, 1, 1, 0, 1, 1],
});
roles(3);
seed(3);

export const JOURNAL = J;

export const EPISODE = {
  episodeId: 'wcw-demo-0001',
  gameVersion: '0.0.0-design-prototype',
  rulesVersion: RULES,
  maxDays: 8,
  /* Exclusive: events at or after this seq have not happened yet. Set inside Night 1. */
  liveHorizon: J.find(e => e.payload.kind === 'phase' && e.payload.phase === 'night' && e.day === 1).seq + 1,
  reconciliationNotes: [
    'Settled 2026-09-15: a Seer killed before inspection resolution receives nothing — no private_result, no seat-directed update. The only record is server-audience night_outcome(inspect, actor_dead), exported under night_choices. A living blocked Seer still receives a bare private_result of no_result.',
    'Settled 2026-09-15: every PublicSeat carries presentation — {kind:character, characterId, persona} or {kind:neutral}. It comes from trusted GameConfig.presentation[9], defaults to neutral, is never derived from the display name, and never asserts which policy, model or provider occupies the seat.',
    'Settled 2026-09-15: roles stay hidden on death until the terminal outcome.',
    'Settled 2026-09-15: the Alchemist submits kill and block together, either nullable, with blocks resolved before the kill nomination tally.',
    'Settled 2026-09-15: the public night runs a fixed duration regardless of what is submitted.',
  ],
};
