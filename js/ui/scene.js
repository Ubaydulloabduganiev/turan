'use strict';
// The title backdrop: Samarkand's Registan at sunset, with a Bactrian caravan crossing the dunes.

const scene = { c: document.getElementById('scene'), still: null, t: 0, last: 0, motes: [], birds: [], running: false };

function sceneSize() {
  const c = scene.c, dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr);
  scene.dpr = dpr; scene.W = innerWidth; scene.H = innerHeight;
  scene.still = paintStill();
  const rnd = mulberry32(5);
  scene.motes = Array.from({ length: 90 }, () => ({ x: rnd() * scene.W, y: scene.H * (0.3 + rnd() * 0.65), r: 0.6 + rnd() * 1.6, v: 4 + rnd() * 10, p: rnd() * 6 }));
  scene.t = Math.max(scene.t, (scene.W * 0.3 + 300) / 22); // the caravan is already in view
  scene.birds = Array.from({ length: 7 }, (_, i) => ({ x: -100 - i * 26 - rnd() * 30, y: scene.H * 0.22 + (i % 3) * 14 + rnd() * 10, p: rnd() * 6 }));
}

// Height of the near dune crest, where the caravan walks
function crest(x) { const W = scene.W, H = scene.H; return H * 0.835 - Math.sin(x / W * 3.1 + 0.6) * H * 0.035 - Math.sin(x / W * 7.3) * H * 0.012; }

