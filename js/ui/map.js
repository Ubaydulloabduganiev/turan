'use strict';
// The campaign map: an SVG drawn from MAPDATA, with pan, zoom, selection and army orders.

const SVGNS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('map');
const cam = { x: 0, y: 0, s: 1 };
const UI = { selArmy: null, selProv: null, reach: null, hover: null, k: 1 };
let layers = {};

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

// Illustrated city pictures, drawn around (0,0) = the city's centre on the ground.
function cityDefs() {
  const house = (x, y, w, h) => `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="url(#g-wall)" stroke="#5e4729" stroke-width="0.35"/><rect x="${x - 0.4}" y="${y - h - 1.2}" width="${w + 0.8}" height="1.4" fill="#f1dfb2" stroke="#5e4729" stroke-width="0.3"/>` +
    `<rect x="${x + w * 0.35}" y="${y - h * 0.55}" width="${w * 0.3}" height="${h * 0.55}" fill="#3b2a18"/>`;
  const dome = (x, y, r, gold) => `<rect x="${x - r * 0.8}" y="${y - r * 0.9}" width="${r * 1.6}" height="${r * 0.9}" fill="url(#g-wall)" stroke="#5e4729" stroke-width="0.35"/>` +
    `<path d="M${x - r} ${y - r * 0.85}a${r} ${r * 1.15} 0 0 1 ${2 * r} 0z" fill="url(#${gold ? 'g-gold' : 'g-dome'})" stroke="#0e3c40" stroke-width="0.4"/>` +
    `<path d="M${x} ${y - r * 2.1}v-${r * 0.5}" stroke="#d9b45a" stroke-width="0.7"/><circle cx="${x}" cy="${y - r * 2.65}" r="0.6" fill="#f3d27a"/>`;
  const minaret = (x, y, h) => `<rect x="${x - 1.3}" y="${y - h}" width="2.6" height="${h}" fill="url(#g-minaret)" stroke="#4d3a20" stroke-width="0.3"/>` +
    `<rect x="${x - 2}" y="${y - h * 0.78}" width="4" height="1.1" fill="#e9d6a8" stroke="#4d3a20" stroke-width="0.25"/><path d="M${x - 1.5} ${y - h}l1.5-3l1.5 3z" fill="#2a8f8a"/>`;
  const portal = (x, y, w, h) => `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" fill="url(#g-wall)" stroke="#5e4729" stroke-width="0.35"/>` +
    `<rect x="${x - w / 2 + 0.8}" y="${y - h + 0.8}" width="${w - 1.6}" height="1.2" fill="#2a8f8a"/><path d="M${x - w * 0.28} ${y}v-${h * 0.5}q${w * 0.28}-${h * 0.35} ${w * 0.56} 0v${h * 0.5}z" fill="#1d3f5a"/>`;
  const yurt = (x, y, r) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.3}" fill="#00000030"/><path d="M${x - r} ${y}v-${r * 0.55}q${r}-${r * 0.9} ${2 * r} 0v${r * 0.55}z" fill="#f1e8d2" stroke="#6b5434" stroke-width="0.4"/>` +
    `<path d="M${x - r} ${y - r * 0.4}h${2 * r}" stroke="#a5452c" stroke-width="0.8"/><rect x="${x - r * 0.22}" y="${y - r * 0.45}" width="${r * 0.44}" height="${r * 0.45}" fill="#7a3a1c"/>`;
  const wall = (w, h, towers) => `<ellipse cx="0" cy="${h * 0.15}" rx="${w * 0.62}" ry="${h * 0.42}" fill="#00000038"/>` +
    `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="1.5" fill="#cdb488" stroke="#7a5f37" stroke-width="1.6"/>` +
    `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="1.5" fill="none" stroke="#e8d5a6" stroke-width="0.6" stroke-dasharray="1.4 1.2"/>` +
    (towers ? [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2]].map(([tx, ty]) => `<circle cx="${tx}" cy="${ty}" r="2.4" fill="url(#g-wall)" stroke="#5e4729" stroke-width="0.5"/>`).join('') : '');
  return `
    <linearGradient id="g-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecd7a6"/><stop offset="1" stop-color="#b8945e"/></linearGradient>
    <linearGradient id="g-minaret" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e7d1a0"/><stop offset="0.6" stop-color="#c7a46c"/><stop offset="1" stop-color="#8e6f42"/></linearGradient>
    <radialGradient id="g-dome" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#a6f3ea"/><stop offset="0.45" stop-color="#2fb3a9"/><stop offset="1" stop-color="#11585e"/></radialGradient>
    <radialGradient id="g-gold" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff2c0"/><stop offset="0.5" stop-color="#d9a93e"/><stop offset="1" stop-color="#7a5414"/></radialGradient>
    <symbol id="c-great" overflow="visible">${wall(34, 18, true)}${house(-14, 2, 5, 4)}${house(9, 3, 5, 4)}${house(-6, 7, 4, 3)}${portal(-3, 4, 9, 9)}${dome(6, 4, 4.6, false)}${minaret(-11, 4, 18)}${minaret(13, 5, 15)}</symbol>
    <symbol id="c-great-cap" overflow="visible">${wall(34, 18, true)}${house(-14, 2, 5, 4)}${house(9, 3, 5, 4)}${house(-6, 7, 4, 3)}${portal(-3, 4, 9, 9)}${dome(6, 4, 4.6, true)}${minaret(-11, 4, 18)}${minaret(13, 5, 15)}</symbol>
    <symbol id="c-city" overflow="visible">${wall(26, 14, true)}${house(-10, 2, 5, 4)}${house(5, 4, 5, 3.5)}${dome(0, 3, 3.8, false)}${minaret(-6, 4, 13)}</symbol>
    <symbol id="c-city-cap" overflow="visible">${wall(26, 14, true)}${house(-10, 2, 5, 4)}${house(5, 4, 5, 3.5)}${dome(0, 3, 3.8, true)}${minaret(-6, 4, 13)}</symbol>
    <symbol id="c-town" overflow="visible">${wall(19, 11, false)}${house(-7, 2, 4, 3.5)}${house(2, 3, 4.5, 3)}${dome(-1, 0, 2.8, false)}</symbol>
    <symbol id="c-village" overflow="visible"><ellipse cx="0" cy="2" rx="10" ry="4" fill="#00000030"/>${house(-7, 2, 4, 3)}${house(-1, 3, 4, 3.5)}${house(4, 1, 3.5, 3)}</symbol>
    <symbol id="c-camp" overflow="visible">${yurt(-5, 1, 4)}${yurt(4, 3, 4.5)}${yurt(0, -2, 3.5)}</symbol>`;
}

