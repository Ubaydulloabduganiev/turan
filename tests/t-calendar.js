'use strict';
// One turn is one month, from April 1370; old saves keep their half-year turns

exports.monthsAndYears = async ({ page, quietHooks, assert }) => {
  const p = await page('en');
  await quietHooks(p);
  const r = await p.evaluate(async () => {
    newGame('temur', 2);
    const d0 = dateText(0), d9 = dateText(9), seasons = [0, 3, 6, 9].map(t => seasonOf(t));
    const ages = armiesOf('temur').filter(a => a.general).map(a => a.general.age);
    for (let i = 0; i < 9; i++) await endTurn(); // to January 1371
    const aged = armiesOf('temur').filter(a => a.general).map(a => a.general.age);
    const kurultai = G.fired.includes(0), khwarezm = G.fired.includes(1);
    const old = JSON.parse(JSON.stringify(G)); delete old.tpy; old.turn = 3;
    gameFromText(JSON.stringify({ app: 'turan', game: old }));
    return { d0, d9, seasons, aged: aged[0] - ages[0], kurultai, khwarezm, oldDate: dateText(), oldYear: year() };
  });
  assert(r.d0 === 'April 1370', 'turn 0 is ' + r.d0);
  assert(r.d9 === 'January 1371', 'turn 9 is ' + r.d9);
  assert(r.seasons.join() === 'spring,summer,autumn,winter', 'seasons ' + r.seasons);
  assert(r.aged === 1, 'generals aged ' + r.aged + ' years in nine months across a new year');
  assert(r.kurultai && !r.khwarezm, 'events out of their months');
  assert(r.oldDate === 'October 1371' && r.oldYear === 1371, 'an old half-year save shows ' + r.oldDate);
  await p.close2();
};

exports.campaignDatesAreHistorical = async ({ page, assert }) => {
  const p = await page('en');
  const r = await p.evaluate(() => ({ india: dateM(scenarioById('india').start), ankara: dateM(scenarioById('ankara').start), indiaGoal: goalTextOf(scenarioById('india')) }));
  assert(r.india === 'September 1398', 'India starts ' + r.india);
  assert(r.ankara === 'June 1402', 'Ankara starts ' + r.ankara);
  assert(/before March 1399/.test(r.indiaGoal), 'India goal: ' + r.indiaGoal);
  await p.close2();
};
