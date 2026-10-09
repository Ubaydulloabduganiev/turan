'use strict';
// Rivers and seas. An army that attacks across one of the great rivers must fight its way over the water.
// Armies in a port on the Caspian, the Aral Sea or Lake Balkhash can hire boats and sail to any other shore
// of the same water; an enemy army waiting in another port may row out to meet them, and then the battle
// is fought on the water itself.

// ---------- Rivers ----------

const RIVER_PTS = {};
function riverPoints(r) { return RIVER_PTS[r.name] || (RIVER_PTS[r.name] = r.pts.map(([lon, lat]) => project(lon, lat))); }
function segCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
// The great river between two neighbouring provinces, if any (the line between their cities crosses it)
const RIVER_CACHE = {};
function riverBetween(from, to) {
  if (!from || !to || from === to) return null;
  const k = from < to ? from + '|' + to : to + '|' + from;
  if (k in RIVER_CACHE) return RIVER_CACHE[k];
  const A = G.provinces[from], B = G.provinces[to];
  let found = null;
  for (const r of RIVERS) {
    if (r.w < 2.2) continue; // only the great rivers stop an army
    const pts = riverPoints(r);
    for (let i = 0; i < pts.length - 1 && !found; i++) if (segCross(A, B, pts[i], pts[i + 1])) found = r.name;
    if (found) break;
  }
  return (RIVER_CACHE[k] = found);
}

// ---------- Seas ----------

const SEA_NAME = { 'Kara-Bogaz': 'Caspian Sea' };
let SEAS = null;
// { sea name: [coastal province ids] }
function seas() {
  if (SEAS) return SEAS;
  const out = {};
  MAPDATA.sites.forEach((s, i) => {
    if (s.kind !== 'water') return;
    const name = SEA_NAME[s.name] || s.name;
    for (const j of MAPDATA.adj[i]) {
      const q = MAPDATA.sites[j];
      if (q.kind === 'province' && G.provinces[q.id]) (out[name] = out[name] || new Set()).add(q.id);
    }
  });
  SEAS = {};
  for (const k in out) SEAS[k] = [...out[k]];
  return SEAS;
}
const seasAt = pid => Object.keys(seas()).filter(k => seas()[k].includes(pid));
const sailCost = a => a.units.length * 30;

function sailCheck(a) {
  const p = G.provinces[a.prov];
  if (!seasAt(a.prov).length) return 'This province has no shore';
  if (a.besieging) return 'The army is besieging a city';
  if (a.moves < armyMoves(a)) return 'The army must not have marched this turn';
  if (p.owner !== a.owner && !allied(a.owner, p.owner)) return 'Boats can only be hired in your own or an ally’s port';
  if (G.factions[a.owner].gold < sailCost(a)) return 'Not enough gold';
  return null;
}
// Where the army could sail: [{ prov, sea, kind: 'move' | 'land' | 'blocked' }]
function sailTargets(a) {
  const out = [];
  for (const sea of seasAt(a.prov)) {
    for (const pid of seas()[sea]) {
      if (pid === a.prov) continue;
      const q = G.provinces[pid], o = q.owner;
      const hostile = atWar(a.owner, o) || armiesIn(pid).some(x => atWar(x.owner, a.owner));
      const kind = o === a.owner || allied(a.owner, o) ? (hostile ? 'land' : 'move') : hostile ? 'land' : o === 'rebels' ? 'land' : 'blocked';
      out.push({ prov: pid, sea, kind });
    }
  }
  return out;
}

// The enemy army that could row out from another port of the same water, if any
function interceptor(a, sea, to) {
  let best = null, bp = 0;
  for (const pid of seas()[sea]) {
    if (pid === a.prov) continue;
    for (const x of armiesIn(pid)) {
      if (!atWar(x.owner, a.owner) || x.besieging) continue;
      const pw = armyPower(x);
      if (pw > bp) { bp = pw; best = x; }
    }
  }
  return best;
}

