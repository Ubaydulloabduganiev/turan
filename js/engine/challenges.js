'use strict';
// Daily and weekly challenges: every day (and every week) one situation, the same for every player in the
// world: the same nation, the same map, the same dice. Win as fast as you can for the best score.
// A challenge is built from its date alone, so it needs no server, and a saved game can rebuild it.

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10); // by Greenwich time, the same everywhere
function weekKey(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return x.getUTCFullYear() + '-W' + String(Math.ceil(((x - y0) / 864e5 + 1) / 7)).padStart(2, '0');
}
const keySeed = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

const CHALLENGE_CACHE = {};
// The challenge for 'daily:2026-10-08' or 'weekly:2026-W41'
function challengeSpec(id) {
  if (CHALLENGE_CACHE[id]) return CHALLENGE_CACHE[id];
  const [kind, key] = id.split(':');
  if (!key || (kind !== 'daily' && kind !== 'weekly')) return null;
  const seed = keySeed(id), r = mulberry32(seed);
  const weekly = kind === 'weekly';
  const types = weekly ? ['campaign', 'campaign', 'storm'] : ['conquest', 'storm', 'defence'];
  const type = types[Math.floor(r() * types.length)];
  const faction = PLAYABLE[Math.floor(r() * PLAYABLE.length)];
  const start = 12 * Math.floor(r() * 6); // an April between 1370 and 1375
  // Look at the map of that day, then put the world back as it was
  const saved = G, tellKeep = HOOKS.notify;
  HOOKS.notify = () => {}; // a quiet look: nothing of this game is told
  try { newGame(faction, seed); } finally { HOOKS.notify = tellKeep; }
  const mine = new Set(provsOf(faction).map(p => p.id));
  const ring = (n) => {
    const seen = new Set(mine), out = [];
    let front = [...mine];
    for (let d = 0; d < n; d++) {
      const next = [];
      for (const id of front) for (const a of G.provinces[id].adj) if (!seen.has(a)) { seen.add(a); next.push(a); out.push({ id: a, d: d + 1 }); }
      front = next;
    }
    return out;
  };
  const order = arr => arr.map(x => ({ ...x, k: r() })).sort((a, b) => a.d - b.d || a.k - b.k);
  let spec;
  const border = order(ring(1)).map(x => G.provinces[x.id]);
  if (type === 'defence') {
    // A frontier city with walls; the strongest neighbour comes for it
    const cities = provsOf(faction).filter(p => p.id !== G.factions[faction].capital && p.adj.some(n => G.provinces[n].owner !== faction && G.provinces[n].owner !== 'rebels'));
    const city = cities.sort((a, b) => b.b.walls - a.b.walls || b.pop - a.pop)[0] || G.provinces[G.factions[faction].capital];
    const foeProv = city.adj.map(n => G.provinces[n]).find(q => q.owner !== faction && q.owner !== 'rebels');
    const foe = foeProv ? foeProv.owner : PLAYABLE.find(f => f !== faction);
    const from = foeProv ? foeProv.id : null;
    spec = {
      goal: { type: 'hold', provs: [city.id, G.factions[faction].capital].filter((v, i, a) => a.indexOf(v) === i) }, turns: 8, foe, city: city.id,
      goalText: ['Hold {city} and your capital until {date}. The {nation} is coming with two armies.', { city: city.id, nation: foe }],
      setup: () => {
        declareWar(foe, faction, true); rel(foe, faction).att = -80;
        if (from) { const F = FACTIONS[foe]; const u = F.nomad ? ['horsearch', 'horsearch', 'lancer', 'lancer', 'heavycav', 'spear', 'archer', 'siege'] : ['spear', 'spear', 'heavyinf', 'heavyinf', 'archer', 'archer', 'lancer', 'siege', 'siege'];
          strikeArmy(foe, from, u); strikeArmy(foe, from, u.slice(0, 6)); }
        // The garrison: enough to hold, if it is used well
        const F2 = FACTIONS[faction];
        strikeArmy(faction, city.id, (F2.nomad ? ['spear', 'archer', 'archer', 'horsearch', 'horsearch', 'lancer'] : ['spear', 'spear', 'archer', 'archer', 'heavyinf', 'lancer']).concat(F2.unique ? [F2.unique] : []));
        G.factions[faction].gold += 1200;
      },
    };
  } else {
    // Cities to take: on the border for a day, deeper for a week; one great walled city to storm
    let targets;
    if (type === 'storm') {
      const near = order(ring(2)).map(x => G.provinces[x.id]).filter(p => p.b.walls >= 2);
      targets = [(near.sort((a, b) => b.pop - a.pop)[0] || border.find(p => p.b.walls) || border[0]).id];
    } else {
      // A cluster: one city on the border, then the nearest lands beyond it
      const anchor = border.find(p => p.pop >= 5) || border[0];
      targets = [anchor.id];
      const seen = new Set([anchor.id, ...mine]);
      let front = [anchor.id];
      while (targets.length < (weekly ? 4 : 2) && front.length) {
        const next = [];
        for (const id of front) for (const n of order(G.provinces[id].adj.map(a => ({ id: a, d: 0 }))).map(x => x.id)) {
          if (seen.has(n)) continue; seen.add(n); next.push(n);
          if (targets.length < (weekly ? 4 : 2) && G.provinces[n].pop >= 4) targets.push(n);
        }
        front = next;
      }
    }
    if (!targets.length) targets = order(ring(2)).map(x => G.provinces[x.id]).slice(0, weekly ? 4 : 2).map(p => p.id);
    const first = G.provinces[targets[0]];
    const base = provsOf(faction).filter(p => p.adj.includes(first.id))[0] || G.provinces[G.factions[faction].capital];
    spec = {
      goal: { type: 'take', provs: targets }, turns: weekly ? 16 : type === 'storm' ? 8 : 10,
      goalText: [targets.length === 1 ? 'Take {city} by {date}.' : 'Take {list} by {date}.', { city: targets[0], list: targets }],
      setup: () => {
        for (const id of targets) { const o = G.provinces[id].owner; if (o !== 'rebels' && o !== faction && !atWar(faction, o)) { declareWar(faction, o, true); rel(faction, o).att = -50; } }
        const F = FACTIONS[faction];
        const u = (F.nomad ? ['horsearch', 'horsearch', 'horsearch', 'lancer', 'lancer', 'heavycav'] : ['spear', 'spear', 'heavyinf', 'heavyinf', 'archer', 'archer', 'lancer', 'heavycav']).concat(F.unique ? [F.unique] : [], type === 'storm' || weekly ? ['siege', 'siege'] : []);
        strikeArmy(faction, base.id, u.slice(0, 12));
        if (weekly) strikeArmy(faction, G.factions[faction].capital && G.provinces[G.factions[faction].capital].owner === faction ? G.factions[faction].capital : base.id, u.slice(0, 9));
        G.factions[faction].gold += weekly ? 2500 : 1500;
      },
    };
  }
  G = saved;
  const titles = { conquest: 'Border war', storm: 'Storm the walls', defence: 'Hold the line', campaign: 'A season of conquest' };
  spec = Object.assign(spec, {
    id, kind, key, seed, type, faction, start, deadline: start + spec.turns, difficulty: weekly ? 'Hard' : 'Normal', challenge: true,
    title: titles[type], blurb: '',
  });
  return (CHALLENGE_CACHE[id] = spec);
}
const todayChallenge = () => challengeSpec('daily:' + dayKey());
const weekChallenge = () => challengeSpec('weekly:' + weekKey());

// The goal in words, in the player's language
function challengeGoalText(S) {
  const [s, v] = S.goalText;
  const cityName = id => cityById(id);
  return t(s, { city: v.city ? cityName(v.city) : '', list: v.list ? v.list.map(cityName).join(', ') : '', nation: v.nation ? fFull(v.nation) : '', date: dateM(S.deadline) });
}

// The score of a won challenge: speed first, then the realm you hold
function challengeScore() {
  const s = G.scenario, S = scenarioById(s.id), pl = G.player;
  if (s.result !== 'win') return 0;
  const spare = Math.max(0, S.deadline - (s.wonTurn !== undefined ? s.wonTurn : G.turn));
  const men = armiesOf(pl).reduce((n, a) => n + a.units.reduce((m, u) => m + u.men, 0), 0);
  return 1000 + spare * 150 + provsOf(pl).length * 20 + Math.floor(G.factions[pl].gold / 40) + Math.floor(men / 50) + (G.stats[pl].lost === 0 ? 250 : 0);
}
