import { viewerConnection } from './connection.js';
import { nextReplayCursor } from './playback.js';
import { foldPhaseBanners } from './phase-banners.js';
import { Replay } from '../shared/replay.js';
import { ViewerPacket } from '../shared/events.js';
import { decodeText } from '../shared/decode.js';
import {deathReveal} from './stage-summary.js';
import { roleNames } from '../shared/roles.js';
// Embedded in another page (softmax.com), the host draws its own controls over our top-right corner.
try { if (window.self !== window.top) document.documentElement.classList.add('embedded'); } catch { document.documentElement.classList.add('embedded'); }
const params = new URLSearchParams(location.search);
const isSeatInspector=/\/client\/player\/?$/.test(location.pathname);
const replayUrl = new URLSearchParams(location.hash.slice(1)).get('replay') ?? params.get('replay');
let LIVE_PUBLIC = {episodeId:'Connecting…',events:[]}, REPLAY_EXPORT;
let refresh=()=>{};
function showError(message){document.getElementById('status-text').textContent=message;document.getElementById('status').setAttribute('role','alert');}
try {
 if(replayUrl){
  const response=await fetch(replayUrl);if(!response.ok||!response.body)throw Error('Replay download failed');
  const reader=response.body.getReader(),decoder=new TextDecoder();let data='',bytes=0;
  for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>32*1024*1024){await reader.cancel();throw Error('Replay too large');}data+=decoder.decode(chunk.value,{stream:true});}data+=decoder.decode();
  const parsed=decodeText(data,Replay,32*1024*1024);if(!parsed.ok)throw Error('Invalid or unsupported replay');REPLAY_EXPORT=parsed.value;
 }else{
  const socket=new WebSocket(viewerConnection(location.href).socket);
  socket.onmessage=message=>{const parsed=decodeText(message.data,ViewerPacket,32*1024*1024);if(!parsed.ok){showError('Invalid viewer data');socket.close();return;}
   const p=parsed.value;if(p.type==='reset')LIVE_PUBLIC={episodeId:p.episodeId,events:p.events};else{
    const incoming=p.events.filter(e=>e.cursor>LIVE_PUBLIC.events.length);if(incoming.length&&incoming[0].cursor!==LIVE_PUBLIC.events.length+1){showError('Stream gap — reload');socket.close();return;}LIVE_PUBLIC.events.push(...incoming);
   }refresh();};
  socket.onerror=()=>showError('Connection failed');socket.onclose=()=>{if(!LIVE_PUBLIC.events.some(e=>e.payload.kind==='finished'))showError('Disconnected — reload');};
 }
}catch(error){showError(error.message);throw error;}

/* ============================================================================
   Presentation fold.

   The page is handed two already-projected artifacts:
     LIVE_PUBLIC   a `wcw.viewer/1` reset packet — what a public spectator's socket
                   delivers while the episode runs.
     REPLAY_EXPORT a `wcw.replay/1` bundle — the completed static artifact.
   Both carry accepted `wcw.events/1` ProjectedEvents. Neither is filtered here for
   secrecy; that already happened in project.mjs, on the trusted side.

   This file turns accepted PAYLOAD KINDS into presentation BEATS. Beats are a
   design-only vocabulary; they are not wire kinds and must never redefine event
   semantics. The fold may add narration and derive the majority threshold. It never
   resolves a vote, determines death, or infers a hidden role.

     payload kind        beat
     ------------------  --------------------------------------------------
     started             (no beat; seeds the roster)
     phase               PhaseBanner, or NightScene / NightHold for a night
     speech              SpeechBeat
     ballots             VoteTally            (majority derived here)
     elimination         (no beat when cause 'wolf'; Knell when cause 'vote')
     night_resolved      Knell (dawn)
     finished            OutcomeBeat
     bid                 SealedBeat "Bidding"
     confessional        SealedBeat "Confessionals" / "Why they voted"
     wolf_chat           SealedBeat "Wolf channel"
     night_choices       SealedBeat "Night actions" (+ "Nothing to do")
     kill_resolution     SealedBeat "How the pack decided"
     night_outcome       SealedBeat "How the night resolved"
     private_result      SealedBeat "Private result"
     failure             SealedBeat "Fallback"
     roles               (no beat; unlocks role badges)
     seed                (never drawn)
   ========================================================================= */

const state = {
  source: replayUrl ? 'replay' : 'live',    // 'live' | 'replay' — context in the real product
  reveal: 'omniscient', // 'aired' | 'omniscient'. Replays open on everything; "No spoilers" narrows it
  cursor: 2,
  playing: Boolean(replayUrl),
};

const data = () => (state.source === 'live' ? LIVE_PUBLIC : REPLAY_EXPORT);
const maxCursor = () => data().events.length;
const findKind = k => data().events.find(e => e.payload.kind === k);

const ROSTER = () => (findKind('started') || { payload: { roster: [] } }).payload.roster;
const seat = n => ROSTER()[n] || { slot: n, name: 'Seat ' + n };
const nameOf = n => seat(n).name;
/* Presentation arrives on the seat itself, normalized by the game from trusted config.
   The display name is player data and must never select a persona. */
const presentationOf = n => seat(n).presentation || { kind: 'neutral' };
const isCharacter = n => presentationOf(n).kind === 'character';

const ROLE_LABEL = roleNames;
const ROLE_ART = {
  chef:'assets/wcw/roles/Role_Chef_outline.png', priest:'assets/wcw/roles/Role_Priest_outline.png', noble:'assets/wcw/roles/Role_Noble_01_outline.png', dairy_maid:'assets/wcw/roles/Role_Dairymaid_outline.png', track_reader:'assets/wcw/roles/Role_Track_reader_outline.png', jester:'assets/wcw/roles/Role_Villager_outline.png',
  wolf: 'assets/wcw/roles/Role_Wolf_outline.png',
  alchemist: 'assets/wcw/roles/Role_Alchemist_outline.png',
  seer: 'assets/wcw/roles/Role_Seer_outline.png',
  guard: 'assets/wcw/roles/Role_Guard_outline.png',
  sheep: 'assets/wcw/roles/Role_Villager_outline.png',
};
const ABILITY = { kill: 'Kill', block: 'Block', inspect: 'Inspect', protect: 'Protect', jail:'Jail', check:'Check role', inform:'Inform', track:'Track' };
const OUTCOME = { applied: 'took effect', blocked: 'blocked', protected: 'stopped by protection',
                  passed: 'passed', actor_dead: 'no result \u2014 the actor died before it resolved' };
