'use strict';
// Runs the game's tests:  node tests/run.js            all quick tests
//                         node tests/run.js buttons    only the tests whose names contain "buttons"
//                         node tests/run.js --long     also the slow balance tests of the campaigns
const fs = require('fs'), path = require('path');
const lib = require('./lib');

(async () => {
  const args = process.argv.slice(2), long = args.includes('--long'), only = args.filter(a => !a.startsWith('--'));
  const files = fs.readdirSync(__dirname).filter(f => /^t-.*\.js$/.test(f)).sort();
  const tests = [];
  for (const f of files) for (const [name, fn] of Object.entries(require(path.join(__dirname, f)))) {
    if (name.startsWith('long') && !long) continue;
    const id = f.replace(/^t-|\.js$/g, '') + ' › ' + name;
    if (only.length && !only.some(o => id.includes(o))) continue;
    tests.push({ id, fn });
  }
  await lib.setup();
  let failed = 0;
  const t0 = Date.now();
  for (const t of tests) {
    const s = Date.now();
    try {
      await t.fn(lib);
      console.log(`  ok    ${t.id}  (${((Date.now() - s) / 1000).toFixed(1)}s)`);
    } catch (e) {
      failed++;
      console.log(`  FAIL  ${t.id}\n        ${String(e && e.message || e).split('\n').join('\n        ')}`);
    }
  }
  await lib.teardown();
  console.log(`\n${tests.length - failed} passed, ${failed} failed, in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(failed ? 1 : 0);
})();