function cityKind(p) {
  const cap = p.owner !== 'rebels' && G.factions[p.owner].capital === p.id;
  const nomadCamp = (p.terrain === 'steppe' || p.terrain === 'desert') && p.b.walls < 2 && p.pop < 12;
  if (nomadCamp) return { id: 'c-camp', top: -8 };
  if (p.pop >= 38) return { id: cap ? 'c-great-cap' : 'c-great', top: -22 };
  if (p.pop >= 18 || p.b.walls >= 2) return { id: cap ? 'c-city-cap' : 'c-city', top: -16 };
  if (p.b.walls >= 1) return { id: 'c-town', top: -10 };
  return { id: 'c-village', top: -8 };
}

function initMap() {
  svg.innerHTML = `<defs>${cityDefs()}
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
    ${PROVINCE_DATA.map((d, i) => `<clipPath id="cp-${d[0]}"><path d="${outlinePath(MAPDATA.outlines[i])}"/></clipPath>`).join('')}
  </defs>`;
  // The painted terrain lives on a canvas under the SVG and follows the same camera
  let tc = document.getElementById('terrain');
  if (!tc) {
    tc = getTerrain();
    tc.id = 'terrain';
    tc.style.width = MAP.W + 'px'; tc.style.height = MAP.H + 'px';
    svg.parentNode.insertBefore(tc, svg);
  }
  const root = svgEl('g', { id: 'cam' }, svg);
  for (const name of ['hit', 'owners', 'borders', 'sel', 'reach', 'labels', 'cities', 'armies']) layers[name] = svgEl('g', { id: 'l-' + name }, root);
  for (const n of ['labels', 'borders', 'owners', 'sel']) layers[n].setAttribute('pointer-events', 'none');

  // Invisible province shapes catch clicks
  MAPDATA.sites.forEach((s, i) => {
    if (s.kind === 'province') svgEl('path', { d: outlinePath(MAPDATA.outlines[i]), fill: '#000', 'fill-opacity': 0, 'data-prov': PROVINCE_DATA[i][0] }, layers.hit);
  });
  // Names of seas, deserts and mountain ranges
  const named = {};
  MAPDATA.sites.forEach(s => { if (s.kind !== 'province') (named[s.name] = named[s.name] || []).push(s); });
  for (const name in named) {
    const l = named[name], x = l.reduce((t, s) => t + s.x, 0) / l.length, y = l.reduce((t, s) => t + s.y, 0) / l.length;
    const water = l[0].kind === 'water';
    const t = svgEl('text', { x, y, class: 'geo-label' + (water ? ' sea' : ''), 'text-anchor': 'middle', 'font-size': water ? 19 : 13 }, layers.labels);
    t.textContent = geoName(name);
    t.dataset.geo = name;
  }
  bindMapInput();
  fitMap();
  initLife();
}

