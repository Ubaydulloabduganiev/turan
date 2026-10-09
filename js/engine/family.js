'use strict';
// Royal marriages and the children they bring. A marriage between two houses weds a real prince to a
// real princess; their children are born in the following years, and sons come of age at fifteen
// and take command of an army, like the princes of history.

const BRIDES = {
  turkic: ['Tukal Khanum', 'Chulpan Malik Agha', 'Sevinch Qutlugh Agha', 'Ulus Agha', 'Arslan Malik Agha', 'Qutlugh Turkan Agha', 'Oljay Turkan Agha', 'Bakht Sultan Begum', 'Tumen Agha', 'Aka Begi', 'Begi Sultan', 'Shirin Beg Agha'],
  mongol: ['Khutulun', 'Kelmish Agha', 'Taydula', 'Bulughan Khatun', 'Esen Bike', 'Ay Bike', 'Toqal Khatun', 'Jani Bike', 'Kunchek Khatun', 'Altun Bike'],
  persian: ['Gawhar Shad', 'Fatima Begum', 'Zahra Khatun', 'Mihr Sultan', 'Shirin Khatun', 'Turan Shah Khatun', 'Bibi Mahin', 'Sultan Khatun', 'Malika Khatun', 'Khadija Begum'],
};
// A bride the chronicles remember: Khanzada of Khwarezm married Temur's son Jahangir
const HISTORIC_BRIDES = { khwarezm: 'Khanzada' };
const SON_TITLE = { temur: ' Mirza', moghul: ' Khoja', white: ' Oghlan', golden: ' Oghlan', khwarezm: ' Sufi', kart: '', sarbadar: '', ottoman: ' Chelebi', mamluk: '', jalayir: '', muzaffar: '', delhi: ' Khan' };

function addPerson(o) { G.people = G.people || {}; G.people[o.name] = o; return o; }
function personBy(name) { return (G && G.people && G.people[name]) || null; }
function isWed(name) { return (G.marriages || []).some(m => m.groom === name || m.bride === name); }
function nameTaken(n) { return !!personBy(n) || !!charByName(n) || Object.values(G.armies).some(a => a.general && a.general.name === n); }
function freshName(list, suffix = '') {
  const free = list.map(n => n + suffix).filter(n => !nameTaken(n));
  if (free.length) return pick(free);
  for (let i = 2; ; i++) { const n = pick(list) + suffix + ' ' + ['II', 'III', 'IV', 'V', 'VI'][Math.min(4, i - 2)]; if (!nameTaken(n) || i > 8) return n; }
}
const ageOf = name => { const p = personBy(name), c = charByName(name); return p ? year() - p.born : c ? year() - c.born : null; };

// A young man of the house who is free to marry
function princeOf(f) {
  const ok = (n, a) => n && !isWed(n) && a !== null && a >= 13 && a <= 32;
  const hist = CHARACTERS.filter(c => c.faction === f && c.role === 'prince' && !c.female && year() < c.died).map(c => c.name);
  const people = Object.values(G.people || {}).filter(p => p.faction === f && !p.female).map(p => p.name);
  const gens = armiesOf(f).filter(a => a.general && !a.general.leader && a.general.age <= 30).map(a => a.general.name);
  const st = G.factions[f];
  const genAge = n => { const a = armiesOf(f).find(x => x.general && x.general.name === n); return a ? a.general.age : null; };
  for (const n of [...hist, st.heir, ...people, ...gens]) if (ok(n, ageOf(n) !== null ? ageOf(n) : genAge(n))) return n;
  const name = freshName(NAMES[FACTIONS[f].names], SON_TITLE[f] || '');
  addPerson({ name, faction: f, born: year() - 15 - Math.floor(rng() * 4), father: st.leader });
  return name;
}

// A daughter of the house
function princessOf(f) {
  const own = Object.values(G.people || {}).find(p => p.faction === f && p.female && !isWed(p.name) && year() - p.born >= 13 && year() - p.born <= 24);
  if (own) return own.name;
  const h = HISTORIC_BRIDES[f];
  const name = h && !nameTaken(h) ? h : freshName(BRIDES[FACTIONS[f].names] || BRIDES.turkic);
  addPerson({ name, faction: f, female: true, born: year() - 14 - Math.floor(rng() * 4), father: G.factions[f].leader });
  return name;
}

// Called when two houses agree to a marriage
function arrangeMarriage(a, b) {
  G.marriages = G.marriages || [];
  // The house with a historical prince to offer provides the groom; otherwise it is a coin toss
  const hasHist = f => CHARACTERS.some(c => c.faction === f && c.role === 'prince' && !isWed(c.name) && year() < c.died && year() - c.born >= 13 && year() - c.born <= 32);
  let gF = hasHist(a) && !hasHist(b) ? a : hasHist(b) && !hasHist(a) ? b : rng() < 0.5 ? a : b;
  const bF = gF === a ? b : a;
  const m = { groom: princeOf(gF), bride: princessOf(bF), gF, bF, turn: G.turn, kids: [] };
  G.marriages.push(m);
  for (const h of [a, b]) if (isHuman(h)) tell(h, { scene: { kind: 'wedding', m } });
  return m;
}

// Each turn, married couples may have children
function familyTurn() {
  for (const m of G.marriages || []) {
    // about one child in four years (the chance is per turn: a month, or half a year in old saves)
    if (G.turn < m.turn + (tpy() === 12 ? 10 : 2) || m.kids.length >= 3 || rng() > (tpy() === 12 ? 0.025 : 0.13)) continue;
    if (!G.factions[m.gF] || !G.factions[m.gF].alive) continue;
    const boy = rng() < 0.55;
    const name = boy ? freshName(NAMES[FACTIONS[m.gF].names], SON_TITLE[m.gF] || '') : freshName(BRIDES[FACTIONS[m.gF].names] || BRIDES.turkic);
    addPerson({ name, faction: m.gF, female: !boy, born: year(), father: m.groom, mother: m.bride, joins: boy ? year() + 15 : undefined });
    m.kids.push(name);
    if (m.bF !== 'rebels' && G.factions[m.bF] && G.factions[m.bF].alive) rel(m.gF, m.bF).att = Math.min(100, rel(m.gF, m.bF).att + 10);
    if (isHuman(m.gF)) { const st = G.factions[m.gF]; st.orderBonus = Math.max(st.orderBonus, 6); st.orderBonusT = Math.max(st.orderBonusT, 3); }
    for (const h of [m.gF, m.bF]) if (isHuman(h)) tell(h, { scene: { kind: 'birth', m, child: name, boy } });
  }
}

// Sons born in the game come of age and take command
function peopleComeOfAge() {
  for (const p of Object.values(G.people || {})) {
    if (!p.joins || p.joined || year() < p.joins) continue;
    p.joined = true;
    const st = G.factions[p.faction];
    if (!st || !st.alive) continue;
    const cap = G.provinces[st.capital];
    if (!cap || cap.owner !== p.faction) continue;
    const units = FACTIONS[p.faction].nomad ? ['horsearch', 'horsearch', 'lancer'] : ['spear', 'archer', 'lancer'];
    addArmy(p.faction, cap.id, units, makeGeneral(p.faction, p.name, 2, year() - p.born, false));
    if (isHuman(p.faction)) {
      log(() => dateText() + ': ' + t('{name} joins your court and takes command of an army.', { name: pn(p.name) }), 'big');
      tell(p.faction, { title: pn(p.name), text: t('{name} has come of age and rides out to serve you at the head of his own troops in {city}.', { name: pn(p.name), city: cityOf(cap) }), who: p.name, whoFaction: p.faction, prov: cap.id });
    }
  }
}
