'use strict';
// Screens, the top bar, keyboard shortcuts and the end-of-turn flow.

let pickSel = 'temur';

function showScreen(id) {
  for (const s of ['title', 'pick', 'game']) $(s).classList.toggle('hidden', s !== id);
  if (id === 'game') { sceneStop(); music('map'); } else { sceneStart(); music('title'); }
}

// Runs slow work (painting the map) behind a loading screen
async function withLoading(fn) {
  if (TERRAIN_CV) return fn();
  $('loading').classList.remove('hidden');
  await Promise.race([SAT.ready, new Promise(r => setTimeout(r, 8000))]);
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
    const name = cityById(FACTIONS[f].capital);
    x.strokeText(name, cap.x, cap.y + 62); x.fillText(name, cap.x, cap.y + 62);
  }
}

function renderPick() {
  $('pick-list').innerHTML = PLAYABLE.map(f => {
    const F = FACTIONS[f];
    return `<div class="nation ${f === pickSel ? 'active' : ''}" data-f="${f}">${flagSVG(f)}<div class="n-name">${fName(f)}</div><div class="n-diff">${t(F.difficulty)}</div></div>`;
  }).join('');
  const F = FACTIONS[pickSel];
  const provs = PROVINCE_DATA.filter(d => d[5] === pickSel);
  const cap = PROVINCE_DATA.find(d => d[0] === F.capital);
  const unique = UNITS[F.unique];
  $('pick-detail').innerHTML = `<div><div class="pick-ruler">${rulerPortrait(pickSel, 'big')}<div><h3>${fFull(pickSel)}</h3><div class="sub">${t('Ruler')}: ${pn(F.leader)} · ${t('Capital')}: ${cityById(cap[0])} · ${t('Difficulty')}: ${t(F.difficulty)}</div></div></div>
    <p>${t(F.blurb)}</p><p><b>${t('How to play')}:</b> ${t(F.play)}</p>
    <p class="facts">${t('{n} provinces', { n: '<b>' + provs.length + '</b>' })} · ${t('{n}k people', { n: '<b>' + provs.reduce((n, d) => n + d[6], 0) + '</b>' })} · ${t(F.nomad ? 'Steppe nation: horsemen need no stables and cost less to keep' : 'Settled nation: strong cities and infantry')} · ${t('Special unit')}: <b>${uName(F.unique)}</b> — ${t(unique.desc)}</p></div>
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
  turnBanner(`${pn(G.factions[G.player].leader)}, ${fTitle(G.player)}`);
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
  await new Promise(r => setTimeout(r, 1200));
  await playScene({ kind: 'coronation', start: true });
  const F = FACTIONS[pickSel];
  await showModal(`<h3>${dateText()}</h3><div class="with-portrait">${rulerPortrait(pickSel)}<div><p>${t(F.blurb)}</p><p><b>${t('Your aim:')}</b> ${t('outlast every other nation. Conquer them, or make them kneel and hand you their crowns.')} ${t(F.play)}</p></div></div>
    <p class="note">${t('Click any city to rule it, attack it or talk to its ruler. Your vizier in the corner will suggest what to do. Press End turn when you are done.')}</p>`,
    [{ label: t('How to play'), value: 'help' }, { label: t('To war'), value: true, cls: 'big' }], { cancel: true, cls: 'parch' }).then(v => v === 'help' && openHelp());
  if (!tutorialSeen()) startTutorial();
  saveGame('auto');
}

async function startLoaded() {
  await withLoading(enterGame);
  toast(t('Game loaded'), `${fFull(G.player)}, ${dateText()}`, 'good');
}

// ---------- End of turn ----------

async function doEndTurn() {
  if (!G || uiLocked() || G.over) return;
  hideTip();
  $('busy').classList.remove('hidden');
  $('btn-end').disabled = true;
  LIFE.skip = false;
  try {
    await endTurn(f => { $('busy-text').textContent = f === 'rebels' ? t('Independent lords stir…') : t('The {nation} is moving…', { nation: fFull(f) }); renderMap(); });
  } catch (err) {
    console.error(err);
    toast(t('Something went wrong'), String(err), 'bad');
  }
  $('busy').classList.add('hidden');
  $('btn-end').disabled = false;
  if (!G) return;
  saveGame('auto');
  refresh();
  const st = G.factions[G.player];
  turnBanner(t('Treasury {gold} gold · {n} nations remain', { gold: fmt(st.gold), n: nationsLeft().length }));
  await flushNotices();
  checkMission();
  await flushNotices();
  const s = pickCrisis() || pickStory();
  if (s) await showStory(s);
  else {
    const lm = pickLandmark();
    if (lm) { centerOnProv(LANDMARKS[lm.id].prov); await playScene({ kind: 'place', ...lm }); await flushNotices(); }
  }
  refresh();
  checkOverUI();
}

// ---------- Hints ----------

function updateHint() {
  if (!G) return;
  const a = UI.selArmy && G.armies[UI.selArmy];
  $('hint').textContent = a && a.owner === G.player ? t(a.moves ? 'Click a highlighted province to march · right-click also works' : 'This army cannot move again this turn') : '';
}

// ---------- Input ----------

$('btn-new').onclick = () => withLoading(() => { showScreen('pick'); renderPick(); });
$('pick-back').onclick = () => showScreen('title');
$('pick-go').onclick = startNew;
$('btn-continue').onclick = () => { if (loadGame('auto')) startLoaded(); };
$('btn-load').onclick = () => openSaves('load');
$('btn-help').onclick = openHelp;
$('btn-credits').onclick = openCredits;
$('btn-end').onclick = doEndTurn;
$('busy').onclick = () => { LIFE.skip = true; };
$('btn-dip').onclick = () => !uiLocked() && openDiplomacy();
$('btn-court').onclick = () => !uiLocked() && openCourt();
$('btn-realm').onclick = () => !uiLocked() && openRealm();
$('btn-chron').onclick = () => !uiLocked() && openChronicle();
$('btn-menu').onclick = () => !uiLocked() && openMenu();
$('btn-code').onclick = () => !uiLocked() && openSecretCode();

// A secret word for the treasury: "Temurthegreat" brings 100,000 gold
async function openSecretCode() {
  const v = await showModal(`<h3>${t('Secret code')}</h3><input id="code-in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" class="code-in">`,
    [{ label: t('Cancel'), value: null }, { label: t('Enter'), value: 'ok', cls: 'big' }], {
      cancel: null,
      onOpen: m => { const i = m.querySelector('#code-in'); i.focus(); i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') closeModal('ok'); }; },
    });
  if (v !== 'ok') return;
  const word = ($('code-in') ? $('code-in').value : '').replace(/\s+/g, '').toLowerCase();
  if (word === 'temurthegreat') {
    G.factions[G.player].gold += 100000;
    sfx('coins');
    toast(t('The treasury overflows'), t('100,000 gold has been added to your treasury.'), 'good');
    refresh();
  } else toast(t('Secret code'), t('Nothing happens.'), 'bad');
}

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

// ---------- Language ----------

// Re-renders every text on screen in the chosen language
function applyLang() {
  document.documentElement.lang = LANG;
  document.title = t('Turan: Khanates of the Silk Road');
  for (const el of document.querySelectorAll('[data-i18n]')) {
    if (!el.dataset.i18n) el.dataset.i18n = el.innerHTML.trim();
    el.innerHTML = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll('[title]')) {
    if (!el.dataset.i18nTitle) el.dataset.i18nTitle = el.title;
    el.title = t(el.dataset.i18nTitle);
  }
  $('title-langs').innerHTML = langPicker();
  if (!$('pick').classList.contains('hidden')) renderPick();
  for (const el of document.querySelectorAll('.geo-label')) if (el.dataset.geo) el.textContent = geoName(el.dataset.geo);
  if (G && svg.querySelector('#cam')) { renderMap(); refresh(); }
}
$('title-langs').addEventListener('click', e => {
  const l = e.target.closest('[data-lang]');
  if (l) { setLang(l.dataset.lang); applyLang(); }
});

applyLang();
toTitle();

// Installable web app: keep every file for offline play (only when served over http/https)
// Offline cache. When a new version of the game arrives, the title screen reloads at once;
// during a campaign a bar offers the reload so no progress is lost unasked.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadSW) return;
    if ($('game').classList.contains('hidden')) { location.reload(); return; }
    if ($('update-bar')) return;
    const bar = document.createElement('button');
    bar.id = 'update-bar'; bar.className = 'big';
    bar.textContent = t('A new version of the game is ready. Save, then tap here to reload.');
    bar.onclick = () => location.reload();
    document.body.appendChild(bar);
  });
}