const RESULT_WORD = { wolf: 'Wolf', not_wolf: 'Not a wolf', no_result: 'No result' };
const REQUEST_KIND = { bid: 'bid', noble_chat:'Noble chat turn', wolf_chat: 'wolf chat turn', vote: 'vote', night: 'night action' };
const FALLBACK = { bid: 'Declined the floor with empty text.', wolf_chat: 'Empty turn.',
                   vote: 'Null target. Recorded as an abstention.', night: 'Null for every offered ability.' };
const REVEAL_LABEL = { public: 'delivered live to everyone', discarded_bids: 'bidding',
  confessional: 'confessionals', wolf_chat: 'wolf chat', night_choices: 'night choices and results',
  failures: 'fallbacks', roles: 'roles and seed' };
const HUES = [18, 42, 96, 352, 212, 320, 272, 150, 8];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Drawing rule. Not a secrecy rule — everything it can return is already local. */
function visible(e) {
  if (e.cursor > state.cursor) return false;
  if (e.reveal === 'public') return true;
  return isSeatInspector || state.source === 'replay' && state.reveal === 'omniscient';
}
const shown = () => data().events.filter(visible);

/* Roles are drawn when the viewer asked for everything, or when the episode's own
   public ending has been reached. Per-seat scores are faction scores, so withholding
   roles after a published result would be theatre rather than secrecy. */
function rolesKnown(evs) {
  if (!findKind('roles')) return false;
  if (state.source === 'replay' && state.reveal === 'omniscient') return true;
  return evs.some(e => e.payload.kind === 'finished');
}
function publicRole(n) {
  return shown().find(e=>e.payload.kind==='elimination'&&e.payload.slot===n&&e.payload.role)?.payload??null;
}
function revealedName(n) {const role=deathReveal(shown(),n);return nameOf(n)+(role?` (${role})`:'');}
function roleOf(n) {
  if(publicRole(n))return publicRole(n);
  const ev = findKind('roles');
  const row = ev && ev.payload.roles.find(r => r.slot === n);
  return row || null;
}

function derive(evs) {
  const R = ROSTER();
  const m = {
    alive: R.map(() => true), died: R.map(() => null),
    speaking: null, accused: R.map(() => 0),
    lastBallot: R.map(() => undefined), spoke: R.map(() => 0),
    day: 0, phase: 'waiting', roles: rolesKnown(evs), finished: false, dusk: null, lastVote: null,
  };
  for (const e of evs) {
    const p = e.payload;
    if (p.kind === 'phase') { m.day = p.day; m.phase = p.phase; m.speaking = null; m.dusk = null; }
    if (p.kind === 'speech') {
      m.speaking = p.speech.slot; m.spoke[p.speech.slot]++;
      if (p.speech.accusation !== null) m.accused[p.speech.accusation]++;
    }
    if (p.kind === 'ballots') { m.lastBallot = R.map(() => undefined); p.ballots.forEach(b => m.lastBallot[b.slot] = b.target); m.dusk = p.ballots; m.lastVote = { day: e.day, ballots: p.ballots, eliminated: p.eliminated }; }
    if (p.kind === 'elimination') {
      m.alive[p.slot] = false;
      m.died[p.slot] = { cause: p.cause, day: e.day };
      if (m.speaking === p.slot) m.speaking = null;
    }
    if (p.kind === 'finished') { m.finished = true; m.phase = 'finished'; }
  }
  // Who performs the event at the cursor (a speaker, a Wolf chatting, a confessional, a night action), for the highlight.
  const last = evs.at(-1)?.payload;
  m.actor = !last ? null : last.kind === 'speech' ? last.speech.slot
    : ['confessional', 'wolf_chat', 'noble_chat', 'bid', 'night_choices', 'failure', 'suspicion', 'suspicion_dropped', 'private_result'].includes(last.kind) ? last.slot : null;
  return m;
}

/* ------------------------------------------------------------------ pieces */

/* Seats are numbered from 1 for people, matching the game screen and journal; `n` is the 0-based slot. */
function avatar(n, cls) {
  // Every seat is a character: the sheep until its role is known in this view, then the role's portrait.
  const r = viewRoles || publicRole(n) ? roleOf(n) : null;
  return `<span class="avatar char ${cls || ''}"${r ? ` data-faction="${esc(r.faction)}"` : ''} aria-hidden="true"><span class="face"><img src="${esc(r ? ROLE_ART[r.role] : SHEEP_ART)}" alt=""></span><b class="seat-tag">${n + 1}</b></span>`;
}
const SHEEP_ART = 'assets/wcw/player-card/Player_sheep_base.png';
/* Whether the current view reveals every role (set per render from the reveal setting and progress). */
let viewRoles = false;

function roleBadge(n) {
  const r = roleOf(n);
  return r ? `<span class="badge" data-faction="${esc(r.faction)}"><img class="role-icon" src="${esc(ROLE_ART[r.role])}" alt="">${esc(ROLE_LABEL[r.role] || r.role)}</span>` : '';
}

/* ------------------------------------------------------------ village board
   Desktop replay: the game's own table. Painted cards with character portraits, death marks,
   the speaking glow, and the closed vote stamped onto the cards until night falls. */
