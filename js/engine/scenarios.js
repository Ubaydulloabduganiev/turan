'use strict';
// Campaigns: short scenarios drawn from the history of the 1370s, each with its own nation, start date,
// goal and deadline. The grand campaign (last nation standing) is the free game.
//   goal.type 'take'    : hold every listed city at once before the deadline (won at once)
//   goal.type 'hold'    : still hold every listed city when the deadline comes (lost if one falls for good)
//   goal.type 'develop' : reach the listed advances before the deadline while keeping the listed cities

// A campaign starts in its historical month and runs for a number of monthly turns
const T0 = { khwarezm: turnAt(1371, 9), toqtamish: turnAt(1377, 9), revenge: turnAt(1387, 10), sarai: turnAt(1395, 4), heirs: turnAt(1405, 3), ulughbeg: turnAt(1409, 9), india: turnAt(1398, 8), ankara: turnAt(1402, 5) };

const SCENARIOS = [
  {
    id: 'khwarezm', faction: 'temur', start: T0.khwarezm, deadline: T0.khwarezm + 16, difficulty: 'Easy',
    title: 'The Conquest of Khwarezm',
    blurb: 'Husayn Sufi of Khwarezm refuses to return Kath and Khiva to the Chagatai Ulus. Temur swears to take the whole oasis of the lower Amu Darya, with its rich capital Urgench. History gave him eight years.',
    goal: { type: 'take', provs: ['urgench', 'khiva', 'kath'] },
    goalText: 'Take Urgench, Khiva and Kath before {date}.',
    setup: () => {
      declareWar('temur', 'khwarezm', true); rel('temur', 'khwarezm').att = -60; G.factions.temur.gold += 1000;
      // The army of the invasion waits in the Kyzylkum, on the road to Kath
      transferProvince(G.provinces.kyzylkum, 'temur', 0);
      strikeArmy('temur', 'kyzylkum', ['spear', 'spear', 'heavyinf', 'heavyinf', 'archer', 'archer', 'lancer', 'heavycav', 'tovachi', 'siege', 'siege']);
    },
  },
  {
    id: 'toqtamish', faction: 'white', start: T0.toqtamish, deadline: T0.toqtamish + 11, difficulty: 'Normal',
    title: 'Toqtamish and the Golden Throne',
    blurb: 'Urus Khan is dead. The young Toqtamish, a prince of the house of Jochi who once fled to Temur, now holds the White Horde. Beyond the Volga, Mamai rules Sarai through puppet khans. Your riders have already crossed the Yaik and taken Saraichik. Unite the two halves of the Horde of Jochi.',
    goal: { type: 'take', provs: ['sarai', 'hajjitarkhan'] },
    goalText: 'Take Sarai and Hajji-Tarkhan before {date}.',
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
    id: 'moghul', faction: 'moghul', start: 0, deadline: 14, difficulty: 'Normal',
    title: 'The Khan Strikes Back',
    blurb: 'Twice the Moghul khans conquered Transoxiana, and twice the amirs of Samarkand drove them out. Now Qamar al-Din Dughlat rules the steppe, and the upstart Temur sits in Samarkand. Take back the cities of the Chagatai Ulus.',
    goal: { type: 'take', provs: ['samarkand', 'tashkent'] },
    goalText: 'Take Samarkand and Tashkent before {date}.',
    setup: () => { G.factions.moghul.gold += 1500; strikeArmy('moghul', 'fergana', ['horsearch', 'horsearch', 'dughlat', 'dughlat', 'lancer', 'lancer', 'heavycav', 'spear', 'spear', 'archer', 'siege', 'siege']); strikeArmy('moghul', 'fergana', ['horsearch', 'horsearch', 'horsearch', 'dughlat', 'lancer', 'heavycav', 'spear', 'archer']); },
  },
  {
    id: 'sarbadar', faction: 'sarbadar', start: 0, deadline: 26, difficulty: 'Hard',
    title: 'The Last Sarbadars',
    blurb: 'The Sarbadars of Sabzevar, a republic of rebels who chose death over Mongol tribute, have ruled western Khorasan for forty years. Now the Kartids of Herat press from the east, and a far greater storm is rising beyond the Amu Darya.',
    goal: { type: 'hold', provs: ['sabzevar', 'nishapur'] },
    goalText: 'Still hold Sabzevar and Nishapur in {date}. Temur will come for Khorasan.',
    setup: () => { declareWar('kart', 'sarbadar', true); rel('temur', 'sarbadar').att = -25; },
    // Temur marches on Khorasan, as he did in 1381
    onTurn: () => {
      if (G.turn === 21 && G.factions.temur.alive && !rel('temur', 'sarbadar').war) {
        declareWar('temur', 'sarbadar');
        const at = provsOf('temur').filter(p => p.adj.some(n => ['merv', 'sarakhs', 'tus', 'abiward', 'nishapur'].includes(n)))[0] || G.provinces[G.factions.temur.capital];
        if (at) addArmy('temur', at.id, ['spear', 'spear', 'archer', 'archer', 'lancer', 'heavycav', 'siege', 'tovachi'], null);
      }
    },
  },
  {
    id: 'herat', faction: 'kart', start: 0, deadline: 56, difficulty: 'Normal',
    title: 'Herat, City of Poets',
    blurb: 'Herat is small in land but great in learning: its madrasas, painters and poets are famous from Tabriz to Delhi. Malik Ghiyath al-Din can never outfight his neighbours. He can outshine them.',
    goal: { type: 'develop', provs: ['herat'], dev: { culture: 5, trade: 3 } },
    goalText: 'Win all five advances in Literature and arts and three in Trade before {date}, and keep Herat.',
    setup: () => {
      G.factions.kart.gold += 1500; G.provinces.herat.b.library = 1;
      // Malik Pir Ali pays his neighbours to keep away while his poets write
      for (const g of neighbourFactions('kart')) if (g !== 'rebels' && !rel('kart', g).war) rel('kart', g).truce = 18;
    },
  },
  {
    id: 'revenge', faction: 'golden', start: T0.revenge, deadline: T0.revenge + 7, difficulty: 'Hard',
    title: 'The Ungrateful Khan',
    blurb: 'Toqtamish owes his throne to Temur, and he has not forgotten it: he hates him for it. Now he rules the whole Horde of Jochi, from the Volga to the Syr Darya. Temur and his best men are far away in Persia. This winter the Horde rides south.',
    goal: { type: 'take', provs: ['otrar', 'tashkent', 'bukhara'] },
    goalText: 'Take Otrar, Tashkent and Bukhara before {date}. Temur will come back from Persia in {back}.',
    goalVars: () => ({ back: dateM(T0.revenge + 2) }),
    winText: 'Bukhara, Tashkent and Otrar fly the banners of the Horde. In history Toqtamish burned the palaces of Transoxiana and then fled before Temur’s return. In this story, the Chagatai Ulus has lost its heart, and the steppe rules the cities once more.',
    setup: () => {
      annex('golden', 'white');
      setLeader('golden', 'Toqtamish', 45);
      declareWar('golden', 'temur', true); rel('golden', 'temur').att = -80;
      // Temur and his veterans are away in Persia
      for (const a of armiesOf('temur')) { for (const u of a.units) u.men = Math.round(u.men * 0.55); }
      const base = ['sighnaq', 'saraichik', 'emba'].find(id => G.provinces[id] && G.provinces[id].owner === 'golden') || G.factions.golden.capital;
      strikeArmy('golden', base, ['horsearch', 'horsearch', 'horsearch', 'lancer', 'lancer', 'heavycav', 'heavycav', 'ordu', 'spear', 'archer', 'siege', 'siege']);
      strikeArmy('golden', base, ['horsearch', 'horsearch', 'lancer', 'lancer', 'heavycav', 'spear']);
      // A second column crosses the Kyzylkum for Bukhara, as the Horde did in 1388
      strikeArmy('golden', ['jend', 'sighnaq'].find(id => G.provinces[id] && G.provinces[id].owner === 'golden') || base, ['horsearch', 'horsearch', 'horsearch', 'lancer', 'lancer', 'heavycav', 'spear', 'archer', 'siege', 'siege']);
      G.factions.golden.gold += 2500;
    },
    // Temur comes back from Persia
    onTurn: () => {
      if (G.turn === T0.revenge + 2 && G.factions.temur.alive) {
        const at = G.provinces.samarkand.owner === 'temur' ? 'samarkand' : (provsOf('temur')[0] || {}).id;
        if (at) { addArmy('temur', at, ['heavyinf', 'spear', 'spear', 'archer', 'archer', 'lancer', 'heavycav', 'tovachi'], makeGeneral('temur', G.factions.temur.leader, 6, 52, true)); }
        HOOKS.notify({ title: t('Temur returns'), text: t('Riders bring the news: Temur has crossed the Amu Darya with the army of Persia, and he is marching north.'), history: true });
      }
    },
  },
  {
    id: 'sarai', faction: 'temur', start: T0.sarai, deadline: T0.sarai + 5, difficulty: 'Normal',
    title: 'The Sack of Sarai',
    blurb: 'On the Terek, in April 1395, Temur has broken the army of Toqtamish. The khan has fled into the steppe. Now the road lies open to Sarai, the richest city of the north, where the Horde keeps the treasure of a hundred and fifty years.',
    goal: { type: 'take', provs: ['sarai', 'hajjitarkhan'] },
    goalText: 'Take Sarai and Hajji-Tarkhan before {date}.',
    winText: 'Sarai burns, and Hajji-Tarkhan with it. The Golden Horde never recovers: its trade turns away to new roads, and the steppe empire of Batu fades. Temur rides home to Samarkand with the craftsmen of the north in his train.',
    setup: () => {
      annex('golden', 'white');
      setLeader('golden', 'Toqtamish', 53);
      declareWar('temur', 'golden', true); rel('temur', 'golden').att = -90;
      for (const a of armiesOf('golden')) for (const u of a.units) u.men = Math.round(u.men * 0.5); // the Terek
      transferProvince(G.provinces.saraichik, 'temur', 5);
      strikeArmy('temur', 'saraichik', ['heavyinf', 'heavyinf', 'spear', 'spear', 'archer', 'archer', 'lancer', 'heavycav', 'heavycav', 'tovachi', 'siege', 'siege']);
      strikeArmy('temur', 'saraichik', ['horsearch', 'horsearch', 'lancer', 'lancer', 'heavycav', 'tovachi']);
      // The victors of the Terek, who came north through the Iron Gates of Derbent
      for (const id of ['derbent', 'terek']) if (G.provinces[id]) transferProvince(G.provinces[id], 'temur', 5);
      strikeArmy('temur', 'terek', ['horsearch', 'horsearch', 'lancer', 'lancer', 'heavycav', 'heavycav', 'heavyinf', 'spear', 'archer', 'siege']);
      G.factions.temur.gold += 2000;
    },
  },
  {
    id: 'heirs', faction: 'temur', start: T0.heirs, deadline: T0.heirs + 8, difficulty: 'Normal',
    title: 'The Heirs of Temur',
    blurb: 'In February 1405 Temur died at Otrar, on his way to China. His grandson Khalil Sultan has seized Samarkand and the treasury, and scatters gold to win the amirs. In Herat, Temur’s youngest son, Shah Rukh, gathers the army of Khorasan.',
    goal: { type: 'take', provs: ['samarkand', 'bukhara'] },
    goalText: 'Take Samarkand and Bukhara from Khalil Sultan before {date}.',
    winText: 'Shah Rukh enters Samarkand in 1409 and gives it to his son Ulugh Beg. He rules the empire of Temur from Herat for forty years, in peace, among poets, painters and builders. The age of the sword gives way to the age of the book.',
    setup: () => {
      setLeader('temur', 'Shah Rukh', 28);
      // Khorasan is Shah Rukh's own: the old dynasties of Herat and Sabzevar have long been swept away
      annex('temur', 'kart'); annex('temur', 'sarbadar');
      G.factions.temur.capital = 'herat';
      // Khalil Sultan holds Transoxiana with Temur's treasure
      for (const id of ['samarkand', 'bukhara', 'kesh', 'jizzakh']) if (G.provinces[id]) { for (const a of armiesIn(id)) if (a.owner === 'temur') a.prov = 'herat'; transferProvince(G.provinces[id], 'rebels', 0); }
      addArmy('rebels', 'samarkand', ['heavyinf', 'heavyinf', 'spear', 'spear', 'archer', 'archer', 'lancer', 'heavycav', 'tovachi'], makeGeneral('rebels', 'Khalil Sultan', 4, 21, false));
      addArmy('rebels', 'bukhara', ['spear', 'spear', 'archer', 'archer', 'lancer'], null);
      strikeArmy('temur', 'herat', ['heavyinf', 'heavyinf', 'spear', 'spear', 'archer', 'archer', 'lancer', 'heavycav', 'heavycav', 'siege', 'siege']);
      G.factions.temur.gold += 2500;
    },
  },
  {
    id: 'ulughbeg', faction: 'temur', start: T0.ulughbeg, deadline: T0.ulughbeg + 24, difficulty: 'Normal',
    title: 'Ulugh Beg’s Samarkand',
    blurb: 'Samarkand has a new master: Ulugh Beg, grandson of Temur, fifteen years old, who loves the stars more than the sword. Around him gather mathematicians and astronomers. Make his city the capital of learning of the whole world.',
    goal: { type: 'develop', provs: ['samarkand'], dev: { science: 5, culture: 3 } },
    goalText: 'Win all five advances in Science and three in Literature and arts before {date}, and keep Samarkand.',
    winText: 'On a hill above Samarkand rises the great observatory, with a sextant forty metres high. Ulugh Beg’s star tables, the most exact since Ptolemy, are copied in Istanbul, in Delhi and, centuries later, in Oxford.',
    setup: () => {
      setLeader('temur', 'Ulugh Beg', 15);
      G.factions.temur.gold += 2500;
      G.provinces.samarkand.b.library = Math.max(1, G.provinces.samarkand.b.library || 0);
      for (const id of ['qadizada', 'kashi']) if (SAGES[id] && !sagesOf('temur').includes(id)) sagesOf('temur').push(id);
      // The learning of Temur's age is already his: the paper of Samarkand, the hospitals, the court poets
      const d = devOf('temur');
      d.science.lvl = Math.max(d.science.lvl, 2); d.science.pts = Math.max(d.science.pts, ADV_COST[1]);
      d.culture.lvl = Math.max(d.culture.lvl, 1); d.culture.pts = Math.max(d.culture.pts, ADV_COST[0]);
      for (const id of ['samarkand', 'bukhara']) if (G.provinces[id]) G.provinces[id].b.madrasa = Math.max(1, G.provinces[id].b.madrasa || 0);
    },
  },
  {
    id: 'india', faction: 'temur', start: T0.india, deadline: T0.india + 6, difficulty: 'Hard',
    title: 'The Road to Delhi',
    blurb: 'Autumn 1398. Old Firuz Shah is dead, and his heirs fight over Delhi like dogs over a bone. Temur, sixty-two years old, has crossed the Hindu Kush and bridged the Indus. His grandson Pir Muhammad already holds Multan. Ahead lie the deserts of the Punjab, the fortress of Bhatnir and the war elephants of Sultan Mahmud.',
    goal: { type: 'take', provs: ['bhatnir', 'delhi'] },
    goalText: 'Take the fortress of Bhatnir and Delhi before {date}. Beware the war elephants: they break any line of horsemen.',
    winText: 'Delhi falls in December 1398, and its treasures are carried north for months. Temur rides home with ninety captured elephants, loaded with stone, and with the masons of India, who will raise the great mosque of Bibi-Khanym in Samarkand.',
    setup: () => {
      setLeader('temur', 'Amir Temur', 62);
      for (const f of ['khwarezm', 'kart', 'sarbadar', 'muzaffar']) if (G.factions[f].alive) annex('temur', f);
      for (const id of ['kabul', 'kandahar', 'quetta', 'peshawar', 'sistan', 'kunduz', 'badakhshan', 'khuttal', 'multan']) if (G.provinces[id] && G.provinces[id].owner !== 'temur') transferProvince(G.provinces[id], 'temur', 5);
      // The sultanate after Firuz Shah: the east has broken away, and Mallu Iqbal rules in the sultan's name
      setLeader('delhi', 'Nasir al-Din Mahmud', 25);
      for (const id of ['jaunpur', 'kannauj']) if (G.provinces[id]) transferProvince(G.provinces[id], 'rebels', 0);
      declareWar('temur', 'delhi', true); rel('temur', 'delhi').att = -80;
      // Mallu Iqbal waits on the road to Delhi with the elephants; the city keeps a garrison
      addArmy('delhi', 'samana', ['elephant', 'elephant', 'elephant', 'heavyinf', 'heavyinf', 'spear', 'spear', 'archer', 'archer', 'heavycav'], makeGeneral('delhi', 'Mallu Iqbal', 3, 40, false));
      addArmy('delhi', 'delhi', ['elephant', 'spear', 'spear', 'archer', 'archer'], null);
      G.provinces.samana.b.walls = 0; G.provinces.delhi.b.walls = 2;
      G.provinces.bhatnir.b.walls = 2;
      addArmy('rebels', 'bhatnir', ['spear', 'archer', 'archer'], null);
      // Temur's army on the Indus, and Pir Muhammad's at Multan
      const main = armiesOf('temur').find(a => a.general && a.general.leader);
      if (main) { main.prov = 'multan'; main.units.push(...['tovachi', 'tovachi', 'heavycav', 'heavycav', 'horsearch', 'horsearch', 'heavyinf', 'heavyinf', 'archer', 'archer', 'siege'].map(makeUnit)); main.units.splice(16); main.moves = armyMoves(main); }
      addArmy('temur', 'multan', ['horsearch', 'horsearch', 'horsearch', 'horsearch', 'lancer', 'lancer', 'heavycav', 'heavycav'], makeGeneral('temur', 'Pir Muhammad Mirza', 3, 24, false)).moves = 2;
      strikeArmy('temur', 'multan', ['heavyinf', 'spear', 'spear', 'archer', 'archer', 'siege', 'siege']);
      // Fear goes before Temur: cities open their gates rather than rise against him
      G.factions.temur.orderBonus = 15; G.factions.temur.orderBonusT = 10;
      G.factions.temur.gold += 3000;
    },
  },
  {
    id: 'ankara', faction: 'temur', start: T0.ankara, deadline: T0.ankara + 5, difficulty: 'Hard',
    title: 'The Thunderbolt and the Lame',
    blurb: 'Two conquerors who have never lost a battle. Bayezid the Thunderbolt has crushed the crusaders at Nicopolis and holds Constantinople in a stranglehold. He has answered Temur’s letters with insults. Now Temur has taken Sivas and marches into Anatolia, and Bayezid lifts the siege of Constantinople to meet him near Ankara.',
    goal: { type: 'take', provs: ['ankara', 'bursa'] },
    goalText: 'Take Ankara and the Ottoman capital Bursa before {date}. Temur’s agents are talking to the Tatar horsemen in Bayezid’s army.',
    winText: 'On 28 July 1402, near Ankara, the Tatars change sides, the Serbian knights fight to the last, and Bayezid is taken prisoner. He dies in captivity the next year. His sons fight each other for ten years, Constantinople is saved for half a century, and the kings of Europe write to Temur to thank him.',
    setup: () => {
      setLeader('temur', 'Amir Temur', 66);
      for (const f of ['khwarezm', 'kart', 'sarbadar', 'muzaffar', 'jalayir']) if (G.factions[f].alive) annex('temur', f);
      for (const id of ['tbilisi', 'shamakhi', 'van', 'erzurum', 'erzincan', 'diyarbakir', 'sivas', 'malatya', 'luristan', 'shushtar', 'hormuz', 'astarabad', 'mazandaran', 'rayy', 'merv', 'tus']) if (G.provinces[id] && G.provinces[id].owner !== 'temur') transferProvince(G.provinces[id], 'temur', 5);
      // Bayezid's empire: every beylik of Anatolia, the Balkans to the Danube
      G.charsJoined = (G.charsJoined || []).concat(['bayezid']);
      setLeader('ottoman', 'Bayezid', 42);
      for (const id of ['kutahya', 'aydin', 'antalya', 'konya', 'kastamonu', 'amasya', 'varna']) if (G.provinces[id] && G.provinces[id].owner !== 'ottoman') transferProvince(G.provinces[id], 'ottoman', 5);
      declareWar('temur', 'ottoman', true); rel('temur', 'ottoman').att = -90;
      // Bayezid has marched from the siege of Constantinople and waits for Temur in the open plain of Ankara
      const main = armiesOf('ottoman').find(a => a.general && a.general.leader);
      if (main) { main.prov = 'ankara'; main.units.push(...['janissary', 'janissary', 'janissary', 'heavycav', 'heavycav', 'spear', 'archer', 'horsearch', 'horsearch', 'horsearch'].map(makeUnit)); main.units.splice(16); }
      // His son Suleyman holds Bursa
      addArmy('ottoman', 'bursa', ['janissary', 'spear', 'archer', 'heavycav'], makeGeneral('ottoman', 'Suleyman Chelebi', 3, 25, false));
      for (const a of armiesIn('ankara')) if (a.owner === 'ottoman' && a !== main) a.prov = 'kutahya';
      G.provinces.ankara.b.walls = 0; G.provinces.bursa.b.walls = 1; G.provinces.nicomedia.b.walls = 1;
      const tm = armiesOf('temur').find(a => a.general && a.general.leader);
      if (tm) { tm.prov = 'sivas'; tm.units.push(...['tovachi', 'tovachi', 'heavycav', 'heavycav', 'horsearch', 'horsearch', 'heavyinf', 'archer', 'siege', 'siege'].map(makeUnit)); tm.moves = armyMoves(tm); }
      // Temur's grandson Muhammad Sultan leads the riders who will race to Bursa
      G.charsJoined.push('muhammadsultan');
      addArmy('temur', 'sivas', ['horsearch', 'horsearch', 'horsearch', 'horsearch', 'lancer', 'lancer', 'heavycav', 'heavycav', 'tovachi'], makeGeneral('temur', 'Muhammad Sultan Mirza', 4, 27, false)).moves = 2;
      strikeArmy('temur', 'sivas', ['heavyinf', 'heavyinf', 'spear', 'spear', 'archer', 'archer', 'siege']);
      G.factions.temur.orderBonus = 15; G.factions.temur.orderBonusT = 10;
      G.factions.temur.gold += 3000;
      tatarsDefect();
    },
  },
];
// Ankara, 1402: the Tatar horsemen of Bayezid's army go over to Temur, as his agents arranged
function tatarsDefect() {
  let n = 0;
  for (const a of armiesOf('ottoman')) for (let i = a.units.length - 1; i >= 0; i--) if (a.units[i].type === 'horsearch' && n < 4) { a.units.splice(i, 1); n++; }
  if (!n) return;
  const tm = armiesOf('temur').find(a => a.general && a.general.leader) || armiesOf('temur')[0];
  if (tm) addArmy('temur', tm.prov, Array(n).fill('horsearch'), makeGeneral('temur', 'Qara Tatar', 2, 40, false)).moves = 2;
  HOOKS.notify({ title: t('The Tatars change sides'), text: t('The Tatar horsemen of Bayezid’s army ride over to Temur, as his agents promised. They were Turks of the steppe, they said, and Temur was their own kind.'), history: true });
}

