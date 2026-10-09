'use strict';
// The rival rulers. Each plays by the player's rules: same costs, same movement, same battles.

const PREFS = {
  nomad: { horsearch: 5, lancer: 3, heavycav: 1, spear: 1, archer: 1, kipchak: 6, dughlat: 4, ordu: 2 },
  settled: { spear: 4, archer: 3, heavyinf: 2, horsearch: 2, lancer: 1, heavycav: 1, siege: 0.4, tovachi: 2, qangli: 2, ghuri: 3, dervish: 3 },
};

function neighbourFactions(f) {
  const out = new Set();
  for (const p of provsOf(f)) for (const n of p.adj) { const o = G.provinces[n].owner; if (o !== f) out.add(o); }
  return out;
}

function frontier(p) {
  return p.adj.some(n => { const o = G.provinces[n].owner; return o !== p.owner && !allied(o, p.owner); });
}

// ---------- Character ----------
// How a ruler plays depends on his people and on his own traits: the brave and the ambitious look for wars,
// the cautious and the pious keep the peace, and the greedy count the gold.
function temper(f) {
  const tr = rulerTraits(f), has = k => tr.includes(k) ? 1 : 0;
  const war = Math.max(0.15, (AGGRESSION[f] || 0.5) * (1 + 0.2 * has('brave') + 0.25 * has('ambitious') + 0.15 * has('cruel') - 0.25 * has('cautious') - 0.15 * has('pious') - 0.1 * has('just') - 0.1 * has('learned') - 0.1 * has('builder')));
  return {
    war,
    // how much stronger he wants to be before he attacks a city
    nerve: 1.25 + 0.25 * has('cautious') - 0.12 * has('brave') - 0.08 * has('ambitious'),
    // how readily he makes peace
    peace: 1 + 0.4 * has('cautious') + 0.3 * has('pious') + 0.2 * has('just') - 0.3 * has('ambitious') - 0.2 * has('cruel'),
    greedy: !!has('greedy'),
  };
}

// Enemy strength within two days' march of a province
function threatNear(f, pid, depth = 2) {
  const seen = new Set([pid]);
  let ring = [pid], s = 0;
  for (let d = 0; d <= depth; d++) {
    const next = [];
    for (const c of ring) {
      for (const a of armiesIn(c)) if (a.owner !== f && a.owner !== 'rebels' && atWar(a.owner, f)) s += armyPower(a) * (d ? 1 : 1.2);
      if (d < depth) for (const n of G.provinces[c].adj) if (!seen.has(n)) { seen.add(n); next.push(n); }
    }
    ring = next;
  }
  return s;
}

// What stands in a city of ours: armies, and the walls with their watch
function guardOf(p, f) {
  let s = armiesIn(p.id).filter(a => a.owner === f).reduce((t, a) => t + armyPower(a), 0);
  if (p.b.walls) s = (s + cityWatch(p).reduce((t, u) => t + unitPower(u), 0)) * (1 + 0.3 * p.b.walls);
  return s;
}

// A war with a real power, not only with rebels
const realWars = f => POWERS.filter(g => g !== f && G.factions[g].alive && rel(f, g).war);

async function aiTurn(f) {
  aiDisband(f);
  aiDiplomacy(f);
  await aiOffers(f);
  aiBuild(f);
  aiRecruit(f);
  await aiArmies(f);
}

// Out of money: send home the troops furthest from any war.
function aiDisband(f) {
  const st = G.factions[f];
  const net = (st.lastIncome || factionIncome(f)) - factionUpkeep(f);
  let excess = st.gold < 0 ? -net + 100 : 0;
  if (excess <= 0) return;
  const list = [];
  for (const a of armiesOf(f)) a.units.forEach(u => { if (u.type !== 'general') list.push({ a, u, front: frontier(G.provinces[a.prov]) }); });
  list.sort((x, y) => (x.front - y.front) || unitPower(x.u) - unitPower(y.u));
  for (const x of list) {
    if (excess <= 0) break;
    const i = x.a.units.indexOf(x.u);
    if (i < 0) continue;
    excess -= unitUpkeep(x.u.type, FACTIONS[f].nomad);
    disbandUnit(x.a, i);
  }
}

// ---------- Diplomacy ----------

