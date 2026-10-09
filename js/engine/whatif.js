'use strict';
// "What if" history: the turning points of the age. When one comes, the ruler who faced it in history
// decides. The first choice is always what really happened; the others change what comes later.
// Rival rulers decide too, usually as history did, so every campaign can take its own path.

// A moment of history in the monthly calendar: spring (April) or autumn (October) of a year
const TT = (y, s = 0) => turnAt(y, s ? 9 : 3);
const alt = k => (G.alt && G.alt[k]) || null;
function setAlt(k, v) { G.alt = G.alt || {}; G.alt[k] = v; }
// A consequence that comes some turns later
function altLater(id, turn) { G.altQ = G.altQ || []; G.altQ.push({ id, turn }); }
const alive = f => !!(G.factions[f] && G.factions[f].alive);
const ownerOf = pid => G.provinces[pid] && G.provinces[pid].owner;
function armyFor(f, units, general, cmd) {
  const cap = G.factions[f].capital && ownerOf(G.factions[f].capital) === f ? G.factions[f].capital : (provsOf(f)[0] || {}).id;
  if (cap) addArmy(f, cap, units, general ? makeGeneral(f, general, cmd || 3, 30, false) : null);
}
function makePeaceIf(a, b) { if (rel(a, b).war) applyDeal(a, b, 'peace'); }
function leaderDies(f) {
  const a = armiesOf(f).find(x => x.general && x.general.leader);
  if (a) generalDied(a, 'age'); else succession(f);
}

