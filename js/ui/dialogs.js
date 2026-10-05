'use strict';
// Modal windows and the order flows that need them: battles, captures, diplomacy, the realm, saving.

let modalResolve = null, modalOpen = false;
const notices = [];

function uiLocked() { return modalOpen || turnBusy || !$('battle').classList.contains('hidden'); }

// buttons: [{ label, value, cls }]. Resolves with the clicked value (or `cancel` on Escape).
function showModal(html, buttons, opts = {}) {
  return new Promise(resolve => {
    if (modalResolve) modalResolve(opts.cancel);
    modalOpen = true;
    const m = $('modal');
    m.className = opts.cls || '';
    m.innerHTML = html + (buttons && buttons.length ? '<div class="actions">' + buttons.map((b, i) =>
      `<button data-mi="${i}" class="${b.cls || ''}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`).join('') + '</div>' : '');
    $('modal-wrap').classList.remove('hidden');
    modalResolve = v => {
      modalResolve = null; modalOpen = false;
      $('modal-wrap').classList.add('hidden');
      resolve(v);
    };
    m.onclick = e => {
      const b = e.target.closest('[data-mi]');
      if (b && modalResolve) { const btn = buttons[+b.dataset.mi]; modalResolve(btn ? btn.value : opts.pickIndex ? +b.dataset.mi : opts.cancel); }
      else if (opts.onClick) opts.onClick(e);
    };
    m._cancel = opts.cancel;
    if (opts.onOpen) opts.onOpen(m);
  });
}
function closeModal(v) { if (modalResolve) modalResolve(v === undefined ? $('modal')._cancel : v); }

function confirmBox(title, text, yes = 'Yes', no = 'No') {
  return showModal(`<h3>${title}</h3><p>${text}</p>`, [{ label: no, value: false }, { label: yes, value: true, cls: 'big' }], { cancel: false });
}
function infoBox(title, text, opts = {}) {
  return showModal(`<h3>${title}</h3>${text.startsWith('<') ? text : `<p>${text}</p>`}`, [{ label: 'Continue', value: true, cls: 'big' }], { cancel: true, ...opts });
}

// ---------- Notices from the engine ----------

let quietNotices = false;
function pushNotice(n) {
  if (quietNotices) return;
  if (n.minor) { toast(n.title, n.text); return; }
  notices.push(n);
  if (!turnBusy && !modalOpen) flushNotices();
}
async function flushNotices() {
  while (notices.length) {
    const n = notices.shift();
    await infoBox(n.title, n.text, { cls: n.history ? 'parch' : '' });
    if (n.prov && G) { UI.selProv = n.prov; UI.selArmy = null; centerOnProv(n.prov); refresh(); }
  }
}

// ---------- A choice for the ruler ----------

async function showStory({ story, ctx }) {
  const opts = story.options.map((o, i) => `<button class="choice" data-mi="${i}"><b>${o.label(ctx)}</b><small>${o.hint}</small></button>`).join('');
  const i = await showModal(`<h3>${story.title}</h3><p>${story.text(ctx)}</p><div class="choices story">${opts}</div>`, [], { cls: 'parch', cancel: 0, pickIndex: true });
  const result = story.options[i || 0].act(ctx);
  log(`${dateText()}: ${story.title}. ${result}`, 'event');
  refresh();
  await showModal(`<h3>${story.title}</h3><p>${result}</p>`, [{ label: 'Continue', value: true, cls: 'big' }], { cls: 'parch', cancel: true });
  checkMission();
  await flushNotices();
}

// ---------- Battles ----------

function sideList(side) {
  const rows = [];
  for (const id of side.armies) { const a = G.armies[id]; if (a) for (const u of a.units) rows.push(u); }
  for (const u of side.extra) rows.push(u);
  const by = {};
  for (const u of rows) { by[u.type] = by[u.type] || { n: 0, men: 0 }; by[u.type].n++; by[u.type].men += u.men; }
  return Object.keys(by).map(t => `<li><span>${by[t].n}× ${UNITS[t].name}</span><span>${by[t].men}</span></li>`).join('');
}

