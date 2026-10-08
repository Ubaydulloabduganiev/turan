'use strict';
// The side panel: details and commands for the selected province or army, plus the top bar.

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString(LANG === 'ru' ? 'ru-RU' : LANG === 'tr' ? 'tr-TR' : 'en-US');
let unitPick = new Set(); // selected unit indexes in the army panel
let lastArmyShown = null;

// Achievements and campaign goals are looked at after the player's own deeds too, at most once a second
let lastAchCheck = 0;
function refresh() {
  if (G && performance.now() - lastAchCheck > 1000) { lastAchCheck = performance.now(); setTimeout(checkAchievements, 0); }
  // A campaign goal reached by the player's own hand ends the campaign at once
  if (G && G.scenario && !G.scenario.result) {
    const pr = scenarioProgress();
    if (pr && pr.met && pr.sc.goal.type !== 'hold') setTimeout(function tryEnd() { if (!G || !G.scenario || G.scenario.shown) return; if (uiLocked()) setTimeout(tryEnd, 800); else checkScenarioUI(); }, 0);
  }
  if (!G) return;
  if (UI.selArmy && !G.armies[UI.selArmy]) UI.selArmy = null;
  renderMap();
  renderTopbar();
  if (!turnBusy && !modalOpen && !G.over) checkMission();
  renderPanel();
  updateHint();
  renderAdvisor();
}

function renderTopbar() {
  const pl = G.player, st = G.factions[pl];
  $('tb-faction').innerHTML = flagSVG(pl) + rulerPortrait(pl, 'tb-portrait') + `<span>${pn(st.leader)}<small>${fTitle(pl)}</small></span>`;
  $('tb-gold').textContent = fmt(st.gold);
  const net = factionIncome(pl) - factionUpkeep(pl) - treasuryLoss(pl);
  $('tb-net').textContent = (net >= 0 ? '+' : '') + fmt(net);
  $('tb-net').className = net < 0 ? 'neg' : '';
  // The full words on wide screens, just the number on phones
  const np = provsOf(pl).length, nn = nationsLeft().length;
  $('tb-provs').innerHTML = `<span class="tb-long">${t('{n} provinces', { n: np })}</span><span class="tb-short">${np}</span>`;
  $('tb-nations').innerHTML = `<span class="tb-long">${t('{n} nations left', { n: nn })}</span><span class="tb-short">${nn}</span>`;
  $('tb-date').textContent = dateText();
}

function orderInfo(o) {
  if (o >= 80) return [t('Content'), 'good'];
  if (o >= 55) return [t('Calm'), ''];
  if (o >= 35) return [t('Restless'), 'warn'];
  return [t('Rebellious'), 'bad'];
}

function renderPanel() {
  const panel = $('panel');
  const a = UI.selArmy && G.armies[UI.selArmy];
  const p = UI.selProv && G.provinces[UI.selProv];
  if (!a && !p) { panel.classList.add('hidden'); UI.panelOpen = false; return; }
  panel.classList.remove('hidden');
  UI.panelOpen = true;
  if (a) { if (lastArmyShown !== a.id) unitPick.clear(); lastArmyShown = a.id; }
  panel.innerHTML = `<button class="close" data-act="close" title="${t('Close (Esc)')}">×</button>` + (a ? armyPanel(a) : provincePanel(p));
}

// ---------- Province ----------

