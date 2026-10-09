// A spreadsheet of every text in the game, for native speakers to check, and the way back into the game.
//   node tools/i18n-sheet.js export [file.xlsx]   -> writes translations.xlsx (English, Uzbek, Russian, Turkish)
//   node tools/i18n-sheet.js import file.xlsx      -> puts the reviewed translations back into js/lang and js/i18n.js
// The file opens in Excel, LibreOffice and Google Sheets. Reviewers change only the language columns; the
// English column is the key and must stay as it is. Texts in {braces} are filled in by the game and must
// be kept in every translation. Needs nothing but Node.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib'), cp = require('child_process');
const root = path.join(__dirname, '..');
const LANGS = ['uz', 'ru', 'tr'], LNAME = { uz: 'Uzbek', ru: 'Russian', tr: 'Turkish' };

// ---------- The game's texts ----------

function loadAll() {
  const ctx = { console, localStorage: { getItem: () => null, setItem() {} }, document: { documentElement: {} } };
  vm.createContext(ctx);
  for (const f of ['js/i18n.js', 'js/lang/uz.js', 'js/lang/ru.js', 'js/lang/tr.js', 'js/data.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return vm.runInContext('({ I18N, PLACES, PEOPLE, GEO, PROVINCE_DATA })', ctx);
}
// Every English text the game shows, from the same list the translation check uses
function allKeys() {
  cp.execFileSync(process.execPath, [path.join(__dirname, 'i18n-keys.js')], { stdio: 'pipe' });
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'keys.json'), 'utf8'));
}
const vars = s => (String(s).match(/\{\w+\}/g) || []).sort().join(' ');

// ---------- A small zip, enough for .xlsx ----------

const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }

function zip(files) {
  const parts = [], central = [];
  let off = 0;
  for (const [name, text] of files) {
    const raw = Buffer.from(text, 'utf8'), data = zlib.deflateRawSync(raw), nm = Buffer.from(name, 'utf8'), crc = crc32(raw);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(raw.length, 22);
    h.writeUInt16LE(nm.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, nm, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24);
    c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, nm);
    off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

function unzip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip / xlsx file');
  const n = buf.readUInt16LE(e + 10), out = {};
  let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString('utf8');
    const ds = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28), data = buf.slice(ds, ds + csize);
    out[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

// ---------- .xlsx ----------

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
const unesc = s => s.replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const colName = i => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
const colIndex = s => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// Styles: 0 plain wrapped, 1 header, 2 the English key (greyed), 3 a missing translation (yellow)
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF555555"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF14304F"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2EEE4"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2A8"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="4"><xf applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf fontId="2" fillId="3" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf fillId="4" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetXml(rows, widths) {
  const cell = (v, r, c, s) => v === '' || v == null ? `<c r="${colName(c)}${r}" s="${s}"/>` : `<c r="${colName(c)}${r}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  const body = rows.map((row, i) => `<row r="${i + 1}">${row.map((x, c) => cell(x.v, i + 1, c, x.s)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${body}</sheetData><autoFilter ref="A1:${colName(widths.length - 1)}${rows.length}"/></worksheet>`;
}

function writeXlsx(file, sheets) {
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows, s.widths)]),
  ];
  fs.writeFileSync(file, zip(files));
}

// Reads every sheet as rows of strings, by sheet name
function readXlsx(file) {
  const z = unzip(fs.readFileSync(file));
  const shared = [];
  if (z['xl/sharedStrings.xml']) for (const m of z['xl/sharedStrings.xml'].matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
  const rels = {};
  for (const m of (z['xl/_rels/workbook.xml.rels'] || '').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0]), target = /Target="([^"]+)"/.exec(m[0]);
    if (id && target) rels[id[1]] = target[1].replace(/^\/?xl\//, '').replace(/^\//, '');
  }
  const out = {};
  for (const m of z['xl/workbook.xml'].matchAll(/<sheet\b[^>]*>/g)) {
    const name = unesc(/name="([^"]*)"/.exec(m[0])[1]), rid = /r:id="([^"]+)"/.exec(m[0])[1];
    const xml = z['xl/' + rels[rid]];
    if (!xml) continue;
    const rows = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
      const row = [];
      let next = 0;
      for (const c of (r[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], inner = c[2] || '';
        const ref = /\br="([A-Z]+)\d+"/.exec(attrs), type = (/\bt="(\w+)"/.exec(attrs) || [])[1];
        const col = ref ? colIndex(ref[1]) : next;
        next = col + 1;
        let v = '';
        if (type === 'inlineStr') v = unesc([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
        else { const vm2 = /<v>([\s\S]*?)<\/v>/.exec(inner); if (vm2) v = type === 's' ? shared[+vm2[1]] : unesc(vm2[1]); }
        row[col] = v;
      }
      rows.push(Array.from(row, x => x == null ? '' : x));
    }
    out[name] = rows;
  }
  return out;
}

// ---------- Export ----------

function doExport(file) {
  const D = loadAll(), keys = allKeys();
  const H = v => ({ v, s: 1 });
  const texts = [[H('English (do not change)'), ...LANGS.map(l => H(LNAME[l])), H('Notes')]];
  for (const k of keys) {
    const missing = LANGS.filter(l => !D.I18N[l][k]);
    const note = [vars(k) ? 'Keep: ' + vars(k) : '', missing.length ? 'Missing: ' + missing.map(l => LNAME[l]).join(', ') : ''].filter(Boolean).join(' · ');
    texts.push([{ v: k, s: 2 }, ...LANGS.map(l => ({ v: D.I18N[l][k] || '', s: D.I18N[l][k] ? 0 : 3 })), { v: note, s: 0 }]);
  }
  const places = [[H('Place id (do not change)'), H('English city'), H('English region'), ...LANGS.flatMap(l => [H(LNAME[l] + ' city'), H(LNAME[l] + ' region')])]];
  for (const d of D.PROVINCE_DATA) {
    places.push([{ v: d[0], s: 2 }, { v: d[2], s: 2 }, { v: d[1], s: 2 }, ...LANGS.flatMap(l => { const x = D.PLACES[l][d[0]] || ['', '']; return [{ v: x[0], s: x[0] ? 0 : 3 }, { v: x[1], s: x[1] ? 0 : 3 }]; })]);
  }
  const names = [[H('English (do not change)'), ...LANGS.map(l => H(LNAME[l])), H('Kind')]];
  for (const [table, kind] of [[D.PEOPLE, 'Person'], [D.GEO, 'Sea, mountain or land']]) for (const k of Object.keys(table)) names.push([{ v: k, s: 2 }, ...LANGS.map((l, i) => ({ v: table[k][i] || '', s: table[k][i] ? 0 : 3 })), { v: kind, s: 2 }]);
  writeXlsx(file, [
    { name: 'Texts', rows: texts, widths: [60, 60, 60, 60, 28] },
    { name: 'Places', rows: places, widths: [16, 18, 20, 18, 20, 18, 20, 18, 20] },
    { name: 'Names', rows: names, widths: [34, 34, 34, 34, 22] },
  ]);
  console.log(`${file}: ${keys.length} texts, ${places.length - 1} places, ${names.length - 1} names`);
}

// ---------- Import ----------

const q = s => s.includes("'") && !s.includes('"') ? JSON.stringify(s) : "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

function doImport(file) {
  const D = loadAll(), S = readXlsx(file), report = [];
  const clean = s => String(s || '').replace(/\r\n?/g, '\n').trim();
  // Texts: the language files are rewritten with the same order; new keys go at the end
  if (S.Texts) {
    const head = S.Texts[0].map(clean), col = {};
    for (const l of LANGS) col[l] = head.indexOf(LNAME[l]);
    for (const l of LANGS) {
      if (col[l] < 0) continue;
      const dict = D.I18N[l], fileL = path.join(root, 'js/lang', l + '.js');
      const src = fs.readFileSync(fileL, 'utf8');
      const order = [...src.matchAll(/^ {2}("(?:[^"\\]|\\.)*"): /gm)].map(m => JSON.parse(m[1]));
      let changed = 0, added = 0;
      for (const row of S.Texts.slice(1)) {
        const k = clean(row[0]), v = clean(row[col[l]]);
        if (!k || !v || dict[k] === v) continue;
        if (vars(k) !== vars(v)) { report.push(`${LNAME[l]}: skipped, the {placeholders} differ: "${k.slice(0, 60)}"`); continue; }
        if (!(k in dict)) { order.push(k); added++; } else changed++;
        dict[k] = v;
      }
      if (!changed && !added) continue;
      const headLines = src.slice(0, src.indexOf('{\n') + 2);
      fs.writeFileSync(fileL, headLines + order.filter((k, i) => order.indexOf(k) === i).map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(dict[k])},\n`).join('') + '});\n');
      report.push(`${LNAME[l]}: ${changed} texts changed, ${added} added`);
    }
  }
  // Places and names live in js/i18n.js
  const i18nFile = path.join(root, 'js/i18n.js');
  let src = fs.readFileSync(i18nFile, 'utf8'), touched = false;
  // Each changed name is replaced where it stands, so the file keeps its layout
  const reEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const setEntry = (from, to, key, arr) => {
    const a = typeof from === 'number' ? from + 1 : src.indexOf(from), b = to ? src.indexOf(to, a + 1) : src.length;
    const k = reEsc(key), qk = reEsc(key.replace(/'/g, "\\'"));
    const re = new RegExp(`(^|[\\s,{])((?:'${qk}'|"${k}"|${k})\\s*:\\s*)\\[[^\\]]*\\]`);
    const part = src.slice(a, b), m = re.exec(part);
    if (!m) return false;
    src = src.slice(0, a) + part.slice(0, m.index) + m[1] + m[2] + `[${arr.map(q).join(', ')}]` + part.slice(m.index + m[0].length) + src.slice(b);
    touched = true;
    return true;
  };
  if (S.Places) {
    let n = 0;
    for (const row of S.Places.slice(1)) {
      const id = clean(row[0]);
      if (!id) continue;
      LANGS.forEach((l, i) => {
        const city = clean(row[3 + i * 2]), region = clean(row[4 + i * 2]);
        const cur = D.PLACES[l][id];
        if (!cur || !((city && city !== cur[0]) || (region && region !== cur[1]))) return;
        const start = src.indexOf('const PLACES = {'), from = src.indexOf(`\n  ${l}: {`, start);
        if (setEntry(from, '\n  },', id, [city || cur[0], region || cur[1]])) n++;
        else report.push(`Places: ${id} (${LNAME[l]}) not found`);
      });
    }
    if (n) report.push(`Places: ${n} changed`);
  }
  if (S.Names) {
    const n = { PEOPLE: 0, GEO: 0 };
    for (const row of S.Names.slice(1)) {
      const k = clean(row[0]), table = k in D.PEOPLE ? 'PEOPLE' : k in D.GEO ? 'GEO' : null;
      if (!table) continue;
      const vals = D[table][k].slice();
      let diff = false;
      LANGS.forEach((l, i) => { const v = clean(row[1 + i]); if (v && v !== vals[i]) { vals[i] = v; diff = true; } });
      if (diff && setEntry(`const ${table} = {`, '\n};', k, vals)) n[table]++;
    }
    for (const table of ['PEOPLE', 'GEO']) if (n[table]) report.push(`${table === 'PEOPLE' ? 'People' : 'Geography'}: ${n[table]} names changed`);
  }
  if (touched) fs.writeFileSync(i18nFile, src);
  console.log(report.length ? report.join('\n') : 'Nothing has changed.');
}

module.exports = { doExport, doImport, readXlsx };
const [cmd, file] = require.main === module ? process.argv.slice(2) : [];
if (!cmd && require.main !== module) { /* used as a library by the tests */ } else if (cmd === 'export') doExport(file || path.join(root, 'translations.xlsx'));
else if (cmd === 'import' && file) doImport(file);
else console.log('Usage:\n  node tools/i18n-sheet.js export [file.xlsx]\n  node tools/i18n-sheet.js import file.xlsx');
