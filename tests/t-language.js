'use strict';
// The interface speaks one language at a time, and texts kept in the game follow a change of language

const FOREIGN = /[ʻʼ‘]|[Ѐ-ӿ]|[ğışİ]|\b(va|yil|bilan|uchun|qiling|oling|shahrida|davlat|oltin|yurish)\b/i;
async function foreignText(p) {
  return p.evaluate(src => {
    const re = new RegExp(src, 'i'), out = new Set();
    const walk = n => { if (n.nodeType === 3) { const s = n.textContent.trim(); const el = n.parentElement; if (s && re.test(s) && el && el.offsetParent !== null && !el.closest('#title-langs')) out.add(s.slice(0, 80)); } else for (const c of n.childNodes) walk(c); };
    walk(document.body);
    return [...out];
  }, FOREIGN.source);
}

exports.switchToEnglishFromUzbek = async ({ page, startGrand, assert }) => {
  const p = await page('uz');
  await p.click('[data-lang="en"]'); await p.waitForTimeout(300);
  await startGrand(p);
  const bad = await foreignText(p);
  assert(!bad.length, 'Uzbek, Russian or Turkish text in the English game: ' + bad.join(' | '));
  for (const id of ['btn-court', 'btn-dip', 'btn-realm', 'btn-dev']) {
    await p.click('#' + id); await p.waitForTimeout(300);
    const b2 = await foreignText(p); await p.evaluate(() => closeModal());
    assert(!b2.length, id + ': ' + b2.join(' | '));
  }
  await p.close2();
};

exports.savedTextsFollowTheLanguage = async ({ page, quietHooks, assert }) => {
  const p = await page('uz');
  await quietHooks(p);
  const r = await p.evaluate(async () => {
    newGame('temur', 9);
    G.factions.temur.deeds = { finished: true }; G.factions.temur.nextMission = G.turn;
    checkMission();
    for (let i = 0; i < 4; i++) await endTurn();
    const uzLog = inLang(G.log[G.log.length - 1].text), uzMission = G.factions.temur.mission && inLang(G.factions.temur.mission.text);
    setLang('en');
    return { uzLog, enLog: inLang(G.log[G.log.length - 1].text), uzMission, enMission: G.factions.temur.mission && inLang(G.factions.temur.mission.text) };
  });
  const re = new RegExp(FOREIGN.source, 'i');
  assert(!re.test(r.enLog), 'chronicle stayed in Uzbek: ' + r.enLog);
  if (r.enMission) assert(!re.test(r.enMission), 'council request stayed in Uzbek: ' + r.enMission);
  assert(r.uzLog !== r.enLog, 'the chronicle entry is not translated');
  await p.close2();
};
