'use strict';
// Small celebrations that make the realm feel alive: coins fly into the treasury and the number counts up,
// spent gold floats away in red, a banner climbs over every city just taken, and the screen shakes to a war horn
// when war breaks out. Each refresh compares the world with the last one it saw.

const JUICE = { g: null, player: null, gold: null, owned: null, wars: null, counting: 0, from: null };
const juiceCalm = () => (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// Where a province's city stands on the screen
function provScreen(pid) {
  const p = G.provinces[pid], r = svg.getBoundingClientRect();
  return { x: r.left + (p.x - cam.x) * cam.s, y: r.top + (p.y - cam.y) * cam.s };
}
const juiceOnScreen = pt => pt.x > 0 && pt.y > 40 && pt.x < innerWidth && pt.y < innerHeight;

// Gold that comes from a place: the next coins fly from there
function juiceFrom(pid) { JUICE.from = pid; }

function juiceCheck() {
  if (!G || document.body.classList.contains('handing')) return;
  const pl = G.player, st = G.factions[pl];
  const owned = new Set(provsOf(pl).map(p => p.id));
  const wars = new Set(POWERS.filter(f => f !== pl && G.factions[f].alive && rel(pl, f).war));
  // A new game, a loaded game or another ruler at the device: remember, but celebrate nothing
  if (JUICE.g !== G || JUICE.player !== pl || $('game').classList.contains('hidden')) {
    Object.assign(JUICE, { g: G, player: pl, gold: st.gold, owned, wars, from: null });
    return;
  }
  const diff = st.gold - JUICE.gold;
  if (Math.abs(diff) >= 40) {
    const src = JUICE.from && G.provinces[JUICE.from] ? provScreen(JUICE.from) : null;
    if (diff > 0) goldIn(JUICE.gold, st.gold, src); else goldOut(diff);
  }
  JUICE.from = null;
  const taken = [...owned].filter(id => !JUICE.owned.has(id));
  taken.slice(0, 3).forEach((id, i) => setTimeout(() => bannerRise(id), i * 450));
  if (taken.length) sfx('cheer', { vol: 0.5 });
  const newWars = [...wars].filter(f => !JUICE.wars.has(f));
  if (newWars.length) warStrikes();
  Object.assign(JUICE, { gold: st.gold, owned, wars });
}

// ---------- Gold ----------

function goldIn(from, to, src) {
  const target = document.querySelector('#topbar .tb-ic.gold');
  const tr = target ? target.getBoundingClientRect() : { left: 300, top: 20, width: 20, height: 20 };
  const tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
  const start = src && juiceOnScreen(src) ? src : { x: innerWidth / 2, y: innerHeight * 0.55 };
  floatNum('+' + fmt(to - from), start.x, start.y - 24);
  const n = juiceCalm() ? 0 : Math.min(14, 4 + Math.round((to - from) / 150));
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'coin-fly';
    document.body.appendChild(c);
    const sx = start.x + (Math.random() - 0.5) * 60, sy = start.y + (Math.random() - 0.5) * 30;
    const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 160, my = Math.min(sy, ty) - 60 - Math.random() * 80;
    const anim = c.animate([
      { transform: `translate(${sx}px, ${sy}px) scale(0.4)`, opacity: 0 },
      { transform: `translate(${sx}px, ${sy - 20}px) scale(1)`, opacity: 1, offset: 0.12 },
      { transform: `translate(${mx}px, ${my}px) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${tx - 9}px, ${ty - 9}px) scale(0.7)`, opacity: 0.9 },
    ], { duration: 850 + Math.random() * 250, delay: i * 55, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' });
    anim.onfinish = () => c.remove();
  }
  setTimeout(() => { sfx('coins', { vol: 0.6, gap: 0.2 }); const s = target && target.closest('.tb-stat'); if (s) { s.classList.remove('pulse'); void s.offsetWidth; s.classList.add('pulse'); } }, n ? 800 : 0);
  countUp(from, to, n ? 700 : 0);
}

// The treasury counts up to its new sum
function countUp(from, to, delay) {
  const el = $('tb-gold');
  JUICE.counting++;
  const t0 = performance.now() + delay, dur = 700;
  const step = now => {
    const k = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step); else { JUICE.counting--; if (G) el.textContent = fmt(G.factions[G.player].gold); }
  };
  requestAnimationFrame(step);
}

function goldOut(diff) {
  const target = document.querySelector('#topbar .tb-ic.gold');
  if (!target) return;
  const r = target.getBoundingClientRect();
  floatNum('−' + fmt(-diff), r.left + 40, r.bottom + 14, 'neg down');
}

function floatNum(text, x, y, cls = '') {
  const d = document.createElement('div');
  d.className = 'float-num ' + cls;
  d.textContent = text;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1700);
}

// ---------- A city taken ----------

function bannerRise(pid) {
  if (!G || !G.provinces[pid]) return;
  const pt = provScreen(pid);
  if (!juiceOnScreen(pt)) return;
  const d = document.createElement('div');
  d.className = 'capture';
  d.style.left = pt.x + 'px'; d.style.top = pt.y + 'px';
  d.innerHTML = `<div class="rays"></div><div class="pole">${flagSVG(G.player)}</div><b>${cityOf(G.provinces[pid])}</b>`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2300);
}

// ---------- War ----------

function warStrikes() {
  sfx('horn', { vol: 0.8 });
  if (juiceCalm()) return;
  const f = document.createElement('div');
  f.className = 'war-flash';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1300);
  document.body.classList.remove('quake'); void document.body.offsetWidth; document.body.classList.add('quake');
  setTimeout(() => document.body.classList.remove('quake'), 650);
}
