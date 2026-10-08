'use strict';
// Caravans. Every trade agreement sends caravans along the shortest road between the two capitals.
// An army at war with either partner that stands on that road plunders them: that season's trade is
// lost to both, and the raider carries off the goods. Independent lords who hold a city on the road
// sometimes rob them too. Guard your roads, or ride out and rob your enemies'.

// The road between two realms: the shortest chain of provinces from one capital to the other
function tradeRoute(a, b) {
  const from = G.factions[a].capital, to = G.factions[b].capital;
  if (!from || !to) return null;
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const c = q.shift();
    if (c === to) break;
    for (const n of G.provinces[c].adj) if (!(n in prev)) { prev[n] = c; q.push(n); }
  }
  if (!(to in prev)) return null;
  const path = [];
  for (let k = to; k; k = prev[k]) path.unshift(k);
  return path;
}

// Every trade agreement in force, with its road
function tradeRoutes() {
  const out = [];
  for (const a of PLAYABLE) for (const b of PLAYABLE) {
    if (a >= b || !G.factions[a].alive || !G.factions[b].alive || !rel(a, b).trade) continue;
    const path = tradeRoute(a, b);
    if (path) out.push({ a, b, path, key: relKey(a, b) });
  }
  return out;
}

// What one agreement is worth to each side in a season (the same sum tradeIncome() adds)
function routeValue(a, b) {
  const silk = provsOf(a).filter(p => p.silk).length + provsOf(b).filter(p => p.silk).length;
  return (30 + silk * 12) * GAME.INCOME;
}

// Who, if anyone, robs this caravan: an army at war with either partner, standing on the road.
// Caravans slip past about half the time; a cunning general rarely misses them. One army robs one caravan a season.
function raiderOn(r, busy) {
  for (const pid of r.path) {
    for (const x of armiesIn(pid)) {
      if (x.owner === r.a || x.owner === r.b || x.owner === 'rebels' || busy.has(x.id)) continue;
      if (!atWar(x.owner, r.a) && !atWar(x.owner, r.b)) continue;
      if (rng() < (x.general && hasTrait(x.general.name, 'cunning') ? 0.75 : 0.5)) { busy.add(x.id); return { by: x.owner, army: x, prov: pid }; }
    }
  }
  // Bandits: an independent city on the road with men under arms
  for (const pid of r.path) {
    if (G.provinces[pid].owner === 'rebels' && armiesIn(pid).some(x => x.owner === 'rebels') && rng() < 0.12) return { by: 'rebels', prov: pid };
  }
  return null;
}

// Each turn, before taxes: the caravans set out, and some are robbed
function caravansTurn() {
  G.raids = [];
  G.raided = {};
  const busy = new Set();
  for (const r of tradeRoutes()) {
    const hit = raiderOn(r, busy);
    if (!hit) continue;
    const value = Math.round(routeValue(r.a, r.b));
    G.raided[r.key] = true;
    const loot = hit.by === 'rebels' ? 0 : value;
    if (loot) G.factions[hit.by].gold += loot;
    G.raids.push({ a: r.a, b: r.b, by: hit.by, prov: hit.prov, value, loot });
    const pl = G.player, city = cityOf(G.provinces[hit.prov]);
    if (r.a === pl || r.b === pl) {
      const partner = r.a === pl ? r.b : r.a;
      log(dateText() + ': ' + t('Our caravans to {nation} were robbed near {city}.', { nation: fName(partner), city }), 'war');
      HOOKS.notify({ minor: true, title: t('Caravans robbed'), text: hit.by === 'rebels'
        ? t('Bandits from {city} robbed our caravans to {nation}. We lose {n} gold of trade this season. Take the city to make the road safe.', { city, nation: fName(partner), n: value })
        : t('An army of the {raider} plundered our caravans to {nation} near {city}. We lose {n} gold of trade this season. Drive it off the road.', { raider: fFull(hit.by), city, nation: fName(partner), n: value }) });
    } else if (hit.by === pl) {
      feat('caravan');
      log(dateText() + ': ' + t('Our army plundered a caravan of {nation} and {nation2} near {city}.', { nation: fName(r.a), nation2: fName(r.b), city }), 'big');
      HOOKS.notify({ minor: true, sound: 'coins', title: t('A caravan plundered'), text: t('Our army near {city} fell on a caravan of {nation} and {nation2} and carried off {n} gold.', { city, nation: fName(r.a), nation2: fName(r.b), n: loot }) });
    }
  }
}
const routeRaided = (a, b) => !!(G.raided && G.raided[relKey(a, b)]);

// Roads of enemies where this army could rob caravans: [{ a, b, prov }] next to or under it
function raidChances(army) {
  const out = [];
  const near = new Set([army.prov, ...G.provinces[army.prov].adj]);
  for (const r of tradeRoutes()) {
    if (r.a === army.owner || r.b === army.owner) continue;
    if (!atWar(army.owner, r.a) && !atWar(army.owner, r.b)) continue;
    const pid = r.path.find(id => near.has(id));
    if (pid) out.push({ a: r.a, b: r.b, prov: pid, value: Math.round(routeValue(r.a, r.b)) });
  }
  return out;
}
