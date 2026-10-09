'use strict';
// The historical campaigns and the daily challenges

// Every campaign starts from its card and shows the victory window when its goal is met
exports.everyCampaignStartsAndCanBeWon = async ({ page, assert }) => {
  const p = await page('en');
  const ids = await p.evaluate(() => SCENARIOS.map(s => s.id));
  for (const id of ids) {
    await p.evaluate(() => { if (modalOpen) closeModal(); toTitle(); });
    await p.waitForTimeout(200);
    await p.evaluate(id => { startScenario(id); }, id);
    await p.waitForFunction(() => modalOpen, null, { timeout: 20000 });
    await p.evaluate(() => closeModal(true));
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const S = scenarioById(G.scenario.id);
      if (S.goal.type === 'take') for (const x of S.goal.provs) transferProvince(G.provinces[x], G.player, 0);
      else if (S.goal.type === 'hold') G.turn = S.deadline;
      else for (const k in S.goal.dev) devOf(G.player)[k].lvl = S.goal.dev[k];
      checkScenarioUI();
      return { start: S.start, deadline: S.deadline, turn: G.turn };
    });
    await p.waitForTimeout(600);
    const res = await p.evaluate(() => G.scenario.result);
    assert(res === 'win', `${id}: result ${res} (${JSON.stringify(r)})`);
  }
  assert(!p.errors.length, p.errors.join('; '));
  await p.close2();
};

// A month of daily challenges and a few weekly ones can all be built
exports.challengesBuild = async ({ page, assert }) => {
  const p = await page('en');
  const bad = await p.evaluate(() => {
    const out = [];
    for (let d = 0; d < 30; d++) {
      const day = new Date(Date.UTC(2026, 0, 1 + d * 3));
      for (const id of ['daily:' + dayKey(day), 'weekly:' + weekKey(day)]) {
        try { const S = challengeSpec(id); if (!S || !S.goal.provs.length) out.push(id + ' empty'); newScenarioGame(id); } catch (e) { out.push(id + ': ' + e.message); }
      }
    }
    return out;
  });
  assert(!bad.length, bad.join('; '));
  await p.close2();
};

// Slow: a simple player who only marches at the goal can win every conquest campaign (run with --long)
exports.longCampaignBalance = async ({ page, quietHooks, assert }) => {
  const p = await page('en');
  await quietHooks(p);
  const rows = await p.evaluate(async () => {
    const out = [];
    const pathTo = (from, to) => { const prev = { [from]: null }, q = [from]; while (q.length) { const c = q.shift(); if (c === to) break; for (const n of G.provinces[c].adj) if (!(n in prev)) { prev[n] = c; q.push(n); } } const path = []; for (let k = to; k && k !== from; k = prev[k]) path.unshift(k); return path; };
    for (const S of SCENARIOS) {
      if (S.goal.type === 'hold') continue;
      let wins = 0;
      for (let run = 0; run < 2; run++) {
        newScenarioGame(S.id);
        for (let k = 0; k < 40 && !G.scenario.result; k++) {
          const pl = G.player, goal = S.goal;
          if (goal.type === 'develop') { for (const t in goal.dev) devOf(pl)[t].pat = 2; for (const q of provsOf(pl)) if (!q.build) for (const key of ['library', 'madrasa']) if (!buildCheck(q, key)) { startBuild(q, key); break; } }
          else for (const a of armiesOf(pl).sort((x, y) => armyPower(y) - armyPower(x))) {
            if (!G.armies[a.id]) continue;
            const left = goal.provs.filter(id => G.provinces[id].owner !== pl);
            if (!left.length) break;
            if (a.besieging) { const b = assaultBattle(a.prov, pl); if (b && battleOdds(b) > 0.42) await assault(a.prov, pl); continue; }
            if (armyPower(a) < 60) continue;
            const strong = armiesOf(pl).filter(x => armyPower(x) >= 60).sort((x, y) => x.id < y.id ? -1 : 1);
            const own = S.id === 'revenge' ? goal.provs[strong.indexOf(a) % goal.provs.length] : left[0];
            if (G.provinces[own].owner === pl && a.prov === own) continue;
            const tgt = (G.provinces[own].owner !== pl ? own : null) || left.sort((x, y) => pathTo(a.prov, x).length - pathTo(a.prov, y).length)[0];
            for (const step of pathTo(a.prov, tgt)) { if (!G.armies[a.id] || a.moves <= 0) break; if (moveBlocked(a, step) === 'peace') declareWar(pl, G.provinces[step].owner, true); const r = await moveArmy(a, step); if (!r.ok || r.kind !== 'move') break; }
          }
          await endTurn(); checkScenario(false);
        }
        if (G.scenario.result === 'win') wins++;
      }
      out.push({ id: S.id, wins });
    }
    return out;
  });
  const lost = rows.filter(r => r.wins === 0);
  console.log('        ' + rows.map(r => `${r.id} ${r.wins}/2`).join(', '));
  assert(!lost.length, 'never won: ' + lost.map(r => r.id).join(', '));
  await p.close2();
};
