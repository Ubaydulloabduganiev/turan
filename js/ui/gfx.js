'use strict';
// Graphics quality. "Full" draws everything; "Light" is for older phones: the living map is drawn at a
// lower resolution and half the frame rate without its decorations, flags stop waving, battles drop
// their shadows and scenes skip the blurred backdrop. "Auto" starts at full and switches to light by
// itself if the map runs slowly on this device.

const GFX = { mode: 'auto', low: false, frames: 0, time: 0, judged: false };
try {
  const m = localStorage.getItem('turan-gfx');
  if (m === 'full' || m === 'light' || m === 'auto') GFX.mode = m;
  GFX.low = GFX.mode === 'light' || (GFX.mode === 'auto' && localStorage.getItem('turan-gfx-auto') === 'light');
} catch (e) { /* storage unavailable */ }
// Devices that say they are weak start light
if (GFX.mode === 'auto' && ((navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2))) GFX.low = true;

function applyGfx() { document.documentElement.classList.toggle('gfx-low', GFX.low); }
applyGfx();

function setGfxMode(mode) {
  GFX.mode = mode;
  GFX.low = mode === 'light';
  if (mode === 'auto') { GFX.judged = false; GFX.frames = 0; GFX.time = 0; }
  try { localStorage.setItem('turan-gfx', mode); localStorage.removeItem('turan-gfx-auto'); } catch (e) { /* ignore */ }
  applyGfx();
}

// Called by the map every frame it draws: after a few seconds of play, judge whether this device keeps up
function gfxSample(dt) {
  if (GFX.mode !== 'auto' || GFX.judged || GFX.low) return;
  if (dt <= 0 || dt > 0.5) return; // a paused tab, not a slow device
  GFX.frames++; GFX.time += dt;
  if (GFX.time < 4) return;
  GFX.judged = true;
  const fps = GFX.frames / GFX.time;
  if (fps < 32) {
    GFX.low = true;
    try { localStorage.setItem('turan-gfx-auto', 'light'); } catch (e) { /* ignore */ }
    applyGfx();
    toast(t('Light graphics'), t('This device was struggling, so the game now draws the map more simply. You can change this in the Menu.'), '');
  }
}

const GFX_LABELS = { auto: 'Graphics: automatic', full: 'Graphics: full', light: 'Graphics: light' };
function gfxLabel() { return t(GFX_LABELS[GFX.mode]); }
function nextGfxMode() { return { auto: 'full', full: 'light', light: 'auto' }[GFX.mode]; }
