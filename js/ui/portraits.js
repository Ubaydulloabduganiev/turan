'use strict';
// Portraits in the manner of a Persian miniature: a painted bust under a pointed arch, with the headwear
// of each people: Temur's crown, turbans, Mongol hats with fur brims, Kipchak felt hats, helmets with mail,
// dervish caps, and the tall boqta of Mongol noblewomen. Historical figures use their own recipe;
// everyone else gets one drawn from their name and nation.

const SKIN = ['#e9c39b', '#d9ab7f', '#c8956a'];
let portraitN = 0;

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// Generic figures who appear in stories
const TYPES = {
  ming: { hat: 'chinese', beard: 'goatee', hair: '#1a1410', robe: '#9a2a22', trim: '#d8b45a', skin: 0 },
  genoese: { hat: 'european', beard: 'short', hair: '#5a3a20', robe: '#2a3a5a', trim: '#b8a070', skin: 0 },
  herder: { hat: 'kalpak', beard: 'mustache', hair: '#1a1410', robe: '#7a5a3a', trim: '#c9b28a', skin: 2 },
  spy: { hat: 'turban', beard: 'short', hair: '#1a1410', robe: '#2a2a2a', trim: '#555', skin: 1 },
  pretender: { hat: 'mongol', beard: 'goatee', hair: '#1a1410', robe: '#5a2a5a', trim: '#d8b45a', skin: 2 },
  merchant: { hat: 'turban', beard: 'long', hair: '#3a2a1a', robe: '#3a6a5a', trim: '#e6d29a', skin: 0 },
  soldier: { hat: 'helmet', beard: 'mustache', hair: '#2a1a10', robe: '#5a4a3a', trim: '#9a8a6a', skin: 1 },
};

// Works out the portrait recipe for a person: a known character, a story type, or a name in a nation
function lookFor(who, faction, age) {
  const c = typeof who === 'string' ? (CHAR_BY_ID[who] || charByName(who)) : who;
  if (c && c.look) return { ...c.look, female: !!c.female, age: age || (G ? year() - c.born : 40), seed: hashStr(c.name), faction: c.faction };
  if (TYPES[who]) return { ...TYPES[who], age: 40, seed: hashStr(who), faction: null };
  const name = String(who || 'Unknown');
  const h = hashStr(name), r = n => ((h >>> (n * 3)) & 1023) / 1023;
  const F = FACTIONS[faction] || FACTIONS.rebels;
  const nomad = F.nomad, persian = F.names === 'persian';
  const hats = nomad ? ['mongol', 'fur', 'kalpak', 'helmet'] : persian ? ['turban', 'turban', 'helmet', 'taj'] : ['turban', 'helmet', 'mongol', 'turban'];
  const beards = ['short', 'long', 'mustache', 'goatee', 'forked'];
  const robes = [F.dark, '#6a3a2a', '#3a5a4a', '#4a3a6a', '#7a5a2a', F.color];
  return {
    hat: hats[Math.floor(r(1) * hats.length)], beard: beards[Math.floor(r(2) * beards.length)],
    hair: ['#1a1410', '#2a1a0e', '#3a2a1a', '#4a3020'][Math.floor(r(3) * 4)],
    robe: robes[Math.floor(r(4) * robes.length)], trim: r(5) < 0.5 ? '#d8b45a' : '#c9b28a',
    skin: nomad ? 1 + Math.round(r(6)) : Math.round(r(6)), age: age || 35, seed: h, faction,
  };
}