function battleHTML(b, title, intro) {
  const odds = battleOdds(b);
  const pAtt = b.att.faction === G.player;
  const mine = pAtt ? odds : 1 - odds;
  const p = G.provinces[b.prov];
  const g1 = sideGeneral(b.att), g2 = sideGeneral(b.def);
  const kindText = { field: 'Open battle', assault: `Storming the walls (${BUILDINGS.walls.levels[p.b.walls]})`, sally: 'The garrison sallies out' }[b.kind];
  const word = mine > 0.8 ? 'Decisive advantage' : mine > 0.6 ? 'Favourable' : mine > 0.4 ? 'Even' : mine > 0.2 ? 'Unfavourable' : 'Hopeless';
  return `<h3>${title}</h3><p>${intro || ''} ${kindText} at ${p.city}, ${TERRAIN[p.terrain].name.toLowerCase()}.</p>
    <div class="vs">
      <div class="side"><h4>${flagSVG(b.att.faction, 'flag')}${FACTIONS[b.att.faction].name}</h4><div class="p-sub">${g1 ? g1.name + ' ' + stars(Math.min(5, g1.cmd)) : 'No general'}</div><ul>${sideList(b.att)}</ul><div class="p-sub">${menOf(b.att)} men</div></div>
      <div class="mid">⚔</div>
      <div class="side"><h4>${flagSVG(b.def.faction, 'flag')}${FACTIONS[b.def.faction].name}</h4><div class="p-sub">${g2 ? g2.name + ' ' + stars(Math.min(5, g2.cmd)) : 'No general'}</div><ul>${sideList(b.def)}</ul><div class="p-sub">${menOf(b.def)} men</div></div>
    </div>
    <div class="odds"><div style="width:${odds * 100}%;background:${FACTIONS[b.att.faction].color}"></div><div style="flex:1;background:${FACTIONS[b.def.faction].color}"></div></div>
    <p class="note">Your chances: <b>${word}</b>${b.walls ? '. Defenders on the walls fight much harder; siege engineers help.' : '.'}</p>`;
}

// Asks the player how to fight a battle they started. Returns 'fight', 'auto' or null.
function battleChoice(b, title, intro) {
  return showModal(battleHTML(b, title, intro), [
    { label: 'Cancel', value: null },
    { label: 'Auto-resolve', value: 'auto' },
    { label: 'Fight the battle', value: 'fight', cls: 'big' },
  ], { cancel: null, cls: 'wide' });
}

function menIn(ids) { let n = 0; for (const id of ids) { const a = G.armies[id]; if (a) for (const u of a.units) n += u.men; } return n; }

async function showBattleResult(out, b, before) {
  const after = { att: menIn(b.att.armies), def: menIn(b.def.armies) };
  const won = out.playerWon;
  const p = G.provinces[b.prov];
  const lossA = before.att - after.att, lossD = before.def - after.def;
  await showModal(`<h3>${won ? 'Victory' : 'Defeat'} at ${p.city}</h3>
    <p>${out.text}</p>
    <div class="vs"><div class="side"><h4>${flagSVG(b.att.faction, 'flag')}${FACTIONS[b.att.faction].name}</h4><p>Lost ${fmt(Math.max(0, lossA))} of ${fmt(before.att)} men</p></div>
    <div class="mid">⚔</div><div class="side"><h4>${flagSVG(b.def.faction, 'flag')}${FACTIONS[b.def.faction].name}</h4><p>Lost ${fmt(Math.max(0, lossD))} of ${fmt(before.def)} men</p></div></div>`,
    [{ label: 'Continue', value: true, cls: 'big' }], { cancel: true, cls: won ? '' : '' });
}