// Sails the army; may end in a battle on the water, a landing battle, or a quiet crossing.
// opts.fight: the player fights any battle themselves. Returns { ok, why, naval, result, landed }
async function sailArmy(a, to, opts = {}) {
  const why = sailCheck(a);
  if (why) return { ok: false, why };
  const t0 = sailTargets(a).find(x => x.prov === to);
  if (!t0 || t0.kind === 'blocked') return { ok: false, why: 'peace' };
  const from = a.prov;
  G.factions[a.owner].gold -= sailCost(a);
  leaveSiege(a);
  a.moves = 0;
  const out = { ok: true, sea: t0.sea };
  // An enemy fleet may come out to meet them
  const x = interceptor(a, t0.sea, to);
  if (x && rng() < 0.55) {
    const b = makeBattle([a], [x], to, 'naval');
    b.sea = t0.sea; b.from = from; b.port = x.prov;
    out.naval = b;
    out.before = { att: menOf(b.att), def: menOf(b.def) };
    const c = opts.choose ? await opts.choose(b, 'naval') : null;
    out.result = await runBattle(b, { ...opts, fight: c === 'fight' });
    if (out.result.winner !== 'att' || !G.armies[a.id]) return out; // beaten back to port, or sunk
  }
  // Landing
  a.moves = 1;
  const r = await moveArmyBySea(a, to, opts);
  a.moves = 0;
  out.landed = r;
  return out;
}
// The last stretch: the army steps ashore like a march into the province
async function moveArmyBySea(a, to, opts) {
  const dest = G.provinces[to];
  const from = a.prov;
  const kind = movePreview(a, to);
  a.prov = to; a.from = null;
  await HOOKS.march(a, from, to);
  if (kind === 'move') return { kind };
  if (kind === 'battle') {
    const enemies = armiesIn(to).filter(x => atWar(x.owner, a.owner));
    const b = makeBattle([a], enemies, to, 'field');
    const before = { att: menOf(b.att), def: menOf(b.def) };
    const c = opts.choose ? await opts.choose(b, 'landing') : null;
    return { kind, battle: b, before, result: await runBattle(b, { ...opts, fight: c === 'fight' }) };
  }
  if (kind === 'siege') { if (!dest.siege) startSiege(dest, a.owner); else if (dest.siege.by === a.owner) a.besieging = true; return { kind }; }
  captureProvince(dest, a.owner, a, opts.mode);
  return { kind: 'capture' };
}

// After a battle on the water: the loser is driven back to port (or drowned); no one takes a province
function finishNaval(b, res) {
  const W = res.winner === 'att' ? b.att : b.def, L = res.winner === 'att' ? b.def : b.att;
  const wf = W.faction, lf = L.faction;
  for (const id of W.armies) { const a = G.armies[id]; if (a) for (const u of a.units) u.exp = Math.min(3, u.exp + (rng() < 0.6 ? 1 : 0)); }
  const wg = sideGeneral(W);
  if (wg && wg.cmd < 6 && rng() < 0.35) wg.cmd++;
  G.stats[wf] && G.stats[wf].won++;
  G.stats[lf] && G.stats[lf].lost++;
  // Men in the water drown
  for (const id of L.armies) { const a = G.armies[id]; if (a) for (const u of a.units) u.men = Math.round(u.men * (res.rout ? 0.6 : 0.85)); }
  for (const id of b.att.armies.concat(b.def.armies)) { const a = G.armies[id]; if (a) cleanArmy(a); }
  if (L === b.att) for (const id of L.armies) { const a = G.armies[id]; if (a) { a.prov = b.from; a.moves = 0; } }
  const text = t('{nation} won the battle on the {sea}.', { nation: fName(wf), sea: geoName(b.sea) });
  log(() => dateText() + ': ' + t('battle on the {sea}: {nation} against {nation2}. {nation3} won.', { sea: geoName(b.sea), nation: fName(b.att.faction), nation2: fName(b.def.faction), nation3: fName(wf) }), isHuman(wf) || isHuman(lf) ? 'battle' : '');
  return { text, wf, lf };
}
