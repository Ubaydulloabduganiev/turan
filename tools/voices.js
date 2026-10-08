// Lists every sentence the recorded voices can say, in every language, with who says it.
//   node tools/voices.js            -> writes tools/voice-lines.json (then run tools/voices.py to record)
// After recording, tools/voices.py writes js/voice-index.js, which tells the game which sentences exist.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const ctx = { console, localStorage: { getItem: () => null, setItem() {} }, document: { documentElement: {} }, window: {} };
vm.createContext(ctx);
for (const f of ['js/i18n.js', 'js/lang/uz.js', 'js/lang/ru.js', 'js/lang/tr.js', 'js/data.js', 'js/characters.js', 'js/mapgen.js',
  'js/engine/state.js', 'js/engine/battle.js', 'js/engine/actions.js', 'js/engine/turn.js', 'js/engine/ai.js', 'js/engine/stories.js',
  'js/engine/places.js', 'js/engine/family.js', 'js/engine/cityacts.js', 'js/engine/rivals.js', 'js/engine/progress.js',
  'js/engine/scenarios.js', 'js/engine/traits.js', 'js/engine/whatif.js', 'js/ui/voicelines.js'])
  vm.runInContext(read(f), ctx, { filename: f });

// The same two functions the game uses (js/ui/voice.js)
const vsrc = read('js/ui/voice.js');
const grab = name => vsrc.slice(vsrc.indexOf('function ' + name), vsrc.indexOf('\n}\n', vsrc.indexOf('function ' + name)) + 2);
vm.runInContext(grab('sentencesOf') + '\n' + grab('voiceKey') + '\nthis.sentencesOf = sentencesOf; this.voiceKey = voiceKey;', ctx);

// Strings written as t('...') with nothing to fill in, from a source file
function literals(file) {
  const s = read(file), out = [], re = /\bt\('((?:[^'\\]|\\.)+)'\)/g;
  let m;
  while ((m = re.exec(s))) out.push(m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n'));
  return out;
}
const sentenceLike = s => /[.!?…]["”»’)]?$/.test(s.trim());

const lines = [], seen = new Set();
for (const lang of ['en', 'uz', 'ru', 'tr']) {
  vm.runInContext(`LANG = ${JSON.stringify(lang)};`, ctx);
  const t = (s, v) => ctx.t(s, v);
  const add = (text, role = 'narrator', whole) => {
    for (const s of whole ? [text] : ctx.sentencesOf(text)) {
      if (!s || /[{}]/.test(s) || /^[+−-]|[+−]\d|\d+%/.test(s)) continue; // game numbers are read on screen, not aloud
      const key = ctx.voiceKey(s);
      if (seen.has(lang + key)) continue;
      seen.add(lang + key);
      lines.push({ lang, role, key, text: s });
    }
  };
  const D = vm.runInContext('({ NARR, SAGES, CHAR_BY_ID, LANDMARKS, WHATIFS, BIBI, ALT_EVENTS, EVENTS, TRACKS, WONDERS })', ctx);
  // The painted scenes and the people in them
  for (const k in D.NARR) add(D.NARR[k][lang] || D.NARR[k].en, D.NARR[k].role);
  add(t('Your soldiers pour through the broken gates and sack the city. The loot is carried out by the cartload.'));
  add(t('A storyteller will read the great scenes and the turning points of history aloud.'));
  for (const id in D.SAGES) add(t(D.CHAR_BY_ID[id].bio));
  add(t('Instruments, books and pupils follow him. Your court is becoming a place of learning.'));
  for (const id in D.LANDMARKS) { add(t(D.LANDMARKS[id].name), 'narrator', true); add(t(D.LANDMARKS[id].text)); }
  for (const s of literals('js/engine/places.js').concat(literals('js/ui/cinema.js'))) if (sentenceLike(s)) add(t(s));
  // Turning points of history and what came of them
  for (const w of [...D.WHATIFS, D.BIBI]) { add(t(w.title), 'narrator', true); add(w.text()); for (const a of w.aiText || []) add(t(a)); }
  add(t('History takes another path'), 'narrator', true);
  for (const s of literals('js/engine/whatif.js')) if (sentenceLike(s)) add(t(s));
  for (const e of Object.values(D.ALT_EVENTS)) { add(t(e.title), 'narrator', true); add(t(e.text)); }
  { const src = read('js/engine/whatif.js'), re = /(?:out\.text = |out\.title = |title: |text: )'([^'\\]+)'/g; let m; while ((m = re.exec(src))) add(t(m[1]), 'narrator', !sentenceLike(m[1])); }
  // The great events of the age, the advances of learning, the wonders
  for (const e of D.EVENTS) { add(t(e.title), 'narrator', true); add(t(e.text)); }
  for (const k in D.TRACKS) for (const a of D.TRACKS[k].advances) { add(t(a.name), 'narrator', true); add(t(a.desc)); }
  for (const id in D.WONDERS) { add(t(D.WONDERS[id].name), 'narrator', true); add(t(D.WONDERS[id].desc)); }
  // The historical campaigns: how each begins and how it ends
  for (const S of vm.runInContext('SCENARIOS', ctx)) { add(t(S.title), 'narrator', true); add(t(S.blurb)); if (S.winText) add(t(S.winText)); }
  add(t('Temur returns'), 'narrator', true); add(t('Riders bring the news: Temur has crossed the Amu Darya with the army of Persia, and he is marching north.'));
}
fs.writeFileSync(path.join(__dirname, 'voice-lines.json'), JSON.stringify(lines, null, 0));
const by = {};
for (const l of lines) by[l.lang + ' ' + l.role] = (by[l.lang + ' ' + l.role] || 0) + 1;
console.log(lines.length, 'lines', JSON.stringify(by));
