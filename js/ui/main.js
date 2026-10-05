'use strict';
// Screens, the top bar, keyboard shortcuts and the end-of-turn flow.

let pickSel = 'temur';

function showScreen(id) {
  for (const s of ['title', 'pick', 'game']) $(s).classList.toggle('hidden', s !== id);
  if (id === 'game') sceneStop(); else sceneStart();
}

// Runs slow work (painting the map) behind a loading screen
async function withLoading(fn) {
  if (TERRAIN_CV) return fn();
  $('loading').classList.remove('hidden');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  try { return fn(); } finally { $('loading').classList.add('hidden'); }
}

function turnBanner(sub) {
  const old = $('turn-banner');
  if (old) old.remove();
  const d = document.createElement('div');
  d.id = 'turn-banner';
  d.innerHTML = `<div class="season">${dateText().toUpperCase()}</div><div class="rule"></div><div class="sub">${sub}</div>`;
  $('game').appendChild(d);
  setTimeout(() => d.remove(), 2700);
}

function toTitle() {
  G = null;
  UI.selArmy = null; UI.selProv = null;
  showScreen('title');
  updateTitleButtons();
}

function updateTitleButtons() {
  const any = ['auto', ...SLOTS].some(s => saveMeta(s));
  $('btn-continue').disabled = !saveMeta('auto');
  $('btn-load').disabled = !any;
}

// ---------- Nation selection ----------

// The painted map with the chosen nation's lands picked out
function drawPickMap(f) {
  const c = $('pick-mini');
  if (!c) return;
  const w = 840, h = Math.round(w * MAP.H / MAP.W);
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(getTerrain(), 0, 0, w, h);
  x.scale(w / MAP.W, h / MAP.H);
  MAPDATA.sites.forEach((s, i) => {
    if (s.kind !== 'province') return;
    const owner = PROVINCE_DATA[i][5];
    if (owner === 'rebels') return;
    x.beginPath(); cellPath(x, i);
    x.fillStyle = FACTIONS[owner].color;
    x.globalAlpha = owner === f ? 0.6 : 0.16;
    x.fill();
    if (owner === f) { x.globalAlpha = 1; x.strokeStyle = '#fff1c4'; x.lineWidth = 2.5; x.stroke(); }
  });
  x.globalAlpha = 1;
  const cap = MAPDATA.sites.find(s => s.id === FACTIONS[f].capital);
  if (cap) {
    x.strokeStyle = '#fff6d6'; x.lineWidth = 4; x.beginPath(); x.arc(cap.x, cap.y, 16, 0, Math.PI * 2); x.stroke();
    x.font = '600 46px Cinzel, Georgia, serif'; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = '#1b1208'; x.fillStyle = '#ffe39a';
    const name = PROVINCE_DATA.find(d => d[0] === FACTIONS[f].capital)[2];
    x.strokeText(name, cap.x, cap.y + 62); x.fillText(name, cap.x, cap.y + 62);
  }
}

function renderPick() {
  $('pick-list').innerHTML = PLAYABLE.map(f => {
    const F = FACTIONS[f];
    return `<div class="nation ${f === pickSel ? 'active' : ''}" data-f="${f}">${flagSVG(f)}<div class="n-name">${F.name}</div><div class="n-diff">${F.difficulty}</div></div>`;
  }).join('');
  const F = FACTIONS[pickSel];
  const provs = PROVINCE_DATA.filter(d => d[5] === pickSel);
  const cap = PROVINCE_DATA.find(d => d[0] === F.capital);
  const unique = UNITS[F.unique];
  $('pick-detail').innerHTML = `<div><h3>${F.full}</h3><div class="sub">Ruler: ${F.leader} · Capital: ${cap[2]} · Difficulty: ${F.difficulty}</div>
    <p>${F.blurb}</p><p><b>How to play:</b> ${F.play}</p>
    <p class="facts"><b>${provs.length}</b> provinces · <b>${provs.reduce((n, d) => n + d[6], 0)}k</b> people · ${F.nomad ? 'Steppe nation: horsemen need no stables and cost less to keep' : 'Settled nation: strong cities and infantry'} · Special unit: <b>${unique.name}</b> — ${unique.desc}</p></div>
    <div><canvas id="pick-mini"></canvas></div>`;
  drawPickMap(pickSel);
}

$('pick-list').addEventListener('click', e => {
  const n = e.target.closest('[data-f]');
  if (n) { pickSel = n.dataset.f; renderPick(); }
});

// ---------- Starting and loading ----------

