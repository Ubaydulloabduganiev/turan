'use strict';
// The first deeds of a new reign: a short chain of clear goals with quick rewards, so a new ruler always knows
// what to do in the first turns of the grand campaign. When the chain is done, the council takes over.

const FIRST_DEEDS = [
  { id: 'take', reward: 600,
    make: f => {
      // The weakest independent city on the border, or else the weakest enemy one
      const near = new Set();
      for (const p of provsOf(f)) for (const n of p.adj) if (G.provinces[n].owner !== f) near.add(n);
      const weak = p => p.b.walls * 25 + armiesIn(p.id).reduce((s, a) => s + armyPower(a), 0) + p.pop * 0.3;
      const list = [...near].map(id => G.provinces[id]).filter(p => p.owner === 'rebels').sort((a, b) => weak(a) - weak(b));
      const enemy = [...near].map(id => G.provinces[id]).filter(p => p.owner !== 'rebels' && atWar(f, p.owner)).sort((a, b) => weak(a) - weak(b));
      const p = list[0] || enemy[0];
      return p ? { target: p.id } : null;
    },
    text: c => t(G.provinces[c.target].owner === 'rebels' ? 'Take {city}, an independent city on your border. Select an army and tap the city.' : 'Take {city} from your enemy. Select an army and tap the city.', { city: cityById(c.target) }),
    done: (f, c) => G.provinces[c.target].owner === f, where: c => c.target },
  { id: 'recruit', reward: 300,
    make: () => ({ base: feats('recruited') }),
    text: () => t('Train two new units: open one of your cities and choose the Army tab.'),
    done: (f, c) => feats('recruited') - c.base + provsOf(f).reduce((n, p) => n + p.queue.length, 0) >= 2, where: (c, f) => G.factions[f].capital },
  { id: 'build', reward: 350,
    make: () => ({ base: feats('built') }),
    text: () => t('Start a new building in one of your cities: a bazaar brings gold, a library brings learning.'),
    done: (f, c) => feats('built') > c.base || provsOf(f).some(p => p.build), where: (c, f) => G.factions[f].capital },
  { id: 'friend', reward: 400,
    make: () => ({}),
    text: () => t('Make a friend: sign a trade agreement or an alliance with another ruler. Open Diplomacy at the top of the screen.'),
    done: f => POWERS.some(g => g !== f && G.factions[g].alive && (rel(f, g).trade || rel(f, g).alliance)), dip: true },
  { id: 'win', reward: 500,
    make: f => ({ base: G.stats[f].won }),
    text: () => t('Win a battle against any enemy.'),
    done: (f, c) => G.stats[f].won > c.base },
];

// Starts the chain for a ruler in a new grand campaign
function startDeeds(f) {
  G.factions[f].deeds = { i: -1 };
  nextDeed(f);
}
function nextDeed(f) {
  const d = G.factions[f].deeds;
  for (d.i++; d.i < FIRST_DEEDS.length; d.i++) {
    const c = FIRST_DEEDS[d.i].make(f);
    if (c && !FIRST_DEEDS[d.i].done(f, c)) { d.ctx = c; return; }
  }
  d.finished = true; d.ctx = null;
  G.factions[f].nextMission = G.turn + 1; // the council speaks from now on
}
const deedsActive = f => { const d = G.factions[f] && G.factions[f].deeds; return !!(d && !d.finished); };
// The goal in front of the ruler now: { deed, ctx, n, of }
function currentDeed(f) {
  if (!deedsActive(f)) return null;
  const d = G.factions[f].deeds;
  return { deed: FIRST_DEEDS[d.i], ctx: d.ctx, n: d.i + 1, of: FIRST_DEEDS.length };
}
// Called after every action and at the start of each turn. Returns the deed just done, if any.
function checkDeeds(f) {
  const cur = currentDeed(f);
  if (!cur || !cur.deed.done(f, cur.ctx)) return null;
  G.factions[f].gold += cur.deed.reward;
  const st = G.factions[f];
  st.orderBonus = Math.max(st.orderBonus, 4); st.orderBonusT = Math.max(st.orderBonusT, 2);
  log(dateText() + ': ' + t('A first deed is done: {deed} {n} gold.', { deed: cur.deed.text(cur.ctx), n: cur.deed.reward }), 'good');
  nextDeed(f);
  return cur;
}
