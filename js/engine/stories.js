'use strict';
// What makes a turn a story: choices put before the ruler, requests from the council,
// plunder raids and the great monuments of the age.

// ---------- Wonders ----------

const WONDERS = {
  bibikhanym: { name: 'Bibi-Khanym Mosque', prov: 'samarkand', cost: 4000, turns: 6,
    desc: 'The vast congregational mosque of Samarkand. +10 public order in every province you rule.' },
  aksaray: { name: 'Ak-Saray Palace', prov: 'kesh', cost: 3000, turns: 5,
    desc: 'The White Palace of Shahrisabz, with its towering portal. Every general you appoint starts with an extra star.' },
  yasawi: { name: 'Mausoleum of Khoja Ahmad Yasawi', prov: 'otrar', cost: 2800, turns: 5,
    desc: 'The shrine of the great Turkic Sufi poet, near Otrar. +15 public order in all steppe and desert provinces.' },
  musalla: { name: 'Musalla of Herat', prov: 'herat', cost: 3500, turns: 6,
    desc: 'A complex of madrasas and slender minarets. +15% tax from every oasis province you rule.' },
  saraibazaar: { name: 'Grand Bazaar of Sarai', prov: 'sarai', cost: 3000, turns: 5,
    desc: 'The greatest market of the northern Silk Road. +40 gold from every Silk Road province you rule.' },
};

// A wonder serves whoever holds its city
function hasWonder(f, id) {
  return !!(G.wonders && G.wonders[id] && G.provinces[WONDERS[id].prov].owner === f);
}
function wonderHere(p) { return Object.keys(WONDERS).find(id => WONDERS[id].prov === p.id) || null; }
function wonderCheck(p) {
  const id = wonderHere(p);
  if (!id) return 'No wonder can be built here';
  if (G.wonders && G.wonders[id]) return 'Already built';
  if (p.build) return 'Already building something';
  if (p.siege) return 'Under siege';
  if (G.factions[p.owner].gold < WONDERS[id].cost) return 'Not enough gold';
  return null;
}
function startWonder(p) {
  const why = wonderCheck(p);
  if (why) return why;
  const id = wonderHere(p);
  G.factions[p.owner].gold -= WONDERS[id].cost;
  p.build = { key: 'wonder', id, turns: WONDERS[id].turns };
  return null;
}
function completeWonder(p, id) {
  G.wonders = G.wonders || {};
  G.wonders[id] = true;
  log(`${dateText()}: the ${WONDERS[id].name} is completed in ${p.city}.`, 'big');
  HOOKS.notify({ title: WONDERS[id].name, text: `After years of work by masons, tile-cutters and calligraphers, the ${WONDERS[id].name} rises over ${p.city}. ${WONDERS[id].desc}`, history: true, prov: p.id });
}

// ---------- Plunder ----------

function raidCheck(a) {
  const p = G.provinces[a.prov];
  if (a.owner === p.owner || !atWar(a.owner, p.owner)) return 'Only enemy land can be plundered';
  if (a.moves <= 0) return 'This army has no moves left this turn';
  if (p.raided === G.turn) return 'This land was plundered this turn already';
  return null;
}
function raidGold(a) {
  const p = G.provinces[a.prov];
  return Math.round((p.pop * 9 + 60) * (FACTIONS[a.owner].nomad ? 1.5 : 1));
}
function raid(a) {
  const why = raidCheck(a);
  if (why) return { why };
  const p = G.provinces[a.prov], gold = raidGold(a);
  G.factions[a.owner].gold += gold;
  p.pop *= 0.95; p.unrest += 12; p.raided = G.turn;
  a.moves = 0;
  if (p.owner !== 'rebels') rel(a.owner, p.owner).att -= 5;
  log(`${dateText()}: ${FACTIONS[a.owner].name} plundered the countryside of ${p.city}.`, a.owner === G.player || p.owner === G.player ? 'war' : '');
  if (p.owner === G.player) HOOKS.notify({ title: 'Our villages burn', text: `${FACTIONS[a.owner].adj} raiders are plundering the countryside around ${p.city}.`, prov: p.id, minor: true });
  return { gold };
}

// ---------- Delayed rewards ----------

