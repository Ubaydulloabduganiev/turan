'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

// The game opens in every language without errors
exports.opensInEveryLanguage = async ({ page, assert }) => {
  for (const l of ['en', 'uz', 'ru', 'tr']) {
    const p = await page(l);
    const title = await p.evaluate(() => document.title);
    assert(title.length > 3, `${l}: no title`);
    assert(!p.errors.length, `${l}: ${p.errors.join('; ')}`);
    await p.close2();
  }
};

// Every text the game can show has an Uzbek, Russian and Turkish version, with the same {placeholders}
exports.translationsComplete = async ({ ROOT, assert }) => {
  for (const l of ['uz', 'ru', 'tr']) {
    const out = execFileSync('node', [path.join(ROOT, 'tools/i18n-keys.js'), l]).toString();
    const m = out.match(/(\d+) missing.*?(\d+) with wrong/);
    assert(m && m[1] === '0' && m[2] === '0', `${l}: ${out.trim()}`);
  }
};

// A grand campaign started from the menus plays three turns with the End turn button
exports.grandCampaignPlays = async ({ page, startGrand, settle, assert }) => {
  const p = await page('en');
  await startGrand(p, 'temur');
  for (let i = 0; i < 3; i++) {
    const before = await p.evaluate(() => G.turn);
    await p.evaluate(() => { HOOKS.offer = async () => false; HOOKS.defend = async () => 'auto'; });
    await p.click('#btn-end');
    await p.waitForTimeout(300);
    await settle(p);
    assert(await p.evaluate(() => G.turn) === before + 1, 'turn did not advance from ' + before);
  }
  assert(!p.errors.length, p.errors.join('; '));
  await p.close2();
};
