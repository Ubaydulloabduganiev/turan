'use strict';
// Special places on the map and in the province panel.

const PLACE_GLYPHS = {
  ruins: '<path d="M-6 6V-3M-2 6V-6M2.5 6V0M6 6V-4M-7.5-5h7"/>',
  shrine: '<path d="M-6 6V0h12v6zM-5 0q5-11 10 0M0-8v-3"/>',
  pass: '<path d="M-8 6L-3.5-6L0 0L3.5-6L8 6"/><path d="M-1.6 6V2h3.2v4"/>',
  mine: '<path d="M-6 6L3-3M-1-7q6-1 8 5"/><path d="M3 2l3 3-3 3-3-3z" class="gem"/>',
  horses: '<path d="M-6 7V0q0-5 4-7l3-2 1 2q4 1 5 6l-2 1-3-3-2 3v7"/>',
  lake: '<path d="M-7-3q1.75-2 3.5 0t3.5 0t3.5 0t3.5 0M-7 2q1.75-2 3.5 0t3.5 0t3.5 0t3.5 0M-5 6.5h10"/>',
  caravanserai: '<path d="M-7 6V-3h14v9M-2 6V2q2-3.5 4 0v4M-7-3l7-4 7 4"/>',
  cliff: '<path d="M-5 7V-2q5-8 10 0v9"/><path d="M0-3v10M-2 1h4"/>',
  river: '<path d="M-7 0q5-6 10 0q-5 6-10 0zM3 0l4.5-3.5v7z"/>',
  kurgan: '<path d="M-8 6q8-11 16 0zM5.5 0v-6"/>',
};
function placeGlyph(id, size = 24) {
  const L = LANDMARKS[id];
  return `<svg class="pl-ico" viewBox="-12 -12 24 24" width="${size}" height="${size}"><circle r="11" fill="#1a1208" stroke="#d8b45a" stroke-width="1.3"/>` +
    `<g fill="none" stroke="#f3d27a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="--gem:${L.gem || '#4ac0c0'}">${PLACE_GLYPHS[L.kind]}</g></svg>`;
}

// Markers under the cities that hold a special place
function renderPlaces() {
  const layer = layers.places;
  if (!layer) return;
  layer.innerHTML = '';
  const seen = (G.factions[G.player].seen) || [];
  for (const id in LANDMARKS) {
    const p = G.provinces[LANDMARKS[id].prov], s = UI.k;
    const g = svgEl('g', { transform: `translate(${(p.x - 15 * s).toFixed(1)} ${(p.y + 30 * s).toFixed(1)}) scale(${(s * 0.8).toFixed(3)})`, 'data-prov': p.id, class: 'place-mark' + (p.owner === G.player && !seen.includes(id) ? ' fresh' : '') }, layer);
    g.innerHTML = placeGlyph(id).replace(/<svg[^>]*>|<\/svg>/g, '');
    if (UI.k < 0.85) { const tx = svgEl('text', { x: 0, y: 21, 'text-anchor': 'middle', class: 'place-label' }, g); tx.textContent = t(LANDMARKS[id].name); }
  }
  if (typeof declutterLabels === 'function') declutterLabels();
}

function placeSection(p) {
  const id = landmarkIn(p.id);
  if (!id) return '';
  const L = LANDMARKS[id], mine = p.owner === G.player;
  const seen = (G.factions[G.player].seen || []).includes(id);
  return `<div class="p-sec place"><h4>${t('Special place')}</h4><div class="pl-row">${placeGlyph(id, 46)}<div><div class="w-name">${t(L.name)}</div><p class="note">${t(L.desc)}</p></div></div>` +
    (mine ? `<p class="good">${t('Its blessing is yours.')}</p>` + (seen ? `<button class="small" data-act="viewplace" data-k="${id}">${t('Visit it')}</button>` : '')
      : `<p class="note">${p.owner === 'rebels' ? t('Take this city and its blessing is yours.') : t('Its blessing belongs to: {nation}.', { nation: fName(p.owner) })}</p>`) + '</div>';
}
