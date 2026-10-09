'use strict';
// The other ways a realm grows: science, literature and the arts, trade, and the craft of government.
// Every nation earns progress in each of the four each turn, from its buildings, its trade, the
// scholars and poets at its court and the patronage the ruler pays for. Enough progress brings an
// advance with a lasting effect. A ruler who completes all four crowns a golden age: a peaceful victory.

const TRACKS = {
  science: {
    name: 'Science', color: '#6fc3ff',
    desc: 'Astronomy, mathematics, medicine and the learning of the madrasas.',
    advances: [
      { name: 'Paper of Samarkand', desc: 'Better records for the tax collectors: +5% tax income.' },
      { name: 'Houses of healing', desc: 'Hospitals in the great cities: armies at home recover twice as fast and towns grow 10% faster.' },
      { name: 'School of engineers', desc: 'Architects trained in geometry: all buildings cost 15% less.' },
      { name: 'Astronomical tables', desc: 'An exact calendar for fields, fairs and taxes: +10% tax income.' },
      { name: 'The great observatory', desc: 'The wonder of the learned world: +20% progress in all four fields.' },
    ],
  },
  culture: {
    name: 'Literature and arts', color: '#e6a0d0',
    desc: 'Poetry, history, calligraphy, painting and music.',
    advances: [
      { name: 'Court poets', desc: 'Verses in praise of your reign are recited in every bazaar: +2 public order everywhere.' },
      { name: 'The royal library', desc: 'Scribes copy your chronicles for foreign courts: every ruler thinks a little better of you each turn.' },
      { name: 'School of miniature painting', desc: 'Your painters are the envy of Persia: +4 more public order everywhere.' },
      { name: 'Golden age of verse', desc: 'Poets in Persian and Turki compete for your favour: other rulers value any deal with you more.' },
      { name: 'Capital of the arts', desc: 'The world comes to admire, not to fear: rivals are slower to unite against you, and +5 public order.' },
    ],
  },
  trade: {
    name: 'Trade and crafts', color: '#f0c463',
    desc: 'Caravans, coinage, guilds and the Silk Road.',
    advances: [
      { name: 'Caravanserais', desc: 'Inns on every road: trade agreements earn 30% more.' },
      { name: 'Silver tanga', desc: 'One good coin for the whole realm: +8% tax income.' },
      { name: 'Craft guilds', desc: 'Armourers and saddlers organised in guilds: soldiers cost 10% less to train.' },
      { name: 'Bills of exchange', desc: 'Merchants pay with paper instead of silver: a large treasury loses half as much, and only above 9,000 gold.' },
      { name: 'Crossroads of the world', desc: 'Every caravan from China to Castile passes through your cities: +12% tax income.' },
    ],
  },
  state: {
    name: 'Statecraft', color: '#8fd08a',
    desc: 'Law, the chancellery, post roads and the art of ruling many peoples.',
    advances: [
      { name: 'Courts of the qadis', desc: 'Justice in every city: +3 public order everywhere.' },
      { name: 'Post roads', desc: 'Relay stations carry your orders quickly: the realm can hold 4 more cities before it grows too large.' },
      { name: 'The divan', desc: 'A chancellery of trained officials: governors cost half as much and keep 4 more order.' },
      { name: 'The code of law', desc: 'One law for amir and peasant: revolts are half as likely.' },
      { name: 'Imperial administration', desc: 'A government that can rule half the world: 6 more cities before overstretch, and +3 public order.' },
    ],
  },
};
const TRACK_ORDER = ['science', 'culture', 'trade', 'state'];
// Progress needed for each advance, counted from the start
const ADV_COST = [60, 160, 320, 550, 850];
// What royal patronage costs each turn, and what it brings
const PATRONAGE = [
  { name: 'None', gold: 0, pts: 0 },
  { name: 'Modest', gold: 70, pts: 3 },
  { name: 'Generous', gold: 200, pts: 7 },
];
const SAGE_UPKEEP = 30, SAGE_PTS = 3;

// The learned men of the age who may come to a court: the field they serve and the years they are free to travel
const SAGES = {
  taftazani: { track: 'science', from: 1370, to: 1389 },
  jurjani: { track: 'science', from: 1374, to: 1413 },
  qadizada: { track: 'science', from: 1386, to: 1435 },
  kashi: { track: 'science', from: 1404, to: 1428 },
  hafez: { track: 'culture', from: 1370, to: 1389 },
  kamal: { track: 'culture', from: 1370, to: 1399 },
  maraghi: { track: 'culture', from: 1374, to: 1434 },
  abdalhayy: { track: 'culture', from: 1374, to: 1404 },
  lutfi: { track: 'culture', from: 1386, to: 1440 },
  shami: { track: 'culture', from: 1378, to: 1410 },
  yazdi: { track: 'culture', from: 1405, to: 1440 },
  ibnkhaldun: { track: 'state', from: 1395, to: 1405 },
  clavijo: { track: 'trade', from: 1400, to: 1411 },
};

