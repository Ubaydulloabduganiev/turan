'use strict';
// Campaigns: short scenarios drawn from the history of the 1370s, each with its own nation, start date,
// goal and deadline. The grand campaign (last nation standing) is the free game.
//   goal.type 'take'    : hold every listed city at once before the deadline (won at once)
//   goal.type 'hold'    : still hold every listed city when the deadline comes (lost if one falls for good)
//   goal.type 'develop' : reach the listed advances before the deadline while keeping the listed cities

const turnOf = (y, autumn) => (y - GAME.START_YEAR) * 2 + (autumn ? 1 : 0);

const SCENARIOS = [
  {
    id: 'khwarezm', faction: 'temur', start: turnOf(1371, 1), deadline: turnOf(1379, 1), difficulty: 'Easy',
    title: 'The Conquest of Khwarezm',
    blurb: 'Husayn Sufi of Khwarezm refuses to return Kath and Khiva to the Chagatai Ulus. Temur swears to take the whole oasis of the lower Amu Darya, with its rich capital Urgench. History gave him eight years.',
    goal: { type: 'take', provs: ['urgench', 'khiva', 'kath'] },
    goalText: 'Take Urgench, Khiva and Kath before the end of 1379.',
    setup: () => {
      declareWar('temur', 'khwarezm', true); rel('temur', 'khwarezm').att = -60; G.factions.temur.gold += 1000;
      // The army of the invasion waits in the Kyzylkum, on the road to Kath
      transferProvince(G.provinces.kyzylkum, 'temur', 0);
      strikeArmy('temur', 'kyzylkum', ['spear', 'spear', 'heavyinf', 'heavyinf', 'archer', 'archer', 'lancer', 'heavycav', 'tovachi', 'siege', 'siege']);
    },
  },
  {
    id: 'toqtamish', faction: 'white', start: turnOf(1377, 1), deadline: turnOf(1383, 0), difficulty: 'Normal',
    title: 'Toqtamish and the Golden Throne',
    blurb: 'Urus Khan is dead. The young Toqtamish, a prince of the house of Jochi who once fled to Temur, now holds the White Horde. Beyond the Volga, Mamai rules Sarai through puppet khans. Your riders have already crossed the Yaik and taken Saraichik. Unite the two halves of the Horde of Jochi.',
    goal: { type: 'take', provs: ['sarai', 'hajjitarkhan'] },
    goalText: 'Take Sarai and Hajji-Tarkhan before the spring of 1383. Mamai will be weakest after his war in Rus\u2019, in 1380.',
    setup: () => {
      setLeader('white', 'Toqtamish', 27);
      declareWar('white', 'golden', true); rel('white', 'golden').att = -70;
      rel('white', 'temur').att = 30; rel('white', 'temur').trade = true;
      // Toqtamish has crossed the Yaik: Saraichik, a day's ride from Sarai, is his
      transferProvince(G.provinces.saraichik, 'white', 10);
      strikeArmy('white', 'saraichik', ['horsearch', 'horsearch', 'horsearch', 'lancer', 'lancer', 'lancer', 'heavycav', 'spear', 'spear', 'siege', 'siege']);
      G.factions.white.gold += 3000;
      // Mamai's best riders are away fighting in Rus'
      for (const a of armiesOf('golden')) { for (const u of a.units) u.men = Math.round(u.men * 0.65); }
    },
  },
  {
    id: 'moghul', faction: 'moghul', start: 0, deadline: turnOf(1377, 0), difficulty: 'Normal',
    title: 'The Khan Strikes Back',
    blurb: 'Twice the Moghul khans conquered Transoxiana, and twice the amirs of Samarkand drove them out. Now Qamar al-Din Dughlat rules the steppe, and the upstart Temur sits in Samarkand. Take back the cities of the Chagatai Ulus.',
    goal: { type: 'take', provs: ['samarkand', 'tashkent'] },
    goalText: 'Take Samarkand and Tashkent before the spring of 1377.',
    setup: () => { G.factions.moghul.gold += 1500; strikeArmy('moghul', 'fergana', ['horsearch', 'horsearch', 'dughlat', 'dughlat', 'lancer', 'lancer', 'heavycav', 'spear', 'spear', 'archer', 'siege', 'siege']); },
  },
  {
    id: 'sarbadar', faction: 'sarbadar', start: 0, deadline: turnOf(1383, 0), difficulty: 'Hard',
    title: 'The Last Sarbadars',
    blurb: 'The Sarbadars of Sabzevar, a republic of rebels who chose death over Mongol tribute, have ruled western Khorasan for forty years. Now the Kartids of Herat press from the east, and a far greater storm is rising beyond the Amu Darya.',
    goal: { type: 'hold', provs: ['sabzevar', 'nishapur'] },
    goalText: 'Still hold Sabzevar and Nishapur in the spring of 1383. Temur will come for Khorasan.',
    setup: () => { declareWar('kart', 'sarbadar', true); rel('temur', 'sarbadar').att = -25; },
    // Temur marches on Khorasan, as he did in 1381
    onTurn: () => {
      if (G.turn === turnOf(1380, 1) && G.factions.temur.alive && !rel('temur', 'sarbadar').war) {
        declareWar('temur', 'sarbadar');
        const at = provsOf('temur').filter(p => p.adj.some(n => ['merv', 'sarakhs', 'tus', 'abiward', 'nishapur'].includes(n)))[0] || G.provinces[G.factions.temur.capital];
        if (at) addArmy('temur', at.id, ['spear', 'spear', 'archer', 'archer', 'lancer', 'heavycav', 'siege', 'tovachi'], null);
      }
    },
  },
  {
    id: 'herat', faction: 'kart', start: 0, deadline: turnOf(1395, 0), difficulty: 'Normal',
    title: 'Herat, City of Poets',
    blurb: 'Herat is small in land but great in learning: its madrasas, painters and poets are famous from Tabriz to Delhi. Malik Ghiyath al-Din can never outfight his neighbours. He can outshine them.',
    goal: { type: 'develop', provs: ['herat'], dev: { culture: 5, trade: 3 } },
    goalText: 'Win all five advances in Literature and arts and three in Trade before 1395, and keep Herat.',
    setup: () => { G.factions.kart.gold += 1500; G.provinces.herat.b.library = 1; },
  },
];
const scenarioById = id => SCENARIOS.find(s => s.id === id) || null;

