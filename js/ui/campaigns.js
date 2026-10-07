'use strict';
// The campaign screen: the grand campaign and the historical scenarios, their goals in play,
// and the windows that end them.

function renderCampaigns() {
  const got = achLoad();
  const grand = `<div class="camp grand" data-camp="grand"><div class="camp-flags">${PLAYABLE.map(f => flagSVG(f)).join('')}</div>
    <div class="camp-body"><div class="camp-year">1370 · ${t('Free play')}</div><h3>${t('The grand campaign')}</h3>
    <p>${t('Choose any of the seven nations of Turan and outlast all the others: by the sword, by diplomacy, or by a golden age of learning.')}</p></div></div>`;
  const cards = SCENARIOS.map(s => {
    const done = got['sc_' + s.id];
    return `<div class="camp" data-camp="${s.id}">${flagSVG(s.faction)}<div class="camp-body">
      <div class="camp-year">${dateText(s.start)} · ${fName(s.faction)} · ${t(s.difficulty)}${done ? ` · <b class="good">✓ ${t('Completed')}</b>` : ''}</div>
      <h3>${t(s.title)}</h3><p>${t(s.blurb)}</p><p class="camp-goal"><b>${t('Goal')}:</b> ${t(s.goalText)}</p></div></div>`;
  }).join('');
  $('camp-list').innerHTML = grand + cards;
}

$('camp-list').addEventListener('click', e => {
  const c = e.target.closest('[data-camp]');
  if (!c) return;
  if (c.dataset.camp === 'grand') withLoading(() => { showScreen('pick'); renderPick(); });
  else startScenario(c.dataset.camp);
});

async function startScenario(id) {
  const S = scenarioById(id);
  quietNotices = true;
  newScenarioGame(id);
  quietNotices = false;
  notices.length = 0;
  pickSel = S.faction;
  await withLoading(enterGame);
  await new Promise(r => setTimeout(r, 900));
  await showModal(`<h3>${t(S.title)}</h3><div class="with-portrait">${rulerPortrait(S.faction)}<div><p>${t(S.blurb)}</p>
    <p class="camp-goal"><b>${t('Goal')}:</b> ${t(S.goalText)}</p><p class="note">${t('You have {n} turns. Your goal is shown at the top of the vizier’s box.', { n: S.deadline - G.turn })}</p></div></div>`,
    [{ label: t('Begin'), value: true, cls: 'big' }], { cancel: true, cls: 'parch' });
  if (!tutorialSeen()) startTutorial();
  saveGame('auto');
  refresh();
}

// The goal card at the top of the vizier's box
function scenarioCard() {
  const pr = scenarioProgress();
  if (!pr || G.scenario.result === 'win') return '';
  const { sc, done, total, left } = pr;
  const next = sc.goal.provs.find(id => G.provinces[id].owner !== G.player);
  const when = sc.goal.type === 'hold' ? t('hold until {date}', { date: dateText(sc.deadline) }) : left <= 0 ? t('last turn') : t('turns left: {n}', { n: left });
  return `<div class="mission scenario ${next ? 'link' : ''}" data-mission="${next || ''}"><div class="m-head">${t('Campaign goal')} · ${when}</div>${t(sc.goalText)}
    <div class="m-reward">${t('Progress: {n} of {k}', { n: done, k: total })}</div></div>`;
}

// Ends a campaign the moment its goal is won, or when time runs out
async function checkScenarioUI() {
  if (!G || !G.scenario) return;
  checkScenario(false);
  const s = G.scenario;
  if (!s.result || s.shown) return;
  s.shown = true;
  const S = scenarioById(s.id);
  checkAchievements();
  if (s.result === 'win') {
    music('glory'); sfx('cheer');
    const v = await showModal(`<h3>${t('Campaign won')}</h3><div class="with-portrait">${rulerPortrait(G.player)}<div><p><b>${t(S.title)}</b></p>
      <p>${t('{date}: the goal is achieved. {ruler} has done what history asked of him.', { date: dateText(), ruler: pn(G.factions[G.player].leader) })}</p></div></div>`,
      [{ label: t('Campaigns'), value: 'camps' }, { label: t('Keep ruling'), value: 'go', cls: 'big' }], { cancel: 'go', cls: 'parch' });
    if (v === 'camps') { toTitle(); showScreen('camps'); renderCampaigns(); }
  } else {
    music('lament');
    const v = await showModal(`<h3>${t('The campaign is lost')}</h3><p><b>${t(S.title)}</b></p><p>${t('The goal was not reached in time: {goal}', { goal: t(S.goalText) })}</p>`,
      [{ label: t('Main menu'), value: 'title' }, { label: t('Keep playing'), value: 'go' }, { label: t('Try again'), value: 'again', cls: 'big' }], { cancel: 'go' });
    if (v === 'again') startScenario(s.id);
    else if (v === 'title') toTitle();
  }
}