const WHATIFS = [
  // ---- Toqtamish, the fugitive prince ----
  { id: 'toqtamish', by: 'temur', vs: 'white', from: TT(1375, 1), to: TT(1377, 0), who: 'Toqtamish', whoF: 'white',
    when: () => alive('white') && !alt('toqtamish'),
    title: 'The fugitive prince',
    text: () => t('Toqtamish, a young prince of the line of Chinggis Khan, has fled to your court after Urus Khan beat him. He begs for men and horses to win back his inheritance. History remembers what Temur chose, and that the prince he raised up later turned against him.'),
    options: [
      { label: c => t('Give him men and horses (−{n} gold)', { n: cost(c, 400) }), hint: 'As in history. He may take the White Horde, and be grateful, for a while.',
        act: c => { c.st.gold -= cost(c, 400); setAlt('toqtamish', 'backed'); rel('temur', 'white').att -= 20; return t('Toqtamish rides north with your horsemen. If he wins, the steppe will owe you a debt.'); } },
      { label: () => t('Hand him over to Urus Khan'), hint: 'The White Horde will be grateful, but men will call you faithless.',
        act: c => { setAlt('toqtamish', 'handed'); rel('temur', 'white').att += 45; shiftTrust(c.f, -8); return t('Toqtamish is sent north in chains. Urus Khan sends you a herd of white horses in thanks.'); } },
      { label: () => t('Keep him at your court, as one of your generals'), hint: 'A fine cavalry commander, and the White Horde stays in the hands of Urus Khan’s sons.',
        act: c => { setAlt('toqtamish', 'kept'); rel('temur', 'white').att -= 10; armyFor('temur', ['horsearch', 'horsearch', 'lancer'], 'Toqtamish', 4); return t('Toqtamish swears to serve you. He takes command of a regiment of steppe horsemen.'); } },
    ],
    ai: [0.75, 0.1, 0.15],
    aiText: ['Amir Temur gives the fugitive prince Toqtamish an army to win back the White Horde.', 'Amir Temur hands the fugitive prince Toqtamish over to Urus Khan.', 'Amir Temur keeps the fugitive prince Toqtamish at his court as a general.'] },
  { id: 'fugitive', by: 'white', vs: 'temur', from: TT(1375, 1), to: TT(1377, 0), who: 'Toqtamish', whoF: 'white',
    when: () => alive('temur') && !alt('toqtamish'),
    title: 'The fugitive prince',
    text: () => t('Your rival Toqtamish has escaped to the court of Amir Temur, who is giving him men and horses. As long as he lives, there is a claimant to your throne.'),
    options: [
      { label: () => t('Let him come: we will beat him in the field'), hint: 'As in history. Temur backs him, and he will attack you.',
        act: () => { setAlt('toqtamish', 'backed'); altLater('toqtamish_raid', G.turn + 2); return t('Your scouts watch the road from Otrar. Toqtamish will come.'); } },
      { label: () => t('Demand that Temur hand him over'), hint: 'Temur may agree, or take offence.',
        act: () => {
          if (rng() < (rel('white', 'temur').att > 0 ? 0.55 : 0.3)) { setAlt('toqtamish', 'handed'); rel('white', 'temur').att += 20; return t('Temur does not want a war with the steppe. Toqtamish is sent to you in chains.'); }
          setAlt('toqtamish', 'backed'); rel('white', 'temur').att -= 25; altLater('toqtamish_raid', G.turn + 2);
          return t('Temur laughs at your envoys. Toqtamish will come, with Temur’s horsemen behind him.');
        } },
      { label: c => t('Send assassins (−{n} gold)', { n: cost(c, 300) }), hint: 'They may kill him. If they fail, Temur will be furious.',
        act: c => {
          c.st.gold -= cost(c, 300);
          if (rng() < 0.45) { setAlt('toqtamish', 'dead'); return t('Toqtamish is found dead in his tent near Otrar. No one saw the killer.'); }
          setAlt('toqtamish', 'backed'); rel('white', 'temur').att -= 35; altLater('toqtamish_raid', G.turn + 1);
          return t('The assassins are caught and confess. Temur gives Toqtamish even more men.');
        } },
    ],
    ai: [1, 0, 0] },

  // ---- Khwarezm and the bride ----
  { id: 'khwarezm', by: 'temur', vs: 'khwarezm', from: TT(1371, 1), to: TT(1372, 1), who: 'Husayn Sufi', whoF: 'khwarezm',
    when: () => alive('khwarezm') && !alt('khwarezm'),
    title: 'Kath and Khiva',
    text: () => t('Husayn Sufi of Khwarezm will not give back Kath and Khiva. Your amirs want war. Your wise men say there is another way: Khanzade, the famous beauty of Urgench, is of age, and your son Jahangir has no wife.'),
    options: [
      { label: () => t('March on Khwarezm'), hint: 'As in history: war with Khwarezm.',
        act: () => { setAlt('khwarezm', 'war'); declareWar('temur', 'khwarezm', true); return t('Your army gathers on the Amu Darya. The Sufi dynasty will answer for its pride.'); } },
      { label: () => t('Ask for Khanzade’s hand for Jahangir'), hint: 'Peace and a royal wedding, but Khwarezm keeps its cities.',
        act: () => { setAlt('khwarezm', 'wed'); makePeaceIf('temur', 'khwarezm'); applyDeal('temur', 'khwarezm', 'marriage'); return t('The wedding is the most splendid the steppe has seen. Khwarezm and the Chagatai Ulus are bound by blood.'); } },
      { label: c => t('Buy Kath back (−{n} gold)', { n: cost(c, 600) }), hint: 'Gold instead of blood.',
        act: c => {
          c.st.gold -= cost(c, 600); setAlt('khwarezm', 'bought');
          if (ownerOf('kath') === 'khwarezm') transferProvince(G.provinces.kath, 'temur', 10);
          rel('temur', 'khwarezm').att += 15;
          return t('Husayn Sufi counts the gold and hands over the keys of Kath.');
        } },
    ],
    ai: [0.7, 0.2, 0.1],
    aiText: ['Amir Temur marches on Khwarezm to take back Kath and Khiva.', 'Amir Temur asks for Khanzade of Khwarezm as a bride for his son Jahangir. Peace is made.', 'Amir Temur buys Kath back from Khwarezm with gold.'] },
  { id: 'husayn', by: 'khwarezm', vs: 'temur', from: TT(1371, 1), to: TT(1372, 1), who: 'Amir Temur', whoF: 'temur',
    when: () => alive('temur') && !alt('khwarezm'),
    title: 'Temur’s envoy',
    text: () => t('Temur’s envoy stands in your hall in Urgench and demands Kath and Khiva back. In history, Husayn Sufi called him a rebel who rose by the sword and told him to come and fight.'),
    options: [
      { label: () => t('Tell Temur to come and fight'), hint: 'As in history: war with Temur.',
        act: () => { setAlt('khwarezm', 'war'); declareWar('temur', 'khwarezm', true); return t('The envoy rides away. By spring, Temur’s army is on the Amu Darya.'); } },
      { label: () => t('Offer Khanzade in marriage to his son'), hint: 'Peace with Temur. Your amirs think you weak.',
        act: c => { setAlt('khwarezm', 'wed'); makePeaceIf('temur', 'khwarezm'); applyDeal('khwarezm', 'temur', 'marriage'); c.st.orderBonus = -5; c.st.orderBonusT = 3; return t('Khanzade rides to Samarkand with a dowry of gold and pearls. There is peace, for now.'); } },
      { label: () => t('Give him Kath'), hint: 'Lose a city, keep the peace, and gain his respect.',
        act: () => { setAlt('khwarezm', 'bought'); if (ownerOf('kath') === 'khwarezm') transferProvince(G.provinces.kath, 'temur', 10); rel('temur', 'khwarezm').att += 35; return t('Kath goes to Temur. He sends a robe of honour in return.'); } },
    ],
    ai: [1, 0, 0] },

  // ---- Kulikovo ----
  { id: 'kulikovo', by: 'golden', from: TT(1380, 0), to: TT(1380, 1), who: 'Beglerbeg Mamai', whoF: 'golden',
    when: () => !alt('kulikovo'),
    title: 'Moscow refuses tribute',
    text: () => t('Prince Dmitry of Moscow will no longer pay the tribute the Horde has taken for a hundred and forty years. The amirs call for a great campaign to burn Moscow. In history it ended on the field of Kulikovo.'),
    options: [
      { label: () => t('March on Moscow with the whole Horde'), hint: 'As in history. A great battle on the Don, and no one knows its end.',
        act: () => { setAlt('kulikovo', 'march'); return t('The Horde rides west, with Genoese foot soldiers and Circassian horsemen.'); } },
      { label: c => t('Pay Lithuania to march with us (−{n} gold)', { n: cost(c, 500) }), hint: 'With an ally beside you, the battle is safer.',
        act: c => { c.st.gold -= cost(c, 500); setAlt('kulikovo', 'lithuania'); return t('Grand Duke Jogaila promises to bring his army to the Don.'); } },
      { label: () => t('Forgive the tribute this year'), hint: 'No battle, but the amirs think you weak.',
        act: c => { setAlt('kulikovo', 'peace'); c.st.orderBonus = -8; c.st.orderBonusT = 4; return t('Moscow keeps its silver. In the Horde, men mutter that the old days are over.'); } },
    ],
    ai: [0.8, 0.12, 0.08],
    aiText: ['Mamai leads the Golden Horde against Moscow.', 'Mamai marches on Moscow with Lithuania as his ally.', 'Mamai forgives Moscow its tribute. There will be no great battle this year.'] },

  // ---- Herat and the Sarbadars bow, or not ----
  { id: 'herat', by: 'kart', from: TT(1380, 0), to: TT(1381, 0), who: 'Amir Temur', whoF: 'temur',
    when: () => alive('temur') && !rel('kart', 'temur').war,
    title: 'A summons from Temur',
    text: () => t('Temur summons you to his kurultai, to bow as his vassal. In history, the malik of Herat delayed and strengthened his walls, and Herat fell in 1381.'),
    options: [
      { label: () => t('Delay, and strengthen the walls'), hint: 'As in history. Temur will be angry.',
        act: () => { if (ownerOf('herat') === 'kart') G.provinces.herat.b.walls = Math.min(3, G.provinces.herat.b.walls + 1); rel('temur', 'kart').att -= 40; if (rng() < 0.7) declareWar('temur', 'kart', true); return t('Masons work day and night on the walls of Herat.'); } },
      { label: c => t('Go and bow to Temur (−{n} gold)', { n: cost(c, 400) }), hint: 'An alliance with Temur. Your amirs feel the shame.',
        act: c => { c.st.gold -= cost(c, 400); makePeaceIf('kart', 'temur'); applyDeal('kart', 'temur', 'alliance'); rel('kart', 'temur').att += 30; c.st.orderBonus = -5; c.st.orderBonusT = 3; return t('You kneel before Temur’s throne. He raises you up and calls you his son.'); } },
      { label: () => t('Ally with the Sarbadars against him'), hint: 'Two small realms are stronger together.',
        act: () => { if (alive('sarbadar')) { makePeaceIf('kart', 'sarbadar'); applyDeal('kart', 'sarbadar', 'alliance'); } rel('temur', 'kart').att -= 20; return t('Envoys ride to Sabzevar. Khorasan will stand together.'); } },
    ],
    ai: [0.7, 0.2, 0.1],
    aiText: ['The malik of Herat refuses to bow to Temur and strengthens his walls.', 'The malik of Herat bows to Temur and becomes his ally.', 'The Kartids and the Sarbadars ally against Temur.'] },
  { id: 'sabzevar', by: 'sarbadar', from: TT(1381, 0), to: TT(1381, 1), who: 'Amir Temur', whoF: 'temur',
    when: () => alive('temur'),
    title: 'Temur in Khorasan',
    text: () => t('Temur’s army is in Khorasan. In history, Khwaja Ali Mu’ayyad rode out to meet him and submitted, and kept his city.'),
    options: [
      { label: c => t('Submit, as Khwaja Ali did (−{n} gold)', { n: cost(c, 300) }), hint: 'As in history. Peace and friendship with Temur.',
        act: c => { c.st.gold -= cost(c, 300); makePeaceIf('sarbadar', 'temur'); rel('sarbadar', 'temur').att += 50; if (rel('sarbadar', 'temur').att > 30) applyDeal('sarbadar', 'temur', 'alliance'); return t('Temur receives you kindly. Sabzevar is spared.'); } },
      { label: () => t('Resist from behind the walls'), hint: 'War with Temur, but your people are proud of you.',
        act: c => { declareWar('temur', 'sarbadar', true); if (ownerOf('sabzevar') === 'sarbadar') G.provinces.sabzevar.b.walls = Math.min(3, G.provinces.sabzevar.b.walls + 1); c.st.orderBonus = 8; c.st.orderBonusT = 4; return t('“We would rather hang than submit,” the people shout, as their fathers did.'); } },
      { label: () => t('Call the dervishes to holy war'), hint: 'Fanatical warriors join you, and war with Temur.',
        act: c => { declareWar('temur', 'sarbadar', true); armyFor('sarbadar', ['dervish', 'dervish', 'dervish'], null); c.st.orderBonus = 12; c.st.orderBonusT = 4; return t('The dervishes leave their lodges with swords in their hands.'); } },
    ],
    ai: [0.75, 0.15, 0.1],
    aiText: ['Khwaja Ali Mu’ayyad of the Sarbadars submits to Temur.', 'The Sarbadars refuse to submit to Temur and prepare for a siege.', 'The Sarbadars call their dervishes to holy war against Temur.'] },

  // ---- A bride from Moghulistan ----
  { id: 'tukal', by: 'moghul', from: TT(1389, 0), to: TT(1397, 1), who: 'Khizr Khoja', whoF: 'moghul',
    when: () => alive('temur') && !rel('moghul', 'temur').married,
    title: 'Temur asks for a bride',
    text: () => t('Temur’s envoys ask for the hand of your daughter Tukal Khanum. In history she married him in 1397, and the long wars between Moghulistan and Samarkand came to an end.'),
    options: [
      { label: () => t('Send Tukal Khanum to Samarkand'), hint: 'As in history. Peace and a marriage with Temur.',
        act: () => { makePeaceIf('moghul', 'temur'); applyDeal('moghul', 'temur', 'marriage'); return t('Tukal Khanum leaves for Samarkand with a great train of horses. The steppe is at peace.'); } },
      { label: () => t('Refuse, and raid Transoxiana'), hint: 'War, and plunder.',
        act: c => { declareWar('moghul', 'temur', true); c.st.gold += cost(c, 600); return t('Your riders burn the villages of Fergana and come home with loot.'); } },
      { label: () => t('Turn east: holy war on the Uyghur cities'), hint: 'Gold and glory far from Temur.',
        act: c => { c.st.gold += cost(c, 900); c.st.orderBonus = 8; c.st.orderBonusT = 4; return t('Your army rides east to Turfan and returns with gold and captives.'); } },
    ],
    ai: [0.7, 0.15, 0.15],
    aiText: ['Khizr Khoja of Moghulistan sends his daughter Tukal Khanum to marry Temur. The old enemies make peace.', 'Moghulistan refuses Temur’s offer of marriage and raids Transoxiana.', 'Khizr Khoja turns away from Temur and wages holy war on the Uyghur cities.'] },

  // ---- The China campaign ----
  { id: 'china', by: 'temur', from: TT(1404, 0), to: TT(1406, 1), who: 'Amir Temur', whoF: 'temur',
    when: () => G.factions.temur.leader === 'Amir Temur',
    title: 'The march on China',
    text: () => t('The Ming emperor demands that you pay him tribute. You are nearly seventy. Your amirs have gathered two hundred thousand men for a winter march on China. In history, Temur fell ill at Otrar and died in February 1405.'),
    options: [
      { label: () => t('March east in the winter'), hint: 'As in history. The cold is bitter, and you are old.',
        act: c => {
          setAlt('china', 'march');
          if (rng() < 0.6) { leaderDies('temur'); return t('The snow lies deep at Otrar. The old conqueror catches a fever and dies. The great army turns back.'); }
          c.st.gold += cost(c, 2000);
          return t('Against all fears you cross the mountains. The frightened Ming emperor sends silk, silver and porcelain to keep you away.');
        } },
      { label: () => t('Wait for spring'), hint: 'The army rests in its winter camps.', act: c => { setAlt('china', 'wait'); c.st.orderBonus = 5; c.st.orderBonusT = 3; return t('You spend the winter in your gardens in Samarkand. The campaign can wait.'); } },
      { label: () => t('Give up China, and make the amirs swear to your heir'), hint: 'No campaign. When you die, your sons will not fight over the throne.',
        act: c => { setAlt('china', 'heir'); c.st.sworn = 1; c.st.orderBonus = 6; c.st.orderBonusT = 4; return t('One by one the amirs and princes kneel and swear on the Quran to serve {heir} after you.', { heir: pn(c.st.heir) }); } },
    ],
    ai: [0.8, 0.2, 0],
    aiText: ['Amir Temur marches on China in the depth of winter.', 'Amir Temur puts off his campaign against China until spring.', 'Amir Temur gives up the march on China and settles his succession.'] },
];

