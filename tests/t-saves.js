'use strict';
// Saving and loading: a game comes back exactly as it was, old saves still load

exports.saveAndLoadIdentical = async ({ page, quietHooks, assert }) => {
  const p = await page('en');
  await quietHooks(p);
  const ok = await p.evaluate(async () => {
    newGame('kart', 11); for (let i = 0; i < 3; i++) await endTurn();
    const a = JSON.stringify(G); saveGame('auto'); G = null; loadGame('auto');
    const b = JSON.stringify(G);
    const text = gameToText(); G = null; const err = gameFromText(text);
    return { same: a === b, err, same2: JSON.stringify(G) === a };
  });
  assert(ok.same, 'browser save differs after loading');
  assert(!ok.err && ok.same2, 'save file differs after loading: ' + ok.err);
  await p.close2();
};

exports.oldSmallMapSaveLoads = async ({ page, quietHooks, assert }) => {
  const p = await page('en');
  await quietHooks(p);
  const r = await p.evaluate(async () => {
    newGame('kart', 3);
    const old = JSON.parse(JSON.stringify(G));
    // the map of earlier versions ended at 45.5° east and 31° north, without the five great powers
    for (const d of PROVINCE_DATA) if (d[3] < 45.5 || d[4] < 31 || FAR.includes(d[5])) delete old.provinces[d[0]];
    for (const f of FAR) delete old.factions[f];
    for (const k in old.armies) if (!old.provinces[old.armies[k].prov] || FAR.includes(old.armies[k].owner)) delete old.armies[k];
    old.factions.kart.mission = { type: 'army', target: 30, turns: 4, reward: 600, text: 'Qoʻshinni 30 ta boʻlinmaga yetkazing.', giver: 'Amir', deadline: 4, start: 0 };
    const err = gameFromText(JSON.stringify({ app: 'turan', game: old }));
    for (let i = 0; i < 3; i++) await endTurn();
    return { err, n: Object.keys(G.provinces).length, all: PROVINCE_DATA.length, far: FAR.every(f => G.factions[f] && G.factions[f].alive), mission: inLang(G.factions.kart.mission && G.factions.kart.mission.text) };
  });
  assert(!r.err, r.err);
  assert(r.n === r.all, `provinces ${r.n}/${r.all}`);
  assert(r.far, 'the great powers were not added');
  assert(!r.mission || /Raise the army/.test(r.mission), 'old request not rewritten: ' + r.mission);
  assert(!p.errors.length, p.errors.join('; '));
  await p.close2();
};

exports.badFileRefused = async ({ page, assert }) => {
  const p = await page('en');
  const err = await p.evaluate(() => gameFromText('{"hello": 1}'));
  assert(err, 'a wrong file was accepted');
  await p.close2();
};
