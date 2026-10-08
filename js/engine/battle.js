'use strict';
// Battles: who fights, auto-resolve, and what happens afterwards (retreat, capture, promotion).

// The townsfolk who man the walls when no army is inside.
function cityWatch(p) {
  const units = [];
  for (let i = 0; i < p.b.walls; i++) units.push(makeUnit('militia'));
  if (p.pop >= 20 && p.b.walls) units.push(makeUnit('archer'));
  return units;
}

// kind: 'field' (open battle), 'assault' (attackers storm the walls), 'sally' (besieged garrison attacks)
function makeBattle(attArmies, defArmies, prov, kind) {
  const p = G.provinces[prov];
  const b = {
    prov, kind, walls: kind === 'assault' ? p.b.walls : 0, terrain: p.terrain,
    att: { faction: attArmies[0].owner, armies: attArmies.map(a => a.id), extra: [] },
    def: { faction: defArmies.length ? defArmies[0].owner : p.owner, armies: defArmies.map(a => a.id), extra: [] },
  };
  if (kind === 'assault' && (p.owner === b.def.faction) && !defArmies.length) b.def.extra = cityWatch(p);
  else if (kind === 'assault' && p.owner === b.def.faction) b.def.extra = cityWatch(p).slice(0, 1);
  return b;
}

function sideUnits(side) {
  const list = [];
  for (const id of side.armies) { const a = G.armies[id]; if (a) for (const u of a.units) list.push({ u, a }); }
  for (const u of side.extra) list.push({ u, a: null });
  return list;
}
function sideGeneral(side) {
  let best = null;
  for (const id of side.armies) { const a = G.armies[id]; if (a && a.general && (!best || a.general.cmd > best.cmd)) best = a.general; }
  return best;
}

function share(list, pred) {
  let n = 0, t = 0;
  for (const { u } of list) { t += u.men; if (pred(UNITS[u.type])) n += u.men; }
  return t ? n / t : 0;
}

function sidePower(b, side, other, isDef) {
  const mine = sideUnits(side), theirs = sideUnits(other);
  const enemyCav = share(theirs, d => d.cls === 'cav'), enemyHa = share(theirs, d => d.cls === 'ha');
  const enemySpear = share(theirs, d => d.cls === 'spear');
  const terrain = b.terrain;
  let s = 0, hasSiege = false;
  for (const { u } of mine) {
    const d = UNITS[u.type];
    let v = unitPower(u);
    if (d.cls === 'ha') v *= terrain === 'steppe' || terrain === 'desert' ? 1.25 : terrain === 'mountain' ? 0.8 : 1;
    if (d.cls === 'cav') v *= (terrain === 'mountain' ? 0.75 : terrain === 'steppe' ? 1.1 : 1) * (1 - 0.35 * enemySpear);
    if (d.cls === 'spear') v *= 1 + 0.6 * enemyCav + 0.1 * enemyHa;
    if (d.cls === 'inf' && terrain === 'mountain') v *= 1.2;
    if (d.cls === 'missile' && isDef && b.walls) v *= 1.25;
    if (d.cls === 'siege') { hasSiege = true; v *= 0.5; }
    if (b.walls && !isDef && (d.cls === 'cav' || d.cls === 'ha')) v *= 0.7; // horses do not climb walls
    s += v;
  }
  const g = sideGeneral(side);
  s *= (1 + 0.07 * (g ? g.cmd : 0)) * traitBattle(g, isDef);
  return { power: s, hasSiege };
}

function battlePowers(b) {
  const A = sidePower(b, b.att, b.def, false), D = sidePower(b, b.def, b.att, true);
  let dp = D.power;
  if (b.walls) dp *= 1 + (A.hasSiege ? 0.15 : 0.4) * b.walls;
  return { att: A.power, def: dp };
}

// Odds the attacker wins, used by the AI and shown to the player before a battle.
function battleOdds(b) {
  const { att, def } = battlePowers(b);
  if (def <= 0) return 1;
  const r = att / def;
  return clampN(0.5 + 0.5 * Math.tanh(1.6 * Math.log(r)), 0.01, 0.99);
}

function applyLosses(list, frac) {
  for (const { u } of list) {
    const f = clampN(frac * (0.7 + rng() * 0.6), 0, 1);
    u.men = Math.max(0, Math.round(u.men * (1 - f)));
  }
}

