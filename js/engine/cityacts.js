'use strict';
// Everything a ruler can do with a single city: run it, tax it, give it away, sell it, burn it — or,
// for someone else's city, buy it, demand it, bribe its elders, or work on it in secret.
// Each action: { id, group, own (true: your city, false: a foreign one), name, desc, cost(p), check(p), act(p, nation) }
// check() returns the reason it is impossible, or null. act() returns what happened.
// Actions with `pick` need a nation chosen: pick(p) lists the candidates.

const TAX_LEVELS = ['Low', 'Normal', 'High', 'Crushing'];
const TAX_INCOME = [0.6, 1, 1.4, 1.85];
const TAX_ORDER = [12, 0, -18, -34];
const TAX_GROWTH = [0.004, 0, -0.004, -0.009];
const GOVERNOR_UPKEEP = 30;

function taxOf(p) { const f = G.factions[p.owner]; return p.tax !== undefined && p.tax !== null ? p.tax : (f ? f.tax : 1); }
function setCityTax(p, lvl) { p.tax = lvl === null ? null : clampN(lvl, 0, 3); }

// What a city is worth to a buyer
function cityPrice(p) { return Math.round((300 + p.pop * 45 + p.b.walls * 150 + (p.silk ? 300 : 0) + (landmarkIn(p.id) ? 500 : 0)) / 50) * 50; }

// Hands a city to another nation without a battle
function transferProvince(p, to, unrest = 20) {
  const old = p.owner;
  p.owner = to;
  p.siege = null; p.queue = []; p.build = null; p.tax = null; p.taxFree = 0; p.governor = false;
  p.unrest = Math.max(p.unrest, unrest);
  for (const a of armiesIn(p.id)) {
    if (a.owner !== old) continue;
    const home = nearestOwnProvince(a);
    if (home) { a.prov = home; a.besieging = false; } else delete G.armies[a.id];
  }
  if (old !== 'rebels' && G.factions[old].capital === p.id) {
    const rest = provsOf(old).sort((x, y) => y.pop - x.pop);
    G.factions[old].capital = rest.length ? rest[0].id : null;
  }
  if (to !== 'rebels' && !G.factions[to].capital) G.factions[to].capital = p.id;
  if (old !== 'rebels') checkFactionAlive(old);
}

// Rulers who could receive a city: alive, and not you
const otherRulers = () => PLAYABLE.filter(f => f !== G.player && G.factions[f].alive);
const neighbourRulers = p => otherRulers().filter(f => p.adj.some(n => G.provinces[n].owner === f) || provsOf(f).some(q => q.adj.includes(p.id)));

const isCapital = p => p.owner !== 'rebels' && G.factions[p.owner].capital === p.id;
const lastCity = p => provsOf(p.owner).length <= 1;
const covertDone = p => p.covert === G.turn ? 'Your agents are already at work in this city this turn' : null;
const myGold = () => G.factions[G.player].gold;
const chance = x => rng() < x;

