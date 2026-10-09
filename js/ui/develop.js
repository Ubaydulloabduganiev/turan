'use strict';
// The Development screen: science, literature and arts, trade and statecraft, with the ruler's
// patronage for each, the advances already won and those still ahead, and the learned men at court.

function devTrackHTML(k) {
  const pl = G.player, T = TRACKS[k], d = devOf(pl)[k], pts = devPoints(pl)[k];
  const next = d.lvl < 5 ? ADV_COST[d.lvl] : null, prev = d.lvl ? ADV_COST[d.lvl - 1] : 0;
  const pct = next ? Math.max(0, Math.min(100, (d.pts - prev) / (next - prev) * 100)) : 100;
  const turns = next ? Math.max(1, Math.ceil((next - d.pts) / Math.max(0.1, pts))) : 0;
  const pat = PATRONAGE.map((P, i) => `<button class="small ${d.pat === i ? 'on' : ''}" data-pat="${k}" data-i="${i}" title="${t('{n} gold a turn', { n: P.gold })}">${t(P.name)}${P.gold ? ` · ${P.gold}` : ''}</button>`).join('');
  const advs = T.advances.map((A, i) => {
    const cls = i < d.lvl ? 'done' : i === d.lvl ? 'next' : '';
    return `<li class="${cls}"><b>${i < d.lvl ? icon('check') + ' ' : ''}${t(A.name)}</b><small>${t(A.desc)}</small></li>`;
  }).join('');
  return `<div class="dev-track" style="--tc:${T.color}">
    <div class="dev-head"><h4>${t(T.name)}</h4><span class="dev-lvl">${d.lvl}/5</span></div>
    <p class="note">${t(T.desc)}</p>
    <div class="dev-bar"><div style="width:${pct.toFixed(0)}%"></div></div>
    <div class="dev-rate">${next ? t('+{n} a turn · next advance in about {k} turns', { n: fmt(pts), k: turns }) : t('Every advance won')}</div>
    <div class="dev-pat"><span>${t('Royal patronage')}</span><div class="btnrow">${pat}</div></div>
    <ol class="dev-advs">${advs}</ol>
  </div>`;
}

function openDevelopment() {
  const pl = G.player;
  const render = () => {
    const sages = sagesOf(pl);
    const court = sages.length ? sages.map(id => { const c = CHAR_BY_ID[id]; return `<div class="dev-sage">${portraitSVG(id, { cls: 'mini-portrait' })}<div><b>${pn(c.name)}</b><div class="p-sub">${t(TRACKS[SAGES[id].track].name)} · +${SAGE_PTS}</div></div></div>`; }).join('')
      : `<p class="note">${t('No scholars or poets at your court yet. They come to rulers who build libraries and madrasas, and pay them well.')}</p>`;
    const golden = goldenAgeNow();
    return `<button class="modal-x small" data-close="1">${t('Close')}</button><h3>${t('The development of the realm')}</h3>
      <p class="note">${t('A realm grows by more than the sword. Build madrasas, libraries and bazaars, appoint governors, keep trade agreements and pay for patronage. Each field brings five advances with lasting effects. Win all twenty to crown a golden age: a victory of peace.')}</p>
      <div class="kv"><div><span>${t('Patronage a turn')}</span>${fmt(totalPatronage(pl))}</div><div><span>${t('Scholars and poets')}</span>${sages.length}</div>
        <div><span>${t('Advances won')}</span>${TRACK_ORDER.reduce((s, k) => s + devOf(pl)[k].lvl, 0)}/20</div><div><span>${t('Golden age')}</span>${golden ? `<b class="good">${t('Yes')}</b>` : t('Not yet')}</div></div>
      <div class="dev-grid">${TRACK_ORDER.map(devTrackHTML).join('')}</div>
      <div class="p-sec"><h4>${t('Your court of learning')}</h4><div class="dev-court">${court}</div></div>`;
  };
  return showModal(render(), [], {
    cls: 'wide', cancel: null,
    onClick: e => {
      if (e.target.closest('[data-close]')) return closeModal(null);
      const b = e.target.closest('[data-pat]');
      if (b) { devOf(pl)[b.dataset.pat].pat = +b.dataset.i; sfx('coins', { vol: 0.5 }); $('modal').innerHTML = render(); refresh(); }
    },
  });
}

// The peaceful victory, shown once
async function checkGoldenAgeUI() {
  if (!G || !G.goldenAge || G.goldenShown) return;
  G.goldenShown = true;
  music('glory'); sfx('cheer');
  const pl = G.goldenBy || G.player;
  const v = await showModal(`<h3>${t('A golden age')}</h3><div class="with-portrait">${rulerPortrait(pl)}<p>${t('{date}: in the realm of {ruler}, astronomers chart the heavens, poets write in two languages, caravans fill the bazaars and the law reaches every village. Your realm ({nation}) has won all twenty advances. Whatever happens on the battlefield, the age will bear your name.', { date: dateText(), ruler: pn(G.factions[pl].leader), nation: fFull(pl) })}</p></div>`,
    [{ label: t('Main menu'), value: 'title' }, { label: t('The chronicle of the reign'), value: 'reign' }, { label: t('Keep ruling'), value: 'go', cls: 'big' }], { cancel: 'go', cls: 'parch' });
  if (v === 'reign') await openReign(true);
  if (v === 'title') toTitle();
}