async function afterCapture(pid, ownerBefore) {
  const p = G.provinces[pid];
  if (p.owner !== G.player || ownerBefore === G.player) return;
  const extra = Math.round(p.pop * 17);
  const v = await showModal(`<h3>${p.city} is ours</h3><p>The gates are open and the city lies at your feet. What shall be done with its people?</p>
    <p><b>Occupy:</b> protect the people and keep the city prosperous.<br><b>Sack:</b> let the army plunder for about <b>${fmt(extra)} gold</b>. Many will die or flee, the city will hate you, and other rulers will think worse of you.</p>`,
    [{ label: 'Sack the city', value: 'sack', cls: 'danger' }, { label: 'Occupy', value: 'occupy', cls: 'big' }], { cancel: 'occupy' });
  if (v === 'sack') { const g = sackProvince(p); toast('City sacked', `The army carries off ${fmt(g)} gold.`, 'bad'); }
}

// Moves the selected army towards a province, fighting if needed.
async function orderMove(a, pid) {
  let r = UI.reach && UI.reach[pid];
  if (!r) {
    if (a.moves <= 0) toast('No moves left', 'This army has already marched this turn.', 'bad');
    else toast('Too far', 'That province cannot be reached this turn.', 'bad');
    return;
  }
  if (r.kind === 'blocked') {
    const o = G.provinces[pid].owner;
    if (!(await confirmBox('Declare war?', `We are at peace with the ${FACTIONS[o].full}. Marching into ${G.provinces[pid].city} means war${rel(G.player, o).alliance ? ' and the end of our alliance' : ''}${rel(G.player, o).truce > 0 ? ', and breaking a recent peace will anger every ruler' : ''}.`, 'Declare war', 'Stay'))) return;
    declareWar(G.player, o);
    refresh();
    r = reachable(a)[pid];
    if (!r) return;
  }
  for (let i = 0; i < r.path.length; i++) {
    const step = r.path[i];
    const kind = movePreview(a, step);
    const ownerBefore = G.provinces[step].owner;
    if (kind === 'battle') {
      const enemies = armiesIn(step).filter(x => atWar(x.owner, a.owner));
      const preview = makeBattle([a], enemies, step, 'field');
      const choice = await battleChoice(preview, 'Battle!', `The army of ${a.general ? a.general.name : FACTIONS[a.owner].name} meets the enemy.`);
      if (!choice) break;
      const before = { att: menIn([a.id]), def: menIn(enemies.map(x => x.id)) };
      const res = await moveArmy(a, step, { fight: choice === 'fight' });
      refresh();
      if (res.battle) await showBattleResult(res.result, res.battle, before);
      await afterCapture(step, ownerBefore);
      break;
    }
    const res = await moveArmy(a, step);
    if (!res.ok) { toast('Cannot move', res.why, 'bad'); break; }
    if (res.kind === 'siege') {
      const p = G.provinces[step];
      toast('Siege', `Our army surrounds ${p.city}. Without a fight it will fall in about ${siegeTurns(p)} turn(s). You can also storm the walls.`, '');
      break;
    }
    if (res.kind === 'capture') { refresh(); await afterCapture(step, ownerBefore); break; }
  }
  if (G.armies[a.id]) { UI.selArmy = a.id; UI.selProv = a.prov; }
  refresh();
  checkOverUI();
}

async function doAssault(pid) {
  const b = assaultBattle(pid, G.player);
  if (!b) return;
  const choice = await battleChoice(b, 'Storm the walls', '');
  if (!choice) return;
  const ownerBefore = G.provinces[pid].owner;
  const before = { att: menIn(b.att.armies), def: menIn(b.def.armies) };
  const out = await assault(pid, G.player, { fight: choice === 'fight' });
  refresh();
  if (out) await showBattleResult(out, b, before);
  await afterCapture(pid, ownerBefore);
  refresh();
  checkOverUI();
}

async function doSally(pid) {
  const b = sallyBattle(pid);
  if (!b) return;
  const choice = await battleChoice(b, 'Sally out', 'The garrison rides out to break the siege.');
  if (!choice) return;
  const before = { att: menIn(b.att.armies), def: menIn(b.def.armies) };
  const out = await sally(pid, { fight: choice === 'fight' });
  refresh();
  if (out) await showBattleResult(out, b, before);
  refresh();
}