function provPath(pid) { return outlinePath(MAPDATA.outlines[G.provinces[pid].idx]); }

function renderMap() {
  if (!G) return;
  // A light wash of each nation's colour
  layers.owners.innerHTML = '';
  for (const p of Object.values(G.provinces)) {
    if (p.owner === 'rebels') continue;
    svgEl('path', { d: provPath(p.id), fill: FACTIONS[p.owner].color, 'fill-opacity': p.owner === G.player ? 0.2 : 0.14 }, layers.owners);
  }
  // Borders: a painted band of colour inside each nation's edge, and a dark line where nations meet
  layers.borders.innerHTML = '';
  let inner = '', outer = '';
  const bands = {};
  const band = (pid, d) => { const o = G.provinces[pid].owner; if (o === 'rebels') return; (bands[pid] = bands[pid] || []).push(d); };
  for (const e of MAPDATA.edges) {
    const sa = MAPDATA.sites[e.a], sb = MAPDATA.sites[e.b];
    const d = linePath(e.pts);
    if (sa.kind === 'province' && sb.kind === 'province') {
      if (G.provinces[sa.id].owner !== G.provinces[sb.id].owner) { outer += d; band(sa.id, d); band(sb.id, d); } else inner += d;
    } else if (sa.kind === 'province' || sb.kind === 'province') band(sa.kind === 'province' ? sa.id : sb.id, d);
  }
  for (const pid in bands) {
    const F = FACTIONS[G.provinces[pid].owner];
    svgEl('path', { d: bands[pid].join(''), fill: 'none', stroke: F.color, 'stroke-width': 11, 'stroke-opacity': 0.55, 'stroke-linejoin': 'round', 'clip-path': `url(#cp-${pid})`, filter: 'url(#soft)' }, layers.borders);
    svgEl('path', { d: bands[pid].join(''), fill: 'none', stroke: F.color, 'stroke-width': 3.2, 'stroke-opacity': 0.9, 'stroke-linejoin': 'round', 'clip-path': `url(#cp-${pid})` }, layers.borders);
  }
  svgEl('path', { d: inner, fill: 'none', stroke: '#2a1d0e', 'stroke-width': 0.9, 'stroke-opacity': 0.4, 'stroke-dasharray': '2 3' }, layers.borders);
  svgEl('path', { d: outer, fill: 'none', stroke: '#1a1208', 'stroke-width': 1.7, 'stroke-opacity': 0.85, 'stroke-linejoin': 'round' }, layers.borders);

  renderSelection();
  renderCities();
  renderArmies();
}

