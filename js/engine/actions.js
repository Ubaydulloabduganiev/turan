'use strict';
// Things a faction can do on its turn. Used by both the player (through the UI) and the AI.

// ---------- Armies ----------

// Checks a move without doing it. Returns null when allowed, otherwise the reason.
function moveBlocked(a, to) {
  const p = G.provinces[a.prov], dest = G.provinces[to];
  if (!dest || !p.adj.includes(to)) return 'Not next to this province';
  if (a.moves <= 0) return 'This army has no moves left this turn';
  const o = dest.owner;
  if (o !== a.owner && !allied(a.owner, o) && !atWar(a.owner, o)) return 'peace';
  return null;
}

// What happens if the army moves there: 'move', 'battle', 'siege', 'capture'.
function movePreview(a, to) {
  const dest = G.provinces[to];
  const enemies = armiesIn(to).filter(x => atWar(x.owner, a.owner));
  if (enemies.length) {
    if (dest.b.walls > 0 && atWar(dest.owner, a.owner) && enemies.every(e => e.owner === dest.owner)) return 'siege';
    return 'battle';
  }
  if (atWar(a.owner, dest.owner)) return dest.b.walls > 0 ? 'siege' : 'capture';
  return 'move';
}

// opts.fight: the player chose to fight the battle themselves.
async function moveArmy(a, to, opts = {}) {
  const why = moveBlocked(a, to);
  if (why) return { ok: false, why };
  const from = a.prov, dest = G.provinces[to];
  const kind = movePreview(a, to);
  leaveSiege(a);
  a.prov = to; a.moves--; a.from = from;
  if (kind === 'move') return { ok: true, kind };
  a.moves = 0;
  if (kind === 'battle') {
    const enemies = armiesIn(to).filter(x => atWar(x.owner, a.owner));
    const b = makeBattle([a], enemies, to, 'field');
    const out = await runBattle(b, opts);
    return { ok: true, kind, battle: b, result: out };
  }
  if (kind === 'siege') {
    if (dest.siege && dest.siege.by === a.owner) a.besieging = true;
    else if (dest.siege) { a.besieging = false; } // someone else is already besieging; wait outside
    else startSiege(dest, a.owner);
    return { ok: true, kind };
  }
  captureProvince(dest, a.owner, a, opts.mode);
  return { ok: true, kind: 'capture' };
}

function leaveSiege(a) {
  if (!a.besieging) return;
  a.besieging = false;
  const p = G.provinces[a.prov];
  if (p.siege && !armiesIn(p.id).some(o => o.owner === p.siege.by && o.besieging)) {
    p.siege = null;
    log(`The siege of ${p.city} is lifted.`);
  }
}

function assaultBattle(pid, faction) {
  const p = G.provinces[pid];
  const att = armiesIn(pid).filter(a => a.owner === faction && a.besieging);
  const def = armiesIn(pid).filter(a => a.owner === p.owner);
  if (!att.length) return null;
  return makeBattle(att, def, pid, 'assault');
}

async function assault(pid, faction, opts = {}) {
  const b = assaultBattle(pid, faction);
  if (!b) return null;
  for (const id of b.att.armies) G.armies[id].moves = 0;
  return runBattle(b, opts);
}

function sallyBattle(pid) {
  const p = G.provinces[pid];
  const att = armiesIn(pid).filter(a => a.owner === p.owner);
  const def = armiesIn(pid).filter(a => p.siege && a.owner === p.siege.by);
  if (!att.length || !def.length) return null;
  return makeBattle(att, def, pid, 'sally');
}

async function sally(pid, opts = {}) {
  const b = sallyBattle(pid);
  if (!b) return null;
  for (const id of b.att.armies) G.armies[id].moves = 0;
  return runBattle(b, opts);
}