// A large army under a new general, ready to march on the goal
function strikeArmy(f, prov, units) {
  const a = addArmy(f, prov, units, makeGeneral(f, newGeneralName(f), 3, 36, false));
  a.moves = armyMoves(a);
  return a;
}

function setLeader(f, name, age) {
  const st = G.factions[f];
  const la = armiesOf(f).find(a => a.general && a.general.leader);
  if (la) { la.general.name = name; la.general.age = age; la.general.cmd = Math.max(la.general.cmd, 3); }
  st.leader = name;
}

// A new game that starts as the scenario says
function newScenarioGame(id) {
  const S = scenarioById(id);
  newGame(S.faction);
  G.scenario = { id, deadline: S.deadline, result: null };
  if (S.start) {
    // Events before the start date are history already; people are older
    for (let i = 0; i < EVENTS.length; i++) { const e = EVENTS[i]; if ((e.when[0] - GAME.START_YEAR) * 2 + e.when[1] <= S.start && !G.fired.includes(i)) G.fired.push(i); }
    const years = Math.floor(S.start / 2);
    for (const a of Object.values(G.armies)) if (a.general) a.general.age += years;
    G.turn = S.start;
    for (const a of Object.values(G.armies)) a.moves = armyMoves(a);
  }
  S.setup();
  log(dateText() + ': ' + t(S.title) + '. ' + t(S.goalText), 'history');
  return G;
}

// How far the goal is met: { done, total, met, lines }
function scenarioProgress() {
  const sc = G && G.scenario && scenarioById(G.scenario.id);
  if (!sc) return null;
  const g = sc.goal, pl = G.player;
  const held = g.provs.filter(id => G.provinces[id].owner === pl);
  let met = held.length === g.provs.length, done = held.length, total = g.provs.length;
  if (g.dev) for (const k in g.dev) { total += g.dev[k]; done += Math.min(g.dev[k], devOf(pl)[k].lvl); if (devOf(pl)[k].lvl < g.dev[k]) met = false; }
  return { sc, done, total, met, held, left: sc.deadline - G.turn };
}

// Called after every turn. Sets G.scenario.result to 'win' or 'lose' once.
function checkScenario(newTurn) {
  const s = G && G.scenario;
  if (!s || s.result) return;
  const sc = scenarioById(s.id);
  if (newTurn && sc.onTurn) sc.onTurn();
  const pr = scenarioProgress();
  if (!G.factions[G.player].alive) { s.result = 'lose'; return; }
  if (sc.goal.type === 'hold') {
    if (G.turn >= s.deadline) s.result = pr.met ? 'win' : 'lose';
    return;
  }
  if (pr.met) { s.result = 'win'; s.wonTurn = G.turn; return; }
  if (G.turn > s.deadline) s.result = 'lose';
}
