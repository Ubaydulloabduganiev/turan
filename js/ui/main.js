'use strict';
// Screens, the top bar, keyboard shortcuts and the end-of-turn flow.

let pickSel = 'temur';

function showScreen(id) {
  for (const s of ['title', 'pick', 'camps', 'game']) $(s).classList.toggle('hidden', s !== id);
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
  $('btn-continue').disabled = !saveMeta('auto');
  $('btn-load').disabled = false; // a save file can always be opened
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
    const on = pickMulti ? pickMulti.has(f) : f === pickSel;
    return `<div class="nation ${on ? 'active' : ''}" data-f="${f}">${pickMulti && on ? '<span class="n-check">✓</span>' : ''}${flagSVG(f)}<div class="n-name">${fName(f)}</div><div class="n-diff">${t(F.difficulty)}</div></div>`;
  }).join('');
  const F = FACTIONS[pickSel];
  const provs = PROVINCE_DATA.filter(d => d[5] === pickSel);
  const cap = PROVINCE_DATA.find(d => d[0] === F.capital);
  const unique = UNITS[F.unique];
  syncPickGo();
  $('pick-detail').innerHTML = `<div>${hotseatNote()}<div class="pick-ruler">${rulerPortrait(pickSel, 'big')}<div><h3>${fFull(pickSel)}</h3><div class="sub">${t('Ruler')}: ${pn(F.leader)} · ${t('Capital')}: ${cityById(cap[0])} · ${t('Difficulty')}: ${t(F.difficulty)}</div></div></div>
    <p>${t(F.blurb)}</p><p><b>${t('How to play')}:</b> ${t(F.play)}</p>
    <p class="facts">${t('{n} provinces', { n: '<b>' + provs.length + '</b>' })} · ${t('{n}k people', { n: '<b>' + provs.reduce((n, d) => n + d[6], 0) + '</b>' })} · ${t(F.nomad ? 'Steppe nation: horsemen need no stables and cost less to keep' : 'Settled nation: strong cities and infantry')} · ${t('Special unit')}: <b>${uName(F.unique)}</b> — ${t(unique.desc)}</p></div>
    <div><canvas id="pick-mini"></canvas></div>`;
  drawPickMap(pickSel);
}

