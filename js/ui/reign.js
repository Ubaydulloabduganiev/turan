'use strict';
// The chronicle of the reign: a page that sums up a campaign, with a map of the realm, its rise and
// fall over the years, the line of rulers, and the deeds that will be remembered. It can be saved as a picture.

// The realm on a small map: the painted land with the player's provinces in their colour
function reignMapCanvas(w) {
  const pl = G.player, F = FACTIONS[pl];
  const h = Math.round(w * MAP.H / MAP.W), k = w / MAP.W;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (TERRAIN_CV) x.drawImage(TERRAIN_CV, 0, 0, w, h); else { x.fillStyle = '#c8b27a'; x.fillRect(0, 0, w, h); }
  x.fillStyle = 'rgba(10, 8, 4, 0.35)'; x.fillRect(0, 0, w, h);
  x.save(); x.scale(k, k);
  for (const p of Object.values(G.provinces)) {
    const path = new Path2D(provPath(p.id));
    if (p.owner === pl) { x.fillStyle = F.color; x.globalAlpha = 0.62; x.fill(path); x.globalAlpha = 1; x.strokeStyle = F.dark; x.lineWidth = 1.2 / k; x.stroke(path); }
  }
  // The capital
  const cap = G.provinces[G.factions[pl].capital];
  if (cap && cap.owner === pl) { x.fillStyle = '#ffe9a8'; x.strokeStyle = '#2a1806'; x.lineWidth = 2 / k; x.beginPath(); x.arc(cap.x, cap.y, 6 / k, 0, Math.PI * 2); x.fill(); x.stroke(); }
  x.restore();
  return c;
}

// The rise and fall of the realm, as a line
function reignGraph(w, h) {
  const hs = G.hist || [];
  if (hs.length < 2) return '';
  const max = Math.max(...hs.map(e => e.p), 1);
  const pts = hs.map((e, i) => `${(i / (hs.length - 1) * w).toFixed(1)},${(h - e.p / max * (h - 6) - 3).toFixed(1)}`).join(' ');
  const col = FACTIONS[G.player].color;
  return `<svg class="reign-graph" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polygon points="0,${h} ${pts} ${w},${h}" fill="${col}" fill-opacity=".25"/><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.2" vector-effect="non-scaling-stroke"/></svg>`;
}

function reignStats() {
  const pl = G.player, st = G.factions[pl], s = G.stats[pl] || {}, hs = G.hist || [];
  const peak = Math.max(provsOf(pl).length, ...hs.map(e => e.p));
  const startYear = GAME.START_YEAR + Math.floor(((G.scenario && scenarioById(G.scenario.id) && scenarioById(G.scenario.id).start) || 0) / 2);
  return [
    ['Years of the reign', `${startYear}–${year()}`],
    ['Provinces at the height', peak],
    ['Provinces now', provsOf(pl).length],
    ['Battles won', s.won || 0], ['Battles lost', s.lost || 0], ['Cities taken', s.taken || 0],
    ['Nations made to kneel', feats('submit')], ['Buildings raised', feats('built')], ['Soldiers trained', (feats('recruited') * 80).toLocaleString()],
    ['Caravans plundered', feats('caravan')], ['Advances won', TRACK_ORDER.reduce((n, k) => n + devOf(pl)[k].lvl, 0) + '/20'], ['Treasury', fmt(st.gold)],
  ];
}

