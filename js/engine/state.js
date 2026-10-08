'use strict';
// Campaign state and shared helpers. The engine never touches the DOM; the UI talks to it through HOOKS.

let G = null;        // the running campaign
let MAPDATA = null;  // geometry from buildMap(), rebuilt on load (it is deterministic)

const HOOKS = {
  // Called when an AI army attacks the player. Returns a promise of 'fight' or 'auto'.
  defend: async () => 'auto',
  // Called to play a battle the player chose to fight. Returns a promise of a battle result, or null to auto-resolve.
  fight: async () => null,
  // Called when an AI faction makes the player an offer. Returns a promise of true/false.
  offer: async () => false,
  // Called whenever something worth telling the player happens.
  notify: () => {},
  // Called when an army marches from one province to the next, so the map can show it moving.
  march: async () => {},
  // Called just before a battle is fought at a province.
  clash: async () => {},
  // Hot seat: hand the device to this human ruler (the UI shows a screen between players).
  focus: async f => { G.player = f; },
  // Hot seat: let this human ruler play their part of the round. Resolves when they end their turn.
  humanTurn: async () => {},
};

// The rulers played by people. In a hot-seat game several people share one device; G.player is whoever holds it.
const isHuman = f => !!G && !!f && (G.humans ? G.humans.includes(f) : f === G.player);
const humansAlive = () => (G.humans || [G.player]).filter(f => G.factions[f] && G.factions[f].alive);
// A message for one human ruler (in a hot-seat game it waits until they hold the device)
function tell(f, n) { HOOKS.notify({ ...n, for: f }); }

const AGGRESSION = { temur: 0.95, golden: 0.6, white: 0.65, moghul: 0.55, khwarezm: 0.45, kart: 0.35, sarbadar: 0.45, rebels: 0 };

