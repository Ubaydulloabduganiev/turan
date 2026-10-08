'use strict';
// Court intrigue. Every amir and prince has loyalty and ambition. Victories, honours and a just ruler win
// hearts; cruelty, neglect and rivals' silver lose them. Disloyal men plot, poison and rebel; a son with
// too much ambition keeps his own court. Each also carries an epithet, so the court is a cast of people.

const EPITHET = { brave: 'the Bold', cunning: 'the Fox', cautious: 'the Patient', just: 'the Just', cruel: 'the Cruel', pious: 'the Pious',
  learned: 'the Wise', builder: 'the Builder', generous: 'the Generous', greedy: 'the Greedy', drunkard: 'the Merry', ambitious: 'the Ambitious' };
const epithetOf = name => { const tr = traitsOf(name); return tr.length ? EPITHET[tr[0]] : ''; };

// Is this man a prince of the ruling house?
function isPrince(f, name) {
  const c = charByName(name), p = personBy(name);
  return !!((c && c.faction === f && c.role === 'prince') || (p && p.faction === f && !p.female));
}
// Loyalty (0..100) and ambition (0..100) of a general, set the first time they are needed
function courtier(g, f) {
  if (g.loyal === undefined) {
    const tr = traitsOf(g.name);
    g.amb = clampN(15 + (tr.includes('ambitious') ? 45 : 0) + (tr.includes('cunning') ? 15 : 0) + (tr.includes('brave') ? 8 : 0) + (tr.includes('cruel') ? 8 : 0) - (tr.includes('pious') ? 10 : 0) - (tr.includes('just') ? 8 : 0) + (isPrince(f, g.name) ? 15 : 0), 0, 100);
    g.loyal = clampN(78 - g.amb * 0.35 + (tr.includes('just') ? 8 : 0) + (tr.includes('generous') ? 5 : 0), 5, 100);
  }
  return g;
}
// Where a man's loyalty drifts under this ruler
function loyaltyTarget(g, f) {
  const rt = rulerTraits(f), st = G.factions[f];
  let v = 70 - g.amb * 0.4;
  if (rt.includes('just')) v += 8; if (rt.includes('generous')) v += 6; if (rt.includes('brave')) v += 3;
  if (rt.includes('cruel')) v -= 8; if (rt.includes('drunkard')) v -= 6; if (rt.includes('greedy')) v -= 4;
  if (st.gold < 0) v -= 15;
  if (g.honoured && G.turn - g.honoured < 8) v += 12;
  if (isPrince(f, g.name) && st.heir !== g.name) v -= Math.max(0, (g.amb - 30) * 0.3); // a son who is not the heir
  return clampN(v, 0, 100);
}
const generalsOf = f => armiesOf(f).filter(a => a.general && !a.general.leader).map(a => ({ a, g: courtier(a.general, f) }));
// Loyal men fight harder for you; disloyal ones hang back
function loyaltyBattle(g, f) {
  if (!g || g.leader || !f || f === 'rebels') return 1;
  courtier(g, f);
  return g.loyal < 25 ? 0.9 : g.loyal > 80 ? 1.05 : 1;
}
function shiftLoyalty(g, f, d) { courtier(g, f); g.loyal = clampN(g.loyal + d, 0, 100); }

// Each turn: hearts drift, and in the rival courts the most bitter men sometimes rebel
function intrigueTurn() {
  for (const f of PLAYABLE) {
    if (!G.factions[f].alive) continue;
    for (const { a, g } of generalsOf(f)) {
      const target = loyaltyTarget(g, f);
      g.loyal = clampN(g.loyal + Math.sign(target - g.loyal) * Math.min(3, Math.abs(target - g.loyal)) + (rng() - 0.5) * 4, 0, 100);
      // Ambition grows in idle men with armies of their own
      if (a.units.length >= 6 && rng() < 0.15) g.amb = Math.min(100, g.amb + 2);
      if (!isHuman(f) && g.loyal < 15 && g.amb > 50 && a.units.length >= 4 && rng() < 0.04) {
        const text = generalRebels(a);
        log(dateText() + ': ' + fName(f) + ': ' + text, '');
      }
    }
  }
}

// ---------- The stories of the court ----------