function later(f, turns, gold, text) {
  const st = G.factions[f];
  st.pending = st.pending || [];
  st.pending.push({ t: G.turn + turns, gold, text });
}
function payPending(f) {
  const st = G.factions[f];
  if (!st.pending) return;
  for (const x of st.pending.filter(x => x.t <= G.turn)) {
    st.gold += x.gold;
    if (f === G.player && x.text) HOOKS.notify({ title: x.gold >= 0 ? 'Gold arrives' : 'A debt is paid', text: x.text, minor: true });
  }
  st.pending = st.pending.filter(x => x.t > G.turn);
}

// ---------- The council's requests ----------

const COUNCIL = { turkic: ['Amir Sayf al-Din', 'Amir Jaku Barlas', 'Amir Shaykh Ali'], mongol: ['Amir Khudaydad', 'Amir Bekchik'], persian: ['Vizier Mahmud', 'Khwaja Hasan'] };

function newMission(f) {
  const st = G.factions[f], mine = provsOf(f);
  const giver = pick(COUNCIL[FACTIONS[f].names] || COUNCIL.turkic);
  const opts = [];
  // Conquer a weak neighbouring city
  const targets = [];
  for (const p of mine) for (const n of p.adj) {
    const q = G.provinces[n];
    if (q.owner === f || allied(f, q.owner)) continue;
    if (q.owner !== 'rebels' && !rel(f, q.owner).war && rel(f, q.owner).att > -10) continue;
    if (!targets.includes(q)) targets.push(q);
  }
  if (targets.length) {
    const q = targets.sort((a, b) => (a.b.walls * 10 - a.pop) - (b.b.walls * 10 - b.pop))[0];
    opts.push({ type: 'conquer', target: q.id, turns: 6, reward: 900 + Math.round(q.pop * 25),
      text: `Take ${q.city} from the ${FACTIONS[q.owner].full}.` });
  }
  // Build up the realm
  const site = mine.filter(p => !p.build && !buildCheck(p, 'market') ).sort((a, b) => b.pop - a.pop)[0];
  if (site) opts.push({ type: 'build', target: site.id, key: 'market', level: site.b.market + 1, turns: 4, reward: 700,
    text: `Build a ${BUILDINGS.market.levels[site.b.market + 1]} in ${site.city}, so the merchants prosper.` });
  // Trade
  const partner = PLAYABLE.find(g => g !== f && G.factions[g].alive && !rel(f, g).war && !rel(f, g).trade && rel(f, g).att > -15);
  if (partner) opts.push({ type: 'trade', target: partner, turns: 4, reward: 500, text: `Sign a trade agreement with the ${FACTIONS[partner].full}.` });
  // A stronger army
  const units = armiesOf(f).reduce((n, a) => n + a.units.length, 0);
  opts.push({ type: 'army', target: units + 4, turns: 4, reward: 600, text: `Raise the army to ${units + 4} units. The amirs want to see banners.` });
  // A wonder
  for (const id in WONDERS) {
    const p = G.provinces[WONDERS[id].prov];
    if (p.owner === f && !(G.wonders && G.wonders[id])) opts.push({ type: 'wonder', target: id, turns: 6, reward: 1200, text: `Begin building the ${WONDERS[id].name} in ${p.city}.` });
  }
  const m = pick(opts);
  return { ...m, giver, deadline: G.turn + m.turns, start: G.turn };
}

function missionDone(f, m) {
  switch (m.type) {
    case 'conquer': return G.provinces[m.target].owner === f;
    case 'build': return G.provinces[m.target].b[m.key] >= m.level;
    case 'trade': return !G.factions[m.target].alive || rel(f, m.target).trade;
    case 'army': return armiesOf(f).reduce((n, a) => n + a.units.length, 0) >= m.target;
    case 'wonder': { const p = G.provinces[WONDERS[m.target].prov]; return (G.wonders && G.wonders[m.target]) || (p.build && p.build.key === 'wonder'); }
  }
  return false;
}