// The dome that was raised too fast: whoever completes the Bibi-Khanym mosque faces this
const BIBI = { id: 'bibi', title: 'Cracks in the dome', who: 'Saray Mulk Khanum', whoF: 'temur',
  text: () => t('Cracks run through the great dome of the Bibi-Khanym mosque. It was raised too fast, and bricks fall on the worshippers. In history, Temur had the builders punished and the mosque began to crumble within a few years.'),
  options: [
    { label: () => t('Punish the builders and patch the cracks'), hint: 'As in history. The mosque may not last.',
      act: () => { setAlt('bibi', 'patched'); if (rng() < 0.65) altLater('bibi_fall', G.turn + 4 + Math.floor(rng() * 5)); return t('The master builders are dragged before you. New plaster covers the cracks, for now.'); } },
    { label: c => t('Pull down the dome and build it again properly (−{n} gold)', { n: cost(c, 1200) }), hint: 'Costly, but it will stand for centuries.',
      act: c => { c.st.gold -= cost(c, 1200); setAlt('bibi', 'rebuilt'); c.st.orderBonus = 6; c.st.orderBonusT = 4; return t('The best masons of Tabriz and Delhi raise the dome again, slowly and well. It will stand.'); } },
    { label: () => t('Leave it in the hands of God'), hint: 'It costs nothing.', act: () => { setAlt('bibi', 'left'); if (rng() < 0.8) altLater('bibi_fall', G.turn + 3 + Math.floor(rng() * 4)); return t('The imams pray for the dome. The cracks grow wider.'); } },
  ],
  ai: [0.7, 0.2, 0.1] };

