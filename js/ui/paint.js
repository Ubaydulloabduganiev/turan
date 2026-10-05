'use strict';
// Paints the campaign map once onto a large canvas: soft biomes, rivers, coasts, dunes,
// mountain ranges, oases and a warm finish. The SVG on top only carries borders, cities and armies.

const BIOME = {
  steppe: '#aaa46c', steppeN: '#8e9a5e', desert: '#d8bd85', oasis: '#9aa565', river: '#8f9f60', mountain: '#9a8b6d',
  barMountain: '#8c7c63', barDesert: '#dcc28d', water: '#1f4d6b',
};

function noiseCanvas(size, seed, cells) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  const rnd = mulberry32(seed);
  const octs = cells.map(n => { const g = new Float32Array((n + 1) * (n + 1)); for (let i = 0; i < g.length; i++) g[i] = rnd(); for (let i = 0; i <= n; i++) { g[i * (n + 1) + n] = g[i * (n + 1)]; g[n * (n + 1) + i] = g[i]; } return { n, g }; });
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let v = 0, amp = 0.5, tot = 0;
    for (const { n, g } of octs) {
      const fx = px / size * n, fy = py / size * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), w = n + 1;
      const a = g[iy * w + ix], b = g[iy * w + ix + 1], c2 = g[(iy + 1) * w + ix], e = g[(iy + 1) * w + ix + 1];
      v += (a + (b - a) * sx + (c2 - a) * sy + (a - b - c2 + e) * sx * sy) * amp; tot += amp; amp *= 0.55;
    }
    const k = Math.round(v / tot * 255), i = (py * size + px) * 4;
    d[i] = d[i + 1] = d[i + 2] = k; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

function cellPath(ctx, i) {
  const pts = MAPDATA.outlines[i];
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
  ctx.closePath();
}

function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function bbox(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1 };
}

function biomeOf(i) {
  const s = MAPDATA.sites[i];
  if (s.kind === 'water') return BIOME.water;
  if (s.kind === 'mountain') return BIOME.barMountain;
  if (s.kind === 'desert') return BIOME.barDesert;
  const t = PROVINCE_DATA[i][7];
  if (t === 'steppe') return PROVINCE_DATA[i][4] > 48.5 ? BIOME.steppeN : BIOME.steppe;
  return BIOME[t];
}

let TERRAIN_CV = null;
function getTerrain() {
  MAPDATA = MAPDATA || buildMap();
  if (!TERRAIN_CV) TERRAIN_CV = paintTerrain();
  return TERRAIN_CV;
}