// ---------- Hooks the engine calls during the AI turn ----------

HOOKS.notify = pushNotice;
HOOKS.defend = async b => {
  $('busy').classList.add('hidden');
  centerOnProv(b.prov);
  renderMap();
  const v = await showModal(battleHTML(b, 'We are attacked!', `The ${FACTIONS[b.att.faction].full} attacks.`),
    [{ label: 'Auto-resolve', value: 'auto' }, { label: 'Fight the battle', value: 'fight', cls: 'big' }], { cancel: 'auto', cls: 'wide' });
  if (v !== 'fight' && turnBusy) $('busy').classList.remove('hidden');
  return v;
};
HOOKS.offer = async o => {
  $('busy').classList.add('hidden');
  const F = FACTIONS[o.from], st = G.factions[o.from];
  const texts = {
    peace: `${st.leader} is weary of war and offers peace between our peoples.`,
    trade: `${st.leader} proposes a trade agreement: caravans would travel freely between our lands, enriching both treasuries.`,
    alliance: `${st.leader} proposes a military alliance. Allies may march through each other's lands and come to each other's aid.`,
    marriage: `${st.leader} proposes a marriage between our two houses, as Temur himself sealed his alliances.`,
    tribute: `${st.leader} demands a tribute of <b>${fmt(o.gold)} gold</b>. If we refuse, there may be war.`,
    yield: `${st.leader} knows his realm cannot stand against you. He offers to <b>submit to you</b>: all the cities, armies and treasure of the ${F.full} would become yours.`,
  };
  const v = await showModal(`<div class="p-head">${flagSVG(o.from)}<div><h3>Envoy from the ${F.full}</h3></div></div><p>${texts[o.type]}</p>`,
    [{ label: o.type === 'tribute' ? 'Refuse' : 'Decline', value: false }, { label: o.type === 'tribute' ? 'Pay' : 'Accept', value: true, cls: 'big', disabled: o.type === 'tribute' && G.factions[G.player].gold < o.gold }],
    { cancel: false });
  if (!turnBusy) return v;
  $('busy').classList.remove('hidden');
  return v;
};

// ---------- Diplomacy ----------

