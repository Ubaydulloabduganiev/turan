'use strict';
// Music and sound. Each mood has its own playlist and the music crossfades when the mood changes:
// the title, the campaign map, battle, a feast, a coronation and mourning. Sound effects are short
// clips played on demand. Browsers allow sound only after the first click, so everything waits for it.
// Sources and licences are in js/credits.js.

const SND = {
  musicVol: 0.55, sfxVol: 0.8, muted: false, unlocked: false,
  mood: null, cur: null, fading: [], next: 0,
  lists: {
    title: ['audio/title.ogg'],
    map: ['audio/map1.ogg', 'audio/map2.ogg', 'audio/map3.ogg', 'audio/map4.ogg'],
    battle: ['audio/battle1.ogg', 'audio/battle2.ogg', 'audio/battle3.ogg'],
    feast: ['audio/feast.ogg'],
    glory: ['audio/glory.ogg'],
    lament: ['audio/lament.ogg'],
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
  a.volume = 0; a.loop = list.length === 1;
  a.onended = () => { if (SND.cur === a) startTrack(); };
  a.play().catch(() => {});
  SND.cur = a;
  fadeTo(a, musicLevel(), 2.5);
}
function fadeTo(a, vol, secs) {
  const from = a.volume, t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
    a.volume = Math.max(0, Math.min(1, from + (vol - from) * k));
    if (k < 1 && !a._stop) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function fadeOut(a) {
  fadeTo(a, 0, 1.8);
  setTimeout(() => { a._stop = true; a.pause(); a.src = ''; }, 2000);
}

// A short sound effect; the same kind is not repeated faster than `gap` seconds
function sfx(kind, opts = {}) {
  if (!SND.unlocked || SND.muted || !SND.sfx[kind]) return;
  const now = performance.now() / 1000;
  if (now - (SND.last[kind] || 0) < (opts.gap || 0)) return;
  SND.last[kind] = now;
  const list = SND.sfx[kind], name = list[Math.floor(Math.random() * list.length)];
  const a = new Audio('audio/sfx/' + name + '.ogg');
  a.volume = Math.max(0, Math.min(1, SND.sfxVol * (opts.vol || 1)));
  if (opts.rate) a.playbackRate = opts.rate;
  a.play().catch(() => {});
  return a;
}

// The first click lets the browser play sound
function unlockSound() {
  if (SND.unlocked) return;
  SND.unlocked = true;
  if (SND.mood) startTrack();
}
addEventListener('pointerdown', unlockSound, { capture: true });
addEventListener('keydown', unlockSound, { capture: true });

// Every button clicks
document.addEventListener('click', e => { if (e.target.closest('button, .rcard, .choice')) sfx('click', { vol: 0.5 }); }, true);

function setMusicVol(v) { SND.musicVol = v; if (SND.cur) SND.cur.volume = musicLevel(); saveSound(); }
function setSfxVol(v) { SND.sfxVol = v; saveSound(); }
function toggleMute() { SND.muted = !SND.muted; if (SND.cur) SND.cur.volume = musicLevel(); saveSound(); return SND.muted; }

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
