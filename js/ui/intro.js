'use strict';
// The opening of the game: a minute of film before the title. The painted map of 1370, the seven banners
// rising over their capitals, the burning Silk Road, Temur raised on the white felt, the poets and
// astronomers, and the name of the game. Told by the storyteller, with Temur's own words. A tap skips it.

const INTRO = { el: null, raf: 0, t0: 0, shot: null, dust: [], skip: null };

function introSeen() { try { return localStorage.getItem('turan-intro') === 'seen'; } catch (e) { return true; } }

// Where the capital of a nation lies on the painted map (0..1 of its width and height)
function capitalSpot(f) {
  const d = PROVINCE_DATA.find(x => x[0] === FACTIONS[f].capital);
  const p = project(d[3], d[4]);
  return { x: p.x / MAP.W, y: p.y / MAP.H };
}

const INTRO_SHOTS = [
  { img: () => ART.terrain, lines: ['intro.1'], min: 6, from: [0.5, 0.5, 1.0], to: [0.52, 0.48, 1.25], card: '1370' },
  { img: () => ART.terrain, lines: ['intro.2'], min: 12, from: [0.5, 0.5, 1.05], to: [0.5, 0.5, 1.05], banners: true },
  { img: () => ART.scenes.siege, lines: ['intro.3'], min: 7, from: [0.4, 0.5, 1.08], to: [0.6, 0.45, 1.22], embers: true },
  { img: () => ART.scenes.coronation, lines: ['intro.4', 'temur.coronation'], min: 10, from: [0.5, 0.6, 1.25], to: [0.5, 0.5, 1.05] },
  { img: () => ART.scenes.scholar, lines: ['intro.5'], min: 8, from: [0.35, 0.5, 1.1], to: [0.65, 0.5, 1.2], alt: () => ART.scenes.feast },
  { img: () => ART.title, lines: ['intro.6'], min: 7, from: [0.5, 0.5, 1.2], to: [0.5, 0.5, 1.0], title: true },
];

function playIntro() {
  return new Promise(resolve => {
    for (const s of INTRO_SHOTS) { preload(s.img()); if (s.alt) preload(s.alt()); }
    for (const f of PLAYABLE) flagImage(f);
    const el = document.createElement('div');
    el.id = 'intro';
    el.innerHTML = `<canvas></canvas><div class="intro-sub"></div>
      <div class="intro-gate"><div class="intro-mark">TURAN</div><button class="big intro-play">${icon('play')} ${t('Begin the story')}</button><button class="intro-pass">${t('Skip the opening')}</button></div>
      <button class="intro-skip hidden">${t('Skip')} ›</button>`;
    document.body.appendChild(el);
    INTRO.el = el;
    const cv = el.querySelector('canvas'), x = cv.getContext('2d');
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; x.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      try { localStorage.setItem('turan-intro', 'seen'); } catch (e) { /* ignore */ }
      hush(); cancelAnimationFrame(INTRO.raf); removeEventListener('resize', size); removeEventListener('keydown', key);
      el.classList.add('out');
      setTimeout(() => { el.remove(); resolve(); }, 900);
    };
    const key = e => { if (e.key === 'Escape') finish(); };
    addEventListener('keydown', key);
    el.querySelector('.intro-pass').onclick = finish;
    el.querySelector('.intro-skip').onclick = finish;
    // The first tap also lets the browser play sound
    el.querySelector('.intro-play').onclick = async () => {
      el.querySelector('.intro-gate').classList.add('hidden');
      el.querySelector('.intro-skip').classList.remove('hidden');
      music('title');
      INTRO.t0 = performance.now();
      INTRO.raf = requestAnimationFrame(now => frame(now, x));
      for (let i = 0; i < INTRO_SHOTS.length && !done; i++) {
        const s = INTRO_SHOTS[i];
        const lines = s.lines.map(narr);
        // how long the camera takes to cross the picture: about as long as the words
        INTRO.shot = { s, start: performance.now(), dur: Math.max(s.min * 1000, lines.join(' ').length * 68), ending: 0 };
        el.querySelector('.intro-sub').textContent = lines[0];
        el.querySelector('.intro-sub').classList.remove('show'); void el.offsetWidth; el.querySelector('.intro-sub').classList.add('show');
        const t0 = performance.now();
        // Each line in turn, with its subtitle; the shot lasts as long as the voice, and at least its minimum
        for (let k = 0; k < lines.length && !done; k++) {
          if (k) { el.querySelector('.intro-sub').textContent = lines[k]; }
          const spoke = await speakLines([lines[k]]);
          if (!spoke) await new Promise(r => setTimeout(r, Math.max(2500, lines[k].length * 60)));
        }
        const left = s.min * 1000 - (performance.now() - t0);
        await new Promise(r => setTimeout(r, Math.max(300, left)));
        INTRO.shot.ending = performance.now();
        await new Promise(r => setTimeout(r, 700));
      }
      if (!done) await new Promise(r => setTimeout(r, 1800));
      finish();
    };
  });
}

// A nation's flag as an image, for drawing on the canvas
const FLAG_IMGS = {};
function flagImage(f) {
  if (FLAG_IMGS[f]) return FLAG_IMGS[f];
  const im = new Image();
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(flagSVG(f).replace('<svg ', '<svg width="80" height="98" '));
  return (FLAG_IMGS[f] = im);
}