function paintTerrain() {
  const S = (window.devicePixelRatio || 1) > 1.4 ? 2 : 1.5;
  const W = Math.round(MAP.W * S), H = Math.round(MAP.H * S);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.scale(S, S);
  const rnd = mulberry32(1370);
  const sites = MAPDATA.sites, N = sites.length;
  const isWater = i => sites[i].kind === 'water';
  const nearCity = (px, py, r) => sites.some(s => s.kind === 'province' && Math.hypot(s.x - px, s.y - py) < r);

  // 1. Biomes, softly blended. Water cells take the colour of the shore so blue does not bleed inland.
  for (let i = 0; i < N; i++) {
    x.beginPath(); cellPath(x, i);
    x.fillStyle = isWater(i) ? '#b9ad7a' : biomeOf(i);
    x.fill();
  }
  if ('filter' in x) {
    const t = document.createElement('canvas'); t.width = W; t.height = H;
    const tx = t.getContext('2d');
    tx.filter = `blur(${Math.round(16 * S)}px)`;
    tx.drawImage(c, 0, 0);
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(t, 0, 0); x.restore();
  }

  // 2. Texture from layered noise
  const fine = noiseCanvas(256, 7, [8, 16, 32, 64]);
  const broad = noiseCanvas(256, 11, [3, 6, 12]);
  x.save();
  x.globalCompositeOperation = 'overlay';
  x.globalAlpha = 0.5;
  x.drawImage(broad, 0, 0, MAP.W, MAP.H);
  x.globalAlpha = 0.28;
  const pat = x.createPattern(fine, 'repeat');
  x.fillStyle = pat;
  x.fillRect(0, 0, MAP.W, MAP.H);
  x.restore();

  // 3. Green, irrigated land around oasis towns
  for (let i = 0; i < N; i++) {
    const s = sites[i];
    if (s.kind !== 'province') continue;
    const t = PROVINCE_DATA[i][7], pop = PROVINCE_DATA[i][6];
    if (t !== 'oasis' && t !== 'river') continue;
    const r = 14 + pop * 0.7;
    const g = x.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
    g.addColorStop(0, 'rgba(78,112,46,0.55)'); g.addColorStop(0.6, 'rgba(92,120,52,0.28)'); g.addColorStop(1, 'rgba(92,120,52,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(s.x, s.y, r, 0, Math.PI * 2); x.fill();
  }

  // 4. Rivers with green banks and scattered trees
  const riverPts = RIVERS.map(r => ({ ...r, p: r.pts.map(([lon, lat]) => project(lon, lat)) }));
  const smooth = (p) => {
    x.beginPath(); x.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length - 1; i++) { const mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2; x.quadraticCurveTo(p[i].x, p[i].y, mx, my); }
    x.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  };
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (const r of riverPts) { smooth(r.p); x.strokeStyle = 'rgba(70,104,44,0.32)'; x.lineWidth = r.w * 7; x.stroke(); }
  for (const r of riverPts) {
    for (let k = 0; k < r.p.length - 1; k++) {
      const a = r.p[k], b = r.p[k + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = 0; d < len; d += 9) {
        if (rnd() < 0.45) continue;
        const f = d / len, side = rnd() < 0.5 ? -1 : 1, off = (r.w * 1.6 + rnd() * 7) * side;
        const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
        tree(x, a.x + (b.x - a.x) * f + nx * off, a.y + (b.y - a.y) * f + ny * off, 1.6 + rnd() * 1.4, rnd);
      }
    }
  }
  for (const r of riverPts) {
    const n = r.p.length;
    for (let k = 0; k < n - 1; k++) {
      const w = r.w * (0.45 + 0.55 * k / (n - 1));
      x.beginPath(); x.moveTo(r.p[k].x, r.p[k].y);
      const m = r.p[k + 1];
      x.lineTo(m.x, m.y);
      x.strokeStyle = '#2f6a88'; x.lineWidth = w + 1.2; x.stroke();
      x.strokeStyle = '#4f8fae'; x.lineWidth = w; x.stroke();
    }
    smooth(r.p); x.strokeStyle = 'rgba(160,205,220,0.35)'; x.lineWidth = r.w * 0.35; x.stroke();
  }

  // 5. Seas and lakes with shallows and surf
  x.save();
  x.beginPath();
  for (let i = 0; i < N; i++) if (isWater(i)) cellPath(x, i);
  x.clip();
  const sea = x.createLinearGradient(0, 0, MAP.W * 0.3, MAP.H);
  sea.addColorStop(0, '#1d4866'); sea.addColorStop(1, '#173c58');
  x.fillStyle = sea;
  x.fillRect(0, 0, MAP.W, MAP.H);
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.35; x.drawImage(broad, 0, 0, MAP.W, MAP.H);
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  const coast = new Path2D();
  for (const e of MAPDATA.edges) {
    if (isWater(e.a) === isWater(e.b)) continue;
    coast.moveTo(e.pts[0].x, e.pts[0].y);
    for (let k = 1; k < e.pts.length; k++) coast.lineTo(e.pts[k].x, e.pts[k].y);
  }
  for (const [w, col] of [[46, 'rgba(46,104,128,0.35)'], [26, 'rgba(70,138,152,0.45)'], [11, 'rgba(118,176,176,0.55)'], [4, 'rgba(178,212,196,0.6)']]) {
    x.strokeStyle = col; x.lineWidth = w; x.stroke(coast);
  }
  // little wave marks
  x.strokeStyle = 'rgba(210,230,235,0.16)'; x.lineWidth = 1;
  for (let i = 0; i < N; i++) {
    if (!isWater(i)) continue;
    const pts = MAPDATA.outlines[i], b = bbox(pts);
    for (let k = 0; k < 40; k++) {
      const px = b.x0 + rnd() * (b.x1 - b.x0), py = b.y0 + rnd() * (b.y1 - b.y0);
      if (!inPoly(pts, px, py)) continue;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 4, py - 3, px + 8, py); x.quadraticCurveTo(px + 12, py - 3, px + 16, py); x.stroke();
    }
  }
  x.restore();
  x.strokeStyle = 'rgba(240,232,205,0.75)'; x.lineWidth = 1.3; x.stroke(coast);
  x.strokeStyle = 'rgba(60,48,30,0.35)'; x.lineWidth = 0.8; x.stroke(coast);

  // 6. Dunes in the deserts
  for (let i = 0; i < N; i++) {
    const s = sites[i];
    const desert = s.kind === 'desert' || (s.kind === 'province' && PROVINCE_DATA[i][7] === 'desert');
    if (!desert) continue;
    const pts = MAPDATA.outlines[i], b = bbox(pts);
    for (let py = b.y0; py < b.y1; py += 13) for (let px = b.x0; px < b.x1; px += 22) {
      const qx = px + rnd() * 14, qy = py + rnd() * 8;
      if (!inPoly(pts, qx, qy) || nearCity(qx, qy, 18)) continue;
      const w = 9 + rnd() * 10;
      x.beginPath(); x.moveTo(qx - w, qy); x.quadraticCurveTo(qx, qy - w * 0.45, qx + w, qy);
      x.strokeStyle = 'rgba(247,226,170,0.55)'; x.lineWidth = 1.6; x.stroke();
      x.beginPath(); x.moveTo(qx - w * 0.2, qy - w * 0.22); x.quadraticCurveTo(qx + w * 0.4, qy - w * 0.1, qx + w, qy);
      x.strokeStyle = 'rgba(150,112,62,0.38)'; x.lineWidth = 1.2; x.stroke();
    }
  }

  // 7. Steppe grass and northern woods
  for (let i = 0; i < N; i++) {
    const s = sites[i];
    if (s.kind !== 'province' || PROVINCE_DATA[i][7] !== 'steppe') continue;
    const pts = MAPDATA.outlines[i], b = bbox(pts), north = PROVINCE_DATA[i][4] > 49.5;
    for (let k = 0; k < (b.x1 - b.x0) * (b.y1 - b.y0) / 260; k++) {
      const px = b.x0 + rnd() * (b.x1 - b.x0), py = b.y0 + rnd() * (b.y1 - b.y0);
      if (!inPoly(pts, px, py) || nearCity(px, py, 14)) continue;
      if (north && rnd() < 0.35) { tree(x, px, py, 1.8 + rnd() * 1.2, rnd, true); continue; }
      x.strokeStyle = rnd() < 0.5 ? 'rgba(92,98,46,0.45)' : 'rgba(196,186,120,0.5)';
      x.lineWidth = 0.9;
      x.beginPath(); x.moveTo(px - 2, py); x.lineTo(px - 0.5, py - 3.2); x.moveTo(px, py); x.lineTo(px + 0.4, py - 3.8); x.moveTo(px + 2, py); x.lineTo(px + 1, py - 3); x.stroke();
    }
  }

  // 8. Mountain ranges: lit and shaded peaks, snow on the high ones
  const peaks = [];
  for (let i = 0; i < N; i++) {
    const s = sites[i];
    const bar = s.kind === 'mountain', hill = s.kind === 'province' && PROVINCE_DATA[i][7] === 'mountain';
    if (!bar && !hill) continue;
    const pts = MAPDATA.outlines[i], b = bbox(pts), step = bar ? 15 : 24;
    for (let py = b.y0 + 6; py < b.y1; py += step * 0.7) for (let px = b.x0 + 6; px < b.x1; px += step) {
      const qx = px + (rnd() - 0.5) * step * 0.9, qy = py + (rnd() - 0.5) * step * 0.6;
      if (!inPoly(pts, qx, qy) || nearCity(qx, qy, bar ? 18 : 26)) continue;
      const size = bar ? 15 + rnd() * 16 : 9 + rnd() * 8;
      peaks.push({ x: qx, y: qy, size, snow: bar && size > 23 });
    }
  }
  peaks.sort((a, b) => a.y - b.y);
  for (const p of peaks) mountain(x, p, rnd);

  // 9. Warm finish and vignette
  x.save();
  x.globalCompositeOperation = 'soft-light';
  x.fillStyle = 'rgba(255,214,150,0.35)';
  x.fillRect(0, 0, MAP.W, MAP.H);
  x.globalCompositeOperation = 'source-over';
  const v = x.createRadialGradient(MAP.W / 2, MAP.H / 2, MAP.H * 0.35, MAP.W / 2, MAP.H / 2, MAP.W * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,12,4,0.55)');
  x.fillStyle = v;
  x.fillRect(0, 0, MAP.W, MAP.H);
  x.restore();
  return c;
}

