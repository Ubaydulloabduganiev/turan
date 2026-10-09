'use strict';
// Achievements: medals that stay with the player across every campaign, kept in this browser.
// A campaign in which a secret code was used earns none.

const ACH = [
  { id: 'first_win', icon: '⚔', name: 'First victory', desc: 'Win a battle.', check: pl => G.stats[pl].won >= 1 },
  { id: 'storm', icon: '🏰', name: 'Over the walls', desc: 'Take a city with great walls by storm.', check: () => feats('storm') },
  { id: 'conqueror', icon: '⚑', name: 'Conqueror', desc: 'Rule 20 provinces.', check: pl => provsOf(pl).length >= 20 },
  { id: 'lord', icon: '♛', name: 'Lord of Turan', desc: 'Rule 35 provinces.', check: pl => provsOf(pl).length >= 35 },
  { id: 'kneel', icon: '🙇', name: 'Bow before me', desc: 'Make a rival nation submit and hand you its crown.', check: () => feats('submit') },
  { id: 'last', icon: '👑', name: 'The last nation standing', desc: 'Win the grand campaign.', check: () => G.over === 'win' },
  { id: 'steppe', icon: '🐎', name: 'Heir of Chinggis Khan', desc: 'Win the grand campaign with a steppe nation.', check: pl => G.over === 'win' && FACTIONS[pl].nomad },
  { id: 'underdog', icon: '✧', name: 'The underdog', desc: 'Win the grand campaign with the Kartids or the Sarbadars.', check: pl => G.over === 'win' && (pl === 'kart' || pl === 'sarbadar') },
  { id: 'robber', icon: '🐪', name: 'Lord of the highway', desc: 'Plunder five enemy caravans.', check: () => feats('caravan') >= 5 },
  { id: 'whatif', icon: '✦', name: 'A different history', desc: 'At three turning points of history, choose what history did not.', check: () => feats('alt') >= 3 },
  { id: 'daily', icon: '☀', name: 'Challenge of the day', desc: 'Win a daily challenge.', check: () => Object.keys(chalLoad()).some(k => k.startsWith('daily:') && chalLoad()[k].won) },
  { id: 'weekly', icon: '🗓', name: 'Challenge of the week', desc: 'Win a weekly challenge.', check: () => Object.keys(chalLoad()).some(k => k.startsWith('weekly:') && chalLoad()[k].won) },
  { id: 'streak', icon: '🔥', name: 'Seven days in a row', desc: 'Win the daily challenge seven days in a row.', check: () => chalStreak() >= 7 },
  { id: 'buy', icon: '⚖', name: 'Bought, not won', desc: 'Buy a city from its ruler.', check: () => feats('buycity') },
  { id: 'wedding', icon: '💍', name: 'A royal wedding', desc: 'Join your house to another by marriage.', check: pl => rivalsOf(pl).some(g => rel(pl, g).married) },
  { id: 'kinship', icon: '❦', name: 'Web of kinship', desc: 'Be joined by marriage to three dynasties at once.', check: pl => rivalsOf(pl).filter(g => rel(pl, g).married).length >= 3 },
  { id: 'allies', icon: '🤝', name: 'Friends in every court', desc: 'Have three alliances at once.', check: pl => rivalsOf(pl).filter(g => rel(pl, g).alliance).length >= 3 },
  { id: 'silk', icon: '🐫', name: 'Lord of the Silk Road', desc: 'Have five trade agreements at once.', check: pl => rivalsOf(pl).filter(g => rel(pl, g).trade).length >= 5 },
  { id: 'peace', icon: '☮', name: 'The long peace', desc: 'Stay out of every war for 10 turns in a row.', check: () => feats('peaceStreak') >= 10 },
  { id: 'honour', icon: '✦', name: 'A man of his word', desc: 'Reach an honourable reputation.', check: pl => trustOf(pl) >= 75 },
  { id: 'coalition', icon: '🛡', name: 'Against all odds', desc: 'Survive a grand coalition formed against you.', check: () => feats('coalition') },
  { id: 'treasury', icon: '💰', name: 'Treasure of the khans', desc: 'Hold 20,000 gold in your treasury.', check: pl => G.factions[pl].gold >= 20000 },
  { id: 'wonder', icon: '🕌', name: 'Builder of wonders', desc: 'Complete a wonder of the age.', check: pl => Object.keys(WONDERS).some(id => hasWonder(pl, id)) },
  { id: 'wonders', icon: '🏛', name: 'Wonders of the age', desc: 'Hold all five wonders.', check: pl => Object.keys(WONDERS).every(id => hasWonder(pl, id)) },
  { id: 'scholars', icon: '📜', name: 'Patron of learning', desc: 'Keep three scholars or poets at your court.', check: pl => sagesOf(pl).length >= 3 },
  { id: 'advance', icon: '☼', name: 'Master of a field', desc: 'Win all five advances in one field.', check: pl => TRACK_ORDER.some(k => devOf(pl)[k].lvl >= 5) },
  { id: 'golden', icon: '🌟', name: 'A golden age', desc: 'Win all twenty advances.', check: () => !!G.goldenAge },
  { id: 'golden_early', icon: '⏳', name: 'Ahead of its time', desc: 'Crown a golden age before 1400.', check: () => !!G.goldenAge && GAME.START_YEAR + Math.floor(G.goldenAge / 2) < 1400 },
  ...SCENARIOS.map(s => ({ id: 'sc_' + s.id, icon: '📖', name: s.title, desc: 'Complete the campaign.', campaign: s.id, check: () => G.scenario && G.scenario.id === s.id && G.scenario.result === 'win' })),
];