// Called after every player action and at the start of each turn
function checkMission() {
  const f = G.player, st = G.factions[f];
  if (!st.alive) return;
  const m = st.mission;
  if (m && missionDone(f, m)) {
    st.gold += m.reward;
    st.orderBonus = Math.max(st.orderBonus, 6); st.orderBonusT = Math.max(st.orderBonusT, 3);
    st.mission = null; st.nextMission = G.turn + 2;
    log(`${dateText()}: the council's request is fulfilled. ${m.reward} gold.`, 'good');
    HOOKS.notify({ title: 'The council is pleased', text: `${m.giver} reports: "${m.text}" It is done. The treasury receives ${m.reward} gold and the amirs praise your name.` });
    return;
  }
  if (m && G.turn > m.deadline) {
    st.mission = null; st.nextMission = G.turn + 2;
    st.orderBonus = -6; st.orderBonusT = 3;
    HOOKS.notify({ title: 'The council is disappointed', text: `${m.giver}'s request went unanswered. The amirs grumble that you are slow to act.`, minor: true });
    return;
  }
  if (!m && G.turn >= (st.nextMission || 1)) {
    st.mission = newMission(f);
    HOOKS.notify({ title: 'A request from the council', text: `${st.mission.giver}: "${st.mission.text}" Reward: ${st.mission.reward} gold, by ${dateText(st.mission.deadline)}.`, minor: true });
  }
}

// ---------- Choices put before the ruler ----------
// Each story: when(ctx) says if it can happen; options[i].act(ctx) applies the choice and returns what happened.

function storyContext(f) {
  const st = G.factions[f], mine = provsOf(f);
  const rich = mine.slice().sort((a, b) => b.pop - a.pop);
  const rivals = PLAYABLE.filter(g => g !== f && G.factions[g].alive);
  const generals = armiesOf(f).filter(a => a.general && !a.general.leader);
  return {
    f, st, mine, p: pick(rich.slice(0, Math.max(1, Math.ceil(rich.length / 2)))) || rich[0],
    silk: pick(mine.filter(p => p.silk)), oasis: pick(mine.filter(p => p.terrain === 'oasis')),
    cap: G.provinces[st.capital], rival: pick(rivals), enemy: pick(rivals.filter(g => rel(f, g).war || rel(f, g).att < -20)),
    gen: pick(generals), year: year(), spring: G.turn % 2 === 0,
  };
}
const cost = (ctx, base) => Math.round(base * (1 + provsOf(ctx.f).length / 12));