function renderSelection() {
  layers.sel.innerHTML = '';
  layers.reach.innerHTML = '';
  if (UI.selProv && !UI.selArmy) {
    svgEl('path', { d: provPath(UI.selProv), fill: '#fff6d8', 'fill-opacity': 0.14, stroke: '#ffe9a8', 'stroke-width': 3, filter: 'url(#glow)', class: 'sel-glow' }, layers.sel);
  }
  if (UI.selArmy && G.armies[UI.selArmy]) {
    const a = G.armies[UI.selArmy];
    svgEl('path', { d: provPath(a.prov), fill: 'none', stroke: '#ffe9a8', 'stroke-width': 2.5, filter: 'url(#glow)' }, layers.sel);
    if (a.owner === G.player) {
      UI.reach = reachable(a);
      for (const pid in UI.reach) {
        const r = UI.reach[pid];
        const col = r.kind === 'move' ? '#9be37f' : r.kind === 'blocked' ? '#b8b0a0' : '#ff6a4a';
        svgEl('path', { d: provPath(pid), fill: col, 'fill-opacity': r.kind === 'blocked' ? 0.1 : 0.2, stroke: col, 'stroke-width': 2.4, 'stroke-dasharray': '7 5', 'data-prov': pid, class: 'reach' }, layers.reach);
      }
    }
  } else UI.reach = null;
}

