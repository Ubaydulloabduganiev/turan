'use strict';
// Cinematic scenes: a painted, moving picture that fills the screen for the great moments of a reign —
// a royal wedding, the birth of a child, the fall of a great city, a coronation, the discovery of a
// special place. Portraits stand in the scene; some scenes end with a choice.

const CINE = { el: null, raf: 0, parts: [], spec: null, t: 0, last: 0 };

function cineEl() {
  if (CINE.el) return CINE.el;
  const d = document.createElement('div');
  d.id = 'cinema';
  d.className = 'hidden';
  d.innerHTML = '<canvas id="cine-cv"></canvas><div class="cine-vignette"></div><div class="cine-people"></div>' +
    '<div class="cine-text"><div class="cine-kicker"></div><h2 class="cine-title"></h2><p class="cine-body"></p><p class="cine-note"></p><div class="cine-choices choices story"></div><button class="cine-go big"></button></div>';
  document.body.appendChild(d);
  CINE.el = d;
  return d;
}

// ---------- Drawing helpers ----------

let cSeed = 1;
const cRnd = () => (cSeed = (cSeed * 16807) % 2147483647) / 2147483647;
function vgrad(x, y0, y1, stops) { const g = x.createLinearGradient(0, y0, 0, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
function glow(x, cx, cy, r, col, a = 1) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalAlpha = a; x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.globalAlpha = 1;
}
function sky(x, W, H, stops) { x.fillStyle = vgrad(x, 0, H, stops); x.fillRect(0, 0, W, H); }
function skyStars(x, W, H, t, n = 140, maxY = 0.55) {
  cSeed = 7;
  x.fillStyle = '#fff6dc';
  for (let i = 0; i < n; i++) {
    const px = cRnd() * W, py = cRnd() * H * maxY, s = cRnd() * 1.6 + 0.4;
    x.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.6 + cRnd()) + i));
    x.fillRect(px, py, s, s);
  }
  x.globalAlpha = 1;
}
function moon(x, cx, cy, r) { glow(x, cx, cy, r * 5, 'rgba(255,240,200,0.35)'); x.fillStyle = '#fff3d0'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
function sun(x, cx, cy, r, col) { glow(x, cx, cy, r * 6, col, 0.6); x.fillStyle = '#fff2c8'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
// A mountain ridge from sums of sines, filled to the bottom of the screen
function ridge(x, W, H, base, amp, seed, col, snow) {
  const pts = [];
  for (let px = -10; px <= W + 10; px += 8) {
    const k = px / W;
    const y = base - amp * (0.55 * Math.abs(Math.sin(k * 5.1 + seed)) + 0.3 * Math.abs(Math.sin(k * 13.7 + seed * 2.3)) + 0.15 * Math.sin(k * 31 + seed * 5));
    pts.push([px, y]);
  }
  x.beginPath(); x.moveTo(-10, H);
  for (const [px, y] of pts) x.lineTo(px, y);
  x.lineTo(W + 10, H); x.closePath(); x.fillStyle = col; x.fill();
  if (snow) {
    x.save(); x.clip();
    x.beginPath(); x.moveTo(-10, base);
    for (const [px, y] of pts) x.lineTo(px, y);
    const line = base - amp * 0.62;
    for (let i = pts.length - 1; i >= 0; i--) x.lineTo(pts[i][0], Math.max(pts[i][1], line + Math.sin(i * 1.7) * amp * 0.04));
    x.closePath(); x.fillStyle = snow; x.fill(); x.restore();
  }
}
// Falling or rising things: petals, embers, snow, sparkles
function spawn(n, f) { for (let i = 0; i < n; i++) CINE.parts.push(f()); }
function stepParts(x, dt, W, H, draw) {
  for (const p of CINE.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.r = (p.r || 0) + (p.vr || 0) * dt; p.life = (p.life || 0) + dt; }
  CINE.parts = CINE.parts.filter(p => p.y > -60 && p.y < H + 60 && p.x > -60 && p.x < W + 60 && (!p.max || p.life < p.max));
  for (const p of CINE.parts) draw(p);
}
function birds(x, W, H, t, n, y0, col) {
  x.strokeStyle = col; x.lineWidth = 1.6;
  for (let i = 0; i < n; i++) {
    const px = ((t * 30 + i * 137) % (W + 200)) - 100, py = y0 + Math.sin(i * 2.1 + t * 0.7) * 20 + i * 9, f = Math.sin(t * 8 + i) * 4;
    x.beginPath(); x.moveTo(px - 8, py - f); x.quadraticCurveTo(px - 3, py - 3, px, py); x.quadraticCurveTo(px + 3, py - 3, px + 8, py - f); x.stroke();
  }
}
// A rider on a galloping horse, facing right, drawn around its hooves
function rider(x, px, py, s, t, col, banner, bare) {
  const g = Math.sin(t * 14);
  x.save(); x.translate(px, py); x.scale(s, s);
  x.fillStyle = '#140c08'; x.strokeStyle = '#140c08'; x.lineWidth = 2.4; x.lineCap = 'round';
  // legs
  for (const [lx, ph] of [[-12, 0], [-7, 2], [8, 1], [13, 3]]) { x.beginPath(); x.moveTo(lx, -14); x.lineTo(lx + Math.sin(t * 14 + ph) * 5, 0); x.stroke(); }
  x.beginPath(); x.ellipse(0, -18, 17, 7, -0.05 * g, 0, 7); x.fill();
  x.beginPath(); x.moveTo(13, -21); x.lineTo(22, -31); x.lineTo(26, -28); x.lineTo(17, -16); x.fill(); // neck and head
  x.beginPath(); x.moveTo(-17, -19); x.quadraticCurveTo(-26, -16 + g * 3, -24, -8); x.stroke(); // tail
  if (bare) { x.beginPath(); x.moveTo(16, -27); x.quadraticCurveTo(8, -34 + g * 2, 2, -26); x.stroke(); x.restore(); return; } // a loose horse, mane flying
  x.beginPath(); x.ellipse(0, -30, 5, 8, 0, 0, 7); x.fill(); x.beginPath(); x.arc(1, -41, 4, 0, 7); x.fill(); // rider
  if (banner) {
    x.lineWidth = 1.6; x.beginPath(); x.moveTo(-3, -24); x.lineTo(-1, -66); x.stroke();
    x.fillStyle = banner; x.beginPath(); x.moveTo(-1, -66);
    for (let i = 0; i <= 6; i++) x.lineTo(-1 - i * 4, -66 + Math.sin(t * 6 + i) * 2);
    for (let i = 6; i >= 0; i--) x.lineTo(-1 - i * 4, -54 + Math.sin(t * 6 + i) * 2);
    x.fill();
  } else { x.lineWidth = 1.4; x.beginPath(); x.moveTo(-6, -30); x.lineTo(30, -46); x.stroke(); }
  x.restore();
}
function cineWalker(x, px, py, s, t, col) {
  x.save(); x.translate(px, py); x.scale(s, s); x.fillStyle = col; x.strokeStyle = col; x.lineWidth = 2.2; x.lineCap = 'round';
  for (const ph of [0, Math.PI]) { x.beginPath(); x.moveTo(0, -12); x.lineTo(Math.sin(t * 4 + ph) * 4, 0); x.stroke(); }
  x.beginPath(); x.ellipse(0, -20, 4.5, 9, 0, 0, 7); x.fill(); x.beginPath(); x.arc(0, -32, 3.6, 0, 7); x.fill();
  x.restore();
}
function cineCamel(x, px, py, s, t, col) {
  x.save(); x.translate(px, py); x.scale(s, s); x.fillStyle = col; x.strokeStyle = col; x.lineWidth = 2.4; x.lineCap = 'round';
  for (const [lx, ph] of [[-9, 0], [-5, 2], [7, 1], [11, 3]]) { x.beginPath(); x.moveTo(lx, -16); x.lineTo(lx + Math.sin(t * 3 + ph) * 3, 0); x.stroke(); }
  x.beginPath(); x.ellipse(0, -20, 14, 6, 0, 0, 7); x.fill();
  x.beginPath(); x.ellipse(-4, -26, 6, 6, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(6, -26, 5, 5, 0, 0, 7); x.fill();
  x.beginPath(); x.moveTo(12, -20); x.quadraticCurveTo(20, -24, 19, -34); x.lineTo(24, -33); x.stroke();
  x.restore();
}
// A domed building of the Timurid kind
function domeBuilding(x, cx, base, w, col, domeCol, tile) {
  const h = w * 0.55;
  x.fillStyle = col; x.fillRect(cx - w / 2, base - h, w, h);
  x.fillStyle = domeCol;
  x.beginPath(); x.moveTo(cx - w * 0.34, base - h); x.bezierCurveTo(cx - w * 0.4, base - h - w * 0.5, cx - w * 0.05, base - h - w * 0.62, cx, base - h - w * 0.7);
  x.bezierCurveTo(cx + w * 0.05, base - h - w * 0.62, cx + w * 0.4, base - h - w * 0.5, cx + w * 0.34, base - h); x.fill();
  if (tile) { x.strokeStyle = tile; x.lineWidth = 1; for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(cx + i * w * 0.08, base - h); x.quadraticCurveTo(cx + i * w * 0.05, base - h - w * 0.4, cx, base - h - w * 0.7); x.stroke(); } }
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.beginPath(); x.moveTo(cx - w * 0.14, base); x.lineTo(cx - w * 0.14, base - h * 0.55); x.quadraticCurveTo(cx, base - h * 0.85, cx + w * 0.14, base - h * 0.55); x.lineTo(cx + w * 0.14, base); x.fill();
}
function minaret(x, cx, base, h, w, col) {
  x.fillStyle = col; x.beginPath(); x.moveTo(cx - w / 2, base); x.lineTo(cx - w * 0.38, base - h); x.lineTo(cx + w * 0.38, base - h); x.lineTo(cx + w / 2, base); x.fill();
  x.fillRect(cx - w * 0.6, base - h - 4, w * 1.2, 5);
  x.beginPath(); x.moveTo(cx - w * 0.38, base - h - 4); x.quadraticCurveTo(cx, base - h - w * 1.6, cx + w * 0.38, base - h - 4); x.fill();
}
function skyline(x, W, base, col, seed) {
  cSeed = seed; x.fillStyle = col;
  for (let px = 0; px < W; px += 40 + cRnd() * 60) {
    const k = cRnd();
    if (k < 0.25) minaret(x, px, base, 60 + cRnd() * 50, 9, col);
    else if (k < 0.55) domeBuilding(x, px, base, 40 + cRnd() * 50, col, col);
    else { x.fillStyle = col; x.fillRect(px - 20, base - 18 - cRnd() * 20, 50, 40); }
  }
}
function flag(x, px, top, bottom, t, col, dark, dir = 1) {
  x.strokeStyle = '#2a1a0a'; x.lineWidth = 3; x.beginPath(); x.moveTo(px, bottom); x.lineTo(px, top); x.stroke();
  x.fillStyle = '#e8c15c'; x.beginPath(); x.arc(px, top - 3, 4, 0, 7); x.fill();
  const w = 70, h = 90;
  x.fillStyle = col; x.strokeStyle = dark; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(px, top + 4);
  for (let i = 0; i <= 10; i++) x.lineTo(px + (i / 10) * w * dir, top + 4 + Math.sin(t * 3 + i * 0.7) * 5 * (i / 10));
  for (let i = 10; i >= 0; i--) x.lineTo(px + (i / 10) * w * dir, top + 4 + h - (i / 10) * 18 + Math.sin(t * 3 + i * 0.7) * 5 * (i / 10));
  x.closePath(); x.fill(); x.stroke();
}

// ---------- The scenes ----------

// Geometry of the great portal, shared by the drawing and the portraits standing in it
function portalGeo(W, H) {
  const pw = Math.max(Math.min(W * 0.94, 380), Math.min(W * 0.48, 760)), ph = H * 0.7, top = H * 0.07;
  const iw = pw * 0.66, spring = top + ph * 0.36, apex = top + ph * 0.16, bottom = top + ph;
  return { cx: W / 2, pw, ph, top, iw, spring, apex, bottom };
}
function pointedArch(x, cx, w, spring, apex, bottom) {
  x.beginPath(); x.moveTo(cx - w / 2, bottom); x.lineTo(cx - w / 2, spring);
  x.quadraticCurveTo(cx - w / 2, apex + (spring - apex) * 0.15, cx, apex);
  x.quadraticCurveTo(cx + w / 2, apex + (spring - apex) * 0.15, cx + w / 2, spring);
  x.lineTo(cx + w / 2, bottom); x.closePath();
}
function starTile(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r * 0.5 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath(); x.fill();
}
function drawPortal(x, W, H, t, inner) {
  const g = portalGeo(W, H), { cx, pw, ph, top, iw, spring, apex, bottom } = g;
  // flanking towers
  for (const sx of [-1, 1]) {
    const tx = cx + sx * (pw / 2 + 4);
    x.fillStyle = '#163f60'; x.fillRect(tx - 12, top - 30, 24, ph + 30);
    x.fillStyle = '#2a7a8a'; x.beginPath(); x.moveTo(tx - 15, top - 30); x.quadraticCurveTo(tx, top - 62, tx + 15, top - 30); x.fill();
    for (let y = top; y < bottom; y += 18) { x.fillStyle = (y / 18) % 2 ? '#d8b45a' : '#3aa0a8'; x.fillRect(tx - 12, y, 24, 3); }
  }
  // tiled face
  x.fillStyle = '#1b4f78'; x.fillRect(cx - pw / 2, top, pw, ph);
  x.save(); x.beginPath(); x.rect(cx - pw / 2, top, pw, ph); x.clip();
  for (let y = top + 12, r = 0; y < bottom; y += 26, r++) for (let px = cx - pw / 2 + (r % 2 ? 13 : 0); px < cx + pw / 2 + 13; px += 26) {
    x.fillStyle = 'rgba(232,217,168,0.32)'; starTile(x, px, y, 7);
    x.fillStyle = 'rgba(58,192,200,0.5)'; x.beginPath(); x.arc(px + 13, y + 13, 2, 0, 7); x.fill();
  }
  x.restore();
  // calligraphy band
  x.fillStyle = '#0e2e4a'; x.fillRect(cx - pw / 2 + 10, top + 10, pw - 20, ph * 0.08);
  x.strokeStyle = '#f2ead6'; x.lineWidth = 2;
  for (let px = cx - pw / 2 + 24; px < cx + pw / 2 - 24; px += 18) { x.beginPath(); x.moveTo(px, top + 10 + ph * 0.065); x.lineTo(px, top + 16); x.quadraticCurveTo(px + 6, top + 10 + ph * 0.04, px + 12, top + 10 + ph * 0.06); x.stroke(); }
  x.strokeStyle = '#d8b45a'; x.lineWidth = 3; x.strokeRect(cx - pw / 2 + 4, top + 4, pw - 8, ph - 4);
  // the arch: lit from within
  pointedArch(x, cx, iw + 26, spring, apex - 16, bottom);
  x.fillStyle = '#d8b45a'; x.fill();
  pointedArch(x, cx, iw + 14, spring, apex - 8, bottom);
  x.fillStyle = '#2f9aa6'; x.fill();
  pointedArch(x, cx, iw, spring, apex, bottom);
  const rg = x.createRadialGradient(cx, bottom - ph * 0.3, 10, cx, bottom - ph * 0.3, ph * 0.7);
  for (const [o, c] of inner) rg.addColorStop(o, c);
  x.fillStyle = rg; x.fill();
  // muqarnas: little niches under the apex
  x.save(); pointedArch(x, cx, iw, spring, apex, bottom); x.clip();
  for (let row = 0; row < 3; row++) for (let i = -4; i <= 4; i++) {
    const nx = cx + i * iw / 9 + (row % 2) * iw / 18, ny = apex + 6 + row * 16;
    x.strokeStyle = 'rgba(255,220,150,0.28)'; x.lineWidth = 1; x.beginPath(); x.moveTo(nx - 8, ny + 12); x.quadraticCurveTo(nx, ny - 4, nx + 8, ny + 12); x.stroke();
  }
  x.restore();
  return g;
}
function lanterns(x, W, H, t) {
  const cols = ['#ffcc66', '#ff8a5a', '#9af0e0', '#ff6a8a'];
  for (let s = 0; s < 3; s++) {
    const y0 = H * 0.03 + s * 26, sag = 50 + s * 10;
    x.strokeStyle = 'rgba(40,24,10,0.9)'; x.lineWidth = 1.2; x.beginPath();
    for (let i = 0; i <= 40; i++) { const k = i / 40; x.lineTo(k * W, y0 + Math.sin(k * Math.PI) * sag); }
    x.stroke();
    for (let i = 1; i < 14; i++) {
      const k = i / 14, lx = k * W + Math.sin(t * 1.2 + i + s) * 3, ly = y0 + Math.sin(k * Math.PI) * sag + 12;
      const c = cols[(i + s) % cols.length];
      glow(x, lx, ly + 6, 22, c, 0.45 + 0.15 * Math.sin(t * 3 + i));
      x.strokeStyle = '#2a1808'; x.beginPath(); x.moveTo(lx, ly - 12); x.lineTo(lx, ly); x.stroke();
      x.fillStyle = c; x.beginPath(); x.ellipse(lx, ly + 6, 5, 8, 0, 0, 7); x.fill();
      x.fillStyle = '#5a3a14'; x.fillRect(lx - 4, ly - 1, 8, 2); x.fillRect(lx - 3, ly + 13, 6, 2);
    }
  }
}
function torch(x, px, py, t, s = 1) {
  x.strokeStyle = '#3a2410'; x.lineWidth = 4 * s; x.beginPath(); x.moveTo(px, py + 70 * s); x.lineTo(px, py); x.stroke();
  const f = 0.8 + 0.2 * Math.sin(t * 17 + px) + 0.1 * Math.sin(t * 29);
  glow(x, px, py - 10 * s, 70 * s * f, 'rgba(255,170,60,0.6)');
  x.fillStyle = '#ffcf5a'; x.beginPath(); x.moveTo(px - 7 * s, py); x.quadraticCurveTo(px, py - 34 * s * f, px + 7 * s, py); x.fill();
  x.fillStyle = '#fff4c0'; x.beginPath(); x.moveTo(px - 3 * s, py); x.quadraticCurveTo(px, py - 16 * s * f, px + 3 * s, py); x.fill();
}
function carpet(x, W, H, top, w) {
  const cx = W / 2;
  x.fillStyle = '#7a1420'; x.beginPath(); x.moveTo(cx - w / 2, top); x.lineTo(cx + w / 2, top); x.lineTo(cx + w * 1.1, H); x.lineTo(cx - w * 1.1, H); x.closePath(); x.fill();
  x.strokeStyle = '#d8b45a'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(cx - w / 2 + 8, top + 4); x.lineTo(cx + w / 2 - 8, top + 4); x.lineTo(cx + w * 1.1 - 16, H); x.moveTo(cx - w / 2 + 8, top + 4); x.lineTo(cx - w * 1.1 + 16, H); x.stroke();
  x.fillStyle = '#c8a040'; for (let i = 0; i < 5; i++) { const y = top + (H - top) * (0.15 + i * 0.18); starTile(x, cx, y, 6 + i * 3); }
}

const SCENE_DRAW = {
  wedding(x, W, H, t, dt, sc) {
    sky(x, W, H, [[0, '#070a22'], [0.55, '#2a1840'], [0.8, '#6a2a3a'], [1, '#a8553a']]);
    skyStars(x, W, H, t); moon(x, W * 0.86, H * 0.14, 16);
    skyline(x, W, H * 0.8, '#160c22', 11);
    x.fillStyle = vgrad(x, H * 0.78, H, [[0, '#2a1810'], [1, '#120a06']]); x.fillRect(0, H * 0.78, W, H * 0.22);
    const g = drawPortal(x, W, H, t, [[0, '#ffe2a0'], [0.45, '#c86a2a'], [1, '#3a1406']]);
    carpet(x, W, H, g.bottom, g.iw * 0.7);
    torch(x, g.cx - g.pw / 2 - 40, g.bottom - g.ph * 0.4, t); torch(x, g.cx + g.pw / 2 + 40, g.bottom - g.ph * 0.4, t);
    flag(x, W * 0.05, H * 0.2, H * 0.92, t, FACTIONS[sc.m.gF].color, FACTIONS[sc.m.gF].dark);
    flag(x, W * 0.95, H * 0.2, H * 0.92, t, FACTIONS[sc.m.bF].color, FACTIONS[sc.m.bF].dark, -1);
    // musicians: karnay trumpets rise and fall, a drummer beats the doira
    for (const [mx, dir] of [[W * 0.14, 1], [W * 0.2, 1], [W * 0.8, -1], [W * 0.86, -1]]) {
      const by = H * 0.9;
      x.fillStyle = '#0c0604'; x.beginPath(); x.ellipse(mx, by - 26, 11, 24, 0, 0, 7); x.fill(); x.beginPath(); x.arc(mx, by - 56, 8, 0, 7); x.fill();
      if (mx < W / 2 || mx > W * 0.84) {
        const a = -0.9 - 0.25 * Math.sin(t * 2 + mx);
        x.strokeStyle = '#d8b45a'; x.lineWidth = 3; x.beginPath(); x.moveTo(mx + dir * 4, by - 56); x.lineTo(mx + dir * Math.cos(a) * 130, by - 56 + Math.sin(a) * 130); x.stroke();
        x.fillStyle = '#d8b45a'; x.beginPath(); x.arc(mx + dir * Math.cos(a) * 132, by - 56 + Math.sin(a) * 132, 7, 0, 7); x.fill();
      } else {
        const bob = Math.abs(Math.sin(t * 6)) * 6;
        x.strokeStyle = '#c9a060'; x.lineWidth = 3; x.beginPath(); x.ellipse(mx - 18, by - 48 - bob, 14, 14, 0, 0, 7); x.stroke();
      }
    }
    lanterns(x, W, H, t);
    // rose petals
    if (CINE.parts.length < 170) spawn(2, () => ({ x: Math.random() * W, y: -20, vx: -10 + Math.random() * 20, vy: 30 + Math.random() * 40, vr: -2 + Math.random() * 4, r: Math.random() * 6, c: ['#ff9ab0', '#ffd0dc', '#e8405a', '#fff2f2'][Math.floor(Math.random() * 4)] }));
    stepParts(x, dt, W, H, p => { x.save(); x.translate(p.x + Math.sin(p.life * 2) * 10, p.y); x.rotate(p.r); x.fillStyle = p.c; x.beginPath(); x.ellipse(0, 0, 5, 3, 0, 0, 7); x.fill(); x.restore(); });
  },
  birth(x, W, H, t, dt) {
    x.fillStyle = vgrad(x, 0, H, [[0, '#2a140a'], [0.7, '#4a2412'], [1, '#1a0c06']]); x.fillRect(0, 0, W, H);
    // window with the night outside
    const wx = W * 0.14, wy = H * 0.14, ww = Math.min(170, W * 0.16), wh = H * 0.42;
    x.save(); pointedArch(x, wx, ww, wy + wh * 0.3, wy, wy + wh); x.clip();
    x.fillStyle = vgrad(x, wy, wy + wh, [[0, '#0a1030'], [1, '#2a2a5a']]); x.fillRect(wx - ww, wy, ww * 2, wh); skyStars(x, W, H * 0.6, t, 60, 0.9); moon(x, wx + 20, wy + wh * 0.35, 12);
    x.restore(); pointedArch(x, wx, ww, wy + wh * 0.3, wy, wy + wh); x.strokeStyle = '#c9a060'; x.lineWidth = 6; x.stroke();
    // a suzani embroidery on the wall
    const sx = W * 0.5, sy = H * 0.24, sw = Math.min(W * 0.5, 620), sh = H * 0.34;
    x.fillStyle = '#efe0c0'; x.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
    x.strokeStyle = '#8a1a22'; x.lineWidth = 6; x.strokeRect(sx - sw / 2 + 8, sy - sh / 2 + 8, sw - 16, sh - 16);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
      const mx = sx - sw / 2 + sw * (0.12 + i * 0.19), my = sy - sh / 2 + sh * (0.3 + j * 0.42), r = Math.min(sw, sh * 2) * 0.06;
      x.fillStyle = (i + j) % 2 ? '#b0202a' : '#d8501a'; x.beginPath(); x.arc(mx, my, r, 0, 7); x.fill();
      x.fillStyle = '#1a3a5a'; x.beginPath(); x.arc(mx, my, r * 0.45, 0, 7); x.fill();
      x.strokeStyle = '#3a6a3a'; x.lineWidth = 2; for (let a = 0; a < 8; a++) { x.beginPath(); x.moveTo(mx + Math.cos(a) * r, my + Math.sin(a) * r); x.lineTo(mx + Math.cos(a) * r * 1.5, my + Math.sin(a) * r * 1.5); x.stroke(); }
    }
    // floor and carpet
    x.fillStyle = '#5a1a14'; x.fillRect(0, H * 0.72, W, H * 0.28);
    x.strokeStyle = '#c9a060'; x.lineWidth = 3; x.strokeRect(W * 0.1, H * 0.76, W * 0.8, H * 0.3);
    // oil lamps
    for (let i = 0; i < 3; i++) {
      const lx = W * (0.3 + i * 0.2) + Math.sin(t * 1.1 + i) * 6, ly = H * 0.05 + 40;
      x.strokeStyle = '#2a1808'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(W * (0.3 + i * 0.2), 0); x.lineTo(lx, ly); x.stroke();
      glow(x, lx, ly + 10, 90, 'rgba(255,190,90,0.55)'); x.fillStyle = '#c9a060'; x.beginPath(); x.ellipse(lx, ly + 8, 12, 6, 0, 0, 7); x.fill();
    }
    // the cradle (beshik), rocking
    const cx = W / 2, cy = H * 0.6, s = Math.min(W, H) / 900;
    x.save(); x.translate(cx, cy); x.rotate(Math.sin(t * 1.6) * 0.06); x.scale(s, s);
    x.strokeStyle = '#6a3a14'; x.lineWidth = 10; x.lineCap = 'round';
    x.beginPath(); x.arc(0, -200, 170, 0.3 * Math.PI, 0.7 * Math.PI); x.stroke(); // rocker
    x.fillStyle = '#8a4a1a'; x.fillRect(-110, -110, 220, 70);
    x.fillStyle = '#b0202a'; for (let i = 0; i < 6; i++) x.fillRect(-100 + i * 36, -104, 20, 58);
    x.fillStyle = '#e8c15c'; for (let i = 0; i < 6; i++) starTile(x, -90 + i * 36, -75, 7);
    x.strokeStyle = '#6a3a14'; x.lineWidth = 9; x.beginPath(); x.moveTo(-100, -110); x.quadraticCurveTo(0, -260, 100, -110); x.stroke(); // handle
    x.fillStyle = '#f2e6c8'; x.beginPath(); x.ellipse(0, -112, 90, 18, 0, Math.PI, 0); x.fill(); // blanket
    x.restore();
    if (CINE.parts.length < 80) spawn(1, () => ({ x: cx + (Math.random() - 0.5) * 200, y: cy - 60, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30, max: 4 }));
    stepParts(x, dt, W, H, p => { x.globalAlpha = Math.max(0, 1 - p.life / 4); glow(x, p.x, p.y, 8, '#ffe8a0'); x.globalAlpha = 1; });
  },
  conquest(x, W, H, t, dt, sc) {
    sky(x, W, H, [[0, '#140a10'], [0.5, '#5a1a12'], [0.85, '#d0642a'], [1, '#f0a050']]);
    sun(x, W * 0.7, H * 0.66, 30, 'rgba(255,140,60,0.6)');
    ridge(x, W, H, H * 0.62, H * 0.12, 1.3, '#3a1a14');
    // the city behind its walls
    skyline(x, W, H * 0.52, '#1a0c0a', 23);
    const wy = H * 0.52, wh = H * 0.2;
    x.fillStyle = vgrad(x, wy, wy + wh, [[0, '#3a2418'], [1, '#1a0e08']]); x.fillRect(0, wy, W, wh);
    x.fillStyle = '#3a2418'; for (let px = 0; px < W; px += 22) x.fillRect(px, wy - 10, 12, 10);
    for (let px = W * 0.06; px < W; px += W * 0.16) { x.fillStyle = '#2e1c12'; x.fillRect(px - 22, wy - 40, 44, wh + 40); for (let k = 0; k < 4; k++) x.fillRect(px - 22 + k * 13, wy - 50, 8, 10); }
    // the open gate, burning within
    const gx = W / 2, gw = Math.min(110, W * 0.12);
    x.fillStyle = '#2a1a10'; x.fillRect(gx - gw, wy - 60, gw * 2, wh + 60);
    pointedArch(x, gx, gw, wy + 10, wy - 30, wy + wh); const fg = x.createLinearGradient(0, wy - 30, 0, wy + wh); fg.addColorStop(0, '#ffcf6a'); fg.addColorStop(1, '#a8301a'); x.fillStyle = fg; x.fill();
    glow(x, gx, wy + wh * 0.4, 160, 'rgba(255,150,60,0.5)');
    // smoke and embers
    if (CINE.parts.length < 160) {
      spawn(1, () => ({ k: 'smoke', x: W * (0.1 + Math.random() * 0.8), y: wy - 20, vx: 8 + Math.random() * 10, vy: -20 - Math.random() * 20, s: 20 + Math.random() * 30 }));
      spawn(2, () => ({ k: 'ember', x: W * Math.random(), y: wy + Math.random() * 40, vx: (Math.random() - 0.3) * 30, vy: -40 - Math.random() * 60, max: 3 }));
    }
    stepParts(x, dt, W, H, p => {
      if (p.k === 'smoke') { p.s += dt * 14; x.globalAlpha = Math.max(0, 0.35 - p.life * 0.035); x.fillStyle = '#2a2020'; x.beginPath(); x.arc(p.x, p.y, p.s, 0, 7); x.fill(); x.globalAlpha = 1; }
      else { x.globalAlpha = Math.max(0, 1 - p.life / 3); x.fillStyle = '#ffb040'; x.fillRect(p.x, p.y, 2.5, 2.5); x.globalAlpha = 1; }
    });
    // ground and the army streaming in
    x.fillStyle = vgrad(x, wy + wh, H, [[0, '#2a1a10'], [1, '#0a0604']]); x.fillRect(0, wy + wh, W, H - wy - wh);
    const col = FACTIONS[G.player].color;
    for (let i = 0; i < 14; i++) {
      const k = ((t * 0.06 + i / 14) % 1), px = -120 + k * (gx + 80), py = wy + wh + 6 + (1 - k) * H * 0.07;
      rider(x, px, py, 0.9 + (1 - k) * 0.9, t + i, col, i % 2 === 0 ? col : null);
    }
  },
  coronation(x, W, H, t, dt) {
    const f = G.player, F = FACTIONS[f];
    x.fillStyle = vgrad(x, 0, H, [[0, '#0a1020'], [0.6, '#1c2a48'], [1, '#0a0a14']]); x.fillRect(0, 0, W, H);
    const cx = W / 2, hy = H * 0.62;
    // halo behind the throne
    x.save(); x.translate(cx, H * 0.36); x.rotate(t * 0.05);
    for (let i = 0; i < 24; i++) { x.rotate(Math.PI / 12); x.fillStyle = i % 2 ? 'rgba(255,215,120,0.12)' : 'rgba(255,215,120,0.05)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(-30, -H); x.lineTo(30, -H); x.fill(); }
    x.restore(); glow(x, cx, H * 0.36, H * 0.4, 'rgba(255,210,120,0.45)');
    // columns receding
    for (let i = 0; i < 4; i++) {
      const s = 1 - i * 0.2, off = W * (0.44 - i * 0.08);
      for (const sx of [-1, 1]) {
        const px = cx + sx * off, top = H * (0.06 + i * 0.07), bot = hy + (H - hy) * (1 - i * 0.25);
        x.fillStyle = `rgb(${40 - i * 6},${54 - i * 8},${86 - i * 10})`; x.fillRect(px - 16 * s, top, 32 * s, bot - top);
        x.fillStyle = '#d8b45a'; x.fillRect(px - 20 * s, top, 40 * s, 6 * s); x.fillRect(px - 20 * s, bot - 6 * s, 40 * s, 6 * s);
        // hanging banners
        x.fillStyle = F.color; x.beginPath(); const bx = px - sx * 50 * s, by = top + 20;
        x.moveTo(bx - 18 * s, by); x.lineTo(bx + 18 * s, by); x.lineTo(bx + 18 * s + Math.sin(t * 1.5 + i) * 3, by + 140 * s); x.lineTo(bx, by + 120 * s); x.lineTo(bx - 18 * s + Math.sin(t * 1.5 + i) * 3, by + 140 * s); x.fill();
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(bx - 18 * s, by, 36 * s, 8 * s);
      }
    }
    // the dais and throne
    x.fillStyle = '#3a2410'; x.fillRect(cx - 160, hy - 30, 320, 30); x.fillStyle = '#d8b45a'; x.fillRect(cx - 160, hy - 34, 320, 5);
    // the throne: a tall arched back of gold and red velvet, behind the ruler
    const tw = Math.min(W * 0.3, 330);
    pointedArch(x, cx, tw, H * 0.2, H * 0.06, hy - 40);
    const tg = x.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0); tg.addColorStop(0, '#7a5a14'); tg.addColorStop(0.5, '#f0cf6a'); tg.addColorStop(1, '#7a5a14');
    x.fillStyle = tg; x.fill();
    pointedArch(x, cx, tw - 26, H * 0.21, H * 0.085, hy - 50); x.fillStyle = '#6a1018'; x.fill();
    x.fillStyle = 'rgba(240,200,110,0.35)'; for (let i = 0; i < 18; i++) starTile(x, cx + ((i % 3) - 1) * (tw / 4), H * 0.2 + Math.floor(i / 3) * (hy - H * 0.26) / 6, 6);
    x.fillStyle = '#c9a040'; x.fillRect(cx - tw / 2 - 30, hy - 96, 34, 60); x.fillRect(cx + tw / 2 - 4, hy - 96, 34, 60); // armrests
    x.fillStyle = '#f0cf6a'; x.beginPath(); x.arc(cx - tw / 2 - 13, hy - 98, 14, 0, 7); x.arc(cx + tw / 2 + 13, hy - 98, 14, 0, 7); x.fill();
    x.fillStyle = '#9a1a22'; x.beginPath(); x.ellipse(cx, hy - 46, tw * 0.55, 18, 0, 0, 7); x.fill(); // cushion
    carpet(x, W, H, hy, 140);
    // amirs kneeling along the carpet
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
      const k = i / 4, px = cx + sx * (170 + i * 70 + k * 40), py = hy + 30 + i * (H - hy) * 0.22, s = 0.9 + i * 0.35;
      const bow = Math.max(0, Math.sin(t * 1.2 + i * 0.6)) * 0.5;
      x.save(); x.translate(px, py); x.scale(s, s); x.fillStyle = '#0a0606';
      x.beginPath(); x.ellipse(0, -14, 16, 14, 0, 0, 7); x.fill();
      x.save(); x.rotate(-sx * bow); x.beginPath(); x.ellipse(0, -34, 9, 16, 0, 0, 7); x.fill(); x.beginPath(); x.arc(0, -54, 8, 0, 7); x.fill(); x.fillStyle = '#e8e0d0'; x.beginPath(); x.ellipse(0, -59, 9, 5, 0, 0, 7); x.fill(); x.restore();
      x.restore();
    }
    if (CINE.parts.length < 90) spawn(1, () => ({ x: Math.random() * W, y: H * Math.random(), vx: 4, vy: -8 - Math.random() * 10, max: 6 }));
    stepParts(x, dt, W, H, p => { x.globalAlpha = Math.sin(Math.min(Math.PI, p.life / 6 * Math.PI)) * 0.8; x.fillStyle = '#ffe2a0'; x.fillRect(p.x, p.y, 2, 2); x.globalAlpha = 1; });
  },
  place(x, W, Hs, t, dt, sc) {
    // The picture is painted in the upper part of the screen; the words sit below it
    const L = LANDMARKS[sc.id], k = L.kind, H = Hs * 0.74;
    x.fillStyle = '#0a0806'; x.fillRect(0, 0, W, Hs);
    const pal = {
      ruins: [['#1a1030', '#7a3a3a', '#e89a5a'], '#4a2a20', '#2a160e'], shrine: [['#2a3a6a', '#c88a9a', '#f6d0a0'], '#4a5a6a', '#3a3020'],
      pass: [['#3a6a9a', '#9ac0d8', '#e8eef0'], '#5a6a7a', '#4a4030'], mine: [['#05060f', '#141a30', '#2a2a40'], '#1a1a28', '#141018'],
      horses: [['#5a8ac0', '#a8d0e8', '#f0f0d8'], '#6a8a9a', '#5a7a2a'], lake: [['#3a7ab0', '#9ad0e8', '#e8f4f8'], '#6a8aa8', '#3a5a2a'],
      caravanserai: [['#4a5a7a', '#9aa8bc', '#d8dce4'], '#7a8494', '#c8ccd4'], cliff: [['#4a7ab0', '#c0d0d8', '#f0d8b0'], '#8a6a5a', '#6a4a30'],
      river: [['#3a2a5a', '#d06a4a', '#f8c070'], '#5a3a4a', '#3a4a1a'], kurgan: [['#2a1a3a', '#b0503a', '#f0b060'], '#5a3a30', '#5a4a1a'],
    }[k];
    sky(x, W, H, [[0, pal[0][0]], [0.6, pal[0][1]], [1, pal[0][2]]]);
    if (k === 'mine') { skyStars(x, W, H, t); moon(x, W * 0.2, H * 0.15, 12); } else sun(x, W * 0.72, H * (k === 'river' || k === 'kurgan' || k === 'ruins' ? 0.55 : 0.2), 24, k === 'river' || k === 'kurgan' || k === 'ruins' ? 'rgba(255,150,80,0.6)' : 'rgba(255,250,220,0.5)');
    const snow = k === 'pass' || k === 'lake' || k === 'caravanserai' || k === 'horses' ? '#eef2f6' : null;
    ridge(x, W, H, H * 0.6, H * 0.28, 2.1, pal[1], snow);
    ridge(x, W, H, H * 0.7, H * 0.14, 4.7, pal[1] + 'cc');
    const gy = H * 0.72;
    x.fillStyle = vgrad(x, gy, Hs, [[0, pal[2]], [0.6, '#1a1208'], [1, '#0a0806']]); x.fillRect(0, gy, W, Hs - gy);
    const ink = '#140c08';
    if (k === 'ruins') {
      x.fillStyle = '#5a3a26'; x.beginPath(); x.moveTo(W * 0.15, gy + 10); x.quadraticCurveTo(W * 0.5, gy - H * 0.22, W * 0.85, gy + 10); x.fill();
      x.fillStyle = '#3a2418';
      cSeed = 3; for (let i = 0; i < 9; i++) { const px = W * (0.24 + i * 0.065), h = 30 + cRnd() * 70, top = gy - H * 0.12 - h; x.beginPath(); x.moveTo(px, gy - H * 0.08); x.lineTo(px, top); for (let j = 0; j < 4; j++) x.lineTo(px + j * 9, top + cRnd() * 20); x.lineTo(px + 34, gy - H * 0.08); x.fill(); }
      x.fillStyle = '#4a2c1c'; x.fillRect(W * 0.5 - 50, gy - H * 0.3, 22, H * 0.2); x.fillRect(W * 0.5 + 28, gy - H * 0.27, 22, H * 0.17);
      x.beginPath(); x.arc(W * 0.5, gy - H * 0.3, 39, Math.PI, Math.PI * 1.55); x.lineWidth = 16; x.strokeStyle = '#4a2c1c'; x.stroke();
      birds(x, W, H, t, 6, H * 0.25, ink);
    } else if (k === 'shrine') {
      const sw = Math.min(W * 0.22, 230);
      domeBuilding(x, W * 0.5, gy, sw, '#8a5e36', '#9a6a3e', null);
      x.fillStyle = 'rgba(40,20,8,0.35)'; // brick laid like basketwork
      for (let r = 0; r < 9; r++) for (let c = 0; c < 12; c++) if ((r + c) % 2) x.fillRect(W * 0.5 - sw / 2 + c * sw / 12 + 1, gy - sw * 0.55 + r * sw * 0.055 + 1, sw / 12 - 2, sw * 0.055 - 2);
      glow(x, W * 0.5, gy - sw * 0.8, sw, 'rgba(255,220,160,0.25)');
      for (let i = 0; i < 6; i++) cineWalker(x, ((t * 18 + i * 120) % (W * 0.4)) + W * 0.05, gy + 40 + (i % 2) * 18, 1.4, t + i, ink);
      birds(x, W, H, t, 4, H * 0.2, '#2a2a3a');
    } else if (k === 'pass') {
      x.fillStyle = '#3a3a44';
      x.beginPath(); x.moveTo(0, 0); x.lineTo(W * 0.42, H * 0.2); x.lineTo(W * 0.44, gy); x.lineTo(W * 0.4, H); x.lineTo(0, H); x.fill();
      x.beginPath(); x.moveTo(W, 0); x.lineTo(W * 0.58, H * 0.18); x.lineTo(W * 0.56, gy); x.lineTo(W * 0.6, H); x.lineTo(W, H); x.fill();
      x.fillStyle = '#26262e'; x.fillRect(W * 0.44, gy - 70, 18, 70); x.fillRect(W * 0.54, gy - 70, 18, 70);
      x.fillStyle = '#4a4a54'; x.fillRect(W * 0.455, gy - 56, W * 0.09, 56); x.strokeStyle = '#8a8a94'; x.lineWidth = 2; for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(W * 0.455 + i * W * 0.015, gy - 56); x.lineTo(W * 0.455 + i * W * 0.015, gy); x.stroke(); }
      for (let i = 0; i < 5; i++) cineCamel(x, W * 0.47 + ((t * 10 + i * 28) % (W * 0.07)), H * 0.82 + i * 8, 0.6 + i * 0.12, t + i, ink);
    } else if (k === 'mine') {
      x.fillStyle = '#1e1a24'; x.beginPath(); x.moveTo(W * 0.1, gy + 10); x.lineTo(W * 0.5, H * 0.15); x.lineTo(W * 0.9, gy + 10); x.fill();
      const mx = W * 0.5, my = gy - 10;
      x.fillStyle = '#ff9a3a'; x.beginPath(); x.ellipse(mx, my, 70, 90, 0, Math.PI, 0); x.fill(); glow(x, mx, my - 40, 200, 'rgba(255,150,60,0.45)');
      torch(x, mx - 110, my - 60, t, 0.8); torch(x, mx + 110, my - 60, t, 0.8);
      for (let i = 0; i < 2; i++) {
        const px = mx - 30 + i * 60, a = Math.sin(t * 4 + i * 2);
        cineWalker(x, px, my, 1.6, 0, ink);
        x.strokeStyle = ink; x.lineWidth = 3; x.beginPath(); x.moveTo(px, my - 46); x.lineTo(px + (i ? -1 : 1) * (20 + a * 8), my - 66 + a * 16); x.stroke();
      }
      cSeed = 9; for (let i = 0; i < 26; i++) { const px = mx + (cRnd() - 0.5) * W * 0.5, py = gy + 10 + cRnd() * H * 0.2; x.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)); x.fillStyle = L.gem || '#4ac0c0'; starTile(x, px, py, 4 + cRnd() * 3); x.globalAlpha = 1; }
    } else if (k === 'horses') {
      x.strokeStyle = '#7a9a3a'; x.lineWidth = 1.5;
      cSeed = 5; for (let i = 0; i < 160; i++) { const px = cRnd() * W, py = gy + cRnd() * (H - gy); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.sin(t * 2 + px * 0.01) * 5, py - 8 - cRnd() * 8); x.stroke(); }
      for (let i = 0; i < 8; i++) rider(x, ((t * 90 + i * 170) % (W + 300)) - 150, gy + 60 + (i % 3) * 40, 1 + (i % 3) * 0.3, t + i * 0.7, '#3a2010', null, true);
    } else if (k === 'lake') {
      x.fillStyle = vgrad(x, gy - 20, H, [[0, '#4ab0c8'], [1, '#1a5a7a']]); x.fillRect(0, gy - 20, W, H * 0.2);
      x.globalAlpha = 0.11; skyline(x, W, gy + H * 0.12, '#0a2a3a', 31); x.globalAlpha = 1; // the drowned city under the water
      x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1.5;
      for (let i = 0; i < 30; i++) { const py = gy - 10 + i * 6, px = ((i * 97 + t * 20) % W); x.beginPath(); x.moveTo(px, py); x.lineTo(px + 40, py); x.stroke(); }
      const bx = W * 0.3 + Math.sin(t * 0.2) * 40, by = gy + 20; x.fillStyle = ink; x.beginPath(); x.moveTo(bx - 30, by); x.lineTo(bx + 30, by); x.lineTo(bx + 20, by + 10); x.lineTo(bx - 20, by + 10); x.fill(); cineWalker(x, bx, by, 0.8, 0, ink);
    } else if (k === 'caravanserai') {
      const cx = W * 0.5, w = Math.min(W * 0.4, 420);
      x.fillStyle = '#6a6460'; x.fillRect(cx - w / 2, gy - w * 0.32, w, w * 0.32);
      x.fillStyle = '#7a746e'; x.beginPath(); x.ellipse(cx, gy - w * 0.32, w * 0.16, w * 0.14, 0, Math.PI, 0); x.fill();
      x.fillStyle = '#2a2420'; pointedArch(x, cx, w * 0.12, gy - w * 0.16, gy - w * 0.24, gy); x.fill();
      for (const sx of [-1, 1]) { x.fillStyle = '#5a5450'; x.fillRect(cx + sx * w / 2 - 14, gy - w * 0.38, 28, w * 0.38); }
      x.fillStyle = '#f4f6f8'; x.fillRect(cx - w / 2, gy - w * 0.33, w, 6);
      for (let i = 0; i < 4; i++) cineCamel(x, ((t * 14 + i * 50) % (W * 0.5)), gy + 50 + i * 6, 1.1, t + i, ink);
      if (CINE.parts.length < 220) spawn(3, () => ({ x: Math.random() * W, y: -10, vx: -15 + Math.random() * 10, vy: 30 + Math.random() * 30 }));
      stepParts(x, dt, W, H, p => { x.fillStyle = '#ffffff'; x.globalAlpha = 0.8; x.fillRect(p.x, p.y, 2.5, 2.5); x.globalAlpha = 1; });
    } else if (k === 'cliff') {
      x.fillStyle = '#9a5a3a'; x.fillRect(0, H * 0.18, W, gy - H * 0.18);
      x.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 20; i++) x.fillRect(i * W / 20, H * 0.18, 3, gy - H * 0.18);
      for (const [nx, nh] of [[0.3, 0.46], [0.7, 0.36]]) {
        const cx = W * nx, top = gy - H * nh, w = H * nh * 0.32;
        x.fillStyle = '#3a1a10'; pointedArch(x, cx, w, top + w * 0.5, top, gy); x.fill();
        x.fillStyle = '#b07a5a'; x.beginPath(); x.ellipse(cx, top + w * 0.55, w * 0.15, w * 0.18, 0, 0, 7); x.fill();
        x.beginPath(); x.moveTo(cx - w * 0.3, gy); x.lineTo(cx - w * 0.22, top + w * 0.75); x.quadraticCurveTo(cx, top + w * 0.6, cx + w * 0.22, top + w * 0.75); x.lineTo(cx + w * 0.3, gy); x.fill();
      }
      cSeed = 12; x.fillStyle = '#2a1208'; for (let i = 0; i < 40; i++) { const px = cRnd() * W, py = H * 0.22 + cRnd() * (gy - H * 0.28); if (Math.abs(px - W * 0.3) > H * 0.1 && Math.abs(px - W * 0.7) > H * 0.08) x.fillRect(px, py, 9, 12); }
      for (let i = 0; i < 4; i++) cineWalker(x, W * 0.45 + i * 22, gy + 30, 0.9, t + i, ink);
    } else if (k === 'river') {
      x.fillStyle = vgrad(x, gy, H, [[0, '#d0884a'], [1, '#4a3a4a']]); x.beginPath(); x.moveTo(0, gy + 30); x.quadraticCurveTo(W * 0.5, gy - 10, W, gy + 20); x.lineTo(W, H * 0.92); x.quadraticCurveTo(W * 0.5, H * 0.84, 0, H * 0.95); x.fill();
      x.strokeStyle = 'rgba(255,230,180,0.45)'; for (let i = 0; i < 24; i++) { const px = (i * 131 + t * 25) % W, py = gy + 30 + (i % 8) * 18; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 30, py); x.stroke(); }
      for (let i = 0; i < 2; i++) { const bx = ((t * 15 + i * W * 0.5) % (W + 200)) - 100, by = gy + 50 + i * 40; x.fillStyle = ink; x.beginPath(); x.moveTo(bx - 40, by); x.lineTo(bx + 40, by); x.lineTo(bx + 28, by + 12); x.lineTo(bx - 28, by + 12); x.fill(); x.beginPath(); x.moveTo(bx, by); x.lineTo(bx, by - 70); x.lineTo(bx + 34, by - 10); x.fill(); }
      const jp = (t % 3) / 3; if (jp < 0.4) { const fx = W * 0.6, fy = gy + 70; x.fillStyle = '#c0c8d0'; x.beginPath(); x.ellipse(fx + jp * 100, fy - Math.sin(jp / 0.4 * Math.PI) * 50, 14, 5, -0.5 + jp * 2.5, 0, 7); x.fill(); }
      x.strokeStyle = '#2a3a10'; x.lineWidth = 2; cSeed = 4; for (let i = 0; i < 60; i++) { const px = cRnd() * W, py = H * 0.9 + cRnd() * H * 0.1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.sin(t + i) * 4, py - 30 - cRnd() * 20); x.stroke(); }
    } else if (k === 'kurgan') {
      for (const [mx, mw, mh] of [[0.25, 0.22, 0.1], [0.55, 0.3, 0.14], [0.82, 0.18, 0.07]]) { x.fillStyle = '#6a5a2a'; x.beginPath(); x.ellipse(W * mx, gy + 6, W * mw / 2, H * mh, 0, Math.PI, 0); x.fill(); }
      for (const bx of [0.4, 0.7]) { x.fillStyle = '#4a4440'; x.fillRect(W * bx - 8, gy - 50, 16, 56); x.beginPath(); x.arc(W * bx, gy - 52, 9, 0, 7); x.fill(); }
      const ex = W * 0.5 + Math.cos(t * 0.4) * W * 0.25, ey = H * 0.25 + Math.sin(t * 0.4) * 30, f = Math.sin(t * 3) * 6;
      x.strokeStyle = ink; x.lineWidth = 3; x.beginPath(); x.moveTo(ex - 24, ey - f); x.quadraticCurveTo(ex - 8, ey - 6, ex, ey); x.quadraticCurveTo(ex + 8, ey - 6, ex + 24, ey - f); x.stroke();
      x.strokeStyle = '#8a7a2a'; x.lineWidth = 1.4; cSeed = 6; for (let i = 0; i < 120; i++) { const px = cRnd() * W, py = gy + 10 + cRnd() * (H - gy); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.sin(t * 1.5 + px * 0.02) * 6, py - 10); x.stroke(); }
    }
  },
};