const CITY_ACTIONS = [
  // ---------- Your city: the treasury ----------
  { id: 'taxfree', sub: () => t('No tax for 2 turns · +order'), group: 'Treasury', own: true, name: 'Tax-free year', desc: 'No taxes from this city for two turns. The people bless your name and the city grows calmer.',
    cost: () => 0, check: p => p.taxFree > 0 ? 'The city is already free of taxes' : null,
    act: p => { p.taxFree = 2; p.unrest = Math.max(-20, p.unrest - 10); return t('Criers announce that {city} will pay no taxes this year. The streets fill with thanks.', { city: cityOf(p) }); } },
  { id: 'grain', group: 'Treasury', own: true, name: 'Open the granaries', desc: 'Hand out grain to the poor. Order rises and the city grows faster.',
    cost: p => Math.round(40 + p.pop * 4), check: p => myGold() < Math.round(40 + p.pop * 4) ? 'Not enough gold' : p.grain === G.turn ? 'The granaries are already open' : null,
    act: p => { p.grain = G.turn; p.unrest = Math.max(-20, p.unrest - 12); p.pop *= 1.02; return t('Bread and rice are handed out at the city gates of {city}.', { city: cityOf(p) }); } },
  { id: 'fair', group: 'Treasury', own: true, name: 'Hold a great fair', desc: 'Invite merchants from every land. If the city is calm, the fair pays back half again what it cost in two turns; if not, you may lose money.',
    cost: () => 200, check: p => myGold() < 200 ? 'Not enough gold' : p.fair > G.turn ? 'A fair is already being held' : null,
    act: p => { const ok = provinceOrder(p, distancesFrom(p.owner)) >= 50; p.fair = G.turn + 2; later(p.owner, 2, ok ? 300 + (p.silk ? 150 : 0) : 120, t('The fair at {city} closes. The merchants pay their fees.', { city: cityOf(p) })); return t(ok ? 'Merchants from far and wide set up their stalls in {city}.' : 'Merchants come to {city}, but the unrest keeps many away.', { city: cityOf(p) }); } },
  { id: 'loan', sub: () => t('+500 now · −700 in 4 turns'), group: 'Treasury', own: true, name: 'Borrow from the merchants', desc: 'The merchants of the city lend you 500 gold now. You repay 700 in four turns.',
    cost: () => 0, check: p => p.pop < 12 ? 'The city is too small to lend so much' : (G.factions[p.owner].pending || []).some(x => x.loan) ? 'You already owe the merchants' : null,
    act: p => { const st = G.factions[p.owner]; st.gold += 500; st.pending = st.pending || []; st.pending.push({ t: G.turn + 4, gold: -700, text: t('You repay the merchants of {city}: 700 gold.', { city: cityOf(p) }), loan: true }); return t('The merchants of {city} count out 500 gold for you.', { city: cityOf(p) }); } },

  // ---------- Your city: government ----------
  { id: 'governor', group: 'Government', own: true, name: 'Appoint a governor', desc: 'A trusted amir runs the city: +8 order and +10% income, for 30 gold a turn.',
    cost: () => 150, check: p => p.governor ? 'The city already has a governor' : myGold() < 150 ? 'Not enough gold' : null,
    act: p => { p.governor = true; return t('{name} takes up residence in the citadel of {city}.', { name: pn(newGeneralName(p.owner)), city: cityOf(p) }); } },
  { id: 'dismiss', sub: () => t('+30 gold a turn'), group: 'Government', own: true, name: 'Dismiss the governor', desc: 'Save his salary. The city loses his care.',
    cost: () => 0, check: p => p.governor ? null : 'There is no governor here',
    act: p => { p.governor = false; return t('The governor of {city} is sent home.', { city: cityOf(p) }); } },
  { id: 'capital', group: 'Government', own: true, name: 'Move the capital here', desc: 'Rule from this city. Provinces near it become easier to keep in order; those far away, harder.',
    cost: () => 600, check: p => isCapital(p) ? 'This is already your capital' : p.siege ? 'Under siege' : myGold() < 600 ? 'Not enough gold' : null,
    act: p => { const st = G.factions[p.owner]; st.capital = p.id; st.orderBonus = Math.max(st.orderBonus, -6); return t('The court, the treasury and the archives move to {city}. It is now your capital.', { city: cityOf(p) }); } },
  { id: 'amnesty', sub: () => t('+order'), group: 'Government', own: true, name: 'Pardon the prisoners', desc: 'Open the prisons. The people rejoice; a few rogues return to the streets.',
    cost: () => 0, check: p => p.amnesty > G.turn - 6 ? 'You pardoned them recently' : null,
    act: p => { p.amnesty = G.turn; p.unrest -= 10; if (chance(0.25)) { p.pop *= 0.99; return t('The pardoned men of {city} celebrate. Some go straight back to thieving.', { city: cityOf(p) }); } return t('Families in {city} embrace their pardoned sons.', { city: cityOf(p) }); } },
  { id: 'resettle', group: 'Government', own: true, name: 'Resettle families to the capital', desc: 'Move a tenth of the people to your capital. The capital grows; this city resents it.',
    cost: () => 50, check: p => isCapital(p) ? 'This is your capital' : !G.factions[p.owner].capital ? 'You have no capital' : p.pop < 6 ? 'Too few people' : myGold() < 50 ? 'Not enough gold' : null,
    act: p => { const cap = G.provinces[G.factions[p.owner].capital], n = p.pop * 0.1; p.pop -= n; cap.pop += n; p.unrest += 12; return t('{n} thousand people are moved from {city} to {capital}.', { n: Math.round(n), city: cityOf(p), capital: cityOf(cap) }); } },

  // ---------- Your city: give it away ----------
  { id: 'gift', sub: () => t('Great goodwill'), group: 'Give away', own: true, pick: neighbourRulers, name: 'Give the city as a gift', desc: 'Hand the city to another ruler. They will be deeply grateful, and an enemy may accept peace.',
    cost: () => 0, check: p => lastCity(p) ? 'It is your last city' : isCapital(p) ? 'You cannot give away your capital' : !neighbourRulers(p).length ? 'No ruler nearby to receive it' : null,
    act: (p, f) => { const r = rel(G.player, f); r.att = Math.min(100, r.att + 35 + Math.round(p.pop)); if (r.war && r.att > -10) applyDeal(G.player, f, 'peace'); transferProvince(p, f, 10); return t('The keys of {city} are carried to {ruler}, who receives them with delight.', { city: cityOf(p), ruler: pn(G.factions[f].leader) }); } },
  { id: 'sell', sub: p => t('Worth about {n} gold', { n: fmt(cityPrice(p)) }), group: 'Give away', own: true, pick: neighbourRulers, name: 'Sell the city', desc: 'Offer the city to another ruler for gold. They pay only what they think it is worth and can afford.',
    cost: () => 0, check: p => lastCity(p) ? 'It is your last city' : isCapital(p) ? 'You cannot sell your capital' : !neighbourRulers(p).length ? 'No ruler nearby to buy it' : null,
    act: (p, f) => {
      const r = rel(G.player, f), st = G.factions[f], price = cityPrice(p);
      if (r.war) return t('{ruler} laughs: why buy what he can take?', { ruler: pn(st.leader) });
      const pay = Math.min(price, Math.round(st.gold * 0.8));
      if (pay < price * 0.5 || r.att < -30) return t('{ruler} cannot or will not pay a fair price for {city}.', { ruler: pn(st.leader), city: cityOf(p) });
      st.gold -= pay; G.factions[G.player].gold += pay; r.att = Math.min(100, r.att + 10); transferProvince(p, f, 15);
      return t('{ruler} buys {city} for {n} gold.', { ruler: pn(st.leader), city: cityOf(p), n: fmt(pay) });
    } },
  { id: 'cede', sub: () => t('Ends a war'), group: 'Give away', own: true, pick: () => otherRulers().filter(f => rel(G.player, f).war), name: 'Surrender the city for peace', desc: 'Give the city to a ruler at war with you, in return for peace.',
    cost: () => 0, check: p => lastCity(p) ? 'It is your last city' : !otherRulers().some(f => rel(G.player, f).war) ? 'You are not at war with anyone' : null,
    act: (p, f) => { transferProvince(p, f, 25); applyDeal(G.player, f, 'peace'); rel(G.player, f).att += 15; return t('{city} is handed to {nation}. The war is over.', { city: cityOf(p), nation: fFull(f) }); } },
  { id: 'release', sub: () => t('+order in your other cities'), group: 'Give away', own: true, name: 'Grant the city independence', desc: 'Let the city rule itself. You lose it, but your other cities see your mercy.',
    cost: () => 0, check: p => lastCity(p) ? 'It is your last city' : isCapital(p) ? 'You cannot give up your capital' : null,
    act: p => { transferProvince(p, 'rebels', 0); for (const q of provsOf(G.player)) q.unrest -= 5; return t('{city} is free. Its elders thank you and close their gates.', { city: cityOf(p) }); } },
  { id: 'raze', sub: p => t('+{n} gold · the city is ruined', { n: fmt(Math.round(p.pop * 18)) }), group: 'Give away', own: true, danger: true, name: 'Raze the city', desc: 'Strip the city of its wealth and pull down its buildings. Much gold now; the city is ruined and every ruler is horrified.',
    cost: () => 0, check: p => p.pop < 5 ? 'There is little left to raze' : isCapital(p) ? 'You cannot raze your capital' : null,
    act: p => { shiftTrust(p.owner, -6); const g = Math.round(p.pop * 18); G.factions[G.player].gold += g; p.pop *= 0.45; for (const k of BUILDING_ORDER) p.b[k] = Math.max(0, p.b[k] - 1); p.unrest += 50; p.sacked = 8; for (const f of otherRulers()) rel(G.player, f).att -= 10; return t('{city} burns. Your soldiers carry off {n} gold.', { city: cityOf(p), n: fmt(g) }); } },

  // ---------- Someone else's city: open dealings ----------
  { id: 'buy', group: 'Dealings', own: false, name: 'Offer to buy the city', desc: 'Offer its ruler gold for the city.',
    cost: p => cityPrice(p), check: p => p.owner === 'rebels' ? 'Independent cities answer to no ruler' : rel(G.player, p.owner).war ? 'You are at war' : isCapital(p) ? 'No ruler sells his capital' : lastCity(p) ? 'It is their last city' : myGold() < cityPrice(p) ? 'Not enough gold' : rel(G.player, p.owner).asked === G.turn + ':buy' ? 'They have already given their answer this season' : null,
    act: p => {
      const f = p.owner, r = rel(G.player, f), st = G.factions[f], price = cityPrice(p);
      r.asked = G.turn + ':buy';
      const want = (r.att + 20) / 100 + (st.gold < 600 ? 0.25 : 0) + (provsOf(f).length > 8 ? 0.15 : 0) - (p.pop > 30 ? 0.25 : 0);
      if (!chance(want)) { r.att -= 3; return t('{ruler} will not sell {city}.', { ruler: pn(st.leader), city: cityOf(p) }); }
      feat('buycity');
      G.factions[G.player].gold -= price; st.gold += price; transferProvince(p, G.player, 15);
      return t('{ruler} accepts {n} gold. {city} is yours.', { ruler: pn(st.leader), n: fmt(price), city: cityOf(p) });
    } },
  { id: 'demand', sub: () => t('They may answer with war'), group: 'Dealings', own: false, danger: true, name: 'Demand the city', desc: 'Tell its ruler to hand the city over, or face war. Only the weak give in.',
    cost: () => 0, check: p => p.owner === 'rebels' ? 'Independent cities answer to no ruler' : isCapital(p) ? 'No ruler gives up his capital' : rel(G.player, p.owner).asked === G.turn + ':demand' ? 'They have already given their answer this season' : null,
    act: p => {
      const f = p.owner, r = rel(G.player, f), st = G.factions[f];
      r.asked = G.turn + ':demand';
      const ratio = (factionPower(G.player) + 40) / (factionPower(f) + 40);
      if (ratio > 2.2 && chance(Math.min(0.85, (ratio - 2) / 2 + 0.3))) { r.att -= 25; transferProvince(p, G.player, 30); return t('{ruler} dares not refuse. He hands over {city}.', { ruler: pn(st.leader), city: cityOf(p) }); }
      r.att -= 20;
      if (!r.war && chance(0.5)) { declareWar(f, G.player, true); return t('{ruler} answers with war!', { ruler: pn(st.leader) }); }
      return t('{ruler} tears up your letter.', { ruler: pn(st.leader) });
    } },
  { id: 'caravan', group: 'Dealings', own: false, name: 'Send a trade caravan', desc: 'Send goods to the city’s bazaar. Profit in two turns, and the ruler thinks better of you.',
    cost: () => 100, check: p => p.owner !== 'rebels' && rel(G.player, p.owner).war ? 'You are at war' : myGold() < 100 ? 'Not enough gold' : p.caravan > G.turn - 4 ? 'A caravan went there recently' : null,
    act: p => { p.caravan = G.turn; later(G.player, 2, 160 + (p.silk ? 80 : 0) + Math.round(p.pop * 2), t('Your caravan returns from {city} with its profits.', { city: cityOf(p) })); if (p.owner !== 'rebels') rel(G.player, p.owner).att += 3; return t('Camels laden with cloth and dried fruit set out for {city}.', { city: cityOf(p) }); } },

  // ---------- Someone else's city: in secret ----------
  { id: 'spy', group: 'Secret work', own: false, sub: () => t('See through the fog for 8 turns'), name: 'Plant a spy', desc: 'A merchant in your pay settles in the city and sends word of every army in it and on the roads around it.',
    cost: () => 80, check: p => spyThere(p.id) ? 'Your spy is already there' : myGold() < 80 ? 'Not enough gold' : null,
    act: p => { plantSpy(p.id); return t('Your spy has settled in {city}. For eight turns you will see every army in it and around it.', { city: cityOf(p) }); } },
  { id: 'bribe', group: 'Secret work', own: false, danger: true, name: 'Bribe the elders to change sides', desc: 'Pay the city’s elders to open their gates to you. Unhappy and independent cities are easier to win.',
    cost: p => Math.round(150 + p.pop * 30 + p.b.walls * 100), check: p => covertDone(p) || (isCapital(p) ? 'A capital will not be bought' : myGold() < Math.round(150 + p.pop * 30 + p.b.walls * 100) ? 'Not enough gold' : armiesIn(p.id).some(a => a.owner === p.owner) ? 'An army guards the city' : null),
    act: p => {
      p.covert = G.turn;
      const f = p.owner, o = f === 'rebels' ? 50 : provinceOrder(p, distancesFrom(f));
      const ch = clampN(0.75 - o / 140, 0.08, 0.7);
      if (chance(ch)) { if (f !== 'rebels') { rel(G.player, f).att -= 35; if (!rel(G.player, f).war && chance(0.4)) declareWar(f, G.player, true); } transferProvince(p, G.player, 25); return t('At night the elders of {city} open the gates. The city is yours.', { city: cityOf(p) }); }
      if (f !== 'rebels') rel(G.player, f).att -= 15;
      return t('The elders of {city} take your gold and betray your agents.', { city: cityOf(p) });
    } },
  { id: 'sabotage', group: 'Secret work', own: false, danger: true, name: 'Sabotage the walls', desc: 'Agents weaken the walls before an attack. They may be caught.',
    cost: () => 150, check: p => covertDone(p) || (!p.b.walls ? 'The city has no walls' : myGold() < 150 ? 'Not enough gold' : null),
    act: p => { p.covert = G.turn; if (chance(0.6)) { p.b.walls--; return t('A section of the walls of {city} collapses in the night.', { city: cityOf(p) }); } if (p.owner !== 'rebels') rel(G.player, p.owner).att -= 15; return t('Your agents are caught near the walls of {city}.', { city: cityOf(p) }); } },
  { id: 'incite', group: 'Secret work', own: false, danger: true, name: 'Stir up unrest', desc: 'Pay agitators to turn the people against their ruler. The city may even revolt.',
    cost: () => 120, check: p => covertDone(p) || (p.owner === 'rebels' ? 'There is no ruler to turn them against' : myGold() < 120 ? 'Not enough gold' : null),
    act: p => { p.covert = G.turn; if (chance(0.7)) { p.unrest += 25; return t('Angry crowds gather in the bazaars of {city}.', { city: cityOf(p) }); } rel(G.player, p.owner).att -= 12; return t('The agitators are arrested in {city} and confess who paid them.', { city: cityOf(p) }); } },
  { id: 'preachers', group: 'Secret work', own: false, name: 'Send wandering dervishes', desc: 'Dervishes preach of your justice in the city’s mosques. Cheap and rarely noticed.',
    cost: () => 60, check: p => covertDone(p) || (myGold() < 60 ? 'Not enough gold' : null),
    act: p => { p.covert = G.turn; p.unrest += 8; p.love = (p.love || 0) + 1; return t('Dervishes in {city} sing the praises of your just rule.', { city: cityOf(p) }); } },
  { id: 'assassin', group: 'Secret work', own: false, danger: true, name: 'Send an assassin', desc: 'Strike at the general who commands here. Few assassins return.',
    cost: () => 300, check: p => covertDone(p) || (!armiesIn(p.id).some(a => a.owner === p.owner && a.general && !a.general.leader) ? 'No enemy general is here' : myGold() < 300 ? 'Not enough gold' : null),
    act: p => {
      p.covert = G.turn;
      const a = armiesIn(p.id).find(x => x.owner === p.owner && x.general && !x.general.leader), name = a.general.name;
      if (chance(0.38)) { generalDied(a, 'battle'); return t('{name} is found dead in his tent. No one saw the killer.', { name: pn(name) }); }
      if (p.owner !== 'rebels') { rel(G.player, p.owner).att -= 30; if (!rel(G.player, p.owner).war && chance(0.35)) declareWar(p.owner, G.player, true); }
      return t('Your assassin is caught before he reaches {name}.', { name: pn(name) });
    } },
];
// Everything paid up front
for (const A of CITY_ACTIONS) {
  const act = A.act;
  A.act = (p, f) => { const c = A.cost(p); G.factions[G.player].gold -= c; return act(p, f); };
}
const cityActionsFor = p => CITY_ACTIONS.filter(A => A.own === (p.owner === G.player));
