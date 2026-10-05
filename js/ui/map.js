'use strict';
// The campaign map: an SVG drawn from MAPDATA, with pan, zoom, selection and army orders.

const SVGNS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('map');
const cam = { x: 0, y: 0, s: 1 };
const UI = { selArmy: null, selProv: null, reach: null, hover: null };
let layers = {};

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function initMap() {
  svg.innerHTML = `<defs>
    <pattern id="pat-water" width="28" height="14" patternUnits="userSpaceOnUse">
      <rect width="28" height="14" fill="#2c5a7c"/><path d="M2 8q5-4 10 0t10 0" fill="none" stroke="#4d81a6" stroke-width="1.2"/></pattern>
    <pattern id="pat-mount" width="26" height="20" patternUnits="userSpaceOnUse">
      <rect width="26" height="20" fill="#7a6c58"/><path d="M3 16l6-9 6 9M13 16l5-7 5 7" fill="#8d7e68" stroke="#4e4436" stroke-width="1"/><path d="M9 7l-1.6 2.4h3.2z" fill="#e8e2d4"/></pattern>
    <pattern id="pat-desert" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#cdb183"/><circle cx="4" cy="5" r="0.9" fill="#b0925f"/><circle cx="12" cy="11" r="0.9" fill="#b0925f"/></pattern>
    <pattern id="pat-rebel" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="none"/><path d="M0 0v8" stroke="#00000022" stroke-width="3"/></pattern>
    <filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7"/>
      <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 0.22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="glow"><feGaussianBlur stdDeviation="2.5"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
  const root = svgEl('g', { id: 'cam' }, svg);
  for (const name of ['terrain', 'owners', 'texture', 'borders', 'sel', 'reach', 'labels', 'cities', 'armies']) layers[name] = svgEl('g', { id: 'l-' + name }, root);
  layers.labels.setAttribute('pointer-events', 'none');
  layers.texture.setAttribute('pointer-events', 'none');
  layers.borders.setAttribute('pointer-events', 'none');

  // Static terrain
  MAPDATA.sites.forEach((s, i) => {
    const d = outlinePath(MAPDATA.outlines[i]);
    if (s.kind === 'province') {
      const P = PROVINCE_DATA[i];
      svgEl('path', { d, fill: TERRAIN[P[7]].color, 'data-prov': P[0] }, layers.terrain);
    } else {
      const fill = s.kind === 'water' ? 'url(#pat-water)' : s.kind === 'desert' ? 'url(#pat-desert)' : 'url(#pat-mount)';
      svgEl('path', { d, fill, stroke: fill, 'stroke-width': 0.6 }, layers.terrain);
    }
  });
  // Paper texture over everything
  svgEl('rect', { x: 0, y: 0, width: MAP.W, height: MAP.H, filter: 'url(#paper)', fill: '#fff' }, layers.texture);
  // Barrier names
  const named = {};
  MAPDATA.sites.forEach(s => { if (s.kind !== 'province') (named[s.name] = named[s.name] || []).push(s); });
  for (const name in named) {
    const l = named[name], x = l.reduce((t, s) => t + s.x, 0) / l.length, y = l.reduce((t, s) => t + s.y, 0) / l.length;
    const t = svgEl('text', { x, y, class: 'barrier-label', 'text-anchor': 'middle', fill: l[0].kind === 'water' ? '#9cc3df' : '#3b3226',
      'font-size': l[0].kind === 'water' ? 17 : 13, 'font-style': 'italic', opacity: 0.85, 'letter-spacing': 2 }, layers.labels);
    t.textContent = name;
  }
  bindMapInput();
  fitMap();
}

function provPath(pid) { return outlinePath(MAPDATA.outlines[G.provinces[pid].idx]); }

function renderMap() {
  if (!G) return;
  // Ownership colours
  layers.owners.innerHTML = '';
  for (const p of Object.values(G.provinces)) {
    const F = FACTIONS[p.owner];
    const fill = p.owner === 'rebels' ? 'url(#pat-rebel)' : F.color;
    svgEl('path', { d: provPath(p.id), fill, 'fill-opacity': p.owner === 'rebels' ? 1 : 0.55, 'data-prov': p.id, class: 'prov' }, layers.owners);
  }
  // Borders
  let thin = '', thick = '', coast = '';
  for (const e of MAPDATA.edges) {
    const sa = MAPDATA.sites[e.a], sb = MAPDATA.sites[e.b];
    const d = linePath(e.pts);
    if (sa.kind === 'province' && sb.kind === 'province') {
      if (G.provinces[sa.id].owner !== G.provinces[sb.id].owner) thick += d; else thin += d;
    } else if ((sa.kind === 'water') !== (sb.kind === 'water')) coast += d;
  }
  layers.borders.innerHTML = '';
  svgEl('path', { d: coast, fill: 'none', stroke: '#efe3c6', 'stroke-width': 2.2, 'stroke-opacity': 0.8 }, layers.borders);
  svgEl('path', { d: thin, fill: 'none', stroke: '#2a2116', 'stroke-width': 0.8, 'stroke-opacity': 0.35, 'stroke-dasharray': '3 3' }, layers.borders);
  svgEl('path', { d: thick, fill: 'none', stroke: '#1f160c', 'stroke-width': 2.4, 'stroke-opacity': 0.85, 'stroke-linejoin': 'round' }, layers.borders);

  renderSelection();
  renderCities();
  renderArmies();
}

function renderSelection() {
  layers.sel.innerHTML = '';
  layers.reach.innerHTML = '';
  if (UI.selProv && !UI.selArmy) {
    svgEl('path', { d: provPath(UI.selProv), fill: '#fff', 'fill-opacity': 0.12, stroke: '#ffe08a', 'stroke-width': 3, filter: 'url(#glow)', 'pointer-events': 'none' }, layers.sel);
  }
  if (UI.selArmy && G.armies[UI.selArmy]) {
    const a = G.armies[UI.selArmy];
    svgEl('path', { d: provPath(a.prov), fill: 'none', stroke: '#ffe08a', 'stroke-width': 2.5, 'pointer-events': 'none' }, layers.sel);
    if (a.owner === G.player) {
      UI.reach = reachable(a);
      for (const pid in UI.reach) {
        const r = UI.reach[pid];
        const col = r.kind === 'move' ? '#7fe07f' : r.kind === 'blocked' ? '#9a9a9a' : '#ff6a50';
        svgEl('path', { d: provPath(pid), fill: col, 'fill-opacity': r.kind === 'blocked' ? 0.12 : 0.22, stroke: col, 'stroke-width': 2, 'stroke-dasharray': r.kind === 'move' ? '6 4' : '', 'data-prov': pid, class: 'reach' }, layers.reach);
      }
    }
  } else UI.reach = null;
}

function renderCities() {
  layers.cities.innerHTML = '';
  for (const p of Object.values(G.provinces)) {
    const g = svgEl('g', { transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`, 'data-prov': p.id, class: 'city' }, layers.cities);
    const r = 3 + Math.min(5, p.pop / 12);
    const isCap = p.owner !== 'rebels' && G.factions[p.owner].capital === p.id;
    if (p.b.walls) svgEl('rect', { x: -r - 2.5, y: -r - 2.5, width: 2 * r + 5, height: 2 * r + 5, rx: 1.5, fill: '#3a3024', stroke: '#e9dcb8', 'stroke-width': 0.6 + 0.5 * p.b.walls }, g);
    svgEl('circle', { r, fill: isCap ? '#f3d27a' : '#efe3c6', stroke: '#2a2116', 'stroke-width': 1.2 }, g);
    if (isCap) svgEl('path', { d: `M${-r * 0.6} ${-r * 0.1}l${r * 0.3} ${-r * 0.6}l${r * 0.3} ${r * 0.4}l${r * 0.3} ${-r * 0.4}l${r * 0.3} ${r * 0.6}z`, fill: '#7a1f12' }, g);
    const label = svgEl('text', { y: r + 13, 'text-anchor': 'middle', class: 'city-label', 'font-size': p.pop >= 25 ? 13 : 11.5,
      fill: '#1d150c', stroke: '#f3e9cf', 'stroke-width': 3, 'paint-order': 'stroke', 'pointer-events': 'none' }, g);
    label.textContent = p.city;
    if (p.siege) {
      const s = svgEl('g', { transform: `translate(${-r - 12} ${-r - 8})`, 'pointer-events': 'none' }, g);
      svgEl('circle', { r: 7, fill: '#7a1f12', stroke: '#ffd2a0', 'stroke-width': 1 }, s);
      svgEl('path', { d: 'M-4-4L4 4M4-4L-4 4', stroke: '#ffe8c8', 'stroke-width': 1.8 }, s);
    }
    if (p.build && p.owner === G.player) {
      const s = svgEl('g', { transform: `translate(${r + 7} ${-r - 4})`, 'pointer-events': 'none' }, g);
      svgEl('rect', { x: -5, y: -5, width: 10, height: 10, fill: '#2b6b8a', stroke: '#fff', 'stroke-width': 0.8 }, s);
      svgEl('path', { d: 'M-3 3l5-5M1-3l2 2', stroke: '#fff', 'stroke-width': 1.3 }, s);
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
    const list = home.concat(away);
    list.forEach(a => {
      const F = FACTIONS[a.owner];
      const besieger = a.owner !== p.owner;
      // Defenders stand above the city, outsiders to its left
      const k = besieger ? away.indexOf(a) : home.indexOf(a);
      const x = besieger ? p.x - 30 - k * 16 : p.x - (home.length - 1) * 8 + k * 16 - 2, y = besieger ? p.y - 2 : p.y - 20;
      const g = svgEl('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, 'data-army': a.id, class: 'army' }, layers.armies);
      const sel = UI.selArmy === a.id;
      if (sel) svgEl('circle', { cx: 6, cy: -2, r: 15, fill: '#ffe08a', 'fill-opacity': 0.35, stroke: '#ffe08a', 'stroke-width': 1.5 }, g);
      svgEl('path', { d: 'M0 12V-16', stroke: '#2a1a0a', 'stroke-width': 1.6 }, g);
      svgEl('path', { d: 'M0-16h15v11l-7.5-3L0-5z', fill: F.color, stroke: F.dark, 'stroke-width': 1 }, g);
      const t = svgEl('text', { x: 7.5, y: -7.5, 'text-anchor': 'middle', 'font-size': 8, fill: a.owner === 'white' ? '#2a2116' : '#fff', 'font-weight': 'bold' }, g);
      t.textContent = a.units.length;
      if (a.general) svgEl('path', { d: 'M0-21l1.5 3h3.2l-2.6 2 1 3.2L0-14.6-3.1-12.8l1-3.2-2.6-2h3.2z', fill: a.general.leader ? '#ffd75a' : '#f3eee0', stroke: '#2a1a0a', 'stroke-width': 0.6 }, g);
      if (a.owner === G.player && a.moves > 0) svgEl('circle', { cx: -3, cy: 10, r: 2.6, fill: '#7fe07f', stroke: '#173', 'stroke-width': 0.7 }, g);
    });
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

function applyCam() {
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
  const t = targetOf(e.target);
  if (!G || (!t.prov && !t.army)) return hideTip();
  let html = '';
  if (t.army) {
    const a = G.armies[t.army];
    if (!a) return hideTip();
    const men = a.units.reduce((n, u) => n + u.men, 0);
    html = `<b>${a.general ? a.general.name : 'Army of ' + FACTIONS[a.owner].name}</b><br>${FACTIONS[a.owner].name} · ${a.units.length} units · ${men} men`;
    if (a.general) html += `<br><span class="stars">${stars(Math.min(a.general.cmd, 5))}</span>`;
    if (a.owner !== G.player) html += `<br>Strength ${strengthWord(armyPower(a))}`;
  } else {
    const p = G.provinces[t.prov];
    html = `<b>${p.city}</b> · ${p.name}<br>${FACTIONS[p.owner].full}<br>${TERRAIN[p.terrain].name} · ${Math.round(p.pop)}k people${p.silk ? ' · Silk Road' : ''}`;
    if (p.siege) html += `<br><span class="bad">Besieged by ${FACTIONS[p.siege.by].name}</span>`;
    if (UI.reach && UI.reach[p.id]) {
      const r = UI.reach[p.id];
      html += '<br>' + (r.kind === 'move' ? '<span class="good">Click to march here</span>' : r.kind === 'blocked' ? '<span class="warn">At peace: declare war to enter</span>' : '<span class="bad">Click to attack</span>');
    }
  }
  showTip(html, e.clientX, e.clientY);
}

function strengthWord(p) { return p < 15 ? 'very weak' : p < 40 ? 'weak' : p < 80 ? 'moderate' : p < 140 ? 'strong' : 'very strong'; }

function showTip(html, x, y) {
  const t = document.getElementById('tooltip');
  t.innerHTML = html;
  t.classList.remove('hidden');
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.min(window.innerWidth - w - 8, x + 14) + 'px';
  t.style.top = Math.min(window.innerHeight - h - 8, y + 14) + 'px';
}
function hideTip() { document.getElementById('tooltip').classList.add('hidden'); }