function renderCities() {
  layers.cities.innerHTML = '';
  for (const p of Object.values(G.provinces)) {
    const g = svgEl('g', { transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${UI.k.toFixed(3)})`, 'data-prov': p.id, class: 'city' }, layers.cities);
    const k = cityKind(p);
    const isCap = p.owner !== 'rebels' && G.factions[p.owner].capital === p.id;
    svgEl('use', { href: '#' + k.id }, g);
    // The owner's pennant flies over the city
    const F = FACTIONS[p.owner];
    svgEl('path', { d: `M2 ${k.top}v-9`, stroke: '#3a2a16', 'stroke-width': 0.8 }, g);
    svgEl('path', { d: `M2 ${k.top - 9}h8l-2 2.2 2 2.2h-8z`, fill: F.color, stroke: F.dark, 'stroke-width': 0.5, class: 'pennant', style: `animation-delay:-${(p.idx * 0.53) % 1.6}s` }, g);
    // Zoomed far out, only the great cities keep their names
    if (UI.k < 1.15 || isCap || p.pop >= 20) {
      const label = svgEl('text', { y: 19, 'text-anchor': 'middle', class: 'city-label' + (isCap ? ' cap' : ''), 'font-size': isCap ? 13.5 : p.pop >= 25 ? 12 : 10.5 }, g);
      label.textContent = cityOf(p);
    }
    if (p.siege) {
      const s = svgEl('g', { transform: 'translate(-17 -12)', class: 'siege-mark' }, g);
      svgEl('circle', { r: 6.5, fill: '#5e1208', stroke: '#ffcf8a', 'stroke-width': 1 }, s);
      svgEl('path', { d: 'M-3.5-3.5L3.5 3.5M3.5-3.5L-3.5 3.5', stroke: '#ffe2b8', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, s);
    }
    if (p.build && p.owner === G.player) {
      const s = svgEl('g', { transform: 'translate(16 -6)' }, g);
      svgEl('circle', { r: 5.5, fill: '#1f4e6b', stroke: '#e8d29a', 'stroke-width': 0.8 }, s);
      svgEl('path', { d: 'M-2.5 2.5l4-4M0.5-2.5l2 2', stroke: '#fff3d6', 'stroke-width': 1.2, 'stroke-linecap': 'round' }, s);
    }
  }
}

function renderArmies() {
  layers.armies.innerHTML = '';
  const byProv = {};
  for (const a of Object.values(G.armies)) (byProv[a.prov] = byProv[a.prov] || []).push(a);
  for (const pid in byProv) {
    const p = G.provinces[pid];
    const home = byProv[pid].filter(a => a.owner === p.owner), away = byProv[pid].filter(a => a.owner !== p.owner);
    for (const a of home.concat(away)) {
      if (UI.hidden && UI.hidden.has(a.id)) continue; // drawn marching on the life layer instead
      const F = FACTIONS[a.owner];
      const besieger = a.owner !== p.owner;
      const k = besieger ? away.indexOf(a) : home.indexOf(a);
      // Defenders stand beside the city, besiegers camp to its left
      const s = UI.k, x = besieger ? p.x - (34 + k * 15) * s : p.x + (20 + k * 15) * s, y = besieger ? p.y + 4 * s : p.y - 2 * s;
      const g = svgEl('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`, 'data-army': a.id, class: 'army' + (UI.selArmy === a.id ? ' selected' : '') }, layers.armies);
      if (UI.selArmy === a.id) svgEl('ellipse', { cx: 0, cy: 10, rx: 13, ry: 4.5, class: 'army-ring' }, g);
      svgEl('ellipse', { cx: 2, cy: 10, rx: 9, ry: 2.8, fill: '#000', 'fill-opacity': 0.35 }, g);
      svgEl('path', { d: 'M0 10V-24', stroke: '#3b2410', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
      svgEl('path', { d: 'M-1-22h17', stroke: '#3b2410', 'stroke-width': 1.2 }, g);
      svgEl('circle', { cx: 0, cy: -25, r: 1.6, fill: '#e8c15c', stroke: '#6b4a10', 'stroke-width': 0.4 }, g);
      svgEl('path', { d: 'M0-22h16v17l-8-3.5-8 3.5z', fill: F.color, stroke: F.dark, 'stroke-width': 0.9, class: 'cloth', style: `animation-delay:-${(a.id.length * 0.37 + parseInt(a.id.slice(1), 10) * 0.61) % 2.4}s` }, g);
      svgEl('path', { d: 'M0-22h16v3H0z', fill: '#00000030' }, g);
      const em = svgEl('g', { transform: 'translate(2.2 -21) scale(0.3)' }, g);
      em.innerHTML = (EMBLEMS[a.owner] || EMBLEMS.rebels)(a.owner === 'white' ? '#5b4a2c' : a.owner === 'golden' ? '#7a1f12' : '#f6e7b8');
      svgEl('circle', { cx: 15, cy: 4, r: 5.6, fill: '#1a1208', stroke: '#d8b45a', 'stroke-width': 1 }, g);
      const t = svgEl('text', { x: 15, y: 6.8, 'text-anchor': 'middle', class: 'army-count' }, g);
      t.textContent = a.units.length;
      if (a.general) svgEl('path', { d: 'M0-34l1.6 3.3h3.6l-2.9 2.2 1.1 3.5L0-27.1l-3.4 2.1 1.1-3.5-2.9-2.2h3.6z', fill: a.general.leader ? '#ffd75a' : '#f3eee0', stroke: '#3b2410', 'stroke-width': 0.5 }, g);
      if (a.owner === G.player && a.moves > 0) svgEl('circle', { cx: -4, cy: 7, r: 2.4, fill: '#8ff07a', stroke: '#1d4a12', 'stroke-width': 0.7, class: 'ready' }, g);
    }
  }
}

// ---------- Movement ranges ----------

function reachable(a) {
  const out = {};
  if (a.moves <= 0) return out;
  const start = a.prov, frontier = [{ pid: start, steps: 0, path: [] }], seen = { [start]: true };
  while (frontier.length) {
    const c = frontier.shift();
    if (c.steps >= a.moves) continue;
    for (const n of G.provinces[c.pid].adj) {
      if (seen[n]) continue;
      seen[n] = true;
      const dest = G.provinces[n], path = c.path.concat(n);
      const peace = dest.owner !== a.owner && !allied(a.owner, dest.owner) && !atWar(a.owner, dest.owner);
      if (peace) { out[n] = { kind: 'blocked', path }; continue; }
      const enemies = armiesIn(n).some(o => atWar(o.owner, a.owner));
      const hostile = atWar(a.owner, dest.owner) || enemies;
      out[n] = { kind: hostile ? 'attack' : 'move', path };
      if (!hostile) frontier.push({ pid: n, steps: c.steps + 1, path });
    }
  }
  return out;
}

