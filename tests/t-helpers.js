'use strict';
// Late-game helpers: march orders over several turns, governors, the same troops again, the turn's to-do list,
// and the city panel with its folded sections

exports.marchOrdersCarryOn = async ({ page, quietHooks, assert }) => {
  const p = await page('en');
  await quietHooks(p);
  const r = await p.evaluate(async () => {
    newGame('temur', 5);
    const a = armiesOf('temur').find(x => x.prov === 'samarkand') || armiesOf('temur')[0];
    const far = Object.values(G.provinces).filter(q => q.owner === 'temur').map(q => ({ q, n: orderPath(a, q.id) })).filter(x => x.n && x.n.length >= 3).sort((x, y) => y.n.length - x.n.length)[0].q.id;
    const path = setMarch(a, far);
    const out = { far, steps: path.length, turns: [] };
    for (let k = 0; k < 8 && a.dest; k++) { const rep = await followArmy(a); out.turns.push(a.prov + (rep ? ':' + rep.kind : '')); a.moves = armyMoves(a); }
    out.end = a.prov; out.dest = a.dest || null;
    // A march may not cross a neighbour we are at peace with
    const peace = Object.values(G.provinces).find(q => q.owner !== 'temur' && q.owner !== 'rebels' && !atWar('temur', q.owner) && !allied('temur', q.owner));
    out.peaceRefused = !orderPath(a, peace.id);
    return out;
  });
  assert(r.end === r.far && !r.dest, 'the army did not reach ' + r.far + ': ' + r.turns.join(' '));
  assert(r.turns.length > 1, 'a far march should take more than one turn');
  assert(r.peaceRefused, 'a march order would start a war on its own');
  assert(!p.errors.length, p.errors.join('; '));
  await p.close2();
};

exports.governorsAndRepeat = async ({ page, assert }) => {
  const p = await page('en');
  const r = await p.evaluate(() => {
    newGame('temur', 6);
    const st = G.factions.temur;
    st.gold = 5000;
    const cities = provsOf('temur').filter(q => !q.build);
    for (const q of cities) q.gov = true;
    const rep = governTurn('temur');
    const out = { built: rep.filter(x => x.kind === 'build').length, gold: st.gold };
    st.gold = 650; for (const q of provsOf('temur')) q.build = null;
    out.poor = governTurn('temur').filter(x => x.kind === 'build').length;
    const sam = G.provinces.samarkand; sam.queue = [];
    st.gold = 5000;
    const u = recruitable(sam)[0];
    recruit(sam, u); noteRecruit(sam, u); recruit(sam, u); noteRecruit(sam, u);
    out.sameTurn = repeatCheck(sam);
    sam.queue = []; G.turn++;
    out.err = repeatRecruit(sam); out.queue = sam.queue.length;
    return out;
  });
  assert(r.built >= 3, 'governors built only ' + r.built);
  assert(r.gold >= 600, 'governors spent the reserve: ' + r.gold);
  assert(r.poor === 0, 'governors build even below the reserve');
  assert(r.sameTurn, 'the same troops can be repeated in the same turn');
  assert(!r.err && r.queue === 2, 'repeat recruitment failed: ' + r.err + ' queue ' + r.queue);
  await p.close2();
};

exports.attentionAndCityPanel = async ({ page, startGrand, settle, assert }) => {
  const p = await page('en');
  await startGrand(p);
  const r = await p.evaluate(() => { UI.selArmy = null; UI.selProv = null; refresh(); return { items: attentionItems().length, box: !!document.querySelector('#attention .att-head') }; });
  assert(r.items > 0 && r.box, 'the turn\'s to-do list is empty or missing');
  // Clicking the idle cities line opens a city on its Build tab
  await p.evaluate(() => { const i = ATT.items.findIndex(x => x.tab === 'build'); document.querySelectorAll('#attention [data-att="go"]')[i].click(); });
  await p.waitForTimeout(300);
  assert(await p.evaluate(() => UI.ptab === 'build' && !!UI.selProv), 'the to-do line did not open the city');
  // The city tab: recommended actions first, the rest folded and remembered
  await p.evaluate(() => { UI.selProv = G.factions[G.player].capital; UI.ptab = 'rule'; refresh(); });
  await p.waitForTimeout(400);
  const c = await p.evaluate(() => {
    const secs = [...document.querySelectorAll('#panel .p-sec, #panel details.fold')];
    const first = secs[0] && secs[0].classList.contains('quick');
    const folds = [...document.querySelectorAll('#panel details.fold')].map(d => d.dataset.fold);
    const d = document.querySelector('#panel details.fold'); d.querySelector('summary').click();
    return { first, folds };
  });
  assert(c.first, 'the recommended actions are not first in the City tab');
  assert(c.folds.includes('treasury') && c.folds.includes('gov'), 'the city panel has no folded sections: ' + c.folds);
  await p.evaluate(() => refresh());
  assert(await p.evaluate(() => document.querySelector('#panel details.fold').open), 'an opened section closes again on refresh');
  // One-click build from the recommendations
  const built = await p.evaluate(() => { const b = document.querySelector('#panel .quick [data-act="build"]'); if (!b) return 'none'; b.click(); return G.provinces[UI.selProv].build ? 'ok' : 'no'; });
  await p.waitForTimeout(200);
  assert(built !== 'no', 'the recommended building did not start');
  assert(!p.errors.length, p.errors.join('; '));
  await p.close2();
};
