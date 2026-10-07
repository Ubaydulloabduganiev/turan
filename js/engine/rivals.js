'use strict';
// Rulers with memories, and the troubles of a great empire. Every nation has a reputation that rises
// when it keeps its word and falls when it betrays. A nation that grows too large frightens the others
// into a coalition, strains its own provinces, and may split apart when its ruler dies.

// ---------- Reputation ----------

function trustOf(f) {
  const st = G.factions[f];
  if (st.trust === undefined) st.trust = 50;
  return st.trust;
}
function shiftTrust(f, d) {
  if (!G.factions[f] || f === 'rebels') return;
  G.factions[f].trust = clampN(trustOf(f) + d, 0, 100);
}
const TRUST_WORDS = ['Oath-breaker', 'Faithless', 'Doubted', 'Trusted', 'Honourable'];
function trustWord(f) { const v = trustOf(f); return TRUST_WORDS[v >= 75 ? 4 : v >= 45 ? 3 : v >= 30 ? 2 : v >= 15 ? 1 : 0]; }

// How much a deal offered by `from` is worth more or less because of `from`'s name
function trustBonus(from, type) {
  const k = { alliance: 0.5, marriage: 0.4, trade: 0.3, peace: 0.2 }[type] || 0;
  return (trustOf(from) - 50) * k;
}

// ---------- The size of a realm ----------

const totalProvinces = () => Object.keys(G.provinces).length;
function dominance(f) { return provsOf(f).length / totalProvinces(); }
// The nation with the most land
function leadingNation() {
  let best = null, n = 0;
  for (const f of PLAYABLE) { if (!G.factions[f].alive) continue; const k = provsOf(f).length; if (k > n) { n = k; best = f; } }
  return best;
}
// Every city beyond the fourteenth is harder to govern
const STRETCH_FROM = 14;
function overstretch(f) {
  if (f === 'rebels' || !G.factions[f]) return 0;
  const n = provsOf(f).length;
  return Math.min(18, Math.max(0, n - STRETCH_FROM) * 0.7);
}

// ---------- Each turn ----------

function rivalsTurn() {
  // Reputation slowly heals, and kept alliances earn respect
  for (const f of PLAYABLE) {
    if (!G.factions[f].alive) continue;
    const allies = PLAYABLE.filter(g => g !== f && G.factions[g].alive && rel(f, g).alliance).length;
    shiftTrust(f, (50 - trustOf(f)) * 0.02 + Math.min(1, allies * 0.3));
  }
  // Fear of the strongest
  const L = leadingNation();
  if (L) {
    const d = dominance(L);
    if (d > 0.25) for (const g of PLAYABLE) {
      if (g === L || !G.factions[g].alive) continue;
      const r = rel(g, L);
      r.att = clampN(r.att - (d - 0.25) * 12 - (r.married ? 0 : 0.5), -100, 100);
    }
  }
  coalitionTurn(L);
}

// ---------- Coalitions ----------

function coalitionTurn(L) {
  const c = G.coalition;
  if (c) {
    // It breaks up when the danger has passed, or after twenty seasons
    if (!G.factions[c.target].alive || dominance(c.target) < 0.22 || G.turn - c.turn > 20 || c.members.filter(m => G.factions[m].alive).length < 1) {
      G.coalition = null;
      log(dateText() + ': ' + t('The coalition against the {nation} breaks up.', { nation: fFull(c.target) }), c.target === G.player ? 'dip' : '');
      if (c.target === G.player) HOOKS.notify({ minor: true, title: t('The coalition breaks up'), text: t('Our enemies no longer fight as one.') });
    }
    return;
  }
  if (!L || G.turn < 10 || dominance(L) < 0.3) return;
  if (G.lastCoalition !== undefined && G.turn - G.lastCoalition < 16) return;
  if (rng() > 0.35) return;
  // At most four: the strongest of those who fear and dislike the leader
  const members = PLAYABLE.filter(g => g !== L && G.factions[g].alive && rel(g, L).att < 15 && !(rel(g, L).married && rel(g, L).att > 0) && g !== G.player)
    .sort((a, b) => factionPower(b) - factionPower(a)).slice(0, 4);
  if (members.length < 2) return;
  G.coalition = { target: L, members, turn: G.turn };
  G.lastCoalition = G.turn;
  // The members make peace among themselves, swear an alliance and march together
  for (const a of members) for (const b of members) {
    if (a >= b) continue;
    const r = rel(a, b);
    if (r.war) applyDeal(a, b, 'peace');
    r.alliance = true; r.att = Math.max(r.att, 30);
  }
  for (const m of members) {
    G.factions[m].gold += 500; // subsidies from frightened merchants
    if (!rel(m, L).war) declareWar(m, L, true);
  }
  const names = members.map(m => fName(m)).join(', ');
  log(dateText() + ': ' + t('{list} form a grand coalition against the {nation}.', { list: names, nation: fFull(L) }), 'war');
  if (L === G.player) HOOKS.notify({ sound: 'horn', title: t('A grand coalition!'), text: t('Our power frightens the other rulers. {list} have sworn an alliance and declared war on us together. Hold your borders and break them one by one: offer peace to the weakest.', { list: names }) });
  else HOOKS.notify({ minor: true, title: t('A grand coalition'), text: t('{list} have joined together against the {nation}.', { list: names, nation: fFull(L) }) });
}
const inCoalition = (a, b) => !!G.coalition && ((G.coalition.target === a && G.coalition.members.includes(b)) || (G.coalition.target === b && G.coalition.members.includes(a)));