const SEAT_COLORS = ['#b5452f','#c07a1c','#8a8f1f','#3f8a4a','#2d8a86','#3a6fae','#6a55b0','#a2479a','#7d5b3c'];
const PLAY = 'assets/play/';
function scatter(key) {
  let h = 2166136261; for (const c of key) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>>0; }
  const pick = (shift, range) => ((h >>> shift) & 255) / 255 * range;
  return { x: Math.round(8 + pick(0, 50)), y: Math.round(6 + pick(8, 40)), r: Math.round(pick(16, 60) - 30) };
}
function renderBoard(m) {
  const R = ROSTER();
  document.getElementById('cards').innerHTML = R.map(s => {
    const n = s.slot, gone = m.died[n], r = m.roles || publicRole(n) ? roleOf(n) : null;
    const art = r ? ROLE_ART[r.role] : SHEEP_ART;
    let tag;
    if (gone) tag = `${r ? ROLE_LABEL[r.role] + ' · ' : ''}${gone.cause === 'vote' ? `Voted out day ${gone.day}` : `Killed night ${gone.day}`}`;
    else if (m.speaking === n) tag = r ? `${ROLE_LABEL[r.role]} · speaking` : 'Speaking';
    else tag = r ? `${ROLE_LABEL[r.role]} · ${r.faction === 'wolf' ? 'Wolf' : 'Town'}` : 'Role unknown';
    const stamps = (m.dusk || []).filter(b => b.target === n).map(b => {
      const p = scatter(`${b.slot}:${n}:${m.day}`);
      return `<img class="stamp" src="${PLAY}vote_banner_town_hoof.png" alt="" title="${esc(nameOf(b.slot))} voted ${esc(s.name)}" style="left:${p.x}%;top:${p.y}%;transform:rotate(${p.r}deg)">`;
    }).join('');
    const death = gone ? `<img class="death ${gone.cause === 'vote' ? 'meat' : 'claw'}" src="${PLAY}${gone.cause === 'vote' ? 'dead_icon_meat' : 'dead_icon_claw'}.png" alt="">` : '';
    return `<div class="card${gone ? ' dead' : ''}${r?.faction === 'wolf' ? ' wolf' : ''}${m.speaking === n && !gone ? ' speaking' : ''}${m.actor === n ? ' acting' : ''}" style="--seat:${SEAT_COLORS[n % 9]}" title="${esc(s.policyName ? `Policy: ${s.policyName}` : s.name)}">
      <img class="shadow" src="${PLAY}${r ? (r.faction === 'wolf' ? 'base_rolecard_red' : 'base_rolecard_blue') : 'base_playercard_shadow'}.png" alt="">
      <img class="art" src="${esc(art)}" alt="">${death}${stamps}
      <span class="no">${n + 1}</span><span class="plate">${esc(s.name)}</span><small>${esc(tag)}</small></div>`;
  }).join('');

  const v = m.lastVote, card = document.getElementById('vote-card');
  card.hidden = !v;
  if (v) {
    const counts = new Map(); for (const b of v.ballots) { const k = b.target === null ? 'pass' : b.target; counts.set(k, (counts.get(k) || 0) + 1); }
    const summary = [...counts].sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k === 'pass' ? 'pass' : esc(nameOf(k))} ×${c}`).join(' · ');
    const dot = n => `<span class="dot" style="--seat:${SEAT_COLORS[n % 9]}">${n + 1}</span>`;
    card.innerHTML = `<h3>Day ${v.day} vote · ${v.eliminated === null ? 'nobody eliminated' : `${esc(revealedName(v.eliminated))} eliminated`}</h3>
      <div class="ballots-row"><span class="sum">${summary}</span>${v.ballots.map(b => `<span class="bal">${dot(b.slot)}→${b.target === null ? '<i>pass</i>' : dot(b.target)}</span>`).join('')}</div>`;
  }
}

function renderSeats(m) {
  const list = document.getElementById('seats');
  const openSeats = new Set([...list.querySelectorAll('.seat[open]')].map(el => el.dataset.slot));
  const focusedSeat = document.activeElement?.closest?.('.seat')?.dataset.slot;
  const R = ROSTER();
  document.getElementById('alive-count').textContent = `${m.alive.filter(Boolean).length} of ${R.length} alive`;

  document.getElementById('seats').innerHTML = R.map(s => {
    const n = s.slot, gone = m.died[n];
    let st;
    if (gone) st = gone.cause === 'vote' ? `Voted out, day ${gone.day}` : `Lost in night ${gone.day}`;
    else if (m.speaking === n) st = 'Has the floor';
    else if (m.lastBallot[n] !== undefined) st = m.lastBallot[n] === null ? 'Abstained' : `Voted ${nameOf(m.lastBallot[n])}`;
    else st = 'In the fold';   /* the rail carries no presentation class at all */

    const tail = [];
    if (m.roles || publicRole(n)) tail.push(roleBadge(n));
    else if (m.accused[n] > 0) tail.push(`<span class="badge" data-tone="quiet">${m.accused[n]}&times; named</span>`);

    const pres = presentationOf(n);
    const detail = pres.kind === 'character'
      ? `<p class="persona">${esc(pres.persona)}</p>
         <p class="caveat">A character the game assigned to this seat. Not a claim about which policy plays it.</p>`
      : `<p>No character is configured for this seat. It is known by its display name and seat number, and nothing else.</p>`;
    const r = m.roles || publicRole(n) ? roleOf(n) : null;

    const face = avatar(n);
    return `<li><details class="seat" data-slot="${n}" ${openSeats.has(String(n)) ? 'open' : ''} data-alive="${!gone}" data-speaking="${m.speaking === n && !gone}" data-acting="${m.actor === n}">
      <summary>
        ${face}
        <span class="who"><span class="nm">${esc(s.name)}</span><span class="st">Seat ${n + 1} &middot; ${esc(st)}</span></span>
        <span class="tail">${tail.join('')}</span>
      </summary>
      <div class="detail">${detail}
        <dl><dt>Seat</dt><dd>${n + 1}</dd>
          ${s.policyName ? `<dt>Policy</dt><dd>${esc(s.policyName)}</dd>` : ''}
          <dt>Spoke</dt><dd>${m.spoke[n]} time${m.spoke[n] === 1 ? '' : 's'}</dd>
          <dt>Status</dt><dd>${esc(st)}</dd>
          ${r ? `<dt>Role</dt><dd>${esc(ROLE_LABEL[r.role])} &middot; ${r.faction === 'wolf' ? 'Wolf faction' : 'Town'}</dd>` : ''}
        </dl>
      </div>
    </details></li>`;
  }).join('');
  if (focusedSeat !== undefined) list.querySelector(`[data-slot="${focusedSeat}"] summary`)?.focus({ preventScroll: true });
}

/* Narration is added by the fold from phase and living count. It is presentation,
   never a claim about rules. */
function narrate(p, living) {
  if (p.phase === 'vote') return 'The village votes. Ballots are sealed until the window closes.';
  if (p.phase === 'night') return 'Night falls. The village sleeps.';
  if (p.day === 1) return `Day 1. Nine in the fold. ${Math.round(p.durationMs / 8000)} windows to speak.`;
  return `Day ${p.day}. ${living} remain.`;
}

function transitionBeat(e, all) {
  const p = e.payload;
  let file, title, copy;

  if (p.phase === 'night') {
    const voteDeath = [...all].reverse().find(x => x.cursor < e.cursor && x.day === e.day
      && x.payload.kind === 'elimination' && x.payload.cause === 'vote');
    file = voteDeath ? 'tscreen_day_death.png' : 'tscreen_day_nodeath.png';
    title = 'The Night Begins...';
    copy = voteDeath
      ? `${revealedName(voteDeath.payload.slot)} was voted out of the fold.`
      : 'No one reached a majority. The village turns in for the night.';
  } else if (p.day === 1) {
    file = 'tscreen_first_day.png';
    title = 'The First Day Begins...';
    copy = 'Nine voices enter the fold. The hunt begins.';
  } else {
    const resolved = [...all].reverse().find(x => x.cursor < e.cursor && x.day === p.day - 1
      && x.payload.kind === 'night_resolved');
    const lost = resolved ? resolved.payload.eliminated : [];
    file = lost.length ? 'tscreen_night_death.png' : 'tscreen_night_nodeath.png';
    title = 'The Day Begins...';
    copy = lost.length
      ? `${lost.map(revealedName).join(' and ')} did not survive the night.`
      : 'Morning reaches the village. Everyone is still in the fold.';
  }

  return `<section class="beat transition" data-to="${esc(p.phase)}">
    <img class="transition-art" src="assets/wcw/backgrounds/${file}" alt="">
    <span class="transition-scrim" aria-hidden="true"></span>
    <div class="transition-copy"><span class="eyebrow">Day ${p.day}</span><h2>${esc(title)}</h2><p>${esc(copy)}</p></div>
  </section>`;
}

/* The winning bid's text is committed directly as the speech (architecture design
   §5), so a selected bid is matched to its speech by author and text. */
function winningReason(sp, all) {
  const b = all.find(x => x.payload.kind === 'bid' && x.payload.selected
    && x.payload.slot === sp.slot && x.payload.bid.text === sp.text);
  return b ? b.payload.bid.reason : null;
}

function speechBeat(e, all) {
  const sp = e.payload.speech;
  const src = sp.replyTo ? all.find(x => x.id === sp.replyTo) : null;
  const why = winningReason(sp, all);
  const meta = (sp.accusation !== null || why)
    ? `<div class="meta">${sp.accusation !== null ? `<span class="badge" data-tone="quiet">Names ${esc(nameOf(sp.accusation))}</span>` : ''}${why ? `<span class="badge" data-tone="seal">Took the floor: ${esc(why)}</span>` : ''}</div>` : '';
  return `<article class="beat speech">
    ${avatar(sp.slot)}
    <div>
      <div class="hdr">
        <span class="nm">${esc(nameOf(sp.slot))}</span>
        <span class="seat-no">Seat ${sp.slot + 1}</span>
        ${src ? `<span class="reply">&#8618; replying to ${esc(nameOf(src.payload.speech.slot))}</span>` : ''}
      </div>
      <p class="body">${esc(sp.text)}</p>${meta}
    </div>
  </article>`;
}

function tallyBeat(e) {
  const p = e.payload;
  const counts = new Map();
  let abstain = 0;
  p.ballots.forEach(b => b.target === null ? abstain++ : counts.set(b.target, (counts.get(b.target) || 0) + 1));
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  if (abstain) rows.push(['abstain', abstain]);
  const top = Math.max(1, ...rows.map(r => r[1]));
  const majority = Math.floor(p.ballots.length / 2) + 1;   // derived by the fold
  return `<section class="beat tally">
    <h3>Ballots &middot; Day ${e.day}</h3>
    <p class="threshold">${majority} of ${p.ballots.length} votes needed for a majority${
      p.resolution === 'majority' ? '' : ' &middot; ' + esc(p.resolution.replace(/_/g, ' '))}</p>
    <div class="bars">${rows.map(([t, c]) => `
      <div class="bar" data-out="${t === p.eliminated}" data-abstain="${t === 'abstain'}">
        <span class="n">${t === 'abstain' ? 'Abstained' : esc(nameOf(t))}</span>
        <span class="track"><span class="fill" style="width:${(c / top) * 100}%"></span></span>
        <span class="c">${c}</span>
      </div>`).join('')}
    </div>
    <p class="ballot-label">Individual votes</p>
    <div class="ballots">${p.ballots.map(b => `
      <span class="ballot" data-abstain="${b.target === null}">
        ${esc(nameOf(b.slot))} <span class="arrow">&rarr;</span> ${b.target === null ? 'no one' : esc(nameOf(b.target))}
      </span>`).join('')}
    </div>
  </section>`;
}

function knell(slots, cause, rolesShown) {
  if (!slots.length) return '<article class="beat knell" data-cause="night"><span class="txt">Everyone made it through the night. No one was lost.</span></article>';
  const who = slots.map(revealedName).map(esc).map(n => `<b>${n}</b>`).join(' and ');
  const txt = cause === 'wolf'
    ? `At first light, ${who} ${slots.length === 1 ? 'was' : 'were'} gone.`
    : `${who} was voted out of the fold.`;
  return `<article class="beat knell" data-cause="${cause === 'wolf' ? 'night' : 'vote'}">
    <span class="glyph" aria-hidden="true">${cause === 'wolf' ? '&#9790;' : '&#10005;'}</span>
    <span class="txt">${txt}</span>
  </article>`;
}

function sealed(tag, inner, note) {
  return `<section class="beat sealed">
    <div class="hdr"><h3>${esc(tag)}</h3><span class="badge" data-tone="seal">Hidden during play</span></div>
    ${inner}${note ? `<p class="note">${esc(note)}</p>` : ''}
  </section>`;
}

function lineOf(n, main, sub) {
  return `<li class="line">${avatar(n)}<div>
    <span class="nm">${esc(nameOf(n))}</span>
    <p class="txt">${main}</p>
    ${sub ? `<div class="sub">${sub}</div>` : ''}
  </div></li>`;
}
const plainLine = html => `<li class="line" style="grid-template-columns:1fr"><p class="txt">${html}</p></li>`;

/* Consecutive private events of the same kind become one panel. A wolf conversation
   reads as a conversation; five headers read as a log file. */
function coalesce(evs) {
  const GROUP = { noble_chat: 1, wolf_chat: 1, night_choices: 1, confessional: 1, bid: 1, night_outcome: 1, suspicion: 1, suspicion_dropped: 1 };
  const out = [];
  for (const e of evs) {
    const k = e.payload.kind;
    const prev = out[out.length - 1];
    const same = prev && prev.payload.kind === k && prev.day === e.day && prev.phase === e.phase
      && (k !== 'confessional' || prev.payload.requestKind === e.payload.requestKind)
      && (k !== 'bid' || prev.payload.window === e.payload.window);
    if (GROUP[k] && same) { prev.group.push(e); continue; }
    out.push(GROUP[k] ? { ...e, group: [e] } : e);
  }
  return out;
}

function revealParts(e) {
  const p = e.payload;
  switch (p.kind) {
    case 'noble_chat':case 'wolf_chat':
      return { title: p.kind==='noble_chat'?'Noble channel':'Wolf channel',
        inner: `<ul>${e.group.map((w, i) => lineOf(w.payload.slot, esc(w.payload.text), `Turn ${i + 1}`)).join('')}</ul>`, };

    case 'bid': {
      const rows = e.group.map(b => b.payload).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
      // Nothing was discarded: the winning text is already on the floor as public
      // speech, and its reason rides with that beat instead.
      if (!rows.some(b => !b.selected)) return null;
      return { title: `${rows.filter(b => !b.selected).length} bids not taken · day ${e.day} · window ${p.window}`,
        inner: `<ul>${rows.map(b => lineOf(b.slot, esc(b.bid.text),
          `${b.rank===null?'Not ranked':`Ranked ${b.rank+1}`} &middot; urgency ${b.bid.urgency} &middot; ${esc(b.bid.reason)}` +
          (b.selected ? ' &middot; <b style="color:var(--lamp)">took the floor</b>' : ''))).join('')}</ul>`, };
    }

    case 'confessional':
      return { title: p.requestKind === 'vote' ? 'Why they voted' : 'Confessionals',
        inner: `<ul>${e.group.map(c => lineOf(c.payload.slot, esc(c.payload.text),
          `Authored with their ${esc(REQUEST_KIND[c.payload.requestKind] || c.payload.requestKind)}`)).join('')}</ul>`, };

    case 'night_choices': {
      const acted = e.group.filter(g => g.payload.actions.length);
      const idle = e.group.filter(g => !g.payload.actions.length).map(g => g.payload.slot);
      const rows = acted.map(g => {
        const a = g.payload.actions;
        const used = a.filter(x => x.target !== null)
          .map(x => `<strong>${ABILITY[x.ability]}</strong> &rarr; ${esc(nameOf(x.target))}${x.ability==='kill'&&x.killer!==undefined?` (performed by ${esc(nameOf(x.killer))})`:''}`).join(' &nbsp;·&nbsp; ');
        const passed = a.filter(x => x.target === null).map(x => ABILITY[x.ability]).join(', ');
        return lineOf(g.payload.slot, used || '<strong>Passed</strong>', passed ? `Offered but passed: ${passed}` : '');
      }).join('');
      const tail = idle.length
        ? plainLine(`<span style="color:var(--text-faint)">${idle.map(nameOf).map(esc).join(', ')} had no ability to use.</span>`) : '';
      return { title: 'Night actions', inner: `<ul>${rows}${tail}</ul>`, };
    }

    case 'night_outcome':
      return { title: 'How the night resolved',
        inner: `<ul>${e.group.map(g => {
          const o = g.payload;
          const actor = o.actor === null ? 'the wolf faction' : esc(nameOf(o.actor));
          const target = o.target === null ? 'no one' : esc(nameOf(o.target));
          const tone = o.outcome !== 'applied' ? 'var(--text-faint)'
            : o.ability === 'kill' ? 'var(--wolf)' : 'var(--text-dim)';
          return plainLine(`<strong>${ABILITY[o.ability]}</strong> &middot; ${actor} &rarr; ${target}
            &middot; <span style="color:${tone}">${esc(OUTCOME[o.outcome] || o.outcome)}</span>`);
        }).join('')}</ul>`, };

    case 'kill_resolution': {
      const tally = (rows, key) => rows.length ? rows.map(r => `${esc(nameOf(r[key]))} (${r.votes})`).join(', ') : 'none';
      return { title: 'How the pack decided', note: 'Each Wolf votes for a target and for who holds the knife; ties are broken at random.',
        inner: `<ul>${plainLine(`<strong>Target votes</strong> &middot; ${tally(p.targetVotes, 'target')}${p.targetTie ? ' &middot; <em>tie broken by seed</em>' : ''}`)}${plainLine(`<strong>Knife votes</strong> &middot; ${tally(p.knifeVotes, 'killer')}${p.knifeTie ? ' &middot; <em>tie broken by seed</em>' : ''}`)}${plainLine(p.target === null ? 'No target: the pack did not kill.' : `<strong>${esc(nameOf(p.killer))}</strong> takes the knife to <strong>${esc(nameOf(p.target))}</strong>.`)}</ul>`, };
    }

    case 'suspicion':
      return { title: 'What Town believed',
        inner: `<ul>${e.group.map(g => {
          const top = [...g.payload.reports].sort((a, b) => b.wolf - a.wolf).slice(0, 3);
          return lineOf(g.payload.slot, top.map(r => `<span class="susp"><span class="susp-bar" style="--w:${Math.round(r.wolf * 100)}%"></span>${esc(nameOf(r.slot))} ${Math.round(r.wolf * 100)}%</span>`).join(' '), 'Private wolf probabilities submitted with the vote');
        }).join('')}</ul>` };

    case 'suspicion_dropped': {
      const why = x => ({ missing: 'no suspicion list was submitted',
        wrong_count: 'the list did not cover exactly the other living players',
        unknown_player: `it included ${x.player === undefined ? 'an invalid seat' : esc(nameOf(x.player))}, who was not another living player`,
        duplicate_player: `it listed ${esc(nameOf(x.player))} twice`,
        out_of_range: `${esc(nameOf(x.player))}'s probability was not between 0 and 1` }[x.reason] || x.reason);
      return { title: 'Suspicion not scored',
        inner: `<ul>${e.group.map(g => lineOf(g.payload.slot, why(g.payload), 'The vote counted; this report scored as a know-nothing guess')).join('')}</ul>` };
    }

    case 'private_result':
      return { title: 'Private result',
        inner: `<ul>${lineOf(p.slot, `<strong>${ABILITY[p.result.ability]} ${esc(nameOf(p.result.target))}</strong>
          &rarr; <span class="verdict" data-v="${esc(p.result.result)}">${esc(Array.isArray(p.result.result)?(p.result.result.map(nameOf).join(', ')||'No visits'):RESULT_WORD[p.result.result]||ROLE_LABEL[p.result.result]||(p.result.result==='vanilla'?'Vanilla':p.result.result==='town'?'Confirmed town':p.result.result))}</span>`)}</ul>`, };

    case 'failure':
      return { title: 'Fallback',
        inner: `<ul>${lineOf(p.slot, `<strong>${esc(p.requestKind)} &middot; ${esc(p.code)}</strong> &mdash; ${esc(FALLBACK[p.requestKind] || 'Legal fallback applied.')}`,
          (p.source === 'game' ? 'The game applied a legal fallback' : 'The policy reported a failure and supplied a legal action')
          + ` &middot; attempt ${p.attempt} &middot; ${esc(p.disposition)}`)}</ul>`, };
  }
  return null;
}

