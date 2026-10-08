'use strict';
// Personalities. Every ruler, heir and general has one or two traits. A ruler's traits shape his whole
// realm; a general's shape the battles he fights. The famous figures have the traits history gave them;
// everyone else is born with their own, fixed by their name.

const TRAITS = {
  brave: { name: 'Brave', desc: 'Fights in the front rank: his armies are 12% stronger in battle.', battle: 0.12 },
  cunning: { name: 'Cunning', desc: 'A master of ambush and the feigned retreat: his armies are 8% stronger, and plunder brings a third more.', battle: 0.08 },
  cautious: { name: 'Cautious', desc: 'Never risks his men: his armies fight 10% harder when defending.', defend: 0.1 },
  just: { name: 'Just', desc: 'As ruler: +4 public order everywhere.', order: 4 },
  cruel: { name: 'Cruel', desc: 'As ruler: feared rather than loved. −3 public order, and every other ruler thinks a little worse of him each turn.', order: -3 },
  pious: { name: 'Pious', desc: 'As ruler: +2 public order and +2 Literature and arts each turn.', order: 2, dev: { culture: 2 } },
  learned: { name: 'Learned', desc: 'As ruler: +3 Science and +1 Literature and arts each turn.', dev: { science: 3, culture: 1 } },
  builder: { name: 'Builder', desc: 'As ruler: all buildings cost 10% less.' },
  generous: { name: 'Generous', desc: 'As ruler: +3 public order and his reputation grows, but 5% less tax.', order: 3, tax: -0.05 },
  greedy: { name: 'Greedy', desc: 'As ruler: 8% more tax, but −3 public order.', order: -3, tax: 0.08 },
  drunkard: { name: 'Drunkard', desc: 'As ruler: 5% less tax and −2 public order.', order: -2, tax: -0.05 },
  ambitious: { name: 'Ambitious', desc: 'Hungry for glory: +1 Statecraft each turn as ruler; as a general, he is more likely to grow too proud.', dev: { state: 1 } },
};
const TRAIT_IDS = Object.keys(TRAITS);

// What history tells us of them
const HIST_TRAITS = {
  'Amir Temur': ['brave', 'cunning'], 'Jahangir Mirza': ['brave', 'generous'], 'Umar Shaikh Mirza': ['brave', 'ambitious'],
  'Miran Shah': ['drunkard', 'brave'], 'Muhammad Sultan Mirza': ['brave', 'just'], 'Shah Rukh': ['pious', 'just'],
  'Khalil Sultan': ['generous', 'drunkard'], 'Ulugh Beg': ['learned', 'builder'], 'Toqtamish': ['ambitious', 'brave'],
  'Urus Khan': ['brave', 'cruel'], 'Beglerbeg Mamai': ['cunning', 'ambitious'], 'Qamar al-Din Dughlat': ['cruel', 'brave'],
  'Khizr Khoja': ['pious', 'cautious'], 'Husayn Sufi': ['cautious', 'greedy'], 'Yusuf Sufi': ['cautious'],
  'Ghiyath al-Din Pir Ali': ['pious', 'builder'], 'Pir Muhammad': ['learned'], "Khwaja Ali Mu'ayyad": ['just', 'pious'],
  'Darvish Rukn al-Din': ['pious', 'brave'], 'Toqtaqiya': ['drunkard'], 'Edigu': ['cunning', 'ambitious'],
};

// A fixed number from a name, so a person's traits never change (and the game's dice are not touched)
function nameHash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function traitsOf(name) {
  if (!name) return [];
  if (HIST_TRAITS[name]) return HIST_TRAITS[name];
  const h = nameHash(name);
  const first = TRAIT_IDS[h % TRAIT_IDS.length];
  if ((h >>> 8) % 3 === 0) return [first]; // a third of people have only one trait
  let second = TRAIT_IDS[(h >>> 12) % TRAIT_IDS.length];
  if (second === first || (first === 'just' && second === 'cruel') || (first === 'cruel' && second === 'just') || (first === 'generous' && second === 'greedy') || (first === 'greedy' && second === 'generous')) return [first];
  return [first, second];
}
const hasTrait = (name, id) => traitsOf(name).includes(id);
const rulerTraits = f => (f && f !== 'rebels' && G.factions[f]) ? traitsOf(G.factions[f].leader) : [];

// ---------- What the ruler's character does to his realm ----------

function traitOrder(f) { return rulerTraits(f).reduce((s, k) => s + (TRAITS[k].order || 0), 0); }
function traitTax(f) { return 1 + rulerTraits(f).reduce((s, k) => s + (TRAITS[k].tax || 0), 0); }
function traitDev(f, track) { return rulerTraits(f).reduce((s, k) => s + ((TRAITS[k].dev && TRAITS[k].dev[track]) || 0), 0); }
const traitBuild = f => rulerTraits(f).includes('builder') ? 0.9 : 1;

// A general's character in battle
function traitBattle(g, isDef) {
  if (!g) return 1;
  return 1 + traitsOf(g.name).reduce((s, k) => s + (TRAITS[k].battle || 0) + (isDef ? TRAITS[k].defend || 0 : 0), 0);
}

// Each turn: a cruel ruler is disliked, a generous one admired
function traitsTurn() {
  for (const f of PLAYABLE) {
    if (!G.factions[f].alive) continue;
    const tr = rulerTraits(f);
    if (tr.includes('cruel')) for (const g of PLAYABLE) if (g !== f && G.factions[g].alive) { const r = rel(f, g); r.att = Math.max(-100, r.att - 0.3); }
    if (tr.includes('generous')) shiftTrust(f, 0.3);
  }
}

// ---------- The brothers' quarrel ----------

// Princes of the house with their own armies, other than the new ruler
function rivalPrinces(f) {
  const st = G.factions[f];
  return armiesOf(f).filter(a => a.general && !a.general.leader && a.general.name !== st.leader && (
    (charByName(a.general.name) && charByName(a.general.name).role === 'prince') ||
    (personBy(a.general.name) && personBy(a.general.name).faction === f)));
}

const QUARREL = {
  who: c => c.army.general.name, title: 'A brother claims the throne',
  text: c => t('{name}, who commands an army at {city}, says the throne should have been his. The amirs wait to see what the new ruler, {ruler}, will do.', { name: pn(c.army.general.name), city: cityOf(G.provinces[c.army.prov]), ruler: pn(c.st.leader) }),
  options: [
    { label: c => t('Give him a rich governorship (−{n} gold)', { n: cost(c, 400) }), hint: 'He accepts, for now, and serves you.',
      act: c => { c.st.gold -= cost(c, 400); c.army.general.cmd = Math.min(6, c.army.general.cmd + 1); return t('{name} accepts the governorship and swears loyalty.', { name: pn(c.army.general.name) }); } },
    { label: () => t('Have him arrested'), hint: 'His army stays with you, but the amirs are uneasy.',
      act: c => { const name = c.army.general.name; c.army.general = null; c.army.units = c.army.units.filter(u => u.type !== 'general'); c.st.orderBonus = -8; c.st.orderBonusT = 4; return t('{name} is seized at night and sent to a distant fortress.', { name: pn(name) }); } },
    { label: () => t('Let him come and fight'), hint: 'He rebels with his army. If you beat him, no one will doubt you.',
      act: c => { const out = generalRebels(c.army); c.st.orderBonus = 6; c.st.orderBonusT = 6; return out; } },
  ],
};