// ---------- Rivals scheming ----------

// An ally that has grown much stronger, and cares little for its name, may turn on its friend
function aiBetray(f) {
  if (G.turn < 6) return false;
  for (const g of PLAYABLE) {
    if (g === f || !G.factions[g].alive) continue;
    const r = rel(f, g);
    if (!r.alliance || r.married) continue;
    const ratio = (factionPower(f) + 40) / (factionPower(g) + 40);
    if (ratio < 2.2 || r.att > 25 || trustOf(f) > 65) continue;
    if (!neighbourFactions(f).has(g)) continue;
    if (rng() < AGGRESSION[f] * 0.06) { declareWar(f, g); return true; }
  }
  return false;
}

// Allies call on each other when they are at war
function aiCallAllies(f) {
  for (const e of PLAYABLE) {
    if (e === f || !G.factions[e].alive || !rel(f, e).war) continue;
    for (const g of PLAYABLE) {
      if (g === f || g === e || g === G.player || !G.factions[g].alive || !rel(f, g).alliance || rel(g, e).war || rel(g, e).alliance || rel(g, e).truce > 0) continue;
      if (dealValue(f, g, 'joinwar', e) > 0 && rng() < 0.2) {
        declareWar(g, e, true);
        log(t('{nation} answers the call of its ally {nation2} and joins the war.', { nation: fName(g), nation2: fName(f) }), 'war');
      }
    }
  }
}

// What an AI ruler asks of the player besides the usual offers. Returns { type, gold, city } or null.
function aiSpecialOffer(f, chance) {
  const pl = G.player, r = rel(f, pl);
  // An ally at war asks the player to join in
  if (r.alliance && chance < 0.3) {
    const e = PLAYABLE.find(e => e !== f && e !== pl && G.factions[e].alive && rel(f, e).war && !rel(pl, e).war && !rel(pl, e).alliance && !rel(pl, e).married && rel(pl, e).truce <= 0);
    if (e) return { type: 'joinwar', gold: 0, enemy: e };
  }
  // A much stronger neighbour that dislikes us demands a border town
  if (!r.war && r.att < -10 && r.truce <= 0 && neighbourFactions(f).has(pl) && chance < 0.06 * AGGRESSION[f]
    && (factionPower(f) + 40) / (factionPower(pl) + 40) > 1.8) {
    const city = provsOf(pl).filter(p => p.adj.some(n => G.provinces[n].owner === f) && G.factions[pl].capital !== p.id).sort((a, b) => a.pop - b.pop)[0];
    if (city) return { type: 'demandcity', gold: 0, city };
  }
  return null;
}

function answerSpecialOffer(f, o, yes) {
  const pl = G.player, r = rel(f, pl);
  if (o.type === 'joinwar') {
    if (yes) { declareWar(pl, o.enemy, true); r.att += 12; shiftTrust(pl, 6); log(t('{nation} answers the call of its ally {nation2} and joins the war.', { nation: fName(pl), nation2: fName(f) }), 'war'); }
    else { r.att -= 12; shiftTrust(pl, -6); }
  } else if (o.type === 'demandcity') {
    if (yes) { transferProvince(o.city, f, 10); r.att += 6; r.truce = Math.max(r.truce, 6); }
    else if (rng() < AGGRESSION[f] * 0.8) declareWar(f, pl);
    else r.att -= 8;
  }
}

// ---------- A ruler dies ----------

// When the ruler of a great realm dies, the amirs of the far provinces test the new one
function successionTrouble(f) {
  if (provsOf(f).length < 8) return;
  if (f === G.player) { G.crisis = { kind: 'succession', turn: G.turn }; return; }
  if (rng() < 0.6) breakAway(f, 1 + Math.floor(rng() * 2));
}