let dipSel = null;
function openDiplomacy(f) {
  const others = PLAYABLE.filter(x => x !== G.player && G.factions[x].alive);
  dipSel = f && others.includes(f) ? f : (others.includes(dipSel) ? dipSel : others[0]);
  const render = () => {
    const rows = others.map(x => {
      const r = rel(G.player, x), F = FACTIONS[x], st = G.factions[x];
      const att = r.att, w = Math.abs(att) / 100 * 35;
      return `<tr data-f="${x}" class="${x === dipSel ? 'sel' : ''}"><td>${flagSVG(x)}</td><td>${F.name}<div class="p-sub">${st.leader}</div></td>
        <td>${provsOf(x).length}</td><td>${strengthWord(factionPower(x) / 3)}</td>
        <td><span class="att"><i style="left:${att < 0 ? 35 - w : 35}px;width:${w}px;background:${attitudeColor(att)}"></i></span><div class="p-sub">${attitudeWord(att)}</div></td>
        <td>${statusChips(G.player, x)}</td></tr>`;
    }).join('');
    const x = dipSel, r = rel(G.player, x), F = FACTIONS[x], gold = G.factions[G.player].gold;
    const tribute = tributeAmount(x);
    let acts = `<div class="dip-actions"><div class="p-head">${flagSVG(x)}<div><div class="p-title">${F.full}</div><div class="p-sub">${F.blurb ? F.blurb.split('. ')[0] + '.' : ''}</div></div></div><div class="btnrow">`;
    if (r.war) {
      acts += `<button data-d="submit">Demand surrender</button><button data-d="peace" data-g="0">Offer peace</button><button data-d="peace" data-g="500" ${gold < 500 ? 'disabled' : ''}>Peace + 500 gold</button><button data-d="peace" data-g="1500" ${gold < 1500 ? 'disabled' : ''}>Peace + 1500 gold</button>`;
    } else {
      if (!r.trade) acts += '<button data-d="trade">Propose trade</button>'; else acts += '<button data-d="cancelTrade">Cancel trade</button>';
      if (!r.alliance) acts += '<button data-d="alliance">Propose alliance</button>'; else acts += '<button data-d="cancelAlliance">End alliance</button>';
      if (!r.married) acts += '<button data-d="marriage">Propose marriage</button>';
      acts += `<button data-d="tribute">Demand tribute (~${fmt(tribute)})</button><button data-d="submit">Demand submission</button>`;
      acts += `<button data-d="war" class="danger">Declare war</button>`;
    }
    acts += `<button data-d="gift" data-g="200" ${gold < 200 ? 'disabled' : ''}>Gift 200 gold</button><button data-d="gift" data-g="1000" ${gold < 1000 ? 'disabled' : ''}>Gift 1000 gold</button>`;
    acts += '</div><div id="dip-reply"></div></div>';
    return `<button class="modal-x small" data-mi="0">Close</button><h3>Diplomacy</h3>
      <table class="dip"><tr><th></th><th>Nation</th><th>Lands</th><th>Army</th><th>Attitude</th><th>Status</th></tr>${rows}</table>${acts}`;
  };
  showModal(render(), [], {
    cls: 'wide', cancel: null,
    onClick: async e => {
      const tr = e.target.closest('tr[data-f]');
      if (tr) { dipSel = tr.dataset.f; $('modal').innerHTML = render(); return; }
      const b = e.target.closest('[data-d]');
      if (!b || b.disabled) return;
      const type = b.dataset.d, gold = +(b.dataset.g || 0);
      if (type === 'war') {
        const r = rel(G.player, dipSel);
        if (r.alliance || r.truce > 0) toast('Treachery', 'Breaking a treaty will make every ruler trust us less.', 'bad');
      }
      const res = propose(dipSel, type, gold);
      $('modal').innerHTML = render();
      $('dip-reply').textContent = res.text;
      $('dip-reply').className = res.ok ? 'good' : 'bad';
      refresh();
      if (G.over) { closeModal(null); checkOverUI(); }
    },
  });
}

// ---------- Realm ----------

function openRealm() {
  const pl = G.player, st = G.factions[pl], dist = distancesFrom(pl);
  const render = () => {
    const provs = provsOf(pl).sort((a, b) => b.pop - a.pop);
    const income = factionIncome(pl), upkeep = factionUpkeep(pl);
    const rows = provs.map(p => {
      const o = provinceOrder(p, dist), [w, c] = orderInfo(o);
      return `<tr data-p="${p.id}"><td>${p.city}${G.factions[pl].capital === p.id ? ' ♛' : ''}</td><td>${fmt(p.pop)}k</td><td class="${c}">${Math.min(100, o)}%</td><td>${fmt(provinceIncome(p, o))}</td>
        <td>${p.build ? buildName(p) + ' (' + p.build.turns + ')' : '<span class="warn">idle</span>'}</td><td>${p.queue.length ? p.queue.length + ' units' : ''}</td></tr>`;
    }).join('');
    const tax = ['Low', 'Normal', 'High'].map((t, i) => `<button data-tax="${i}" class="${st.tax === i ? 'big' : ''}">${t}</button>`).join('');
    return `<button class="modal-x small" data-close="1">Close</button><h3>The realm of ${st.leader}</h3>
      <div class="kv"><div><span>Treasury</span>${fmt(st.gold)}</div><div><span>Provinces</span>${provs.length}</div>
      <div><span>Income</span>${fmt(income)}</div><div><span>Army upkeep</span>${fmt(upkeep)}</div>
      <div><span>Trade agreements</span>${fmt(tradeIncome(pl))}</div><div><span>Heir</span>${st.heir || '—'}</div></div>
      <div class="p-sec"><h4>Taxes</h4><div class="btnrow">${tax}</div><p class="note">Low taxes: more order and growth, less gold. High taxes: more gold, unrest and slower growth.</p></div>
      <div class="p-sec"><h4>Provinces</h4><table class="dip"><tr><th>City</th><th>People</th><th>Order</th><th>Income</th><th>Building</th><th>Training</th></tr>${rows}</table></div>`;
  };
  showModal(render(), [], {
    cls: 'wide', cancel: null,
    onClick: e => {
      if (e.target.closest('[data-close]')) return closeModal(null);
      const t = e.target.closest('[data-tax]');
      if (t) { st.tax = +t.dataset.tax; $('modal').innerHTML = render(); refresh(); return; }
      const r = e.target.closest('tr[data-p]');
      if (r) { closeModal(null); UI.selProv = r.dataset.p; UI.selArmy = null; centerOnProv(r.dataset.p); refresh(); }
    },
  });
}