const INTRIGUES = {
  plot: {
    who: c => c.g.name, title: 'A plot at court',
    text: c => t('Your spymaster brings you a letter sealed by {ruler} of the {nation}. It promises {name} a city of his own if he turns against you when the time comes.', { ruler: pn(G.factions[c.rival].leader), nation: fName(c.rival), name: pn(c.g.name) }),
    options: [
      { label: () => t('Arrest him and have him executed'), hint: 'The plot dies with him. Every other amir will fear you.',
        act: c => {
          if (c.a.units.length >= 6 && rng() < 0.3) return generalRebels(c.a) + ' ' + t('He was warned in time.');
          const name = c.g.name;
          c.a.general = null; c.a.units = c.a.units.filter(u => u.type !== 'general');
          for (const x of generalsOf(c.f)) shiftLoyalty(x.g, c.f, x.g.amb > 40 ? 6 : -3);
          c.st.orderBonus = Math.max(c.st.orderBonus, 5); c.st.orderBonusT = Math.max(c.st.orderBonusT, 3);
          return t('{name} is seized at dawn. By noon his head is on a spear at the city gate, and his army has a new commander.', { name: pn(name) });
        } },
      { label: () => t('Confront him in private, and forgive him'), hint: 'A forgiven man may become your most loyal servant, or wait for a better chance.',
        act: c => {
          if (c.g.amb < 55) { shiftLoyalty(c.g, c.f, 35); return t('{name} falls to his knees and weeps. He swears on the Quran that he will die for you.', { name: pn(c.g.name) }); }
          shiftLoyalty(c.g, c.f, 10); c.g.plotting = G.turn + 2 + Math.floor(rng() * 3);
          return t('{name} swears loyalty, but his eyes do not meet yours.', { name: pn(c.g.name) });
        } },
      { label: () => t('Let him go on, and feed him false letters'), hint: 'Turn the plot against the rival who started it.',
        act: c => {
          const enemy = armiesOf(c.rival).sort((x, y) => armyPower(y) - armyPower(x))[0];
          if (enemy && rng() < 0.65) { for (const u of enemy.units) u.men = Math.round(u.men * 0.8); rel(c.f, c.rival).att -= 10; return t('The false letters lead an army of the {nation} into an ambush. {ruler} will not trust a traitor again.', { nation: fName(c.rival), ruler: pn(G.factions[c.rival].leader) }); }
          shiftLoyalty(c.g, c.f, -10);
          return t('{name} sees through the trick. The game of letters goes on.', { name: pn(c.g.name) });
        } },
    ],
  },
  poison: {
    who: c => c.st.leader, title: 'Poison at the feast',
    text: c => t('At the spring feast, the wine in {ruler}’s cup tastes bitter. By night the ruler burns with fever and cannot stand. The court whispers the name of {name}.', { ruler: pn(c.st.leader), name: pn(c.g.name) }),
    options: [
      { label: c => t('Call the Chinese physician (−{n} gold)', { n: cost(c, 300) }), hint: 'The best doctor in Samarkand. Most likely you will live.',
        act: c => { c.st.gold -= cost(c, 300); return poisonEnds(c, 0.88); } },
      { label: () => t('Trust the court physicians'), hint: 'They mean well.', act: c => poisonEnds(c, 0.65) },
      { label: () => t('Hunt down the poisoner while you still can'), hint: 'If you live, the plot is broken for good.',
        act: c => {
          const name = c.g.name;
          if (c.a && G.armies[c.a.id] && c.a.general === c.g) { c.a.general = null; c.a.units = c.a.units.filter(u => u.type !== 'general'); }
          return t('The guards drag the cupbearer before your bed, and he names {name}. The traitor is executed before morning.', { name: pn(name) }) + ' ' + poisonEnds(c, 0.55);
        } },
    ],
  },
  prince: {
    who: c => c.g.name, title: 'A son who would be khan',
    text: c => t('Your son {name} keeps his own court at {city}. Poets call him the khan to come, and his officers swear their oaths to him, not to you.', { name: pn(c.g.name), city: cityOf(G.provinces[c.a.prov]) }),
    options: [
      { label: c => t('Give him a rich governorship (−{n} gold)', { n: cost(c, 350) }), hint: 'His pride is fed, for a while.',
        act: c => { c.st.gold -= cost(c, 350); shiftLoyalty(c.g, c.f, 30); c.g.honoured = G.turn; return t('{name} kisses your hand and rides back to {city} as its governor.', { name: pn(c.g.name), city: cityOf(G.provinces[c.a.prov]) }); } },
      { label: () => t('Name him your heir'), hint: 'He will be loyal. His brothers will not like it.',
        act: c => { c.st.heir = c.g.name; shiftLoyalty(c.g, c.f, 45); c.g.amb = Math.max(0, c.g.amb - 20); for (const x of generalsOf(c.f)) if (x.g !== c.g && isPrince(c.f, x.g.name)) shiftLoyalty(x.g, c.f, -20); return t('Before the assembled amirs, {name} is proclaimed heir to the throne.', { name: pn(c.g.name) }); } },
      { label: () => t('Take his army from him'), hint: 'He is no danger without soldiers, but he will hate you for it.',
        act: c => {
          if (rng() < Math.min(0.6, c.g.amb / 120)) return generalRebels(c.a);
          const name = c.g.name; c.a.general = null; c.a.units = c.a.units.filter(u => u.type !== 'general');
          return t('{name} rides to court with a handful of companions and a face like thunder.', { name: pn(name) });
        } },
    ],
  },
  bribe: {
    who: c => c.g.name, title: 'Silver from a rival',
    text: c => t('Envoys of the {nation} were seen at the camp of {name} at night, with chests that took four men to carry.', { nation: fName(c.rival), name: pn(c.g.name) }),
    options: [
      { label: c => t('Pay him more than they did (−{n} gold)', { n: cost(c, 250) }), hint: 'Loyalty, bought at the market price.',
        act: c => { c.st.gold -= cost(c, 250); shiftLoyalty(c.g, c.f, 20); return t('{name} sends the rival’s silver back with a rude letter, and keeps yours.', { name: pn(c.g.name) }); } },
      { label: () => t('Expose the rival before every court'), hint: 'The rival loses face; your amir loses his bribe.',
        act: c => { shiftTrust(c.rival, -8); rel(c.f, c.rival).att -= 10; shiftLoyalty(c.g, c.f, -8); return t('Your heralds read the rival’s letters aloud in every bazaar. {ruler} is shamed.', { ruler: pn(G.factions[c.rival].leader) }); } },
      { label: () => t('Pretend you saw nothing'), hint: 'Nothing happens, today.', act: c => { shiftLoyalty(c.g, c.f, -18); return t('The chests stay in {name}’s tent.', { name: pn(c.g.name) }); } },
    ],
  },
  faithful: {
    who: c => c.g.name, title: 'A faithful servant',
    text: c => t('{name} rides in from {city} with a chest of silver taken from rebels, and the head of a man who spoke against you in the bazaar.', { name: pn(c.g.name), city: cityOf(G.provinces[c.a.prov]) }),
    options: [
      { label: () => t('Give him a robe of honour from your own shoulders'), hint: 'He will remember it all his life.',
        act: c => { c.st.gold += cost(c, 200); shiftLoyalty(c.g, c.f, 10); c.g.honoured = G.turn; return t('{name} wears the robe at every feast. The treasury is richer by the rebels’ silver.', { name: pn(c.g.name) }); } },
      { label: () => t('Promote him: a star more'), hint: 'A better general.', act: c => { c.st.gold += cost(c, 200); c.g.cmd = Math.min(6, c.g.cmd + 1); return t('{name} is raised among your great amirs.', { name: pn(c.g.name) }); } },
    ],
  },
};