function revealBeat(e) { const r = revealParts(e); return r ? sealed(r.title, r.inner, r.note) : ''; }

/* A night has no public content to interleave with, so its private material is one
   scene rather than six stacked panels. */
function nightScene(banner, body) {
  const sects = body.map(e => {
    const r = revealParts(e);
    return r ? `<div class="sect"><h4>${esc(r.title)}</h4>${r.inner}${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}</div>` : '';
  }).join('');
  return `<section class="beat scene">
    <header>
      <span class="mark">Night ${banner.day}</span>
      <span class="narr">Night falls. The village sleeps.</span>
      <span class="badge" data-tone="seal">Hidden during play</span>
    </header>${sects}</section>`;
}

function outcomeBeat(e) {
  const r = e.payload.result;
  const HEAD = { town_win: 'The flock holds.', wolf_win: 'The wolves keep the fold.',
                 jester_win:'The Trickster has the last laugh.', draw: 'The village never settled it.' };
  const WHY = { jester_voted_out:'The Trickster was voted out.', wolves_eliminated: 'All wolves are gone.',
                wolf_parity: 'The wolves reached parity.',
                day_cap: 'The day cap arrived with no faction ahead. Nobody wins; read and hidden bonuses still count.' };
  return `<section class="beat outcome">
    <h2>${esc(HEAD[r.outcome] || r.outcome)}</h2>
    <p class="detail">${esc(WHY[r.reason] || r.reason)} ${r.daysCompleted} night${r.daysCompleted === 1 ? '' : 's'} completed.</p>
    <div class="roster">${r.scores.map((sc, slot) => {
      const m = r.metrics?.[slot], cols = m ? [['read', 'read'], ['hidden', 'hidden'], ['vote_hit', 'vote hit'], ['survived', 'survived']].filter(([k]) => m[k] !== undefined).map(([k, label]) => `${label} ${m[k].toFixed(2)}`).join(' · ') : '';
      return `
      <div class="rrow">${avatar(slot)}<span class="nm">${esc(nameOf(slot))}</span>
        ${roleBadge(slot)}<span class="sc">${Number(sc).toFixed(2)}</span>${cols ? `<span class="cols">${esc(cols)}</span>` : ''}</div>`;}).join('')}
    </div>
  </section>`;
}