const feats = k => (G.feats && G.feats[k]) || 0;
const rivalsOf = pl => PLAYABLE.filter(g => g !== pl && G.factions[g].alive);

function achLoad() { try { return JSON.parse(localStorage.getItem('turan-ach') || '{}'); } catch (e) { return {}; } }
function achSave(a) { try { localStorage.setItem('turan-ach', JSON.stringify(a)); } catch (e) { /* storage unavailable */ } }
const achDone = id => !!achLoad()[id];

// Called after every turn and after the player's own deeds
function checkAchievements() {
  if (!G || !G.player || G.cheated) return;
  const pl = G.player, got = achLoad(), fresh = [];
  for (const a of ACH) {
    if (got[a.id]) continue;
    let ok = false;
    try { ok = !!a.check(pl); } catch (e) { ok = false; }
    if (ok) { got[a.id] = { at: Date.now(), date: dateText(), nation: pl }; fresh.push(a); }
  }
  if (!fresh.length) return;
  achSave(got);
  fresh.forEach((a, i) => setTimeout(() => achBanner(a), i * 2600));
}

// Keeps the count of peaceful turns
function achTurn() {
  if (!G) return;
  G.feats = G.feats || {};
  G.feats.peaceStreak = rivalsOf(G.player).some(g => rel(G.player, g).war) ? 0 : (G.feats.peaceStreak || 0) + 1;
  checkAchievements();
}

// A gold medal sliding in at the top of the screen
function achBanner(a) {
  sfx('fanfare', { vol: 0.6 });
  const d = document.createElement('div');
  d.className = 'ach-banner';
  d.innerHTML = `<span class="ach-medal">${glyphIcon(a.icon)}</span><div><small>${t('Achievement unlocked')}</small><b>${t(a.name)}</b><span>${t(a.desc)}</span></div>`;
  document.body.appendChild(d);
  setTimeout(() => d.classList.add('out'), 4200);
  setTimeout(() => d.remove(), 5000);
}

function openAchievements() {
  const got = achLoad(), n = ACH.filter(a => got[a.id]).length;
  const cards = ACH.map(a => {
    const g = got[a.id];
    return `<div class="ach ${g ? 'got' : ''}"><span class="ach-medal">${glyphIcon(a.icon)}</span><div><b>${t(a.name)}</b><span>${t(a.desc)}</span>${g ? `<small>${g.date ? g.date + ' · ' : ''}${g.nation && FACTIONS[g.nation] ? fName(g.nation) : ''}</small>` : ''}</div></div>`;
  }).join('');
  const note = G && G.cheated ? `<p class="note warn">${t('A secret code was used in this campaign, so it earns no achievements.')}</p>` : '';
  return showModal(`<button class="modal-x small" data-close="1">${t('Close')}</button><h3>${t('Achievements')}</h3>
    <p class="note">${t('{n} of {k} won. They stay with you across every campaign.', { n, k: ACH.length })}</p>${note}
    <div class="ach-bar"><div style="width:${Math.round(n / ACH.length * 100)}%"></div></div><div class="ach-grid">${cards}</div>`, [], {
    cls: 'wide', cancel: null, onClick: e => { if (e.target.closest('[data-close]')) closeModal(null); },
  });
}