$('pick-list').addEventListener('click', e => {
  const n = e.target.closest('[data-f]');
  if (!n) return;
  pickSel = n.dataset.f;
  if (pickMulti) { if (pickMulti.has(pickSel)) pickMulti.delete(pickSel); else pickMulti.add(pickSel); }
  renderPick();
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
  startDeeds(pickSel);
  G.calm = G.turn + 4; // no stories or visitors in the first turns: there is enough to learn
  notices.length = 0;
  await withLoading(enterGame);
  await new Promise(r => setTimeout(r, 1200));
  // One window instead of two: the coronation carries the nation's advice, then the first deed shows the way
  await playScene({ kind: 'coronation', start: true });
  if (!tutorialSeen()) startTutorial();
  refresh();
  const d = currentDeed(G.player);
  if (d) toast(t('Your first deed'), d.deed.text(d.ctx), 'good');
  saveGame('auto');
}

async function startLoaded() {
  HOT.holder = null; HOT.pending = {}; HOT.waiting = null;
  await withLoading(enterGame);
  if (G.humans) { const f = G.player; G.player = null; await handOver(f); }
  toast(t('Game loaded'), `${fFull(G.player)}, ${dateText()}`, 'good');
}

// ---------- End of turn ----------

async function doEndTurn() {
  // Hot seat: a person's part of the round is over; the computer's rulers move on
  if (G && HOT.waiting) { if (uiLocked()) return; hideTip(); HOT.waiting(); return; }
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
  // Hot seat: the first ruler of the next round takes the device
  if (G.humans && !G.over && humansAlive().length) await handOver(humansAlive()[0]);
  saveGame('auto');
  await turnStartUI(true);
}

// What a ruler sees at the start of their turn: news, the council, a choice to make
async function turnStartUI(newRound) {
  if (!G) return;
  refresh();
  const st = G.factions[G.player];
  turnBanner(t('Treasury {gold} gold · {n} nations remain', { gold: fmt(st.gold), n: nationsLeft().length }));
  await flushNotices();
  checkMission();
  await flushNotices();
  const calm = G.turn < (G.calm || 0);
  const s = pickWhatIf() || pickCrisis() || (calm ? null : pickIntrigue() || pickSage() || pickStory());
  if (s) await showStory(s);
  else if (!calm) {
    const lm = pickLandmark();
    if (lm) { centerOnProv(LANDMARKS[lm.id].prov); await playScene({ kind: 'place', ...lm }); await flushNotices(); }
  }
  refresh();
  if (newRound) achTurn(); else checkAchievements();
  await checkGoldenAgeUI();
  await checkScenarioUI();
  checkOverUI();
}

// ---------- Hints ----------

function updateHint() {
  if (!G) return;
  const a = UI.selArmy && G.armies[UI.selArmy];
  $('hint').textContent = a && a.owner === G.player ? t(a.moves ? 'Click a highlighted province to march · right-click also works' : 'This army cannot move again this turn') : '';
}

// ---------- Input ----------

$('btn-new').onclick = () => { showScreen('camps'); renderCampaigns(); };
$('pick-back').onclick = () => { showScreen('camps'); renderCampaigns(); };
$('camp-back').onclick = () => showScreen('title');
$('btn-ach').onclick = () => openAchievements();
$('pick-go').onclick = () => pickMulti ? startHotseat() : startNew();
$('btn-continue').onclick = () => { if (loadGame('auto')) startLoaded(); };
$('btn-load').onclick = () => openSaves('load');
$('btn-help').onclick = openHelp;
$('btn-credits').onclick = openCredits;
$('btn-end').onclick = doEndTurn;
$('busy').onclick = () => { LIFE.skip = true; };
$('btn-dip').onclick = () => !uiLocked() && openDiplomacy();
$('btn-court').onclick = () => !uiLocked() && openCourt();
$('btn-realm').onclick = () => !uiLocked() && openRealm();
$('btn-dev').onclick = () => !uiLocked() && openDevelopment();
$('btn-chron').onclick = () => !uiLocked() && openChronicle();
$('btn-menu').onclick = () => !uiLocked() && openMenu();
$('btn-code').onclick = () => !uiLocked() && openSecretCode();

// A secret word for the treasury: "Temurthegreat" brings 100,000 gold
async function openSecretCode() {
  const v = await showModal(`<h3>${t('Secret code')}</h3><input id="code-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" class="code-in"><p class="note">${t('A campaign in which a code is used earns no achievements.')}</p>`,
    [{ label: t('Cancel'), value: null }, { label: t('Enter'), value: 'ok', cls: 'big' }], {
      cancel: null,
      onOpen: m => { const i = m.querySelector('#code-in'); i.focus(); i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') closeModal('ok'); }; },
    });
  if (v !== 'ok') return;
  const word = codeWord($('code-in') ? $('code-in').value : '');
  if (word === 'temurthegreat' || ARMY_WORDS.includes(word)) G.cheated = true;
  if (word === 'temurthegreat') {
    G.factions[G.player].gold += 100000;
    sfx('coins');
    toast(t('The treasury overflows'), t('100,000 gold has been added to your treasury.'), 'good');
    refresh();
  } else if (ARMY_WORDS.includes(word)) await secretArmy();
  else toast(t('Secret code'), t('Nothing happens.'), 'bad');
}

// A code typed with the Russian keyboard layout still on ("Дфырфк" for "Lashkar") is read by key position,
// and spaces, capitals and apostrophes are ignored
const RU_KEYS = { й: 'q', ц: 'w', у: 'e', к: 'r', е: 't', н: 'y', г: 'u', ш: 'i', щ: 'o', з: 'p', ф: 'a', ы: 's', в: 'd', а: 'f', п: 'g', р: 'h', о: 'j', л: 'k', д: 'l', я: 'z', ч: 'x', с: 'c', м: 'v', и: 'b', т: 'n', ь: 'm' };
function codeWord(s) {
  const w = String(s).toLowerCase().replace(/[\s'’ʻʼ`.\-_]+/g, '');
  if (['лашкар', 'армия', 'кошин', 'қўшин'].includes(w)) return 'lashkar';
  return [...w].map(ch => RU_KEYS[ch] || ch).join('');
}
const ARMY_WORDS = ['lashkar', 'army', 'qoshin', 'qushin'];

// "Lashkar" raises an army of 1,000 mixed soldiers in any province
const SECRET_ARMY = ['spear', 'spear', 'spear', 'archer', 'archer', 'heavyinf', 'heavyinf', 'horsearch', 'horsearch', 'lancer', 'lancer', 'heavycav', 'heavycav'];
async function secretArmy() {
  const pl = G.player, here = UI.selProv || G.factions[pl].capital;
  const opt = p => `<option value="${p.id}" ${p.id === here ? 'selected' : ''}>${cityOf(p)}${p.owner !== pl ? ' · ' + (p.owner === 'rebels' ? t('Independent') : fName(p.owner)) : ''}</option>`;
  const byName = (a, b) => cityOf(a).localeCompare(cityOf(b));
  const all = Object.values(G.provinces);
  const mine = all.filter(p => p.owner === pl).sort(byName), other = all.filter(p => p.owner !== pl).sort(byName);
  const v = await showModal(`<h3>${t('A secret army')}</h3><p>${t('1,000 soldiers (spearmen, archers, armoured infantry, horse archers, lancers and heavy cavalry) will appear wherever you choose.')}</p>
    <select id="code-prov" class="code-in"><optgroup label="${t('Your cities')}">${mine.map(opt).join('')}</optgroup><optgroup label="${t('Other lands')}">${other.map(opt).join('')}</optgroup></select>`,
    [{ label: t('Cancel'), value: null }, { label: t('Raise the army'), value: 'ok', cls: 'big' }], { cancel: null });
  if (v !== 'ok') return;
  const p = G.provinces[$('code-prov').value];
  if (!p) return;
  const hostile = armiesIn(p.id).some(x => x.owner !== pl && !allied(x.owner, pl)) || (p.owner !== pl && !allied(p.owner, pl));
  if (!hostile) {
    const a = addArmy(pl, p.id, SECRET_ARMY, null);
    a.moves = armyMoves(a);
    sfx('horn');
    toast(t('A secret army'), t('1,000 soldiers have gathered at {city}.', { city: cityOf(p) }), 'good');
    UI.selArmy = a.id; UI.selProv = null;
    centerOnProv(p.id);
    refresh();
    return;
  }
  // Enemy land: the army gathers just outside and marches in, to fight, besiege or take the city
  if (p.owner !== pl && p.owner !== 'rebels' && !atWar(pl, p.owner)) {
    const o = p.owner;
    const warn = t('We are at peace with: {nation}. Marching into {city} means war.', { nation: fFull(o), city: cityOf(p) }) +
      (rel(pl, o).alliance ? ' ' + t('Our alliance will end.') : '') + (rel(pl, o).truce > 0 ? ' ' + t('Breaking a recent peace will anger every ruler.') : '');
    if (!(await confirmBox(t('Declare war?'), warn, t('Declare war'), t('Stay')))) return;
    declareWar(pl, o);
  }
  const calm = n => !armiesIn(n).some(x => atWar(x.owner, pl));
  const from = p.adj.find(n => G.provinces[n].owner === pl && calm(n)) || p.adj.find(calm) || p.adj[0];
  const a = addArmy(pl, from, SECRET_ARMY, null);
  a.moves = armyMoves(a) + 1;
  sfx('horn');
  toast(t('A secret army'), t('1,000 soldiers gather outside {city} and march in.', { city: cityOf(p) }), 'good');
  centerOnProv(p.id);
  UI.selArmy = a.id; UI.selProv = null;
  refresh();
  UI.reach = reachable(a);
  await orderMove(a, p.id);
  refresh();
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
  else if (e.key === 'g' || e.key === 'G') openDevelopment();
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
    // In a campaign: wait for a quiet moment, keep the campaign, reload and carry straight on
    const whenQuiet = () => {
      if (G && (uiLocked() || flushing)) { setTimeout(whenQuiet, 1500); return; }
      if (G && saveGame('auto')) { try { sessionStorage.setItem('turan-resume', '1'); } catch (e) { /* ignore */ } }
      location.reload();
    };
    whenQuiet();
  });
}

// The opening splash: the author's mark, for a moment, then the game (a tap skips it)
(function splash() {
  const el = $('splash');
  if (!el) return;
  const hide = () => { if (el.classList.contains('out')) return; el.classList.add('out'); setTimeout(() => el.remove(), 800); };
  el.addEventListener('click', hide);
  setTimeout(hide, 2200);
  // The first time, the film of the opening follows the author's mark
  let resuming = false;
  try { resuming = sessionStorage.getItem('turan-resume') === '1'; } catch (e) { /* ignore */ }
  if (!introSeen() && !resuming && !navigator.webdriver) setTimeout(() => { if (!G) playIntro(); }, 2300);
})();
$('btn-intro').onclick = () => playIntro();

// Back from an update in the middle of a campaign: continue it at once
(function resumeAfterUpdate() {
  let resume = false;
  try { resume = sessionStorage.getItem('turan-resume') === '1'; sessionStorage.removeItem('turan-resume'); } catch (e) { /* ignore */ }
  if (!resume || !loadGame('auto')) return;
  if ($('splash')) $('splash').remove();
  startLoaded().then(() => toast(t('The game was updated'), t('Your campaign continues where you left it.'), 'good'));
})();

// The version, shown at the foot of the menu (the name of the offline cache)
function fillVersion(el) {
  if (!el || !window.caches) return;
  caches.keys().then(ks => { const k = ks.find(x => x.startsWith('turan-')); if (k) el.textContent = t('Version {v}', { v: k.slice(6, 12) }); }).catch(() => {});
}