function provincePanel(p) {
  const mine = p.owner === G.player;
  const dist = distancesFrom(p.owner);
  const order = provinceOrder(p, dist);
  const [ow, oc] = orderInfo(order);
  let h = `<div class="p-head">${flagSVG(p.owner)}<div><div class="p-title">${cityOf(p)}</div><div class="p-sub">${regionOf(p)} · ${fFull(p.owner)}</div></div></div>`;
  h += `<div class="kv">
    <div><span>${t('Population')}</span>${fmt(p.pop * 1000)}</div>
    <div><span>${t('Terrain')}</span>${terrName(p.terrain)}</div>
    <div><span>${t('Walls')}</span>${bLevel('walls', p.b.walls)}</div>
    <div><span>${t('Silk Road')}</span>${p.silk ? t('Yes') : t('No')}</div>`;
  if (mine) h += `<div><span>${t('Public order')}</span><b class="${oc}">${Math.min(100, order)}% ${ow}</b></div><div><span>${t('Income')}</span>${fmt(provinceIncome(p, order))}</div>`;
  h += '</div>';
  if (p.siege) h += `<p class="note bad">${t('Besieged by: {faction}. The city can hold out for about {n} more turns.', { faction: fFull(p.siege.by), n: siegeTurns(p) })}</p>`;
  if (mine && order < 35) h += `<p class="note bad">${t('The people are close to revolt. Lower taxes, build a mosque or station troops here.')}</p>`;
  if (p.sacked > 0) h += `<p class="note warn">${t('The city is still recovering from a sack.')}</p>`;

  // Tabs: for your city Rule / Army / Build; for another's War / Diplomacy / Dealings
  const tabs = mine ? [['rule', t('Rule')], ['army', t('Army')], ['build', t('Build')]] : [['war', t('War')], ['dip', t('Diplomacy')], ['deal', t('Dealings')]];
  if (!tabs.some(([k]) => k === UI.ptab)) UI.ptab = tabs[0][0];
  if (!mine && p.owner === 'rebels' && UI.ptab === 'dip') UI.ptab = 'war';
  h += `<div class="ptabs">${tabs.map(([k, l]) => `<button data-act="ptab" data-k="${k}" class="${UI.ptab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tab = UI.ptab;

  if (mine && tab === 'rule') {
    h += citySectionTax(p) + cityActionGroups(p, ['Treasury']);
  }
  if (mine && tab === 'rule') {
    h += `<div class="p-sec"><h4>${t('Royal decrees')}</h4><div class="decrees">` + Object.keys(DECREES).map(k => {
      const D = DECREES[k], why = decreeCheck(p, k);
      const price = k === 'feast' ? t('−{n} gold', { n: fmt(D.cost(p)) }) : k === 'tax' ? t('+{n} gold', { n: fmt(D.gain(p)) }) : t('+2 militia');
      return `<button data-act="decree" data-k="${k}" ${why ? 'disabled' : ''} title="${t(why || D.desc)}"><b>${t(D.name)}</b><small>${price}</small></button>`;
    }).join('') + '</div>' + (p.decree === G.turn ? `<p class="note">${t('You have already issued a decree here this turn.')}</p>` : '') + '</div>';
    h += cityActionGroups(p, ['Government', 'Give away']);
  }
  if (mine && tab === 'army') {
    h += `<div class="p-sec"><h4>${t('Recruit')}</h4>`;
    const list = recruitable(p);
    if (!list.length) h += `<p class="note">${t('Build barracks or stables to train troops here.')}</p>`;
    else {
      h += '<div class="recruit-grid">' + list.map(u => {
        const d = UNITS[u], price = unitCost(p.owner, u), ok = G.factions[p.owner].gold >= price && p.queue.length < QUEUE_MAX;
        return `<div class="rcard ${ok ? '' : 'off'}" data-act="recruit" data-t="${u}" title="${unitTip(u)}">${unitSVG(u, p.owner)}<div>${uName(u)}</div><div class="c">${t('{n}g', { n: price })}</div></div>`;
      }).join('') + '</div>';
    }
    if (p.queue.length) {
      h += `<p class="note">${t('In training (ready next turn, two at a time). Click to cancel:')}</p><div class="queue">` +
        p.queue.map((u, i) => `<div class="rcard" data-act="unqueue" data-i="${i}" title="${t('Cancel and refund')}">${unitSVG(u, p.owner)}<div>${uName(u)}</div></div>`).join('') + '</div>';
    }
    h += '</div>';
  }
  if (mine && tab === 'build') {
    h += `<div class="p-sec"><h4>${t('Buildings')}</h4>`;
    if (p.build) {
      h += `<p class="note">${t('Building {what}: {n} turns left', { what: `<b>${buildName(p)}</b>`, n: p.build.turns })} <button class="small" data-act="cancelbuild">${t('Cancel')}</button></p>`;
    }
    for (const k of BUILDING_ORDER) {
      const B = BUILDINGS[k], lvl = p.b[k], next = lvl + 1;
      let right = '';
      if (next <= 3) {
        const why = buildCheck(p, k);
        right = `<button class="small" data-act="build" data-k="${k}" ${why ? 'disabled' : ''} title="${t(why || B.desc)}">${bLevel(k, next)} · ${t('{n}g', { n: buildCost(p, k, next) })} · ${t('{n}t', { n: B.turns[next] })}</button>`;
      }
      h += `<div class="bld"><div>${bName(k)} <span class="pips">${[1, 2, 3].map(i => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('')}</span><div class="lv">${lvl ? bLevel(k, lvl) : t('Not built')}</div></div>${right}</div>`;
    }
    h += '</div>';
    h += wonderSection(p);
  }
  if (!mine) h += foreignActions(p, tab);
  if (!mine && tab === 'deal') h += cityActionGroups(p, ['Dealings', 'Secret work']);
  if (!mine && tab === 'war') h += wonderSection(p);
  if (tab === 'rule' || tab === 'war') h += placeSection(p);
  const here = armiesIn(p.id);
  if (here.length && (tab === 'army' || tab === 'war')) {
    h += `<div class="p-sec"><h4>${t('Armies here')}</h4>` + here.map(a => armyRow(a)).join('') + '</div>';
  }
  return h;
}

