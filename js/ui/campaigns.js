'use strict';
// The campaign screen: the grand campaign and the historical scenarios, their goals in play,
// and the windows that end them.

// ---------- Daily and weekly challenges ----------

function chalLoad() { try { return JSON.parse(localStorage.getItem('turan-chal') || '{}'); } catch (e) { return {}; } }
function chalSave(r) { try { localStorage.setItem('turan-chal', JSON.stringify(r)); } catch (e) { /* storage unavailable */ } }
// Days in a row with a daily challenge won, up to today (or yesterday, if today's is not played yet)
function chalStreak(r = chalLoad()) {
  let n = 0;
  const d = new Date();
  if (!(r['daily:' + dayKey(d)] || {}).won) d.setUTCDate(d.getUTCDate() - 1);
  while ((r['daily:' + dayKey(d)] || {}).won) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}
function untilTomorrow() {
  const now = new Date(), next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const m = Math.round((next - now) / 60000);
  return t('New challenge in {h} h {m} min', { h: Math.floor(m / 60), m: m % 60 });
}
function challengeCard(S) {
  const r = chalLoad()[S.id] || {}, daily = S.kind === 'daily';
  const when = daily ? new Date(S.key + 'T12:00:00Z').toLocaleDateString(LANG === 'uz' ? 'uz-Latn' : LANG, { day: 'numeric', month: 'long' }) : t('this week');
  const streak = daily ? chalStreak() : 0;
  return `<div class="camp chal ${daily ? 'daily' : 'weekly'}" data-camp="${S.id}">${flagSVG(S.faction)}<div class="camp-body">
    <div class="camp-year">${t(daily ? 'Daily challenge' : 'Weekly challenge')} · ${when} · ${fName(S.faction)}</div>
    <h3>${t(S.title)}</h3><p class="camp-goal"><b>${t('Goal')}:</b> ${challengeGoalText(S)}</p>
    <p class="chal-stats">${r.best ? `<b class="good">${icon('star')} ${t('Your best: {n}', { n: fmt(r.best) })}</b>` : r.tries ? t('Tries: {n}', { n: r.tries }) : t('The same challenge for every player. Win fast for a high score.')}
    ${streak ? ` · <b>${icon('flame')} ${t('{n}-day streak', { n: streak })}</b>` : ''}${daily ? ` · <span class="muted">${untilTomorrow()}</span>` : ''}</p></div></div>`;
}

function renderCampaigns() {
  const got = achLoad();
  const grand = `<div class="camp grand" data-camp="grand"><div class="camp-flags">${PLAYABLE.map(f => flagSVG(f)).join('')}</div>
    <div class="camp-body"><div class="camp-year">1370 · ${t('Free play')}</div><h3>${t('The grand campaign')}</h3>
    <p>${t('Choose any of the seven nations of Turan and outlast all the others: by the sword, by diplomacy, or by a golden age of learning.')}</p></div></div>`;
  const cards = SCENARIOS.map(s => {
    const done = got['sc_' + s.id];
    return `<div class="camp" data-camp="${s.id}">${flagSVG(s.faction)}<div class="camp-body">
      <div class="camp-year">${dateText(s.start)} · ${fName(s.faction)} · ${t(s.difficulty)}${done ? ` · <b class="good">${icon('check')} ${t('Completed')}</b>` : ''}</div>
      <h3>${t(s.title)}</h3><p>${t(s.blurb)}</p><p class="camp-goal"><b>${t('Goal')}:</b> ${goalTextOf(s)}</p></div></div>`;
  }).join('');
  const hot = `<div class="camp hot" data-camp="hotseat"><div class="camp-flags">${PLAYABLE.slice(0, 4).map(f => flagSVG(f)).join('')}</div>
    <div class="camp-body"><div class="camp-year">1370 · ${t('2 to 7 players')}</div><h3>${t('Hot seat: rulers on one device')}</h3>
    <p>${t('Play the grand campaign with friends, each ruling a nation and passing the device between turns.')}</p></div></div>`;
  const chal = `<div class="chal-row">${challengeCard(todayChallenge())}${challengeCard(weekChallenge())}</div>`;
  $('camp-list').innerHTML = chal + grand + hot + cards;
}

$('camp-list').addEventListener('click', e => {
  const c = e.target.closest('[data-camp]');
  if (!c) return;
  if (c.dataset.camp === 'grand') { pickMulti = null; withLoading(() => { showScreen('pick'); renderPick(); }); }
  else if (c.dataset.camp === 'hotseat') withLoading(startHotseatPick);
  else startScenario(c.dataset.camp);
});

