'use strict';
// Special places of Turan: ruins, shrines, mines, passes and lakes. Whoever holds the province enjoys its
// blessing every turn, and a ruler who first takes it is met with a scene and a choice.
// kind: the picture on the map and in the scene (ruins, shrine, pass, mine, horses, lake, caravanserai, cliff, river, kurgan)

const LANDMARKS = {
  afrasiyab: {
    prov: 'samarkand', kind: 'ruins', name: 'Ruins of Afrasiyab', gold: 0, order: 6,
    desc: 'The hill of old Samarkand, sacked by Chinggis Khan in 1220. Its people are proud of it: +6 public order here.',
    text: 'On the hill of Afrasiyab, where old Samarkand stood before the Mongols came, diggers break into a sealed hall. Its walls are painted with Sogdian kings riding elephants, and in a corner stands a jar full of ancient silver.',
    options: [
      { label: c => t('Melt down the silver (+{n} gold)', { n: cost(c, 400) }), hint: 'Gold now.',
        act: c => { c.st.gold += cost(c, 400); return t('The old coins pour into your treasury. The painted kings watch in silence.'); } },
      { label: () => t('Let the scholars study the paintings'), hint: 'The court is proud of its past: public order rises across the realm.',
        act: c => { c.st.orderBonus = Math.max(c.st.orderBonus, 8); c.st.orderBonusT = Math.max(c.st.orderBonusT, 5); return t('Scholars copy the paintings. Poets compare your reign to the kings of old.'); } },
    ],
  },
  samanid: {
    prov: 'bukhara', kind: 'shrine', name: 'Mausoleum of the Samanids', gold: 0, order: 4, realmOrder: 3,
    desc: 'The brick tomb of Ismail Samani, four centuries old. Pilgrims bless its keeper: +4 order here and +3 in every province.',
    text: 'The tomb of Ismail Samani, built of baked brick woven like a basket, has stood in Bukhara for four hundred years. Its keepers ask for help: the dome is cracked and pilgrims fear it will fall.',
    options: [
      { label: c => t('Restore the tomb (−{n} gold)', { n: cost(c, 250) }), hint: 'Order rises across the realm for many turns.',
        act: c => { c.st.gold -= cost(c, 250); c.st.orderBonus = Math.max(c.st.orderBonus, 10); c.st.orderBonusT = Math.max(c.st.orderBonusT, 8); return t('Masons from Bukhara mend the dome brick by brick. Pilgrims pray for you at the tomb.'); } },
      { label: () => t('It has stood four hundred years; it will stand a little longer'), hint: 'Nothing changes.', act: () => t('The keepers bow and say nothing.') },
    ],
  },
  irongate: {
    prov: 'chaghaniyan', kind: 'pass', name: 'The Iron Gate', gold: 90, order: 0,
    desc: 'A narrow gorge, the only road between Samarkand and Termez. Every caravan pays the toll: +90 gold a turn.',
    text: 'The Iron Gate is a gorge so narrow that two camels can barely pass. Whoever holds it holds the road from Samarkand to India. Your officers propose to close it with real gates of iron.',
    options: [
      { label: c => t('Forge the gates (−{n} gold)', { n: cost(c, 300) }), hint: 'The walls of the province grow stronger.',
        act: c => { c.st.gold -= cost(c, 300); if (c.lp.b.walls < 3) c.lp.b.walls++; return t('Iron-bound gates now close the gorge. No army will pass without your leave.'); } },
      { label: () => t('Raise the toll instead'), hint: 'Extra gold over the coming turns; merchants grumble.',
        act: c => { for (let i = 1; i <= 3; i++) later(c.f, i * 2, cost(c, 150), t('The toll from the Iron Gate is paid.')); c.lp.unrest += 10; return t('Your toll collectors take their places in the gorge.'); } },
    ],
  },
  horses: {
    prov: 'fergana', kind: 'horses', name: 'Pastures of the Heavenly Horses', gold: 30, order: 0, cavalry: true,
    desc: 'The meadows of Fergana, home of the "blood-sweating" horses that Chinese emperors once went to war for. Cavalry costs a quarter less.',
    text: 'In the meadows of Fergana graze the famous "heavenly horses" that sweat blood when they run. Chinese emperors once sent armies across the mountains to get them. The herdsmen bring you the finest herd of the year.',
    options: [
      { label: () => t('Mount your guard on them'), hint: 'Two units of lancers join the army in the province.',
        act: c => { let a = armiesIn(c.lp.id).find(x => x.owner === c.f && x.units.length <= GAME.MAX_ARMY - 2); if (!a) a = addArmy(c.f, c.lp.id, [], null); a.units.push(makeUnit('lancer'), makeUnit('lancer')); return t('Your new riders gallop across the meadows, their horses gleaming with sweat.'); } },
      { label: () => t('Send a pair to a rival ruler as a gift'), hint: 'A rival ruler will think much better of you.',
        act: c => { if (c.rival) { rel(c.f, c.rival).att = Math.min(100, rel(c.f, c.rival).att + 30); return t('{ruler} is delighted with the horses and praises your generosity.', { ruler: pn(G.factions[c.rival].leader) }); } return t('There is no one worthy of such a gift.'); } },
    ],
  },
  issykkul: {
    prov: 'issykkul', kind: 'lake', name: 'The Sunken City of Issyk-Kul', gold: 0, order: 8,
    desc: 'A warm mountain lake that never freezes. Legends tell of a city beneath its waters: +8 order here.',
    text: 'Fishermen on the Issyk-Kul, the lake that never freezes, pull up bronze cauldrons and old bricks in their nets. They say a whole city lies under the water, drowned for the sins of its king.',
    options: [
      { label: c => t('Send divers (−{n} gold)', { n: cost(c, 100) }), hint: 'They may find treasure. Or nothing.',
        act: c => { c.st.gold -= cost(c, 100); if (rng() < 0.55) { c.st.gold += cost(c, 650); return t('The divers come up with golden bowls and the seal of a forgotten king.'); } return t('The water is cold and dark. The divers find only stones.'); } },
      { label: () => t('Leave the dead city in peace'), hint: 'The tribes of the lake respect your wisdom.', act: c => { c.lp.unrest -= 15; return t('The fishermen say the lake will be kind to you.'); } },
    ],
  },
  tashrabat: {
    prov: 'kashgar', kind: 'caravanserai', name: 'Tash Rabat', gold: 80, order: 0,
    desc: 'A stone caravanserai high on the road over the mountains to China. Caravans rest and pay: +80 gold a turn.',
    text: 'At Tash Rabat, a stone caravanserai high in the mountains on the road to China, a snowstorm has trapped a great caravan. Its merchants send a rider down to beg for help.',
    options: [
      { label: c => t('Send men and food up the pass (−{n} gold)', { n: cost(c, 120) }), hint: 'The grateful merchants will repay you later.',
        act: c => { c.st.gold -= cost(c, 120); later(c.f, 2, cost(c, 450), t('The merchants rescued at Tash Rabat repay your kindness.')); return t('Your men dig the caravan out of the snow. The merchants swear they will not forget.'); } },
      { label: () => t('The mountains take their toll'), hint: 'Nothing changes.', act: () => t('The storm passes. Not every camel survives it.') },
    ],
  },
  jade: {
    prov: 'yarkand', kind: 'mine', gem: '#5aa86a', name: 'Jade Rivers of Khotan', gold: 110, order: 0,
    desc: 'Every spring the rivers from the Kunlun carry down white and green jade, prized in China above gold: +110 gold a turn.',
    text: 'The spring floods have brought down from the Kunlun mountains a block of dark green jade as big as a man. Chinese merchants are already offering a fortune for it.',
    options: [
      { label: c => t('Sell it to the Chinese (+{n} gold)', { n: cost(c, 500) }), hint: 'Gold now.', act: c => { c.st.gold += cost(c, 500); return t('The stone leaves for China on a cart drawn by twelve oxen.'); } },
      { label: () => t('Carve it into a throne'), hint: 'Your court is dazzled: public order rises.',
        act: c => { c.st.orderBonus = Math.max(c.st.orderBonus, 8); c.st.orderBonusT = Math.max(c.st.orderBonusT, 6); return t('Your new jade throne is the wonder of every ambassador who sees it.'); } },
    ],
  },
  ulytau: {
    prov: 'ulytau', kind: 'kurgan', name: 'Ulytau, Mountain of the Khans', gold: 0, order: 5, realmOrder: 4,
    desc: 'The sacred mountains where Jochi, eldest son of Chinggis Khan, lies buried. Steppe khans were raised here: +4 order everywhere.',
    text: 'At Ulytau, among the sacred mountains, stands the tomb of Jochi, eldest son of Chinggis Khan. The elders of the steppe say a ruler who is raised on a white felt here rules with heaven’s blessing.',
    options: [
      { label: c => t('Be raised on the white felt (−{n} gold)', { n: cost(c, 200) }), hint: 'A great feast for the tribes; your rule is blessed for a long time.',
        act: c => { c.st.gold -= cost(c, 200); c.st.orderBonus = Math.max(c.st.orderBonus, 12); c.st.orderBonusT = Math.max(c.st.orderBonusT, 6); return t('The beys lift you on the white felt as the drums thunder. The steppe has a khan.'); } },
      { label: () => t('Honour the tomb and ride on'), hint: 'Nothing changes.', act: () => t('You leave a horse and a silk banner at the tomb.') },
    ],
  },
  caviar: {
    prov: 'hajjitarkhan', kind: 'river', name: 'Sturgeon Fisheries of the Volga', gold: 100, order: 0,
    desc: 'The delta of the Volga teems with great sturgeon. Their black roe is sold from Genoa to Tabriz: +100 gold a turn.',
    text: 'Fishermen of the Volga delta have caught a beluga sturgeon longer than three men. Its roe alone fills twenty barrels.',
    options: [
      { label: () => t('Feast the whole city on it'), hint: 'The province is overjoyed.', act: c => { c.lp.unrest -= 20; return t('For three days the city eats sturgeon and sings your name.'); } },
      { label: c => t('Sell the roe to the Genoese (+{n} gold)', { n: cost(c, 300) }), hint: 'Gold now.', act: c => { c.st.gold += cost(c, 300); return t('The Genoese pay in Venetian ducats and ask for more.'); } },
    ],
  },
  ayazkala: {
    prov: 'kath', kind: 'ruins', name: 'Fortresses of Ayaz-Kala', gold: 0, order: 4,
    desc: 'Ancient desert fortresses of Khwarezm on the edge of the Kyzylkum. Men still live in their shadow: +4 order here.',
    text: 'On the edge of the Kyzylkum stand the ruined fortresses of Ayaz-Kala, built by the old kings of Khwarezm a thousand years ago. Their walls of mud brick still rise over the sands.',
    options: [
      { label: () => t('Garrison the old walls'), hint: 'Two units of militia join you there, and the province is safer.',
        act: c => { let a = armiesIn(c.lp.id).find(x => x.owner === c.f && x.units.length <= GAME.MAX_ARMY - 2); if (!a) a = addArmy(c.f, c.lp.id, [], null); a.units.push(makeUnit('militia'), makeUnit('militia')); return t('Watchmen climb the old towers again. Their fires can be seen across the desert.'); } },
      { label: c => t('Dig for the treasure of the old kings (−{n} gold)', { n: cost(c, 80) }), hint: 'A gamble.',
        act: c => { c.st.gold -= cost(c, 80); if (rng() < 0.5) { c.st.gold += cost(c, 450); return t('Beneath a fallen tower your men find a hoard of silver dirhams.'); } return t('Only sand, scorpions and broken pots.'); } },
    ],
  },
  bamiyan: {
    prov: 'ghur', kind: 'cliff', name: 'The Giants of Bamiyan', gold: 50, order: 4,
    desc: 'Two giant figures carved into a cliff a thousand years ago, with caves of painted monks around them. Travellers come to see them: +50 gold, +4 order.',
    text: 'In the valley of Bamiyan two giant figures, taller than any minaret, stand carved into the red cliff. Around them are hundreds of caves painted by monks who left long ago. Your amirs ask what should be done with them.',
    options: [
      { label: () => t('Protect them as a marvel of the past'), hint: 'Travellers and scholars speak well of you.',
        act: c => { c.st.orderBonus = Math.max(c.st.orderBonus, 6); c.st.orderBonusT = Math.max(c.st.orderBonusT, 5); return t('Your decree is carved at the foot of the cliff: let no one harm the giants of Bamiyan.'); } },
      { label: () => t('Turn the caves into a fortress'), hint: 'The walls of the province grow stronger.',
        act: c => { if (c.lp.b.walls < 3) c.lp.b.walls++; return t('Soldiers move into the painted caves. Bamiyan becomes a fortress.'); } },
    ],
  },
  turquoise: {
    prov: 'nishapur', kind: 'mine', gem: '#4ac0c0', name: 'Turquoise Mines of Nishapur', gold: 120, order: 0,
    desc: 'The finest turquoise in the world comes from the hills near Nishapur: +120 gold a turn.',
    text: 'The miners of Nishapur have found a vein of turquoise of the purest sky blue. Such stones are worth more than gold in Tabriz and Cairo.',
    options: [
      { label: c => t('Sell the stones (+{n} gold)', { n: cost(c, 450) }), hint: 'Gold now.', act: c => { c.st.gold += cost(c, 450); return t('Merchants from Tabriz buy the whole vein before it is even dug out.'); } },
      { label: () => t('Tile a mosque dome with them'), hint: 'Order rises in every city of the realm.',
        act: c => { for (const p of c.mine) p.unrest = Math.max(-20, p.unrest - 10); return t('A dome of turquoise rises over Nishapur, the colour of heaven itself.'); } },
    ],
  },
  lapis: {
    prov: 'badakhshan', kind: 'mine', gem: '#2a4ab8', name: 'Lapis Mines of Sar-i Sang', gold: 150, order: 0,
    desc: 'The only lapis lazuli mines of the old world, high in the mountains of Badakhshan. Painters from Herat to Venice need its blue: +150 gold a turn.',
    text: 'High in the mountains of Badakhshan, at Sar-i Sang, miners break the deep-blue lapis lazuli out of the rock with fire and cold water. Painters from Herat to Venice cannot work without it.',
    options: [
      { label: c => t('Send it to the painters of your court (−{n} gold)', { n: cost(c, 100) }), hint: 'Your court shines: public order rises for a long time.',
        act: c => { c.st.gold -= cost(c, 100); c.st.orderBonus = Math.max(c.st.orderBonus, 8); c.st.orderBonusT = Math.max(c.st.orderBonusT, 8); return t('Your painters grind the stone into the finest ultramarine. Your palaces glow blue and gold.'); } },
      { label: c => t('Sell it to the Venetians (+{n} gold)', { n: cost(c, 500) }), hint: 'Gold now.', act: c => { c.st.gold += cost(c, 500); return t('The blue stones travel west, worth their weight in gold.'); } },
    ],
  },
  merv: {
    prov: 'merv', kind: 'ruins', name: 'Ruins of Old Merv', gold: 0, order: 3,
    desc: 'Once one of the greatest cities in the world, destroyed by the Mongols in 1221. The tomb of Sultan Sanjar still stands: +3 order here.',
    text: 'Old Merv was once among the greatest cities in the world, until the Mongols destroyed it in 1221. Now the dome of Sultan Sanjar’s tomb rises over empty walls, and the great dam on the Murghab lies broken.',
    options: [
      { label: c => t('Rebuild the dam (−{n} gold)', { n: cost(c, 350) }), hint: 'Irrigation and people return to Merv.',
        act: c => { c.st.gold -= cost(c, 350); if (c.lp.b.farms < 3) c.lp.b.farms++; c.lp.pop *= 1.1; return t('Water flows again through the canals of Merv. Farmers return to the empty fields.'); } },
      { label: () => t('Take the bricks for your own buildings'), hint: 'The bazaar improves at once.',
        act: c => { if (c.lp.b.market < maxBuildLevel(c.lp)) c.lp.b.market++; return t('Caravans of carts carry the old bricks to build a new bazaar.'); } },
    ],
  },
  altai: {
    prov: 'ertis', kind: 'kurgan', name: 'Golden Kurgans of the Altai', gold: 120, order: 0,
    desc: 'Burial mounds of ancient steppe kings, and rivers that carry gold dust down from the Altai: +120 gold a turn.',
    text: 'In the valley of the Irtysh stand great burial mounds of steppe kings who lived long before Chinggis Khan. The herdsmen say they are full of gold, and that the dead do not like to be disturbed.',
    options: [
      { label: c => t('Open the kurgans (+{n} gold)', { n: cost(c, 700) }), hint: 'A fortune in gold, but the steppe tribes are angered.',
        act: c => { c.st.gold += cost(c, 700); for (const p of c.mine) if (p.terrain === 'steppe') p.unrest += 12; return t('Golden stags and griffins are carried out of the mounds. The tribes whisper of a curse.'); } },
      { label: () => t('Leave the ancestors in peace'), hint: 'The steppe tribes respect you.',
        act: c => { for (const p of c.mine) if (p.terrain === 'steppe') p.unrest -= 10; return t('The shamans bless your name at the kurgans.'); } },
    ],
  },
};

