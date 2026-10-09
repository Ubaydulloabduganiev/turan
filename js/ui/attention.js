'use strict';
// The ruler's desk: a short list of what needs a decision this turn, and what the standing orders did on
// their own (armies on the march, cities run by governors). Each line takes you to the place it is about.

const ATT = { reports: [], open: true, idleIdx: 0 };
// Open by default on large screens; on a phone it starts folded to one line
try { const v = localStorage.getItem('turan-att'); ATT.open = v ? v === 'open' : innerWidth > 760; } catch (e) { ATT.open = innerWidth > 760; }

const armyName = a => a.general ? pn(a.general.name) : t('An army');

// Start of a ruler's turn: carry out the standing orders
async function runStandingOrders() {
  if (!G || G.over) return;
  ATT.reports = [];
  for (const r of await followOrders(G.player)) attentionReport(r);
  for (const r of governTurn(G.player)) attentionReport(r);
}
function attentionReport(r) { ATT.reports.push(Object.assign({ turn: G.turn }, r)); }

function attentionItems() {
  const pl = G.player, out = [];
  const reps = ATT.reports.filter(r => r.turn === G.turn);
  // What the standing orders did
  for (const r of reps) {
    const a = G.armies[r.army], name = a ? armyName(a) : t('An army');
    if (r.kind === 'arrived') out.push({ ic: 'flag', text: t('{name} has reached {city}.', { name, city: cityById(r.prov) }), army: r.army });
    if (r.kind === 'contact') out.push({ ic: 'swords', cls: 'warn', text: t('{name} stands before {city}. Attack or wait?', { name, city: cityById(r.prov) }), army: r.army });
    if (r.kind === 'blocked') out.push({ ic: 'cross', cls: 'warn', text: t('{name} cannot reach {city}: the road is closed.', { name, city: cityById(r.prov) }), army: r.army });
  }
  const built = reps.filter(r => r.kind === 'build');
  if (built.length === 1) out.push({ ic: 'hammer', text: t('The governor of {city} has started: {what}.', { city: cityById(built[0].prov), what: bName(built[0].what) }), prov: built[0].prov, tab: 'build' });
  else if (built.length) out.push({ ic: 'hammer', text: t('Governors started {n} new buildings.', { n: built.length }), prov: built[0].prov });
  for (const r of reps.filter(r => r.kind === 'feast')) out.push({ ic: 'cup', text: t('The governor of {city} gave a feast to calm the people.', { city: cityById(r.prov) }), prov: r.prov });

  const mine = provsOf(pl);
  // Danger first
  for (const p of mine) if (p.siege) out.push({ ic: 'castle', cls: 'bad', text: t('{city} is besieged.', { city: cityOf(p) }), prov: p.id });
  for (const p of mine) {
    if (p.siege) continue;
    const foe = p.adj.reduce((s, n) => s + armiesIn(n).filter(a => atWar(a.owner, pl) && armyVisible(a)).reduce((x, a) => x + armyPower(a), 0), 0);
    if (foe > 30 && foe > guardOf(p, pl)) out.push({ ic: 'shield', cls: 'bad', text: t('An enemy army is near {city}.', { city: cityOf(p) }), prov: p.id });
  }
  for (const a of armiesOf(pl)) {
    if (!a.besieging) continue;
    const b = assaultBattle(a.prov, pl);
    if (b && battleOdds(b) > 0.65) out.push({ ic: 'walls', cls: 'good', text: t('The walls of {city} can be stormed: good odds.', { city: cityById(a.prov) }), army: a.id });
  }
  const dist = distancesFrom(pl);
  for (const p of mine) if (provinceOrder(p, dist) < 35) out.push({ ic: 'order', cls: 'warn', text: t('{city} is close to revolt.', { city: cityOf(p) }), prov: p.id, tab: 'rule' });
  const st = G.factions[pl], net = (st.lastIncome || factionIncome(pl)) - factionUpkeep(pl);
  if (net < 0) out.push({ ic: 'coin', cls: 'warn', text: t('We spend {n} gold a turn more than we earn.', { n: fmt(-net) }), screen: 'realm' });
  // Work waiting
  const idle = mine.filter(p => !p.build && !p.gov && !p.siege && BUILDING_ORDER.some(k => !buildCheck(p, k)));
  if (idle.length) out.push({ ic: 'hammer', text: t('{n} cities are building nothing.', { n: idle.length }), prov: idle[0].id, tab: 'build', govern: idle.length > 1 });
  const waiting = armiesOf(pl).filter(a => !a.dest && !a.besieging && a.moves === armyMoves(a) && armyPower(a) >= 20);
  if (waiting.length) out.push({ ic: 'banner', text: t('{n} armies wait for orders.', { n: waiting.length }), cycle: true });
  return out;
}

function renderAttention() {
  let box = $('attention');
  if (!box) { box = document.createElement('div'); box.id = 'attention'; $('game').appendChild(box); }
  if (!G || G.over || (G.humans && HOT.waiting)) { box.innerHTML = ''; return; }
  const items = attentionItems();
  if (!items.length) { box.innerHTML = ''; return; }
  const head = `<button class="att-head" data-att="toggle" title="${t('What needs your attention this turn')}">${icon('scroll')}<span>${t('This turn')}</span><b>${items.length}</b><i>${ATT.open ? '▴' : '▾'}</i></button>`;
  if (!ATT.open) { box.innerHTML = head; box.className = 'closed'; return; }
  box.className = '';
  box.innerHTML = head + '<ul>' + items.slice(0, 9).map((x, i) => `<li class="${x.cls || ''}"><button data-att="go" data-i="${i}">${icon(x.ic)}<span>${x.text}</span></button>` +
    (x.govern ? `<button class="att-gov" data-att="govern" title="${t('Let governors run every idle city: they build and keep order, but always leave {n} gold in the treasury.', { n: GOV_RESERVE })}">${t('Governors')}</button>` : '') + '</li>').join('') + '</ul>';
  ATT.items = items;
}

document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-att]');
  if (!el || !G || uiLocked()) return;
  const k = el.dataset.att;
  if (k === 'toggle') { ATT.open = !ATT.open; try { localStorage.setItem('turan-att', ATT.open ? 'open' : 'closed'); } catch (err) { /* private mode */ } renderAttention(); return; }
  if (k === 'govern') {
    let n = 0;
    for (const p of provsOf(G.player)) if (!p.build && !p.gov) { p.gov = true; n++; }
    for (const r of governTurn(G.player)) attentionReport(r);
    toast(t('Governors appointed'), t('{n} cities now run themselves. You can take any of them back in its City tab.', { n }), 'good');
    refresh();
    return;
  }
  const x = ATT.items && ATT.items[+el.dataset.i];
  if (!x) return;
  if (x.screen === 'realm') { openRealm(); return; }
  if (x.cycle) {
    const list = armiesOf(G.player).filter(a => !a.dest && !a.besieging && a.moves === armyMoves(a) && armyPower(a) >= 20);
    const a = list[ATT.idleIdx++ % list.length];
    if (a) { UI.selArmy = a.id; UI.selProv = a.prov; centerOnProv(a.prov); }
  } else if (x.army && G.armies[x.army]) { UI.selArmy = x.army; UI.selProv = G.armies[x.army].prov; centerOnProv(UI.selProv); }
  else if (x.prov) { UI.selArmy = null; UI.selProv = x.prov; UI.ptab = x.tab || 'rule'; centerOnProv(x.prov); }
  refresh();
});
