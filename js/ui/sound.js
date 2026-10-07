'use strict';
// Music and sound. Each mood has its own playlist and the music crossfades when the mood changes:
// the title, the campaign map, battle, a feast, a coronation and mourning. Sound effects are short
// clips played on demand. Browsers allow sound only after the first click, so everything waits for it.
// Sources and licences are in js/credits.js.

const SND = {
  musicVol: 0.55, sfxVol: 0.8, muted: false, unlocked: false,
  mood: null, cur: null, fading: [], next: 0,
  lists: {
    title: ['audio/title.mp3'],
    map: ['audio/map1.mp3', 'audio/map2.mp3', 'audio/map3.mp3', 'audio/map4.mp3'],
    battle: ['audio/battle1.mp3', 'audio/battle2.mp3', 'audio/battle3.mp3'],
    feast: ['audio/feast.mp3'],
    glory: ['audio/glory.mp3'],
    lament: ['audio/lament.mp3'],
  },
  sfx: {
    click: ['click'], coins: ['coins'], build: ['build'], clash: ['clash1', 'clash2', 'clash3'], arrows: ['arrows1', 'arrows2'],
    gallop: ['gallop'], army: ['army'], cheer: ['cheer'], horn: ['horn'], fanfare: ['fanfare'], fire: ['fire'], wind: ['wind'],
  },
  last: {},
};
try {
  const s = JSON.parse(localStorage.getItem('turan-sound') || '{}');
  if (typeof s.music === 'number') SND.musicVol = s.music;
  if (typeof s.sfx === 'number') SND.sfxVol = s.sfx;
  SND.muted = !!s.muted;
} catch (e) { /* storage unavailable */ }
function saveSound() { try { localStorage.setItem('turan-sound', JSON.stringify({ music: SND.musicVol, sfx: SND.sfxVol, muted: SND.muted })); } catch (e) { /* ignore */ } }

const musicLevel = () => SND.muted ? 0 : SND.musicVol;

// Web Audio where the page is served over http(s): iPhones ignore an <audio> element's volume,
// so music runs through a gain node and effects play from decoded buffers. Opened from a file,
// plain <audio> elements are used instead.
const AC = window.AudioContext || window.webkitAudioContext;
const useWebAudio = !!AC && /^https?:/.test(location.protocol);
SND.buf = {};

function setVol(a, v) {
  v = Math.max(0, Math.min(1, v));
  if (a._gain) a._gain.gain.value = v; else a.volume = v;
  a._vol = v;
}

// Plays the music for a mood; the same mood keeps playing
function music(mood) {
  if (SND.mood === mood) return;
  SND.mood = mood;
  if (SND.unlocked) startTrack();
}
function startTrack() {
  const list = SND.lists[SND.mood];
  if (SND.cur) fadeOut(SND.cur);
  SND.cur = null;
  if (!list) return;
  const src = list[SND.next++ % list.length];
  const a = new Audio(src);
  a.loop = list.length === 1;
  a.preload = 'auto';
  a.setAttribute('playsinline', '');
  if (SND.ctx) {
    try { const n = SND.ctx.createMediaElementSource(a), g = SND.ctx.createGain(); n.connect(g); g.connect(SND.ctx.destination); a._gain = g; } catch (e) { /* plain volume */ }
  }
  setVol(a, 0);
  a.onended = () => { if (SND.cur === a) startTrack(); };
  a.play().catch(() => {});
  SND.cur = a;
  fadeTo(a, musicLevel(), 2.5);
}
function fadeTo(a, vol, secs) {
  const from = a._vol || 0, t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
    if (!a._stop) setVol(a, from + (vol - from) * k);
    if (k < 1 && !a._stop) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function fadeOut(a) {
  fadeTo(a, 0, 1.8);
  setTimeout(() => { a._stop = true; a.pause(); a.removeAttribute('src'); a.load(); }, 2000);
}

// Effects are decoded once and kept
function loadSfx(name) {
  if (SND.buf[name] !== undefined) return;
  SND.buf[name] = null;
  fetch('audio/sfx/' + name + '.mp3').then(r => r.arrayBuffer())
    .then(data => SND.ctx.decodeAudioData(data, b => { SND.buf[name] = b; }, () => {}))
    .catch(() => {});
}

// A short sound effect; the same kind is not repeated faster than `gap` seconds
function sfx(kind, opts = {}) {
  if (!SND.unlocked || SND.muted || !SND.sfx[kind]) return;
  const now = performance.now() / 1000;
  if (now - (SND.last[kind] || 0) < (opts.gap || 0)) return;
  SND.last[kind] = now;
  const list = SND.sfx[kind], name = list[Math.floor(Math.random() * list.length)];
  const vol = Math.max(0, Math.min(1, SND.sfxVol * (opts.vol || 1)));
  if (SND.ctx) {
    const b = SND.buf[name];
    if (!b) { loadSfx(name); return; }
    const n = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
    n.buffer = b; g.gain.value = vol;
    if (opts.rate) n.playbackRate.value = opts.rate;
    n.connect(g); g.connect(SND.ctx.destination); n.start();
    return n;
  }
  const a = new Audio('audio/sfx/' + name + '.mp3');
  a.volume = vol;
  if (opts.rate) a.playbackRate = opts.rate;
  a.play().catch(() => {});
  return a;
}

// The first touch or key lets the browser play sound. iPhones only count a finished tap,
// so every tap re-tries until the sound is really running.
function unlockSound() {
  if (useWebAudio && !SND.ctx) {
    try { SND.ctx = new AC(); for (const k in SND.sfx) SND.sfx[k].forEach(loadSfx); } catch (e) { SND.ctx = null; }
  }
  if (SND.ctx && SND.ctx.state !== 'running' && !document.hidden) SND.ctx.resume().catch(() => {});
  if (!SND.unlocked) {
    SND.unlocked = true;
    if (SND.mood) startTrack();
  } else if (SND.cur && SND.cur.paused && !SND.cur._stop && !document.hidden) SND.cur.play().catch(() => {});
}
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, unlockSound, { capture: true, passive: true });