// ---------- Someone else's province: war and diplomacy in one place ----------

function estimateDefence(p) {
  let s = 0;
  for (const a of armiesIn(p.id)) if (a.owner !== G.player && !allied(a.owner, G.player)) s += armyPower(a);
  if (p.b.walls) { for (const u of cityWatch(p)) s += unitPower(u); s *= 1 + 0.3 * p.b.walls; }
  return s;
}
function chanceWord(ratio) {
  return ratio > 2 ? [t('Easy victory'), 'good'] : ratio > 1.3 ? [t('Good odds'), 'good'] : ratio > 0.9 ? [t('Even fight'), 'warn'] : [t('Risky'), 'bad'];
}

function foreignActions(p, tab) {
  const o = p.owner, pl = G.player;
  let h = '';
  if (tab === 'deal') return h;
  // Who rules here
  if (o === 'rebels') {
    h += `<div class="p-sec"><h4>${t('Independent city')}</h4><p class="note">${t('Local lords hold {city} and answer to no khan. There is no one to bargain with: take it by force.', { city: cityOf(p) })}</p></div>`;
  } else {
    const r = rel(pl, o), st = G.factions[o];
    h += `<div class="p-sec"><h4>${t('Ruler')}</h4><div class="ruler">${rulerPortrait(o, 'p-portrait')}<div><b>${pn(st.leader)}</b><div class="p-sub">${fTitle(o)}</div>
      <div>${statusChips(pl, o)} <span style="color:${attitudeColor(r.att)}">${attitudeWord(r.att)}</span> ${t('towards you')}</div></div></div></div>`;
  }
  if (tab === 'dip') return h + diplomacySection(p);
  // Attack
  const def = estimateDefence(p);
  const opts = armiesOf(pl).map(a => ({ a, r: a.moves > 0 && !a.besieging ? reachable(a)[p.id] : null })).filter(x => x.r && x.r.kind !== 'move');
  h += `<div class="p-sec"><h4>${t('Attack {city}', { city: cityOf(p) })}</h4>`;
  if (opts.length) {
    h += '<div class="choices">' + opts.map(({ a, r }) => {
      const [w, c] = chanceWord(armyPower(a) / (def + 1));
      const name = a.general ? pn(a.general.name) : t('Army at {city}', { city: cityOf(G.provinces[a.prov]) });
      const how = p.b.walls && !armiesIn(p.id).some(x => x.owner === o) ? t('besiege the city') : t('attack');
      return `<button data-act="attackwith" data-id="${a.id}" class="${r.kind === 'blocked' ? 'warwarn' : ''}"><b>${name}</b><small>${t('{n} units', { n: a.units.length })} · ${how}${r.kind === 'blocked' ? ' · ' + t('means war') : ''} · <span class="${c}">${w}</span></small></button>`;
    }).join('') + '</div>';
  } else {
    const near = armiesOf(pl).filter(a => !a.besieging).sort((x, y) => Math.hypot(G.provinces[x.prov].x - p.x, G.provinces[x.prov].y - p.y) - Math.hypot(G.provinces[y.prov].x - p.x, G.provinces[y.prov].y - p.y))[0];
    h += `<p class="note">${t('None of your armies can reach {city} this turn.', { city: cityOf(p) })}</p>`;
    if (near) h += `<div class="btnrow"><button data-act="selarmy" data-id="${near.id}">${t('Select your nearest army ({city})', { city: cityOf(G.provinces[near.prov]) })}</button></div>`;
  }
  h += `<p class="note">${t('Defenders')}: ${def < 1 ? t('none to speak of') : strengthWord(def)}${p.b.walls ? ` · ${bLevel('walls', p.b.walls).toLowerCase()}` : ''}</p></div>`;
  return h;
}

