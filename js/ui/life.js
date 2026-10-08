'use strict';
// Life on the campaign map: caravans on the Silk Road, boats on the seas, grazing herds, birds,
// drifting clouds, smoke over besieged cities, and armies that visibly march and clash.
// Drawn every frame on a canvas between the painted terrain and the SVG of cities and banners.

const LIFE = { c: null, x: null, on: false, t: 0, last: 0, caravans: [], boats: [], herds: [], birds: [], clouds: [], glints: [], puffs: [], marches: [], clashes: [], showRivals: true };
UI.hidden = new Set();
try { LIFE.showRivals = localStorage.getItem('turan-rival-moves') !== 'off'; } catch (e) { /* storage unavailable */ }

function initLife() {
  if (LIFE.c) return;
  const c = document.createElement('canvas');
  c.id = 'life';
  svg.parentNode.insertBefore(c, svg);
  LIFE.c = c; LIFE.x = c.getContext('2d');
  const rnd = mulberry32(77);
  const S = MAPDATA.sites;
  const centre = i => ({ x: S[i].x, y: S[i].y });

  // Caravans wander the Silk Road from city to city
  const silk = PROVINCE_DATA.map((d, i) => d[8] ? i : -1).filter(i => i >= 0);
  const silkAdj = i => [...MAPDATA.adj[i]].filter(j => S[j].kind === 'province' && PROVINCE_DATA[j][8]);
  const route = start => {
    const path = [start];
    let prev = -1, cur = start;
    for (let k = 0; k < 6; k++) {
      const next = silkAdj(cur).filter(j => j !== prev);
      if (!next.length) break;
      prev = cur; cur = next[Math.floor(rnd() * next.length)];
      path.push(cur);
    }
    return path.map(centre);
  };
  for (let k = 0; k < 11; k++) {
    const p = route(silk[Math.floor(rnd() * silk.length)]);
    if (p.length > 1) LIFE.caravans.push({ path: p, seg: 0, d: rnd() * 40, n: 3 + Math.floor(rnd() * 3), sp: 13 + rnd() * 6, route, ph: rnd() * 6 });
  }
  // Boats sail between neighbouring cells of the same sea
  const water = S.map((s, i) => s.kind === 'water' ? i : -1).filter(i => i >= 0);
  for (let k = 0; k < 7; k++) {
    const a = water[Math.floor(rnd() * water.length)];
    LIFE.boats.push({ at: a, to: a, x: S[a].x, y: S[a].y, sp: 9 + rnd() * 6, sail: rnd() < 0.5 ? '#efe6cf' : '#d9c39a' });
  }
  // Herds grazing on the steppe
  const steppe = PROVINCE_DATA.map((d, i) => d[7] === 'steppe' ? i : -1).filter(i => i >= 0);
  for (let k = 0; k < 16; k++) {
    const i = steppe[Math.floor(rnd() * steppe.length)], s = S[i];
    const cx = s.x + (rnd() - 0.5) * 60, cy = s.y + 26 + rnd() * 30;
    const kind = rnd() < 0.5 ? 'sheep' : 'horse';
    LIFE.herds.push({ cx, cy, kind, beasts: Array.from({ length: 6 + Math.floor(rnd() * 6) }, () => ({ x: cx + (rnd() - 0.5) * 30, y: cy + (rnd() - 0.5) * 16, tx: cx, ty: cy, ph: rnd() * 6, col: kind === 'sheep' ? (rnd() < 0.85 ? '#efe9dc' : '#3b3128') : ['#6b4a2c', '#8a6a44', '#3a2a1c', '#c9b38a'][Math.floor(rnd() * 4)] })) });
  }
  // Birds
  for (let k = 0; k < 5; k++) LIFE.birds.push({ x: rnd() * MAP.W, y: rnd() * MAP.H, a: rnd() * Math.PI * 2, n: 4 + Math.floor(rnd() * 4), sp: 30 + rnd() * 20 });
  // Clouds and their shadows
  LIFE.cloudSprite = cloudSprite(rnd, false);
  LIFE.shadowSprite = cloudSprite(mulberry32(77), true);
  for (let k = 0; k < 8; k++) LIFE.clouds.push({ x: rnd() * MAP.W * 1.3 - MAP.W * 0.15, y: rnd() * MAP.H, s: 0.7 + rnd() * 0.9, sp: 5 + rnd() * 5 });
  // Sunlight glinting on the water
  for (const i of water) {
    const pts = MAPDATA.outlines[i], b = bbox(pts);
    for (let k = 0; k < 18; k++) {
      const x = b.x0 + rnd() * (b.x1 - b.x0), y = b.y0 + rnd() * (b.y1 - b.y0);
      if (inPoly(pts, x, y)) LIFE.glints.push({ x, y, ph: rnd() * 6, s: 2 + rnd() * 4 });
    }
  }
  LIFE.on = true;
  requestAnimationFrame(lifeFrame);
}