const STORIES = [
  {
    id: 'naqshband', once: true, title: 'The master of Bukhara',
    when: c => G.provinces.bukhara.owner === c.f && c.year < 1389,
    text: c => 'Baha al-Din Naqshband, the most revered Sufi master of Bukhara, asks you to protect the lodges of his order and feed the poor who gather there.',
    options: [
      { label: c => `Endow the lodges (−${cost(c, 300)} gold)`, hint: 'Public order rises across the realm for several turns.',
        act: c => { c.st.gold -= cost(c, 300); c.st.orderBonus = 10; c.st.orderBonusT = 6; return 'The dervishes pray for your reign in every bazaar.'; } },
      { label: () => 'Thank him, but give nothing', hint: 'Bukhara will remember.',
        act: () => { G.provinces.bukhara.unrest += 18; return 'Murmurs of ingratitude spread through Bukhara.'; } },
    ],
  },
  {
    id: 'bandits', title: 'Bandits on the Silk Road',
    when: c => !!c.silk,
    text: c => `Bandits are robbing the caravans on the road to ${c.silk.city}. The merchants beg for protection.`,
    options: [
      { label: c => `Send riders after them (−${cost(c, 200)} gold)`, hint: 'If they are caught, their loot is yours.',
        act: c => { c.st.gold -= cost(c, 200); if (rng() < 0.6) { c.st.gold += cost(c, 550); return 'Your riders cut down the bandits and bring back their loot.'; } return 'The bandits vanish into the desert before your riders arrive.'; } },
      { label: () => 'Let the merchants hire their own guards', hint: 'Unrest rises in the city.',
        act: c => { c.silk.unrest += 12; return `The merchants of ${c.silk.city} complain loudly about your neglect.`; } },
    ],
  },
  {
    id: 'amir', title: 'An ambitious amir',
    when: c => !!c.gen && c.gen.general.cmd >= 2,
    text: c => `${c.gen.general.name}, proud of his victories, demands the governorship of ${c.p.city} as his reward.`,
    options: [
      { label: c => `Grant him ${c.p.city}`, hint: 'He serves more boldly (+1 star), but the city resents a new master.',
        act: c => { c.gen.general.cmd = Math.min(6, c.gen.general.cmd + 1); c.p.unrest += 15; return `${c.gen.general.name} kneels and swears to serve you to the death.`; } },
      { label: () => 'Remind him who rules here', hint: 'He may sulk, or worse.',
        act: c => { if (rng() < 0.3) { c.gen.general.cmd = Math.max(0, c.gen.general.cmd - 1); c.p.unrest += 30; return `${c.gen.general.name} stirs up trouble in ${c.p.city} before obeying.`; } return `${c.gen.general.name} bows his head and says no more.`; } },
    ],
  },
  {
    id: 'genoese', title: 'Merchants from Tana',
    when: c => !!c.silk && c.year < 1410,
    text: c => `Genoese merchants from their colony at Tana, on the Sea of Azov, offer silver to rent a trading quarter in ${c.silk.city}.`,
    options: [
      { label: c => `Accept (+${cost(c, 500)} gold)`, hint: 'Gold now; the locals dislike the foreigners.',
        act: c => { c.st.gold += cost(c, 500); c.silk.unrest += 12; return 'The Franks unload their bales and their silver.'; } },
      { label: () => 'Tax them at the gates instead', hint: 'A steady trickle of gold over the coming years.',
        act: c => { for (let i = 1; i <= 4; i++) later(c.f, i * 2, cost(c, 160), 'The Genoese pay their gate taxes.'); return 'The merchants grumble, but pay.'; } },
      { label: () => 'Send them away', hint: 'Nothing changes.', act: () => 'The Genoese sail back to Tana.' },
    ],
  },
  {
    id: 'plague', title: 'Sickness in the city',
    when: c => c.p.pop > 18,
    text: c => `A deadly fever has broken out in the crowded quarters of ${c.p.city}.`,
    options: [
      { label: () => 'Close the gates and burn the bedding', hint: 'Few will die, but trade suffers and the people are angry.',
        act: c => { c.p.pop *= 0.97; c.p.unrest += 15; return 'The gates are shut. The sickness burns itself out.'; } },
      { label: () => 'Trust in God', hint: 'Many may die, and it can spread.',
        act: c => { c.p.pop *= 0.86; for (const n of c.p.adj) { const q = G.provinces[n]; if (q.owner === c.f && rng() < 0.5) q.pop *= 0.93; } return `The fever sweeps through ${c.p.city} and the villages around it.`; } },
    ],
  },
  {
    id: 'navruz', title: 'Navruz',
    when: c => c.spring,
    text: () => 'Spring has come and with it Navruz, the new year. Your people expect bonfires, wrestling, horse races and sumalak in every square.',
    options: [
      { label: c => `Hold great festivities (−${cost(c, 250)} gold)`, hint: 'All your provinces become calmer.',
        act: c => { c.st.gold -= cost(c, 250); for (const p of c.mine) p.unrest = Math.max(-20, p.unrest - 15); return 'The whole realm feasts and dances.'; } },
      { label: () => 'A modest celebration', hint: 'Nothing changes.', act: () => 'The new year comes quietly.' },
      { label: c => `Cancel it and keep the gold (+${cost(c, 150)})`, hint: 'The people will not forget.',
        act: c => { c.st.gold += cost(c, 150); for (const p of c.mine) p.unrest += 8; return 'Your stinginess is the talk of every bazaar.'; } },
    ],
  },
  {
    id: 'ming', once: true, title: 'An envoy from the Ming',
    when: c => c.year >= 1385 && provsOf(c.f).some(p => p.silk),
    text: () => 'An envoy of the Hongwu Emperor of Ming China arrives with a letter calling you his loyal vassal, who owes tribute to the Son of Heaven.',
    options: [
      { label: c => `Send horses as "gifts" (−${cost(c, 300)} gold)`, hint: 'Chinese caravans will favour your markets later.',
        act: c => { c.st.gold -= cost(c, 300); later(c.f, 3, cost(c, 900), 'A great caravan arrives from China, laden with silk and porcelain.'); return 'The envoy departs, satisfied.'; } },
      { label: () => 'Throw the envoys into prison', hint: 'As Temur did in 1395. Your amirs will love it.',
        act: c => { c.st.orderBonus = 12; c.st.orderBonusT = 4; return 'Your court roars with approval. No one calls you a vassal.'; } },
    ],
  },
  {
    id: 'horses', title: 'Horses from the steppe',
    when: c => !!c.cap && c.cap.owner === c.f,
    text: () => 'Kipchak herders drive three hundred fine horses to your capital and offer them for sale.',
    options: [
      { label: c => `Buy them (−${cost(c, 450)} gold)`, hint: 'Two units of lancers join the army in your capital.',
        act: c => { c.st.gold -= cost(c, 450); let a = armiesIn(c.cap.id).find(x => x.owner === c.f && x.units.length <= GAME.MAX_ARMY - 2); if (!a) a = addArmy(c.f, c.cap.id, [], null); a.units.push(makeUnit('lancer'), makeUnit('lancer')); return 'Your new riders exercise their mounts outside the walls.'; } },
      { label: () => 'Send them away', hint: 'Nothing changes.', act: () => 'The herders ride on to sell elsewhere.' },
    ],
  },
  {
    id: 'spy', title: 'A spy is caught',
    when: c => !!c.enemy && !!c.cap,
    text: c => `A spy in the pay of the ${FACTIONS[c.enemy].full} has been caught in ${c.cap.city}.`,
    options: [
      { label: () => 'Execute him in the square', hint: 'Your enemies hate you more; your people feel safer.',
        act: c => { rel(c.f, c.enemy).att -= 12; c.cap.unrest -= 10; return 'The crowd watches in silence.'; } },
      { label: () => 'Turn him and send him back', hint: 'He may weaken their capital, or betray you.',
        act: c => { const ec = G.provinces[G.factions[c.enemy].capital]; if (ec && rng() < 0.6) { if (ec.b.walls > 0) ec.b.walls--; return `Your double agent sabotages the walls of ${ec.city}.`; } return 'The spy disappears. He was never yours.'; } },
      { label: c => `Send him home with gifts (−${cost(c, 100)})`, hint: 'A gesture of good will.',
        act: c => { c.st.gold -= cost(c, 100); rel(c.f, c.enemy).att += 15; return 'Your mercy surprises everyone.'; } },
    ],
  },
  {
    id: 'heir', title: 'The heir wants glory',
    when: c => !!c.cap && c.cap.owner === c.f && c.st.heir && !armiesOf(c.f).some(a => a.general && a.general.name === c.st.heir),
    text: c => `Your heir, ${c.st.heir}, begs to be given an army of his own.`,
    options: [
      { label: c => `Give him command (−${cost(c, 300)} gold)`, hint: 'A new army with a general appears in your capital.',
        act: c => { c.st.gold -= cost(c, 300); addArmy(c.f, c.cap.id, FACTIONS[c.f].nomad ? ['horsearch', 'lancer'] : ['spear', 'archer'], makeGeneral(c.f, c.st.heir, 2, 20, false)); return `${c.st.heir} rides out at the head of his own troops.`; } },
      { label: () => 'Keep him at court to learn statecraft', hint: 'The court approves of your caution.',
        act: c => { c.st.orderBonus = Math.max(c.st.orderBonus, 5); c.st.orderBonusT = Math.max(c.st.orderBonusT, 3); return 'He sulks, but studies.'; } },
    ],
  },
  {
    id: 'pretender', title: 'A pretender appears',
    when: c => c.mine.length > 3 && G.turn > 4,
    text: c => `In ${c.p.city} a man claiming descent from Chinggis Khan is gathering armed followers.`,
    options: [
      { label: c => `Buy him off (−${cost(c, 400)} gold)`, hint: 'The problem goes away, for now.',
        act: c => { c.st.gold -= cost(c, 400); return 'The "prince" accepts your gold and a house far away.'; } },
      { label: () => 'Let him come — we will crush him', hint: 'A rebel army rises in the province. Defeat it.',
        act: c => { addArmy('rebels', c.p.id, ['spear', 'spear', 'archer', 'horsearch'], null); c.p.unrest += 10; return `Rebels gather around the pretender near ${c.p.city}. Your army must deal with them.`; } },
      { label: () => 'Ignore him', hint: 'Unrest grows sharply in the province.',
        act: c => { c.p.unrest += 35; return 'His followers grow bolder every day.'; } },
    ],
  },
  {
    id: 'historian', title: 'A historian at court',
    when: () => true,
    text: c => `${c.f === 'temur' ? 'Nizam al-Din Shami' : 'A learned Persian historian'} asks for patronage to write the chronicle of your reign.`,
    options: [
      { label: c => `Pay him well (−${cost(c, 220)} gold)`, hint: 'Your fame and public order grow.',
        act: c => { c.st.gold -= cost(c, 220); c.st.orderBonus = Math.max(c.st.orderBonus, 8); c.st.orderBonusT = Math.max(c.st.orderBonusT, 5); return 'He begins: "In the name of God, this is the book of victories…"'; } },
      { label: () => 'History can wait', hint: 'Nothing changes.', act: () => 'He finds another patron.' },
    ],
  },
  {
    id: 'drought', title: 'The canals run dry',
    when: c => !!c.oasis,
    text: c => `A hot dry wind has blown for weeks and the aryks of ${c.oasis.city} are running dry.`,
    options: [
      { label: c => `Dig deeper canals (−${cost(c, 300)} gold)`, hint: 'Irrigation improves permanently.',
        act: c => { c.st.gold -= cost(c, 300); if (c.oasis.b.farms < 3) c.oasis.b.farms++; return `New canals carry water to the fields of ${c.oasis.city}.`; } },
      { label: () => 'Pray for rain', hint: 'Perhaps it will rain. Perhaps not.',
        act: c => { if (rng() < 0.5) return 'Clouds gather over the mountains, and the rain comes.'; c.oasis.pop *= 0.92; c.oasis.unrest += 10; return 'The harvest withers in the fields.'; } },
    ],
  },
  {
    id: 'pay', title: 'Unpaid soldiers',
    when: c => factionUpkeep(c.f) > factionIncome(c.f) * 0.7 && armiesOf(c.f).length > 0,
    text: () => 'Your soldiers grumble that their pay is late. Some talk of going home.',
    options: [
      { label: c => `Pay a bonus (−${cost(c, 250)} gold)`, hint: 'The army is content.', act: c => { c.st.gold -= cost(c, 250); return 'The grumbling stops.'; } },
      { label: () => 'Hang the ringleaders', hint: 'One unit loses many men; the rest obey.',
        act: c => { const a = pick(armiesOf(c.f)); const u = pick(a.units.filter(x => x.type !== 'general')) || a.units[0]; u.men = Math.round(u.men * 0.6); return 'Order is restored, at a price.'; } },
    ],
  },
  {
    id: 'insult', title: 'An insult',
    when: c => !!c.rival && !rel(c.f, c.rival).war && rel(c.f, c.rival).att < 10,
    text: c => `${G.factions[c.rival].leader} has mocked your envoy before his whole court, calling you a camel herder.`,
    options: [
      { label: () => 'Demand an apology and gold', hint: 'They may pay — or grow angrier.',
        act: c => { if (factionPower(c.f) > factionPower(c.rival) && rng() < 0.6) { const g = cost(c, 300); G.factions[c.rival].gold -= g; c.st.gold += g; return `${G.factions[c.rival].leader} apologises and sends ${g} gold.`; } rel(c.f, c.rival).att -= 15; return 'They laugh at your demand.'; } },
      { label: () => 'Answer with war', hint: 'Declare war on them now.', act: c => { declareWar(c.f, c.rival); return 'Your heralds carry the declaration of war.'; } },
      { label: () => 'Rise above it', hint: 'Nothing changes.', act: () => 'You let the insult pass.' },
    ],
  },
  {
    id: 'caravanserai', title: 'A caravanserai on the road',
    when: c => !!c.silk && c.silk.b.market < maxBuildLevel(c.silk),
    text: c => `The merchants of ${c.silk.city} offer to build a great caravanserai if you pay half the cost.`,
    options: [
      { label: c => `Agree (−${cost(c, 350)} gold)`, hint: 'The bazaar improves at once.',
        act: c => { c.st.gold -= cost(c, 350); c.silk.b.market++; return `A caravanserai with a hundred rooms opens in ${c.silk.city}.`; } },
      { label: () => 'Refuse', hint: 'Nothing changes.', act: () => 'The merchants take their plans elsewhere.' },
    ],
  },
];

// Pick this turn's story for the player, if any
function pickStory() {
  const f = G.player, st = G.factions[f];
  if (!st.alive || rng() > 0.55) return null;
  st.storiesDone = st.storiesDone || [];
  const c = storyContext(f);
  if (!c.p) return null;
  const ok = STORIES.filter(s => !(s.once && st.storiesDone.includes(s.id)) && st.lastStory !== s.id && s.when(c));
  if (!ok.length) return null;
  const s = pick(ok);
  st.lastStory = s.id;
  if (s.once) st.storiesDone.push(s.id);
  return { story: s, ctx: c };
}