// What a choice made long ago brings about
const ALT_EVENTS = {
  toqtamish_betrays: {
    ok: () => alive('white') && alive('temur') && G.factions.white.leader === 'Toqtamish' && !rel('white', 'temur').war,
    title: 'The ungrateful khan', text: 'Toqtamish, whom Temur raised to the throne of the steppe, has turned against his patron. His horsemen cross the Syr Darya to plunder Transoxiana.',
    apply: () => { declareWar('white', 'temur', true); G.factions.white.gold += 1500; } },
  toqtamish_raid: {
    ok: () => alive('white') && alive('temur') && isHuman('white') && !isHuman('temur'),
    title: 'Toqtamish attacks', text: 'With Temur’s horsemen behind him, Toqtamish crosses into the White Horde to claim the throne.',
    apply: () => { if (!rel('temur', 'white').war) declareWar('temur', 'white', true); const p = ['otrar', 'sighnaq'].find(id => ownerOf(id) === 'temur') || (provsOf('temur')[0] || {}).id; if (p) addArmy('temur', p, ['horsearch', 'horsearch', 'lancer', 'horsearch'], makeGeneral('temur', 'Toqtamish', 4, 33, false)); } },
  bibi_fall: {
    ok: () => !!(G.wonders && G.wonders.bibikhanym),
    title: 'The dome falls', text: 'With a roar heard across Samarkand, the great dome of the Bibi-Khanym mosque collapses. The wonder is lost.',
    apply: () => { G.wonders.bibikhanym = false; const o = ownerOf('samarkand'); if (o && o !== 'rebels') { G.factions[o].orderBonus = -10; G.factions[o].orderBonusT = 4; } } },
};

