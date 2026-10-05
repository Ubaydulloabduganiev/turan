'use strict';
// Screens, the top bar, keyboard shortcuts and the end-of-turn flow.

let pickSel = 'temur';

function showScreen(id) {
  for (const s of ['title', 'pick', 'game']) $(s).classList.toggle('hidden', s !== id);
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

function miniMapSVG(f) {
  MAPDATA = MAPDATA || buildMap();
  let h = `<svg id="pick-mini" viewBox="0 0 ${MAP.W} ${MAP.H}" xmlns="http://www.w3.org/2000/svg">`;
  MAPDATA.sites.forEach((s, i) => {
    let fill = s.kind === 'water' ? '#2c5a7c' : s.kind === 'province' ? '#6d6450' : '#3d372e';
    let op = 1;
    if (s.kind === 'province') {
      const owner = PROVINCE_DATA[i][5];
      if (owner !== 'rebels') { fill = FACTIONS[owner].color; op = owner === f ? 1 : 0.28; }
    }
    h += `<path d="${outlinePath(MAPDATA.outlines[i])}" fill="${fill}" fill-opacity="${op}" stroke="#14100a" stroke-width="1.2"/>`;
  });
  const cap = MAPDATA.sites.find(s => s.id === FACTIONS[f].capital);
  if (cap) h += `<circle cx="${cap.x}" cy="${cap.y}" r="14" fill="none" stroke="#fff" stroke-width="4"/>`;
  return h + '</svg>';
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
    <div>${miniMapSVG(pickSel)}</div>`;
}

$('pick-list').addEventListener('click', e => {
  const n = e.target.closest('[data-f]');
  if (n) { pickSel = n.dataset.f; renderPick(); }
});

// ---------- Starting and loading ----------

function enterGame() {
  showScreen('game');
  if (!svg.querySelector('#cam')) initMap();
  fitMap();
  UI.selArmy = null; UI.selProv = null;
  refresh();
  const cap = G.factions[G.player].capital;
  if (cap) { centerOnProv(cap, 1.25); UI.selProv = cap; refresh(); }
}

async function startNew() {
  newGame(pickSel);
  notices.length = 0; // the opening event is shown in the intro instead
  enterGame();
  const F = FACTIONS[pickSel];
  await showModal(`<h3>${dateText()}</h3><p>${F.blurb}</p><p><b>Your aim:</b> hold ${GAME.WIN_PROVINCES} provinces. ${F.play}</p>
    <p class="note">Tip: click your capital to build and recruit, click a banner to command an army, and press <b>End turn</b> when you are done.</p>`,
    [{ label: 'How to play', value: 'help' }, { label: 'To war', value: true, cls: 'big' }], { cancel: true, cls: 'parch' }).then(v => v === 'help' && openHelp());
  saveGame('auto');
}

function startLoaded() {
  enterGame();
  toast('Game loaded', `${FACTIONS[G.player].full}, ${dateText()}`, 'good');
}

// ---------- End of turn ----------

async function doEndTurn() {
  if (!G || uiLocked() || G.over) return;
  hideTip();
  $('busy').classList.remove('hidden');
  $('btn-end').disabled = true;
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
  toast(dateText(), `Treasury ${fmt(G.factions[G.player].gold)} gold`, '');
  await flushNotices();
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

$('btn-new').onclick = () => { showScreen('pick'); renderPick(); };
$('pick-back').onclick = () => showScreen('title');
$('pick-go').onclick = startNew;
$('btn-continue').onclick = () => { if (loadGame('auto')) startLoaded(); };
$('btn-load').onclick = () => openSaves('load');
$('btn-help').onclick = openHelp;
$('btn-end').onclick = doEndTurn;
$('btn-dip').onclick = () => !uiLocked() && openDiplomacy();
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
  else if (e.key === 'r' || e.key === 'R') openRealm();
  else if (e.key === 'c' || e.key === 'C') openChronicle();
});

toTitle();
