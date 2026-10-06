'use strict';
// Real paintings and photographs on screen: a slow documentary camera over the image, a soft
// blurred backdrop where the picture does not fill the screen, film grain and a gentle vignette.

const IMGS = {};
// Loads an image once; returns it when ready, or null while it is still loading or if it failed
function img(src) {
  if (!src) return null;
  let e = IMGS[src];
  if (!e) { e = IMGS[src] = { im: new Image(), ok: false, bad: false }; e.im.onload = () => { e.ok = true; }; e.im.onerror = () => { e.bad = true; }; e.im.src = src; }
  return e.ok ? e.im : null;
}
function imgFailed(src) { return !!(IMGS[src] && IMGS[src].bad); }
function preload(src) { img(src); }

// Film grain: a small noise tile, redrawn at a random offset every frame
let grainTile = null;
function grain(x, W, H, a = 0.06) {
  if (!grainTile) {
    grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 160;
    const g = grainTile.getContext('2d'), d = g.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }
  x.save(); x.globalAlpha = a; x.globalCompositeOperation = 'overlay';
  const ox = Math.random() * 160, oy = Math.random() * 160;
  x.translate(-ox, -oy); x.fillStyle = x.createPattern(grainTile, 'repeat'); x.fillRect(0, 0, W + 160, H + 160);
  x.restore();
}
function vignette(x, W, H, strength = 0.65) {
  const g = x.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${strength})`);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
}

// Draws a picture with a slow push-in toward its focus point. area: the part of the screen to fill.
// A picture much taller (or wider) than the area is shown whole over a blurred copy of itself,
// the way documentaries show manuscript pages.
function kenBurns(x, im, W, H, t, o = {}) {
  const ax = o.x || 0, ay = o.y || 0, aw = o.w || W, ah = o.h || H;
  const dur = o.dur || 40, k = Math.min(1, t / dur), ease = k * (2 - k);
  const fx = (o.focus || [0.5, 0.45])[0], fy = (o.focus || [0.5, 0.45])[1];
  const ir = im.width / im.height, ar = aw / ah;
  const cover = Math.max(aw / im.width, ah / im.height), contain = Math.min(aw / im.width, ah / im.height);
  const fits = ir / ar > 0.72 && ir / ar < 1.4; // close enough to the screen's shape to fill it
  x.save(); x.beginPath(); x.rect(ax, ay, aw, ah); x.clip();
  if (!fits) {
    // blurred backdrop
    x.save(); x.filter = 'blur(22px) brightness(0.45) saturate(1.1)';
    const s = cover * 1.15; x.drawImage(im, ax + aw / 2 - im.width * s / 2, ay + ah / 2 - im.height * s / 2, im.width * s, im.height * s);
    x.restore();
  }
  const base = fits ? cover : contain * (o.fill || 0.98);
  const s = base * (1.02 + 0.1 * ease);
  const w = im.width * s, h = im.height * s;
  // start centred, drift toward the focus point
  let cx = ax + aw / 2 - w / 2 - (fx - 0.5) * w * 0.12 * ease, cy = ay + ah / 2 - h / 2 - (fy - 0.5) * h * 0.12 * ease;
  if (fits) { cx = Math.min(ax, Math.max(ax + aw - w, cx)); cy = Math.min(ay, Math.max(ay + ah - h, cy)); }
  x.drawImage(im, cx, cy, w, h);
  if (!fits) { x.strokeStyle = 'rgba(216,180,90,0.5)'; x.lineWidth = 1.5; x.strokeRect(cx, cy, w, h); }
  x.restore();
  return { x: cx, y: cy, w, h };
}

// Light that breathes, like a lamp or the sun through cloud
function lightLeak(x, W, H, t, col, cx = 0.75, cy = 0.2) {
  const a = 0.18 + 0.08 * Math.sin(t * 0.7) + 0.04 * Math.sin(t * 2.3);
  const g = x.createRadialGradient(W * cx, H * cy, 0, W * cx, H * cy, Math.max(W, H) * 0.7);
  g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
  x.save(); x.globalCompositeOperation = 'screen'; x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore();
}