function paintStill() {
  const W = scene.W, H = scene.H, dpr = scene.dpr;
  const c = document.createElement('canvas'); c.width = W * dpr; c.height = H * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const rnd = mulberry32(1370);
  // Sky
  const sky = x.createLinearGradient(0, 0, 0, H * 0.72);
  sky.addColorStop(0, '#120f2a'); sky.addColorStop(0.32, '#3b2348'); sky.addColorStop(0.58, '#a1474a'); sky.addColorStop(0.8, '#e88a45'); sky.addColorStop(1, '#f7c26a');
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,240,220,${0.15 + rnd() * 0.5})`; x.fillRect(rnd() * W, rnd() * H * 0.3, 1, 1); }
  // Sun and glow
  const sx = W * 0.63, sy = H * 0.63, sr = H * 0.085;
  const glow = x.createRadialGradient(sx, sy, sr * 0.5, sx, sy, H * 0.7);
  glow.addColorStop(0, 'rgba(255,214,140,0.75)'); glow.addColorStop(0.25, 'rgba(255,170,90,0.28)'); glow.addColorStop(1, 'rgba(255,140,80,0)');
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  const sun = x.createRadialGradient(sx, sy - sr * 0.3, 0, sx, sy, sr);
  sun.addColorStop(0, '#fffbe6'); sun.addColorStop(0.7, '#ffe09a'); sun.addColorStop(1, '#ffc46a');
  x.fillStyle = sun; x.beginPath(); x.arc(sx, sy, sr, 0, Math.PI * 2); x.fill();
  // Thin clouds across the sun
  x.fillStyle = 'rgba(140,60,70,0.35)';
  for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(W * (0.3 + rnd() * 0.6), H * (0.42 + rnd() * 0.18), W * (0.1 + rnd() * 0.15), H * 0.006 + rnd() * 3, 0, 0, Math.PI * 2); x.fill(); }
  // Distant ranges in haze
  const range = (base, amp, col, seed) => {
    const r = mulberry32(seed);
    const ph = [r() * 6, r() * 6, r() * 6];
    x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
    for (let px = 0; px <= W; px += 6) {
      const u = px / W;
      x.lineTo(px, base - amp * (0.55 * Math.abs(Math.sin(u * 5.3 + ph[0])) + 0.3 * Math.abs(Math.sin(u * 13 + ph[1])) + 0.15 * Math.sin(u * 37 + ph[2])));
    }
    x.lineTo(W, H); x.fill();
  };
  range(H * 0.66, H * 0.2, 'rgba(150,80,105,0.55)', 3);
  range(H * 0.68, H * 0.12, 'rgba(105,52,82,0.75)', 9);
  // The Registan
  const k = Math.min(W / 1500, H / 820), cx = W * 0.5, base = H * 0.735;
  x.fillStyle = '#5c2f3f'; x.fillRect(0, base - 4 * k, W, H);
  madrasa(x, cx - 470 * k, base, k, { domes: [], minH: 250 }, rnd);
  madrasa(x, cx, base, k, { domes: [[0, 1.25]], minH: 0, wide: true }, rnd);
  madrasa(x, cx + 470 * k, base, k, { domes: [[-120, 0.85], [120, 0.85]], minH: 250 }, rnd);
  // Dunes
  const dune = (y0, amp, f, ph, top, bottom) => {
    const g = x.createLinearGradient(0, y0 - amp, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom);
    x.fillStyle = g; x.beginPath(); x.moveTo(0, H);
    for (let px = 0; px <= W; px += 5) x.lineTo(px, y0 - Math.sin(px / W * f + ph) * amp - Math.sin(px / W * f * 2.3) * amp * 0.3);
    x.lineTo(W, H); x.fill();
  };
  dune(H * 0.78, H * 0.03, 4.2, 1.2, '#9a4f3c', '#4a2129');
  const g = x.createLinearGradient(0, H * 0.78, 0, H); g.addColorStop(0, '#6b2f2f'); g.addColorStop(1, '#1d0c14');
  x.fillStyle = g; x.beginPath(); x.moveTo(0, H);
  for (let px = 0; px <= W; px += 4) x.lineTo(px, crest(px));
  x.lineTo(W, H); x.fill();
  // rim light along the crest
  x.strokeStyle = 'rgba(255,190,120,0.55)'; x.lineWidth = 1.5; x.beginPath();
  for (let px = 0; px <= W; px += 4) (px ? x.lineTo(px, crest(px)) : x.moveTo(px, crest(px)));
  x.stroke();
  // Vignette
  const v = x.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,3,10,0.75)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  return c;
}

function madrasa(x, cx, base, k, o, rnd) {
  const body = (o.wide ? 380 : 320) * k, bh = 120 * k;
  const sil = x.createLinearGradient(0, base - 280 * k, 0, base);
  sil.addColorStop(0, '#3d2340'); sil.addColorStop(1, '#22122a');
  // Domes behind the façade
  for (const [dx, s] of o.domes) {
    const dw = 92 * k * s, dh = 100 * k * s, bx = cx + dx * k, by = base - bh - 40 * k * s;
    x.fillStyle = sil; x.fillRect(bx - dw * 0.42, by, dw * 0.84, 46 * k * s);
    const dg = x.createLinearGradient(bx - dw / 2, 0, bx + dw / 2, 0);
    dg.addColorStop(0, '#2f7c80'); dg.addColorStop(0.45, '#1f4d58'); dg.addColorStop(1, '#192a3a');
    x.fillStyle = dg; x.beginPath();
    x.moveTo(bx - dw / 2, by);
    x.bezierCurveTo(bx - dw * 0.62, by - dh * 0.55, bx - dw * 0.18, by - dh * 0.85, bx, by - dh);
    x.bezierCurveTo(bx + dw * 0.18, by - dh * 0.85, bx + dw * 0.62, by - dh * 0.55, bx + dw / 2, by);
    x.closePath(); x.fill();
    x.strokeStyle = 'rgba(160,230,220,0.25)'; x.lineWidth = Math.max(1, k * 1.5);
    for (let r = -3; r <= 3; r++) { x.beginPath(); x.moveTo(bx + r * dw * 0.13, by); x.quadraticCurveTo(bx + r * dw * 0.09, by - dh * 0.6, bx, by - dh); x.stroke(); }
    x.fillStyle = '#d9b45a'; x.fillRect(bx - 1.5 * k, by - dh - 14 * k, 3 * k, 14 * k);
  }
  // Façade and its great portal
  x.fillStyle = sil; x.fillRect(cx - body / 2, base - bh, body, bh);
  const pw = 140 * k, ph = 215 * k;
  x.fillRect(cx - pw / 2, base - ph, pw, ph);
  x.fillStyle = 'rgba(80,190,180,0.35)'; x.fillRect(cx - body / 2, base - bh, body, 4 * k); x.fillRect(cx - pw / 2, base - ph, pw, 6 * k);
  const aw = 84 * k, ah = 160 * k;
  const arch = x.createLinearGradient(0, base - ah, 0, base);
  arch.addColorStop(0, '#7a3a48'); arch.addColorStop(1, '#3b1a2a');
  x.fillStyle = arch; x.beginPath();
  x.moveTo(cx - aw / 2, base); x.lineTo(cx - aw / 2, base - ah * 0.62);
  x.quadraticCurveTo(cx - aw / 2, base - ah * 0.92, cx, base - ah);
  x.quadraticCurveTo(cx + aw / 2, base - ah * 0.92, cx + aw / 2, base - ah * 0.62);
  x.lineTo(cx + aw / 2, base); x.fill();
  x.fillStyle = 'rgba(255,200,120,0.85)'; x.fillRect(cx - 9 * k, base - 46 * k, 18 * k, 46 * k);
  // Two tiers of niches along the wings, a few lit by lamps
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) for (let tier = 0; tier < 2; tier++) {
    const nx = cx + side * (pw / 2 + 22 * k + i * 30 * k), ny = base - 20 * k - tier * 48 * k;
    if (Math.abs(nx - cx) > body / 2 - 14 * k) continue;
    const lit = rnd() < 0.3;
    x.fillStyle = lit ? 'rgba(255,196,110,0.8)' : 'rgba(110,55,70,0.8)';
    x.beginPath(); x.moveTo(nx - 7 * k, ny); x.lineTo(nx - 7 * k, ny - 20 * k); x.quadraticCurveTo(nx, ny - 32 * k, nx + 7 * k, ny - 20 * k); x.lineTo(nx + 7 * k, ny); x.fill();
  }
  // Corner minarets
  if (o.minH) for (const side of [-1, 1]) {
    const mx = cx + side * (body / 2 - 2 * k), mh = o.minH * k, mw = 20 * k;
    x.fillStyle = sil; x.beginPath(); x.moveTo(mx - mw / 2, base); x.lineTo(mx - mw * 0.38, base - mh); x.lineTo(mx + mw * 0.38, base - mh); x.lineTo(mx + mw / 2, base); x.fill();
    x.fillRect(mx - mw * 0.62, base - mh - 6 * k, mw * 1.24, 9 * k);
    x.beginPath(); x.arc(mx, base - mh - 6 * k, mw * 0.42, Math.PI, 0); x.fill();
    x.fillStyle = 'rgba(80,190,180,0.3)';
    for (let b = 1; b < 5; b++) x.fillRect(mx - mw * 0.42, base - mh * b / 5, mw * 0.84, 3 * k);
  }
}

function camel(x, cx, y, s, t, rider) {
  x.fillStyle = '#140910';
  x.strokeStyle = '#140910'; x.lineCap = 'round';
  // legs
  x.lineWidth = 3.2 * s;
  const legs = [[-15, 0], [-9, Math.PI], [11, Math.PI * 0.5], [17, Math.PI * 1.5]];
  for (const [lx, ph] of legs) {
    const a = Math.sin(t * 3.2 + ph) * 0.38;
    const kx = cx + lx * s + Math.sin(a) * 10 * s, ky = y - 12 * s;
    x.beginPath(); x.moveTo(cx + lx * s, y - 24 * s); x.lineTo(kx, ky); x.lineTo(kx + Math.sin(a) * 9 * s, y); x.stroke();
  }
  // body, two humps, neck and head
  x.beginPath(); x.ellipse(cx, y - 29 * s, 24 * s, 9.5 * s, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(cx - 9 * s, y - 36 * s, 7.5 * s, Math.PI, 0); x.arc(cx + 8 * s, y - 36 * s, 7 * s, Math.PI, 0); x.fill();
  x.lineWidth = 6 * s;
  x.beginPath(); x.moveTo(cx + 20 * s, y - 31 * s); x.quadraticCurveTo(cx + 30 * s, y - 34 * s, cx + 33 * s, y - 50 * s); x.stroke();
  x.beginPath(); x.ellipse(cx + 37 * s, y - 51 * s, 6 * s, 3.4 * s, 0.25, 0, Math.PI * 2); x.fill();
  x.lineWidth = 1.6 * s;
  x.beginPath(); x.moveTo(cx - 24 * s, y - 30 * s); x.quadraticCurveTo(cx - 29 * s, y - 24 * s, cx - 27 * s, y - 18 * s); x.stroke();
  if (rider) {
    x.beginPath(); x.ellipse(cx - 1 * s, y - 44 * s, 4 * s, 7 * s, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(cx - 1 * s, y - 54 * s, 3 * s, 0, Math.PI * 2); x.fill();
  } else {
    x.fillRect(cx - 6 * s, y - 46 * s, 12 * s, 9 * s);
  }
  // rim light from the sunset
  x.strokeStyle = 'rgba(255,170,100,0.5)'; x.lineWidth = 1;
  x.beginPath(); x.ellipse(cx, y - 29 * s, 24 * s, 9.5 * s, 0, Math.PI * 1.1, Math.PI * 1.6); x.stroke();
}

function walker(x, cx, y, s, t) {
  x.strokeStyle = '#140910'; x.fillStyle = '#140910'; x.lineCap = 'round';
  const a = Math.sin(t * 3.2) * 0.4;
  x.lineWidth = 2.6 * s;
  x.beginPath(); x.moveTo(cx, y - 16 * s); x.lineTo(cx + Math.sin(a) * 8 * s, y); x.moveTo(cx, y - 16 * s); x.lineTo(cx - Math.sin(a) * 8 * s, y); x.stroke();
  x.beginPath(); x.ellipse(cx, y - 24 * s, 4 * s, 9 * s, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(cx, y - 35 * s, 3.4 * s, 0, Math.PI * 2); x.fill();
  x.lineWidth = 1.4 * s; x.beginPath(); x.moveTo(cx + 6 * s, y - 40 * s); x.lineTo(cx + 9 * s, y); x.stroke();
}

function sceneFrame(now) {
  if (!scene.running) return;
  const dt = Math.min(0.05, (now - (scene.last || now)) / 1000);
  scene.last = now; scene.t += dt;
  const c = scene.c, x = c.getContext('2d'), W = scene.W, H = scene.H, s = Math.max(0.6, Math.min(1.2, H / 800));
  x.setTransform(scene.dpr, 0, 0, scene.dpr, 0, 0);
  x.drawImage(scene.still, 0, 0, W, H);
  // Birds
  x.strokeStyle = 'rgba(30,14,24,0.8)'; x.lineWidth = 1.3;
  for (const b of scene.birds) {
    b.x += dt * 34; if (b.x > W + 60) b.x = -80;
    const f = Math.sin(scene.t * 7 + b.p) * 3;
    x.beginPath(); x.moveTo(b.x - 6, b.y - f); x.quadraticCurveTo(b.x - 2, b.y - 2, b.x, b.y); x.quadraticCurveTo(b.x + 2, b.y - 2, b.x + 6, b.y - f); x.stroke();
  }
  // The caravan
  const span = W + 600, head = ((scene.t * 22) % span) - 300;
  walker(x, head + 50 * s, crest(head + 50 * s), s, scene.t);
  for (let i = 0; i < 6; i++) {
    const cx = head - i * 70 * s;
    camel(x, cx, crest(cx), s, scene.t + i * 0.7, i % 3 === 0);
    if (i < 5) { x.strokeStyle = 'rgba(20,9,16,0.7)'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx - 26 * s, crest(cx) - 30 * s); x.lineTo(cx - 70 * s + 37 * s, crest(cx - 70 * s) - 50 * s); x.stroke(); }
  }
  // Drifting dust lit by the sun
  for (const m of scene.motes) {
    m.x += m.v * dt; if (m.x > W + 10) m.x = -10;
    const a = 0.25 + 0.25 * Math.sin(scene.t * 1.5 + m.p);
    x.fillStyle = `rgba(255,214,150,${a})`;
    x.beginPath(); x.arc(m.x, m.y + Math.sin(scene.t + m.p) * 4, m.r, 0, Math.PI * 2); x.fill();
  }
  requestAnimationFrame(sceneFrame);
}

function sceneStart() {
  if (scene.running) return;
  scene.c.classList.remove('hidden');
  if (!scene.still || scene.W !== innerWidth || scene.H !== innerHeight) sceneSize();
  scene.running = true; scene.last = 0;
  requestAnimationFrame(sceneFrame);
}
function sceneStop() { scene.running = false; scene.c.classList.add('hidden'); }
window.addEventListener('resize', () => { if (scene.running) sceneSize(); });