function holdBeat(durationMs) {
  return `<div class="beat hold">
    <p class="big">The village sleeps. Nothing is published until dawn.</p>
    <p class="why">The night runs its full ${Math.round(durationMs / 1000)} seconds whether or not anyone acts. No pending-action count, no readiness, no timing &mdash; and no gap in the cursor sequence. A night in which nothing happened must look exactly like this one.</p>
  </div>`;
}

function renderFloor(rawEvs, m) {
  const evs = coalesce(foldPhaseBanners(rawEvs));
  const out = [];
  let living = ROSTER().length;
  let i = 0;

  while (i < evs.length) {
    const e = evs[i], p = e.payload;

    if (p.kind === 'phase' && p.phase === 'night') {
      const priv = [], pub = [];
      let j = i + 1;
      while (j < evs.length && evs[j].day === e.day && evs[j].phase === 'night') {
        (evs[j].reveal === 'public' ? pub : priv).push(evs[j]); j++;
      }
      out.push(transitionBeat(e, rawEvs));
      out.push(priv.length
        ? nightScene(p, priv)
        : `<div class="beat phase" data-phase="night"><span class="mark">Night ${p.day}</span><span class="narr">Night falls. The village sleeps.</span></div>` + holdBeat(p.durationMs));
      for (const pe of pub) {
        if (pe.payload.kind === 'night_resolved') { out.push(knell(pe.payload.eliminated, 'wolf', m.roles)); living -= pe.payload.eliminated.length; }
      }
      i = j; continue;
    }

    if (p.kind === 'started') { i++; continue; }
    else if (p.kind === 'seed' || p.kind === 'roles') { i++; continue; }
    else if (p.kind === 'phase') {
      if (p.phase === 'day') out.push(transitionBeat(e, rawEvs));
      else {
        const label = p.phase === 'vote' ? 'The vote' : `Day ${p.day}`;
        out.push(`<div class="beat phase" data-phase="${esc(p.phase)}"><span class="mark">${esc(label)}</span><span class="narr">${esc(narrate(p, living))}</span></div>`);
      }
    }
    else if (p.kind === 'speech') out.push(speechBeat(e, rawEvs));
    else if (p.kind === 'ballots') out.push(tallyBeat(e));
    else if (p.kind === 'elimination') { if (p.cause === 'vote') { out.push(knell([p.slot], 'vote', m.roles)); living--; } }
    else if (p.kind === 'night_resolved') out.push(knell(p.eliminated, 'wolf', m.roles));
    else if (p.kind === 'finished') out.push(outcomeBeat(e));
    else out.push(revealBeat(e));
    i++;
  }
  if (!out.length) out.push('<div class="beat hold"><p class="big">The episode has not begun.</p></div>');
  patchFloor(document.getElementById('floor'), out);
  playPhaseOverlay();
}