// ---------- Camera ----------

// Cities and banners keep a readable size: larger when zoomed out, smaller when zoomed in
let iconsQueued = false;
function updateIconScale() {
  const k = clampN(Math.pow(1.3 / cam.s, 0.6), 0.62, 1.45);
  if (Math.abs(k - UI.k) / UI.k < 0.06 || iconsQueued) return;
  iconsQueued = true;
  requestAnimationFrame(() => { iconsQueued = false; UI.k = clampN(Math.pow(1.3 / cam.s, 0.6), 0.62, 1.45); if (G) { renderCities(); renderArmies(); } });
}

function applyCam() {
  updateIconScale();
  const tc = document.getElementById('terrain');
  if (tc) tc.style.transform = `translate(${(-cam.x * cam.s).toFixed(1)}px, ${(-cam.y * cam.s).toFixed(1)}px) scale(${cam.s.toFixed(4)})`;
  layers.labels.parentNode.setAttribute('transform', `translate(${(-cam.x * cam.s).toFixed(1)} ${(-cam.y * cam.s).toFixed(1)}) scale(${cam.s.toFixed(4)})`);
}
function minScale() { return Math.max(svg.clientWidth / MAP.W, (svg.clientHeight - 46) / MAP.H) * 0.98; }
function clampCam() {
  const vw = svg.clientWidth / cam.s, vh = svg.clientHeight / cam.s;
  cam.x = vw >= MAP.W ? (MAP.W - vw) / 2 : clampN(cam.x, -60, MAP.W - vw + 60);
  cam.y = vh >= MAP.H + 46 / cam.s ? (MAP.H - vh) / 2 - 23 / cam.s : clampN(cam.y, -46 / cam.s - 30, MAP.H - vh + 30);
  applyCam();
}
function fitMap() { cam.s = minScale(); cam.x = 0; cam.y = -46 / cam.s; clampCam(); }
function centerOn(x, y, s) {
  if (s) cam.s = clampN(s, minScale(), 3.5);
  cam.x = x - svg.clientWidth / cam.s / 2;
  cam.y = y - svg.clientHeight / cam.s / 2;
  clampCam();
}
function centerOnProv(pid, zoom) { const p = G.provinces[pid]; centerOn(p.x + (UI.panelOpen ? -100 / cam.s : 0), p.y, zoom || Math.max(cam.s, 1.3)); }
const toWorld = (sx, sy) => ({ x: cam.x + sx / cam.s, y: cam.y + sy / cam.s });

function bindMapInput() {
  let down = null, pinch = null;
  const pointers = new Map();
  svg.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), s: cam.s };
      down = null;
      return;
    }
    down = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, button: e.button, target: e.target };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, before = toWorld(mid.x, mid.y);
      cam.s = clampN(pinch.s * Math.hypot(p1.x - p2.x, p1.y - p2.y) / pinch.d, minScale(), 3.5);
      cam.x = before.x - mid.x / cam.s; cam.y = before.y - mid.y / cam.s;
      clampCam();
      return;
    }
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.moved && Math.abs(dx) + Math.abs(dy) > 5) { down.moved = true; svg.classList.add('panning'); hideTip(); }
      if (down.moved) { cam.x = down.cx - dx / cam.s; cam.y = down.cy - dy / cam.s; clampCam(); }
      return;
    }
    hoverAt(e);
  });
  const end = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!down) return;
    const d = down;
    down = null;
    svg.classList.remove('panning');
    if (d.moved) return;
    mapClick(d.target, d.button === 2);
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); down = null; pinch = null; });
  svg.addEventListener('pointerleave', hideTip);
  svg.addEventListener('contextmenu', e => e.preventDefault());
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const before = toWorld(e.clientX, e.clientY);
    cam.s = clampN(cam.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), minScale(), 3.5);
    cam.x = before.x - e.clientX / cam.s; cam.y = before.y - e.clientY / cam.s;
    clampCam();
  }, { passive: false });
  window.addEventListener('resize', () => { if (G) clampCam(); });
}