function openChronicle() {
  const items = G.log.slice().reverse().map(l => `<div class="${l.kind}">${l.text}</div>`).join('');
  showModal(`<h3>Chronicle</h3><div class="chron">${items}</div>`, [{ label: 'Close', value: null }], { cls: 'wide', cancel: null });
}

// ---------- Menu, saving, help ----------

const SLOTS = ['1', '2', '3'];
function savesHTML(mode) {
  return '<div class="saves">' + ['auto'].concat(SLOTS).map(s => {
    const m = saveMeta(s);
    const label = s === 'auto' ? 'Autosave' : 'Slot ' + s;
    const desc = m ? `${FACTIONS[m.player].name} · ${m.date}` : 'Empty';
    const btn = mode === 'save' ? (s === 'auto' ? '' : `<button data-save="${s}">Save here</button>`) : `<button data-load="${s}" ${m ? '' : 'disabled'}>Load</button>`;
    return `<div class="slot"><div><b>${label}</b><div class="p-sub">${desc}</div></div>${btn}</div>`;
  }).join('') + '</div>';
}

async function openMenu() {
  const v = await showModal(`<h3>${dateText()}</h3><p class="note">${FACTIONS[G.player].full}</p>`, [
    { label: `Rival moves: ${LIFE.showRivals ? 'shown' : 'hidden'}`, value: 'rivals' },
    { label: 'How to play', value: 'help' }, { label: 'Save', value: 'save' }, { label: 'Load', value: 'load' },
    { label: 'Main menu', value: 'title' }, { label: 'Resume', value: null, cls: 'big' },
  ], { cancel: null });
  if (v === 'rivals') { setRivalMoves(!LIFE.showRivals); toast('Rival moves', LIFE.showRivals ? 'You will watch rival armies march across the map.' : 'Rival armies will move instantly.', ''); return openMenu(); }
  if (v === 'help') await openHelp();
  if (v === 'save') await openSaves('save');
  if (v === 'load') await openSaves('load');
  if (v === 'title' && await confirmBox('Leave the campaign?', 'Unsaved progress since the last autosave will be lost.')) toTitle();
}

function openSaves(mode) {
  return showModal(`<h3>${mode === 'save' ? 'Save game' : 'Load game'}</h3>${savesHTML(mode)}`, [{ label: 'Close', value: null }], {
    cancel: null,
    onClick: e => {
      const s = e.target.closest('[data-save]'), l = e.target.closest('[data-load]');
      if (s) { const ok = saveGame(s.dataset.save); closeModal(null); toast(ok ? 'Saved' : 'Could not save', ok ? dateText() : 'Browser storage is unavailable.', ok ? 'good' : 'bad'); }
      if (l) { closeModal(null); if (loadGame(l.dataset.load)) startLoaded(); else toast('Could not load', '', 'bad'); }
    },
  });
}