function autoResolve(b) {
  const { att, def } = battlePowers(b);
  const ra = att * (0.8 + rng() * 0.4), rd = def * (0.8 + rng() * 0.4);
  const winner = ra >= rd ? 'att' : 'def';
  const R = winner === 'att' ? ra / Math.max(rd, 0.01) : rd / Math.max(ra, 0.01);
  const loserFrac = clampN(0.3 + 0.22 * (R - 1), 0.3, 0.92);
  const winnerFrac = clampN(0.32 / R, 0.04, 0.4) + (b.walls && winner === 'att' ? 0.08 : 0);
  const W = winner === 'att' ? b.att : b.def, L = winner === 'att' ? b.def : b.att;
  applyLosses(sideUnits(W), winnerFrac);
  applyLosses(sideUnits(L), loserFrac);
  return { winner, rout: R > 2.6 };
}

function menOf(side) { let n = 0; for (const { u } of sideUnits(side)) n += u.men; return n; }

// Removes wiped-out units, kills generals whose guard fell, and deletes empty armies.
function cleanArmy(a) {
  a.units = a.units.filter(u => u.men >= Math.max(5, UNITS[u.type].men * 0.08));
  if (a.general && !a.units.some(u => u.type === 'general')) {
    generalDied(a, 'battle');
  }
  if (!a.units.length) delete G.armies[a.id];
}

function generalDied(a, how) {
  const g = a.general;
  a.general = null;
  const text = how === 'age' ? t('{name} died of old age at {n}.', { name: pn(g.name), n: g.age }) : t('{name} fell in battle.', { name: pn(g.name) });
  log(text, 'big');
  if (g.leader) succession(a.owner);
  if (a.owner === G.player) HOOKS.notify({ title: t(g.leader ? 'Our ruler is dead' : 'A general has died'), text });
}

function succession(f) {
  const st = G.factions[f], F = FACTIONS[f];
  const old = st.leader;
  // The heir takes over: an existing general with the heir's name, or else the best general alive.
  let next = Object.values(G.armies).find(a => a.owner === f && a.general && a.general.name === st.heir);
  if (!next) next = armiesOf(f).filter(a => a.general).sort((x, y) => y.general.cmd - x.general.cmd)[0];
  if (next) { next.general.leader = true; st.leader = next.general.name; }
  else st.leader = st.heir || newGeneralName(f);
  const son = Object.values(G.people || {}).filter(x => x.faction === f && !x.female && x.father === st.leader && x.name !== st.leader).sort((x, y) => x.born - y.born)[0];
  st.heir = son ? son.name : newGeneralName(f);
  st.orderBonus = -10; st.orderBonusT = 4;
  if (f === G.player) {
    G.rulers = G.rulers || [{ name: old, from: 0 }];
    G.rulers[G.rulers.length - 1].to = G.turn;
    G.rulers.push({ name: st.leader, from: G.turn });
    HOOKS.notify({ scene: { kind: 'coronation', f, old } });
  }
  successionTrouble(f);
  log(t('{name} succeeds {name2} as ruler of the {nation}.', { name: pn(st.leader), name2: pn(old), nation: fFull(f) }), 'big');
}

// Where a beaten army can fall back to: an adjacent province of its own or an ally's, free of enemies.
function retreatTarget(a, avoid) {
  const p = G.provinces[a.prov];
  const options = p.adj.filter(n => n !== avoid && allied(a.owner, G.provinces[n].owner) &&
    !armiesIn(n).some(o => atWar(o.owner, a.owner)));
  if (!options.length) return null;
  options.sort((x, y) => (G.provinces[y].owner === a.owner) - (G.provinces[x].owner === a.owner));
  return options[0];
}

// Applies the consequences of a battle whose casualties are already done. Returns a short text.
function finishBattle(b, res) {
  const p = G.provinces[b.prov];
  const W = res.winner === 'att' ? b.att : b.def, L = res.winner === 'att' ? b.def : b.att;
  const wf = W.faction, lf = L.faction;
  const before = { w: menOf(W), l: menOf(L) };
  for (const id of W.armies) { const a = G.armies[id]; if (!a) continue; for (const u of a.units) u.exp = Math.min(3, u.exp + (rng() < 0.6 ? 1 : 0)); }
  const wg = sideGeneral(W);
  if (wg && wg.cmd < 6 && rng() < 0.35) { wg.cmd++; }
  G.stats[wf] && G.stats[wf].won++;
  G.stats[lf] && G.stats[lf].lost++;
  for (const id of b.att.armies.concat(b.def.armies)) { const a = G.armies[id]; if (a) cleanArmy(a); }
  // The loser falls back or is destroyed.
  for (const id of L.armies) {
    const a = G.armies[id];
    if (!a) continue;
    if (b.kind === 'assault' && L === b.def) { delete G.armies[id]; continue; } // a stormed garrison dies or surrenders
    if (b.kind === 'sally' && L === b.att) { if (res.rout) delete G.armies[id]; continue; } // beaten back inside the walls
    if (b.kind === 'sally' && L === b.def) { a.besieging = false; }
    const to = res.rout ? null : retreatTarget(a, null);
    if (to) { a.prov = to; a.moves = 0; a.besieging = false; } else delete G.armies[id];
  }
  let text = t(res.rout ? '{nation} won the battle at {city} — the enemy was routed.' : '{nation} won the battle at {city}.', { nation: fName(wf), city: cityOf(p) });
  log(dateText() + ': ' + t('battle at {city}: {nation} attacked {nation2}. {nation3} won.', { city: cityOf(p), nation: fName(b.att.faction), nation2: fName(b.def.faction), nation3: fName(wf) }), wf === G.player || lf === G.player ? 'battle' : '');
  // An attacker who wins in an enemy province takes or besieges it.
  if (res.winner === 'att' && atWar(wf, p.owner) && p.owner !== wf) {
    const att = b.att.armies.map(id => G.armies[id]).filter(Boolean);
    if (att.length) {
      if (b.kind === 'assault' || p.b.walls === 0) {
        captureProvince(p, wf, att[0]);
      } else if (!p.siege) {
        startSiege(p, wf);
      }
    }
  }
  if (b.kind === 'sally' && res.winner === 'att') {
    p.siege = null;
    for (const a of armiesIn(p.id)) if (a.owner !== p.owner) a.besieging = false;
  }
  return { text, wf, lf };
}