function cloudSprite(rnd, shadow) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 200;
  const x = c.getContext('2d');
  for (let k = 0; k < 9; k++) {
    const cx = 60 + rnd() * 200, cy = 70 + rnd() * 60, r = 35 + rnd() * 45;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, shadow ? 'rgba(20,14,6,0.5)' : 'rgba(255,255,255,0.9)');
    g.addColorStop(1, shadow ? 'rgba(20,14,6,0)' : 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }
  return c;
}

function puff(x, y, o) { if (LIFE.puffs.length < (GFX.low ? 90 : 360)) LIFE.puffs.push({ x, y, vx: o.vx || 0, vy: o.vy || -6, r: o.r || 3, g: o.g || 4, life: 1, decay: o.decay || 0.35, col: o.col || '120,110,100', a: o.a || 0.35 }); }

function onScreen(x, y, pad = 60) {
  const sx = (x - cam.x) * cam.s, sy = (y - cam.y) * cam.s;
  return sx > -pad && sy > -pad && sx < svg.clientWidth + pad && sy < svg.clientHeight + pad;
}

function lifeFrame(now) {
  if (!LIFE.on) return;
  requestAnimationFrame(lifeFrame);
  if (!G || $('game').classList.contains('hidden')) { LIFE.last = now; return; }
  // Light graphics: every other frame (the time still adds up, so marches keep their pace)
  if (GFX.low && (LIFE.odd = !LIFE.odd)) return;
  const raw = (now - (LIFE.last || now)) / 1000;
  if (!GFX.low) gfxSample(raw);
  const dt = Math.min(GFX.low ? 0.09 : 0.05, raw);
  LIFE.last = now; LIFE.t += dt;
  const c = LIFE.c, x = LIFE.x, dpr = Math.min(GFX.low ? 1 : 2, window.devicePixelRatio || 1);
  const W = svg.clientWidth, H = svg.clientHeight;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + 'px'; c.style.height = H + 'px'; }
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, c.width, c.height);
  const s = cam.s * dpr;
  x.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
  const t = LIFE.t;

  // Glints on the water
  if (!GFX.low) for (const g of LIFE.glints) {
    const a = Math.max(0, Math.sin(t * 1.3 + g.ph * 3)) ** 6;
    if (a < 0.05) continue;
    x.strokeStyle = `rgba(255,250,225,${a * 0.7})`; x.lineWidth = 0.9;
    x.beginPath(); x.moveTo(g.x - g.s, g.y); x.lineTo(g.x + g.s, g.y); x.stroke();
  }
  // Boats
  for (const b of LIFE.boats) {
    const tgt = MAPDATA.sites[b.to];
    const dx = tgt.x - b.x, dy = tgt.y - b.y, d = Math.hypot(dx, dy);
    if (d < 3) {
      const opts = [...MAPDATA.adj[b.to]].filter(j => MAPDATA.sites[j].kind === 'water');
      b.at = b.to; b.to = opts.length ? opts[Math.floor(Math.random() * opts.length)] : b.at;
    } else { b.x += dx / d * b.sp * dt; b.y += dy / d * b.sp * dt; }
    const dir = d > 0 ? Math.sign(dx) || 1 : 1;
    x.strokeStyle = 'rgba(230,240,240,0.35)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(b.x - dir * 4, b.y + 1.5); x.lineTo(b.x - dir * 16, b.y + 2.5); x.stroke();
    x.fillStyle = '#4a3420';
    x.beginPath(); x.moveTo(b.x - 5, b.y); x.lineTo(b.x + 5, b.y); x.lineTo(b.x + 3.5 * dir, b.y + 2.2); x.lineTo(b.x - 3.5 * dir, b.y + 2.2); x.fill();
    x.strokeStyle = '#3a2a18'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(b.x, b.y - 8); x.stroke();
    x.fillStyle = b.sail; x.beginPath(); x.moveTo(b.x + 0.4, b.y - 8); x.quadraticCurveTo(b.x + 5 * dir, b.y - 4, b.x + 0.4, b.y - 1); x.fill();
  }
  // Herds
  if (!GFX.low) for (const h of LIFE.herds) {
    if (!onScreen(h.cx, h.cy)) continue;
    for (const a of h.beasts) {
      if (Math.hypot(a.tx - a.x, a.ty - a.y) < 0.5 && Math.random() < dt * 0.4) { a.tx = h.cx + (Math.random() - 0.5) * 34; a.ty = h.cy + (Math.random() - 0.5) * 18; }
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d > 0.5) { a.x += dx / d * 2.2 * dt; a.y += dy / d * 2.2 * dt; }
      x.fillStyle = 'rgba(30,20,10,0.25)'; x.beginPath(); x.ellipse(a.x + 0.6, a.y + 1.1, 1.8, 0.6, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = a.col;
      if (h.kind === 'sheep') { x.beginPath(); x.ellipse(a.x, a.y, 1.5, 1.1, 0, 0, Math.PI * 2); x.fill(); }
      else {
        const f = dx >= 0 ? 1 : -1;
        x.beginPath(); x.ellipse(a.x, a.y, 2.1, 0.9, 0, 0, Math.PI * 2); x.fill();
        x.fillRect(a.x + f * 1.4, a.y - 1.9, 0.8 * f, 1.6);
        x.strokeStyle = a.col; x.lineWidth = 0.4; x.beginPath(); x.moveTo(a.x - 1.2, a.y); x.lineTo(a.x - 1.2, a.y + 1.4); x.moveTo(a.x + 1.2, a.y); x.lineTo(a.x + 1.2, a.y + 1.4); x.stroke();
      }
    }
  }
  // Weather: water over flooded fields, dust over a sandstorm
  if (G.weather && G.weather.flood && G.provinces[G.weather.flood]) {
    const path = new Path2D(provPath(G.weather.flood));
    x.save(); x.clip(path);
    x.fillStyle = `rgba(70, 140, 170, ${0.28 + 0.06 * Math.sin(t * 1.6)})`; x.fill(path);
    if (!GFX.low) { const p = G.provinces[G.weather.flood]; x.strokeStyle = 'rgba(220, 245, 255, 0.35)'; x.lineWidth = 1;
      for (let i = 0; i < 9; i++) { const yy = p.y - 30 + i * 8 + Math.sin(t + i) * 2; x.beginPath(); x.moveTo(p.x - 40 + ((t * 9 + i * 13) % 20), yy); x.lineTo(p.x - 22 + ((t * 9 + i * 13) % 20), yy); x.stroke(); } }
    x.restore();
  }
  if (G.weather && G.weather.storm && G.provinces[G.weather.storm]) {
    const p = G.provinces[G.weather.storm], path = new Path2D(provPath(p.id));
    x.save(); x.clip(path);
    x.fillStyle = `rgba(110, 72, 34, ${0.38 + 0.06 * Math.sin(t * 0.9)})`; x.fill(path);
    const n = GFX.low ? 8 : 26;
    for (let i = 0; i < n; i++) {
      const a = t * 0.5 + i * 2.4, r = 10 + (i * 17) % 60;
      const px = p.x + Math.cos(a) * r + ((t * 25 + i * 31) % 120) - 60, py = p.y + Math.sin(a * 1.3) * r * 0.5;
      x.fillStyle = `rgba(246, 222, 172, ${0.32 + 0.14 * Math.sin(t * 2 + i)})`;
      x.beginPath(); x.ellipse(px, py, 22 + (i % 5) * 5, 7 + (i % 3) * 3, 0.2, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  }
  // Caravans
  for (const cv of LIFE.caravans) drawCaravan(x, cv, dt, t);
  // Smoke and fire over besieged cities, cooking fires in siege camps, hearth smoke over great cities
  for (const p of Object.values(G.provinces)) {
    if (!onScreen(p.x, p.y, 120)) continue;
    if (p.siege) {
      if (Math.random() < dt * 5) puff(p.x + (Math.random() - 0.5) * 14, p.y - 6, { vy: -12, vx: -3, r: 2.5, g: 5, col: '90,82,74', a: 0.32, decay: 0.4 });
      for (let k = 0; k < 3; k++) {
        const fx = p.x + Math.sin(k * 2.3) * 9, fy = p.y - 2 + Math.cos(k * 1.7) * 4, f = 0.6 + 0.4 * Math.sin(t * 13 + k * 3);
        const g = x.createRadialGradient(fx, fy, 0, fx, fy, 5 * f + 2);
        g.addColorStop(0, 'rgba(255,220,120,0.9)'); g.addColorStop(0.5, 'rgba(255,120,30,0.55)'); g.addColorStop(1, 'rgba(255,80,20,0)');
        x.fillStyle = g; x.beginPath(); x.arc(fx, fy, 5 * f + 2, 0, Math.PI * 2); x.fill();
      }
      if (Math.random() < dt * 3) puff(p.x - 32 + Math.random() * 6, p.y + 6, { vy: -5, r: 1.5, g: 4, col: '200,190,170', a: 0.35 });
    } else if (p.pop >= 30 && Math.random() < dt * 0.8) puff(p.x + (Math.random() - 0.5) * 14, p.y - 8, { vy: -4, vx: -2, r: 1.5, g: 4, col: '215,205,190', a: 0.25, decay: 0.25 });
  }
  for (const q of LIFE.puffs) { q.x += q.vx * dt - 3 * dt; q.y += q.vy * dt; q.r += q.g * dt; q.life -= q.decay * dt; }
  LIFE.puffs = LIFE.puffs.filter(q => q.life > 0);
  for (const q of LIFE.puffs) { x.fillStyle = `rgba(${q.col},${q.a * q.life})`; x.beginPath(); x.arc(q.x, q.y, q.r, 0, Math.PI * 2); x.fill(); }
  // Marching armies
  for (const m of LIFE.marches) {
    const k = Math.min(1, (performance.now() - m.t0) / m.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const mx = m.ax + (m.bx - m.ax) * e, my = m.ay + (m.by - m.ay) * e - Math.sin(k * Math.PI) * 6;
    if (Math.random() < 0.6) puff(mx - Math.sign(m.bx - m.ax) * 6, my + 8, { vy: -3, r: 2, g: 6, col: '190,170,130', a: 0.4, decay: 0.9 });
    drawToken(x, mx, my, m.owner, m.n, m.general, t);
    if (k >= 1) m.done = true;
  }
  for (const m of LIFE.marches.filter(m => m.done)) m.resolve();
  LIFE.marches = LIFE.marches.filter(m => !m.done);
  // Clashes: a flash, sparks and dust where armies meet
  for (const cl of LIFE.clashes) {
    const k = (performance.now() - cl.t0) / cl.dur;
    if (k >= 1) { cl.done = true; continue; }
    const r = 10 + k * 46;
    x.strokeStyle = `rgba(255,214,140,${1 - k})`; x.lineWidth = 3 * (1 - k) + 0.5;
    x.beginPath(); x.arc(cl.x, cl.y, r, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + cl.seed, l = 6 + k * 30;
      x.strokeStyle = `rgba(255,${180 + (i % 3) * 25},90,${1 - k})`; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(cl.x + Math.cos(a) * l * 0.5, cl.y + Math.sin(a) * l * 0.5); x.lineTo(cl.x + Math.cos(a) * l, cl.y + Math.sin(a) * l); x.stroke();
    }
    if (Math.random() < 0.7) puff(cl.x + (Math.random() - 0.5) * 30, cl.y + (Math.random() - 0.5) * 16, { vy: -5, r: 4, g: 12, col: '170,150,120', a: 0.5, decay: 0.6 });
    // crossed sabres
    x.save(); x.translate(cl.x, cl.y - 26); const sc = 1 + Math.sin(k * Math.PI) * 0.4; x.scale(sc, sc);
    x.strokeStyle = `rgba(250,240,220,${1 - k * 0.8})`; x.lineWidth = 2.2; x.lineCap = 'round';
    x.beginPath(); x.moveTo(-8, 8); x.quadraticCurveTo(-2, 0, 8, -9); x.moveTo(8, 8); x.quadraticCurveTo(2, 0, -8, -9); x.stroke();
    x.restore();
  }
  for (const cl of LIFE.clashes.filter(c => c.done)) cl.resolve();
  LIFE.clashes = LIFE.clashes.filter(c => !c.done);
  // Birds
  x.strokeStyle = 'rgba(30,22,14,0.75)'; x.lineWidth = 0.9;
  if (!GFX.low) for (const b of LIFE.birds) {
    b.a += Math.sin(t * 0.3 + b.n) * 0.2 * dt;
    b.x += Math.cos(b.a) * b.sp * dt; b.y += Math.sin(b.a) * b.sp * dt;
    if (b.x < -50) b.x = MAP.W + 40; if (b.x > MAP.W + 50) b.x = -40; if (b.y < -50) b.y = MAP.H + 40; if (b.y > MAP.H + 50) b.y = -40;
    for (let i = 0; i < b.n; i++) {
      const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      const bx = b.x - Math.cos(b.a) * row * 7 + Math.cos(b.a + Math.PI / 2) * side * row * 5, by = b.y - Math.sin(b.a) * row * 7 + Math.sin(b.a + Math.PI / 2) * side * row * 5;
      const fl = Math.sin(t * 9 + i) * 1.6;
      x.beginPath(); x.moveTo(bx - 3, by - fl); x.quadraticCurveTo(bx - 1, by - 1, bx, by); x.quadraticCurveTo(bx + 1, by - 1, bx + 3, by - fl); x.stroke();
    }
  }
  // Clouds drift west to east, their shadows sliding over the land
  if (!GFX.low) for (const cl of LIFE.clouds) {
    cl.x += cl.sp * dt;
    if (cl.x > MAP.W + 200) { cl.x = -360 * cl.s; cl.y = Math.random() * MAP.H; }
    const w = 320 * cl.s, h = 200 * cl.s;
    x.globalAlpha = 0.16; x.drawImage(LIFE.shadowSprite, cl.x + 70, cl.y + 110, w, h);
    x.globalAlpha = 0.42; x.drawImage(LIFE.cloudSprite, cl.x, cl.y, w, h);
  }
  x.globalAlpha = 1;
}

function drawCaravan(x, cv, dt, t) {
  const a = cv.path[cv.seg], b = cv.path[cv.seg + 1];
  if (!b) { const start = MAPDATA.sites.findIndex(s => s.x === a.x && s.y === a.y); cv.path = cv.route(start >= 0 ? start : 0); cv.seg = 0; cv.d = 0; return; }
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  cv.d += cv.sp * dt;
  if (cv.d >= len) { cv.seg++; cv.d = 0; return; }
  const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, f = ux >= 0 ? 1 : -1;
  if (!onScreen(a.x + ux * cv.d, a.y + uy * cv.d)) return;
  for (let i = 0; i < cv.n; i++) {
    const d = cv.d - i * 10;
    const px = a.x + ux * d * 1, py = a.y + uy * d + 6;
    x.save(); x.translate(px, py); x.scale(1.5, 1.5);
    camelIcon(x, 0, 0, f, t * 6 + i * 1.3 + cv.ph, i === 0, i);
    x.restore();
  }
}

function camelIcon(x, px, py, f, ph, lead, i = 0) {
  x.fillStyle = 'rgba(30,20,10,0.28)'; x.beginPath(); x.ellipse(px + 0.8, py + 2.6, 3.4, 0.9, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#4a3220'; x.lineWidth = 0.55;
  const s1 = Math.sin(ph) * 0.9, s2 = Math.sin(ph + Math.PI) * 0.9;
  x.beginPath(); x.moveTo(px - 1.6, py); x.lineTo(px - 1.6 + s1, py + 2.6); x.moveTo(px + 1.6, py); x.lineTo(px + 1.6 + s2, py + 2.6); x.stroke();
  x.fillStyle = '#8a6440';
  x.beginPath(); x.ellipse(px, py - 0.3, 2.6, 1.2, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(px - 0.9 * f, py - 1.2, 0.9, Math.PI, 0); x.arc(px + 0.9 * f, py - 1.2, 0.8, Math.PI, 0); x.fill();
  x.strokeStyle = '#8a6440'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(px + 2.2 * f, py - 0.4); x.lineTo(px + 3.2 * f, py - 2.6); x.stroke();
  x.fillRect(px + (f > 0 ? 3 : -4.4), py - 3.1, 1.4, 0.8);
  // bales of silk, or the caravan master
  x.fillStyle = lead ? '#2f6fb3' : ['#b8402c', '#d8b45a', '#2a8f8a'][i % 3];
  x.fillRect(px - 1.4, py - 2.6, 2.6, 1.1);
}

function drawToken(x, px, py, owner, n, general, t) {
  const F = FACTIONS[owner], k = UI.k;
  x.save(); x.translate(px, py); x.scale(k, k);
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.ellipse(2, 10, 9, 2.8, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#3b2410'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(0, 10); x.lineTo(0, -24); x.stroke();
  const w = Math.sin(t * 8) * 1.5;
  x.fillStyle = F.color; x.strokeStyle = F.dark; x.lineWidth = 0.9;
  x.beginPath(); x.moveTo(0, -22); x.lineTo(16, -22 + w * 0.3); x.lineTo(16, -5 + w); x.lineTo(8, -8.5 + w * 0.5); x.lineTo(0, -5); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#1a1208'; x.strokeStyle = '#d8b45a'; x.lineWidth = 1;
  x.beginPath(); x.arc(15, 4, 5.6, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = '#f6dc94'; x.font = 'bold 7.5px Cinzel, Georgia, serif'; x.textAlign = 'center'; x.fillText(n, 15, 6.7);
  if (general) { x.fillStyle = '#ffd75a'; x.beginPath(); x.arc(0, -28, 2.6, 0, Math.PI * 2); x.fill(); }
  x.restore();
}

// ---------- Hooks: armies march and clash where the player can see ----------

// Your scouts only see rival armies moving near your own lands
function nearPlayer(pid) {
  const p = G.provinces[pid];
  return p.owner === G.player || p.adj.some(n => G.provinces[n].owner === G.player);
}

HOOKS.march = (a, from, to) => {
  if (!G || !LIFE.on || $('game').classList.contains('hidden')) return Promise.resolve();
  const mine = a.owner === G.player;
  const A = G.provinces[from], B = G.provinces[to];
  if (!mine && (!LIFE.showRivals || LIFE.skip || !(nearPlayer(from) || nearPlayer(to)) || !(provVisible(from) || provVisible(to)) || (!onScreen(A.x, A.y) && !onScreen(B.x, B.y)))) return Promise.resolve();
  return new Promise(resolve => {
    UI.hidden.add(a.id);
    renderArmies();
    LIFE.marches.push({ ax: A.x + 20 * UI.k, ay: A.y, bx: B.x + 20 * UI.k, by: B.y, owner: a.owner, n: a.units.length, general: !!a.general, t0: performance.now(), dur: mine ? 520 : 380,
      resolve: () => { UI.hidden.delete(a.id); renderArmies(); resolve(); } });
  });
};

HOOKS.clash = (pid, b) => {
  if (!G || !LIFE.on || $('game').classList.contains('hidden')) return Promise.resolve();
  const p = G.provinces[pid];
  const involved = b && (b.att.faction === G.player || b.def.faction === G.player);
  if (!involved && (!LIFE.showRivals || LIFE.skip || !nearPlayer(pid) || !provVisible(pid) || !onScreen(p.x, p.y))) return Promise.resolve();
  return new Promise(resolve => LIFE.clashes.push({ x: p.x, y: p.y, t0: performance.now(), dur: involved ? 900 : 600, seed: Math.random() * 6, resolve }));
};

function setRivalMoves(on) {
  LIFE.showRivals = on;
  try { localStorage.setItem('turan-rival-moves', on ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
}
