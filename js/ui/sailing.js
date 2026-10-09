'use strict';
// Sailing across the Caspian, the Aral Sea or Lake Balkhash: choose a shore, then fight whatever waits on the
// water or on the beach.

async function openSail(a) {
  const why = sailCheck(a);
  if (why) { toast(t('Cannot sail'), t(why), 'bad'); return; }
  const list = sailTargets(a);
  const bySea = {};
  for (const x of list) (bySea[x.sea] = bySea[x.sea] || []).push(x);
  const word = { move: t('Sail'), land: t('Land and attack'), blocked: t('At peace') };
  const html = Object.keys(bySea).map(sea => `<h4>${geoName(sea)}</h4><div class="choices sail-list">` + bySea[sea].map(x => {
    const q = G.provinces[x.prov];
    const danger = interceptor(a, sea, x.prov);
    return `<button class="choice ${x.kind === 'land' ? 'warwarn' : ''}" data-to="${x.prov}" ${x.kind === 'blocked' ? 'disabled' : ''}><b>${flagSVG(q.owner, 'flag')} ${cityOf(q)}</b>
      <small>${fName(q.owner)} · ${word[x.kind]}${danger && provVisible(danger.prov) ? ' · ' + t('enemy boats at {city}', { city: cityOf(G.provinces[danger.prov]) }) : ''}</small></button>`;
  }).join('') + '</div>').join('');
  const to = await showModal(`<h3>${icon('sail')} ${t('Where shall the army sail?')}</h3><p class="note">${t('Hiring the boats costs {n} gold. The crossing takes the whole turn. An enemy army in another port of the same water may row out to meet you.', { n: fmt(sailCost(a)) })}</p>${html}`,
    [{ label: t('Cancel'), value: null }], { cancel: null, cls: 'wide', onClick: e => { const b = e.target.closest('[data-to]'); if (b && !b.disabled) closeModal(b.dataset.to); } });
  if (!to) return;
  const ownerBefore = G.provinces[to].owner;
  const choose = (b, kind) => showModal(battleHTML(b, kind === 'naval' ? t('Enemy boats!') : t('A landing under fire'),
    kind === 'naval' ? t('An enemy army rows out from {city} to meet your boats.', { city: cityOf(G.provinces[b.port]) }) : t('Your men must fight their way up the beach.')),
    [{ label: t('Auto-resolve'), value: 'auto' }, { label: t('Fight the battle'), value: 'fight', cls: 'big' }], { cancel: 'auto', cls: 'wide' });
  const res = await sailArmy(a, to, { choose });
  if (!res.ok) { toast(t('Cannot sail'), t(res.why), 'bad'); return; }
  refresh();
  if (res.naval) await showBattleResult(res.result, res.naval, res.before);
  if (res.landed) {
    if (res.landed.battle) await showBattleResult(res.landed.result, res.landed.battle, res.landed.before);
    else if (res.landed.kind === 'move') toast(t('Landed'), t('The army comes ashore at {city}.', { city: cityById(to) }), 'good');
    else if (res.landed.kind === 'siege') toast(t('Siege'), t('Our army surrounds {city}. Without a fight it will fall in about {n} turns. You can also storm the walls.', { city: cityById(to), n: siegeTurns(G.provinces[to]) }), '');
    await afterCapture(to, ownerBefore);
  }
  if (G.armies[a.id]) { UI.selArmy = a.id; UI.selProv = G.armies[a.id].prov; centerOnProv(UI.selProv); }
  refresh();
  checkOverUI();
}