function openReign(final) {
  const pl = G.player, st = G.factions[pl];
  const rulers = (G.rulers && G.rulers.length ? G.rulers : [{ name: st.leader, from: 0 }]);
  const wonders = Object.keys(WONDERS).filter(id => hasWonder(pl, id)).map(id => wName(id));
  const sages = sagesOf(pl).map(id => pn(CHAR_BY_ID[id].name));
  const marriages = (G.marriages || []).filter(m => m.gF === pl || m.bF === pl).map(m => `${pn(m.groom)} ❦ ${pn(m.bride)}`);
  const turns = (G.altLog || []).map(x => `${t(x.title)}: <i>${x.label}</i>${x.i > 0 ? ' ✦' : ''}`);
  const map = reignMapCanvas(Math.min(900, Math.round(innerWidth * 0.8)));
  const verdict = G.over === 'win' ? t('The last nation standing') : G.over === 'lose' ? t('The realm has fallen') : G.goldenAge ? t('A golden age') : G.scenario && G.scenario.result === 'win' ? t('Campaign won') : t('The reign goes on');
  const list = (title, items) => items.length ? `<div class="reign-list"><h4>${title}</h4><p>${items.join(' · ')}</p></div>` : '';
  const html = `<button class="modal-x small" data-close="1">${t('Close')}</button>
    <div class="reign-head">${flagSVG(pl)}<div><div class="camp-year">${t('The chronicle of the reign')} · ${dateText()}</div><h3>${fFull(pl)}</h3><div class="reign-verdict">${verdict}</div></div></div>
    <img class="reign-map" src="${map.toDataURL('image/jpeg', 0.85)}" alt="">
    ${reignGraph(600, 70)}
    <div class="reign-rulers">${rulers.map(r => `<div class="reign-ruler">${portraitSVG(r.name, { faction: pl, cls: 'mini-portrait' })}<div><b>${pn(r.name)}</b><span>${dateText(r.from)}${r.to !== undefined ? ' – ' + dateText(r.to) : ''}</span>${traitChips(r.name)}</div></div>`).join('')}</div>
    <div class="kv reign-kv">${reignStats().map(([k, v]) => `<div><span>${t(k)}</span>${v}</div>`).join('')}</div>
    ${list(t('Wonders of the age'), wonders)}${list(t('Scholars and poets'), sages)}${list(t('Royal marriages'), marriages)}${list(t('Turning points'), turns)}
    <div class="reign-actions"><button data-pic="1">${t('Save as picture')}</button></div>`;
  return showModal(html, [{ label: t('Close'), value: null, cls: 'big' }], {
    cls: 'wide parch reign', cancel: null,
    onClick: e => {
      if (e.target.closest('[data-close]')) return closeModal(null);
      if (e.target.closest('[data-pic]')) saveReignPicture(map);
    },
  });
}

// A picture to keep or share: the map, the title and the great numbers of the reign
function saveReignPicture(map) {
  const W = 1200, H = 900, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), pl = G.player, F = FACTIONS[pl];
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f6ebcf'); g.addColorStop(1, '#d9c18c');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#8a6522'; x.lineWidth = 6; x.strokeRect(14, 14, W - 28, H - 28);
  x.lineWidth = 1.5; x.strokeRect(26, 26, W - 52, H - 52);
  x.fillStyle = '#6e1f12'; x.textAlign = 'center';
  x.font = '40px Cinzel, Georgia, serif'; x.fillText(fFull(pl), W / 2, 92);
  x.fillStyle = '#5a4630'; x.font = '22px "Noto Sans", sans-serif'; x.fillText(`${t('The chronicle of the reign')} · ${dateText()}`, W / 2, 128);
  // The map fills the middle, leaving room for the numbers below
  const mh = 490, mw = Math.round(mh * map.width / map.height), mx = Math.round((W - mw) / 2);
  x.drawImage(map, mx, 150, mw, mh);
  x.strokeStyle = '#8a6522'; x.lineWidth = 2; x.strokeRect(mx, 150, mw, mh);
  const stats = reignStats().slice(0, 9);
  x.textAlign = 'left'; x.font = '21px "Noto Sans", sans-serif';
  stats.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2), px = 120 + col * 520, py = 150 + mh + 44 + row * 34;
    x.fillStyle = '#6b5a3c'; x.fillText(t(k) + ':', px, py);
    x.fillStyle = '#2a1e10'; x.fillText(String(v), px + 300, py);
  });
  x.fillStyle = F.color; x.fillRect(W / 2 - 60, H - 52, 120, 4);
  x.fillStyle = '#5a4630'; x.textAlign = 'center'; x.font = '18px Cinzel, Georgia, serif'; x.fillText('TURAN · ubaydulloabduganiev.github.io/turan', W / 2, H - 22);
  c.toBlob(async blob => {
    const name = `turan-reign-${pl}-${year()}.png`;
    try {
      const file = new File([blob], name, { type: 'image/png' });
      if (matchMedia('(hover: none)').matches && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: fFull(pl) }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}
