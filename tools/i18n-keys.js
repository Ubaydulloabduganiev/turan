// Lists every English text the game can show, and which of them a language file is missing.
//   node tools/i18n-keys.js            -> writes tools/keys.json
//   node tools/i18n-keys.js uz         -> lists keys missing from js/lang/uz.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (!/vendor|lang/.test(f)) walk(p); } else if (p.endsWith('.js')) files.push(p); } })(path.join(root, 'js'));

const keys = new Set();
// Reads a JS string literal starting at s[i]; returns [value, endIndex]
function readStr(s, i) {
  const q = s[i]; let j = i + 1, v = '';
  while (s[j] !== q) {
    if (s[j] === '\\') { const n = s[j + 1]; v += n === 'n' ? '\n' : n; j += 2; continue; }
    if (q === '`' && s[j] === '$' && s[j + 1] === '{') return [null, j]; // template with expressions: not a key
    v += s[j++];
  }
  return [v, j + 1];
}
// Every string literal in the first argument of t(...)
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const re = /(^|[^\w.$])t\(/g; let m;
  while ((m = re.exec(s))) {
    let i = m.index + m[0].length, depth = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === "'" || c === '"' || c === '`') { const [v, e] = readStr(s, i); if (v !== null && depth === 0) keys.add(v); i = e; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0) break;
      i++;
    }
  }
  // Engine messages returned as plain strings and translated by the interface
  if (/engine|characters/.test(f)) { const r2 = /return '([^'\\]+)'/g; let k; while ((k = r2.exec(s))) if (/^[A-Z]/.test(k[1]) && / /.test(k[1])) keys.add(k[1]); }
}
// Game data
const ctx = { console, localStorage: { getItem: () => null, setItem() {} }, document: { documentElement: {} } };
vm.createContext(ctx);
for (const f of ['js/i18n.js', 'js/data.js', 'js/characters.js', 'js/engine/state.js', 'js/engine/battle.js', 'js/engine/actions.js', 'js/engine/turn.js', 'js/engine/ai.js', 'js/engine/stories.js', 'js/engine/places.js', 'js/engine/family.js', 'js/engine/cityacts.js', 'js/engine/whatif.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const D = vm.runInContext('({ GAME, FACTIONS, UNITS, BUILDINGS, TERRAIN, EVENTS, RANDOM_EVENTS, WONDERS, STORIES, CHARACTERS, DECREES, LANDMARKS })', ctx);
const add = v => { if (typeof v === 'string' && v) keys.add(v); };
D.GAME.SEASONS.forEach(add);
for (const F of Object.values(D.FACTIONS)) ['name', 'full', 'adj', 'title', 'difficulty', 'blurb', 'play'].forEach(k => add(F[k]));
for (const u of Object.values(D.UNITS)) { add(u.name); add(u.desc); }
for (const b of Object.values(D.BUILDINGS)) { add(b.name); add(b.desc); b.levels.forEach(add); }
for (const x of Object.values(D.TERRAIN)) add(x.name);
for (const e of [...D.EVENTS, ...D.RANDOM_EVENTS]) { add(e.title); add(e.text); }
for (const w of Object.values(D.WONDERS)) { add(w.name); add(w.desc); }
for (const s of D.STORIES) { add(s.title); s.options.forEach(o => add(o.hint)); }
for (const c of D.CHARACTERS) add(c.bio);
for (const d of Object.values(D.DECREES)) { add(d.name); add(d.desc); }
for (const k of vm.runInContext('TAX_LEVELS', ctx)) add(k);
for (const A of vm.runInContext('CITY_ACTIONS', ctx)) { add(A.name); add(A.desc); add(A.group); }
{ const ca = fs.readFileSync(path.join(root, 'js/engine/cityacts.js'), 'utf8'); const re = /'([A-Z][^'\\]*\s[^'\\]*)'/g; let m; while ((m = re.exec(ca))) if (!/[{}]/.test(m[1]) || / /.test(m[1])) keys.add(m[1]); }
{ const W = vm.runInContext('({ WHATIFS, BIBI, ALT_EVENTS })', ctx);
  for (const w of [...W.WHATIFS, W.BIBI]) { add(w.title); add(w.kicker); w.options.forEach(o => add(o.hint)); (w.aiText || []).forEach(add); }
  add('A turning point of history');
  for (const e of Object.values(W.ALT_EVENTS)) { add(e.title); add(e.text); }
  const src = fs.readFileSync(path.join(root, 'js/engine/whatif.js'), 'utf8'); const re = /(?:out\.text = |out\.title = |title: |text: )'([^'\\]+)'/g; let m; while ((m = re.exec(src))) add(m[1]); }
for (const l of Object.values(D.LANDMARKS)) { add(l.name); add(l.desc); add(l.text); l.options.forEach(o => add(o.hint)); }
// Campaigns, and the stories of the court
for (const [f, re] of [['js/engine/scenarios.js', /(?:title|blurb|goalText|winText): '((?:\\.|[^'\\])*)'/g], ['js/engine/intrigue.js', /(?:title|hint): '((?:\\.|[^'\\])*)'/g]]) {
  const src = fs.readFileSync(path.join(root, f), 'utf8'); let m; while ((m = re.exec(src))) add(m[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, '$1'));
}
{ const src = fs.readFileSync(path.join(root, 'js/engine/intrigue.js'), 'utf8'); const e = src.slice(src.indexOf('const EPITHET'), src.indexOf('};', src.indexOf('const EPITHET'))); const re = /: '([^']+)'/g; let m; while ((m = re.exec(e))) add(m[1]); }
// The help text
const dlg = fs.readFileSync(path.join(root, 'js/ui/dialogs.js'), 'utf8');
const help = dlg.slice(dlg.indexOf('const HELP = ['), dlg.indexOf('function helpHTML'));
{ const re = /\['\w+', (['"])((?:\\.|(?!\1).)*)\1\]/g; let m; while ((m = re.exec(help))) keys.add(m[2].replace(/\\(.)/g, '$1')); }
// Static texts of the page
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
{ const re = /data-i18n>([^<]+)</g; let m; while ((m = re.exec(html))) keys.add(m[1].trim()); }
{ const re = / title="([^"]+)"/g; let m; while ((m = re.exec(html))) keys.add(m[1]); }
keys.add('Turan: Khanates of the Silk Road');
// Texts picked from a table in the interface and translated later
{
  const pn = fs.readFileSync(path.join(root, 'js/ui/panels.js'), 'utf8'), cls = pn.slice(pn.indexOf('const cls = {'), pn.indexOf('[d.cls]'));
  const oi = dlg.indexOf('const texts = {', dlg.indexOf('HOOKS.offer')), offers = dlg.slice(oi, dlg.indexOf('};', oi));
  const tabs = dlg.slice(dlg.indexOf('const tabs = ['), dlg.indexOf('.map(', dlg.indexOf('const tabs = [')));
  const tax = dlg.slice(dlg.indexOf('const tax = ['), dlg.indexOf('.map(', dlg.indexOf('const tax = [')));
  for (const part of [cls, offers, tabs, tax]) { const re = /: (['"])((?:\\.|(?!\1).)*)\1|, (['"])((?:\\.|(?!\3).)*)\3\]|\[?(['"])([A-Z](?:\\.|(?!\5).)*)\5/g; let m; while ((m = re.exec(part))) { const v = m[2] || m[4] || m[6]; if (v && /[A-Z{]/.test(v[0]) && / |^[A-Z][a-z]+$/.test(v)) keys.add(v.replace(/\\(.)/g, '$1')); } }
}

const all = [...keys].filter(k => /[A-Za-z]/.test(k)).sort();
const lang = process.argv[2];
if (!lang) { fs.writeFileSync(path.join(__dirname, 'keys.json'), JSON.stringify(all, null, 1)); console.log(all.length + ' keys'); }
else {
  const c2 = { I18N: { uz: {}, ru: {}, tr: {} } }; vm.createContext(c2);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/lang', lang + '.js'), 'utf8'), c2);
  const dict = c2.I18N[lang];
  const missing = all.filter(k => !dict[k]);
  const extra = Object.keys(dict).filter(k => !keys.has(k));
  const badVars = all.filter(k => dict[k] && (k.match(/\{\w+\}/g) || []).sort().join() !== (dict[k].match(/\{\w+\}/g) || []).sort().join());
  console.log(`${lang}: ${all.length - missing.length}/${all.length} translated, ${missing.length} missing, ${extra.length} unused, ${badVars.length} with wrong {placeholders}`);
  if (process.argv[3] === '-v') { console.log('MISSING', missing); console.log('UNUSED', extra); console.log('BADVARS', badVars); }
}
