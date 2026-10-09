'use strict';
// The translation spreadsheet: it must read back exactly what it wrote, and an unchanged sheet changes nothing
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

exports.translationSheetRoundTrip = async ({ assert }) => {
  const tool = path.join(__dirname, '..', 'tools', 'i18n-sheet.js');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'turan-')), 'tr.xlsx');
  cp.execFileSync(process.execPath, [tool, 'export', file]);
  const { readXlsx } = require(tool);
  const S = readXlsx(file);
  assert(S.Texts && S.Places && S.Names, 'missing sheets: ' + Object.keys(S));
  assert(S.Texts[0][1] === 'Uzbek' && S.Texts.length > 1500, 'the Texts sheet is wrong');
  const row = S.Texts.find(r => r[0] === '{city} is besieged.');
  assert(row && row[2] === '{city} в осаде.', 'a text did not come back as written: ' + row);
  const out = cp.execFileSync(process.execPath, [tool, 'import', file]).toString();
  assert(/Nothing has changed/.test(out), 'importing an unchanged sheet changed something: ' + out);
};
