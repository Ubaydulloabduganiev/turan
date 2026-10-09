'use strict';
// The map and the computer rulers

exports.mapIsSound = async ({ page, assert }) => {
  const p = await page('en');
  const r = await p.evaluate(() => {
    newGame('temur', 1);
    const out = [];
    for (const p of Object.values(G.provinces)) {
      if (!p.adj.length) out.push(p.id + ' has no neighbours');
      for (const n of p.adj) if (!G.provinces[n].adj.includes(p.id)) out.push(`${p.id}→${n} one-way`);
      if (!PLACES.uz[p.id] || !PLACES.ru[p.id] || !PLACES.tr[p.id]) out.push(p.id + ' has no translated name');
    }
    for (const f in FACTIONS) if (FACTIONS[f].capital && (!G.provinces[FACTIONS[f].capital] || G.provinces[FACTIONS[f].capital].owner !== f)) out.push(f + ' capital');
    // every city can be reached from Samarkand over land or sea
    const seen = new Set(['samarkand']), q = ['samarkand'];
    while (q.length) { const c = q.shift(); for (const n of G.provinces[c].adj.concat(...seasAt(c).map(s => seas()[s]))) if (!seen.has(n)) { seen.add(n); q.push(n); } }
    for (const id in G.provinces) if (!seen.has(id)) out.push(id + ' unreachable');
    return out;
  });
  assert(!r.length, r.slice(0, 12).join('; '));
  await p.close2();
};

exports.sixtyTurnsOfTheWorld = async ({ page, quietHooks, assert }) => {
  const p = await page('en');
  await quietHooks(p);
  const r = await p.evaluate(async () => {
    newGame('mamluk', 77);
    const t0 = performance.now();
    for (let k = 0; k < 60 && !G.over; k++) await endTurn();
    return { turn: G.turn, ms: Math.round((performance.now() - t0) / 60), alive: POWERS.filter(f => G.factions[f].alive).length };
  });
  assert(r.turn >= 60 || r.alive >= 1, 'the world stopped at turn ' + r.turn);
  assert(r.ms < 400, 'turns are slow: ' + r.ms + ' ms each');
  assert(!p.errors.length, p.errors.join('; '));
  await p.close2();
};

exports.hotSeatHandsOver = async ({ page, assert }) => {
  const p = await page('en');
  await p.click('#btn-new'); await p.waitForTimeout(300);
  await p.click('[data-camp="hotseat"]'); await p.waitForTimeout(400);
  await p.click('[data-f="temur"]'); await p.click('[data-f="golden"]');
  await p.click('#pick-go');
  await p.waitForFunction(() => modalOpen, null, { timeout: 20000 });
  await p.click('#modal .big'); await p.waitForTimeout(800);
  await p.click('#modal .big'); await p.waitForTimeout(500);
  assert(await p.evaluate(() => G.player) === 'temur', 'Temur does not play first');
  await p.evaluate(() => { HOOKS.offer = async () => false; doEndTurn(); });
  let ok = false;
  for (let k = 0; k < 60; k++) {
    await p.waitForTimeout(400);
    const s = await p.evaluate(() => ({ pl: G.player, modal: modalOpen, h: document.querySelector('#modal h3') && document.querySelector('#modal h3').textContent }));
    if (s.pl === 'golden' && s.modal && /turn/i.test(s.h || '')) { ok = true; break; }
    if (s.modal) await p.evaluate(() => closeModal());
  }
  assert(ok, 'the device was not handed to the Golden Horde');
  await p.close2();
};