// The poisoned ruler lives or dies
function poisonEnds(c, survive) {
  if (rng() < survive) { c.st.orderBonus = Math.max(c.st.orderBonus, 6); c.st.orderBonusT = 3; return t('After three days the fever breaks. {ruler} rises from the bed, thinner and harder than before.', { ruler: pn(c.st.leader) }); }
  const name = c.st.leader;
  leaderDies(c.f);
  return t('{ruler} dies in the night. The poisoner’s work is done.', { ruler: pn(name) });
}

// This turn's court story for the player, if any
function pickIntrigue() {
  const f = G.player, st = G.factions[f];
  if (!st.alive || G.turn < 6 || (G.lastIntrigue !== undefined && G.turn - G.lastIntrigue < 4)) return null;
  const gs = generalsOf(f);
  if (!gs.length) return null;
  const rivals = PLAYABLE.filter(g => g !== f && G.factions[g].alive);
  const hostile = rivals.filter(g => rel(f, g).war || rel(f, g).att < -10);
  const c = storyContext(f);
  const pickOne = list => list.sort((x, y) => x.g.loyal - y.g.loyal)[0];
  let s = null;
  // A forgiven plotter whose time has come
  const plotter = gs.find(x => x.g.plotting && G.turn >= x.g.plotting);
  if (plotter) { plotter.g.plotting = 0; G.lastIntrigue = G.turn; return { story: { title: 'The forgiven traitor', who: () => plotter.g.name, text: () => t('{name}, whom you forgave, has kept his word only until he was ready.', { name: pn(plotter.g.name) }), options: [{ label: () => t('So be it'), hint: '', act: () => generalRebels(plotter.a) }] }, ctx: { ...c, ...plotter } }; }
  const traitor = pickOne(gs.filter(x => x.g.loyal < 35 && x.g.amb >= 30));
  const son = pickOne(gs.filter(x => isPrince(f, x.g.name) && x.g.amb >= 40 && x.g.loyal < 50 && st.heir !== x.g.name));
  const faithful = gs.filter(x => x.g.loyal > 85).sort(() => rng() - 0.5)[0];
  const tempted = pickOne(gs.filter(x => x.g.loyal < 60));
  const r = rng();
  if (son && r < 0.35) s = { story: INTRIGUES.prince, ctx: { ...c, ...son } };
  else if (traitor && hostile.length && r < 0.45) s = { story: INTRIGUES.plot, ctx: { ...c, ...traitor, rival: pick(hostile) } };
  else if (traitor && traitor.g.amb > 50 && r < 0.55) s = { story: INTRIGUES.poison, ctx: { ...c, ...traitor } };
  else if (tempted && hostile.length && r < 0.65) s = { story: INTRIGUES.bribe, ctx: { ...c, ...tempted, rival: pick(hostile) } };
  else if (faithful && r < 0.75) s = { story: INTRIGUES.faithful, ctx: { ...c, ...faithful } };
  if (s) G.lastIntrigue = G.turn;
  return s;
}

// The ruler's own favours, from the court screen
const HONOUR_COST = 150;
function honourGeneral(f, g) {
  const st = G.factions[f];
  if (st.gold < HONOUR_COST) return 'Not enough gold';
  if (g.honoured && G.turn - g.honoured < 3) return 'He was honoured recently';
  st.gold -= HONOUR_COST; g.honoured = G.turn; shiftLoyalty(g, f, 15);
  return null;
}