// ---------- Texts and people for each scene ----------

function weddingCost() { return Math.round(220 * (1 + provsOf(G.player).length / 12)); }

const SCENE_SPEC = {
  wedding(sc) {
    const m = sc.m, father = G.factions[m.bF] ? G.factions[m.bF].leader : '';
    const st = G.factions[G.player], other = m.gF === G.player ? m.bF : m.gF, c = weddingCost();
    return {
      layout: 'arch', kicker: dateText() + ' · ' + t('A royal wedding'),
      title: t('The wedding of {groom} and {bride}', { groom: pn(m.groom), bride: pn(m.bride) }),
      text: t('{groom} takes {bride}, daughter of {father}, as his wife. Kettle-drums thunder, the long karnay trumpets sound, and two houses become one family: {nation} and {nation2}.', { groom: pn(m.groom), bride: pn(m.bride), father: pn(father), nation: fName(m.gF), nation2: fName(m.bF) }),
      people: [{ who: m.groom, faction: m.gF, label: fName(m.gF) }, { who: m.bride, faction: m.bF, label: fName(m.bF) }],
      options: [
        { label: t('A wedding feast of forty days (−{n} gold)', { n: c }), hint: t('All your cities celebrate, and the bride’s family is honoured.'), disabled: st.gold < c,
          act: () => { st.gold -= c; st.orderBonus = Math.max(st.orderBonus, 10); st.orderBonusT = Math.max(st.orderBonusT, 4); if (other !== 'rebels') rel(G.player, other).att = Math.min(100, rel(G.player, other).att + 15); return t('For forty days the city feasts in gardens hung with silk. Wrestlers, acrobats and poets compete for the newlyweds’ favour.'); } },
        { label: t('A modest ceremony'), hint: t('Nothing changes.'), act: () => t('The vows are spoken before the qadi, and the couple begin their life together.') },
      ],
    };
  },
  birth(sc) {
    const m = sc.m, p = personBy(sc.child);
    return {
      layout: 'pair', kicker: dateText() + ' · ' + t('A child is born'),
      title: t(sc.boy ? 'A son for {father} and {mother}' : 'A daughter for {father} and {mother}', { father: pn(m.groom), mother: pn(m.bride) }),
      text: t('The child is named {child}. Midwives sing over the cradle, and the whole court comes to see the baby.', { child: pn(sc.child) }) +
        (sc.boy && m.gF === G.player ? ' ' + t('He will come of age in {year} and ride out at the head of his own army.', { year: p.joins }) : '') +
        (m.bF === G.player ? ' ' + t('Your blood now runs in the house of {nation}.', { nation: fName(m.gF) }) : ''),
      people: [{ who: m.groom, faction: m.gF, label: t('Father') }, { who: m.bride, faction: m.bF, label: t('Mother') }],
    };
  },
  conquest(sc) {
    const p = G.provinces[sc.prov];
    return {
      layout: 'left', kicker: dateText(),
      title: t('{city} is ours!', { city: cityOf(p) }),
      text: sc.sack ? t('Your soldiers pour through the broken gates and sack the city. The loot is carried out by the cartload.')
        : sc.capital ? t('The capital of {nation} has fallen. Your banners fly over its citadel, and its people kneel before your governor.', { nation: fName(sc.from) })
          : t('Your banners fly over the citadel of {city}. Its elders bring you the keys of the city on a silver dish.', { city: cityOf(p) }),
      people: [{ who: G.factions[G.player].leader, faction: G.player, label: fTitle(G.player) }],
    };
  },
  coronation(sc) {
    const st = G.factions[G.player];
    return {
      layout: 'throne', kicker: fFull(G.player),
      title: t('Long live {ruler}!', { ruler: pn(st.leader) }),
      text: sc.start ? t('{date}: the amirs and beys gather to raise {ruler} as {title}. The realm is yours to rule. Outlast every rival, and Turan will be yours.', { date: dateText(), ruler: pn(st.leader), title: fTitle(G.player) })
        : t('{old} is dead. In the great hall the amirs kneel before {ruler}, the new {title}.', { old: pn(sc.old), ruler: pn(st.leader), title: fTitle(G.player) }),
      people: [{ who: st.leader, faction: G.player, label: fTitle(G.player) }],
    };
  },
  place(sc) {
    const L = LANDMARKS[sc.id], c = sc.ctx;
    return {
      layout: 'none', kicker: t('A special place') + ' · ' + cityOf(G.provinces[L.prov]),
      title: t(L.name), text: t(L.text), note: t(L.desc),
      options: sc.replay ? [] : L.options.map(o => ({ label: o.label(c), hint: t(o.hint), act: () => o.act(c) })),
    };
  },
};