// Turning points the player can face this turn (shown with the turn's other choices)
function pickWhatIf() {
  const pl = G.player;
  G.altDone = G.altDone || {};
  if (G.wonders && G.wonders.bibikhanym && !alt('bibi') && ownerOf('samarkand') === pl && G.turn >= (G.bibiAt || 0)) return { story: whatifStory(BIBI), ctx: storyContext(pl), whatif: true };
  for (const w of WHATIFS) {
    if (w.by !== pl || G.altDone[w.id] !== undefined || !alive(pl)) continue;
    if (nowM() < w.from || nowM() > w.to || !w.when()) continue;
    G.altDone[w.id] = 'open';
    return { story: whatifStory(w), ctx: storyContext(pl), whatif: true };
  }
  return null;
}
// A turning point in the shape of a story, remembering the choice
function whatifStory(w) {
  return {
    id: w.id, title: w.title, kicker: 'A turning point of history', who: () => w.who, whoFaction: () => w.whoF || G.player,
    text: w.text,
    options: w.options.map((o, i) => ({ label: o.label, hint: o.hint, act: c => {
      G.altDone = G.altDone || {}; G.altDone[w.id] = i;
      const out = o.act(c);
      G.altLog = G.altLog || []; G.altLog.push({ id: w.id, title: w.title, i, turn: G.turn, label: allLangs(() => o.label(c)) });
      if (i > 0) feat('alt');
      return out;
    } })),
  };
}