async function runBattle(b, opts = {}) {
  const pl = G.player;
  let mode = 'auto';
  if (b.att.faction === pl) mode = opts.fight ? 'fight' : 'auto';
  else if (b.def.faction === pl && b.def.armies.length) mode = await HOOKS.defend(b);
  let res = null;
  if (mode === 'fight') res = await HOOKS.fight(b);
  if (!res) res = autoResolve(b);
  const out = finishBattle(b, res);
  out.winner = res.winner;
  out.playerWon = (res.winner === 'att' ? b.att.faction : b.def.faction) === pl;
  out.playerIn = b.att.faction === pl || b.def.faction === pl;
  return out;
}

function mergeArmies(into, from) {
  if (into.prov !== from.prov || into.owner !== from.owner || into === from) return 'Armies must be in the same province';
  if (into.units.length + from.units.length > GAME.MAX_ARMY) return `An army can have at most ${GAME.MAX_ARMY} units`;
  if (into.general && from.general) return 'Both armies have a general';
  if (!into.general && from.general) into.general = from.general;
  into.units.push(...from.units);
  into.moves = Math.min(into.moves, from.moves);
  into.besieging = into.besieging || from.besieging;
  delete G.armies[from.id];
  return null;
}

function splitArmy(a, idxs) {
  if (!idxs.length || idxs.length >= a.units.length) return null;
  const set = new Set(idxs);
  const moving = a.units.filter((u, i) => set.has(i));
  a.units = a.units.filter((u, i) => !set.has(i));
  const b = addArmy(a.owner, a.prov, moving, null);
  if (moving.some(u => u.type === 'general')) { b.general = a.general; a.general = null; }
  b.moves = a.moves; b.besieging = a.besieging;
  return b;
}

function disbandUnit(a, i) {
  const u = a.units[i];
  if (!u || u.type === 'general') return;
  a.units.splice(i, 1);
  if (!a.units.length) delete G.armies[a.id];
}

const GENERAL_COST = 600;
function appointGeneral(a) {
  const f = G.factions[a.owner];
  if (a.general) return 'This army already has a general';
  if (a.units.length >= GAME.MAX_ARMY) return 'The army is full';
  if (f.gold < GENERAL_COST) return 'Not enough gold';
  f.gold -= GENERAL_COST;
  a.general = makeGeneral(a.owner, newGeneralName(a.owner), 1 + (rng() < 0.3 ? 1 : 0), null, false);
  a.units.unshift(makeUnit('general'));
  return null;
}

// ---------- Provinces ----------

const QUEUE_MAX = 4;
function recruit(p, type) {
  const f = G.factions[p.owner], d = UNITS[type];
  if (!canRecruit(p, type)) return 'Cannot train that here';
  if (p.queue.length >= QUEUE_MAX) return 'The training queue is full';
  if (f.gold < d.cost) return 'Not enough gold';
  f.gold -= d.cost;
  p.queue.push(type);
  return null;
}
function cancelRecruit(p, i) {
  const t = p.queue[i];
  if (!t) return;
  p.queue.splice(i, 1);
  G.factions[p.owner].gold += UNITS[t].cost;
}

function buildCheck(p, key) {
  const lvl = p.b[key] + 1, B = BUILDINGS[key];
  if (lvl > 3) return 'Fully built';
  if (lvl > maxBuildLevel(p)) return `Needs a larger population (${lvl === 2 ? 10 : 25}k)`;
  if (p.build) return 'Already building something';
  if (p.siege) return 'Under siege';
  if (G.factions[p.owner].gold < B.cost[lvl]) return 'Not enough gold';
  return null;
}
function startBuild(p, key) {
  const why = buildCheck(p, key);
  if (why) return why;
  const lvl = p.b[key] + 1;
  G.factions[p.owner].gold -= BUILDINGS[key].cost[lvl];
  p.build = { key, turns: BUILDINGS[key].turns[lvl] };
  return null;
}
function cancelBuild(p) {
  if (!p.build) return;
  G.factions[p.owner].gold += BUILDINGS[p.build.key].cost[p.b[p.build.key] + 1];
  p.build = null;
}