// ---------- State ----------

function devOf(f) {
  const st = G.factions[f];
  if (!st.dev) {
    st.dev = {};
    for (const k of TRACK_ORDER) st.dev[k] = { pts: 0, lvl: 0, pat: 0 };
  }
  return st.dev;
}
// Has nation `f` reached advance `n` (1 to 5) in field `track`?
function hasAdv(f, track, n) {
  if (!f || f === 'rebels' || !G.factions[f]) return false;
  return devOf(f)[track].lvl >= n;
}
function sagesOf(f) { const st = G.factions[f]; return st.sages || (st.sages = []); }

// Old saves: give every city the new building
function migrateProgress() {
  for (const p of Object.values(G.provinces)) if (p.b.library === undefined) p.b.library = 0;
}

// ---------- Where progress comes from ----------

function patronageCost(f, track) { return PATRONAGE[devOf(f)[track].pat].gold; }
function totalPatronage(f) { return TRACK_ORDER.reduce((s, k) => s + patronageCost(f, k), 0); }

function devPoints(f) {
  const provs = provsOf(f), st = G.factions[f], d = devOf(f);
  const out = { science: 0, culture: 0, trade: 0, state: 0 };
  for (const p of provs) {
    out.science += p.b.madrasa * 0.4 + p.b.library * 0.8;
    out.culture += p.b.library * 1 + p.b.madrasa * 0.2 + (p.pop >= 40 ? 0.5 : 0);
    out.trade += p.b.market * 0.5 + (p.silk ? 0.4 : 0);
    out.state += (p.governor ? 1 : 0) + 0.15;
  }
  const cap = G.provinces[st.capital];
  if (cap && cap.owner === f) { out.culture += 1; out.state += 1.5; out.science += 0.5; }
  for (const g of POWERS) if (g !== f && G.factions[g].alive && rel(f, g).trade) out.trade += 1;
  for (const id in WONDERS) if (hasWonder(f, id)) out.culture += 2;
  for (const s of sagesOf(f)) out[SAGES[s].track] += SAGE_PTS;
  for (const k of TRACK_ORDER) {
    out[k] += PATRONAGE[d[k].pat].pts + traitDev(f, k);
    if (hasAdv(f, 'science', 5)) out[k] *= 1.2;
    out[k] = Math.round(out[k] * 10) / 10;
  }
  return out;
}

// ---------- Effects of the advances (read by the rest of the engine) ----------

function devTaxMult(f) {
  return 1 + (hasAdv(f, 'science', 1) ? 0.05 : 0) + (hasAdv(f, 'science', 4) ? 0.1 : 0)
    + (hasAdv(f, 'trade', 2) ? 0.08 : 0) + (hasAdv(f, 'trade', 5) ? 0.12 : 0);
}
function devOrder(p) {
  const f = p.owner;
  return (hasAdv(f, 'culture', 1) ? 2 : 0) + (hasAdv(f, 'culture', 3) ? 4 : 0) + (hasAdv(f, 'culture', 5) ? 5 : 0)
    + (hasAdv(f, 'state', 1) ? 3 : 0) + (hasAdv(f, 'state', 5) ? 3 : 0) + (p.governor && hasAdv(f, 'state', 3) ? 4 : 0);
}
function buildCost(p, key, lvl) {
  return Math.round(BUILDINGS[key].cost[lvl] * (hasAdv(p.owner, 'science', 3) ? 0.85 : 1) * traitBuild(p.owner));
}
const stretchFrom = f => STRETCH_FROM + (hasAdv(f, 'state', 2) ? 4 : 0) + (hasAdv(f, 'state', 5) ? 6 : 0);
const governorUpkeep = f => GOVERNOR_UPKEEP * (hasAdv(f, 'state', 3) ? 0.5 : 1);
const revoltMult = f => hasAdv(f, 'state', 4) ? 0.5 : 1;
const prestigeBonus = f => hasAdv(f, 'culture', 4) ? 10 : 0;

// ---------- Each turn ----------

function devTurn() {
  for (const f of POWERS) {
    const st = G.factions[f];
    if (!st.alive) continue;
    const d = devOf(f);
    // Patronage stops when the treasury is empty
    for (const k of TRACK_ORDER) if (d[k].pat && st.gold < patronageCost(f, k)) d[k].pat = 0;
    st.gold -= totalPatronage(f);
    const pts = devPoints(f);
    for (const k of TRACK_ORDER) {
      d[k].pts += pts[k];
      while (d[k].lvl < 5 && d[k].pts >= ADV_COST[d[k].lvl]) advance(f, k);
    }
    // The ruler of a cultured realm is admired abroad
    if (hasAdv(f, 'culture', 2)) for (const g of POWERS) if (g !== f && G.factions[g].alive) { const r = rel(f, g); r.att = Math.min(100, r.att + 0.5); }
    if (!isHuman(f)) aiPatronage(f);
  }
  sagesTurn();
}

