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
      if (b && battleOdds(b) > 0.65) tips.push({ score: 90, text: `Storm the walls of ${G.provinces[a.prov].city}: your army is strong enough.`, army: a.id });
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
      if (!best || score > best.score) best = { score, text: `Attack ${p.city}${p.owner === 'rebels' ? ', an independent city,' : ''} with ${a.general ? a.general.name : 'your army at ' + G.provinces[a.prov].city}. The odds are good.`, prov: pid };
    }
  }
  if (best) tips.push(best);
  // Weak rivals may kneel
  for (const f of PLAYABLE) {
    if (f === pl || !G.factions[f].alive) continue;
    if (dealValue(pl, f, 'submit') > 0) {
      const p = provsOf(f)[0];
      tips.push({ score: 95, text: `The ${FACTIONS[f].name} is broken. Demand that ${G.factions[f].leader} submit to you.`, prov: p && p.id });
    }
    const r = rel(pl, f);
    if (r.war && factionPower(f) > factionPower(pl) * 1.5 && dealValue(pl, f, 'peace') > -15)
      tips.push({ score: 70, text: `The ${FACTIONS[f].name} is stronger than us. Consider offering peace.`, prov: (provsOf(f)[0] || {}).id });
  }
  // Unhappy cities
  for (const p of provsOf(pl)) {
    const o = provinceOrder(p, dist);
    if (o < 40) tips.push({ score: 85 - o, text: `${p.city} is restless (${o}% order). Hold a feast there or lower taxes.`, prov: p.id });
  }
  // Money to spend
  const income = factionIncome(pl), upkeep = factionUpkeep(pl);
  if (income - upkeep < 0) tips.push({ score: 80, text: `We spend more than we earn. Build bazaars, raise taxes or send some troops home.`, realm: true });
  if (st.gold > 1000) {
    const idle = provsOf(pl).filter(p => !p.build && !buildCheck(p, 'market')).sort((a, b) => b.pop - a.pop)[0];
    if (idle) tips.push({ score: 50, text: `The treasury is full. Build a ${BUILDINGS.market.levels[idle.b.market + 1]} in ${idle.city} for more gold.`, prov: idle.id });
    if (upkeep < income * 0.5) {
      const cap = G.provinces[st.capital];
      if (cap && cap.owner === pl) tips.push({ score: 55, text: `We can afford a bigger army. Recruit soldiers in ${cap.city}.`, prov: cap.id });
    }
  }
  tips.sort((a, b) => b.score - a.score);
  if (!tips.length) tips.push({ text: 'All is quiet, your majesty. End the turn when you are ready.' });
  return tips.slice(0, 3);
}

let advisorOpen = true;
function renderAdvisor() {
  const box = $('advisor');
  if (!G || G.over) { box.innerHTML = ''; return; }
  const tips = advisorTips();
  box._tips = tips;
  box.innerHTML = `<div class="adv-head" data-adv="toggle"><span>Your vizier advises</span><span>${advisorOpen ? '–' : '+'}</span></div>` +
    (advisorOpen ? tips.map((t, i) => `<div class="tip ${t.prov || t.army || t.realm ? 'link' : ''}" data-adv="${i}">${t.text}</div>`).join('') : '');
}

$('advisor').addEventListener('click', e => {
  const el = e.target.closest('[data-adv]');
  if (!el || !G || uiLocked()) return;
  if (el.dataset.adv === 'toggle') { advisorOpen = !advisorOpen; renderAdvisor(); return; }
  const t = $('advisor')._tips[+el.dataset.adv];
  if (!t) return;
  if (t.realm) return openRealm();
  if (t.army) { UI.selArmy = t.army; UI.selProv = G.armies[t.army].prov; centerOnProv(UI.selProv); }
  else if (t.prov) { UI.selArmy = null; UI.selProv = t.prov; centerOnProv(t.prov); }
  refresh();
});