// Each turn: rival rulers make their own choices, and old choices bear fruit
function whatifTurn() {
  G.altDone = G.altDone || {};
  for (const w of WHATIFS) {
    if (G.altDone[w.id] !== undefined || nowM() < w.from) continue;
    if (isHuman(w.by)) { if (nowM() > w.to) G.altDone[w.id] = 0; continue; } // the moment passed
    if (!alive(w.by) || nowM() > w.to) { G.altDone[w.id] = 0; continue; }
    if (isHuman(w.vs)) continue; // a person answers this one from the other side
    if (!w.when()) continue;
    // A rival decides: usually as history did
    let r = rng(), i = 0;
    while (i < w.ai.length - 1 && r > w.ai[i]) { r -= w.ai[i]; i++; }
    const c = storyContext(w.by);
    G.altDone[w.id] = i;
    w.options[i].act(c);
    if (w.aiText) {
      const text = t(w.aiText[i]), ai = w.aiText[i];
      log(() => dateText() + ': ' + t(ai), 'history');
      HOOKS.notify({ title: (i === 0 ? '' : t('History takes another path') + ': ') + t(w.title), text: text + (i > 0 ? ' ' + t('This is not what happened in our history.') : ''), history: true, minor: i === 0 });
    }
  }
  // The Bibi-Khanym mosque in a rival's hands
  if (G.wonders && G.wonders.bibikhanym && !alt('bibi')) {
    const o = ownerOf('samarkand');
    G.bibiAt = G.bibiAt || G.turn + 3;
    if (!isHuman(o) && o !== 'rebels' && G.turn >= G.bibiAt) BIBI.options[0].act(storyContext(o));
  }
  for (const q of (G.altQ || []).filter(q => q.turn <= G.turn)) {
    const e = ALT_EVENTS[q.id];
    if (e && e.ok()) {
      e.apply();
      log(() => dateText() + ': ' + t(e.title) + '. ' + t(e.text), 'history');
      HOOKS.notify({ title: t(e.title), text: t(e.text), history: true });
    }
  }
  if (G.altQ) G.altQ = G.altQ.filter(q => q.turn > G.turn);
}

