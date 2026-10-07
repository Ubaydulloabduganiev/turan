'use strict';
// End of turn: the AI factions act, then every faction collects taxes, finishes training and building,
// and towns grow, riot or revolt.

let turnBusy = false;

async function endTurn(onProgress) {
  if (turnBusy || G.over) return;
  turnBusy = true;
  try {
    for (const f of PLAYABLE) {
      if (f === G.player || !G.factions[f].alive) continue;
      if (onProgress) onProgress(f);
      await aiTurn(f);
      if (G.over) return;
    }
    if (onProgress) onProgress('rebels');
    await rebelTurn();
    upkeepPhase();
    G.turn++;
    for (const a of Object.values(G.armies)) a.moves = armyMoves(a);
    runEvents();
    comingOfAge();
    peopleComeOfAge();
    familyTurn();
    checkVictory();
  } finally {
    turnBusy = false;
  }
}

function upkeepPhase() {
  // Sieges grind on
  for (const p of Object.values(G.provinces)) {
    if (!p.siege) continue;
    const besiegers = armiesIn(p.id).filter(a => a.owner === p.siege.by && a.besieging);
    if (!besiegers.length || !atWar(p.siege.by, p.owner)) { p.siege = null; continue; }
    p.siege.turns++;
    // The garrison goes hungry
    for (const a of armiesIn(p.id)) if (a.owner === p.owner) for (const u of a.units) u.men = Math.round(u.men * 0.93);
    if (siegeTurns(p) <= 0 || p.siege.turns >= 1 + p.b.walls * 2 + 2) {
      log(t('{city} surrenders after a long siege.', { city: cityOf(p) }), p.owner === G.player || p.siege.by === G.player ? 'big' : '');
      captureProvince(p, p.siege.by, besiegers[0]);
    }
  }

  for (const f in G.factions) {
    const st = G.factions[f];
    if (!st.alive || f === 'rebels') continue;
    const dist = distancesFrom(f);
    let income = tradeIncome(f);
    for (const p of provsOf(f)) {
      const order = provinceOrder(p, dist);
      income += provinceIncome(p, order);
      growProvince(p, order);
      if (p.taxFree > 0) p.taxFree--;
      finishQueues(p);
      if (order < 25 && !p.siege && rng() < (25 - order) * 0.025) revolt(p);
    }
    const upkeep = factionUpkeep(f);
    st.gold += income - upkeep - treasuryLoss(f);
    payPending(f);
    st.lastIncome = income; st.lastUpkeep = upkeep;
    if (st.orderBonusT > 0) st.orderBonusT--;
    // Unpaid troops desert
    if (st.gold < 0) {
      const all = armiesOf(f).flatMap(a => a.units.map((u, i) => ({ a, u })).filter(x => x.u.type !== 'general'));
      if (all.length) {
        const x = pick(all);
        x.a.units.splice(x.a.units.indexOf(x.u), 1);
        if (!x.a.units.length) delete G.armies[x.a.id];
        if (f === G.player) HOOKS.notify({ title: t('Troops desert'), text: t('Our treasury is empty. Unpaid {unit} have deserted.', { unit: uName(x.u.type) }) });
      }
      if (st.gold < -2000) st.gold = -2000;
    }
  }

  // Armies at home recover their losses
  for (const a of Object.values(G.armies)) {
    const p = G.provinces[a.prov];
    if (a.owner === 'rebels') continue;
    const home = p.owner === a.owner && !p.siege;
    for (const u of a.units) {
      const max = UNITS[u.type].men, d = UNITS[u.type];
      let rate = home ? 0.1 : a.besieging ? 0 : 0.03;
      if (home && ((d.cls === 'cav' || d.cls === 'ha') ? p.b.stables : p.b.barracks)) rate = 0.2;
      u.men = Math.min(max, Math.round(u.men + max * rate));
    }
  }

  // Diplomacy drifts
  for (const k in G.rel) {
    const r = G.rel[k];
    const [a, b] = k.split('|');
    if (!G.factions[a].alive || !G.factions[b].alive) continue;
    if (r.war) { r.warTurns++; r.att -= 1; }
    if (r.truce > 0) r.truce--;
    if (r.trade) r.att += 1.5;
    if (r.alliance) r.att += 1.5;
    r.att += -r.att * 0.03;
    r.att = clampN(r.att, -100, 100);
  }

  // Rulers age and die
  if (G.turn % 2 === 1) {
    for (const a of Object.values(G.armies)) {
      if (!a.general) continue;
      a.general.age++;
      const g = a.general;
      if (g.age > 55 && rng() < (g.age - 55) * 0.012) {
        a.units = a.units.filter(u => u.type !== 'general');
        generalDied(a, 'age');
        if (!a.units.length) delete G.armies[a.id];
      }
    }
  }

  // A random event somewhere
  if (rng() < 0.45) randomEvent();
}

function growProvince(p, order) {
  const T = TERRAIN[p.terrain], f = G.factions[p.owner];
  let g = (0.008 + 0.006 * p.b.farms) * T.grow + TAX_GROWTH[taxOf(p)];
  if (order < 40) g -= 0.006;
  if (p.siege) g = -0.02;
  const cap = 30 + 40 * p.b.farms + (p.terrain === 'oasis' ? 40 : 0);
  if (p.pop > cap) g = Math.min(g, 0);
  p.pop = Math.max(1, p.pop * (1 + g));
  // Unrest fades; so does the goodwill from a feast
  p.unrest = p.unrest > 0 ? Math.max(0, p.unrest * 0.8 - 1) : Math.min(0, p.unrest * 0.8 + 1);
  if (p.sacked > 0) p.sacked--;
}