function aiDiplomacy(f) {
  const st = G.factions[f], my = factionPower(f) + 40;
  if (aiBetray(f)) return;
  aiCallAllies(f);
  for (const g of POWERS) {
    if (g === f || isHuman(g) || !G.factions[g].alive) continue;
    const r = rel(f, g);
    if (r.war) {
      // Tired or beaten: sue for peace. A wise ruler also ends the smaller of two wars, and one in danger
      // takes worse terms to save his capital.
      const theirs = dealValue(f, g, 'peace'), mine = dealValue(g, f, 'peace') + aiPeaceNeed(f, g);
      if (theirs > 0 && mine > 0) applyDeal(f, g, 'peace');
    } else if (!r.trade && dealValue(f, g, 'trade') > 0 && dealValue(g, f, 'trade') > 0 && rng() < 0.15) applyDeal(f, g, 'trade');
    else if (!r.alliance && dealValue(f, g, 'alliance') > 10 && dealValue(g, f, 'alliance') > 10 && rng() < 0.1) applyDeal(f, g, 'alliance');
  }
  // Swallow a broken neighbour whole if it will kneel
  for (const g of neighbourFactions(f)) {
    if (g === 'rebels' || isHuman(g) || !G.factions[g].alive) continue;
    if (dealValue(f, g, 'submit') > 0 && rng() < 0.3) { applyDeal(f, g, 'submit'); return; }
  }
  // War on a weaker neighbour
  if (G.turn < 2) return;
  const T = temper(f), wars = realWars(f);
  const few = nationsLeft().length <= 3; // the endgame: fewer rivals, bolder rulers
  if (wars.length >= 2 || rng() > T.war * (few ? 0.4 : 0.18)) return;
  // Never open a second front against a war that is not going well
  if (wars.some(g => factionPower(g) + 40 > (my - 40) * 0.8)) return;
  const cap = G.provinces[G.factions[f].capital];
  if (cap && threatNear(f, cap.id) > guardOf(cap, f)) return;
  let best = null, bs = 0;
  for (const g of neighbourFactions(f)) {
    if (g === 'rebels' || !G.factions[g].alive) continue;
    const r = rel(f, g);
    if (r.war || (r.alliance && !few) || r.truce > 0 || (r.married && r.att > -40 && !few)) continue;
    // The great powers beyond Turan are busy with their own world: they turn on Turan late, and rarely
    const farOnNear = FACTIONS[f].far && !FACTIONS[g].far;
    if (farOnNear && G.turn < 30) continue;
    const ratio = my / (factionPower(g) + 40);
    const busy = POWERS.filter(x => x !== g && G.factions[x].alive && rel(g, x).war).length; // pile on a ruler already at war
    const s = ratio * T.war - r.att / (few ? 150 : 50) - (isHuman(g) ? 0 : 0.1) + busy * 0.25 - (farOnNear ? 0.5 : 0);
    if (ratio > (few ? 0.9 : 1.35) && s > bs) { bs = s; best = g; }
  }
  if (best && bs > (few ? 0.5 : 1.1)) declareWar(f, best);
}

// Reasons beyond war-weariness for a ruler to want peace with g
function aiPeaceNeed(f, g) {
  const T = temper(f), wars = realWars(f);
  let need = rel(f, g).warTurns < 5 ? -999 : (T.peace - 1) * 20;
  const cap = G.provinces[G.factions[f].capital];
  if (cap && (cap.siege || threatNear(f, cap.id) > guardOf(cap, f) * 1.2)) need = Math.max(need, 0) + 25;
  if (wars.length >= 2) {
    // fighting on two fronts: settle with whichever enemy is the smaller danger
    const danger = x => factionPower(x) * (neighbourFactions(f).has(x) ? 1 : 0.4);
    const worst = wars.slice().sort((x, y) => danger(y) - danger(x))[0];
    if (worst !== g) need += 20;
  }
  // far from each other: a war of no use to anyone
  if (!neighbourFactions(f).has(g) && !armiesOf(f).some(a => G.provinces[a.prov].owner === g)) need += 8;
  return need;
}