// Extra plunder after a capture: more gold, fewer people, angrier townsfolk.
function sackProvince(p) {
  const extra = Math.round(p.pop * 17);
  G.factions[p.owner].gold += extra;
  p.pop *= 0.8; p.unrest = 55; p.sacked = 6;
  for (const g of PLAYABLE) if (g !== p.owner && G.factions[g].alive) rel(p.owner, g).att -= 3;
  log(`${FACTIONS[p.owner].name} sacked ${p.city}.`, 'big');
  return extra;
}

// ---------- Diplomacy ----------

// The AI's view of how good a deal is for `to`. Positive means it will accept.
function dealValue(from, to, type, gold = 0) {
  const r = rel(from, to);
  const pf = factionPower(from) + 40, pt = factionPower(to) + 40, pr = pf / pt;
  const common = PLAYABLE.filter(x => x !== from && x !== to && G.factions[x].alive && rel(from, x).war && rel(to, x).war).length;
  switch (type) {
    case 'peace': {
      if (!r.war) return -999;
      let v = r.att * 0.3 + r.warTurns * 2.5 + (pr - 1) * 35 + gold / 40 - 10;
      if (r.warTurns < 2) v -= 40;
      return v;
    }
    case 'alliance':
      if (r.war) return -999;
      return r.att - 35 + common * 30 + (r.married ? 15 : 0) + Math.min(20, (pr - 0.5) * 20);
    case 'trade':
      if (r.war || r.trade) return -999;
      return r.att + 25;
    case 'tribute':
      if (r.war) return -999;
      return (pr - 1.8) * 40 + r.att * 0.15 - 10;
    case 'marriage':
      if (r.war || r.married) return -999;
      return r.att + 5;
    case 'joinwar': // `gold` here is the faction id of the shared enemy
      return r.alliance ? r.att - 20 + (rel(to, gold).att < 0 ? 30 : 0) : -999;
    default: return 0;
  }
}

function tributeAmount(to) { return Math.max(100, Math.min(1500, Math.round(G.factions[to].gold * 0.35 / 50) * 50)); }

// Carries out an agreed deal.
function applyDeal(from, to, type, gold = 0) {
  const r = rel(from, to);
  const F = FACTIONS[from], T = FACTIONS[to];
  switch (type) {
    case 'peace':
      r.war = false; r.truce = 8; r.warTurns = 0; r.att += 10;
      if (gold) { G.factions[from].gold -= gold; G.factions[to].gold += gold; }
      for (const a of Object.values(G.armies)) {
        if ((a.owner === from && G.provinces[a.prov].owner === to) || (a.owner === to && G.provinces[a.prov].owner === from)) {
          leaveSiege(a);
          const home = nearestOwnProvince(a);
          if (home) a.prov = home; else delete G.armies[a.id];
        }
      }
      for (const p of Object.values(G.provinces)) if (p.siege && ((p.siege.by === from && p.owner === to) || (p.siege.by === to && p.owner === from))) p.siege = null;
      log(`${dateText()}: the ${F.full} and the ${T.full} make peace.`, from === G.player || to === G.player ? 'dip' : '');
      break;
    case 'alliance': r.alliance = true; r.att += 15; log(`${F.name} and ${T.name} form an alliance.`, 'dip'); break;
    case 'trade': r.trade = true; r.att += 8; log(`${F.name} and ${T.name} sign a trade agreement.`, from === G.player || to === G.player ? 'dip' : ''); break;
    case 'tribute': {
      const amt = tributeAmount(to);
      G.factions[to].gold -= amt; G.factions[from].gold += amt; r.att -= 20;
      log(`${T.name} pays ${amt} gold in tribute to ${F.name}.`, 'dip');
      return amt;
    }
    case 'gift':
      G.factions[from].gold -= gold; G.factions[to].gold += gold;
      r.att = Math.min(100, r.att + Math.min(35, gold / 25));
      break;
    case 'marriage': r.married = true; r.att += 30; log(`A marriage binds the houses of ${F.name} and ${T.name}.`, 'dip'); break;
    case 'joinwar': declareWar(to, gold, true); break;
  }
  r.att = clampN(r.att, -100, 100);
  return 0;
}