function advance(f, k) {
  const d = devOf(f)[k];
  d.lvl++;
  const A = TRACKS[k].advances[d.lvl - 1];
  log(() => dateText() + ': ' + t('{nation}: a new advance in {field}: {name}.', { nation: fName(f), field: t(TRACKS[k].name), name: t(A.name) }), f === G.player ? 'history' : '');
  if (isHuman(f)) {
    tell(f, { sound: 'fanfare', title: t(A.name), text: t('A new advance in {field}.', { field: t(TRACKS[k].name) }) + ' ' + t(A.desc), history: true });
    if (TRACK_ORDER.every(x => devOf(f)[x].lvl >= 5)) G.goldenAge = G.goldenAge || G.turn;
  }
}

// Rival rulers fund the arts when they can afford it
function aiPatronage(f) {
  const st = G.factions[f], d = devOf(f);
  const net = (st.lastIncome || 0) - (st.lastUpkeep || 0) - totalPatronage(f);
  if (st.gold < 1200 || net < 0) { for (const k of TRACK_ORDER) d[k].pat = 0; return; }
  if (st.gold > 2500 && net > 300) {
    const k = TRACK_ORDER.filter(x => d[x].pat === 0 && d[x].lvl < 5)[0];
    if (k) d[k].pat = 1;
  }
}

// ---------- Scholars and poets ----------

function sageFree(id) {
  const S = SAGES[id], c = CHAR_BY_ID[id];
  if (!S || !c) return false;
  if (year() < S.from || year() > S.to || year() >= c.died) return false;
  return !POWERS.some(f => sagesOf(f).includes(id)) && !(G.sagesGone || []).includes(id);
}

function sagesTurn() {
  // Death takes them in their historical years
  for (const f of POWERS) {
    const list = sagesOf(f);
    for (const id of list.slice()) {
      const c = CHAR_BY_ID[id];
      if (year() < c.died && G.factions[f].alive) continue;
      list.splice(list.indexOf(id), 1);
      (G.sagesGone = G.sagesGone || []).push(id);
      if (isHuman(f) && year() >= c.died) tell(f, { title: t('{name} has died', { name: pn(c.name) }), text: t('Your court mourns {name}. His work will be read for centuries.', { name: pn(c.name) }), who: id });
    }
  }
  // Rich rival courts attract the free ones
  for (const f of POWERS) {
    if (isHuman(f) || !G.factions[f].alive || G.factions[f].gold < 1500 || rng() > 0.05) continue;
    const free = Object.keys(SAGES).filter(sageFree);
    if (!free.length) continue;
    const id = pick(free);
    sagesOf(f).push(id);
    log(() => t('{name} joins the court of {nation}.', { name: pn(CHAR_BY_ID[id].name), nation: fName(f) }), '');
  }
}

// A scholar or poet asks to serve the player (shown like a story)
function sageStory(id) {
  const c = CHAR_BY_ID[id], S = SAGES[id];
  return {
    who: () => id, whoFaction: () => null, title: 'A visitor at the gate',
    text: ctx => t('{name} has come to {city} and asks for a place at your court.', { name: pn(c.name), city: cityOf(ctx.cap || ctx.p) }) + ' ' + t(c.bio) + ' ' +
      t('At your court he would advance {field} (+{k} a turn), for a stipend of {n} gold a turn.', { field: t(TRACKS[S.track].name), n: SAGE_UPKEEP, k: SAGE_PTS }),
    options: [
      { label: ctx => t('Welcome him with a robe of honour (−{n} gold)', { n: 150 }), hint: 'He joins your court.',
        act: ctx => { ctx.st.gold -= 150; sagesOf(ctx.f).push(id); HOOKS.notify({ scene: { kind: 'scholar', id } }); log(() => dateText() + ': ' + t('{name} joins your court.', { name: pn(c.name) }), 'history'); return t('{name} bows and kisses the carpet before your throne.', { name: pn(c.name) }); } },
      { label: () => t('Send him on his way'), hint: 'He will look for another patron.',
        act: () => { const rivals = POWERS.filter(f => !isHuman(f) && G.factions[f].alive); if (rivals.length) sagesOf(pick(rivals)).push(id); return t('{name} takes the road to another court.', { name: pn(c.name) }); } },
    ],
  };
}

function pickSage() {
  const f = G.player, st = G.factions[f];
  if (!st.alive || G.turn < 2 || rng() > 0.14) return null;
  const free = Object.keys(SAGES).filter(sageFree);
  if (!free.length) return null;
  const id = pick(free);
  return { story: sageStory(id), ctx: storyContext(f) };
}

// ---------- The golden age ----------

function goldenAgeNow(f = G.player) { return TRACK_ORDER.every(k => devOf(f)[k].lvl >= 5); }
