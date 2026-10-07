'use strict';
// The vizier: a short list of good moves for this turn, so a new ruler always knows what to do next.

function advisorTips() {
  const pl = G.player, st = G.factions[pl], tips = [];
  const dist = distancesFrom(pl);
  // Armies that can win a fight right now
  let best = null;
  for (const a of armiesOf(pl)) {
    if (a.besieging) {
      const b = assaultBattle(a.prov, pl);
      if (b && battleOdds(b) > 0.65) tips.push({ score: 90, text: t('Storm the walls of {city}: your army is strong enough.', { city: cityOf(G.provinces[a.prov]) }), army: a.id });
      continue;
    }
    if (a.moves <= 0) continue;
    const reach = reachable(a);
    for (const pid in reach) {
      if (reach[pid].kind !== 'attack') continue;
      const p = G.provinces[pid];
      const ratio = armyPower(a) / (estimateDefence(p) + 1);
      if (ratio < 1.4) continue;
      const score = 40 + Math.min(40, p.pop) + (p.silk ? 10 : 0) + Math.min(20, ratio * 4);
      if (!best || score > best.score) best = { score, text: t(p.owner === 'rebels' ? 'Attack {city}, an independent city, with {army}. The odds are good.' : 'Attack {city} with {army}. The odds are good.', { city: cityOf(p), army: a.general ? pn(a.general.name) : t('your army at {city}', { city: cityOf(G.provinces[a.prov]) }) }), prov: pid };
    }
  }
  if (best) tips.push(best);
  // Plunder from armies standing in enemy land
  for (const a of armiesOf(pl)) if (!raidCheck(a)) { tips.push({ score: 60, text: t('Your army at {city} can plunder the countryside for {n} gold.', { city: cityOf(G.provinces[a.prov]), n: fmt(raidGold(a)) }), army: a.id }); break; }
  // A wonder within reach
  for (const id in WONDERS) { const p = G.provinces[WONDERS[id].prov]; if (p.owner === pl && !wonderCheck(p)) { tips.push({ score: 58, text: t('You can afford to raise the {wonder} in {city}.', { wonder: wName(id), city: cityOf(p) }), prov: p.id }); break; } }
  // Weak rivals may kneel
  for (const f of PLAYABLE) {
    if (f === pl || !G.factions[f].alive) continue;
    if (dealValue(pl, f, 'submit') > 0) {
      const p = provsOf(f)[0];
      tips.push({ score: 95, text: t('The {nation} is broken. Demand that {ruler} submit to you.', { nation: fName(f), ruler: pn(G.factions[f].leader) }), prov: p && p.id });
    }
    const r = rel(pl, f);
    if (r.war && factionPower(f) > factionPower(pl) * 1.5 && dealValue(pl, f, 'peace') > -15)
      tips.push({ score: 70, text: t('The {nation} is stronger than us. Consider offering peace.', { nation: fName(f) }), prov: (provsOf(f)[0] || {}).id });
  }
  // The troubles of a great realm
  if (G.coalition && G.coalition.target === pl) tips.push({ score: 92, text: t('A coalition is at war with us. Offer peace to its weakest members to break it apart.'), realm: true });
  else if (dominance(pl) > 0.24 && !G.coalition) tips.push({ score: 62, text: t('Our power frightens the other rulers. If we grow much more, they may unite against us.'), realm: true });
  if (overstretch(pl) >= 3) tips.push({ score: 64, text: t('The realm is so large that every city is harder to govern (−{n} order). Appoint governors and build madrasas.', { n: Math.round(overstretch(pl)) }), realm: true });
  if (trustOf(pl) < 30) tips.push({ score: 66, text: t('Our name is stained by broken oaths. Rulers will not ally or trade with us until we prove ourselves.'), realm: true });
  // Growing the realm in peace
  if (totalPatronage(pl) === 0 && st.gold > 1800 && factionIncome(pl) - factionUpkeep(pl) > 300) tips.push({ score: 52, text: t('The treasury can support scholars and poets. Open Development and grant royal patronage.'), dev: true });
  { const cap = G.provinces[st.capital]; if (cap && cap.owner === pl && !cap.b.library && !cap.build && st.gold > 600 && cap.pop >= 10) tips.push({ score: 48, text: t('Build a library in {city}: it brings progress in literature and science.', { city: cityOf(cap) }), prov: cap.id }); }
  // Unhappy cities
  for (const p of provsOf(pl)) {
    const o = provinceOrder(p, dist);
    if (o < 40) tips.push({ score: 85 - o, text: t('{city} is restless ({n}% order). Hold a feast there or lower taxes.', { city: cityOf(p), n: o }), prov: p.id });
  }
  // Money to spend
  const income = factionIncome(pl), upkeep = factionUpkeep(pl);
  if (income - upkeep < 0) tips.push({ score: 80, text: t('We spend more than we earn. Build bazaars, raise taxes or send some troops home.'), realm: true });
  if (treasuryLoss(pl) > 0) tips.push({ score: 75, text: t('So much gold lies idle that the treasurers skim {n} a turn. Spend it: build, recruit, or raise a wonder.', { n: fmt(treasuryLoss(pl)) }), realm: true });
  if (st.gold > 1000) {
    const idle = provsOf(pl).filter(p => !p.build && !buildCheck(p, 'market')).sort((a, b) => b.pop - a.pop)[0];
    if (idle) tips.push({ score: 50, text: t('The treasury is full. Build a {building} in {city} for more gold.', { building: bLevel('market', idle.b.market + 1), city: cityOf(idle) }), prov: idle.id });
    if (upkeep < income * 0.5) {
      const cap = G.provinces[st.capital];
      if (cap && cap.owner === pl) tips.push({ score: 55, text: t('We can afford a bigger army. Recruit soldiers in {city}.', { city: cityOf(cap) }), prov: cap.id });
    }
  }
  tips.sort((a, b) => b.score - a.score);
  if (!tips.length) tips.push({ text: t('All is quiet, your majesty. End the turn when you are ready.') });
  return tips.slice(0, 3);
}

