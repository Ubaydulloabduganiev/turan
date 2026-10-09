'use strict';
// Standing orders for a large realm: armies that march for several turns towards a far city, and cities
// run by a governor who builds and keeps the peace on his own.

// ---------- March orders ----------

// The way to a far province: through our own and allied land, ending anywhere we may enter.
function orderPath(a, pid) {
  if (a.prov === pid) return [];
  const f = a.owner, prev = { [a.prov]: null }, q = [a.prov];
  const open = id => { const o = G.provinces[id].owner; return o === f || allied(f, o); };
  while (q.length) {
    const c = q.shift();
    for (const n of G.provinces[c].adj) {
      if (n in prev) continue;
      const o = G.provinces[n].owner;
      if (!open(n) && n !== pid) continue;
      if (n === pid && !open(n) && !atWar(f, o)) continue; // a march may not start a war on its own
      prev[n] = c;
      if (n === pid) { const path = []; for (let k = n; k !== a.prov; k = prev[k]) path.unshift(k); return path; }
      q.push(n);
    }
  }
  return null;
}

// Turns needed to get there (the last step may be a battle)
function orderTurns(a, path) { return Math.max(1, Math.ceil(path.length / Math.max(1, armyMoves(a)))); }

function setMarch(a, pid) {
  const path = orderPath(a, pid);
  if (!path || !path.length) return null;
  a.dest = pid;
  return path;
}
function cancelMarch(a) { delete a.dest; }

// Moves an army with an order as far as it can go in peace. It stops before a battle or a siege and
// leaves that choice to its ruler. Returns what happened, for the ruler's attention list.
async function followArmy(a) {
  if (!a.dest || !G.armies[a.id]) return null;
  if (a.besieging) { delete a.dest; return null; }
  const path = orderPath(a, a.dest);
  if (!path) { const prov = a.dest; delete a.dest; return { kind: 'blocked', army: a.id, prov }; }
  for (const step of path) {
    if (a.moves <= 0 || !G.armies[a.id]) break;
    if (movePreview(a, step) !== 'move') break;
    const r = await moveArmy(a, step);
    if (!r.ok || r.kind !== 'move') break;
  }
  if (!G.armies[a.id]) return null;
  if (a.prov === a.dest) { const prov = a.dest; delete a.dest; return { kind: 'arrived', army: a.id, prov }; }
  const next = orderPath(a, a.dest);
  if (next && next.length && movePreview(a, next[0]) !== 'move') {
    // The enemy is in reach: the order is done once the army stands next to him with moves to spare
    if (a.moves > 0) { delete a.dest; return { kind: 'contact', army: a.id, prov: next[0] }; }
  }
  return null;
}
async function followOrders(f) {
  const out = [];
  for (const a of armiesOf(f)) { const r = await followArmy(a); if (r) out.push(r); }
  return out;
}

// ---------- Governors ----------

// What a city should build next, most useful first (the computer rulers use the same list)
function buildWishes(p, f) {
  const st = G.factions[f], want = [];
  const order = provinceOrder(p, distancesFrom(f));
  if (p.id === st.capital) want.push('walls');
  if (order < 45) want.push('madrasa');
  if (frontier(p) && p.b.walls < 2) want.push('walls');
  if (p.pop >= 10) want.push('market');
  if (p.pop >= 15 && st.gold > 1500) want.push('library');
  want.push('farms');
  if (FACTIONS[f].nomad) want.push('stables', 'barracks'); else want.push('barracks', 'stables');
  want.push('madrasa', 'walls');
  return want;
}

// Each governed city spends from the treasury but always leaves a reserve. Returns what was done.
const GOV_RESERVE = 600;
function governTurn(f) {
  const st = G.factions[f], out = [];
  for (const p of provsOf(f).filter(x => x.gov).sort((x, y) => y.pop - x.pop)) {
    if (p.siege) continue;
    const order = provinceOrder(p, distancesFrom(f));
    if (order < 35 && !decreeCheck(p, 'feast') && st.gold - DECREES.feast.cost(p) > GOV_RESERVE) { issueDecree(p, 'feast'); out.push({ kind: 'feast', prov: p.id }); }
    if (p.build) continue;
    for (const k of buildWishes(p, f)) {
      if (buildCheck(p, k)) continue;
      if (st.gold - buildCost(p, k, p.b[k] + 1) < GOV_RESERVE) continue;
      if (!startBuild(p, k)) { out.push({ kind: 'build', prov: p.id, what: k }); break; }
    }
  }
  return out;
}

// ---------- The same troops again ----------

// Remembers what a city trained this turn, so it can be ordered again with one click later
function noteRecruit(p, type) {
  if (p.lastRecruitTurn !== G.turn) { p.lastRecruit = []; p.lastRecruitTurn = G.turn; }
  p.lastRecruit.push(type);
}
function repeatCost(p) { return (p.lastRecruit || []).reduce((s, u) => s + unitCost(p.owner, u), 0); }
function repeatCheck(p) {
  const list = p.lastRecruit || [];
  if (!list.length || p.lastRecruitTurn === G.turn) return 'Nothing to repeat';
  if (list.some(u => !recruitable(p).includes(u))) return 'This city can no longer train these troops';
  if (p.queue.length + list.length > QUEUE_MAX) return 'The training queue is full';
  if (G.factions[p.owner].gold < repeatCost(p)) return 'Not enough gold';
  return null;
}
function repeatRecruit(p) {
  const why = repeatCheck(p);
  if (why) return why;
  const list = p.lastRecruit.slice();
  for (const u of list) { const err = recruit(p, u); if (err) return err; noteRecruit(p, u); }
  return null;
}