function helpHTML() {
  return `<h3>How to play</h3><div class="help">
    <p>You rule one of the seven nations of Turkistan in 1370. Each turn is half a year. <b>The last nation standing wins.</b> Destroy your rivals in war, or make them submit to you. You lose if your last city falls.</p>
    <h4>The easy way to play</h4><ul><li>Click any city. If it is yours, you can issue decrees, recruit soldiers and build. If it belongs to someone else, you can attack it with any army that can reach it, or talk to its ruler: trade, alliances, marriages, tribute, or a demand to submit.</li>
    <li>Your vizier, in the corner, suggests good moves each turn. Click a suggestion to go there.</li><li>Press <b>End turn</b> when you are done.</li></ul>
    <h4>The map</h4><ul><li>Drag to move the map, scroll or pinch to zoom.</li><li>Click a province to see its city, buildings and recruits. Click a banner to select an army.</li>
    <li>With an army selected, click a highlighted province (or right-click anywhere) to march. Green: move. Red: battle or siege. Grey: a nation you are at peace with.</li>
    <li>Armies of horsemen only can march two provinces a turn.</li></ul>
    <h4>War</h4><ul><li>Entering a walled enemy city begins a siege. It surrenders after a few turns, faster with Siege Engineers, or you can storm the walls at once.</li>
    <li>When a battle starts you can fight it yourself on the battlefield or let it be auto-resolved.</li>
    <li>Spearmen beat cavalry. Horse archers rule the open steppe but struggle in the mountains. Defenders on walls are much stronger.</li>
    <li>Armies recover their losses while resting in their own provinces.</li></ul>
    <h4>Your lands</h4><ul><li>Gold comes from taxes, the Silk Road and trade agreements. Armies cost upkeep every turn.</li>
    <li>Keep public order high with low taxes, mosques and garrisons, or cities will rebel.</li>
    <li>Bazaars raise income, irrigation grows the population, barracks and stables unlock troops. Bigger cities can build more.</li>
    <li>Use the Realm screen to set taxes and see every province at once.</li></ul>
    <h4>Stories, requests and wonders</h4><ul><li>Most turns bring a choice: a Sufi master asking for patronage, bandits on the Silk Road, an envoy from China, a pretender, a spy. Every choice has consequences.</li>
    <li>The council of amirs sets you tasks with a deadline (shown in the vizier's box). Fulfil them for gold and praise.</li>
    <li>An army standing in enemy land can plunder the countryside for gold. Steppe armies take more.</li>
    <li>Five great wonders can be raised in Samarkand, Shahrisabz, Otrar, Herat and Sarai. Their blessing belongs to whoever holds the city.</li></ul>
    <h4>Diplomacy</h4><ul><li>Offer peace, trade, alliances and marriages; demand tribute from the weak. Rulers remember gifts and betrayals.</li></ul>
    <h4>Keys</h4><p>Enter: end turn · D: diplomacy · R: realm · C: chronicle · Esc: close or menu</p></div>`;
}
function openHelp() { return showModal(helpHTML(), [{ label: 'Close', value: null, cls: 'big' }], { cls: 'wide', cancel: null }); }

async function checkOverUI() {
  if (G && !G.over) checkVictory();
  if (!G || !G.over || G.overShown === G.over) return;
  G.overShown = G.over;
  const pl = G.player;
  if (G.over === 'win') {
    const v = await showModal(`<h3>The last nation standing</h3><p>${dateText()}: every rival crown has fallen or bowed. The ${FACTIONS[pl].full} alone endures, ruling ${provsOf(pl).length} provinces from the Caspian to the Tian Shan. Poets in Samarkand and Herat will sing of ${G.factions[pl].leader}.</p>`,
      [{ label: 'Main menu', value: 'title' }, { label: 'Keep ruling', value: 'go', cls: 'big' }], { cancel: 'go', cls: 'parch' });
    if (v === 'title') toTitle();
  } else if (G.over === 'lose') {
    await showModal(`<h3>Defeat</h3><p>The last lands of the ${FACTIONS[pl].full} have fallen. Your name will live only in the chronicles of your enemies.</p>`,
      [{ label: 'Main menu', value: true, cls: 'big' }], { cancel: true });
    toTitle();
  }
}