function nearestOwnProvince(a) {
  const seen = new Set([a.prov]), q = [a.prov];
  while (q.length) {
    const c = q.shift();
    if (G.provinces[c].owner === a.owner) return c;
    for (const n of G.provinces[c].adj) if (!seen.has(n)) { seen.add(n); q.push(n); }
  }
  return null;
}

function declareWar(from, to, quiet) {
  const r = rel(from, to);
  if (r.war) return;
  const perfidy = r.alliance || r.truce > 0;
  r.war = true; r.alliance = false; r.trade = false; r.att = Math.min(r.att, 0) - 40; r.warTurns = 0; r.truce = 0;
  if (perfidy) for (const g of PLAYABLE) if (g !== from && g !== to && G.factions[g].alive) rel(from, g).att -= 15;
  log(`${dateText()}: the ${FACTIONS[from].full} declares war on the ${FACTIONS[to].full}.`, from === G.player || to === G.player ? 'war' : '');
  if (to === G.player && !quiet) HOOKS.notify({ title: 'War!', text: `The ${FACTIONS[from].full} has declared war on us.` });
  // Allies of the victim may come to its aid
  for (const g of PLAYABLE) {
    if (g === from || g === to || !G.factions[g].alive || !rel(g, to).alliance || rel(g, from).war) continue;
    if (g === G.player) continue; // the player decides for themselves
    if (rel(g, to).att > 20) { declareWar(g, from, true); log(`${FACTIONS[g].name} honours its alliance and joins the war.`, 'war'); }
  }
}

// The player proposes something to an AI faction. Returns { ok, text }.
function propose(to, type, gold = 0) {
  const from = G.player, f = G.factions[from];
  if (type === 'war') { declareWar(from, to); return { ok: true, text: `We are now at war with the ${FACTIONS[to].full}.` }; }
  if (type === 'gift') {
    if (f.gold < gold) return { ok: false, text: 'We do not have that much gold.' };
    applyDeal(from, to, 'gift', gold);
    return { ok: true, text: `${FACTIONS[to].leaderTitle || G.factions[to].leader} accepts the gift graciously.` };
  }
  if (type === 'peace' && gold > f.gold) return { ok: false, text: 'We do not have that much gold.' };
  if (type === 'cancelTrade') { rel(from, to).trade = false; rel(from, to).att -= 10; return { ok: true, text: 'The trade agreement is cancelled.' }; }
  if (type === 'cancelAlliance') { rel(from, to).alliance = false; rel(from, to).att -= 25; return { ok: true, text: 'The alliance is dissolved.' }; }
  const r = rel(from, to);
  if (r.asked === G.turn + ':' + type) return { ok: false, text: 'They have already given their answer this season.' };
  r.asked = G.turn + ':' + type;
  const v = dealValue(from, to, type, gold);
  if (v > 0) {
    const amt = applyDeal(from, to, type, gold);
    const texts = {
      peace: 'They accept. The war is over.', alliance: 'They accept. We are now allies.', trade: 'They accept. Caravans will travel between our lands.',
      tribute: `They are afraid of us and pay ${amt} gold.`, marriage: 'They accept. The two houses are joined by marriage.',
    };
    return { ok: true, text: texts[type] };
  }
  if (type === 'tribute') { r.att -= 10; }
  const no = {
    peace: v > -15 ? 'They refuse, but might accept with some gold.' : 'They refuse. They believe they can still win.',
    alliance: 'They refuse. They do not trust us enough.', trade: 'They refuse to trade with us.',
    tribute: 'They laugh at our envoy and send him home.', marriage: 'They refuse the match.',
  };
  return { ok: false, text: no[type] || 'They refuse.' };
}
