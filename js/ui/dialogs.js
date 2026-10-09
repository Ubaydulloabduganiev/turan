'use strict';
// Modal windows and the order flows that need them: battles, captures, diplomacy, the realm, saving.

let modalResolve = null, modalOpen = false;
const notices = [];
// Hot seat: who holds the device, messages waiting for each ruler, and the end of a person's part of the round
const HOT = { holder: null, pending: {}, waiting: null };
// The computer is moving (a person playing their part of the round in a hot-seat game is not)
const engineBusy = () => turnBusy && !HOT.waiting;

function uiLocked() { return modalOpen || engineBusy() || !$('battle').classList.contains('hidden') || (CINE.el && !CINE.el.classList.contains('hidden')); }

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
    m.scrollTop = 0; // a new window starts at its top, not where the last one was scrolled to
    modalResolve = v => {
      modalResolve = null; modalOpen = false;
      $('modal-wrap').classList.add('hidden');
      resolve(v);
      // Scenes and notices that arrived while this window was open
      setTimeout(() => { if (!engineBusy() && !modalOpen && !flushing && notices.length) flushNotices(); }, 0);
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

function confirmBox(title, text, yes, no) {
  return showModal(`<h3>${title}</h3><p>${text}</p>`, [{ label: no || t('No'), value: false }, { label: yes || t('Yes'), value: true, cls: 'big' }], { cancel: false });
}
function infoBox(title, text, opts = {}) {
  return showModal(`<h3>${title}</h3>${text.startsWith('<') ? text : `<p>${text}</p>`}`, [{ label: t('Continue'), value: true, cls: 'big' }], { cancel: true, ...opts });
}

// ---------- Notices from the engine ----------

let quietNotices = false;
function pushNotice(n) {
  if (quietNotices) return;
  // In a hot-seat game a message for another ruler waits until they hold the device
  if (G && G.humans && n.for && n.for !== G.player) { (HOT.pending[n.for] = HOT.pending[n.for] || []).push(n); return; }
  if (n.sound) sfx(n.sound);
  if (n.minor) { toast(n.title, n.text); return; }
  notices.push(n);
  if (!engineBusy() && !modalOpen) flushNotices();
}
let flushing = null;
function flushNotices() {
  if (!flushing) flushing = flushQueue().finally(() => { flushing = null; });
  return flushing;
}
async function flushQueue() {
  while (notices.length) {
    const n = notices.shift();
    if (n.scene) { await playScene(n.scene); if (G) refresh(); continue; }
    if (n.history) narrate([n.title, n.text]);
    if (n.who) await infoBox(n.title, `<div class="with-portrait">${portraitSVG(n.who, { faction: n.whoFaction })}<p>${n.text}</p></div>`, { cls: n.history ? 'parch' : '' });
    else await infoBox(n.title, n.text, { cls: n.history ? 'parch' : '' });
    if (n.history) hush();
    if (n.prov && G) { UI.selProv = n.prov; UI.selArmy = null; centerOnProv(n.prov); refresh(); }
  }
}

// ---------- A choice for the ruler ----------

async function showStory({ story, ctx }) {
  const opts = story.options.map((o, i) => `<button class="choice${story.kicker && i === 0 ? ' hist' : ''}" data-mi="${i}"><b>${o.label(ctx)}</b><small>${t(o.hint)}</small></button>`).join('');
  const title = t(story.title);
  const who = story.who ? story.who(ctx) : null;
  const pic = who ? portraitSVG(who, { faction: story.whoFaction ? story.whoFaction(ctx) : ctx.f }) : '';
  const kick = story.kicker ? `<div class="camp-year whatif-kick">${icon('star')} ${t(story.kicker)}</div>` : '';
  if (story.kicker) narrate([title, story.text(ctx)]);
  const i = await showModal(`${kick}<h3>${title}</h3><div class="with-portrait">${pic}<p>${story.text(ctx)}</p></div><div class="choices story">${opts}</div>`, [], { cls: 'parch', cancel: 0, pickIndex: true });
  hush();
  const result = story.options[i || 0].act(ctx);
  if (story.kicker) narrate(result);
  log(`${dateText()}: ${title}. ${result}`, 'event');
  refresh();
  await showModal(`<h3>${title}</h3><div class="with-portrait">${pic}<p>${result}</p></div>`, [{ label: t('Continue'), value: true, cls: 'big' }], { cls: 'parch', cancel: true });
  hush();
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
  return Object.keys(by).map(k => `<li><span>${by[k].n}× ${uName(k)}</span><span>${by[k].men}</span></li>`).join('');
}

function battleHTML(b, title, intro) {
  const odds = battleOdds(b);
  const pAtt = b.att.faction === G.player;
  const mine = pAtt ? odds : 1 - odds;
  const p = G.provinces[b.prov];
  const g1 = sideGeneral(b.att), g2 = sideGeneral(b.def);
  const kindText = { naval: t('A battle on the water'), field: b.river ? t('Open battle across the {river}', { river: geoName(b.river) }) : t('Open battle'), assault: t('Storming the walls ({walls})', { walls: bLevel('walls', p.b.walls) }), sally: t('The garrison sallies out') }[b.kind];
  const word = t(mine > 0.8 ? 'Decisive advantage' : mine > 0.6 ? 'Favourable' : mine > 0.4 ? 'Even' : mine > 0.2 ? 'Unfavourable' : 'Hopeless');
  const side = (s, g) => `<div class="side"><h4>${flagSVG(s.faction, 'flag')}${fName(s.faction)}</h4><div class="p-sub">${g ? pn(g.name) + ' ' + stars(Math.min(5, g.cmd)) : t('No general')}</div><ul>${sideList(s)}</ul><div class="p-sub">${t('{n} men', { n: menOf(s) })}</div></div>`;
  return `<h3>${title}</h3><p>${intro || ''} ${b.kind === 'naval' ? t('{kind}: the {sea}, off {city}.', { kind: kindText, sea: geoName(b.sea), city: cityOf(p) }) : t('{kind} at {city}, {terrain}.', { kind: kindText, city: cityOf(p), terrain: terrName(p.terrain).toLowerCase() })}</p>
    <div class="vs">${side(b.att, g1)}<div class="mid">${icon('swords')}</div>${side(b.def, g2)}</div>
    <div class="odds"><div style="width:${odds * 100}%;background:${FACTIONS[b.att.faction].color}"></div><div style="flex:1;background:${FACTIONS[b.def.faction].color}"></div></div>
    <p class="note">${t('Your chances: {word}.', { word: `<b>${word}</b>` })}${b.walls ? ' ' + t('Defenders on the walls fight much harder; siege engineers help.') : ''}</p>`;
}

// Asks the player how to fight a battle they started. Returns 'fight', 'auto' or null.
function battleChoice(b, title, intro) {
  return showModal(battleHTML(b, title, intro), [
    { label: t('Cancel'), value: null },
    { label: t('Auto-resolve'), value: 'auto' },
    { label: t('Fight the battle'), value: 'fight', cls: 'big' },
  ], { cancel: null, cls: 'wide' });
}

function menIn(ids) { let n = 0; for (const id of ids) { const a = G.armies[id]; if (a) for (const u of a.units) n += u.men; } return n; }

async function showBattleResult(out, b, before) {
  const after = { att: menIn(b.att.armies), def: menIn(b.def.armies) };
  const won = out.playerWon;
  const p = G.provinces[b.prov];
  const lossA = before.att - after.att, lossD = before.def - after.def;
  const lost = (n, of) => t('Lost {n} of {of} men', { n: fmt(Math.max(0, n)), of: fmt(of) });
  const head = b.kind === 'naval' ? t(won ? 'Victory on the {sea}' : 'Defeat on the {sea}', { sea: geoName(b.sea) }) : t(won ? 'Victory at {city}' : 'Defeat at {city}', { city: cityOf(p) });
  await showModal(`<h3>${head}</h3>
    <p>${out.text}</p>
    <div class="vs"><div class="side"><h4>${flagSVG(b.att.faction, 'flag')}${fName(b.att.faction)}</h4><p>${lost(lossA, before.att)}</p></div>
    <div class="mid">${icon('swords')}</div><div class="side"><h4>${flagSVG(b.def.faction, 'flag')}${fName(b.def.faction)}</h4><p>${lost(lossD, before.def)}</p></div></div>`,
    [{ label: t('Continue'), value: true, cls: 'big' }], { cancel: true });
}

async function afterCapture(pid, ownerBefore) {
  const p = G.provinces[pid];
  if (p.owner !== G.player || ownerBefore === G.player) return;
  const extra = Math.round(p.pop * 17);
  const v = await showModal(`<h3>${t('{city} is ours', { city: cityOf(p) })}</h3><p>${t('The gates are open and the city lies at your feet. What shall be done with its people?')}</p>
    <p>${t('Occupy: protect the people and keep the city prosperous.')}<br>${t('Sack: let the army plunder for about {n} gold. Many will die or flee, the city will hate you, and other rulers will think worse of you.', { n: `<b>${fmt(extra)}</b>` })}</p>`,
    [{ label: t('Sack the city'), value: 'sack', cls: 'danger' }, { label: t('Occupy'), value: 'occupy', cls: 'big' }], { cancel: 'occupy' });
  if (v === 'sack') { const g = sackProvince(p); toast(t('City sacked'), t('The army carries off {n} gold.', { n: fmt(g) }), 'bad'); }
}

// Moves the selected army towards a province, fighting if needed.
async function orderMove(a, pid) {
  let r = UI.reach && UI.reach[pid];
  if (!r) {
    if (a.moves <= 0) toast(t('No moves left'), t('This army has already marched this turn.'), 'bad');
    else toast(t('Too far'), t('That province cannot be reached this turn.'), 'bad');
    return;
  }
  if (r.kind === 'blocked') {
    const o = G.provinces[pid].owner;
    const warn = t('We are at peace with: {nation}. Marching into {city} means war.', { nation: fFull(o), city: cityById(pid) }) +
      (rel(G.player, o).alliance ? ' ' + t('Our alliance will end.') : '') + (rel(G.player, o).truce > 0 ? ' ' + t('Breaking a recent peace will anger every ruler.') : '');
    if (!(await confirmBox(t('Declare war?'), warn, t('Declare war'), t('Stay')))) return;
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
      const choice = await battleChoice(preview, t('Battle!'), t('The army of {name} meets the enemy.', { name: a.general ? pn(a.general.name) : fName(a.owner) }));
      if (!choice) break;
      const before = { att: menIn([a.id]), def: menIn(enemies.map(x => x.id)) };
      const res = await moveArmy(a, step, { fight: choice === 'fight' });
      refresh();
      if (res.battle) await showBattleResult(res.result, res.battle, before);
      await afterCapture(step, ownerBefore);
      break;
    }
    const res = await moveArmy(a, step);
    if (!res.ok) { toast(t('Cannot move'), t(res.why), 'bad'); break; }
    if (res.kind === 'siege') {
      const p = G.provinces[step];
      // The first siege of a great walled city is worth a picture
      G.sieged = G.sieged || [];
      if (p.pop >= 20 && p.b.walls >= 2 && !G.sieged.includes(p.id)) { G.sieged.push(p.id); await playScene({ kind: 'siege', prov: p.id }); }
      toast(t('Siege'), t('Our army surrounds {city}. Without a fight it will fall in about {n} turns. You can also storm the walls.', { city: cityOf(p), n: siegeTurns(p) }), '');
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
  const choice = await battleChoice(b, t('Storm the walls'), '');
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
  const choice = await battleChoice(b, t('Sally out'), t('The garrison rides out to break the siege.'));
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
  const v = await showModal(battleHTML(b, t('We are attacked!'), t('Attackers: {nation}.', { nation: fFull(b.att.faction) })),
    [{ label: t('Auto-resolve'), value: 'auto' }, { label: t('Fight the battle'), value: 'fight', cls: 'big' }], { cancel: 'auto', cls: 'wide' });
  if (v !== 'fight' && engineBusy()) $('busy').classList.remove('hidden');
  return v;
};
HOOKS.offer = async o => {
  $('busy').classList.add('hidden');
  const st = G.factions[o.from], v0 = { ruler: pn(st.leader), n: `<b>${fmt(o.gold)}</b>`, nation: fFull(o.from), city: o.city ? cityById(o.city) : '', enemy: o.enemy ? fFull(o.enemy) : '' };
  const texts = {
    peace: '{ruler} is weary of war and offers peace between our peoples.',
    trade: '{ruler} proposes a trade agreement: caravans would travel freely between our lands, enriching both treasuries.',
    alliance: "{ruler} proposes a military alliance. Allies may march through each other's lands and come to each other's aid.",
    marriage: '{ruler} proposes a marriage between our two houses, as Temur himself sealed his alliances.',
    tribute: '{ruler} demands a tribute of {n} gold. If we refuse, there may be war.',
    buycity: '{ruler} offers {n} gold for our city of {city}. Its people would become his subjects.',
    joinwar: '{ruler} reminds you of your alliance and asks you to join his war against the {enemy}. Refusing would shame us before every court in Turan.',
    demandcity: '{ruler} demands that we hand over our city of {city}. His envoy hints that his armies are ready if we refuse.',
    yield: '{ruler} knows his realm cannot stand against you. He offers to submit to you: all the cities, armies and treasure of his realm ({nation}) would become yours.',
  };
  const v = await showModal(`<div class="with-portrait">${rulerPortrait(o.from)}<div><h3>${t('Envoy from: {nation}', { nation: fFull(o.from) })}</h3><p>${t(texts[o.type], v0)}</p></div></div>`,
    [{ label: t(o.type === 'tribute' || o.type === 'demandcity' ? 'Refuse' : 'Decline'), value: false }, { label: t(o.type === 'tribute' ? 'Pay' : o.type === 'demandcity' ? 'Hand it over' : o.type === 'joinwar' ? 'Join the war' : 'Accept'), value: true, cls: 'big', disabled: o.type === 'tribute' && G.factions[G.player].gold < o.gold }],
    { cancel: false });
  if (!turnBusy) return v;
  $('busy').classList.remove('hidden');
  return v;
};

// ---------- Diplomacy ----------

let dipSel = null;
function openDiplomacy(f) {
  const others = POWERS.filter(x => x !== G.player && G.factions[x].alive);
  dipSel = f && others.includes(f) ? f : (others.includes(dipSel) ? dipSel : others[0]);
  const render = () => {
    const rows = others.map(x => {
      const r = rel(G.player, x), F = FACTIONS[x], st = G.factions[x];
      const att = r.att, w = Math.abs(att) / 100 * 35;
      return `<tr data-f="${x}" class="${x === dipSel ? 'sel' : ''}"><td>${flagSVG(x)}</td><td class="dip-ruler">${rulerPortrait(x, 'mini-portrait')}<div>${fName(x)}<div class="p-sub">${pn(st.leader)}</div></div></td>
        <td>${provsOf(x).length}</td><td>${strengthWord(factionPower(x) / 3)}</td>
        <td><span class="att"><i style="left:${att < 0 ? 35 - w : 35}px;width:${w}px;background:${attitudeColor(att)}"></i></span><div class="p-sub">${attitudeWord(att)}</div></td>
        <td>${statusChips(G.player, x)}</td></tr>`;
    }).join('');
    const x = dipSel, r = rel(G.player, x), F = FACTIONS[x], gold = G.factions[G.player].gold;
    const tribute = tributeAmount(x);
    let acts = `<div class="dip-actions"><div class="p-head">${rulerPortrait(x, 'p-portrait')}<div><div class="p-title">${fFull(x)}</div><div class="p-sub">${pn(G.factions[x].leader)}, ${fTitle(x)}</div></div></div><div class="btnrow">`;
    if (r.war) {
      acts += `<button data-d="submit">${t('Demand surrender')}</button><button data-d="peace" data-g="0">${t('Offer peace')}</button><button data-d="peace" data-g="500" ${gold < 500 ? 'disabled' : ''}>${t('Peace + 500 gold')}</button><button data-d="peace" data-g="1500" ${gold < 1500 ? 'disabled' : ''}>${t('Peace + 1500 gold')}</button>`;
    } else {
      if (!r.trade) acts += `<button data-d="trade">${t('Propose trade')}</button>`; else acts += `<button data-d="cancelTrade">${t('Cancel trade')}</button>`;
      if (!r.alliance) acts += `<button data-d="alliance">${t('Propose alliance')}</button>`; else acts += `<button data-d="cancelAlliance">${t('End alliance')}</button>`;
      if (!r.married) acts += `<button data-d="marriage">${t('Arrange a marriage')}</button>`;
      acts += `<button data-d="tribute">${t('Demand tribute (~{n})', { n: fmt(tribute) })}</button><button data-d="submit">${t('Demand submission')}</button>`;
      acts += `<button data-d="war" class="danger">${t('Declare war')}</button>`;
    }
    acts += `<button data-d="gift" data-g="200" ${gold < 200 ? 'disabled' : ''}>${t('Send {n} gold', { n: 200 })}</button><button data-d="gift" data-g="1000" ${gold < 1000 ? 'disabled' : ''}>${t('Send {n} gold', { n: fmt(1000) })}</button>`;
    acts += '</div><div id="dip-reply"></div></div>';
    return `<button class="modal-x small" data-mi="0">${t('Close')}</button><h3>${t('Diplomacy')}</h3>
      <table class="dip"><tr><th></th><th>${t('Nation')}</th><th>${t('Lands')}</th><th>${t('Army')}</th><th>${t('Attitude')}</th><th>${t('Status')}</th></tr>${rows}</table>${acts}`;
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
        if (r.alliance || r.truce > 0) toast(t('Treachery'), t('Breaking a treaty will make every ruler trust you less.'), 'bad');
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

// ---------- The court: the people of the age ----------

// A person's character: small chips, each with its meaning on hover or tap
function traitChips(name) {
  const tr = traitsOf(name);
  if (!tr.length) return '';
  return `<div class="traits">${tr.map(k => `<span class="trait ${TRAITS[k].order < 0 || TRAITS[k].tax < 0 ? 'bad' : ''}" title="${t(TRAITS[k].desc)}" data-trait="${k}">${t(TRAITS[k].name)}</span>`).join('')}</div>`;
}

// A general's manoeuvres on the battlefield
function abilChips(g, faction) {
  const list = generalAbilities(g, faction);
  return list.length ? `<div class="traits abils"><small>${t('In battle')}:</small>${list.map(k => `<span class="trait abil-chip" title="${t(ABILITIES[k].desc)}" data-abil="${k}">${glyphIcon(ABILITIES[k].icon)} ${t(ABILITIES[k].name)}</span>`).join('')}</div>` : '';
}

function personCard(name, faction, o = {}) {
  const c = charByName(name);
  const age = o.age !== undefined ? o.age : c ? year() - c.born : personBy(name) ? year() - personBy(name).born : null;
  const dead = c && c.died && year() > c.died && !o.alive;
  const role = o.role ? o.role : o.leader ? fTitle(faction) : o.consort ? t('Consort of the ruler') : o.child ? t('Born {born} · joins the court in {joins}', { born: c.born, joins: c.joins }) : o.cmd !== undefined ? `${t('General')} ${stars(Math.min(5, o.cmd))}` : c ? t({ scholar: 'Scholar', poet: 'Poet', envoy: 'Envoy' }[c.role] || '') : '';
  const where = o.prov ? ` · ${cityOf(G.provinces[o.prov])}` : '';
  return `<div class="person ${o.child ? 'child' : ''} ${dead ? 'dead' : ''}" ${o.army ? `data-army="${o.army}"` : ''}>${portraitSVG(name, { faction, age: age || undefined })}
    <div class="pc-body"><div class="pc-name">${pn(name)}${!o.child && !(c && ['scholar', 'poet', 'envoy', 'consort'].includes(c.role)) && epithetOf(name) ? ` <span class="epithet">${t(epithetOf(name))}</span>` : ''}</div><div class="pc-role">${role}</div>
    <div class="pc-meta">${age !== null && !o.child ? t('Age {n}', { n: age }) : ''}${dead ? ' · ' + t('died {y}', { y: c.died }) : ''}${where}</div>
    ${!o.child && !(c && ['scholar', 'poet', 'envoy', 'consort'].includes(c.role)) ? traitChips(name) : ''}
    ${o.army && faction === G.player && G.armies[o.army] && G.armies[o.army].general && !G.armies[o.army].general.leader ? courtStatus(G.armies[o.army].general, faction) : ''}
    ${c ? `<div class="pc-bio">${t(c.bio)}</div>` : ''}</div></div>`;
}

// An amir's heart: how loyal, how ambitious, and a way to honour him
function courtStatus(g, f) {
  courtier(g, f);
  const lc = g.loyal >= 70 ? 'good' : g.loyal >= 40 ? 'warn' : 'bad';
  const lw = t(g.loyal >= 85 ? 'devoted' : g.loyal >= 70 ? 'loyal' : g.loyal >= 40 ? 'wavering' : g.loyal >= 20 ? 'resentful' : 'treacherous');
  const aw = t(g.amb >= 70 ? 'burning' : g.amb >= 45 ? 'great' : g.amb >= 25 ? 'modest' : 'none');
  const why = honourCheck(f, g);
  return `<div class="court-heart"><div><span>${icon('heart')} ${t('Loyalty')}</span><b class="${lc}">${lw}</b><div class="meter"><div class="${lc}" style="width:${Math.round(g.loyal)}%"></div></div></div>
    <div><span>${icon('crown')} ${t('Ambition')}</span><b>${aw}</b><div class="meter"><div class="amb" style="width:${Math.round(g.amb)}%"></div></div></div>
    <button class="small" data-honour="${g.name.replace(/"/g, '&quot;')}" ${why ? `disabled title="${t(why)}"` : ''}>${t('Honour him · {n}g', { n: HONOUR_COST })}</button></div>`;
}
const honourCheck = (f, g) => G.factions[f].gold < HONOUR_COST ? 'Not enough gold' : g.honoured && G.turn - g.honoured < 3 ? 'He was honoured recently' : null;

function openCourt(tab = 'mine') {
  const pl = G.player;
  const render = () => {
    let body = '';
    if (tab === 'mine') {
      body = '<div class="people">' + courtOf(pl).map(p => personCard(p.name, pl, { ...p, alive: !p.child })).join('') + '</div>';
    } else if (tab === 'rulers') {
      body = '<div class="people">' + POWERS.filter(f => G.factions[f].alive && f !== pl).map(f => {
        const st = G.factions[f];
        const ga = armiesOf(f).find(a => a.general && a.general.name === st.leader);
        return personCard(st.leader, f, { leader: true, age: ga ? ga.general.age : undefined, alive: true });
      }).join('') + '</div>';
    } else if (tab === 'family') {
      const ms = (G.marriages || []).filter(m => m.gF === pl || m.bF === pl);
      body = ms.length ? '<div class="families">' + ms.map(m => {
        const kids = m.kids.map(k => { const pp = personBy(k); return `<div class="kid">${portraitSVG(k, { faction: m.gF })}<div>${pn(k)}</div><small>${t('Born {born}', { born: pp.born })}</small></div>`; }).join('');
        return `<div class="family"><div class="couple">${personCard(m.groom, m.gF, { role: t('Husband · {nation}', { nation: fName(m.gF) }) })}<div class="knot">❦</div>${personCard(m.bride, m.bF, { role: t('Wife · {nation}', { nation: fName(m.bF) }) })}</div>` +
          `<div class="f-meta">${t('Married {date}', { date: dateText(m.turn) })}</div>${kids ? `<div class="kids">${kids}</div>` : `<p class="note">${t('No children yet.')}</p>`}</div>`;
      }).join('') + '</div>' : `<p class="note">${t('No marriages yet. Propose one to another ruler through diplomacy: the houses will be joined by a royal wedding, and their children will grow up to serve you.')}</p>`;
    } else {
      body = '<div class="people">' + CHARACTERS.filter(c => !c.faction).map(c => personCard(c.name, null, {})).join('') + '</div>';
    }
    const tabs = [['mine', 'Your court'], ['family', 'Marriages'], ['rulers', 'Rulers of Turan'], ['figures', 'Figures of the age']].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'big' : ''}">${t(l)}</button>`).join('');
    return `<button class="modal-x small" data-close="1">${t('Close')}</button><h3>${t('The court of {ruler}', { ruler: pn(G.factions[pl].leader) })}</h3><div class="btnrow tabs">${tabs}</div>${body}`;
  };
  showModal(render(), [], {
    cls: 'wide', cancel: null,
    onClick: e => {
      if (e.target.closest('[data-close]')) return closeModal(null);
      const tb = e.target.closest('[data-tab]');
      if (tb) { tab = tb.dataset.tab; $('modal').innerHTML = render(); return; }
      const hb = e.target.closest('[data-honour]');
      if (hb) {
        const a = armiesOf(pl).find(x => x.general && x.general.name === hb.dataset.honour);
        if (a) { const why = honourGeneral(pl, a.general); if (why) toast(t('Cannot do that'), t(why), 'bad'); else { sfx('coins'); toast(t('A robe of honour'), t('{name} is honoured before the whole court.', { name: pn(a.general.name) }), 'good'); } }
        $('modal').innerHTML = render(); refresh(); return;
      }
      const pa = e.target.closest('[data-army]');
      if (pa && G.armies[pa.dataset.army]) { closeModal(null); UI.selArmy = pa.dataset.army; UI.selProv = G.armies[pa.dataset.army].prov; centerOnProv(UI.selProv); refresh(); }
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
      return `<tr data-p="${p.id}"><td>${cityOf(p)}${G.factions[pl].capital === p.id ? ' ' + icon('crown', 'gold') : ''}</td><td>${fmt(p.pop * 1000)}</td><td class="${c}">${Math.min(100, o)}%</td><td>${fmt(provinceIncome(p, o))}</td>
        <td>${p.build ? buildName(p) + ' (' + p.build.turns + ')' : `<span class="warn">${t('idle')}</span>`}</td><td>${p.queue.length ? t('{n} units', { n: p.queue.length }) : ''}</td></tr>`;
    }).join('');
    const tax = ['Low', 'Normal', 'High'].map((x, i) => `<button data-tax="${i}" class="${st.tax === i ? 'big' : ''}">${t(x)}</button>`).join('');
    return `<button class="modal-x small" data-close="1">${t('Close')}</button><h3>${t('The realm of {ruler}', { ruler: pn(st.leader) })}</h3>
      <div class="kv"><div><span>${t('Treasury')}</span>${fmt(st.gold)}</div><div><span>${t('Provinces')}</span>${provs.length}</div>
      <div><span>${t('Income')}</span>${fmt(income)}</div><div><span>${t('Army upkeep')}</span>${fmt(upkeep)}</div>
      <div><span>${t('Trade agreements')}</span>${fmt(tradeIncome(pl))}</div>${treasuryLoss(pl) ? `<div><span>${t('Skimmed by officials')}</span><b class="bad">−${fmt(treasuryLoss(pl))}</b></div>` : ''}<div><span>${t('Heir')}</span>${st.heir ? pn(st.heir) : '—'}</div><div><span>${t('Reputation')}</span>${t(trustWord(pl))}</div>${overstretch(pl) ? `<div><span>${t('Realm too large')}</span><b class="bad">−${Math.round(overstretch(pl))} ${t('order')}</b></div>` : ''}</div>
      <div class="p-sec"><h4>${t('Taxes')}</h4><div class="btnrow">${tax}</div><p class="note">${t('Low taxes: more order and growth, less gold. High taxes: more gold, unrest and slower growth.')}</p></div>
      <div class="p-sec"><h4>${t('Provinces')}</h4><table class="dip"><tr><th>${t('City')}</th><th>${t('People')}</th><th>${t('Order')}</th><th>${t('Income')}</th><th>${t('Building')}</th><th>${t('Training')}</th></tr>${rows}</table></div>`;
  };
  showModal(render(), [], {
    cls: 'wide', cancel: null,
    onClick: e => {
      if (e.target.closest('[data-close]')) return closeModal(null);
      const tx = e.target.closest('[data-tax]');
      if (tx) { st.tax = +tx.dataset.tax; $('modal').innerHTML = render(); refresh(); return; }
      const r = e.target.closest('tr[data-p]');
      if (r) { closeModal(null); UI.selProv = r.dataset.p; UI.selArmy = null; centerOnProv(r.dataset.p); refresh(); }
    },
  });
}

function openChronicle() {
  const items = G.log.slice().reverse().map(l => `<div class="${l.kind}">${inLang(l.text)}</div>`).join('');
  showModal(`<h3>${t('Chronicle')}</h3><div class="chron">${items}</div>`, [{ label: t('Close'), value: null }], { cls: 'wide', cancel: null });
}

// ---------- Menu, saving, help ----------

const SLOTS = ['1', '2', '3'];
function savesHTML(mode) {
  return '<div class="saves">' + ['auto'].concat(SLOTS).map(s => {
    const m = saveMeta(s);
    const label = s === 'auto' ? t('Autosave') : t('Slot {n}', { n: s });
    const desc = m ? `${fName(m.player)} · ${m.turn !== undefined ? dateText(m.turn) : m.date}` : t('Empty');
    const btn = mode === 'save' ? (s === 'auto' ? '' : `<button data-save="${s}">${t('Save here')}</button>`) : `<button data-load="${s}" ${m ? '' : 'disabled'}>${t('Load')}</button>`;
    return `<div class="slot"><div><b>${label}</b><div class="p-sub">${desc}</div></div>${btn}</div>`;
  }).join('') + '</div>';
}

async function openMenu() {
  const v = await showModal(`<h3>${dateText()}</h3><p class="note">${fFull(G.player)}</p>${langPicker()}${soundControls()}<p class="note ver-note" id="ver-note"></p>`, [
    { label: t(LIFE.showRivals ? 'Rival moves: shown' : 'Rival moves: hidden'), value: 'rivals' }, { label: gfxLabel(), value: 'gfx' }, { label: t(fogOn() ? 'Fog of war: on' : 'Fog of war: off'), value: 'fog' }, { label: narrationLabel(), value: 'voice' },
    { label: t('Chronicle'), value: 'chron' }, { label: t('Your reign'), value: 'reign' }, { label: t('Achievements'), value: 'ach' }, { label: t('How to play'), value: 'help' }, { label: t('Guide'), value: 'guide' }, { label: t('Save'), value: 'save' }, { label: t('Load'), value: 'load' },
    { label: t('Main menu'), value: 'title' }, { label: t('Resume'), value: null, cls: 'big' },
  ], { cancel: null, onOpen: m => fillVersion(m.querySelector('#ver-note')), onClick: e => { const l = e.target.closest('[data-lang]'); if (l) { setLang(l.dataset.lang); applyLang(); closeModal(null); openMenu(); } } });
  if (v === 'rivals') { setRivalMoves(!LIFE.showRivals); toast(t('Rival moves'), t(LIFE.showRivals ? 'You will watch rival armies march across the map.' : 'Rival armies will move instantly.'), ''); return openMenu(); }
  if (v === 'voice') { await openNarration(); return openMenu(); }
  if (v === 'fog') {
    G.fog = !fogOn();
    toast(t(fogOn() ? 'Fog of war: on' : 'Fog of war: off'), t(fogOn() ? 'You see only the lands near your cities, armies, allies and spies.' : 'You see every army on the map.'), '');
    renderArmies(); refresh();
    return openMenu();
  }
  if (v === 'gfx') {
    setGfxMode(nextGfxMode());
    const what = { light: 'Simpler drawing for older phones. Takes full effect on the next map you load.', auto: 'The game will choose by itself how much to draw on this device.', full: 'Everything is drawn in full.' };
    toast(gfxLabel(), t(what[GFX.mode]), '');
    return openMenu();
  }
  if (v === 'help') await openHelp();
  if (v === 'guide') startTutorial();
  if (v === 'chron') openChronicle();
  if (v === 'ach') openAchievements();
  if (v === 'reign') openReign();
  if (v === 'save') await openSaves('save');
  if (v === 'load') await openSaves('load');
  if (v === 'title' && await confirmBox(t('Leave the campaign?'), t('Unsaved progress since the last autosave will be lost.'))) toTitle();
}

function openSaves(mode) {
  const file = mode === 'save'
    ? `<div class="p-sec"><h4>${t('Save file')}</h4><p class="note">${t('Keep your campaign as a file, to continue it on another phone or computer, or to keep it safe if this browser is cleared.')}</p><button data-file="out" class="big">${t('Download save file')}</button></div>`
    : `<div class="p-sec"><h4>${t('Save file')}</h4><p class="note">${t('Continue a campaign saved as a file on this or another device.')}</p><button data-file="in" class="big">${t('Open a save file')}</button></div>`;
  return showModal(`<h3>${t(mode === 'save' ? 'Save game' : 'Load game')}</h3>${savesHTML(mode)}${file}`, [{ label: t('Close'), value: null }], {
    cancel: null,
    onClick: e => {
      const f = e.target.closest('[data-file]');
      if (f) { closeModal(null); if (f.dataset.file === 'out') exportSave(); else importSave(); return; }
      const s = e.target.closest('[data-save]'), l = e.target.closest('[data-load]');
      if (s) { const ok = saveGame(s.dataset.save); closeModal(null); toast(t(ok ? 'Saved' : 'Could not save'), ok ? dateText() : t('Browser storage is unavailable.'), ok ? 'good' : 'bad'); }
      if (l) { closeModal(null); if (loadGame(l.dataset.load)) startLoaded(); else toast(t('Could not load'), '', 'bad'); }
    },
  });
}

// Hands the campaign to the player as a file: the share sheet on phones (save to Files, send to
// yourself), a download elsewhere
async function exportSave() {
  const text = gameToText(), name = saveFileName();
  const blob = new Blob([text], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (matchMedia('(hover: none)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      toast(t('Save file ready'), name, 'good');
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; /* otherwise fall back to a download */ }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(t('Save file ready'), t('{name} is in your downloads.', { name }), 'good');
}

// Asks for a save file and continues that campaign
function importSave() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json,text/plain';
  input.onchange = () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const why = gameFromText(String(reader.result || ''));
      if (why) { await infoBox(t('Could not load'), t(why)); return; }
      saveGame('auto'); // it now lives in this browser too
      startLoaded();
    };
    reader.onerror = () => infoBox(t('Could not load'), t('The file could not be read.'));
    reader.readAsText(f);
  };
  input.click();
}

const HELP = [
  ['p', 'You rule one of the seven nations of Turkistan in 1370. Each turn is one month. The last nation standing wins. Destroy your rivals in war, or make them submit to you. You lose if your last city falls.'],
  ['h', 'The easy way to play'],
  ['li', 'Click any city. If it is yours, you can issue decrees, recruit soldiers and build. If it belongs to someone else, you can attack it with any army that can reach it, or talk to its ruler: trade, alliances, marriages, tribute, or a demand to submit.'],
  ['li', 'Your vizier, in the corner, suggests good moves each turn. Click a suggestion to go there.'],
  ['li', 'Press End turn when you are done.'],
  ['h', 'The map'],
  ['li', 'Drag to move the map, scroll or pinch to zoom.'],
  ['li', 'Click a province to see its city, buildings and recruits. Click a banner to select an army.'],
  ['li', 'With an army selected, click a highlighted province (or right-click anywhere) to march. Green: move. Red: battle or siege. Grey: a nation you are at peace with.'],
  ['li', 'Armies of horsemen only can march two provinces a turn.'],
  ['h', 'War'],
  ['li', 'Entering a walled enemy city begins a siege. It surrenders after a few turns, faster with Siege Engineers, or you can storm the walls at once.'],
  ['li', 'When a battle starts you can fight it yourself on the battlefield or let it be auto-resolved.'],
  ['li', 'Spearmen beat cavalry. Horse archers rule the open steppe but struggle in the mountains. Defenders on walls are much stronger.'],
  ['li', 'Armies recover their losses while resting in their own provinces.'],
  ['h', 'Your lands'],
  ['li', 'Gold comes from taxes, the Silk Road and trade agreements. Armies cost upkeep every turn.'],
  ['li', 'Keep public order high with low taxes, mosques and garrisons, or cities will rebel.'],
  ['li', 'Bazaars raise income, irrigation grows the population, barracks and stables unlock troops. Bigger cities can build more.'],
  ['li', 'Use the Realm screen to set taxes and see every province at once.'],
  ['h', 'Stories, requests and wonders'],
  ['li', 'Most turns bring a choice: a Sufi master asking for patronage, bandits on the Silk Road, an envoy from China, a pretender, a spy. Every choice has consequences.'],
  ['li', "The council of amirs sets you tasks with a deadline (shown in the vizier's box). Fulfil them for gold and praise."],
  ['li', 'An army standing in enemy land can plunder the countryside for gold. Steppe armies take more.'],
  ['li', 'Five great wonders can be raised in Samarkand, Shahrisabz, Otrar, Herat and Sarai. Their blessing belongs to whoever holds the city.'],
  ['h', 'Weddings and special places'],
  ['li', 'A marriage with another house weds a real prince to a real princess, with a wedding you can watch. Their children are born in the following years, and sons come of age at fifteen to lead your armies. See them under Court → Marriages.'],
  ['li', 'Fifteen special places are marked on the map: ruins, shrines, mines, passes and lakes. Whoever holds one enjoys its blessing every turn, and the first time you hold one you can visit it and decide what to do there.'],
  ['h', 'People'],
  ['li', 'Open the Court to see your family, generals and the famous people of the age. Princes come of age in their historical years and join you at the head of an army.'],
  ['h', 'Diplomacy'],
  ['li', 'Offer peace, trade, alliances and marriages; demand tribute from the weak. Rulers remember gifts and betrayals.'],
  ['h', 'Keys'],
  ['p', 'Enter: end turn · K: court · D: diplomacy · R: realm · C: chronicle · Esc: close or menu'],
];
function helpHTML() {
  let h = `<h3>${t('How to play')}</h3><div class="help">`, open = false;
  for (const [k, txt] of HELP) {
    if (k === 'li') { if (!open) { h += '<ul>'; open = true; } h += `<li>${t(txt)}</li>`; continue; }
    if (open) { h += '</ul>'; open = false; }
    h += k === 'h' ? `<h4>${t(txt)}</h4>` : `<p>${t(txt)}</p>`;
  }
  return h + (open ? '</ul>' : '') + '</div>';
}
// Where the paintings and photographs come from
function openCredits() {
  const list = (typeof CREDITS !== 'undefined' ? CREDITS : []).map(c =>
    `<li><b>${c.use}</b> — <i>${c.title}</i>${c.author ? ', ' + c.author : ''}${c.date ? ' (' + c.date + ')' : ''}. ${c.license}${c.page ? ` · <a href="${c.page}" target="_blank" rel="noopener">${c.page.includes('opengameart') ? 'OpenGameArt' : 'Wikimedia Commons'}</a>` : ''}</li>`).join('');
  return showModal(`<h3>${t('Pictures in this game')}</h3><p class="note">${t('The portraits and scenes come from Timurid, Persian and Mughal manuscripts painted in the 15th and 16th centuries, many of them made for Temur’s own grandsons. Photographs show the special places as they are today. All are public domain or shared under free licences.')}</p><ul class="credits">${list}</ul>`,
    [{ label: t('Close'), value: null, cls: 'big' }], { cls: 'wide', cancel: null });
}
function openHelp() { return showModal(helpHTML(), [{ label: t('Close'), value: null, cls: 'big' }], { cls: 'wide', cancel: null }); }

// Language buttons, shown on the title screen and in the menu
function langPicker() {
  return '<div class="langs">' + Object.keys(LANGS).map(l => `<button data-lang="${l}" class="${LANG === l ? 'big' : ''}">${LANGS[l]}</button>`).join('') + '</div>';
}

async function checkOverUI() {
  if (G && !G.over) checkVictory();
  if (!G || !G.over || G.overShown === G.over) return;
  G.overShown = G.over;
  const pl = (G.humans && G.winner) || G.player;
  if (G.over === 'win') {
    music('glory'); sfx('cheer');
    const v = await showModal(`<h3>${t('The last nation standing')}</h3><div class="with-portrait">${rulerPortrait(pl)}<p>${t('{date}: every rival crown has fallen or bowed. Your realm ({nation}) alone endures, ruling {n} provinces from the Caspian to the Tian Shan. Poets in Samarkand and Herat will sing of {ruler}.', { date: dateText(), nation: fFull(pl), n: provsOf(pl).length, ruler: pn(G.factions[pl].leader) })}</p></div>`,
      [{ label: t('Main menu'), value: 'title' }, { label: t('The chronicle of the reign'), value: 'reign' }, { label: t('Keep ruling'), value: 'go', cls: 'big' }], { cancel: 'go', cls: 'parch' });
    if (v === 'reign') await openReign(true);
    if (v === 'title') toTitle();
  } else if (G.over === 'lose') {
    music('lament');
    const v = await showModal(`<h3>${t('Defeat')}</h3><p>${G.humans ? t('Every realm ruled by a player has fallen. The computer’s rulers divide Turan between them.') : t('The last lands of your realm ({nation}) have fallen. Your name will live only in the chronicles of your enemies.', { nation: fFull(pl) })}</p>`,
      [{ label: t('The chronicle of the reign'), value: 'reign' }, { label: t('Main menu'), value: true, cls: 'big' }], { cancel: true });
    if (v === 'reign') await openReign(true);
    toTitle();
  }
}

// Tapping a trait explains it (phones have no hover)
document.addEventListener('click', e => {
  const tr = e.target.closest('[data-trait], [data-abil]');
  if (!tr) return;
  const info = tr.dataset.trait ? TRAITS[tr.dataset.trait] : ABILITIES[tr.dataset.abil];
  if (!info) return;
  e.stopPropagation();
  const box = tr.parentElement;
  let d = box.querySelector('.trait-desc');
  if (!d) { d = document.createElement('div'); d.className = 'trait-desc'; box.appendChild(d); }
  const text = t(info.desc);
  d.textContent = d.textContent === text ? '' : text;
}, true);