function diplomacySection(p) {
  const o = p.owner, pl = G.player;
  let h = '';
  if (o !== 'rebels') {
    const r = rel(pl, o), gold = G.factions[pl].gold;
    const b = (type, label, extra = '', g = 0, dis = false) => `<button data-act="propose" data-type="${type}" data-g="${g}" ${dis ? 'disabled' : ''} class="${extra}">${label}</button>`;
    let btns = '';
    if (r.war) {
      btns += b('peace', t('Offer peace')) + b('peace', t('Peace + 500 gold'), '', 500, gold < 500) + b('submit', t('Demand surrender'));
    } else {
      btns += r.trade ? b('cancelTrade', t('Cancel trade')) : b('trade', t('Propose trade'));
      btns += r.alliance ? b('cancelAlliance', t('End alliance')) : b('alliance', t('Propose alliance'));
      if (!r.married) btns += b('marriage', t('Arrange a marriage'));
      btns += b('tribute', t('Demand tribute (~{n})', { n: fmt(tributeAmount(o)) }));
      btns += b('submit', t('Demand submission'));
      btns += b('war', t('Declare war'), 'danger');
    }
    btns += b('gift', t('Send {n} gold', { n: 200 }), '', 200, gold < 200) + b('gift', t('Send {n} gold', { n: fmt(1000) }), '', 1000, gold < 1000);
    h += `<div class="p-sec"><h4>${t('Diplomacy with {nation}', { nation: fName(o) })}</h4><div class="dipgrid">${btns}</div>`;
    if (UI.dipReply && UI.dipReply.f === o && UI.dipReply.t === G.turn) h += `<p class="reply ${UI.dipReply.ok ? 'good' : 'bad'}">“${UI.dipReply.text}”</p>`;
    h += `<p class="note">${t('“Demand submission” asks their ruler to hand you his whole realm without a fight. Only the weak and the beaten accept.')}</p></div>`;
  }
  return h;
}

function buildName(p) {
  return p.build.key === 'wonder' ? wName(p.build.id) : bLevel(p.build.key, p.b[p.build.key] + 1);
}