// Proposals the AI makes to the player (at most one per turn across all rivals).
async function aiOffers(f) {
  // In a hot-seat game the offer goes to one of the human rulers
  const pl = G.humans ? pick(humansAlive()) : G.player;
  if (!pl || !G.factions[pl].alive || G.offerTurn === G.turn) return;
  const r = rel(f, pl);
  const chance = rng();
  let type = null, gold = 0, city = null;
  const special = aiSpecialOffer(f, chance, pl);
  if (special) {
    G.offerTurn = G.turn;
    await HOOKS.focus(pl);
    const yes = await HOOKS.offer({ from: f, type: special.type, gold: 0, city: special.city && special.city.id, enemy: special.enemy });
    answerSpecialOffer(f, special, yes, pl);
    return;
  }
  if (dealValue(pl, f, 'submit') > 12 && chance < 0.4) type = 'yield';
  else if (r.war && r.warTurns > 3 && dealValue(pl, f, 'peace') > 10 && chance < 0.35) type = 'peace';
  else if (!r.war && !r.trade && r.att > -5 && chance < 0.08) type = 'trade';
  else if (!r.war && !r.alliance && r.att > 35 && chance < 0.08) type = 'alliance';
  else if (!r.war && !r.married && r.att > 20 && chance < 0.04) type = 'marriage';
  else if (!r.war && r.att > -5 && chance < 0.1 && (city = provsOf(pl).filter(p => p.adj.some(n => G.provinces[n].owner === f) && G.factions[pl].capital !== p.id && p.pop < 25).sort((a, b) => a.pop - b.pop)[0]) && G.factions[f].gold > cityPrice(city) * 1.2) type = 'buycity';
  else if (!r.war && (factionPower(f) + 40) / (factionPower(pl) + 40) > 2.2 && neighbourFactions(f).has(pl) && chance < 0.06 * temper(f).war * (temper(f).greedy ? 1.8 : 1)) type = 'tribute';
  if (!type) return;
  G.offerTurn = G.turn;
  if (type === 'tribute') gold = tributeAmount(pl);
  if (type === 'buycity') gold = Math.round(cityPrice(city) * 1.15 / 50) * 50;
  await HOOKS.focus(pl);
  const yes = await HOOKS.offer({ from: f, type, gold, city: city && city.id });
  if (yes) {
    if (type === 'buycity') { G.factions[f].gold -= gold; G.factions[pl].gold += gold; r.att += 8; transferProvince(city, f, 15); }
    else if (type === 'tribute') applyDeal(f, pl, 'tribute');
    else if (type === 'yield') applyDeal(pl, f, 'submit');
    else applyDeal(f, pl, type);
  } else {
    r.att -= type === 'tribute' ? 5 : 3;
    if (type === 'tribute' && rng() < AGGRESSION[f] * 0.6) declareWar(f, pl);
  }
}

// ---------- Economy ----------

function aiBuild(f) {
  const st = G.factions[f];
  const net = (st.lastIncome || factionIncome(f)) - factionUpkeep(f);
  let budget = st.gold - 600;
  const provs = provsOf(f).filter(p => !p.build && !p.siege).sort((a, b) => b.pop - a.pop);
  for (const p of provs) {
    if (budget < 300) break;
    const order = provinceOrder(p, distancesFrom(f));
    if (order < 35 && !decreeCheck(p, 'feast') && st.gold > 800) issueDecree(p, 'feast');
    if (wonderHere(p) && !wonderCheck(p) && budget > WONDERS[wonderHere(p)].cost + 1200) { budget -= WONDERS[wonderHere(p)].cost; startWonder(p); continue; }
    const want = buildWishes(p, f);
    for (const k of want) {
      if (buildCheck(p, k)) continue;
      const cost = buildCost(p, k, p.b[k] + 1);
      if (cost > budget || (net < 0 && k !== 'market' && k !== 'farms')) continue;
      startBuild(p, k);
      budget -= cost;
      break;
    }
  }
}

function aiRecruit(f) {
  const st = G.factions[f], F = FACTIONS[f];
  const income = st.lastIncome || factionIncome(f);
  let upkeep = factionUpkeep(f);
  const atWarNow = POWERS.some(g => g !== f && G.factions[g].alive && rel(f, g).war) || neighbourFactions(f).has('rebels');
  const limit = income * (atWarNow ? 0.85 : 0.6) + Math.max(0, st.gold - 1500) / 8;
  const prefs = F.nomad ? PREFS.nomad : PREFS.settled;
  const capId = st.capital;
  const dz = {};
  const danger = p => p.id in dz ? dz[p.id] : (dz[p.id] = frontier(p) ? Math.max(0, (p.id === capId ? 2 : 1) * threatNear(f, p.id, 1) - guardOf(p, f)) : 0);
  const provs = provsOf(f).filter(p => !p.siege && p.queue.length < 2)
    .sort((a, b) => (danger(b) - danger(a)) || (frontier(b) - frontier(a)) || (b.b.barracks + b.b.stables) - (a.b.barracks + a.b.stables));
  let guard = 0;
  for (const p of provs) {
    if (guard++ > 6) break;
    const options = recruitable(p).filter(t => prefs[t]);
    if (!options.length) continue;
    for (let k = 0; k < 2; k++) {
      if (upkeep > limit || st.gold < 500) return;
      let total = 0;
      for (const t of options) total += prefs[t];
      let r = rng() * total, type = options[0];
      for (const t of options) { r -= prefs[t]; if (r <= 0) { type = t; break; } }
      if (unitCost(f, type) > st.gold - 300) continue;
      if (recruit(p, type)) break;
      upkeep += unitUpkeep(type, F.nomad);
    }
  }
}