function startSiege(p, by) {
  p.siege = { by, turns: 0 };
  for (const a of armiesIn(p.id)) if (a.owner === by) a.besieging = true;
  log(t('{nation} lays siege to {city}.', { nation: fName(by), city: cityOf(p) }), by === G.player || p.owner === G.player ? 'battle' : '');
  if (p.owner === G.player) HOOKS.notify({ title: t('{city} besieged', { city: cityOf(p) }), text: t('The {nation} army has surrounded {city}. It will hold out for about {n} more turns.', { nation: fAdj(by), city: cityOf(p), n: siegeTurns(p) }), prov: p.id });
}
function siegeTurns(p) {
  let t = 1 + p.b.walls * 2;
  const att = armiesIn(p.id).filter(a => p.siege && a.owner === p.siege.by);
  if (att.some(a => a.units.some(u => UNITS[u.type].cls === 'siege'))) t = Math.ceil(t / 2);
  return Math.max(1, t - (p.siege ? p.siege.turns : 0));
}

// mode: 'occupy' or 'sack'
function captureProvince(p, by, army, mode) {
  const old = p.owner;
  mode = mode || (by === G.player ? 'occupy' : (rng() < AGGRESSION[by] * 0.25 ? 'sack' : 'occupy'));
  if (by === G.player && p.b.walls >= 3 && !turnBusy) feat('storm'); // taken by assault, not starved out
  p.owner = by;
  p.siege = null; p.queue = []; p.build = null;
  for (const a of armiesIn(p.id)) { if (a.owner === old) delete G.armies[a.id]; else a.besieging = false; }
  p.unrest = 35;
  for (const k of BUILDING_ORDER) if (p.b[k] > 0 && rng() < 0.25) p.b[k]--;
  let loot = Math.round(p.pop * 8 * GAME.INCOME);
  if (mode === 'sack') { loot = Math.round(p.pop * 25 * GAME.INCOME); p.pop *= 0.8; p.unrest = 55; p.sacked = 6; }
  if (by !== 'rebels') G.factions[by].gold += loot;
  G.stats[by] && G.stats[by].taken++;
  const wasCap = old !== 'rebels' && G.factions[old].capital === p.id;
  if (by === G.player && (wasCap || p.pop >= 25 || wonderHere(p) || landmarkIn(p.id))) HOOKS.notify({ scene: { kind: 'conquest', prov: p.id, from: old, sack: mode === 'sack', capital: wasCap } });
  if (wasCap) {
    const rest = provsOf(old).sort((x, y) => y.pop - x.pop);
    G.factions[old].capital = rest.length ? rest[0].id : null;
  }
  log(dateText() + ': ' + t(mode === 'sack' ? '{nation} sacked {city} from {nation2}.' : '{nation} captured {city} from {nation2}.', { nation: fName(by), city: cityOf(p), nation2: fName(old) }), by === G.player || old === G.player ? 'big' : '');
  if (old === G.player) HOOKS.notify({ title: t('{city} has fallen', { city: cityOf(p) }), text: t('{city} has been taken by the {nation}.', { city: cityOf(p), nation: fFull(by) }), prov: p.id });
  if (old !== 'rebels') checkFactionAlive(old);
  if (by !== 'rebels') {
    const r = old !== 'rebels' ? rel(by, old) : null;
    if (r) r.att -= 10;
  }
  return loot;
}