async function startScenario(id) {
  const S = scenarioById(id);
  quietNotices = true;
  newScenarioGame(id);
  quietNotices = false;
  notices.length = 0;
  pickSel = S.faction;
  if (S.challenge) { const r = chalLoad(); r[id] = r[id] || {}; r[id].tries = (r[id].tries || 0) + 1; chalSave(r); }
  await withLoading(enterGame);
  await new Promise(r => setTimeout(r, 900));
  const intro = S.challenge ? t(S.kind === 'daily' ? 'Every player in the world plays this same challenge today: the same nation, the same map, the same luck. Win as fast as you can: every turn to spare is worth 150 points.' : 'Every player plays this same challenge all week. Win as fast as you can: every turn to spare is worth 150 points.') : t(S.blurb);
  if (!S.challenge) setTimeout(() => narrate([t(S.title), t(S.blurb)]), 400);
  await showModal(`<div class="camp-year">${S.challenge ? t(S.kind === 'daily' ? 'Daily challenge' : 'Weekly challenge') : ''}</div><h3>${t(S.title)}</h3><div class="with-portrait">${rulerPortrait(S.faction)}<div><p>${intro}</p>
    <p class="camp-goal"><b>${t('Goal')}:</b> ${goalTextOf(S)}</p><p class="note">${t('You have {n} turns. Your goal is shown at the top of the vizier’s box.', { n: S.deadline - G.turn })}</p></div></div>`,
    [{ label: t('Begin'), value: true, cls: 'big' }], { cancel: true, cls: 'parch' });
  hush();
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
  return `<div class="mission scenario ${next ? 'link' : ''}" data-mission="${next || ''}"><div class="m-head">${t('Campaign goal')} · ${when}</div>${goalTextOf(sc)}
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
  if (S.challenge) return challengeEndUI(S, s);
  if (s.result === 'win') {
    music('glory'); sfx('cheer');
    if (S.winText) setTimeout(() => narrate(t(S.winText)), 600);
    const v = await showModal(`<h3>${t('Campaign won')}</h3><div class="with-portrait">${rulerPortrait(G.player)}<div><p><b>${t(S.title)}</b></p>
      <p>${S.winText ? t(S.winText) : t('{date}: the goal is achieved. {ruler} has done what history asked of him.', { date: dateText(), ruler: pn(G.factions[G.player].leader) })}</p></div></div>`,
      [{ label: t('Campaigns'), value: 'camps' }, { label: t('The chronicle of the reign'), value: 'reign' }, { label: t('Keep ruling'), value: 'go', cls: 'big' }], { cancel: 'go', cls: 'parch' });
    hush();
    if (v === 'reign') await openReign(true);
    if (v === 'camps') { toTitle(); showScreen('camps'); renderCampaigns(); }
  } else {
    music('lament');
    const v = await showModal(`<h3>${t('The campaign is lost')}</h3><p><b>${t(S.title)}</b></p><p>${t('The goal was not reached in time: {goal}', { goal: goalTextOf(S) })}</p>`,
      [{ label: t('Main menu'), value: 'title' }, { label: t('Keep playing'), value: 'go' }, { label: t('Try again'), value: 'again', cls: 'big' }], { cancel: 'go' });
    if (v === 'again') startScenario(s.id);
    else if (v === 'title') toTitle();
  }
}

// The end of a challenge: the score, the best, the streak, and a way to share it
async function challengeEndUI(S, s) {
  const won = s.result === 'win', score = challengeScore(), r = chalLoad(), rec = r[S.id] = r[S.id] || {};
  const counted = !G.cheated;
  let best = rec.best || 0, newBest = false;
  if (won && counted) { rec.won = true; if (score > best) { rec.best = best = score; newBest = true; } }
  chalSave(r);
  checkAchievements();
  const streak = S.kind === 'daily' ? chalStreak(r) : 0;
  music(won ? 'glory' : 'lament'); if (won) sfx('cheer');
  const turns = (s.wonTurn !== undefined ? s.wonTurn : G.turn) - S.start;
  const body = won
    ? `<p>${t('Done in {n} turns.', { n: turns })}</p><div class="chal-score">${fmt(score)}</div>
       <p class="note">${newBest ? icon('star') + ' ' + t('A new best score!') : t('Your best: {n}', { n: fmt(best) })}${streak ? ' · ' + icon('flame') + ' ' + t('{n}-day streak', { n: streak }) : ''}</p>
       ${counted ? '' : `<p class="note warn">${t('A secret code was used, so this score is not kept.')}</p>`}`
    : `<p>${t('The goal was not reached in time: {goal}', { goal: goalTextOf(S) })}</p><p class="note">${t('Try again: the challenge stays the same all day, so what you learned counts.')}</p>`;
  const v = await showModal(`<div class="camp-year">${t(S.kind === 'daily' ? 'Daily challenge' : 'Weekly challenge')} · ${fName(S.faction)}</div><h3>${t(won ? 'Challenge won' : 'Challenge lost')}</h3>${body}`,
    [{ label: t('Campaigns'), value: 'camps' }, ...(won ? [{ label: t('Share'), value: 'share' }] : []), { label: t('Try again'), value: 'again', cls: won ? '' : 'big' }, ...(won ? [{ label: t('Keep ruling'), value: 'go', cls: 'big' }] : [])],
    { cancel: 'go', cls: 'parch' });
  if (v === 'share') { await shareChallenge(S, score, turns, streak); return challengeEndAgain(S, s); }
  if (v === 'again') return startScenario(S.id);
  if (v === 'camps') { toTitle(); showScreen('camps'); renderCampaigns(); }
}
function challengeEndAgain(S, s) { s.shown = false; G.overShown = null; return challengeEndUI(S, s); }

async function shareChallenge(S, score, turns, streak) {
  const url = 'https://ubaydulloabduganiev.github.io/turan/';
  const text = `TURAN · ${t(S.kind === 'daily' ? 'Daily challenge' : 'Weekly challenge')} ${S.key} · ${fName(S.faction)}\n⚔ ${t('Done in {n} turns.', { n: turns })} ★ ${fmt(score)}${streak ? ' · 🔥 ' + streak : ''}\n${t('Can you beat it?')} ${url}`;
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast(t('Copied'), t('The result is copied. Paste it to your friends.'), 'good'); }
  catch (e) { await infoBox(t('Share'), `<textarea class="share-text" readonly>${text}</textarea>`); }
}
