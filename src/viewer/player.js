import {createAssetCache} from './asset-cache.js';
import { playerConnection } from './connection.js';
import { knownRole } from './known-role.js';
import { deathCause,deathReveal,stageSummary } from './stage-summary.js';
import { voteMarks } from './vote-marks.js';
import { roleNames,newD3Decks } from '../shared/roles.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assets=createAssetCache(),asset=assets.url;
const art={wolf:'Role_Wolf_outline',alchemist:'Role_Alchemist_outline',track_reader:'Role_Track_reader_outline',seer:'Role_Seer_outline',guard:'Role_Guard_outline',chef:'Role_Chef_outline',dairy_maid:'Role_Dairymaid_outline',priest:'Role_Priest_outline',noble:'Role_Noble_01_outline',sheep:'Role_Villager_outline',jester:'Role_Villager_outline'};
const descriptions={wolf:'Hide among the sheep. Coordinate with your pack and choose a killer each night.',alchemist:'A wolf with a potion: block one player and nominate your pack’s kill each night.',track_reader:'A wolf who learns roles. Sheep and ordinary Wolves both appear as vanilla.',seer:'Each night, inspect one player to learn whether they are a wolf.',guard:'Protect one other player from the wolves each night.',chef:'Jail one player each night: block their action and protect them from the kill.',dairy_maid:'Visit someone at night. They learn that you are town.',priest:'Track one player each night to see whom they actually visited.',noble:'You know your fellow Nobles are town. Coordinate in your private channel.',sheep:'Your voice and your vote are your powers. Find the wolves before they outnumber you.',jester:'Convince the village to vote you out. Dying at night does not count.'};
const labels={discussion:'Discuss & deduce',vote:'Cast your vote',coordination:'Night whispers',actions:'Make your move',dusk:'The Night Begins…',dawn:'The Day Begins…'};
let state=null,ws,channel='town',lastRender='',actionKey='',remainingUntil=0,joined=false,connecting=false,ended=false,pendingChat=null;
const params=new URLSearchParams(location.search);
let slot=params.get('slot'),connection;
try{connection=playerConnection(location.href);}catch{$('connection').textContent='Invalid seat link. Open your game invitation again.';$('join').disabled=true;}
const storageKey=`wcw-joined:${connection?.socket??location.href}`;
function name(slot){return state?.roster[slot]?.name??`Seat ${slot+1}`;}
function feedback(t){$('feedback').textContent=t;}
function drawPlayers(){
 const roster=state?.roster??Array.from({length:9},(_,i)=>({slot:i,name:slot!==null&&i===Number(slot)?'You':`Player ${i+1}`,alive:true}));
 const request=state?.observation?.request,eligible=request?.kind==='vote'&&!state?.accepted?request.targets:[];
 $('players').innerHTML=roster.map(p=>{
  const known=knownRole(state,p.slot),you=state?.self?.slot===p.slot;
  const cause=deathCause(state?.events??[],p.slot);
  const seat=state?.lobby?.seats[p.slot];
  const status=seat?(you||p.slot===state.self?.slot||p.slot===Number(slot)&&seat==='human'?'You':{human:'Joined',ai:'AI ready',open:'Open seat'}[seat]):!state&&!joined?'':!p.alive?(cause==='wolf'?'Killed by wolves':cause==='vote'?'Eliminated by town':'Eliminated'):you?`${roleNames[state.self.role]} · You`:known?roleNames[known]:'Role unknown';
  const tag=!p.alive&&deathReveal(state?.events??[],p.slot)?`${deathReveal(state.events,p.slot)} · ${status}`:status;
  const votes=voteMarks(state,p.slot);
  const positions=[[34,32,-24],[53,43,23],[29,52,-8],[51,23,38],[43,60,-32],[20,34,12],[62,56,18],[22,63,-20],[63,27,30]];
  const stamps=positions.slice(0,p.alive?votes.count:0).map(([x,y,angle])=>`<img class="vote-stamp" src="${asset('vote_banner_town_hoof')}" alt="" style="--x:${x}%;--y:${y}%;--angle:${angle}deg">`).join('');
  const badge=votes.count?`<span class="vote-badge${votes.own?' own-vote':''}" title="${votes.own?'Your locked vote':`${votes.count} votes; majority ${votes.majority}`}"><span>${votes.own?'Yours':`${votes.count}/${votes.majority}`}</span></span>`:'';
  return `<button class="player ${p.alive?'':'dead'} ${seat==='open'?'open-seat':''} ${eligible.includes(p.slot)?'eligible':''}" data-slot="${p.slot}" title="${esc(p.policyName?`Policy: ${p.policyName}`:p.name)}" ${eligible.includes(p.slot)?'':'disabled'} aria-label="${esc(p.name)}, ${esc(tag)}${votes.count?`, ${votes.own?'your locked vote':`${votes.count} votes, majority ${votes.majority}`}`:''}${eligible.includes(p.slot)?', select for vote':''}"><img src="${asset('base_playercard_shadow')}" alt=""><img class="${known?'known-role':'sheep'}" src="${asset(known?art[known]:'Player_sheep_base')}" alt="">${stamps}${eligible.includes(p.slot)?`<img class="vote-preview" src="${asset('vote_banner_town_hoof')}" alt="">`:""}${!p.alive?deathMark(cause):''}${badge}<span class="card-foot"><span class="name">${esc(p.name)}</span>${tag?`<small>${esc(tag)}</small>`:''}</span></button>`;
 }).join('');
 $('players').querySelectorAll('.eligible').forEach(b=>b.onclick=()=>{const select=$('vote-target');if(select){select.value=b.dataset.slot;highlight();}});
 const filled=state?.lobby?.seats.filter(s=>s!=='open').length;
 $('alive').textContent=inLobby()?(filled===undefined?'9 seats':`${filled} of 9 seats filled`):`${roster.filter(p=>p.alive).length} alive · Majority ${Math.floor(roster.filter(p=>p.alive).length/2)+1}`;
}
function highlight(){document.querySelectorAll('.player').forEach(b=>b.classList.toggle('selected',b.dataset.slot===$('vote-target')?.value));}
function options(targets,pass=true){return (pass?'<option value="">Pass</option>':'')+targets.map(s=>`<option value="${s}">${esc(name(s))}</option>`).join('');}
function drawAction(){
 const o=state.observation,key=`${JSON.stringify(state.lobby)}:${state.phase}:${state.period}:${o?.requestId}:${JSON.stringify(state.accepted)}:${state.self?.alive}:${state.result?.outcome}:${state.floor?.turn}`;
 if(key===actionKey)return;actionKey=key;feedback('');
 if(state.result){$('action').innerHTML=`<span class="eyebrow">THE STORY ENDS</span><h2 class="result">${esc({town_win:'The village prevails',wolf_win:'The wolves prevail',jester_win:'The Trickster wins',draw:'A village divided'}[state.result.outcome])}</h2><p>${state.result.scores[Number(slot)]?'You won.':'The game is complete.'} ${esc(connection.replayNotice)}</p><a href="${esc(connection.replayPage)}" target="_blank" rel="noopener noreferrer">${esc(connection.replayLabel)}</a>`;return;}
 if(!state.self){const seats=state.lobby?.seats??[],humans=seats.filter(s=>s==='human').length,filled=seats.filter(s=>s!=='open').length;
  $('action').innerHTML=`<h2>You have a seat</h2><p>${filled} of 9 seats filled · ${humans} ${humans===1?'human':'humans'} joined.</p><p class="hint">Play starts when every seat is filled${state.lobby?.startsInMs!=null?', or when the countdown ends':''}. Your secret role is dealt when the game begins.</p>`;return;}
 if(!state.self.alive){$('action').innerHTML='<h2>Your story lives on</h2><p>You have been eliminated. Follow the public conversation while the village plays on.</p>';return;}
 if(state.accepted){$('action').innerHTML=`<h2>Choice locked in</h2><p>${esc(state.accepted.kind==='vote'?`Your vote: ${state.accepted.target===null?'Pass':name(state.accepted.target)}.`:'Your night actions are recorded.')} The phase ends when the timer reaches zero.</p>`;return;}
 const r=o?.request;
 if(r?.kind==='vote'){
  $('action').innerHTML=`<h2>Who do you suspect?</h2><p>A strict majority is needed to eliminate someone. Select a card or choose below.</p><form id="decision" class="choices"><label>Vote for<select id="vote-target">${options(r.targets)}</select></label><button class="primary">Lock in vote</button></form>`;
  $('vote-target').onchange=highlight;
 }else if(r?.kind==='night'){
  $('action').innerHTML=`<h2>${r.choices.length?'Choose your night actions':'Rest until morning'}</h2><p>${r.choices.length?'Choose every action before locking in. Pass leaves that ability unused.':'You have no night ability. The village wakes when the timer runs out.'}</p><form id="decision" class="choices">${r.choices.map((c,i)=>`<label>${esc(c.ability)}<select id="choice-${i}">${options(c.targets)}</select></label>${c.ability==='kill'?`<label>Wolf performing the kill<select id="killer-${i}">${options(c.actors??[state.self.slot],false)}</select></label>`:''}`).join('')}<button class="primary">${r.choices.length?'Lock in actions':'Ready for morning'}</button></form>`;
 }else{$('action').innerHTML=`<h2>${state.period==='coordination'?'The village sleeps':'The floor is open'}</h2><p>${state.period==='coordination'?'Wolves and Nobles can coordinate privately. Night actions follow in a moment.':state.floor?`The host called on ${esc(name(state.floor.slot))}${state.floor.replyingToHuman?' to respond to you':''}.${state.floor.prompt?` ${esc(state.floor.prompt)}`:''} One bot speaks each 13-second turn. You can chat at any time.`:'Share your suspicions in Town chat.'}</p>`;return;}
 $('decision').onsubmit=e=>{e.preventDefault();if(ws?.readyState!==WebSocket.OPEN)return feedback('Reconnect before submitting.');const value=id=>$(id).value===''?null:Number($(id).value);
  const body=r.kind==='vote'?{kind:'vote',target:value('vote-target'),summary:''}:{kind:'night',actions:r.choices.map((c,i)=>({ability:c.ability,target:value(`choice-${i}`),...(c.ability==='kill'?{killer:value(`killer-${i}`)}:{})})),summary:''};
  ws.send(JSON.stringify({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body,report:null}));feedback('Sending your choice…');
 };
}
function bindSetup(){
 $('setup-open').onclick=()=>{
  const supplied=state.gameSetup;if(!supplied)return;
  const setup=/NewD3/.test(supplied.name)?{...supplied,name:'NewD3',decks:Object.entries(newD3Decks).map(([name,roles])=>({name,roles}))}:supplied;
  const roles=[...new Set(setup.decks.flatMap(d=>d.roles))];
  const deckText=deck=>[...new Set(deck)].map(r=>`${deck.filter(x=>x===r).length} × ${roleNames[r]}`).join(', ');
  $('setup-title').textContent=setup.name;
  $('setup-content').innerHTML=`<p>Nine players. Role assignments are secret. ${setup.decks.length>1?'One of the following setups is selected secretly.':'This is the role composition for this game.'}</p><ul>${setup.decks.map(d=>`<li><strong>${esc(d.name)}</strong>: ${esc(deckText(d.roles))}</li>`).join('')}</ul><h3>Roles</h3><dl>${roles.map(r=>`<dt>${esc(roleNames[r])}${r==='noble'?' (Mason)':''}</dt><dd>${esc(descriptions[r])}</dd>`).join('')}</dl><h3>How to win</h3><p>Town wins when all wolves are eliminated. Wolves win at parity with town.${roles.includes('jester')?' The Trickster wins if eliminated by the town vote.':''} After ${setup.maxDays} completed nights without a winner, the game is a draw.</p><h3>Voting and chat</h3><p>A strict majority of living players is required to eliminate someone. Otherwise nobody is eliminated. Votes are sealed until the window closes; locked votes cannot be changed. Town chat is open during the day. Wolves and Nobles have separate private channels during discussion and night coordination. Eliminated players cannot act or chat.</p><h3>Phase timers</h3><p>Discussion ${setup.timers.dayMs/1000}s · Vote ${setup.timers.voteMs/1000}s · Night coordination ${setup.timers.coordinationMs/1000}s · Night actions ${setup.timers.nightMs/1000}s · Transitions ${setup.timers.transitionMs/1000}s.</p><p>During normal discussion the host selects a speaker every 13 seconds and prioritizes human messages. The phase clock keeps running while this guide is open.</p>`;
  $('setup-guide').showModal();
 };
}
$('setup-close').onclick=()=>$('setup-guide').close();
function drawRole(){
 const self=state.self;if(!self)return;
 $('role').innerHTML=`<img src="${asset(art[self.role])}" alt="${esc(roleNames[self.role])}"><div><span class="eyebrow">YOUR SECRET ROLE · ${esc(self.faction)}</span><h2>${esc(roleNames[self.role])}</h2><p>${esc(descriptions[self.role])}</p></div>`;
 const team=state.teammates.filter(t=>t.slot!==self.slot);
 const teamLabel=self.faction==='wolf'?'Your pack':self.role==='noble'?'Fellow Nobles (Masons)':null;
 if(teamLabel)$('role').querySelector('div').insertAdjacentHTML('beforeend',`<p class="teammates">${teamLabel}: ${team.map(t=>`${esc(name(t.slot))} · ${esc(roleNames[t.role])}${state.roster.find(p=>p.slot===t.slot)?.alive?'':' (eliminated)'}`).join('; ')}</p>`);
 $('role').querySelector('div').insertAdjacentHTML('beforeend',`<button id="setup-open" ${state.gameSetup?'':'disabled'}>Game setup</button>`);
 bindSetup();
 const notes=state.events.flatMap(e=>{const p=e.payload;
  if(p.kind==='private_result'){const r=p.result,result=Array.isArray(r.result)?(r.result.length?r.result.map(name).join(', '):'no visits'):r.result==='no_result'?'No result (your action was blocked)':r.result==='not_wolf'?'Not a wolf':roleNames[r.result]??r.result;return [`Night ${r.day} · ${name(r.target)}: ${result}`];}
  if(p.kind==='ballots')return [`Day ${e.day} vote · ${p.eliminated===null?'No elimination':`${name(p.eliminated)} eliminated${deathReveal(state.events,p.eliminated)?` (${deathReveal(state.events,p.eliminated)})`:''}`}. ${p.ballots.map(v=>`${name(v.slot)} → ${v.target===null?'Pass':name(v.target)}`).join('; ')}`];
  if(p.kind==='night_resolved')return [`Night ${e.day} · ${p.eliminated.length?p.eliminated.map(slot=>`${name(slot)}${deathReveal(state.events,slot)?` (${deathReveal(state.events,slot)})`:''}`).join(', ')+' died.':'Everyone survived.'}`];return [];
 });
 $('journal').innerHTML=notes.length?notes.map(n=>`<p>${esc(n)}</p>`).join(''):'<p>Your private discoveries and voting history will appear here.</p>';
}
function drawChat(){
 if(!state.channels.includes(channel))channel='town';
 const names={town:'Town',wolves:'Wolves',nobles:'Nobles'};
 $('channels').innerHTML=state.channels.map(c=>`<button class="${c===channel?'active':''}" data-channel="${c}" aria-pressed="${c===channel}">${names[c]}</button>`).join('');
 $('channels').querySelectorAll('button').forEach(b=>b.onclick=()=>{channel=b.dataset.channel;drawChat();});
 $('privacy').textContent=channel==='town'?'Public conversation':`Private · living ${names[channel]} only`;
 const messages=state.events.filter(e=>channel==='town'?e.payload.kind==='speech':e.payload.kind===(channel==='wolves'?'wolf_chat':'noble_chat'));
 const el=$('messages'),atBottom=el.scrollTop+el.clientHeight>=el.scrollHeight-60;
 el.innerHTML=messages.length?messages.map(e=>{const p=e.payload,b=p.kind==='speech'?p.speech:p;return `<article class="message ${b.slot===state.self?.slot?'mine':''}"><small>Day ${e.day}</small><strong>${esc(name(b.slot))}${b.slot===state.self?.slot?' · you':''}</strong><p>${esc(b.text)}</p></article>`;}).join(''):'<p class="empty">No messages in this channel yet.</p>';
 if(atBottom)el.scrollTop=el.scrollHeight;
 const allowed=state.chatEnabled&&(channel!=='town'||state.period==='discussion');
 $('message').disabled=!allowed||ws?.readyState!==WebSocket.OPEN;$('send').disabled=$('message').disabled||!!pendingChat;
 $('message').placeholder=allowed?`Message ${names[channel]}…`:state.phase==='waiting'?'Chat opens when the game starts.':'Chat is closed for this phase.';
 $('chat-hint').textContent=allowed?'480 characters · Enter to send':state.phase==='waiting'?'Your role stays private.':state.self?.alive?'Chat reopens during discussion.':'You can watch the conversation.';
}
function deathMark(cause){return cause?`<img class="death-mark ${cause==='wolf'?'claw':'meat'}" src="${asset(cause==='wolf'?'dead_icon_claw':'dead_icon_meat')}" alt="${cause==='wolf'?'Killed by wolves':'Eliminated by town'}">`:'';}
let resultDismissed=false,lastInterlude='';
function drawInterlude(){
 const summary=stageSummary(state),show=!!summary||!!state.result&&!resultDismissed;
 const panel=$('interlude');panel.hidden=!show;
 document.querySelectorAll('body>header,body>main,body>footer').forEach(el=>{el.inert=show;});
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
  $('review-village').onclick=()=>{resultDismissed=true;lastInterlude='';drawInterlude();$('phase').setAttribute('tabindex','-1');$('phase').focus();};
 }
 $('interlude-title')?.focus({preventScroll:true});
}
function render(s){state=s;if(s.self)slot=s.self.slot;
ended=!!s.result;document.body.classList.toggle('lobby',s.phase==='waiting');
 remainingUntil=performance.now()+(s.phase==='waiting'?s.lobby?.startsInMs??0:s.remainingMs);
 const key=JSON.stringify([s.lobby,s.events.length,s.phase,s.period,s.observation?.requestId,s.observation?.attempt,s.accepted,s.self?.alive,s.floor?.turn]);
 if(key!==lastRender){lastRender=key;document.body.classList.toggle('night',s.phase==='night');$('day').textContent=s.phase==='waiting'?'GATHERING THE VILLAGE':`DAY ${s.day} · ${s.phase==='night'?'AFTER DARK':'THE VILLAGE'}`;$('phase').textContent=s.result?'Game over':s.phase==='waiting'?'Take your seat':labels[s.period];drawPlayers();drawRole();drawAction();drawChat();drawInterlude();}
 updateClock();
}
function inLobby(){return !state||state.phase==='waiting';}
function updateClock(){const n=Math.max(0,Math.ceil((remainingUntil-performance.now())/1000)),waiting=inLobby()&&state?.lobby?.startsInMs==null;$('timer').textContent=state&&!ended&&!waiting?`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`:'—:—';$('timer').classList.toggle('urgent',!!state&&!waiting&&n<=10&&!ended);$('timer-label').textContent=ended?'Complete':inLobby()?(waiting?(joined?'Waiting for players':'Lobby open'):'Auto-start in'):state?state.period==='discussion'?'Until voting':state.period==='coordination'?'Until actions':'Time remaining':'Not started';if($('transition-countdown'))$('transition-countdown').textContent=n>0?`The next phase starts in ${n}s`:'Waiting for the next phase…';}
async function connect(){if(!connection||connecting||ws?.readyState===WebSocket.OPEN)return;connecting=true;
 $('join').disabled=true;$('chat-join').disabled=true;$('connection').textContent='Preparing village artwork…';
 try{await assets.preload([...Object.values(art),'base_rolecard_blue','base_rolecard_red','bg_gameover_day','bg_gameover_night','dead_icon_claw','dead_icon_meat']);}
 catch{connecting=false;$('join').disabled=false;$('chat-join').disabled=false;$('connection').textContent='Could not load artwork. Click Join to retry.';return;}
 joined=true;document.body.classList.add('joined');sessionStorage.setItem(storageKey,'1');$('connection').textContent='Connecting…';ws=new WebSocket(connection.socket);
 ws.onopen=()=>{connecting=false;$('connection').textContent='Connected · your seat is private';if(state)drawChat();};
 ws.onmessage=e=>{let p;try{p=JSON.parse(e.data);}catch{return;}
  if(p.type==='ready'){slot=p.slot;ws.send(JSON.stringify({protocol:'wcw.human/1',type:'join'}));drawPlayers();}
  if(p.type==='snapshot')render(p);
  if(p.type==='receipt')feedback(['accepted','duplicate'].includes(p.status)?'Choice recorded.':p.status==='expired'?'The action window has closed.':`Choice rejected${p.retry?' — please try again':''}.`);
  if(p.type==='chat_receipt'&&p.id===pendingChat){pendingChat=null;if(['accepted','duplicate'].includes(p.status))$('message').value='';else feedback(p.message??'Message was not sent.');drawChat();}
 };
 ws.onclose=()=>{connecting=false;pendingChat=null;$('connection').textContent=ended?'Game complete':'Disconnected · reconnecting…';if(state)drawChat();if(joined&&!ended)setTimeout(connect,1500);};
 ws.onerror=()=>{$('connection').textContent='Connection unavailable. Check your seat link.';};
}
$('join').onclick=connect;$('chat-join').onclick=connect;
$('chat-form').onsubmit=e=>{e.preventDefault();const text=$('message').value.trim();if(!text||!state||ws?.readyState!==WebSocket.OPEN||pendingChat)return;pendingChat=`chat_${crypto.randomUUID().replaceAll('-','')}`;ws.send(JSON.stringify({protocol:'wcw.human/1',type:'chat',episodeId:state.episodeId,id:pendingChat,phaseKey:state.phaseKey,channel,text}));$('send').disabled=true;};
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chat-form').requestSubmit();}};
drawPlayers();setInterval(updateClock,200);
if(sessionStorage.getItem(storageKey)==='1')connect();