// Folded on phones, where the map needs the room
let advisorOpen = !(window.matchMedia && matchMedia('(max-width: 760px), (max-height: 520px)').matches);
function renderAdvisor() {
  const box = $('advisor');
  if (!G || G.over) { box.innerHTML = ''; return; }
  const tips = advisorTips();
  box._tips = tips;
  const m = G.factions[G.player].mission;
  let mission = '';
  if (m) {
    const left = m.deadline - G.turn;
    const where = m.type === 'conquer' || m.type === 'build' ? m.target : m.type === 'wonder' ? WONDERS[m.target].prov : null;
    mission = `<div class="mission ${where ? 'link' : ''}" data-mission="${where || ''}"><div class="m-head">${t('Council request')} · ${left <= 0 ? t('last turn') : t('turns left: {n}', { n: left })}</div>${m.text}<div class="m-reward">${t('Reward: {n} gold', { n: fmt(m.reward) })}</div></div>`;
  }
  box.innerHTML = `<div class="adv-head" data-adv="toggle"><span>${t('Your vizier advises')}</span><span>${advisorOpen ? '–' : '+'}</span></div>` +
    (advisorOpen ? '' : scenarioCard()) + // the campaign goal stays in sight even when the vizier is folded
    (advisorOpen ? scenarioCard() + mission + tips.map((tp, i) => `<div class="tip ${tp.prov || tp.army || tp.realm || tp.dev ? 'link' : ''}" data-adv="${i}">${tp.text}</div>`).join('') : '');
}

$('advisor').addEventListener('click', e => {
  const ms = e.target.closest('[data-mission]');
  if (ms && ms.dataset.mission && G && !uiLocked()) { UI.selArmy = null; UI.selProv = ms.dataset.mission; centerOnProv(ms.dataset.mission); refresh(); return; }
  const el = e.target.closest('[data-adv]');
  if (!el || !G || uiLocked()) return;
  if (el.dataset.adv === 'toggle') { advisorOpen = !advisorOpen; renderAdvisor(); return; }
  const t = $('advisor')._tips[+el.dataset.adv];
  if (!t) return;
  if (t.realm) return openRealm();
  if (t.dev) return openDevelopment();
  if (t.army) { UI.selArmy = t.army; UI.selProv = G.armies[t.army].prov; centerOnProv(UI.selProv); }
  else if (t.prov) { UI.selArmy = null; UI.selProv = t.prov; centerOnProv(t.prov); }
  refresh();
});