function landmarkIn(pid) { return Object.keys(LANDMARKS).find(id => LANDMARKS[id].prov === pid) || null; }
function landmarksOf(f) { return Object.keys(LANDMARKS).filter(id => G.provinces[LANDMARKS[id].prov].owner === f); }
function landmarkGold(p) { const id = landmarkIn(p.id); return id && !p.siege ? LANDMARKS[id].gold || 0 : 0; }
function landmarkOrder(p) {
  const id = landmarkIn(p.id);
  let o = id ? LANDMARKS[id].order || 0 : 0;
  for (const k of landmarksOf(p.owner)) o += LANDMARKS[k].realmOrder || 0;
  return o;
}
// Units cost less with the heavenly horses of Fergana
function unitCost(f, type) {
  const d = UNITS[type];
  return (d.cls === 'cav' || d.cls === 'ha') && f !== 'rebels' && landmarksOf(f).includes('horses') ? Math.round(d.cost * 0.75) : d.cost;
}

// The next special place the player has not yet seen, as a story for the scene screen
function pickLandmark() {
  const f = G.player, st = G.factions[f];
  if (!st.alive) return null;
  st.seen = st.seen || [];
  const id = landmarksOf(f).find(k => !st.seen.includes(k));
  if (!id) return null;
  st.seen.push(id);
  const ctx = storyContext(f);
  ctx.lp = G.provinces[LANDMARKS[id].prov];
  return { id, ctx };
}