/* Keep unchanged beats in place and replace only from the first difference, so a
   step does not reload images or replay entrance animations (the phase art used to
   flash on every step). A beat that was already on screen never animates again. */
let floorBeats = [], freshTransition = null, overlayTimer;
/* Desktop: a newly reached phase plays its painted card over the board, like the game's dusk and dawn screens. */
function playPhaseOverlay() {
  const html = freshTransition; freshTransition = null;
  // Only where the board is on screen (desktop and the mini village); elsewhere the banner stays in the feed.
  if (!html || getComputedStyle(document.getElementById('board')).display === 'none') return;
  const o = document.getElementById('phase-overlay');
  o.innerHTML = html; o.classList.add('show');
  clearTimeout(overlayTimer); overlayTimer = setTimeout(() => o.classList.remove('show'), 2400);
}
function patchFloor(floor, html) {
  const firstRender = !floorBeats.length;
  let k = 0;
  while (k < html.length && k < floorBeats.length && floorBeats[k].html === html[k]) k++;
  const seen = new Set(floorBeats.map(b => b.html));
  for (const b of floorBeats.slice(k)) b.nodes.forEach(n => n.remove());
  floorBeats = floorBeats.slice(0, k);
  for (const h of html.slice(k)) {
    const t = document.createElement('template');
    t.innerHTML = h;
    const nodes = [...t.content.childNodes];
    if (seen.has(h)) nodes.forEach(n => n.classList?.add('seen'));
    else if (!firstRender && nodes.some(n => n.classList?.contains('transition'))) freshTransition = h;
    floor.append(...nodes);
    floorBeats.push({ html: h, nodes });
  }
}