function finishQueues(p) {
  if (p.build) {
    p.build.turns--;
    if (p.build.turns <= 0 && p.build.key === 'wonder') {
      completeWonder(p, p.build.id);
      p.build = null;
    } else if (p.build.turns <= 0) {
      p.b[p.build.key]++;
      if (p.owner === G.player) log(t('{city}: {building} completed.', { city: cityOf(p), building: bLevel(p.build.key, p.b[p.build.key]) }), 'good');
      p.build = null;
    }
  }
  if (p.queue.length && !p.siege) {
    const done = p.queue.splice(0, 2);
    let army = armiesIn(p.id).find(a => a.owner === p.owner && a.units.length + done.length <= GAME.MAX_ARMY);
    if (!army) army = addArmy(p.owner, p.id, [], null);
    for (const t of done) army.units.push(makeUnit(t));
  }
}

function revolt(p) {
  const old = p.owner;
  const units = ['militia', 'militia', 'spear'];
  if (p.pop > 20) units.push('archer', 'spear');
  if (p.terrain === 'steppe' || p.terrain === 'desert') units.push('horsearch');
  for (const a of armiesIn(p.id)) if (a.owner === old) { const to = retreatTarget(a); if (to) a.prov = to; else delete G.armies[a.id]; }
  p.owner = 'rebels'; p.unrest = 0; p.queue = []; p.build = null; p.siege = null;
  addArmy('rebels', p.id, units, null);
  log(dateText() + ': ' + t('{city} rises in revolt against the {nation}!', { city: cityOf(p), nation: fFull(old) }), old === G.player ? 'big' : '');
  if (old === G.player) HOOKS.notify({ title: t('Revolt in {city}', { city: cityOf(p) }), text: t('The people of {city} have risen against us and declared their independence. Keep public order high with low taxes, mosques and garrisons.', { city: cityOf(p) }), prov: p.id });
  if (G.factions[old].capital === p.id) {
    const rest = provsOf(old).sort((x, y) => y.pop - x.pop);
    G.factions[old].capital = rest.length ? rest[0].id : null;
  }
  checkFactionAlive(old);
}

function randomEvent() {
  const total = RANDOM_EVENTS.reduce((n, e) => n + e.w, 0);
  let r = rng() * total, ev = RANDOM_EVENTS[0];
  for (const e of RANDOM_EVENTS) { r -= e.w; if (r <= 0) { ev = e; break; } }
  const cands = Object.values(G.provinces).filter(p => p.owner !== 'rebels' && (!ev.silk || p.silk));
  if (!cands.length) return;
  const p = pick(cands);
  ev.apply(p, G, G.factions[p.owner]);
  p.unrest = Math.max(-30, p.unrest);
  if (p.owner === G.player) {
    const text = t(ev.text).replace('{p}', cityOf(p));
    log(dateText() + ': ' + text, 'event');
    HOOKS.notify({ title: t(ev.title), text, prov: p.id, minor: true });
  }
}

function runEvents() {
  for (let i = 0; i < EVENTS.length; i++) {
    const e = EVENTS[i];
    if (G.fired.includes(i)) continue;
    const due = (e.when[0] - GAME.START_YEAR) * 2 + e.when[1];
    if (G.turn < due) continue;
    G.fired.push(i);
    const x = e.effect;
    if (x.faction && !G.factions[x.faction].alive) continue;
    if (x.relation && (!G.factions[x.relation[0]].alive || !G.factions[x.relation[1]].alive)) continue;
    if (x.faction && x.order) { G.factions[x.faction].orderBonus = x.order; G.factions[x.faction].orderBonusT = 4; }
    if (x.relation) { const r = rel(x.relation[0], x.relation[1]); r.att = clampN(r.att + x.relation[2], -100, 100); }
    if (x.leader && x.faction !== G.player) {
      const st = G.factions[x.faction];
      const la = armiesOf(x.faction).find(a => a.general && a.general.leader);
      if (la) { la.general.name = x.leader; la.general.age = charByName(x.leader) ? year() - charByName(x.leader).born : 35; la.general.cmd = Math.max(la.general.cmd, 3); }
      st.leader = x.leader;
    }
    if (x.armyLoss) for (const a of armiesOf(x.faction)) { for (const u of a.units) u.men = Math.round(u.men * (1 - x.armyLoss)); cleanArmy(a); }
    if (x.plague) for (const p of Object.values(G.provinces)) if (p.silk) p.pop *= 1 - x.plague;
    if (x.silkGold) for (const f of PLAYABLE) if (G.factions[f].alive) G.factions[f].gold += Math.min(x.silkGold, provsOf(f).filter(p => p.silk).length * 60);
    if (x.holder) {
      const p = G.provinces[x.holder];
      if (p.owner !== 'rebels') { G.factions[p.owner].gold += x.gold || 0; p.unrest = Math.max(0, p.unrest - (x.order || 0)); }
    }
    log(dateText() + ': ' + t(e.title) + '. ' + t(e.text), 'history');
    HOOKS.notify({ title: t(e.title), text: t(e.text), history: true });
  }
}

// The last nation standing wins.
function checkVictory() {
  if (G.over) return;
  const pl = G.player;
  if (!G.factions[pl].alive || provsOf(pl).length === 0) { G.over = 'lose'; return; }
  if (nationsLeft().length === 1) G.over = 'win';
}
const nationsLeft = () => PLAYABLE.filter(f => G.factions[f].alive);
