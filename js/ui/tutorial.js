'use strict';
// A guided first campaign: a few steps that show a new ruler how to play. Each step waits for the
// player to do the thing it asks, and the whole guide can be skipped at any moment.

const TUT = { on: false, step: 0, turn0: 0, timer: null };

const TUT_STEPS = [
  { text: () => t('This is your capital, {city}. Its panel is open on the screen. Choose the Army tab. (If the panel is closed, tap the city on the map.)', { city: cityById(G.factions[G.player].capital) }),
    glow: '.ptabs button[data-k="army"]', done: () => UI.ptab === 'army' && UI.selProv && G.provinces[UI.selProv].owner === G.player },
  { text: () => t('Tap a soldier card to train a unit. It joins the army in this city next turn.'),
    glow: '.recruit-grid', done: () => provsOf(G.player).some(p => p.queue.length) },
  { text: () => t('Now tap one of your armies: the banners with your flag on the map.'),
    done: () => UI.selArmy && G.armies[UI.selArmy] && G.armies[UI.selArmy].owner === G.player },
  { text: () => t('The glowing provinces are where this army can march. Tap one to move there. Tapping an enemy or independent city attacks it.'),
    done: () => armiesOf(G.player).some(a => a.moves < armyMoves(a)) },
  { text: () => t('When you have given your orders, press End turn. Then the rival khans make their moves.') + (endHidden() ? ' ' + t('First close the panel with ✕.') : ''),
    glow: () => endHidden() ? '#panel .close' : '#btn-end', done: () => G.turn > TUT.turn0 },
  { text: () => t('Well done! Each turn, your vizier in the corner suggests good moves. The buttons at the top open your Court, Diplomacy, Realm and Chronicle. To win, conquer every rival or make them kneel.'),
    glow: '#topbar button', final: true },
];

// On phones the End turn button hides behind an open panel
const endHidden = () => $('btn-end').offsetParent === null;

function tutorialSeen() { try { return localStorage.getItem('turan-tutorial') === 'done'; } catch (e) { return true; } }
function tutorialRemember() { try { localStorage.setItem('turan-tutorial', 'done'); } catch (e) { /* ignore */ } }

function startTutorial() {
  TUT.on = true; TUT.step = 0; TUT.turn0 = G.turn;
  let box = $('tut');
  if (!box) {
    box = document.createElement('div');
    box.id = 'tut';
    $('game').appendChild(box);
    box.addEventListener('click', e => {
      if (e.target.closest('[data-tut="skip"]') || e.target.closest('[data-tut="finish"]')) stopTutorial();
    });
  }
  clearInterval(TUT.timer);
  TUT.timer = setInterval(tutorialTick, 400);
  renderTutorial();
}

function stopTutorial() {
  TUT.on = false;
  clearInterval(TUT.timer);
  tutorialRemember();
  document.querySelectorAll('.tut-glow').forEach(e => e.classList.remove('tut-glow'));
  if ($('tut')) $('tut').remove();
}

function renderTutorial() {
  const box = $('tut'), s = TUT_STEPS[TUT.step];
  if (!box || !s) return;
  box.innerHTML = `<div class="tut-head"><span>${t('Guide')} · ${TUT.step + 1}/${TUT_STEPS.length}</span>${s.final ? '' : `<button class="small" data-tut="skip">${t('Skip the guide')}</button>`}</div>
    <p>${s.text()}</p>${s.final ? `<button class="big" data-tut="finish">${t('Begin my reign')}</button>` : ''}`;
  box.classList.remove('tut-pop'); void box.offsetWidth; box.classList.add('tut-pop');
}

function tutorialTick() {
  if (!TUT.on) return;
  if (!G || $('game').classList.contains('hidden')) { stopTutorial(); return; }
  // Out of the way while a window or scene is open
  const box = $('tut');
  const cine = $('cinema');
  if (box) box.classList.toggle('tut-hidden', !!modalOpen || !!(cine && !cine.classList.contains('hidden')));
  const s = TUT_STEPS[TUT.step];
  if (!s) return stopTutorial();
  document.querySelectorAll('.tut-glow').forEach(e => e.classList.remove('tut-glow'));
  const glow = typeof s.glow === 'function' ? s.glow() : s.glow;
  if (glow) document.querySelectorAll(glow).forEach(e => e.classList.add('tut-glow'));
  // The text can depend on the screen (a closed or open panel)
  const txt = s.text(), p = $('tut') && $('tut').querySelector('p');
  if (p && p.textContent !== txt) p.textContent = txt;
  if (!s.final && s.done()) {
    TUT.step++;
    sfx('click', { vol: 0.6 });
    renderTutorial();
  }
}