// ---------- Armies ----------

function passable(f, pid) {
  const o = G.provinces[pid].owner;
  return o === f || allied(f, o) || atWar(f, o);
}

// Breadth-first search for a route; returns the list of provinces after the start.
function route(f, from, to, maxLen = 8) {
  if (from === to) return [];
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const c = q.shift();
    for (const n of G.provinces[c].adj) {
      if (prev[n] !== undefined || !passable(f, n)) continue;
      prev[n] = c;
      if (n === to) {
        const path = [n];
        let k = c;
        while (k !== from) { path.unshift(k); k = prev[k]; }
        return path.length <= maxLen ? path : null;
      }
      // Do not route through enemy land (it would stop us); only end there
      if (G.provinces[n].owner === f || allied(f, G.provinces[n].owner)) q.push(n);
    }
  }
  return null;
}

function defendersPower(p, f) {
  let s = 0;
  for (const a of armiesIn(p.id)) if (atWar(a.owner, f)) s += armyPower(a);
  if (p.b.walls) {
    for (const u of cityWatch(p)) s += unitPower(u);
    s *= 1 + 0.3 * p.b.walls;
  }
  return s;
}

function targetValue(p, f, busy) {
  let v = 10 + p.pop * 0.6 + (p.silk ? 12 : 0) + p.b.market * 5;
  if (p.owner !== 'rebels' && G.factions[p.owner].capital === p.id) v += 20;
  // Rebels can wait while a real enemy is in the field, unless they sit in the middle of our land
  if (p.owner === 'rebels') v *= busy && !p.adj.every(n => G.provinces[n].owner === f || G.provinces[n].owner === 'rebels') ? 0.5 : 1.1;
  // A city an enemy army uses as a base against us
  if (p.owner !== 'rebels' && p.adj.some(n => G.provinces[n].owner === f) && armiesIn(p.id).some(a => a.owner === p.owner)) v += 8;
  if (FACTIONS[f].nomad && (p.terrain === 'steppe')) v += 8;
  return v;
}