/* --------------------------------------- what the browser is actually holding */
function renderChrome(m) {
  const d = data(), live = state.source === 'live';
  document.body.dataset.world = m.finished ? 'finished' : m.phase === 'night' ? 'night' : 'day';
  const started = findKind('started');
  document.getElementById('ep-sub').textContent =
    `${d.episodeId} · ${ROSTER().length} players`;

  const st = document.getElementById('status');
  st.dataset.live = String(live);
  document.getElementById('status-text').textContent = live
    ? `Live · ${m.phase === 'night' ? `night ${m.day}` : m.phase === 'vote' ? `day ${m.day} vote` : `day ${m.day}`}`
    : m.finished ? 'Replay · complete' : 'Replay';

  document.querySelectorAll('.seg[data-kind="source"] button').forEach(b => b.setAttribute('aria-pressed', String(b.value === state.source)));
  const publicOnly = document.getElementById('public-only');
  publicOnly.checked = state.reveal === 'aired';
  publicOnly.disabled = live;
  const alive = m.alive.filter(Boolean).length;
  document.getElementById('day-title').textContent = m.finished ? 'Game over' : m.phase === 'night' ? `Night ${m.day}` : m.day ? `Day ${m.day}` : 'The fold';
  document.getElementById('day-sub').textContent = `${m.finished ? 'Final roles revealed' : m.dusk ? 'Votes revealed' : m.phase === 'vote' ? 'The village votes' : m.phase === 'night' ? 'The village sleeps' : m.day ? 'Discuss and deduce' : 'Waiting to begin'} · ${alive} of ${ROSTER().length} alive`;
  document.getElementById('voices-sub').textContent = state.reveal === 'aired' ? 'No spoilers · what the table saw' : 'Everything · public talk, private chats and night actions';
  document.getElementById('phase-line').textContent = `${m.finished ? 'Game over' : m.phase === 'night' ? `Night ${m.day}` : m.phase === 'vote' ? `Day ${m.day} · vote` : `Day ${m.day}`} · ${alive}/${ROSTER().length} alive`;
  document.querySelector('.brand').title = document.getElementById('ep-sub').textContent;
  document.getElementById('reveal-hint').textContent = live
    ? 'Public view · roles stay secret until the episode ends.'
    : state.reveal === 'aired' ? 'No spoilers: only what the table saw as it happened.' : 'Showing roles, private chats and night actions. Tick No spoilers to hide them.';

  ['play', 'prev', 'next', 'tlabel'].forEach(id => { document.getElementById(id).hidden = live; });
  document.querySelector('.timeline').hidden = live;
  document.getElementById('livebar').hidden = !live;

  const scrub = document.getElementById('scrub');
  scrub.max = maxCursor(); scrub.value = Math.min(state.cursor, maxCursor());
  document.querySelector('.public-only').title = document.getElementById('reveal-hint').textContent;
  document.getElementById('tlabel').textContent =
    m.finished ? 'End of episode' : m.phase === 'night' ? `Night ${m.day}` : m.phase === 'vote' ? `Day ${m.day} · vote` : `Day ${m.day}`;
  const play = document.getElementById('play');
  play.textContent = state.playing ? 'Ⅱ Pause' : state.cursor >= maxCursor() ? '↻ Replay' : '▶ Play';
  play.setAttribute('aria-label', state.playing ? 'Pause replay' : state.cursor >= maxCursor() ? 'Restart replay' : 'Play replay');
  play.setAttribute('aria-pressed', String(state.playing));
  document.getElementById('prev').disabled = !playbackCursors().some(c => c < state.cursor);
  document.getElementById('next').disabled = !playbackCursors().some(c => c > state.cursor);
  scrub.setAttribute('aria-valuetext', document.getElementById('tlabel').textContent);

  const segs = [];
  for (const e of d.events) {
    const k = e.day + ':' + e.phase, last = segs[segs.length - 1];
    if (last && last.k === k) { last.n++; last.end = e.cursor; }
    else segs.push({ k, n: 1, phase: e.phase, end: e.cursor });
  }
  document.getElementById('segments').innerHTML = segs.map(x =>
    `<span class="sgm" data-phase="${esc(x.phase)}" data-past="${state.cursor >= x.end}" style="flex:${x.n}"></span>`).join('');
}

