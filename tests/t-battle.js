'use strict';
// Battles on the field run to their end, with every kind of soldier, elephants included

exports.fieldBattleToTheEnd = async ({ page, assert }) => {
  const p = await page('en');
  const r = await p.evaluate(async () => {
    quietNotices = true; newGame('temur', 3); notices.length = 0;
    document.getElementById('title').classList.add('hidden'); document.getElementById('game').classList.remove('hidden');
    const a = addArmy('temur', 'samarkand', ['tovachi', 'heavycav', 'horsearch', 'horsearch', 'heavyinf', 'spear', 'archer', 'siege'], makeGeneral('temur', 'Jaku', 3, 40));
    const d = addArmy('delhi', 'samarkand', ['elephant', 'elephant', 'janissary', 'mamluk', 'spear', 'archer'], makeGeneral('delhi', 'Mallu Iqbal', 2, 40));
    startTactical(makeBattle([a], [d], 'samarkand', 'field'));
    skipIntro();
    TB.paused = false;
    for (let i = 0; i < 20 * 240 && !TB.over; i++) stepBattle(0.05);
    return { over: TB.over, t: Math.round(TB.t) };
  });
  assert(r.over, 'the battle did not end in four minutes of battle time');
  assert(!p.errors.length, p.errors.join('; '));
  await p.close2();
};

exports.unitPicturesForEveryUnit = async ({ page, assert }) => {
  const p = await page('en');
  const bad = await p.evaluate(() => Object.keys(UNITS).filter(u => { const s = unitSVG(u, UNITS[u].only || 'temur'); return !s || s.length < 200; }));
  assert(!bad.length, 'units without a picture: ' + bad.join(', '));
  await p.close2();
};