// The great monument that can rise in this city, if any
function wonderSection(p) {
  const id = wonderHere(p);
  if (!id) return '';
  const W = WONDERS[id];
  let h = `<div class="p-sec wonder"><h4>${t('Wonder of the age')}</h4><div class="w-name">${wName(id)}</div><p class="note">${t(W.desc)}</p>`;
  if (G.wonders && G.wonders[id]) h += `<p class="good">${p.owner === G.player ? t('Standing in all its glory. Its blessing is yours.') : t('Standing in all its glory. Its blessing belongs to: {nation}.', { nation: fName(p.owner) })}</p>`;
  else if (p.build && p.build.key === 'wonder') h += `<p class="warn">${t('Under construction: {n} turns left.', { n: p.build.turns })}</p>`;
  else if (p.owner === G.player) { const why = wonderCheck(p); h += `<button class="big" data-act="wonder" ${why ? 'disabled' : ''} title="${t(why || '')}">${t('Build it · {gold} gold · {n} turns', { gold: fmt(W.cost), n: W.turns })}</button>`; }
  else h += `<p class="note">${t('Take this city and you may build it.')}</p>`;
  return h + '</div>';
}

function unitTip(u) {
  const d = UNITS[u];
  const cls = { spear: 'Spear infantry, good against cavalry', inf: 'Heavy infantry', missile: 'Foot archers', cav: 'Shock cavalry', ha: 'Horse archers, strong on open steppe', siege: 'Siege engineers: halve the length of sieges and weaken walls in assaults' }[d.cls];
  return `${uName(u)}: ${t(cls)}. ` + t('{men} men, attack {atk}, defence {def}, morale {morale}.', { men: d.men, atk: d.atk, def: d.def, morale: d.morale }) +
    (d.missile ? ' ' + t('Missiles {n}.', { n: d.missile }) : '') + ' ' + t('Upkeep {n} per turn.', { n: unitUpkeep(u, FACTIONS[G.player].nomad) }) + (d.desc ? ' ' + t(d.desc) : '');
}

function armyRow(a) {
  const men = a.units.reduce((n, u) => n + u.men, 0);
  const name = a.general ? pn(a.general.name) : (a.owner === G.player ? t('Army without a general') : t('Army'));
  const extra = a.owner === G.player ? `${t('{n} units', { n: a.units.length })} · ${t('{n} men', { n: men })} · ${a.moves ? t('moves: {n}', { n: a.moves }) : t('no moves')}` : `${fName(a.owner)} · ${t('{n} units', { n: a.units.length })} · ${strengthWord(armyPower(a))}`;
  return `<div class="army-row" data-act="selarmy" data-id="${a.id}">${flagSVG(a.owner)}<div><div>${name}${a.besieging ? ` <span class="bad">(${t('besieging')})</span>` : ''}</div><div class="p-sub">${extra}</div></div></div>`;
}

function statusChips(a, b) {
  if (b === 'rebels') return `<span class="chip war">${t('Hostile')}</span>`;
  const r = rel(a, b);
  let h = r.war ? `<span class="chip war">${t('War')}</span>` : `<span class="chip peace">${t('Peace')}</span>`;
  if (r.alliance) h += `<span class="chip ally">${t('Allied')}</span>`;
  if (r.trade) h += `<span class="chip trade">${t('Trade')}</span>` + (routeRaided(a, b) ? `<span class="chip war">${t('Caravans robbed')}</span>` : '');
  if (r.married) h += `<span class="chip wed">${t('Marriage')}</span>`;
  return h;
}

// ---------- Army ----------