// ---------- Playing a scene ----------

function layoutPeople(spec) {
  const box = CINE.el.querySelector('.cine-people'), W = innerWidth, H = innerHeight;
  box.className = 'cine-people ' + spec.layout;
  box.style.cssText = '';
  if (spec.layout === 'arch') { const g = portalGeo(W, H); box.style.left = (g.cx - g.iw / 2) + 'px'; box.style.width = g.iw + 'px'; box.style.top = (g.spring - g.ph * 0.06) + 'px'; }
}

function playScene(sc) {
  const spec = SCENE_SPEC[sc.kind](sc);
  const el = cineEl(), cv = el.querySelector('canvas'), x = cv.getContext('2d');
  CINE.spec = sc; CINE.parts = []; CINE.t = 0; CINE.last = performance.now();
  el.querySelector('.cine-kicker').textContent = spec.kicker || '';
  el.querySelector('.cine-title').textContent = spec.title || '';
  el.querySelector('.cine-body').textContent = spec.text || '';
  el.querySelector('.cine-note').textContent = spec.note || '';
  el.querySelector('.cine-people').innerHTML = (spec.people || []).map((p, i) => `<div class="cine-person">${portraitSVG(p.who, { faction: p.faction })}<div class="cp-name">${pn(p.who)}</div><div class="cp-label">${p.label || ''}</div></div>` + (spec.layout === 'arch' && i === 0 ? '<div class="cine-knot">❦</div>' : '')).join('');
  const choices = el.querySelector('.cine-choices'), go = el.querySelector('.cine-go');
  choices.innerHTML = (spec.options || []).map((o, i) => `<button class="choice" data-ci="${i}" ${o.disabled ? 'disabled' : ''}><b>${o.label}</b><small>${o.hint || ''}</small></button>`).join('');
  go.textContent = t('Continue');
  go.classList.toggle('hidden', !!(spec.options && spec.options.length));
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutPeople(spec);
  };
  resize();
  el.classList.remove('hidden', 'shown', 'out');
  requestAnimationFrame(() => el.classList.add('shown'));
  const frame = now => {
    const dt = Math.min(0.05, (now - CINE.last) / 1000); CINE.last = now; CINE.t += dt;
    try { SCENE_DRAW[sc.kind](x, innerWidth, innerHeight, CINE.t, dt, sc); } catch (e) { console.error(e); }
    CINE.raf = requestAnimationFrame(frame);
  };
  CINE.raf = requestAnimationFrame(frame);
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      removeEventListener('resize', resize); removeEventListener('keydown', key, true);
      el.classList.add('out');
      setTimeout(() => { cancelAnimationFrame(CINE.raf); el.classList.add('hidden'); el.classList.remove('shown', 'out'); CINE.parts = []; resolve(); }, 450);
    };
    const key = e => { if ((e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') && go.offsetParent) { e.preventDefault(); e.stopPropagation(); finish(); } };
    addEventListener('resize', resize); addEventListener('keydown', key, true);
    choices.onclick = e => {
      const b = e.target.closest('[data-ci]'); if (!b || b.disabled) return;
      const o = spec.options[+b.dataset.ci];
      let result = '';
      try { result = o.act(); } catch (err) { console.error(err); }
      log(dateText() + ': ' + spec.title + '. ' + result, 'event');
      choices.innerHTML = '';
      el.querySelector('.cine-body').textContent = result;
      go.classList.remove('hidden');
      try { if (G) refresh(); } catch (err) { console.error(err); }
    };
    go.onclick = finish;
  });
}
