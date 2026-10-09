'use strict';
// Buttons must be reachable: nothing may lie on top of them

async function covered(p) {
  return p.evaluate(() => {
    const out = [];
    const root = modalOpen ? document.getElementById('modal') : document.body;
    for (const el of root.querySelectorAll('button, .choice, [data-act]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.pointerEvents === 'none' || +st.opacity === 0) continue;
      if (el.closest('.hidden, #modal-wrap.hidden')) continue;
      let clipped = false;
      for (let a = el.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(s.overflowY + s.overflowX)) { const ar = a.getBoundingClientRect(); const cy = r.top + r.height / 2, cx = r.left + r.width / 2; if (cy < ar.top || cy > ar.bottom || cx < ar.left || cx > ar.right) clipped = true; } }
      if (clipped) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (modalOpen && hit && !document.getElementById('modal').contains(hit)) continue; // the window's own buttons only
      if (!hit || !(el === hit || el.contains(hit))) out.push((el.id || el.textContent.trim().slice(0, 30)) + ' ← ' + (hit ? hit.tagName + '.' + String(hit.className.baseVal ?? hit.className).slice(0, 30) : 'nothing'));
    }
    return out;
  });
}

async function clickCentre(p, sel) {
  const el = await p.$(sel); const b = await el.boundingBox();
  await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

exports.windowsCloseWithTheirButton = async ({ page, startGrand, assert }) => {
  const p = await page('en');
  await startGrand(p);
  for (const id of ['btn-court', 'btn-dip', 'btn-realm', 'btn-dev', 'btn-chron']) {
    await clickCentre(p, '#' + id); await p.waitForTimeout(400);
    assert(await p.evaluate(() => modalOpen), id + ' did not open');
    const bad = await covered(p); assert(!bad.length, id + ': covered buttons: ' + bad.join(' | '));
    const close = (await p.$('#modal .modal-x')) ? '#modal .modal-x' : '#modal .actions button:last-child';
    await clickCentre(p, close); await p.waitForTimeout(300);
    assert(!(await p.evaluate(() => modalOpen)), id + ': the Close button did not close the window');
  }
  await clickCentre(p, '#btn-menu'); await p.waitForTimeout(300);
  assert(await p.evaluate(() => modalOpen), 'menu did not open');
  await p.evaluate(() => closeModal());
  assert(!p.errors.length, p.errors.join('; '));
  await p.close2();
};

exports.cityPanelTabsAndClose = async ({ page, startGrand, assert }) => {
  const p = await page('en');
  await startGrand(p);
  await p.evaluate(() => { UI.selProv = 'bukhara'; UI.selArmy = null; refresh(); });
  for (const k of await p.$$eval('.ptabs [data-k]', els => els.map(e => e.dataset.k))) {
    await clickCentre(p, `.ptabs [data-k="${k}"]`); await p.waitForTimeout(150);
    assert(await p.evaluate(() => UI.ptab) === k, 'tab ' + k + ' did not open');
    const bad = await covered(p); assert(!bad.length, 'tab ' + k + ': covered: ' + bad.join(' | '));
  }
  await clickCentre(p, '#panel .close'); await p.waitForTimeout(200);
  assert(await p.evaluate(() => document.getElementById('panel').classList.contains('hidden')), 'panel did not close');
  await p.close2();
};

exports.nothingCoveredOnPhone = async ({ page, startGrand, assert }) => {
  const p = await page('en', { viewport: { width: 390, height: 844 }, mobile: true });
  await startGrand(p);
  await p.evaluate(() => { UI.selProv = 'samarkand'; refresh(); });
  await p.waitForTimeout(300);
  const tb = await p.evaluate(() => { const r = document.getElementById('topbar').getBoundingClientRect(); return [...document.querySelectorAll('#topbar button')].filter(b => b.offsetParent && b.getBoundingClientRect().right > r.right + 1).map(b => b.id); });
  assert(!tb.length, 'top bar buttons cut off on a phone: ' + tb.join(', '));
  const bad = await covered(p); assert(!bad.filter(x => !/^btn-/.test(x)).length, 'covered: ' + bad.join(' | '));
  await p.close2();
};