// The historical events as they turn out in this campaign: { skip, effect, title, text }
function eventVariant(e) {
  const out = { effect: e.effect, title: e.title, text: e.text };
  if (e.title === 'Death of Urus Khan') {
    const tq = alt('toqtamish');
    if (tq && tq !== 'backed') {
      out.effect = { ...e.effect, leader: 'Temur-Malik' };
      out.text = 'Urus Khan dies in the winter of 1377. Without Toqtamish to challenge them, his son Temur-Malik takes the throne of the White Horde.';
    } else if (tq === 'backed' && alive('temur')) altLater('toqtamish_betrays', G.turn + Math.max(4, TT(1385, 1) - nowM()));
  }
  if (e.title === 'Battle of Kulikovo') {
    const k = alt('kulikovo');
    if (k === 'peace') return { skip: true, title: 'No battle at Kulikovo', text: 'The Horde did not march this year. Moscow keeps its silver, and its army waits.' };
    if (k === 'lithuania') { out.effect = { faction: 'golden', armyLoss: 0.1 }; out.title = 'Kulikovo: no victor'; out.text = 'With the Lithuanians at his side, Mamai fights Prince Dmitry on the Don. Both armies bleed, and neither can claim the field.'; }
    else if (k === 'march' && isHuman('golden') && rng() < 0.4) {
      out.effect = { faction: 'golden', order: 12, gold: 1500 };
      out.title = 'Mamai wins at Kulikovo'; out.text = 'Against what history remembers, Mamai’s horsemen break the Russian line on the field of Kulikovo. Moscow pays double tribute.';
    }
  }
  return out;
}