async function aiArmies(f) {
  // Merge armies that share a province
  const byProv = {};
  for (const a of armiesOf(f)) (byProv[a.prov] = byProv[a.prov] || []).push(a);
  for (const pid in byProv) {
    const list = byProv[pid].sort((x, y) => armyPower(y) - armyPower(x));
    for (let i = 1; i < list.length; i++) if (G.armies[list[i].id] && G.armies[list[0].id]) mergeArmies(list[0], list[i]);
  }

  const enemyProvs = Object.values(G.provinces).filter(p => atWar(f, p.owner) && p.owner !== f);
  const armies = armiesOf(f).sort((x, y) => armyPower(y) - armyPower(x));
  const claimed = new Set(), done = new Set(), rally = {};
  const T = temper(f), busy = realWars(f).length > 0;

  // The capital first: if an enemy host is coming, the nearest armies march home to meet it
  const cap = G.provinces[G.factions[f].capital];
  if (cap && cap.owner === f && !cap.siege) {
    let need = threatNear(f, cap.id) * 1.1 - guardOf(cap, f);
    if (need > 0) {
      const near = armies.filter(a => a.prov !== cap.id && !a.besieging && !G.provinces[a.prov].siege)
        .map(a => ({ a, path: route(f, a.prov, cap.id, 3) })).filter(x => x.path && x.path.every(n => G.provinces[n].owner === f || n === cap.id))
        .sort((x, y) => x.path.length - y.path.length);
      for (const { a, path } of near) {
        if (need <= 0) break;
        done.add(a.id);
        need -= armyPower(a);
        for (const step of path) {
          if (!G.armies[a.id] || a.moves <= 0) break;
          const res = await moveArmy(a, step);
          if (!res.ok || res.kind !== 'move') break;
        }
      }
    }
  }

  for (const a of armies) {
    if (!G.armies[a.id] || G.over || done.has(a.id)) continue;
    done.add(a.id);
    const here = G.provinces[a.prov];
    // Sieges: storm the walls when the odds are good, otherwise starve them out
    if (a.besieging) {
      const b = assaultBattle(a.prov, f);
      if (b && battleOdds(b) > 0.68) await assault(a.prov, f);
      continue;
    }
    // Besieged at home: break out if strong enough
    if (here.siege && here.owner === f) {
      const b = sallyBattle(here.id);
      if (b && battleOdds(b) > 0.6) await sally(here.id);
      continue;
    }
    const power = armyPower(a);
    // Keep a garrison in threatened home provinces
    if (here.owner === f && frontier(here)) {
      const threat = here.adj.reduce((s, n) => s + armiesIn(n).filter(o => atWar(o.owner, f)).reduce((t, o) => t + armyPower(o), 0), 0);
      const others = armiesIn(here.id).filter(o => o.owner === f && o !== a).length;
      if (threat > power * 0.6 && !others && power < threat * 1.6) continue;
    }
    // Called to join a bigger army for a campaign
    if (rally[a.id]) {
      const path = route(f, a.prov, rally[a.id], 4);
      if (path) for (const step of path) {
        if (!G.armies[a.id] || a.moves <= 0) break;
        const res = await moveArmy(a, step);
        if (!res.ok || res.kind !== 'move') break;
      }
      continue;
    }
    if (power < 12) continue; // too small to campaign; stays as garrison
    let best = null, bs = 0, bestPath = null, wish = null, ws = 0;
    for (const p of enemyProvs) {
      if (claimed.has(p.id) && p.b.walls === 0) continue;
      const d = Math.hypot(p.x - here.x, p.y - here.y);
      if (d > 420) continue;
      const path = route(f, a.prov, p.id, 6);
      if (!path) continue;
      const def = defendersPower(p, f);
      const ratio = power / (def + 1);
      const val = targetValue(p, f, busy) / (path.length + 1);
      if (ratio < T.nerve) { if (ratio > 0.45 && val > ws) { ws = val; wish = { p, def }; } continue; }
      const s = val * Math.min(2, ratio);
      if (s > bs) { bs = s; best = p; bestPath = path; }
    }
    // Too weak alone for the city it wants: gather the armies nearby before marching
    if (!best && wish && here.owner === f) {
      let sum = power;
      const helpers = armies.filter(b => G.armies[b.id] && !done.has(b.id) && !rally[b.id] && !b.besieging && G.provinces[b.prov].owner === f && !G.provinces[b.prov].siege)
        .map(b => ({ b, path: route(f, b.prov, a.prov, 3) })).filter(x => x.path).sort((x, y) => x.path.length - y.path.length);
      const call = [];
      for (const { b } of helpers) { if (sum >= (wish.def + 1) * (T.nerve + 0.15)) break; call.push(b); sum += armyPower(b); }
      if (sum >= (wish.def + 1) * (T.nerve + 0.15) && call.length) {
        for (const b of call) rally[b.id] = a.prov;
        continue; // wait here for them
      }
    }
    if (!best) {
      // In enemy land with nothing to storm: plunder the countryside
      if (!raidCheck(a) && rng() < 0.8) { raid(a); continue; }
      // Nothing to attack: drift towards the frontier
      if (here.owner === f && !frontier(here)) {
        const step = here.adj.find(n => G.provinces[n].owner === f && frontier(G.provinces[n]));
        if (step) await moveArmy(a, step);
      }
      continue;
    }
    claimed.add(best.id);
    for (const step of bestPath) {
      if (!G.armies[a.id] || a.moves <= 0) break;
      const res = await moveArmy(a, step);
      if (!res.ok || res.kind !== 'move') break;
    }
  }
}

async function rebelTurn() {
  for (const p of Object.values(G.provinces)) {
    if (p.owner !== 'rebels') continue;
    if (p.siege) {
      const b = sallyBattle(p.id);
      if (b && battleOdds(b) > 0.6) await sally(p.id);
      continue;
    }
    if (!armiesIn(p.id).some(a => a.owner === 'rebels') && rng() < 0.08) addArmy('rebels', p.id, ['militia'], null);
  }
}