// Quiet while the game is in the background
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (SND.cur) SND.cur.pause(); if (SND.ctx) SND.ctx.suspend().catch(() => {}); }
  else if (SND.unlocked) { if (SND.ctx) SND.ctx.resume().catch(() => {}); if (SND.cur && !SND.cur._stop) SND.cur.play().catch(() => {}); }
});

// Every button clicks
document.addEventListener('click', e => { if (e.target.closest('button, .rcard, .choice')) sfx('click', { vol: 0.5 }); }, true);

function setMusicVol(v) { SND.musicVol = v; if (SND.cur) setVol(SND.cur, musicLevel()); saveSound(); }
function setSfxVol(v) { SND.sfxVol = v; saveSound(); }
function toggleMute() { SND.muted = !SND.muted; if (SND.cur) setVol(SND.cur, musicLevel()); saveSound(); return SND.muted; }

// Volume controls, shown in the menu
function soundControls() {
  return `<div class="sound-ctl"><label>${t('Music')} <input type="range" min="0" max="100" value="${Math.round(SND.musicVol * 100)}" data-vol="music"></label>
    <label>${t('Sounds')} <input type="range" min="0" max="100" value="${Math.round(SND.sfxVol * 100)}" data-vol="sfx"></label>
    <button class="small" data-mute="1">${SND.muted ? t('Sound on') : t('Mute')}</button></div>`;
}
document.addEventListener('input', e => {
  const r = e.target.closest('[data-vol]');
  if (!r) return;
  if (r.dataset.vol === 'music') setMusicVol(r.value / 100); else { setSfxVol(r.value / 100); sfx('coins', { gap: 0.2 }); }
});
document.addEventListener('click', e => {
  const m = e.target.closest('[data-mute]');
  if (m) { const on = toggleMute(); m.textContent = on ? t('Sound on') : t('Mute'); }
});

// ---------- Battle sounds, driven by what happens on the field ----------
function battleSounds() {
  if (typeof TB === 'undefined' || !TB || TB.paused || TB.over) return;
  let melee = 0, riders = 0;
  for (const r of TB.regs) {
    if (r.gone || r.men <= 0) continue;
    if (inMelee(r)) melee++;
    if (r.moving && (r.d.cls === 'cav' || r.d.cls === 'ha')) riders++;
  }
  if (melee) sfx('clash', { gap: Math.max(0.12, 0.7 - melee * 0.08), vol: 0.35 + Math.min(0.4, melee * 0.05), rate: 0.9 + Math.random() * 0.25 });
  if (riders) sfx('gallop', { gap: 5.5, vol: Math.min(0.6, 0.2 + riders * 0.1) });
  if (TB.arrows.length > 4) sfx('arrows', { gap: 0.6, vol: 0.4, rate: 0.85 + Math.random() * 0.3 });
}
setInterval(battleSounds, 150);