function rng() { // seeded, so a saved game continues the same way
  G.seed = (G.seed + 0x6D2B79F5) | 0;
  let t = G.seed;
  t = Math.imul(t ^ t >>> 15, 1 | t);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
const pick = list => list[Math.floor(rng() * list.length)];
const clampN = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

function dateText(turn = G.turn) {
  return t(GAME.SEASONS[turn % 2]) + ' ' + (GAME.START_YEAR + Math.floor(turn / 2));
}
const year = () => GAME.START_YEAR + Math.floor(G.turn / 2);

// ---------- New game ----------

function makeUnit(type) {
  return { type, men: UNITS[type].men, exp: 0 };
}

function makeGeneral(faction, name, cmd, age, leader) {
  const c = typeof charByName === 'function' ? charByName(name) : null;
  if (c) age = year() - c.born;
  return { name, cmd, age: age || 25 + Math.floor(rng() * 15), leader: !!leader };
}

function newGeneralName(faction) {
  const used = new Set(Object.values(G.armies).filter(a => a.general).map(a => a.general.name));
  const pool = NAMES[FACTIONS[faction].names].filter(n => !used.has(n));
  return pick(pool.length ? pool : NAMES[FACTIONS[faction].names]);
}

function addArmy(owner, prov, units, general) {
  const id = 'a' + (G.nextId++);
  const a = { id, owner, prov, units: [], general: general || null, moves: 0, besieging: false };
  if (general) a.units.push(makeUnit('general'));
  for (const u of units) a.units.push(typeof u === 'string' ? makeUnit(u) : u);
  G.armies[id] = a;
  return a;
}

function relKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
function rel(a, b) {
  const k = relKey(a, b);
  if (!G.rel[k]) G.rel[k] = { war: false, alliance: false, trade: false, att: 0, truce: 0, married: false, warTurns: 0 };
  return G.rel[k];
}
const atWar = (a, b) => a !== b && (a === 'rebels' || b === 'rebels' || rel(a, b).war);
const allied = (a, b) => a === b || (a !== 'rebels' && b !== 'rebels' && rel(a, b).alliance);

function newGame(player, seed, humans) {
  MAPDATA = MAPDATA || buildMap();
  G = {
    version: 1, player, turn: 0, seed: seed || ((Math.random() * 1e9) | 0), nextId: 1,
    factions: {}, provinces: {}, armies: {}, rel: {}, log: [], fired: [], over: null, stats: {}, fog: true,
    humans: humans && humans.length > 1 ? PLAYABLE.filter(f => humans.includes(f)) : undefined,
  };
  for (const id in FACTIONS) {
    const F = FACTIONS[id];
    G.factions[id] = {
      id, alive: true, gold: id === 'rebels' ? 0 : 2000, tax: 1, capital: F.capital,
      leader: F.leader || null, heir: F.heir || null, orderBonus: 0, orderBonusT: 0,
    };
    G.stats[id] = { won: 0, lost: 0, taken: 0 };
  }
  G.factions.temur.gold = 3000;
  PROVINCE_DATA.forEach((d, i) => {
    const site = MAPDATA.sites[i];
    const [walls, barracks, stables, market, farms, madrasa] = d[9];
    G.provinces[d[0]] = {
      id: d[0], name: d[1], city: d[2], owner: d[5], pop: d[6], terrain: d[7], silk: !!d[8],
      b: { walls, barracks, stables, market, farms, madrasa, library: 0 }, build: null, queue: [],
      unrest: 0, x: site.x, y: site.y, idx: i,
      adj: [...MAPDATA.adj[i]].filter(j => MAPDATA.sites[j].kind === 'province').map(j => MAPDATA.sites[j].id),
      siege: null, sacked: 0,
    };
  });
  for (const d of PROVINCE_DATA) {
    if (!d[10]) continue;
    const owner = d[5], F = FACTIONS[owner];
    let general = null;
    const g = F.generals && F.generals.find((x, i) => (i === 0 ? F.capital === d[0] : false));
    if (g) general = makeGeneral(owner, g[0], g[1], g[2], true);
    addArmy(owner, d[0], d[10].split(' '), general);
  }
  // Other named generals start with a field army near the capital
  for (const id of PLAYABLE) {
    const F = FACTIONS[id];
    F.generals.slice(1).forEach((g, i) => {
      const cap = G.provinces[F.capital];
      const prov = i === 0 ? cap.id : (cap.adj.find(p => G.provinces[p].owner === id) || cap.id);
      const units = F.nomad ? ['horsearch', 'lancer'] : ['spear', 'archer'];
      addArmy(id, prov, units, makeGeneral(id, g[0], g[1], g[2], false));
    });
  }
  // The state of the world in 1370
  for (const a of PLAYABLE) for (const b of PLAYABLE) if (a < b) rel(a, b).att = 0;
  const war = (a, b, att) => { const r = rel(a, b); r.war = true; r.att = att; };
  war('temur', 'moghul', -40);
  war('white', 'golden', -40);
  rel('temur', 'khwarezm').att = -25;
  rel('kart', 'sarbadar').att = -35;
  rel('temur', 'white').att = -10;
  rel('kart', 'temur').att = 10;
  for (const a of PLAYABLE) for (const b of PLAYABLE) if (a < b && !rel(a, b).war && rel(a, b).att >= 0) rel(a, b).trade = (a === 'temur' && b === 'kart');
  for (const a of Object.values(G.armies)) a.moves = armyMoves(a);
  log(dateText() + ': ' + t('you take command of the {nation}.', { nation: fFull(player) }));
  runEvents();
  return G;
}

// Remembers a deed of the player's, for the achievements
function feat(k, n = 1) {
  if (!G) return;
  G.feats = G.feats || {};
  G.feats[k] = (G.feats[k] || 0) + n;
}

function log(text, kind) {
  G.log.push({ t: G.turn, text, kind: kind || '' });
  if (G.log.length > 300) G.log.splice(0, G.log.length - 300);
}

// ---------- Lookups ----------

const provsOf = f => Object.values(G.provinces).filter(p => p.owner === f);
const armiesOf = f => Object.values(G.armies).filter(a => a.owner === f);
const armiesIn = pid => Object.values(G.armies).filter(a => a.prov === pid);

function unitPower(u, owner) {
  const d = UNITS[u.type];
  return u.men / 100 * (d.atk + d.def * 0.8 + d.missile * 0.9) * (0.7 + d.morale * 0.05) * (1 + 0.08 * u.exp);
}
function armyPower(a) {
  let s = 0;
  for (const u of a.units) s += unitPower(u, a.owner);
  return s * (1 + 0.07 * (a.general ? a.general.cmd : 0));
}
function factionPower(f) {
  let s = 0;
  for (const a of armiesOf(f)) s += armyPower(a);
  return s;
}

function maxBuildLevel(p) { return p.pop < 10 ? 1 : p.pop < 25 ? 2 : 3; }

// Steps from the capital through own provinces (used for public order).
function distancesFrom(f) {
  const out = {}, cap = G.factions[f].capital;
  if (!cap || !G.provinces[cap] || G.provinces[cap].owner !== f) return out;
  const q = [cap]; out[cap] = 0;
  while (q.length) {
    const c = q.shift();
    for (const n of G.provinces[c].adj) {
      if (out[n] !== undefined || G.provinces[n].owner !== f) continue;
      out[n] = out[c] + 1; q.push(n);
    }
  }
  return out;
}

function provinceOrder(p, dist) {
  const F = FACTIONS[p.owner], f = G.factions[p.owner];
  if (p.owner === 'rebels') return 60;
  let o = 70 + p.b.madrasa * 8;
  o += TAX_ORDER[taxOf(p)] + (p.taxFree > 0 ? 15 : 0) + (p.governor ? 8 : 0);
  const d = dist ? dist[p.id] : undefined;
  o -= d === undefined ? 25 : Math.min(30, d * 4);
  if (F.nomad && (p.terrain === 'oasis') && p.pop > 15) o -= 10;
  let men = 0;
  for (const a of armiesIn(p.id)) if (a.owner === p.owner) for (const u of a.units) men += u.men;
  o += Math.min(20, men / 40);
  o -= Math.max(0, p.pop - 30) * 0.4; // big cities are harder to keep quiet
  o -= p.unrest;
  if (f.orderBonusT > 0) o += f.orderBonus;
  if (hasWonder(p.owner, 'bibikhanym')) o += 10;
  if (hasWonder(p.owner, 'yasawi') && (p.terrain === 'steppe' || p.terrain === 'desert')) o += 15;
  o += landmarkOrder(p);
  o -= overstretch(p.owner);
  o += devOrder(p);
  o += traitOrder(p.owner);
  return Math.round(clampN(o, 0, 120));
}

function provinceIncome(p, order) {
  const f = G.factions[p.owner], F = FACTIONS[p.owner];
  if (p.owner === 'rebels') return 0;
  let tax = p.taxFree > 0 ? 0 : p.pop * TERRAIN[p.terrain].tax * TAX_INCOME[taxOf(p)] * (1 + 0.2 * p.b.market) * (p.governor ? 1.1 : 1);
  tax *= clampN(order / 70, 0.3, 1.1);
  if (p.terrain === 'oasis' && hasWonder(p.owner, 'musalla')) tax *= 1.15;
  tax *= devTaxMult(p.owner) * traitTax(p.owner);
  if (isFlooded(p)) tax *= 0.6; // the fields are under water this season
  let trade = p.silk ? 40 + 45 * p.b.market + (hasWonder(p.owner, 'saraibazaar') ? 40 : 0) : 0;
  if (p.siege) { tax *= 0.2; trade = 0; }
  const open = p.terrain === 'steppe' || p.terrain === 'desert';
  const herds = F.nomad ? (open ? 150 : p.terrain === 'river' ? 70 : 0) : (open ? 20 : 0);
  return Math.round((tax + trade + herds + landmarkGold(p)) * GAME.INCOME);
}

// Steppe horsemen live off their own herds, so nomad nations pay less to keep them.
function unitUpkeep(type, nomad) {
  const d = UNITS[type];
  return Math.round(d.upkeep * GAME.UPKEEP * (nomad && (d.cls === 'ha' || type === 'lancer') ? 0.6 : 1));
}

// A great hoard (over 5000 gold) in the treasury tempts the officials who guard it: some of it goes missing every turn.
function treasuryLoss(f) {
  const g = G.factions[f] ? G.factions[f].gold : 0;
  if (hasAdv(f, 'trade', 4)) return g > 9000 ? Math.round((g - 9000) * 0.05) : 0;
  return g > 5000 ? Math.round((g - 5000) * 0.1) : 0;
}

function factionUpkeep(f) {
  let s = 0;
  const nomad = FACTIONS[f].nomad;
  for (const a of armiesOf(f)) for (const u of a.units) s += unitUpkeep(u.type, nomad);
  for (const p of provsOf(f)) if (p.governor) s += governorUpkeep(f);
  if (G.factions[f] && G.factions[f].sages) s += G.factions[f].sages.length * SAGE_UPKEEP;
  return s;
}

function tradeIncome(f) {
  let s = 0;
  for (const g of PLAYABLE) {
    if (g === f || !G.factions[g].alive || !rel(f, g).trade) continue;
    if (routeRaided(f, g)) continue; // this season's caravans were robbed
    const silk = provsOf(g).filter(p => p.silk).length + provsOf(f).filter(p => p.silk).length;
    s += (30 + silk * 12) * GAME.INCOME;
  }
  if (hasAdv(f, 'trade', 1)) s *= 1.3;
  return Math.round(s);
}

function factionIncome(f) {
  const dist = distancesFrom(f);
  let s = 0;
  for (const p of provsOf(f)) s += provinceIncome(p, provinceOrder(p, dist));
  return s + tradeIncome(f);
}

function canRecruit(p, type) {
  const d = UNITS[type], F = FACTIONS[p.owner];
  if (type === 'general') return false;
  if (d.only && d.only !== p.owner) return false;
  if ((d.build || 0) > p.b.barracks) return false;
  let st = d.stable || 0;
  if (F.nomad && (d.cls === 'ha' || type === 'lancer')) st = Math.max(0, st - 1);
  if (st > p.b.stables) return false;
  if (p.siege) return false;
  return true;
}
function recruitable(p) { return UNIT_ORDER.filter(t => canRecruit(p, t)); }

function armyMoves(a) {
  const fast = a.units.every(u => { const c = UNITS[u.type].cls; return c === 'cav' || c === 'ha'; });
  return fast ? 2 : 1;
}

function checkFactionAlive(f) {
  if (f === 'rebels' || !G.factions[f].alive) return;
  if (provsOf(f).length) return;
  G.factions[f].alive = false;
  for (const a of armiesOf(f)) delete G.armies[a.id];
  for (const g of PLAYABLE) if (g !== f) { const r = rel(f, g); r.war = false; r.alliance = false; r.trade = false; }
  log(t('The {nation} has been destroyed.', { nation: fFull(f) }), 'big');
  HOOKS.notify({ title: t('{nation} destroyed', { nation: fFull(f) }), text: t('The last lands of the {nation} have fallen.', { nation: fFull(f) }) });
}

// ---------- Save / load ----------

function saveGame(slot) {
  const data = JSON.stringify(G);
  try { localStorage.setItem('turan-save-' + slot, data); localStorage.setItem('turan-save-' + slot + '-meta', JSON.stringify({ player: G.player, date: dateText(), at: Date.now() })); return true; } catch (e) { return false; }
}
function loadGame(slot) {
  try {
    const data = localStorage.getItem('turan-save-' + slot);
    if (!data) return false;
    MAPDATA = MAPDATA || buildMap();
    G = JSON.parse(data);
    migrateProgress();
    return true;
  } catch (e) { return false; }
}
// ---------- Save files: a campaign carried to another device ----------

function gameToText() {
  return JSON.stringify({ app: 'turan', format: 1, saved: Date.now(), player: G.player, date: dateText(), game: G });
}
// Reads a save file. Returns null when it worked, otherwise what is wrong with it.
function gameFromText(text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { return 'This is not a Turan save file.'; }
  const g = d && d.app === 'turan' ? d.game : d; // a bare game object works too
  if (!g || !g.factions || !g.provinces || !g.player || !g.factions[g.player] || typeof g.turn !== 'number') return 'This is not a Turan save file.';
  if (Object.keys(g.provinces).some(id => !PROVINCE_DATA.some(p => p[0] === id))) return 'This save file is from a different version of the map.';
  MAPDATA = MAPDATA || buildMap();
  G = g;
  migrateProgress();
  return null;
}
function saveFileName() {
  const name = (FACTIONS[G.player].short || G.player).toString().replace(/[^A-Za-z0-9]+/g, '-');
  return `turan-${name}-${GAME.START_YEAR + Math.floor(G.turn / 2)}-${G.turn % 2 ? 'autumn' : 'spring'}.json`;
}

function saveMeta(slot) {
  try { return JSON.parse(localStorage.getItem('turan-save-' + slot + '-meta')); } catch (e) { return null; }
}
