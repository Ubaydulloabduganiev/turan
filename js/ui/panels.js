'use strict';
// The side panel: details and commands for the selected province or army, plus the top bar.

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');
let unitPick = new Set(); // selected unit indexes in the army panel
let lastArmyShown = null;

function refresh() {
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
  $('tb-faction').innerHTML = flagSVG(pl) + `<span>${st.leader}<small>${FACTIONS[pl].title}</small></span>`;
  $('tb-gold').textContent = fmt(st.gold);
  const net = factionIncome(pl) - factionUpkeep(pl);
  $('tb-net').textContent = (net >= 0 ? '+' : '') + fmt(net);
  $('tb-net').className = net < 0 ? 'neg' : '';
  $('tb-provs').textContent = provsOf(pl).length + ' provinces';
  $('tb-nations').textContent = nationsLeft().length + ' nations left';
  $('tb-date').textContent = dateText();
}

function orderInfo(o) {
  if (o >= 80) return ['Content', 'good'];
  if (o >= 55) return ['Calm', ''];
  if (o >= 35) return ['Restless', 'warn'];
  return ['Rebellious', 'bad'];
}

function renderPanel() {
  const panel = $('panel');
  const a = UI.selArmy && G.armies[UI.selArmy];
  const p = UI.selProv && G.provinces[UI.selProv];
  if (!a && !p) { panel.classList.add('hidden'); UI.panelOpen = false; return; }
  panel.classList.remove('hidden');
  UI.panelOpen = true;
  if (a) { if (lastArmyShown !== a.id) unitPick.clear(); lastArmyShown = a.id; }
  panel.innerHTML = '<button class="close" data-act="close" title="Close (Esc)">×</button>' + (a ? armyPanel(a) : provincePanel(p));
}

// ---------- Province ----------