function frame(now, x) {
  const W = innerWidth, H = innerHeight, sh = INTRO.shot;
  INTRO.raf = requestAnimationFrame(n => frame(n, x));
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  if (!sh) return;
  const s = sh.s, k = Math.min(1, (now - sh.start) / sh.dur), e = k * k * (3 - 2 * k);
  // fade in at the start of the shot, out at the end
  const fade = Math.min(1, (now - sh.start) / 900, sh.ending ? Math.max(0, 1 - (now - sh.ending) / 700) : 1);
  const src = s.alt && k > 0.5 ? s.alt() : s.img(), im = img(src);
  if (im) {
    const fx = s.from[0] + (s.to[0] - s.from[0]) * e, fy = s.from[1] + (s.to[1] - s.from[1]) * e, z = s.from[2] + (s.to[2] - s.from[2]) * e;
    const sc = Math.max(W / im.width, H / im.height) * z, iw = im.width * sc, ih = im.height * sc;
    const ox = clampN(W / 2 - fx * iw, W - iw, 0), oy = clampN(H / 2 - fy * ih, H - ih, 0);
    x.globalAlpha = fade;
    x.drawImage(im, ox, oy, iw, ih);
    if (s.banners) introBanners(x, now - sh.start, ox, oy, iw, ih);
    x.globalAlpha = 1;
  }
  // darker edges and a warm cast
  const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(80,40,0,0.12)'; x.fillRect(0, 0, W, H);
  introDust(x, W, H, s.embers);
  if (s.card) {
    const a = Math.min(1, (now - sh.start) / 1500) * Math.max(0, 1 - (now - sh.start - 3500) / 1500);
    x.save(); x.globalAlpha = Math.max(0, a); x.textAlign = 'center'; x.fillStyle = '#f3dc9a'; x.font = `${Math.min(120, W / 6)}px Cinzel, Georgia, serif`;
    x.shadowColor = 'rgba(0,0,0,0.8)'; x.shadowBlur = 20; x.fillText(s.card, W / 2, H * 0.45); x.restore();
  }
  if (s.title) {
    const a = Math.min(1, Math.max(0, (now - sh.start - 600) / 2200));
    x.save(); x.globalAlpha = a; x.textAlign = 'center';
    x.shadowColor = 'rgba(0,0,0,0.9)'; x.shadowBlur = 30;
    const g = x.createLinearGradient(0, H * 0.3, 0, H * 0.45); g.addColorStop(0, '#fff2c4'); g.addColorStop(1, '#c9973a');
    x.fillStyle = g; x.font = `${Math.min(170, W / 4.2)}px Cinzel, Georgia, serif`; x.fillText('TURAN', W / 2, H * 0.44);
    x.fillStyle = '#efe0bd'; x.font = `${Math.min(26, W / 22)}px Cinzel, Georgia, serif`; x.fillText(t('Khanates of the Silk Road · 1370'), W / 2, H * 0.44 + Math.min(56, W / 10));
    x.restore();
  }
  // letterbox
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H * 0.07); x.fillRect(0, H * 0.93, W, H * 0.07);
}

// The seven banners rise one after another over the capitals, each in its colour
function introBanners(x, ms, ox, oy, iw, ih) {
  PLAYABLE.forEach((f, i) => {
    const t0 = 1200 + i * 1350, a = Math.min(1, Math.max(0, (ms - t0) / 900));
    if (a <= 0) return;
    const c = capitalSpot(f), px = ox + c.x * iw, py = oy + c.y * ih, F = FACTIONS[f];
    const ring = (ms - t0) / 1000;
    x.save();
    x.globalAlpha = Math.max(0, 0.7 - ring * 0.35); x.strokeStyle = F.color; x.lineWidth = 3;
    x.beginPath(); x.arc(px, py, 10 + ring * 40, 0, Math.PI * 2); x.stroke();
    x.globalAlpha = a * 0.45; x.fillStyle = F.color; x.beginPath(); x.arc(px, py, 26, 0, Math.PI * 2); x.fill();
    x.globalAlpha = a;
    const fl = flagImage(f), rise = (1 - a) * 30;
    x.strokeStyle = '#2a1806'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - 64 - rise); x.stroke();
    if (fl.complete) x.drawImage(fl, px, py - 64 - rise, 34, 42);
    x.font = '15px Cinzel, Georgia, serif'; x.fillStyle = '#fff2c4'; x.textAlign = 'center'; x.shadowColor = '#000'; x.shadowBlur = 6;
    x.fillText(fName(f), px, py + 24);
    x.restore();
  });
}

// Golden dust drifting in the light, or embers rising from a burning town
function introDust(x, W, H, embers) {
  const D = INTRO.dust;
  while (D.length < (embers ? 90 : 60)) D.push({ x: Math.random() * W, y: Math.random() * H, r: 0.6 + Math.random() * 2, vx: (Math.random() - 0.5) * 0.25, vy: embers ? -0.6 - Math.random() * 1.2 : -0.08 - Math.random() * 0.2, a: Math.random() });
  for (const d of D) {
    d.x += d.vx; d.y += d.vy; d.a += 0.01;
    if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
    x.globalAlpha = 0.35 + Math.sin(d.a) * 0.3;
    x.fillStyle = embers ? '#ffb060' : '#f6dc94';
    x.beginPath(); x.arc(d.x, d.y, d.r, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
}