function armyPanel(a) {
  const mine = a.owner === G.player, p = G.provinces[a.prov];
  const F = FACTIONS[a.owner];
  const g = a.general;
  let h = `<div class="p-head">${g ? personPortrait(g.name, a.owner, g.age, 'p-portrait') : flagSVG(a.owner)}<div><div class="p-title">${g ? pn(g.name) : (mine ? t('Army') : t('{nation} army', { nation: fAdj(a.owner) }))}</div>` +
    `<div class="p-sub">${g ? `<span class="stars">${stars(Math.min(5, g.cmd))}</span> ${g.leader ? t('Ruler') + ' · ' : ''}${t('age {n}', { n: g.age })}` : t('Led by a captain')}</div>` +
    `<div class="p-sub">${fFull(a.owner)} · ${cityOf(p)}</div>${g ? traitChips(g.name) : ''}</div></div>`;
  const men = a.units.reduce((n, u) => n + u.men, 0);
  if (!mine) {
    h += `<p>${t('{n} units, about {men} men. Strength: {s}.', { n: a.units.length, men: fmt(Math.round(men / 50) * 50), s: `<b>${strengthWord(armyPower(a))}</b>` })}</p>`;
    h += '<div class="ucards">' + a.units.map(u => `<div class="ucard" title="${uName(u.type)}">${unitSVG(u.type, a.owner)}<div class="men">${uName(u.type).split(' ')[0]}</div></div>`).join('') + '</div>';
    if (a.owner !== 'rebels') h += `<div class="p-sec">${statusChips(G.player, a.owner)}</div>`;
    return h;
  }
  h += `<div class="kv"><div><span>${t('Units')}</span>${a.units.length} / ${GAME.MAX_ARMY}</div><div><span>${t('Men')}</span>${fmt(men)}</div>
    <div><span>${t('Moves left')}</span>${a.moves} / ${armyMoves(a)}</div><div><span>${t('Upkeep')}</span>${a.units.reduce((n, u) => n + unitUpkeep(u.type, F.nomad), 0)}</div></div>`;
  if (a.besieging && p.siege) {
    h += `<p class="note warn">${t('Besieging {city}: turn {turn}. The city should fall in about {n} turns, or you can storm the walls now.', { city: cityOf(p), turn: p.siege.turns + 1, n: siegeTurns(p) })}</p>`;
  } else if (a.moves > 0) h += `<p class="note">${t('Click a highlighted province to march. Red means battle or siege.')}</p>`;
  else h += `<p class="note">${t('This army has marched as far as it can this turn.')}</p>`;

  h += `<div class="p-sec"><h4>${t('Units')}</h4><div class="ucards">` + a.units.map((u, i) => {
    const d = UNITS[u.type];
    return `<div class="ucard ${unitPick.has(i) ? 'sel' : ''}" data-act="pickunit" data-i="${i}" title="${unitTip(u.type)}">${unitSVG(u.type, a.owner)}` +
      `<div class="men">${u.men}</div><div class="bar"><div style="width:${Math.round(u.men / d.men * 100)}%"></div></div>${u.exp ? `<span class="exp">${'▲'.repeat(u.exp)}</span>` : ''}</div>`;
  }).join('') + `</div><p class="note">${t('Click units to select them for splitting or disbanding.')}</p></div>`;

  const btns = [];
  if (a.besieging && p.siege) btns.push(`<button data-act="assault" class="danger">${t('Storm the walls')}</button>`);
  if (p.siege && p.owner === G.player) btns.push(`<button data-act="sally" class="danger">${t('Sally out')}</button>`);
  if (unitPick.size && unitPick.size < a.units.length) btns.push(`<button data-act="split">${t('Split off {n}', { n: unitPick.size })}</button>`);
  if (unitPick.size && ![...unitPick].some(i => a.units[i].type === 'general')) btns.push(`<button data-act="disband">${t('Disband {n}', { n: unitPick.size })}</button>`);
  const others = armiesIn(a.prov).filter(o => o !== a && o.owner === a.owner);
  for (const o of others) btns.push(`<button data-act="merge" data-id="${o.id}">${t('Merge with {name} ({n})', { name: o.general ? pn(o.general.name) : t('army'), n: o.units.length })}</button>`);
  if (!a.general) btns.push(`<button data-act="appoint" ${G.factions[a.owner].gold < GENERAL_COST ? 'disabled' : ''}>${t('Appoint a general · {n}g', { n: GENERAL_COST })}</button>`);
  if (!raidCheck(a)) btns.unshift(`<button data-act="raid" class="danger" title="${t('Burn villages and seize their grain and silver. The army cannot move again this turn.')}">${t('Plunder the countryside · +{n} gold', { n: fmt(raidGold(a)) })}</button>`);
  btns.push(`<button data-act="selprov" data-id="${a.prov}">${t('Province: {city}', { city: cityOf(p) })}</button>`);
  h += '<div class="btnrow">' + btns.join('') + '</div>';
  return h;
}