function render({ follow = true } = {}) {
  if (state.source === 'live') { state.reveal = 'aired'; state.cursor = Infinity; }
  state.cursor = Math.max(1, Math.min(Number.isNaN(state.cursor) ? 2 : state.cursor, maxCursor()));
  const evs = shown();
  const m = derive(evs);
  viewRoles = m.roles;
  renderChrome(m);

  renderSeats(m);
  renderBoard(m);
  renderFloor(evs, m);
  // Follow new events inside the floor only. Never scroll the page: embedded on softmax.com,
  // scrollIntoView also scrolled the host page on every step, carrying the pause button away.
  const fl = document.getElementById('floor');
  if (follow) fl.scrollTop = fl.scrollHeight;
}

/* ------------------------------------------------------------------ wiring */
document.querySelectorAll('.seg[data-kind="source"] button').forEach(b =>
  b.addEventListener('click', () => { state.source = b.value; state.cursor = b.value === 'live' ? Infinity : 2; state.playing = b.value === 'replay'; render(); }));
// Compact layout: short frames tuck the seats behind a button; chips open one detail pop-over at a time.
const compact = typeof matchMedia === 'function' ? matchMedia('(max-width: 1000px)') : { matches: false };
document.getElementById('seats-btn').addEventListener('click', ev => {
  const open = document.body.classList.toggle('seats-open');
  ev.currentTarget.setAttribute('aria-expanded', String(open));
});
document.getElementById('seats').addEventListener('toggle', ev => {
  if (!compact.matches || !ev.target.open) return;
  document.querySelectorAll('#seats .seat[open]').forEach(s => { if (s !== ev.target) s.open = false; });
}, true);
document.querySelectorAll('.voices-tabs button').forEach(b => b.addEventListener('click', () => {
  document.getElementById('floor').dataset.filter = b.dataset.filter;
  document.querySelectorAll('.voices-tabs button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
}));
document.getElementById('public-only').addEventListener('change', ev => { state.reveal = ev.currentTarget.checked ? 'aired' : 'omniscient'; render(); });

// Navigate only events that can change this view; hidden replay events must not
// create apparently unresponsive steps or long silent pauses in As it aired.
function playbackCursors() {
  return data().events.filter(e => !['started', 'roles', 'seed'].includes(e.payload.kind)
    && (e.reveal === 'public' || state.reveal === 'omniscient')).map(e => e.cursor);
}
function advance(direction, loop = false) {
  state.cursor = nextReplayCursor(playbackCursors(), state.cursor, maxCursor(), direction, loop);
}
const step = direction => { state.playing = false; advance(direction); render(); };
function togglePlayback() {
  if (!state.playing && state.cursor >= maxCursor()) state.cursor = playbackCursors()[0] || 1;
  state.playing = !state.playing;
  render({ follow: false });
}
const scrub = document.getElementById('scrub');
scrub.addEventListener('input', () => { state.cursor = +scrub.value; state.playing = false; render(); });
document.getElementById('prev').addEventListener('click', () => step(-1));
document.getElementById('next').addEventListener('click', () => step(1));
document.getElementById('play').addEventListener('click', togglePlayback);

setInterval(() => {
  if (!state.playing || state.source === 'live') return;
  const floor = document.getElementById('floor');
  const following = floor.scrollHeight - floor.clientHeight - floor.scrollTop < 48;
  advance(1, true);
  render({ follow: following });
}, 1400);

addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { document.querySelector('.deps').open = false; return; }
  if (state.source === 'live' || ev.altKey || ev.ctrlKey || ev.metaKey
    || ev.target.closest('button, input, textarea, select, summary, a, [contenteditable]')) return;
  if (!['ArrowRight', 'ArrowLeft', ' ', 'Home', 'End'].includes(ev.key)) return;
  ev.preventDefault();
  if (ev.key === 'ArrowRight') step(1);
  else if (ev.key === 'ArrowLeft') step(-1);
  else if (ev.key === ' ') togglePlayback();
  else { state.playing = false; state.cursor = ev.key === 'Home' ? playbackCursors()[0] || 1 : maxCursor(); render(); }
});

/* deep links, for capturing evidence at exact states */
const q = new URLSearchParams(location.search);

if (['aired', 'omniscient'].includes(q.get('reveal'))) state.reveal = q.get('reveal');
if (q.has('cursor') && Number.isFinite(+q.get('cursor'))) {
  state.cursor = Math.max(1, Math.floor(+q.get('cursor')));
  state.playing = false; // Explicit evidence links stay at the requested event.
}

refresh = () => render({follow:true});
render();
if (q.get('open')) q.get('open').split(',').forEach(i => {
  const el = document.querySelectorAll('.seat')[+i]; if (el) el.open = true;
});