function tree(x, px, py, r, rnd, conifer) {
  x.fillStyle = 'rgba(30,24,10,0.25)';
  x.beginPath(); x.ellipse(px + r * 0.6, py + r * 0.4, r, r * 0.5, 0, 0, Math.PI * 2); x.fill();
  if (conifer) {
    x.fillStyle = '#3d5530';
    x.beginPath(); x.moveTo(px, py - r * 2.4); x.lineTo(px + r, py + r * 0.4); x.lineTo(px - r, py + r * 0.4); x.fill();
    return;
  }
  x.fillStyle = rnd() < 0.5 ? '#4b6b34' : '#56763a';
  x.beginPath(); x.arc(px, py - r * 0.4, r, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(160,190,100,0.35)';
  x.beginPath(); x.arc(px - r * 0.35, py - r * 0.8, r * 0.45, 0, Math.PI * 2); x.fill();
}

function mountain(x, p, rnd) {
  const w = p.size, h = p.size * (0.7 + rnd() * 0.25), bx = p.x, by = p.y + h * 0.4;
  const tx = bx + (rnd() - 0.5) * w * 0.2, ty = by - h;
  // shadow on the ground
  x.fillStyle = 'rgba(40,28,14,0.22)';
  x.beginPath(); x.ellipse(bx + w * 0.25, by, w * 0.7, w * 0.16, 0, 0, Math.PI * 2); x.fill();
  // lit western face
  x.fillStyle = '#b9a98a';
  x.beginPath(); x.moveTo(bx - w / 2, by); x.lineTo(tx, ty); x.lineTo(tx + w * 0.06, by); x.closePath(); x.fill();
  // shaded eastern face
  x.fillStyle = '#6f624d';
  x.beginPath(); x.moveTo(tx, ty); x.lineTo(bx + w / 2, by); x.lineTo(tx + w * 0.06, by); x.closePath(); x.fill();
  // ridges
  x.strokeStyle = 'rgba(60,48,32,0.45)'; x.lineWidth = 0.7;
  x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx - w * 0.12, by - h * 0.35); x.moveTo(tx + w * 0.02, ty + h * 0.2); x.lineTo(tx + w * 0.2, by - h * 0.15); x.stroke();
  if (p.snow) {
    x.fillStyle = '#f2efe6';
    x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx - w * 0.16, ty + h * 0.28); x.lineTo(tx - w * 0.04, ty + h * 0.22); x.lineTo(tx + w * 0.04, ty + h * 0.3); x.lineTo(tx + w * 0.14, ty + h * 0.24); x.closePath(); x.fill();
    x.fillStyle = 'rgba(150,160,180,0.55)';
    x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx + w * 0.14, ty + h * 0.24); x.lineTo(tx + w * 0.04, ty + h * 0.3); x.closePath(); x.fill();
  }
  x.strokeStyle = 'rgba(40,30,18,0.5)'; x.lineWidth = 0.6;
  x.beginPath(); x.moveTo(bx - w / 2, by); x.lineTo(tx, ty); x.lineTo(bx + w / 2, by); x.stroke();
}