function portraitSVG(who, opts = {}) {
  const L = lookFor(who, opts.faction, opts.age);
  const id = 'pt' + (portraitN++);
  const F = FACTIONS[opts.faction || L.faction] || null;
  const bg = F ? F.dark : '#2a3a5a', bg2 = F ? F.color : '#4a6a8a';
  const skin = SKIN[L.skin || 0];
  const old = L.age >= 55, mid = L.age >= 42;
  const beardCol = old ? '#d9d4ca' : mid && (L.seed & 3) === 0 ? '#8a8378' : L.hair;
  const out = [];
  out.push(`<svg class="portrait ${opts.cls || ''}" viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc94"/><stop offset=".5" stop-color="#c9973a"/><stop offset="1" stop-color="#7a5a1a"/></linearGradient>
    <radialGradient id="${id}b" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="${bg2}" stop-opacity=".95"/><stop offset="1" stop-color="${bg}"/></radialGradient>
    <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset=".4" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e4e6ea"/><stop offset=".5" stop-color="#9aa0a8"/><stop offset="1" stop-color="#5a6068"/></linearGradient>
    <radialGradient id="${id}c" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#fff4c0"/><stop offset=".6" stop-color="#d9a93e"/><stop offset="1" stop-color="#7a5414"/></radialGradient>
  </defs>`);
  // Frame and arch
  out.push(`<rect width="100" height="125" fill="url(#${id}g)"/><rect x="2.5" y="2.5" width="95" height="120" fill="#120c06"/>`);
  out.push(`<path d="M7 125V42Q7 9 50 5Q93 9 93 42V125Z" fill="url(#${id}b)" stroke="#d8b45a" stroke-width="1.2"/>`);
  for (let i = 0; i < 14; i++) { const x = 14 + ((L.seed >> i) & 7) * 10 + (i % 2) * 4, y = 18 + i * 4.5; if (x < 84) out.push(`<circle cx="${x}" cy="${y}" r=".7" fill="#f6dc94" opacity=".45"/>`); }
  // The sitter, drawn a little larger than the arch
  out.push(`<g transform="translate(-6 -3) scale(1.12)">`);
  // Robe, collar and trim
  const female = L.female;
  out.push(`<path d="M12 125C14 104 27 95 40 92L60 92C73 95 86 104 88 125Z" fill="${L.robe}"/>`);
  out.push(`<path d="M12 125C14 104 27 95 40 92L60 92C73 95 86 104 88 125Z" fill="url(#${id}r)"/>`);
  out.push(`<path d="M40 92L50 112L60 92" fill="${female ? '#f3e6c8' : '#efe3c6'}" stroke="${L.trim}" stroke-width="2.2"/>`);
  out.push(`<path d="M28 101Q33 108 31 125M72 101Q67 108 69 125" stroke="${L.trim}" stroke-width="1.2" fill="none" opacity=".8"/>`);
  for (let i = 0; i < 5; i++) out.push(`<circle cx="${50 + (i - 2) * 1.2}" cy="${100 + i * 4}" r=".9" fill="${L.trim}"/>`);
  // Neck, head, ears
  out.push(`<path d="M44.5 78h11v15h-11z" fill="${skin}"/><path d="M44.5 86q5.5 3 11 0v7h-11z" fill="#000" opacity=".12"/>`);
  out.push(`<ellipse cx="36.8" cy="66" rx="2.6" ry="4" fill="${skin}"/><ellipse cx="63.2" cy="66" rx="2.6" ry="4" fill="${skin}"/>`);
  out.push(`<ellipse cx="50" cy="64" rx="13.5" ry="16.5" fill="${skin}"/>`);
  out.push(`<ellipse cx="44" cy="71" rx="3" ry="2" fill="#c8645a" opacity=".18"/><ellipse cx="56" cy="71" rx="3" ry="2" fill="#c8645a" opacity=".18"/>`);
  // Hair showing under the headwear
  if (female) out.push(`<path d="M36 60Q36 44 50 44Q64 44 64 60L64 86Q60 80 60 64Q50 56 40 64Q40 80 36 86Z" fill="#1a1410"/>`);
  else if (L.hat !== 'helmet') out.push(`<path d="M37 62Q37 50 50 50Q63 50 63 62Q60 55 50 55Q40 55 37 62Z" fill="${L.hair}"/>`);
  // Eyes and brows: narrower for the people of the steppe
  const ey = L.skin >= 2 ? 0.55 : L.skin === 1 ? 0.8 : 1;
  for (const [cx, d] of [[44, -1], [56, 1]]) {
    out.push(`<path d="M${cx - 3.6} 63Q${cx} ${63 - 2.6 * ey} ${cx + 3.6} ${63 + d * 0.4}Q${cx} ${63 + 1.6 * ey} ${cx - 3.6} 63Z" fill="#f4ecdc"/>`);
    out.push(`<circle cx="${cx + d * 0.3}" cy="63.1" r="${1.3 * Math.max(0.75, ey)}" fill="#2a1a0e"/>`);
    out.push(`<path d="M${cx - 3.8} 62.8Q${cx} ${62.8 - 2.8 * ey} ${cx + 3.8} ${63 + d * 0.3}" stroke="#2a1a0e" stroke-width=".8" fill="none"/>`);
    out.push(`<path d="M${cx - 4} ${58.6 + (female ? 0.3 : 0)}Q${cx} ${56.4} ${cx + 4} ${58.4 + d * 0.6}" stroke="${old ? '#bbb' : L.hair}" stroke-width="${female ? 0.8 : 1.4}" fill="none" stroke-linecap="round"/>`);
  }
  // Nose and mouth
  out.push(`<path d="M50.3 63Q49.2 69.5 47.6 71.8Q50 73.2 52.3 71.8" stroke="#8a5a3a" stroke-width=".8" fill="none"/>`);
  out.push(`<path d="M46.6 76.6Q50 ${female ? 78.6 : 77.8} 53.4 76.6" stroke="#9a4a3a" stroke-width="${female ? 1.3 : 1}" fill="none" stroke-linecap="round"/>`);
  if (L.age >= 48) out.push(`<path d="M42 54.5q8-2 16 0M43.5 67.5q1.8 1.2 3.6 0M52.9 67.5q1.8 1.2 3.6 0" stroke="#8a5a3a" stroke-width=".45" fill="none" opacity=".7"/>`);
  // Beard and moustache
  if (!female) {
    const mus = `<path d="M44 75.6Q47 73.6 50 75.2Q53 73.6 56 75.6Q55 77 53 76.6Q50 75.8 47 76.6Q45 77 44 75.6Z" fill="${beardCol}"/>`;
    const b = {
      long: `<path d="M37 68Q37.5 84 44 92Q50 106 56 92Q62.5 84 63 68Q60.5 78 56 79.2Q50 81.6 44 79.2Q39.5 78 37 68Z" fill="${beardCol}"/>`,
      forked: `<path d="M37 68Q37.5 84 44 92L46.5 101L50 93L53.5 101L56 92Q62.5 84 63 68Q60.5 78 56 79.2Q50 81.6 44 79.2Q39.5 78 37 68Z" fill="${beardCol}"/>`,
      short: `<path d="M37.5 69Q39 83 50 86Q61 83 62.5 69Q60.5 77.4 55.5 78.8Q50 80.4 44.5 78.8Q39.5 77.4 37.5 69Z" fill="${beardCol}"/>`,
      goatee: `<path d="M46.8 80Q50 90 53.2 80Q50 81.6 46.8 80Z" fill="${beardCol}"/>`,
      mustache: `<path d="M44 75.6Q47 73.6 50 75.2Q53 73.6 56 75.6Q57.4 80 56.8 84.5Q55.2 78.6 50 77.2Q44.8 78.6 43.2 84.5Q42.6 80 44 75.6Z" fill="${beardCol}"/>`,
      none: '',
    };
    out.push(b[L.beard] || '');
    if (L.beard !== 'none' && L.beard !== 'mustache') out.push(mus);
  } else {
    out.push(`<circle cx="36.8" cy="71.5" r="1.3" fill="#f3d27a"/><circle cx="63.2" cy="71.5" r="1.3" fill="#f3d27a"/>`);
  }
  // Headwear
  const hc = L.hatColor || L.trim;
  const hats = {
    turban: `<path d="M43 40Q50 25 57 40Z" fill="${L.robe}" stroke="${L.trim}" stroke-width=".8"/>
      <ellipse cx="50" cy="47" rx="18.5" ry="11.5" fill="#f5efe2"/>
      <path d="M33 47Q50 36 67 46M33.5 50Q50 41 66.5 51M35 53Q50 46 65 54M36 43Q50 33 64 42" stroke="#cfc4ae" stroke-width="1" fill="none"/>
      <path d="M64 50Q70 58 66 66" stroke="#f5efe2" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    crown: `<ellipse cx="50" cy="51" rx="17.5" ry="8" fill="#f5efe2"/><path d="M34 52Q50 45 66 52" stroke="#cfc4ae" stroke-width="1" fill="none"/>
      <path d="M35.5 50L35.5 33L40.5 40L45 26L50 37L55 26L59.5 40L64.5 33L64.5 50Q50 45 35.5 50Z" fill="url(#${id}c)" stroke="#6a4a10" stroke-width=".7"/>
      <circle cx="50" cy="44" r="2.2" fill="#b0202a"/><circle cx="42" cy="46" r="1.4" fill="#2a8f6a"/><circle cx="58" cy="46" r="1.4" fill="#2a8f6a"/>
      <circle cx="45" cy="26" r="1.2" fill="#f6dc94"/><circle cx="55" cy="26" r="1.2" fill="#f6dc94"/>
      <path d="M50 37Q46 20 55 12Q52 24 52 37Z" fill="#f2efe6" opacity=".9"/>`,
    mongol: `<path d="M36 49Q37 30 50 24Q63 30 64 49Z" fill="${L.robe}" stroke="#000" stroke-opacity=".25"/>
      <path d="M44 30Q50 26 56 30" stroke="${L.trim}" stroke-width="1" fill="none"/>
      <ellipse cx="50" cy="49" rx="19.5" ry="5.2" fill="#6b4a2c"/><path d="M32 49q2-2 4 0t4 0t4 0t4 0t4 0t4 0t4 0t4 0t4 0" stroke="#4a3018" stroke-width=".8" fill="none"/>
      <circle cx="50" cy="23" r="2.2" fill="${L.trim}"/><path d="M50 21Q55 10 62 8Q56 14 51.5 22Z" fill="#3a3a3a"/>`,
    fur: `<path d="M34.5 52Q33 30 50 26Q67 30 65.5 52Z" fill="#5a3e24"/>
      <path d="M37 50l1-6M41 51l1-8M45 50l.5-9M49 50v-10M53 50l-.5-9M57 51l-1-8M61 50l-1-6M39 38l2-5M47 33l1-4M55 34l-1-4M60 40l-1-4" stroke="#3a2614" stroke-width=".9"/>
      <path d="M43 30Q50 18 57 30Z" fill="${L.robe}"/><circle cx="50" cy="22" r="1.6" fill="${L.trim}"/>`,
    kalpak: `<path d="M37 49Q38 28 50 23Q62 28 63 49Z" fill="#efe6d2"/><path d="M50 23Q51 36 50 49" stroke="#cdbf9e" stroke-width=".8"/>
      <path d="M34.5 51Q50 41 65.5 51L64 55Q50 46 36 55Z" fill="#d8cba8" stroke="#1a1410" stroke-width="1"/>`,
    helmet: `<path d="M35.5 55Q34 72 38.5 85L44 85Q40.5 70 41 57Z" fill="#7a8088"/><path d="M64.5 55Q66 72 61.5 85L56 85Q59.5 70 59 57Z" fill="#7a8088"/>
      <path d="M36 72l3 0M36 76l3.5 0M37 80l4 0M61 72l3 0M60.5 76l3.5 0M59 80l4 0" stroke="#4a5058" stroke-width=".6"/>
      <path d="M35 55Q35.5 36 50 22Q64.5 36 65 55Q50 50 35 55Z" fill="url(#${id}s)" stroke="#3a3f46" stroke-width=".7"/>
      <path d="M35 55Q50 50 65 55" stroke="${L.trim}" stroke-width="2" fill="none"/><path d="M50 22V12" stroke="#5a6068" stroke-width="1.6"/><circle cx="50" cy="11" r="1.4" fill="#b0202a"/>
      <path d="M49 55L49 66L51 66L51 55Z" fill="#8a9098"/>`,
    taj: `<path d="M39.5 50L43.5 17Q50 12 56.5 17L60.5 50Z" fill="#e8dcc0"/><path d="M42.6 25h14.8M41.6 33h16.8M40.6 41h18.8" stroke="#a89a7a" stroke-width=".8"/>
      <ellipse cx="50" cy="50" rx="15.5" ry="5.5" fill="${L.robe}"/><path d="M35 50Q50 45 65 50" stroke="${L.trim}" stroke-width=".8" fill="none"/>`,
    boqta: `<path d="M44 46L41.5 12L58.5 12L56 46Z" fill="#a8202a" stroke="#6a1018" stroke-width=".6"/>
      <path d="M42 20h16M42.6 28h14.8M43.2 36h13.6" stroke="#d8b45a" stroke-width="1.4"/>
      <path d="M50 12Q44 2 40 0M50 12Q56 2 60 0M50 12V0" stroke="#f2efe6" stroke-width="1.6" fill="none"/>
      <path d="M36 52Q36 44 50 44Q64 44 64 52Z" fill="#8a1a22"/><circle cx="50" cy="47" r="1.8" fill="#f3d27a"/>`,
    chinese: `<path d="M38 50Q37.5 34 50 33Q62.5 34 62 50Z" fill="#1a1a1a"/><path d="M44 36Q50 28 56 36Z" fill="#1a1a1a"/>
      <path d="M26 44h11v2.4H26zM63 44h11v2.4H63z" fill="#1a1a1a"/>`,
    european: `<path d="M37 49Q37 33 50 32Q63 33 63 49Z" fill="#1a1a1a"/><ellipse cx="50" cy="49" rx="17" ry="3.6" fill="#2a1a1a"/>
      <path d="M58 34Q70 30 74 40Q66 36 60 38Z" fill="${L.robe}"/>`,
  };
  out.push(hats[L.hat] || hats.turban);
  out.push('</g></svg>');
  return out.join('');
}

// Portrait of a ruler of a nation, or of any named person
function rulerPortrait(f, cls) { return portraitSVG(G && G.factions[f] ? G.factions[f].leader : FACTIONS[f].leader, { faction: f, cls }); }
function personPortrait(name, faction, age, cls) { return portraitSVG(name, { faction, age, cls }); }