function provincePanel(p) {
  const mine = p.owner === G.player;
  const F = FACTIONS[p.owner];
  const dist = distancesFrom(p.owner);
  const order = provinceOrder(p, dist);
  const [ow, oc] = orderInfo(order);
  let h = `<div class="p-head">${flagSVG(p.owner)}<div><div class="p-title">${p.city}</div><div class="p-sub">${p.name} · ${F.full}</div></div></div>`;
  h += `<div class="kv">
    <div><span>Population</span>${fmt(p.pop * 1000)}</div>
    <div><span>Terrain</span>${TERRAIN[p.terrain].name}</div>
    <div><span>Walls</span>${BUILDINGS.walls.levels[p.b.walls]}</div>
    <div><span>Silk Road</span>${p.silk ? 'Yes' : 'No'}</div>`;
  if (mine) h += `<div><span>Public order</span><b class="${oc}">${Math.min(100, order)}% ${ow}</b></div><div><span>Income</span>${fmt(provinceIncome(p, order))}</div>`;
  h += '</div>';
  if (p.siege) h += `<p class="note bad">Besieged by the ${FACTIONS[p.siege.by].full}. The city can hold out about ${siegeTurns(p)} more turn(s).</p>`;
  if (mine && order < 35) h += `<p class="note bad">The people are close to revolt. Lower taxes, build a mosque or station troops here.</p>`;
  if (p.sacked > 0) h += `<p class="note warn">The city is still recovering from a sack.</p>`;

  if (mine) {
    h += '<div class="p-sec"><h4>Royal decrees</h4><div class="decrees">' + Object.keys(DECREES).map(k => {
      const D = DECREES[k], why = decreeCheck(p, k);
      const price = k === 'feast' ? `−${fmt(D.cost(p))} gold` : k === 'tax' ? `+${fmt(D.gain(p))} gold` : '+2 militia';
      return `<button data-act="decree" data-k="${k}" ${why ? 'disabled' : ''} title="${why || D.desc}"><b>${D.name}</b><small>${price}</small></button>`;
    }).join('') + '</div>' + (p.decree === G.turn ? '<p class="note">You have already issued a decree here this turn.</p>' : '') + '</div>';

    h += '<div class="p-sec"><h4>Recruit</h4>';
    const list = recruitable(p);
    if (!list.length) h += '<p class="note">Build barracks or stables to train troops here.</p>';
    else {
      h += '<div class="recruit-grid">' + list.map(t => {
        const d = UNITS[t], ok = G.factions[p.owner].gold >= d.cost && p.queue.length < QUEUE_MAX;
        return `<div class="rcard ${ok ? '' : 'off'}" data-act="recruit" data-t="${t}" title="${unitTip(t)}">${unitSVG(t, p.owner)}<div>${d.name}</div><div class="c">${d.cost}g</div></div>`;
      }).join('') + '</div>';
    }
    if (p.queue.length) {
      h += '<p class="note">In training (ready next turn, two at a time). Click to cancel:</p><div class="queue">' +
        p.queue.map((t, i) => `<div class="rcard" data-act="unqueue" data-i="${i}" title="Cancel and refund">${unitSVG(t, p.owner)}<div>${UNITS[t].name}</div></div>`).join('') + '</div>';
    }
    h += '</div>';

    h += '<div class="p-sec"><h4>Buildings</h4>';
    if (p.build) {
      const k = p.build.key;
      h += `<p class="note">Building <b>${buildName(p)}</b>: ${p.build.turns} turn(s) left <button class="small" data-act="cancelbuild">Cancel</button></p>`;
    }
    for (const k of BUILDING_ORDER) {
      const B = BUILDINGS[k], lvl = p.b[k], next = lvl + 1;
      let right = '';
      if (next <= 3) {
        const why = buildCheck(p, k);
        right = `<button class="small" data-act="build" data-k="${k}" ${why ? 'disabled' : ''} title="${why || B.desc}">${B.levels[next]} · ${B.cost[next]}g · ${B.turns[next]}t</button>`;
      }
      h += `<div class="bld"><div>${B.name} <span class="pips">${[1, 2, 3].map(i => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('')}</span><div class="lv">${lvl ? B.levels[lvl] : 'Not built'}</div></div>${right}</div>`;
    }
    h += '</div>';
  } else {
    h += foreignActions(p);
  }

  h += wonderSection(p);
  const here = armiesIn(p.id);
  if (here.length) {
    h += '<div class="p-sec"><h4>Armies here</h4>' + here.map(a => armyRow(a)).join('') + '</div>';
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
  return ratio > 2 ? ['Easy victory', 'good'] : ratio > 1.3 ? ['Good odds', 'good'] : ratio > 0.9 ? ['Even fight', 'warn'] : ['Risky', 'bad'];
}

function foreignActions(p) {
  const o = p.owner, pl = G.player;
  let h = '';
  // Who rules here
  if (o === 'rebels') {
    h += `<div class="p-sec"><h4>Independent city</h4><p class="note">Local lords hold ${p.city} and answer to no khan. There is no one to bargain with: take it by force.</p></div>`;
  } else {
    const r = rel(pl, o), st = G.factions[o];
    h += `<div class="p-sec"><h4>Ruler</h4><div class="ruler">${flagSVG(o)}<div><b>${st.leader}</b><div class="p-sub">${FACTIONS[o].title}</div>
      <div>${statusChips(pl, o)} <span style="color:${attitudeColor(r.att)}">${attitudeWord(r.att)}</span> towards you</div></div></div></div>`;
  }
  // Attack
  const def = estimateDefence(p);
  const opts = armiesOf(pl).map(a => ({ a, r: a.moves > 0 && !a.besieging ? reachable(a)[p.id] : null })).filter(x => x.r && x.r.kind !== 'move');
  h += `<div class="p-sec"><h4>Attack ${p.city}</h4>`;
  if (opts.length) {
    h += '<div class="choices">' + opts.map(({ a, r }) => {
      const [w, c] = chanceWord(armyPower(a) / (def + 1));
      const name = a.general ? a.general.name : 'Army at ' + G.provinces[a.prov].city;
      const how = p.b.walls && !armiesIn(p.id).some(x => x.owner === o) ? 'besiege the city' : 'attack';
      return `<button data-act="attackwith" data-id="${a.id}" class="${r.kind === 'blocked' ? 'warwarn' : ''}"><b>${name}</b><small>${a.units.length} units · ${how}${r.kind === 'blocked' ? ' · means war' : ''} · <span class="${c}">${w}</span></small></button>`;
    }).join('') + '</div>';
  } else {
    const near = armiesOf(pl).filter(a => !a.besieging).sort((x, y) => Math.hypot(G.provinces[x.prov].x - p.x, G.provinces[x.prov].y - p.y) - Math.hypot(G.provinces[y.prov].x - p.x, G.provinces[y.prov].y - p.y))[0];
    h += `<p class="note">None of your armies can reach ${p.city} this turn.</p>`;
    if (near) h += `<div class="btnrow"><button data-act="selarmy" data-id="${near.id}">Select your nearest army (${G.provinces[near.prov].city})</button></div>`;
  }
  h += `<p class="note">Defenders: ${def < 1 ? 'none to speak of' : strengthWord(def)}${p.b.walls ? ` · ${BUILDINGS.walls.levels[p.b.walls].toLowerCase()}` : ''}</p></div>`;
  // Diplomacy
  if (o !== 'rebels') {
    const r = rel(pl, o), gold = G.factions[pl].gold;
    const b = (type, label, extra = '', g = 0, dis = false) => `<button data-act="propose" data-type="${type}" data-g="${g}" ${dis ? 'disabled' : ''} class="${extra}">${label}</button>`;
    let btns = '';
    if (r.war) {
      btns += b('peace', 'Offer peace') + b('peace', 'Peace + 500 gold', '', 500, gold < 500) + b('submit', 'Demand surrender');
    } else {
      btns += r.trade ? b('cancelTrade', 'Cancel trade') : b('trade', 'Propose trade');
      btns += r.alliance ? b('cancelAlliance', 'End alliance') : b('alliance', 'Propose alliance');
      if (!r.married) btns += b('marriage', 'Arrange a marriage');
      btns += b('tribute', `Demand tribute (~${fmt(tributeAmount(o))})`);
      btns += b('submit', 'Demand submission');
      btns += b('war', 'Declare war', 'danger');
    }
    btns += b('gift', 'Send 200 gold', '', 200, gold < 200) + b('gift', 'Send 1000 gold', '', 1000, gold < 1000);
    h += `<div class="p-sec"><h4>Diplomacy with ${FACTIONS[o].name}</h4><div class="dipgrid">${btns}</div>`;
    if (UI.dipReply && UI.dipReply.f === o && UI.dipReply.t === G.turn) h += `<p class="reply ${UI.dipReply.ok ? 'good' : 'bad'}">“${UI.dipReply.text}”</p>`;
    h += `<p class="note">“Demand submission” asks their ruler to hand you his whole realm without a fight. Only the weak and the beaten accept.</p></div>`;
  }
  return h;
}

function buildName(p) {
  return p.build.key === 'wonder' ? WONDERS[p.build.id].name : BUILDINGS[p.build.key].levels[p.b[p.build.key] + 1];
}

// The great monument that can rise in this city, if any
function wonderSection(p) {
  const id = wonderHere(p);
  if (!id) return '';
  const W = WONDERS[id];
  let h = `<div class="p-sec wonder"><h4>Wonder of the age</h4><div class="w-name">${W.name}</div><p class="note">${W.desc}</p>`;
  if (G.wonders && G.wonders[id]) h += `<p class="good">Standing in all its glory${p.owner === G.player ? '. Its blessing is yours.' : `. Its blessing belongs to the ${FACTIONS[p.owner].name}.`}</p>`;
  else if (p.build && p.build.key === 'wonder') h += `<p class="warn">Under construction: ${p.build.turns} turn(s) left.</p>`;
  else if (p.owner === G.player) { const why = wonderCheck(p); h += `<button class="big" data-act="wonder" ${why ? 'disabled' : ''} title="${why || ''}">Build it · ${fmt(W.cost)} gold · ${W.turns} turns</button>`; }
  else h += '<p class="note">Take this city and you may build it.</p>';
  return h + '</div>';
}

function unitTip(t) {
  const d = UNITS[t];
  const cls = { spear: 'Spear infantry, good against cavalry', inf: 'Heavy infantry', missile: 'Foot archers', cav: 'Shock cavalry', ha: 'Horse archers, strong on open steppe', siege: 'Siege engineers: halve the length of sieges and weaken walls in assaults' }[d.cls];
  return `${d.name}: ${cls}. ${d.men} men, attack ${d.atk}${d.missile ? ', missiles ' + d.missile : ''}, defence ${d.def}, morale ${d.morale}. Upkeep ${unitUpkeep(t, FACTIONS[G.player].nomad)}/turn.${d.desc ? ' ' + d.desc : ''}`;
}

function armyRow(a) {
  const men = a.units.reduce((n, u) => n + u.men, 0);
  const name = a.general ? a.general.name : (a.owner === G.player ? 'Army without a general' : 'Army');
  const extra = a.owner === G.player ? `${a.units.length} units · ${men} men · ${a.moves ? a.moves + ' move' + (a.moves > 1 ? 's' : '') : 'no moves'}` : `${FACTIONS[a.owner].name} · ${a.units.length} units · ${strengthWord(armyPower(a))}`;
  return `<div class="army-row" data-act="selarmy" data-id="${a.id}">${flagSVG(a.owner)}<div><div>${name}${a.besieging ? ' <span class="bad">(besieging)</span>' : ''}</div><div class="p-sub">${extra}</div></div></div>`;
}

function statusChips(a, b) {
  if (b === 'rebels') return '<span class="chip war">Hostile</span>';
  const r = rel(a, b);
  let h = r.war ? '<span class="chip war">War</span>' : '<span class="chip peace">Peace</span>';
  if (r.alliance) h += '<span class="chip ally">Allied</span>';
  if (r.trade) h += '<span class="chip trade">Trade</span>';
  if (r.married) h += '<span class="chip wed">Marriage</span>';
  return h;
}

// ---------- Army ----------

function armyPanel(a) {
  const mine = a.owner === G.player, p = G.provinces[a.prov];
  const F = FACTIONS[a.owner];
  const g = a.general;
  let h = `<div class="p-head">${flagSVG(a.owner)}<div><div class="p-title">${g ? g.name : (mine ? 'Army' : F.adj + ' army')}</div>` +
    `<div class="p-sub">${g ? `<span class="stars">${stars(Math.min(5, g.cmd))}</span> ${g.leader ? 'Ruler · ' : ''}age ${g.age}` : 'Led by a captain'}</div>` +
    `<div class="p-sub">${F.full} · at ${p.city}</div></div></div>`;
  const men = a.units.reduce((n, u) => n + u.men, 0);
  if (!mine) {
    h += `<p>${a.units.length} units, about ${fmt(Math.round(men / 50) * 50)} men. Strength: <b>${strengthWord(armyPower(a))}</b>.</p>`;
    h += '<div class="ucards">' + a.units.map(u => `<div class="ucard" title="${UNITS[u.type].name}">${unitSVG(u.type, a.owner)}<div class="men">${UNITS[u.type].name.split(' ')[0]}</div></div>`).join('') + '</div>';
    if (a.owner !== 'rebels') h += `<div class="p-sec">${statusChips(G.player, a.owner)}</div>`;
    return h;
  }
  h += `<div class="kv"><div><span>Units</span>${a.units.length} / ${GAME.MAX_ARMY}</div><div><span>Men</span>${fmt(men)}</div>
    <div><span>Moves left</span>${a.moves} / ${armyMoves(a)}</div><div><span>Upkeep</span>${a.units.reduce((n, u) => n + unitUpkeep(u.type, F.nomad), 0)}</div></div>`;
  if (a.besieging && p.siege) {
    h += `<p class="note warn">Besieging ${p.city}: turn ${p.siege.turns + 1}. The city should fall in about ${siegeTurns(p)} turn(s), or you can storm the walls now.</p>`;
  } else if (a.moves > 0) h += `<p class="note">Click a highlighted province to march. Red means battle or siege.</p>`;
  else h += `<p class="note">This army has marched as far as it can this turn.</p>`;

  h += '<div class="p-sec"><h4>Units</h4><div class="ucards">' + a.units.map((u, i) => {
    const d = UNITS[u.type];
    return `<div class="ucard ${unitPick.has(i) ? 'sel' : ''}" data-act="pickunit" data-i="${i}" title="${unitTip(u.type)}">${unitSVG(u.type, a.owner)}` +
      `<div class="men">${u.men}</div><div class="bar"><div style="width:${Math.round(u.men / d.men * 100)}%"></div></div>${u.exp ? `<span class="exp">${'▲'.repeat(u.exp)}</span>` : ''}</div>`;
  }).join('') + '</div><p class="note">Click units to select them for splitting or disbanding.</p></div>';

  const btns = [];
  if (a.besieging && p.siege) btns.push('<button data-act="assault" class="danger">Storm the walls</button>');
  if (p.siege && p.owner === G.player) btns.push('<button data-act="sally" class="danger">Sally out</button>');
  if (unitPick.size && unitPick.size < a.units.length) btns.push(`<button data-act="split">Split off ${unitPick.size}</button>`);
  if (unitPick.size && ![...unitPick].some(i => a.units[i].type === 'general')) btns.push(`<button data-act="disband">Disband ${unitPick.size}</button>`);
  const others = armiesIn(a.prov).filter(o => o !== a && o.owner === a.owner);
  for (const o of others) btns.push(`<button data-act="merge" data-id="${o.id}">Merge with ${o.general ? o.general.name : 'army'} (${o.units.length})</button>`);
  if (!a.general) btns.push(`<button data-act="appoint" ${G.factions[a.owner].gold < GENERAL_COST ? 'disabled' : ''}>Appoint a general · ${GENERAL_COST}g</button>`);
  if (!raidCheck(a)) btns.unshift(`<button data-act="raid" class="danger" title="Burn villages and seize their grain and silver. The army cannot move again this turn.">Plunder the countryside · +${fmt(raidGold(a))} gold</button>`);
  btns.push(`<button data-act="selprov" data-id="${a.prov}">Province: ${p.city}</button>`);
  h += '<div class="btnrow">' + btns.join('') + '</div>';
  return h;
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
    case 'build': err = startBuild(p, el.dataset.k); break;
    case 'cancelbuild': cancelBuild(p); break;
    case 'recruit': if (el.classList.contains('off')) return; err = recruit(p, el.dataset.t); break;
    case 'unqueue': cancelRecruit(p, +el.dataset.i); break;
    case 'selarmy': UI.selArmy = el.dataset.id; UI.selProv = G.armies[el.dataset.id].prov; break;
    case 'selprov': UI.selArmy = null; UI.selProv = el.dataset.id; break;
    case 'dip': openDiplomacy(el.dataset.f); return;
    case 'pickunit': { const i = +el.dataset.i; if (unitPick.has(i)) unitPick.delete(i); else unitPick.add(i); break; }
    case 'split': { const b = splitArmy(a, [...unitPick]); unitPick.clear(); if (b) UI.selArmy = b.id; break; }
    case 'disband': {
      const idx = [...unitPick].sort((x, y) => y - x);
      if (!(await confirmBox('Disband units', `Send ${idx.length} unit(s) home for good? This cannot be undone.`))) return;
      for (const i of idx) disbandUnit(a, i);
      unitPick.clear();
      break;
    }
    case 'merge': err = mergeArmies(a, G.armies[el.dataset.id]); unitPick.clear(); break;
    case 'appoint': err = appointGeneral(a); if (!err) toast('A new general', `${a.general.name} takes command of the army.`, 'good'); break;
    case 'decree': err = issueDecree(p, el.dataset.k); if (!err) toast(DECREES[el.dataset.k].name, `${p.city} obeys your decree.`, 'good'); break;
    case 'attackwith': {
      const army = G.armies[el.dataset.id];
      UI.selArmy = army.id;
      UI.reach = reachable(army);
      await orderMove(army, p.id);
      return;
    }
    case 'propose': {
      const f = p.owner, type = el.dataset.type, gold = +el.dataset.g;
      if (type === 'war' && !(await confirmBox('Declare war?', `Your envoys will carry a declaration of war to ${G.factions[f].leader}.${rel(G.player, f).alliance || rel(G.player, f).truce > 0 ? ' Breaking a treaty will make every ruler trust you less.' : ''}`, 'Declare war', 'Not yet'))) return;
      const res = propose(f, type, gold);
      UI.dipReply = { f, text: res.text, ok: res.ok, t: G.turn };
      if (type === 'submit' && res.ok) { UI.selProv = p.id; }
      refresh();
      checkOverUI();
      return;
    }
    case 'assault': await doAssault(a.prov); return;
    case 'raid': { const r = raid(a); if (r.why) err = r.why; else toast('Plunder', `Your army returns laden with loot: ${fmt(r.gold)} gold.`, 'good'); break; }
    case 'wonder': err = startWonder(p); if (!err) toast('The work begins', `Masons gather in ${p.city} to raise the ${WONDERS[p.build.id].name}.`, 'good'); break;
    case 'sally': await doSally(a.prov); return;
  }
  if (err) toast('Cannot do that', err, 'bad');
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