function targetOf(el) {
  const a = el.closest && el.closest('[data-army]');
  if (a) return { army: a.getAttribute('data-army') };
  const p = el.closest && el.closest('[data-prov]');
  if (p) return { prov: p.getAttribute('data-prov') };
  return {};
}

function mapClick(el, right) {
  if (!G || uiLocked()) return;
  const t = targetOf(el);
  const sel = UI.selArmy && G.armies[UI.selArmy];
  const pid = t.prov || (t.army && G.armies[t.army] && G.armies[t.army].prov);
  // Orders: right-click anywhere, or left-click on a highlighted province
  if (sel && sel.owner === G.player && pid && pid !== sel.prov) {
    const onTarget = UI.reach && UI.reach[pid] && (!t.army || G.armies[t.army].owner !== G.player);
    if (right || onTarget) { orderMove(sel, pid); return; }
  }
  if (right) return;
  if (t.army) {
    const a = G.armies[t.army];
    UI.selArmy = a.id; UI.selProv = a.prov;
  } else if (t.prov) {
    UI.selArmy = null; UI.selProv = t.prov;
  } else { UI.selArmy = null; UI.selProv = null; }
  refresh();
}

function hoverAt(e) {
  const tg = targetOf(e.target);
  if (!G || (!tg.prov && !tg.army)) return hideTip();
  let html = '';
  if (tg.army) {
    const a = G.armies[tg.army];
    if (!a) return hideTip();
    const men = a.units.reduce((n, u) => n + u.men, 0);
    html = `<b>${a.general ? pn(a.general.name) : t('Army of {nation}', { nation: fName(a.owner) })}</b><br>${fName(a.owner)} · ${t('{n} units', { n: a.units.length })} · ${t('{n} men', { n: men })}`;
    if (a.general) html += `<br><span class="stars">${stars(Math.min(a.general.cmd, 5))}</span>`;
    if (a.owner !== G.player) html += `<br>${t('Strength')} ${strengthWord(armyPower(a))}`;
  } else {
    const p = G.provinces[tg.prov];
    html = `<b>${cityOf(p)}</b> · ${regionOf(p)}<br>${fFull(p.owner)}<br>${terrName(p.terrain)} · ${t('{n}k people', { n: Math.round(p.pop) })}${p.silk ? ' · ' + t('Silk Road') : ''}`;
    if (p.siege) html += `<br><span class="bad">${t('Besieged by {nation}', { nation: fName(p.siege.by) })}</span>`;
    if (UI.reach && UI.reach[p.id]) {
      const r = UI.reach[p.id];
      html += '<br>' + (r.kind === 'move' ? `<span class="good">${t('Click to march here')}</span>` : r.kind === 'blocked' ? `<span class="warn">${t('At peace: declare war to enter')}</span>` : `<span class="bad">${t('Click to attack')}</span>`);
    }
  }
  showTip(html, e.clientX, e.clientY);
}

function strengthWord(p) { return t(p < 15 ? 'very weak' : p < 40 ? 'weak' : p < 80 ? 'moderate' : p < 140 ? 'strong' : 'very strong'); }

function showTip(html, x, y) {
  const t = document.getElementById('tooltip');
  t.innerHTML = html;
  t.classList.remove('hidden');
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.min(window.innerWidth - w - 8, x + 14) + 'px';
  t.style.top = Math.min(window.innerHeight - h - 8, y + 14) + 'px';
}
function hideTip() { document.getElementById('tooltip').classList.add('hidden'); }
