'use strict';
// Hot seat: several people rule their own nations on one device and pass it between turns.
// Each round the people play in the order of the nations, between the moves of the computer's rulers.
// Messages meant for one ruler wait until that ruler holds the device.

// The screen between two players: the map is hidden until the next ruler is ready
async function handOver(f) {
  if (!G) return;
  if (!G.humans) { G.player = f; return; }
  if (HOT.holder === f && G.player === f) return;
  const old = G.player;
  // What was waiting to be shown belongs to the ruler who held the device
  if (notices.length && old) HOT.pending[old] = (HOT.pending[old] || []).concat(notices.splice(0));
  G.player = f; HOT.holder = f;
  UI.selArmy = null; UI.selProv = null;
  const busyWas = !$('busy').classList.contains('hidden');
  $('busy').classList.add('hidden');
  document.body.classList.add('handing');
  sfx('horn', { vol: 0.45 });
  await showModal(`<div class="hand-flag">${flagSVG(f)}</div><div class="camp-year">${dateText()}</div><h3>${t('{nation}: your turn', { nation: fFull(f) })}</h3>
    <div class="with-portrait">${rulerPortrait(f)}<p>${t('Pass the device to the player of the {nation}. Everyone else, look away: the map shows only what this ruler can see.', { nation: fName(f) })}</p></div>`,
    [{ label: t('I am ready'), value: true, cls: 'big' }], { cls: 'parch handover', cancel: true });
  document.body.classList.remove('handing');
  refresh();
  const cap = G.factions[f].capital;
  if (cap && G.provinces[cap].owner === f) { centerOnProv(cap, 1.2); UI.selProv = cap; refresh(); }
  // Their messages, kept while the others played
  const list = HOT.pending[f] || [];
  HOT.pending[f] = [];
  for (const n of list) { if (n.minor) toast(n.title, n.text); else notices.push(n); }
  if (busyWas && turnBusy && !HOT.waiting) $('busy').classList.remove('hidden');
}
HOOKS.focus = handOver;

// A person's part of the round, played while the computer's rulers wait
HOOKS.humanTurn = async f => {
  await handOver(f);
  await turnStartUI(false);
  if (!G || G.over) return;
  $('busy').classList.add('hidden');
  $('btn-end').disabled = false;
  await new Promise(res => { HOT.waiting = res; });
  HOT.waiting = null;
  $('busy').classList.remove('hidden');
  $('btn-end').disabled = true;
};

// ---------- Choosing the rulers ----------

let pickMulti = null; // the nations chosen for a hot-seat game, or null for one player
function startHotseatPick() { pickMulti = new Set(); showScreen('pick'); renderPick(); }
function hotseatNote() {
  if (!pickMulti) return '';
  const n = pickMulti.size;
  return `<div class="hot-note"><b>${t('Hot seat')}</b> · ${t('Tap two or more nations, one for each player. The computer rules the rest.')}
    <div class="hot-chosen">${[...pickMulti].map(f => `${flagSVG(f)}<span>${fName(f)}</span>`).join('') || `<i>${t('No nation chosen yet')}</i>`}</div>
    ${n && n < 2 ? `<small class="warn">${t('Choose at least one more nation.')}</small>` : ''}</div>`;
}
function syncPickGo() {
  const b = $('pick-go');
  if (!pickMulti) { b.textContent = t('Begin campaign'); b.disabled = false; return; }
  b.textContent = t('Begin with {n} rulers', { n: pickMulti.size });
  b.disabled = pickMulti.size < 2;
}

async function startHotseat() {
  const humans = PLAYABLE.filter(f => pickMulti.has(f));
  pickMulti = null;
  HOT.holder = null; HOT.pending = {}; HOT.waiting = null;
  quietNotices = true;
  newGame(humans[0], undefined, humans);
  quietNotices = false;
  for (const f of humans) startDeeds(f);
  G.calm = G.turn + 4;
  notices.length = 0;
  pickSel = humans[0];
  await withLoading(enterGame);
  document.body.classList.add('handing');
  await showModal(`<h3>${t('A game for {n} rulers', { n: humans.length })}</h3><div class="hot-chosen hot-list">${humans.map(f => `${flagSVG(f)}<span>${fFull(f)}</span>`).join('')}</div>
    <p>${t('Each player rules one nation. When you end your turn, pass the device to the next player. The computer rules the other nations. The last nation standing wins, so friends can become enemies.')}</p>`,
    [{ label: t('Begin'), value: true, cls: 'big' }], { cls: 'parch', cancel: true });
  document.body.classList.remove('handing');
  await handOver(humans[0]);
  saveGame('auto');
}
