'use strict';

let chosenDiff = 'normal', lastTs = 0, endShown = false;

function show(id, on) { el(id).classList.toggle('hidden', !on); }

function startGame() {
  newWorld((Math.random() * 1e9) | 0, chosenDiff);
  buildTerrain();
  cam.zoom = 1;
  const b = W.bases[PLAYER];
  centerOn((b.x + 0.5) * TILE, (b.y + 0.5) * TILE);
  resetUi();
  endShown = false;
  show('menu', false); show('pause', false); show('endscreen', false); show('howto', false); show('hud', true);
  toast('Your khanate awaits. Gather resources and train Dehqans at the Citadel.', 'good');
}

function toMenu() {
  W = null;
  paused = false;
  show('hud', false); show('pause', false); show('endscreen', false); show('menu', true);
}

function showEnd() {
  endShown = true;
  const win = W.over === 'win', p = W.teams[PLAYER].stats, e = W.teams[ENEMY].stats, t = Math.floor(W.time);
  el('end-title').textContent = win ? 'Victory' : 'Defeat';
  el('end-text').textContent = win
    ? 'The rival Citadel has fallen. The Silk Road is yours.'
    : 'Your last Citadel has fallen and your people are scattered across the steppe.';
  el('end-stats').innerHTML =
    `<tr><td></td><td>You</td><td>Rival</td></tr>
     <tr><td>Units trained</td><td>${p.trained}</td><td>${e.trained}</td></tr>
     <tr><td>Units lost</td><td>${p.lost}</td><td>${e.lost}</td></tr>
     <tr><td>Enemies slain</td><td>${p.kills}</td><td>${e.kills}</td></tr>
     <tr><td>Buildings razed</td><td>${p.razed}</td><td>${e.razed}</td></tr>
     <tr><td>Time</td><td colspan="2">${Math.floor(t / 60)} min ${t % 60} s on ${W.diff.label}</td></tr>`;
  show('endscreen', true);
}

function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  if (W) {
    if (!paused && !W.over) for (let i = 0; i < speed && !W.over; i++) updateWorld(dt);
    updateCamera(dt);
    updateHud(dt);
    if (W.over && !endShown) showEnd();
  }
  render();
  requestAnimationFrame(frame);
}

// ---------- Menus ----------

for (const b of el('diffs').children) {
  b.addEventListener('click', () => {
    chosenDiff = b.dataset.diff;
    for (const o of el('diffs').children) o.classList.toggle('active', o === b);
  });
}
el('btn-start').addEventListener('click', startGame);
el('btn-again').addEventListener('click', startGame);
el('btn-restart').addEventListener('click', startGame);
el('btn-resume').addEventListener('click', () => togglePause(false));
el('btn-tomenu').addEventListener('click', toMenu);
el('btn-end-menu').addEventListener('click', toMenu);
el('btn-how').addEventListener('click', () => show('howto', true));
el('btn-how2').addEventListener('click', () => show('howto', true));
el('btn-how-close').addEventListener('click', () => show('howto', false));
for (const id of ['btn-quit', 'btn-quit2']) {
  if (window.desktop) el(id).addEventListener('click', () => window.desktop.quit());
  else el(id).classList.add('hidden');
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(frame);