// Who ruled each nation in a given year, so a campaign that starts late finds the right people on the thrones
const RULERS = {
  golden: [[1370, 'Beglerbeg Mamai'], [1380, 'Toqtamish'], [1396, 'Temur Qutlugh'], [1400, 'Shadi Beg']],
  white: [[1370, 'Urus Khan'], [1377, 'Toqtamish']],
  moghul: [[1370, 'Qamar al-Din Dughlat'], [1389, 'Khizr Khoja'], [1399, 'Shams-i Jahan']],
  khwarezm: [[1370, 'Husayn Sufi'], [1372, 'Yusuf Sufi'], [1380, 'Sulayman Sufi']],
  ottoman: [[1370, 'Murad I'], [1389, 'Bayezid'], [1403, 'Suleyman Chelebi'], [1413, 'Mehmed I']],
  mamluk: [[1370, "al-Ashraf Sha'ban"], [1377, 'al-Mansur Ali'], [1382, 'Barquq'], [1399, 'Faraj'], [1412, 'al-Muayyad Shaykh']],
  jalayir: [[1370, 'Shaikh Uvais'], [1374, 'Husayn Jalayir'], [1382, 'Ahmad Jalayir']],
  muzaffar: [[1370, 'Shah Shuja'], [1384, 'Zayn al-Abidin'], [1387, 'Shah Mansur']],
  delhi: [[1370, 'Firuz Shah Tughluq'], [1388, 'Ghiyath al-Din Tughluq II'], [1394, 'Nasir al-Din Mahmud'], [1413, 'Daulat Khan Lodi']],
};
function historicRulers() {
  // Bayezid's empire of the 1390s: the beyliks of Anatolia and the Black Sea coast
  if (year() >= 1390 && year() < 1403 && G.factions.ottoman.alive) {
    const lands = ['kutahya', 'aydin', 'antalya', 'kastamonu', 'amasya', 'varna'].concat(year() >= 1397 ? ['konya', 'sivas'] : []);
    for (const id of lands) if (G.provinces[id] && G.provinces[id].owner === 'rebels') transferProvince(G.provinces[id], 'ottoman', 5);
  }
  if (year() >= 1394 && G.provinces.jaunpur && G.provinces.jaunpur.owner === 'delhi') transferProvince(G.provinces.jaunpur, 'rebels', 0);
  for (const f in RULERS) {
    if (!G.factions[f] || !G.factions[f].alive) continue;
    const r = RULERS[f].filter(x => x[0] <= year()).pop();
    if (!r || r[1] === G.factions[f].leader) continue;
    const c = charByName(r[1]);
    setLeader(f, r[1], c ? year() - c.born : 35);
    const h = charByName(G.factions[f].heir);
    if ((h && h.died <= year()) || G.factions[f].heir === r[1]) G.factions[f].heir = null;
  }
}
const scenarioById = id => SCENARIOS.find(s => s.id === id) || (typeof challengeSpec === 'function' ? challengeSpec(id) : null);
// A campaign's goal in words (a challenge writes its own, with the names of the day)
const goalTextOf = S => S.challenge ? challengeGoalText(S) : t(S.goalText, Object.assign({ date: dateM(S.deadline) }, S.goalVars ? S.goalVars() : {}));

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
  newGame(S.faction, S.seed);
  G.scenario = { id, deadline: S.deadline, result: null };
  if (S.start) {
    // Events before the start date are history already; people are older
    for (let i = 0; i < EVENTS.length; i++) { const e = EVENTS[i]; if (turnAt(e.when[0], e.when[1]) <= S.start && !G.fired.includes(i)) G.fired.push(i); }
    const years = Math.floor((GAME.START_MONTH + S.start) / 12);
    for (const a of Object.values(G.armies)) if (a.general) a.general.age += years;
    G.turn = S.start;
    for (const a of Object.values(G.armies)) a.moves = armyMoves(a);
  }
  if (S.start) historicRulers();
  S.setup();
  // People who were dead by then do not lead armies: new commanders take their place
  if (S.start) for (const a of Object.values(G.armies)) {
    const c = a.general && charByName(a.general.name);
    if (c && c.died <= year() && G.factions[a.owner].leader !== a.general.name) { a.general.name = newGeneralName(a.owner); a.general.age = 30 + Math.floor(rng() * 20); a.general.leader = false; }
  }
  log(() => dateText() + ': ' + t(S.title) + '. ' + goalTextOf(S), 'history');
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