// ---------- City actions (js/engine/cityacts.js) ----------

function citySectionTax(p) {
  const cur = taxOf(p), own = p.tax !== undefined && p.tax !== null;
  const btns = TAX_LEVELS.map((l, i) => `<button data-act="citytax" data-k="${i}" class="${cur === i ? 'on' : ''}">${t(l)}</button>`).join('');
  return `<div class="p-sec"><h4>${t('City taxes')}</h4><div class="taxrow">${btns}</div>
    <p class="note">${p.taxFree > 0 ? t('Tax-free for {n} more turns.', { n: p.taxFree }) : own ? t('This city has its own tax rate.') + ` <a href="#" data-act="citytax" data-k="realm">${t('Use the realm’s rate')}</a>` : t('Following the realm’s tax rate (set in the Realm screen).')}</p></div>`;
}
function cityActionGroups(p, groups) {
  const list = cityActionsFor(p).filter(A => groups.includes(A.group));
  let h = '';
  for (const g of groups) {
    const acts = list.filter(A => A.group === g);
    if (!acts.length) continue;
    h += `<div class="p-sec"><h4>${t(g)}</h4><div class="decrees">` + acts.map(A => {
      const why = A.check(p), c = A.cost(p);
      return `<button data-act="cityact" data-k="${A.id}" class="${A.danger ? 'danger-soft' : ''}" ${why ? 'disabled' : ''} title="${t(why || A.desc)}"><b>${t(A.name)}</b><small>${why ? t(why) : c ? t('−{n} gold', { n: fmt(c) }) : A.sub ? A.sub(p) : ''}</small></button>`;
    }).join('') + '</div></div>';
  }
  return h;
}
async function doCityAction(p, id) {
  const A = CITY_ACTIONS.find(x => x.id === id);
  if (!A || A.check(p)) return;
  let f = null;
  if (A.pick) {
    const opts = A.pick(p);
    f = await showModal(`<h3>${t(A.name)}</h3><p>${t(A.desc)}</p>`, opts.map(o => ({ label: `${fFull(o)} · ${attitudeWord(rel(G.player, o).att)}`, value: o })).concat([{ label: t('Cancel'), value: null }]), { cancel: null });
    if (!f) return;
  } else if (A.danger && !(await confirmBox(t(A.name), t(A.desc), t('Do it'), t('Not yet')))) return;
  const city = cityOf(p), text = A.act(p, f);
  log(dateText() + ': ' + text, 'event');
  sfx(A.cost(p) ? 'coins' : 'click');
  toast(t(A.name), text, p.owner === G.player || A.own ? 'good' : '');
  if (p.owner === G.player && !A.own) HOOKS.notify({ scene: { kind: 'conquest', prov: p.id, from: null, sack: false, capital: false } });
  if (A.own && p.owner !== G.player) { UI.selProv = null; }
  checkMission();
  refresh();
  checkOverUI();
}

// ---------- Panel clicks ----------

