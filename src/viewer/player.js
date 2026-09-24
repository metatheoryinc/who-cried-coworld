import {createAssetCache} from './asset-cache.js';
import { playerConnection } from './connection.js';
import { knownRole } from './known-role.js';
import { deathCause,deathReveal,stageSummary } from './stage-summary.js';
import { traySlots,placementsFrom,place,clear,bodyFor,packStamps,stampsOn,skipVote } from './stamps.js';
import { stampIcon,stampLabels,stampArt,scatter,knifeSvg } from './stamp-icons.js';
import { systemLines } from './system-lines.js';
import { unread } from './unread.js';
import { roleNames,newD3Decks } from '../shared/roles.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assets=createAssetCache(),asset=assets.url;
const art={wolf:'Role_Wolf_outline',alchemist:'Role_Alchemist_outline',track_reader:'Role_Track_reader_outline',seer:'Role_Seer_outline',guard:'Role_Guard_outline',chef:'Role_Chef_outline',dairy_maid:'Role_Dairymaid_outline',priest:'Role_Priest_outline',noble:'Role_Noble_01_outline',sheep:'Role_Villager_outline',jester:'Role_Villager_outline'};
const descriptions={wolf:'Hide among the sheep. Coordinate with your pack and choose a killer each night.',alchemist:'A wolf with a potion: block one player and nominate your pack’s kill each night.',track_reader:'A wolf who learns roles. Sheep and ordinary Wolves both appear as vanilla.',seer:'Each night, inspect one player to learn whether they are a wolf.',guard:'Protect one other player from the wolves each night.',chef:'Jail one player each night: block their action and protect them from the kill.',dairy_maid:'Visit someone at night. They learn that you are town.',priest:'Track one player each night to see whom they actually visited.',noble:'You know your fellow Nobles are town. Coordinate in your private channel.',sheep:'Your voice and your vote are your powers. Find the wolves before they outnumber you.',jester:'Convince the village to vote you out. Dying at night does not count.'};
const sunIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',moonIcon='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
const labels={discussion:'Discuss & deduce',vote:'Cast your vote',coordination:'Night whispers',actions:'Make your move',dusk:'The Night Begins…',dawn:'The Day Begins…'};
// Stamp drafts: placements are local until the server confirms them; they count when the timer ends.
// freshStamp animates a stamp once, on the redraw right after it is placed.
let freshStamp=null,placements={},held=null,draftKey=null,dirty=false,saveState='idle',changeSeq=0,sentSeq=0,sendTimer;
let state=null,ws,channel='town',lastRender='',actionKey='',remainingUntil=0,joined=false,connecting=false,ended=false,pendingChat=null,pendingChannel=null;
// Each channel keeps its own unsent draft so private text can never be sent to another channel after switching tabs.
const drafts={};
const params=new URLSearchParams(location.search);
let slot=params.get('slot'),connection;
/** Connection is a status light by the clock; the full message is its label, and errors are also shown as text. */
function setConnection(kind,label){const c=$('connection');c.hidden=kind==='idle';c.dataset.state=kind;c.title=label;c.setAttribute('aria-label',label);if(kind==='error')$('feedback').textContent=label;}
try{connection=playerConnection(location.href);}catch{setConnection('error','Invalid seat link. Open your game invitation again.');$('join').disabled=true;}
const storageKey=`wcw-joined:${connection?.socket??location.href}`;
function name(slot){return state?.roster[slot]?.name??`Seat ${slot+1}`;}
function feedback(t){$('feedback').textContent=t;}
const phone=matchMedia('(max-width:760px)');
let sheetOpen=true,sheetKey=null;
/** The stamp a click places: the one picked up, or the only stamp when a decision has just one. */
function activeStamp(){const r=stampRequest();if(!r)return null;const slots=traySlots(r);return held??(slots.length===1?slots[0].id:null);}
/** The closed vote of the current day stays stamped on the cards through dusk and night. */
function closedBallots(){
 if(!state||['discussion','vote'].includes(state.period)||state.phase==='waiting')return null;
 const e=state.events.filter(e=>e.payload.kind==='ballots'&&e.day===state.day).at(-1);
 return e?{id:e.id,ballots:e.payload.ballots}:null;
}
function mark(kind,id,key,title,extra=''){const {x,y,r}=scatter(key);return `<span class="stamp-mark ${kind}" style="--x:${x}%;--y:${y}%;--r:${r}deg" title="${esc(title)}" ${extra}>${stampIcon(id,asset)}</span>`;}
function seatMarks(target){
 const r=stampRequest(),own=r?stampsOn(placements,target):[],pack=(state?.packDrafts?packStamps(state.packDrafts):[]).filter(x=>x.slot===target);
 const closed=closedBallots(),votes=closed?closed.ballots.filter(b=>b.target===target):[],skips=closed?closed.ballots.filter(b=>b.target===null&&b.slot===target):[];
 const ownSkip=r?.kind==='vote'&&placements.skip&&target===state.self.slot;
 const html=[
  ...votes.map(b=>mark('ballot','vote',`ballot:${b.slot}:${target}`,`${name(b.slot)} voted ${name(target)}`,`data-from="${b.slot}"`)),
  ...skips.map(b=>mark('ballot skip','skip',`skip:${b.slot}`,`${name(b.slot)} skipped the vote`,`data-from="${b.slot}"`)),
  ...own.map(id=>mark(`own${freshStamp===`${id}:${target}`?' fresh':''}`,id,`${id}:${target}:self`,`Your ${stampLabels[id]}`)),
  ...(ownSkip?[mark(`own skip${freshStamp==='skip'?' fresh':''}`,'skip','skip:self','You are skipping the vote')]:[]),
  ...pack.map(x=>mark('pack',x.id,`${x.id}:${target}:${x.by}`,`${name(x.by)}: ${stampLabels[x.id]}`).replace('</span>',`<b aria-hidden="true">${x.by+1}</b></span>`)),
 ].join('');
 return {own,html,described:[...own.map(id=>`your ${stampLabels[id]}`),...(ownSkip?['you are skipping the vote']:[]),...pack.map(x=>`${name(x.by)}'s ${stampLabels[x.id]}`),...(votes.length?[`${votes.length} vote${votes.length>1?'s':''}`]:[])].join(', ')};
}
function drawPlayers(){
 const roster=state?.roster??Array.from({length:9},(_,i)=>({slot:i,name:slot!==null&&i===Number(slot)?'You':`Player ${i+1}`,alive:true}));
 const r=stampRequest(),active=activeStamp(),targets=active?traySlots(r).find(x=>x.id===active)?.targets??[]:[];
 $('players').innerHTML=roster.map(p=>{
  const known=knownRole(state,p.slot),you=state?.self?.slot===p.slot;
  const cause=deathCause(state?.events??[],p.slot);
  const seat=state?.lobby?.seats[p.slot];
  const status=seat?(you||p.slot===state.self?.slot||p.slot===Number(slot)&&seat==='human'?'You':{human:'Joined',ai:'AI ready',open:'Open seat'}[seat]):!state&&!joined?'':!p.alive?(cause==='wolf'?'Killed by wolves':cause==='vote'?'Eliminated by town':'Eliminated'):you?`${roleNames[state.self.role]} · You`:known?roleNames[known]:'Role unknown';
  const tag=!p.alive&&deathReveal(state?.events??[],p.slot)?`${deathReveal(state.events,p.slot)} · ${status}`:status;
  const m=seatMarks(p.slot),target=targets.includes(p.slot),pick=!active&&m.own.length>0,open=phone.matches&&!!state?.self;
  const speaking=state?.period==='discussion'&&state.floor?.slot===p.slot;
  return `<button class="player ${p.alive?'':'dead'} ${seat==='open'?'open-seat':''} ${target?'eligible':''} ${active&&!target?'dim':''} ${speaking?'speaking':''}" data-slot="${p.slot}" title="${esc(p.policyName?`Policy: ${p.policyName}`:p.name)}" ${target||pick||open?'':'disabled'} aria-label="Seat ${p.slot+1}, ${esc(p.name)}, ${esc(tag)}${speaking?', speaking':''}${m.described?`, ${esc(m.described)}`:''}${target?`, place ${stampLabels[active]}`:pick?', pick up your stamp':open?', show player card':''}"><img src="${asset('base_playercard_shadow')}" alt=""><img class="${known?'known-role':'sheep'}" src="${asset(known?art[known]:'Player_sheep_base')}" alt=""><span class="seat-no seat-c${p.slot}">${p.slot+1}</span>${m.html?`<span class="card-stamps">${m.html}</span>`:''}${!p.alive?deathMark(cause):''}<span class="card-foot"><span class="name">${esc(p.name)}</span>${tag?`<small>${esc(tag)}</small>`:''}</span></button>`;
 }).join('');
 $('players').querySelectorAll('.player:not(:disabled)').forEach(b=>b.onclick=()=>onCard(Number(b.dataset.slot)));
 revealBallots();updateCursor();
 const filled=state?.lobby?.seats.filter(s=>s!=='open').length;
 $('alive').textContent=inLobby()?(filled===undefined?'9 seats':`${filled} of 9 seats filled`):`${roster.filter(p=>p.alive).length} alive · Majority ${Math.floor(roster.filter(p=>p.alive).length/2)+1}`;
}
function drawAction(){
 if(stampRequest()){actionKey='';drawTray();return;}
 const o=state.observation,key=`${JSON.stringify(state.lobby)}:${state.phase}:${state.period}:${o?.requestId}:${state.self?.alive}:${state.result?.outcome}:${state.floor?.turn}`;
 if(key===actionKey)return;actionKey=key;feedback('');
 if(state.result){$('action').innerHTML=`<span class="eyebrow">THE STORY ENDS</span><h2 class="result">${esc({town_win:'The village prevails',wolf_win:'The wolves prevail',jester_win:'The Trickster wins',draw:'A village divided'}[state.result.outcome])}</h2><p>${state.result.scores[Number(slot)]?'You won.':'The game is complete.'} ${esc(connection.replayNotice)}</p><a href="${esc(connection.replayPage)}" target="_blank" rel="noopener noreferrer">${esc(connection.replayLabel)}</a>`;return;}
 if(!state.self){const seats=state.lobby?.seats??[],humans=seats.filter(s=>s==='human').length,filled=seats.filter(s=>s!=='open').length;
  $('action').innerHTML=`<h2>You have a seat</h2><p>${filled} of 9 seats filled · ${humans} ${humans===1?'human':'humans'} joined.</p><p class="hint">Play starts when every seat is filled${state.lobby?.startsInMs!=null?', or when the countdown ends':''}. Your secret role is dealt when the game begins.</p>`;return;}
 if(!state.self.alive){$('action').innerHTML='<h2>Your story lives on</h2><p>You have been eliminated. Follow the public conversation while the village plays on.</p>';return;}
 $('action').innerHTML=`<h2>${state.period==='coordination'?'The village sleeps':'The floor is open'}</h2><p>${state.period==='coordination'?'Wolves and Nobles can coordinate privately. Night actions follow in a moment.':state.floor?`The host called on ${esc(name(state.floor.slot))}${state.floor.replyingToHuman?' to respond to you':''}.${state.floor.prompt?` ${esc(state.floor.prompt)}`:''} One bot speaks each 13-second turn. You can chat at any time.`:'Share your suspicions in Town chat.'}</p>`;
}
function stampRequest(){const r=state?.observation?.request;return !state?.result&&state?.self?.alive&&(r?.kind==='vote'||r?.kind==='night')?r:null;}
/** Adopt the server's draft for a new request, or when no local change is waiting to be saved. */
function syncStamps(){
 const r=stampRequest(),key=r?state.observation.requestId:null;
 if(key!==draftKey){draftKey=key;held=null;dirty=false;clearTimeout(sendTimer);placements=r?placementsFrom(r,state.accepted):{};saveState=state.accepted?'saved':'idle';}
 else if(r&&!dirty)placements=placementsFrom(r,state.accepted);
}
function drawTray(){
 const r=stampRequest(),slots=traySlots(r);
 if(!slots.length){$('action').innerHTML='<h2>Rest until morning</h2><p>You have no night ability. The village wakes when the timer runs out.</p>';return;}
 const focused=document.activeElement?.dataset?.stamp,any=slots.some(x=>placements[x.id]!=null);
 const status={idle:'Nothing stamped yet · you pass if the timer ends',saving:'Saving…',saved:any?'Saved · counts when the timer ends':'Saved · you pass when the timer ends',error:'Could not save that change · your last saved choice still counts'}[saveState];
 const target=(x)=>{const t=placements[x.id];return t==null?(x.id==='vote'&&placements.skip?'skipped':'pass'):x.id==='knife'&&t===state.self.slot?'You':name(t);};
 $('action').innerHTML=`<h2>${r.kind==='vote'?'Who do you suspect?':'Your night actions'}</h2><p>${held?`Tap a glowing player to place ${esc(stampLabels[held])}. Press Esc to cancel.`:slots.length===1?`Tap a player to ${r.kind==='vote'?'vote for them. A strict majority eliminates someone':`use ${esc(stampLabels[slots[0].id])}`}. You can change it until the timer ends.`:'Pick up a stamp, then tap a player. You can change it until the timer ends.'}</p><div class="tray">${r.kind==='vote'&&placements.vote==null?`<div class="stamp-slot"><button type="button" class="stamp skip${placements.skip?' held':''}" data-skip aria-pressed="${!!placements.skip}">${stampIcon('skip',asset)}<span>Skip vote</span><small>${placements.skip?'Skipping this vote':'Pass this vote'}</small></button>${placements.skip?'<button type="button" class="stamp-clear" data-clear-skip aria-label="Undo skip">×</button>':''}</div>`:''}${slots.filter(x=>!(x.id==='vote'&&placements.skip)).map(x=>`<div class="stamp-slot"><button type="button" class="stamp${held===x.id?' held':''}" data-stamp="${x.id}" aria-pressed="${held===x.id}">${stampIcon(x.id,asset)}<span>${stampLabels[x.id]}</span><small>${esc(target(x))}</small></button>${placements[x.id]!=null?`<button type="button" class="stamp-clear" data-clear="${x.id}" aria-label="Clear ${stampLabels[x.id]}">×</button>`:''}</div>`).join('')}</div><div class="sheet-seats phone-only">${sheetSeats(r)}</div><p class="draft-status ${saveState}" role="status">${status}</p>`;
 $('action').querySelectorAll('.sheet-seat:not(:disabled)').forEach(b=>b.onclick=()=>onCard(Number(b.dataset.slot)));
 $('action').querySelectorAll('[data-stamp]').forEach(b=>b.onclick=()=>{held=held===b.dataset.stamp?null:b.dataset.stamp;refreshStamps();});
 $('action').querySelector('[data-skip]')?.addEventListener('click',()=>{placements=skipVote(placements);held=null;freshStamp='skip';scheduleSend();refreshStamps();});
 $('action').querySelector('[data-clear-skip]')?.addEventListener('click',()=>{placements={...placements,vote:null,skip:false};held=null;scheduleSend();refreshStamps();});
 $('action').querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{placements=clear(placements,b.dataset.clear);held=null;scheduleSend();refreshStamps();});
 if(focused)$('action').querySelector(`[data-stamp="${focused}"]`)?.focus();
}
function sheetSeats(r){
 const active=activeStamp(),targets=active?traySlots(r).find(x=>x.id===active)?.targets??[]:[];
 return state.roster.map(p=>{const m=seatMarks(p.slot),target=targets.includes(p.slot),pick=!active&&m.own.length>0;
  return `<button type="button" class="sheet-seat ${p.alive?'':'dead'} ${target?'eligible':''} ${active&&!target?'dim':''}" data-slot="${p.slot}" ${target||pick?'':'disabled'} aria-label="Seat ${p.slot+1}, ${esc(p.name)}${m.described?`, ${esc(m.described)}`:''}"><span class="seat-no seat-c${p.slot}">${p.slot+1}</span><span class="sheet-name">${esc(p.name)}${p.slot===state.self.slot?' (you)':''}</span>${m.html?`<span class="sheet-marks">${m.html}</span>`:''}</button>`;}).join('');
}
function refreshStamps(){drawPlayers();drawTray();updateSheet();freshStamp=null;}
/** Phone decision sheet: open for a new request, collapsible to a pill that shows the clock. */
function updateSheet(){
 const r=stampRequest(),key=r?state.observation.requestId:null;
 if(key!==sheetKey){sheetKey=key;sheetOpen=true;}
 document.body.classList.toggle('stamping',!!r);
 document.body.classList.toggle('sheet-collapsed',!!r&&!sheetOpen);
 $('sheet-pill').hidden=!r||sheetOpen;
}
$('sheet-hide').onclick=()=>{sheetOpen=false;held=null;refreshStamps();};
$('sheet-pill').onclick=()=>{sheetOpen=true;refreshStamps();};
function openCard(target){
 const p=state.roster[target],known=knownRole(state,target),cause=deathCause(state.events,target),reveal=deathReveal(state.events,target);
 const votes=state.events.flatMap(e=>e.payload.kind==='ballots'?[{day:e.day,cast:e.payload.ballots.find(b=>b.slot===target),received:e.payload.ballots.filter(b=>b.target===target).length}]:[]);
 $('card-content').innerHTML=`<div class="card-art"><img src="${asset('base_playercard_shadow')}" alt=""><img src="${asset(known?art[known]:'Player_sheep_base')}" alt=""></div><span class="eyebrow">SEAT ${target+1}</span><h2 id="card-title">${esc(p.name)}${target===state.self?.slot?' · you':''}</h2><p>${p.alive?'Alive':cause==='wolf'?'Killed by wolves':'Eliminated by town'}${reveal?` · ${esc(reveal)}`:known?` · ${esc(roleNames[known])}`:''}</p>${p.policyName?`<p class="hint">Policy: ${esc(p.policyName)}</p>`:''}${votes.length?`<h3>Votes</h3><ul>${votes.map(v=>`<li>Day ${v.day}: ${v.cast?v.cast.target===null?'passed':`voted ${esc(name(v.cast.target))}`:'did not vote'} · received ${v.received}</li>`).join('')}</ul>`:''}`;
 $('card-sheet').showModal();
}
$('card-close').onclick=()=>$('card-sheet').close();
$('card-sheet').onclick=e=>{if(e.target===$('card-sheet'))$('card-sheet').close();};
$('role-chip').onclick=()=>document.body.classList.add('you-open');
$('you-close').onclick=()=>document.body.classList.remove('you-open');
$('help').onclick=()=>openGuide();
function drawChip(){
 const self=state?.self;$('role-chip').hidden=!self;$('help').disabled=!state?.gameSetup;
 if(self)$('role-chip').innerHTML=`<img src="${asset(art[self.role])}" alt=""><span>${esc(roleNames[self.role])}</span>`;
}
function onCard(target){
 const r=stampRequest();
 const active=activeStamp();
 if(r&&active&&traySlots(r).find(x=>x.id===active)?.targets.includes(target)){placements=place(placements,r,active,target,state.self.slot);if(placements[active]===target)freshStamp=`${active}:${target}`;held=null;scheduleSend();sheetOpen=true;}
 else if(r&&stampsOn(placements,target).length)held=stampsOn(placements,target)[0];
 else if(phone.matches&&state?.self){openCard(target);return;}
 else return;
 refreshStamps();
}
function scheduleSend(){dirty=true;saveState='saving';changeSeq++;clearTimeout(sendTimer);sendTimer=setTimeout(sendDraft,250);}
function sendDraft(){
 const r=stampRequest(),o=state?.observation;if(!r||!o)return;
 if(ws?.readyState!==WebSocket.OPEN){saveState='error';drawTray();return;}
 sentSeq=changeSeq;ws.send(JSON.stringify({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body:bodyFor(r,placements),report:null}));
}
function draftReceipt(p){
 if(['accepted','duplicate'].includes(p.status)){if(sentSeq===changeSeq){dirty=false;saveState='saved';}}
 else{dirty=false;saveState='error';const r=stampRequest();if(r)placements=placementsFrom(r,state.accepted);}
 if(stampRequest())refreshStamps();
}
let revealed=null,revealUntil=0;
/** When the vote closes, each ballot flies from its voter's card and stamps its target; the dusk screen waits for it. */
function revealBallots(){
 const closed=closedBallots();
 if(!closed||revealed===closed.id||state.period!=='dusk')return;
 revealed=closed.id;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const marks=[...$('players').querySelectorAll('.stamp-mark.ballot')];
 marks.forEach((m,i)=>{
  const from=$('players').querySelector(`.player[data-slot="${m.dataset.from}"]`)?.getBoundingClientRect(),to=m.getBoundingClientRect();if(!from)return;
  const dx=from.left+from.width/2-(to.left+to.width/2),dy=from.top+from.height/2-(to.top+to.height/2),r=getComputedStyle(m).getPropertyValue('--r').trim()||'0deg';
  m.animate([{transform:`translate(${dx}px,${dy}px) scale(.6) rotate(0deg)`,opacity:0},{transform:`translate(${dx*.25}px,${dy*.25}px) scale(2.1) rotate(${r})`,opacity:1,offset:.75},{transform:`translate(0,0) scale(1) rotate(${r})`,opacity:.95}],{duration:650,delay:250+i*160,easing:'cubic-bezier(.3,.7,.4,1)',fill:'backwards'});
 });
 revealUntil=performance.now()+250+marks.length*160+650+700;
 setTimeout(()=>{lastInterlude='';drawInterlude();},revealUntil-performance.now()+20);
}
/** The held stamp (or the only stamp of a one-stamp decision) becomes the mouse cursor over eligible players. */
const cursorCache=new Map();
function updateCursor(){
 const id=activeStamp();document.body.classList.toggle('holding',!!held);
 if(!id){document.body.style.removeProperty('--stamp-cursor');return;}
 const set=url=>{if(activeStamp()===id)document.body.style.setProperty('--stamp-cursor',`url("${url}") 20 20, crosshair`);};
 if(cursorCache.has(id))return set(cursorCache.get(id));
 const artName=stampArt(id),img=new Image();
 img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=40;const k=Math.min(40/img.width,40/img.height),w=img.width*k,h=img.height*k;c.getContext('2d').drawImage(img,(40-w)/2,(40-h)/2,w,h);try{const url=c.toDataURL('image/png');cursorCache.set(id,url);set(url);}catch{}};
 img.src=artName?asset(artName):`data:image/svg+xml;utf8,${encodeURIComponent(knifeSvg.replace('viewBox','width="40" height="40" style="color:#8e1f14" viewBox'))}`;
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&held){held=null;refreshStamps();}});
phone.addEventListener('change',()=>{document.body.classList.remove('you-open');if(state){lastRender='';render(state);}else drawPlayers();});
function bindSetup(){
 $('setup-open').onclick=()=>openGuide();
}
function openGuide(){
  const supplied=state?.gameSetup;if(!supplied)return;
  const setup=/NewD3/.test(supplied.name)?{...supplied,name:'NewD3',decks:Object.entries(newD3Decks).map(([name,roles])=>({name,roles}))}:supplied;
  const roles=[...new Set(setup.decks.flatMap(d=>d.roles))];
  const deckText=deck=>[...new Set(deck)].map(r=>`${deck.filter(x=>x===r).length} × ${roleNames[r]}`).join(', ');
  $('setup-title').textContent='How to play';
  const stamping=roles.some(r=>['wolf','alchemist','track_reader'].includes(r));
  $('setup-content').innerHTML=`<p class="guide-sub">This game: ${setup.decks.length>1?`one of ${setup.decks.length} ${esc(setup.name)} role mixes, chosen secretly`:`${esc(setup.name)} setup`} · nine players · roles are secret.</p><h3>Roles in this game</h3><ul>${setup.decks.map(d=>`<li><strong>${esc(d.name)}</strong>: ${esc(deckText(d.roles))}</li>`).join('')}</ul><dl>${roles.map(r=>`<dt>${esc(roleNames[r])}${r==='noble'?' (Mason)':''}</dt><dd>${esc(descriptions[r])}</dd>`).join('')}</dl><h3>How to win</h3><p>Town wins when all wolves are eliminated. Wolves win at parity with town.${roles.includes('jester')?' The Trickster wins if eliminated by the town vote.':''} After ${setup.maxDays} completed nights without a winner, the game is a draw.</p><h3>Voting &amp; chat</h3><p>Votes and night abilities are <strong>stamps</strong>: pick one up, then click a player. You can move or remove a stamp until the timer ends; whatever is placed then counts, and no stamp means pass. A strict majority of living players eliminates someone; otherwise nobody is eliminated. Votes stay sealed until the vote closes.${stamping?' Wolves see each other’s night stamps. The pack casts two votes: every Wolf’s <strong>kill target</strong> stamp counts once, and every Wolf’s <strong>knife</strong> stamp chooses who performs the kill. Each is decided by the most votes, with ties broken at random, and your knife starts on you.':''}</p><p>Town chat is open during the day. Wolves and Nobles have private channels during discussion and night coordination. Eliminated players cannot act or chat.</p><h3>Timing</h3><p>Discussion ${setup.timers.dayMs/1000}s · Vote ${setup.timers.voteMs/1000}s · Night coordination ${setup.timers.coordinationMs/1000}s · Night actions ${setup.timers.nightMs/1000}s · Transitions ${setup.timers.transitionMs/1000}s. Phases never end early.</p><p>During discussion the host picks a speaker every 13 seconds and prioritizes human messages. The clock keeps running while this guide is open.</p>`;
  $('setup-guide').showModal();
}
$('setup-close').onclick=()=>$('setup-guide').close();
function drawRole(){
 const self=state.self;if(!self)return;
 $('role').innerHTML=`<img src="${asset(art[self.role])}" alt="${esc(roleNames[self.role])}"><div><span class="eyebrow">YOUR SECRET ROLE · ${esc(self.faction)}</span><h2>${esc(roleNames[self.role])}</h2><p>${esc(descriptions[self.role])}</p></div>`;
 const team=state.teammates.filter(t=>t.slot!==self.slot);
 const teamLabel=self.faction==='wolf'?'Your pack':self.role==='noble'?'Fellow Nobles (Masons)':null;
 if(teamLabel)$('role').querySelector('div').insertAdjacentHTML('beforeend',`<p class="teammates">${teamLabel}: ${team.map(t=>`${esc(name(t.slot))} · ${esc(roleNames[t.role])}${state.roster.find(p=>p.slot===t.slot)?.alive?'':' (eliminated)'}`).join('; ')}</p>`);
 $('role').querySelector('div').insertAdjacentHTML('beforeend',`<button id="setup-open" ${state.gameSetup?'':'disabled'}>How to play</button>`);
 bindSetup();
 const notes=state.events.flatMap(e=>{const p=e.payload;
  if(p.kind==='private_result'){const r=p.result,result=Array.isArray(r.result)?(r.result.length?r.result.map(name).join(', '):'no visits'):r.result==='no_result'?'No result (your action was blocked)':r.result==='not_wolf'?'Not a wolf':roleNames[r.result]??r.result;return [`Night ${r.day} · ${name(r.target)}: ${result}`];}
  if(p.kind==='ballots')return [`Day ${e.day} vote · ${p.eliminated===null?'No elimination':`${name(p.eliminated)} eliminated${deathReveal(state.events,p.eliminated)?` (${deathReveal(state.events,p.eliminated)})`:''}`}. ${p.ballots.map(v=>`${name(v.slot)} → ${v.target===null?'Pass':name(v.target)}`).join('; ')}`];
  if(p.kind==='night_resolved')return [`Night ${e.day} · ${p.eliminated.length?p.eliminated.map(slot=>`${name(slot)}${deathReveal(state.events,slot)?` (${deathReveal(state.events,slot)})`:''}`).join(', ')+' died.':'Everyone survived.'}`];return [];
 });
 $('journal').innerHTML=notes.length?notes.map(n=>`<p>${esc(n)}</p>`).join(''):'<p>Your private discoveries and voting history will appear here.</p>';
}
const chatIcon=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const channelInfo={
 town:{name:'Town',title:'Village voices',note:'Public · everyone can read this',icon:chatIcon('<path d="M4 5h16v11H10l-5 4v-4H4z"/>')},
 wolves:{name:'Wolves',title:'Wolves’ den',note:'Private · only living Wolves can read this',icon:chatIcon('<circle cx="7" cy="9" r="1.8"/><circle cx="12" cy="6.5" r="1.8"/><circle cx="17" cy="9" r="1.8"/><path d="M12 12c-3 0-5.5 3-5.5 5.2 0 1.5 1.3 2.3 2.8 2L12 18.5l2.7.7c1.5.3 2.8-.5 2.8-2C17.5 15 15 12 12 12z"/>')},
 nobles:{name:'Nobles',title:'Noble chat',note:'Private · only Nobles can read this',icon:chatIcon('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>')},
};
const lockIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
// Read position per channel (last seen message id), kept for this browser tab so a reload keeps badges honest.
const seenKey=`wcw-seen:${storageKey}`;
let lastSeen={},divider={channel:null,id:null};
try{lastSeen=JSON.parse(sessionStorage.getItem(seenKey)??'{}')??{};}catch{}
function drawChat(){
 if(!state.channels.includes(channel))channel='town';
 const selfSlot=state.self?.slot??-1,selfName=state.self?name(selfSlot):'',info=channelInfo[channel];
 const active=unread(state.events,channel,lastSeen[channel],selfSlot,selfName);
 if(divider.channel!==channel)divider={channel,id:active.firstId};
 const kind=channel==='town'?'speech':channel==='wolves'?'wolf_chat':'noble_chat';
 const latest=state.events.filter(e=>e.payload.kind===kind).at(-1);
 if(latest&&lastSeen[channel]!==latest.id){lastSeen[channel]=latest.id;try{sessionStorage.setItem(seenKey,JSON.stringify(lastSeen));}catch{}}
 $('channels').innerHTML=state.channels.map(c=>{
  const u=c===channel?{count:0}:unread(state.events,c,lastSeen[c],selfSlot,selfName),i=channelInfo[c];
  const badge=u.count?`<span class="badge${u.mention?' mention':''}">${u.mention?'@':''}${u.count>9?'9+':u.count}</span>`:'';
  return `<button class="chan chan-${c}${c===channel?' active':''}" role="tab" data-channel="${c}" aria-selected="${c===channel}" aria-label="${i.name}${u.count?`, ${u.count} unread${u.mention?', mentions you':''}`:''}">${i.icon}<span>${i.name}</span>${badge}</button>`;
 }).join('');
 $('channels').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.channel===channel)return;drafts[channel]=$('message').value;channel=b.dataset.channel;$('message').value=drafts[channel]??'';drawChat();$('messages').scrollTop=$('messages').scrollHeight;});
 $('chat-panel').className=`chat-panel chan-${channel}${channel==='town'?'':' private'}`;
 $('chat-title').textContent=info.title;
 $('privacy').innerHTML=`${channel==='town'?'':lockIcon}${esc(info.note)}`;
 const names=Object.fromEntries(Object.entries(channelInfo).map(([k,v])=>[k,v.name]));
 const items=state.events.flatMap(e=>e.payload.kind===kind?[e]:systemLines(e,state.roster,state.events).filter(l=>channel==='town'||l.scope==='all').map(l=>({line:l.text})));
 const el=$('messages'),atBottom=el.scrollTop+el.clientHeight>=el.scrollHeight-60;
 el.innerHTML=items.length?items.map(e=>{if(e.line)return `<p class="system-line">${esc(e.line)}</p>`;const mark=e.id&&e.id===divider.id?'<p class="new-divider"><span>New</span></p>':'';const p=e.payload,b=p.kind==='speech'?p.speech:p;return `${mark}<article class="message ${b.slot===state.self?.slot?'mine':''}"><small>Day ${e.day}</small><strong><b class="seat-no seat-c${b.slot}">${b.slot+1}</b>${esc(name(b.slot))}${b.slot===state.self?.slot?' · you':''}</strong><p>${esc(b.text)}</p></article>`;}).join(''):'<p class="empty">No messages in this channel yet.</p>';
 if(atBottom)el.scrollTop=el.scrollHeight;
 const allowed=state.chatEnabled&&(channel!=='town'||state.period==='discussion');
 $('message').disabled=!allowed||ws?.readyState!==WebSocket.OPEN;$('send').disabled=$('message').disabled||!!pendingChat;
 $('send').textContent=channel==='town'?'Send':`Send to ${names[channel]}`;
 $('message').placeholder=allowed?`Message ${names[channel]}…`:state.phase==='waiting'?'Chat opens when the game starts.':'Chat is closed for this phase.';
 $('chat-hint').textContent=allowed?'480 characters · Enter to send':state.phase==='waiting'?'Your role stays private.':state.self?.alive?'Chat reopens during discussion.':'You can watch the conversation.';
}
function deathMark(cause){return cause?`<img class="death-mark ${cause==='wolf'?'claw':'meat'}" src="${asset(cause==='wolf'?'dead_icon_claw':'dead_icon_meat')}" alt="${cause==='wolf'?'Killed by wolves':'Eliminated by town'}">`:'';}
let resultDismissed=false,lastInterlude='';
function drawInterlude(){
 const holding=state.period==='dusk'&&performance.now()<revealUntil;
 const summary=holding?null:stageSummary(state),show=!!summary||!!state.result&&!resultDismissed;
 const panel=$('interlude');panel.hidden=!show;
 document.querySelectorAll('body>header,body>main').forEach(el=>{el.inert=show;});
 document.body.classList.toggle('show-interlude',show);
 if(!show)return;
 const key=state.result?'finished':`${state.day}:${state.period}`;
 if(key===lastInterlude)return;lastInterlude=key;
 if(summary){
  panel.className='interlude';panel.style.backgroundImage='';
  panel.innerHTML=`<div class="transition-card"><div class="transition-art"><img src="${asset('tscreen_base')}" alt=""><img src="${asset(summary.art)}" alt=""><img src="${asset('tscreen_frame')}" alt=""></div><div class="transition-copy"><h2 id="interlude-title" tabindex="-1">${esc(summary.title)}</h2><p>${esc(summary.description)}</p><small id="transition-countdown"></small></div></div>`;
 }else{
  const result=state.result,wolf=result.outcome==='wolf_win';
  const headline={wolf_win:'Darkness reigns. The last scream echoes into silence.',town_win:'The last howl fades… Peace returns to the village.',jester_win:'The Trickster has the last laugh.',draw:'Dawn comes to a village still divided.'}[result.outcome];
  const card=p=>{const role=state.revealedRoles?.find(r=>r.slot===p.slot),cause=deathCause(state.events,p.slot);
   return `<article class="end-card ${p.alive?'':'dead'}"><div class="role-face"><img src="${asset(role?.faction==='wolf'?'base_rolecard_red':'base_rolecard_blue')}" alt=""><img class="end-role-art" src="${asset(art[role?.role]??'Role_Villager_outline')}" alt=""></div>${p.alive?'':deathMark(cause)}<strong>${esc(p.name)}</strong><span>${esc(role?roleNames[role.role]:'Role unrevealed')} · ${p.alive?'Survived':cause==='wolf'?'Killed by wolves':'Eliminated by town'}</span></article>`;
  };
  const winners=state.roster.filter(p=>result.scores[p.slot]===1),others=state.roster.filter(p=>result.scores[p.slot]!==1);
  panel.className=`interlude end-screen ${wolf?'wolf-ending':'town-ending'}`;
  panel.style.backgroundImage=`url("${asset(wolf?'bg_gameover_night':'bg_gameover_day')}")`;
  panel.innerHTML=`<div class="end-content"><h2 id="interlude-title" tabindex="-1">${esc(headline)}</h2>${winners.length?`<h3>Winners</h3><div class="end-cards winners">${winners.map(card).join('')}</div>`:''}<div class="end-bottom"><section><h3>${winners.length?'The rest of the village':'The village'}</h3><div class="end-cards">${others.map(card).join('')}</div></section><div class="end-actions"><h2>The End</h2><p>${esc(connection.replayNotice)}</p><a class="primary" href="${esc(connection.replayPage)}" target="_blank" rel="noopener noreferrer">${esc(connection.replayLabel)}</a><button id="review-village">Review village</button></div></div></div>`;
  $('review-village').onclick=()=>{resultDismissed=true;lastInterlude='';drawInterlude();$('day').focus();};
 }
 $('interlude-title')?.focus({preventScroll:true});
}
function render(s){state=s;if(s.self)slot=s.self.slot;syncStamps();
ended=!!s.result;document.body.classList.toggle('lobby',s.phase==='waiting');
 remainingUntil=performance.now()+(s.phase==='waiting'?s.lobby?.startsInMs??0:s.remainingMs);
 const key=JSON.stringify([s.lobby,s.packDrafts,s.events.length,s.phase,s.period,s.observation?.requestId,s.observation?.attempt,s.accepted,s.self?.alive,s.floor?.turn]);
 if(key!==lastRender){lastRender=key;document.body.classList.toggle('night',s.phase==='night');const playing=!s.result&&s.phase!=='waiting';$('day-text').textContent=s.result?'Game over':playing?`${s.phase==='night'?'Night':'Day'} ${s.day}`:'Take your seat';$('day-icon').innerHTML=playing?(s.phase==='night'?moonIcon:sunIcon):'';$('phase').textContent=s.result?'The story ends':playing?labels[s.period]:'Nine seats. Humans and AI welcome.';drawPlayers();drawRole();drawAction();drawChat();drawInterlude();drawChip();updateSheet();}
 updateClock();
}
function inLobby(){return !state||state.phase==='waiting';}
function updateClock(){const n=Math.max(0,Math.ceil((remainingUntil-performance.now())/1000)),waiting=inLobby()&&state?.lobby?.startsInMs==null;$('timer').textContent=state&&!ended&&!waiting?`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`:'—:—';$('timer').classList.toggle('urgent',!!state&&!waiting&&n<=10&&!ended);$('timer-label').textContent=ended?'Complete':inLobby()?(waiting?(joined?'Waiting for players':'Lobby open'):'Auto-start in'):state?state.period==='discussion'?'Until voting':state.period==='coordination'?'Until actions':'Time remaining':'Not started';if(!$('sheet-pill').hidden)$('sheet-pill').textContent=`${state?.observation?.request?.kind==='vote'?'Vote':'Night actions'} · ${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;if($('transition-countdown'))$('transition-countdown').textContent=n>0?`The next phase starts in ${n}s`:'Waiting for the next phase…';}
async function connect(){if(!connection||connecting||ws?.readyState===WebSocket.OPEN)return;connecting=true;
 $('join').disabled=true;$('chat-join').disabled=true;setConnection('busy','Preparing village artwork…');
 try{await assets.preload([...Object.values(art),'vote_banner_town_hoof','vote_banner_wolfs_claw','abstain_town','guard_icon','potion_icon','seer_icon','chef_icon','milk_icon','priest_icon','track_icon','base_rolecard_blue','base_rolecard_red','bg_gameover_day','bg_gameover_night','dead_icon_claw','dead_icon_meat']);}
 catch{connecting=false;$('join').disabled=false;$('chat-join').disabled=false;setConnection('error','Could not load artwork. Click Join to retry.');return;}
 joined=true;document.body.classList.add('joined');sessionStorage.setItem(storageKey,'1');setConnection('busy','Connecting…');ws=new WebSocket(connection.socket);
 ws.onopen=()=>{connecting=false;if(dirty)setTimeout(sendDraft,300);setConnection('ok','Connected · your seat is private');if(state)drawChat();};
 ws.onmessage=e=>{let p;try{p=JSON.parse(e.data);}catch{return;}
  if(p.type==='ready'){slot=p.slot;ws.send(JSON.stringify({protocol:'wcw.human/1',type:'join'}));drawPlayers();}
  if(p.type==='snapshot')render(p);
  if(p.type==='receipt'&&draftKey)draftReceipt(p);
  else if(p.type==='receipt')feedback(['accepted','duplicate'].includes(p.status)?'Choice recorded.':p.status==='expired'?'The action window has closed.':`Choice rejected${p.retry?' — please try again':''}.`);
  if(p.type==='chat_receipt'&&p.id===pendingChat){pendingChat=null;if(['accepted','duplicate'].includes(p.status)){drafts[pendingChannel]='';if(channel===pendingChannel)$('message').value='';}else feedback(p.message??'Message was not sent.');drawChat();}
 };
 ws.onclose=()=>{connecting=false;pendingChat=null;setConnection(ended?'ok':'warn',ended?'Game complete':'Disconnected · reconnecting…');if(state)drawChat();if(joined&&!ended)setTimeout(connect,1500);};
 ws.onerror=()=>setConnection('error','Connection unavailable. Check your seat link.');
}
$('join').onclick=connect;$('chat-join').onclick=connect;
$('chat-form').onsubmit=e=>{e.preventDefault();const text=$('message').value.trim();if(!text||!state||ws?.readyState!==WebSocket.OPEN||pendingChat)return;pendingChat=`chat_${crypto.randomUUID().replaceAll('-','')}`;pendingChannel=channel;ws.send(JSON.stringify({protocol:'wcw.human/1',type:'chat',episodeId:state.episodeId,id:pendingChat,phaseKey:state.phaseKey,channel,text}));$('send').disabled=true;};
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chat-form').requestSubmit();}};
drawPlayers();setInterval(updateClock,200);
if(sessionStorage.getItem(storageKey)==='1')connect();