// The provinces furthest from the capital and least loyal rise against the crown
function breakAway(f, n) {
  const dist = distancesFrom(f), cap = G.factions[f].capital;
  const list = provsOf(f).filter(p => p.id !== cap && !p.siege)
    .map(p => ({ p, s: (dist[p.id] === undefined ? 10 : dist[p.id]) * 6 - provinceOrder(p, dist) }))
    .sort((a, b) => b.s - a.s).slice(0, n);
  for (const x of list) revolt(x.p);
  return list.map(x => x.p);
}

// ---------- Crises the player must decide ----------

const CRISES = {
  succession: {
    who: c => c.st.leader, title: 'The amirs test the new ruler',
    text: c => t('{name} has taken the throne, but the amirs of the far provinces whisper that he is not the man his father was. Some are already sharpening their swords.', { name: pn(c.st.leader) }),
    options: [
      { label: c => t('Buy their loyalty (−{n} gold)', { n: cost(c, 500) }), hint: 'The amirs swear allegiance, and order returns.',
        act: c => { c.st.gold -= cost(c, 500); c.st.orderBonus = 8; c.st.orderBonusT = 4; return t('Robes of honour and chests of silver quiet every tongue.'); } },
      { label: () => t('Call a kurultai'), hint: 'Half the time the amirs acclaim you; otherwise the boldest of them rebel.',
        act: c => { if (rng() < 0.5) { c.st.orderBonus = 12; c.st.orderBonusT = 6; shiftTrust(c.f, 5); return t('The amirs raise the new ruler on a white felt, as in the days of Chinggis Khan.'); } const lost = breakAway(c.f, 2); return t('The kurultai ends in shouting. {list} rise in revolt.', { list: lost.map(cityOf).join(', ') || '—' }); } },
      { label: () => t('Strike first'), hint: 'The far provinces rise now, but those who stay loyal will fear you.',
        act: c => { const lost = breakAway(c.f, 2); c.st.orderBonus = 15; c.st.orderBonusT = 6; return t('{list} rise in revolt, but every other city bows its head.', { list: lost.map(cityOf).join(', ') || '—' }); } },
    ],
  },
  general: {
    who: c => c.army.general.name, title: 'A general grows too proud',
    text: c => t('{name} commands a great army at {city}, far from your court. His men cheer him louder than they cheer you, and he no longer answers your letters.', { name: pn(c.army.general.name), city: cityOf(G.provinces[c.army.prov]) }),
    options: [
      { label: c => t('Shower him with gifts (−{n} gold)', { n: cost(c, 400) }), hint: 'He stays loyal, for now.',
        act: c => { c.st.gold -= cost(c, 400); return t('{name} sends back a letter full of praise for your generosity.', { name: pn(c.army.general.name) }); } },
      { label: () => t('Summon him to court'), hint: 'If he comes, he is yours for good. If not, he rebels with his army.',
        act: c => { if (rng() < 0.55) { c.army.general.cmd = Math.min(6, c.army.general.cmd + 1); return t('{name} rides to court and kneels before the throne.', { name: pn(c.army.general.name) }); } return generalRebels(c.army); } },
      { label: () => t('Give him the city to rule'), hint: 'The city leaves your realm, but the army stays with you.',
        act: c => { const p = G.provinces[c.army.prov], name = c.army.general.name; c.army.general = null; c.army.units = c.army.units.filter(u => u.type !== 'general'); revolt(p); return t('{name} rules {city} as his own. At least his soldiers stay with you.', { name: pn(name), city: cityOf(p) }); } },
    ],
  },
};

function generalRebels(a) {
  const p = G.provinces[a.prov], name = a.general.name;
  a.general.leader = false;
  revolt(p);
  if (G.armies[a.id]) { a.owner = 'rebels'; a.besieging = false; a.prov = p.id; }
  else addArmy('rebels', p.id, a.units.filter(u => u.type !== 'general'), null);
  return t('{name} refuses to come and raises his own banner at {city}, with all his men.', { name: pn(name), city: cityOf(p) });
}

// This turn's crisis for the player, if any (it comes before the ordinary stories)
function pickCrisis() {
  const f = G.player, st = G.factions[f];
  if (!st.alive) return null;
  const c = storyContext(f);
  if (G.crisis && G.crisis.kind === 'succession') { G.crisis = null; return { story: CRISES.succession, ctx: c }; }
  // A proud general, in a large realm
  if (provsOf(f).length >= 14 && (G.lastGeneralCrisis === undefined || G.turn - G.lastGeneralCrisis > 10) && rng() < 0.08) {
    const dist = distancesFrom(f);
    const a = armiesOf(f).filter(a => a.general && !a.general.leader && a.units.length >= 4 && G.provinces[a.prov].owner === f && (dist[a.prov] || 0) >= 3 && G.provinces[a.prov].id !== st.capital)[0];
    if (a) { G.lastGeneralCrisis = G.turn; return { story: CRISES.general, ctx: { ...c, army: a } }; }
  }
  return null;
}