function enterGame() {
  showScreen('game');
  if (!svg.querySelector('#cam')) initMap();
  turnBanner(`${G.factions[G.player].leader}, ${FACTIONS[G.player].title}`);
  fitMap();
  UI.selArmy = null; UI.selProv = null;
  refresh();
  const cap = G.factions[G.player].capital;
  if (cap) { centerOnProv(cap, 1.25); UI.selProv = cap; refresh(); }
}

async function startNew() {
  quietNotices = true; // the opening event is told in the intro instead
  newGame(pickSel);
  quietNotices = false;
  notices.length = 0;
  await withLoading(enterGame);
  await new Promise(r => setTimeout(r, 1800));
  const F = FACTIONS[pickSel];
  await showModal(`<h3>${dateText()}</h3><p>${F.blurb}</p><p><b>Your aim:</b> outlast every other nation. Conquer them, or make them kneel and hand you their crowns. ${F.play}</p>
    <p class="note">Click any city to rule it, attack it or talk to its ruler. Your vizier in the corner will suggest what to do. Press <b>End turn</b> when you are done.</p>`,
    [{ label: 'How to play', value: 'help' }, { label: 'To war', value: true, cls: 'big' }], { cancel: true, cls: 'parch' }).then(v => v === 'help' && openHelp());
  saveGame('auto');
}

async function startLoaded() {
  await withLoading(enterGame);
  toast('Game loaded', `${FACTIONS[G.player].full}, ${dateText()}`, 'good');
}

// ---------- End of turn ----------

async function doEndTurn() {
  if (!G || uiLocked() || G.over) return;
  hideTip();
  $('busy').classList.remove('hidden');
  $('btn-end').disabled = true;
  LIFE.skip = false;
  try {
    await endTurn(f => { $('busy-text').textContent = f === 'rebels' ? 'Independent lords stir…' : `The ${FACTIONS[f].full} is moving…`; renderMap(); });
  } catch (err) {
    console.error(err);
    toast('Something went wrong', String(err), 'bad');
  }
  $('busy').classList.add('hidden');
  $('btn-end').disabled = false;
  if (!G) return;
  saveGame('auto');
  refresh();
  const st = G.factions[G.player];
  turnBanner(`Treasury ${fmt(st.gold)} gold · ${nationsLeft().length} nations remain`);
  await flushNotices();
  checkMission();
  await flushNotices();
  const s = pickStory();
  if (s) await showStory(s);
  refresh();
  checkOverUI();
}

// ---------- Hints ----------

function updateHint() {
  if (!G) return;
  const a = UI.selArmy && G.armies[UI.selArmy];
  $('hint').textContent = a && a.owner === G.player ? (a.moves ? 'Click a highlighted province to march · right-click also works' : 'This army cannot move again this turn') : '';
}

// ---------- Input ----------

$('btn-new').onclick = () => withLoading(() => { showScreen('pick'); renderPick(); });
$('pick-back').onclick = () => showScreen('title');
$('pick-go').onclick = startNew;
$('btn-continue').onclick = () => { if (loadGame('auto')) startLoaded(); };
$('btn-load').onclick = () => openSaves('load');
$('btn-help').onclick = openHelp;
$('btn-end').onclick = doEndTurn;
$('busy').onclick = () => { LIFE.skip = true; };
$('btn-dip').onclick = () => !uiLocked() && openDiplomacy();
$('btn-court').onclick = () => !uiLocked() && openCourt();
$('btn-realm').onclick = () => !uiLocked() && openRealm();
$('btn-chron').onclick = () => !uiLocked() && openChronicle();
$('btn-menu').onclick = () => !uiLocked() && openMenu();

window.addEventListener('keydown', e => {
  if (!$('battle').classList.contains('hidden')) return; // the battle screen has its own keys
  if (e.key === 'Escape') {
    if (modalOpen) { closeModal(); return; }
    if (G && (UI.selArmy || UI.selProv)) { UI.selArmy = null; UI.selProv = null; refresh(); return; }
    if (G) openMenu();
    return;
  }
  if (!G || uiLocked() || $('game').classList.contains('hidden')) return;
  if (e.key === 'Enter') doEndTurn();
  else if (e.key === 'd' || e.key === 'D') openDiplomacy();
  else if (e.key === 'k' || e.key === 'K') openCourt();
  else if (e.key === 'r' || e.key === 'R') openRealm();
  else if (e.key === 'c' || e.key === 'C') openChronicle();
});

toTitle();