$('panel').addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el || !G || uiLocked()) return;
  const act = el.dataset.act;
  const p = UI.selProv && G.provinces[UI.selProv];
  const a = UI.selArmy && G.armies[UI.selArmy];
  let err = null;
  switch (act) {
    case 'close': UI.selArmy = null; UI.selProv = null; break;
    case 'ptab': UI.ptab = el.dataset.k; break;
    case 'citytax': e.preventDefault(); setCityTax(p, el.dataset.k === 'realm' ? null : +el.dataset.k); break;
    case 'cityact': await doCityAction(p, el.dataset.k); return;
    case 'build': err = startBuild(p, el.dataset.k); if (!err) sfx('build'); break;
    case 'cancelbuild': cancelBuild(p); break;
    case 'recruit': if (el.classList.contains('off')) return; err = recruit(p, el.dataset.t); if (!err) sfx('coins', { vol: 0.7 }); break;
    case 'unqueue': cancelRecruit(p, +el.dataset.i); break;
    case 'selarmy': UI.selArmy = el.dataset.id; UI.selProv = G.armies[el.dataset.id].prov; break;
    case 'selprov': UI.selArmy = null; UI.selProv = el.dataset.id; break;
    case 'dip': openDiplomacy(el.dataset.f); return;
    case 'pickunit': { const i = +el.dataset.i; if (unitPick.has(i)) unitPick.delete(i); else unitPick.add(i); break; }
    case 'split': { const b = splitArmy(a, [...unitPick]); unitPick.clear(); if (b) UI.selArmy = b.id; break; }
    case 'disband': {
      const idx = [...unitPick].sort((x, y) => y - x);
      if (!(await confirmBox(t('Disband units'), t('Send {n} units home for good? This cannot be undone.', { n: idx.length })))) return;
      for (const i of idx) disbandUnit(a, i);
      unitPick.clear();
      break;
    }
    case 'merge': err = mergeArmies(a, G.armies[el.dataset.id]); unitPick.clear(); break;
    case 'appoint': err = appointGeneral(a); if (!err) toast(t('A new general'), t('{name} takes command of the army.', { name: pn(a.general.name) }), 'good'); break;
    case 'decree': err = issueDecree(p, el.dataset.k); if (!err) toast(t(DECREES[el.dataset.k].name), t('{city} obeys your decree.', { city: cityOf(p) }), 'good'); break;
    case 'attackwith': {
      const army = G.armies[el.dataset.id];
      UI.selArmy = army.id;
      UI.reach = reachable(army);
      await orderMove(army, p.id);
      return;
    }
    case 'propose': {
      const f = p.owner, type = el.dataset.type, gold = +el.dataset.g;
      if (type === 'war' && !(await confirmBox(t('Declare war?'), t('Your envoys will carry a declaration of war to {ruler}.', { ruler: pn(G.factions[f].leader) }) + (rel(G.player, f).alliance || rel(G.player, f).truce > 0 ? ' ' + t('Breaking a treaty will make every ruler trust you less.') : ''), t('Declare war'), t('Not yet')))) return;
      const res = propose(f, type, gold);
      UI.dipReply = { f, text: res.text, ok: res.ok, t: G.turn };
      if (type === 'submit' && res.ok) { UI.selProv = p.id; }
      refresh();
      checkOverUI();
      return;
    }
    case 'assault': await doAssault(a.prov); return;
    case 'raid': { const r = raid(a); if (r.why) err = r.why; else toast(t('Plunder'), t('Your army returns laden with loot: {n} gold.', { n: fmt(r.gold) }), 'good'); break; }
    case 'viewplace': { const ctx = storyContext(G.player); ctx.lp = p; playScene({ kind: 'place', id: el.dataset.k, ctx, replay: true }); return; }
    case 'wonder': err = startWonder(p); if (!err) toast(t('The work begins'), t('Masons gather in {city} to raise the {wonder}.', { city: cityOf(p), wonder: wName(p.build.id) }), 'good'); break;
    case 'sally': await doSally(a.prov); return;
  }
  if (err) toast(t('Cannot do that'), t(err), 'bad');
  refresh();
});

function toast(title, text, kind) {
  const box = $('toasts');
  const d = document.createElement('div');
  d.className = 'toast ' + (kind || '');
  d.innerHTML = `<b>${title}</b>${text || ''}`;
  box.appendChild(d);
  while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => d.remove(), 6000);
}
