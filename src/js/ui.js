'use strict';

const el = id => document.getElementById(id);
const mouse = { x: 0, y: 0, inside: false };
const keys = {};
let sel = [], placing = null, mode = null, drag = null, cmds = [], groups = {};
let paused = false, speed = 1, hudT = 0, idleCursor = 0;
let lastClick = { t: 0, type: null }, lastGroup = { t: 0, n: -1 }, miniDrag = false;

const screenToWorld = (sx, sy) => ({ x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom });
const playing = () => W && !W.over && !paused;

function toast(msg, kind) {
  const box = el('toasts');
  const d = document.createElement('div');
  d.className = 'toast ' + (kind || '');
  d.textContent = msg;
  box.appendChild(d);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => d.remove(), 4000);
}

function resetUi() {
  sel = []; placing = null; mode = null; drag = null; groups = {}; paused = false; speed = 1; idleCursor = 0;
  el('btn-speed').textContent = 'Speed 1x';
  el('toasts').innerHTML = '';
  refreshCmds();
  updateHud(1);
}

// ---------- Selection ----------

function setSel(list) {
  for (const e of sel) e.sel = false;
  sel = list.filter(e => !e.dead);
  for (const e of sel) e.sel = true;
  placing = null; mode = null;
  refreshCmds();
  renderSelInfo();
}

function pickEntity(wx, wy) {
  let best = null, bd = 15;
  for (const u of W.units) {
    if (u.dead || (u.team !== PLAYER && !W.visible[tidx(tileOf(u.x), tileOf(u.y))])) continue;
    const d = dist(wx, wy, u.x, u.y - 5);
    if (d < bd) { bd = d; best = u; }
  }
  if (best) return best;
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  if (!inMap(tx, ty)) return null;
  const i = tidx(tx, ty);
  if (!W.explored[i]) return null;
  const b = W.bldAt[i];
  if (b) return b.seen ? b : null;
  return W.nodeAt[i];
}

const myUnits = () => sel.filter(e => e.kind === 'unit' && e.team === PLAYER && !e.dead);

// ---------- Commands ----------

function costHtml(cost) {
  if (!cost) return '';
  const tm = W.teams[PLAYER];
  return Object.keys(cost).map(r =>
    `<span class="${tm[r] < cost[r] ? 'lack' : ''}"><i class="gem ${r}"></i> ${cost[r]} ${r}</span>`).join('');
}

function lackMsg(cost) {
  const tm = W.teams[PLAYER];
  for (const r in cost) if (tm[r] < cost[r]) return 'Not enough ' + r;
  return null;
}

function startPlacing(type) {
  const msg = lackMsg(BUILDINGS[type].cost);
  if (msg) return toast(msg, 'warn');
  placing = type; mode = null;
}

function tryPlace(w, keep) {
  const d = BUILDINGS[placing], s = d.size;
  const tx = Math.round(w.x / TILE - s / 2), ty = Math.round(w.y / TILE - s / 2);
  if (!canPlace(placing, tx, ty, true)) return toast('Cannot build there', 'warn');
  const msg = lackMsg(d.cost);
  if (msg) { placing = null; return toast(msg, 'warn'); }
  pay(PLAYER, d.cost);
  const b = makeBuilding(placing, PLAYER, tx, ty, false);
  for (const u of myUnits()) if (u.type === 'villager') orderBuild(u, b);
  if (!keep || lackMsg(d.cost)) placing = null;
}

function playerTrain(b, type, many) {
  for (let i = 0; i < (many ? 5 : 1); i++) {
    const err = trainUnit(b, type);
    if (err === 'cost') toast(lackMsg(UNITS[type].cost), 'warn');
    else if (err === 'pop') toast(W.teams[PLAYER].cap >= POP_MAX ? 'Population limit reached' : 'Build more Yurts to house your people', 'warn');
    else if (err === 'queue') toast('Training queue is full', 'warn');
    if (err) break;
  }
  renderSelInfo();
}

function demolish() {
  for (const e of sel.slice()) if (e.team === PLAYER && !e.dead) kill(e, null);
  setSel([]);
}

function refreshCmds() {
  cmds = [];
  const mine = sel.filter(e => e.team === PLAYER && !e.dead);
  if (mine.length && mine[0].kind === 'unit') {
    if (mine.every(u => u.type === 'villager')) {
      for (const k of BUILD_ORDER) {
        const d = BUILDINGS[k];
        cmds.push({ key: d.key, img: icon('b', k), name: 'Build ' + d.name, cost: d.cost, desc: d.desc, act: () => startPlacing(k) });
      }
    }
    if (mine.some(isMilitary)) {
      cmds.push({ key: 'Q', glyph: '⚔', name: 'Attack-move', desc: 'Click a spot: your troops march there and fight anything on the way.', act: () => { mode = 'amove'; placing = null; } });
    }
    cmds.push({ key: 'X', glyph: '■', name: 'Stop', desc: 'Cancel the current order.', act: () => { for (const u of myUnits()) setIdle(u); } });
  } else if (mine.length === 1 && mine[0].kind === 'building') {
    const b = mine[0], trains = b.built ? BUILDINGS[b.type].trains || [] : [];
    trains.forEach((t, i) => {
      const d = UNITS[t];
      cmds.push({ key: 'QERT'[i], img: icon('u', t), name: 'Train ' + d.name, cost: d.cost, desc: d.desc + ' Shift-click to train 5.', act: e => playerTrain(b, t, e && e.shiftKey) });
    });
    cmds.push({ key: 'Delete', glyph: '✖', name: 'Demolish', desc: 'Tear this building down. Nothing is refunded.', act: demolish });
  }
  el('commands').innerHTML = cmds.map((c, i) =>
    `<button class="cmd" data-i="${i}">${c.img ? `<img src="${c.img}">` : `<span class="glyph">${c.glyph}</span>`}<span class="key">${c.key === 'Delete' ? 'Del' : c.key}</span></button>`).join('');
  el('tooltip').classList.add('hidden');
}

function showTip(c) {
  const t = el('tooltip');
  t.innerHTML = `<div class="t-name">${c.name} <span style="color:#e2b84a">[${c.key === 'Delete' ? 'Del' : c.key}]</span></div>` +
    (c.cost ? `<div class="t-cost">${costHtml(c.cost)}</div>` : '') + `<div class="t-desc">${c.desc || ''}</div>`;
  t.classList.remove('hidden');
}

// ---------- Right-click orders ----------

function rightClick(w) {
  const mine = sel.filter(e => e.team === PLAYER && !e.dead);
  if (!mine.length) return;
  const tgt = pickEntity(w.x, w.y);
  if (mine[0].kind === 'building') {
    for (const b of mine) b.rally = { x: w.x, y: w.y, target: tgt && tgt.team !== ENEMY ? tgt : null };
    W.effects.push({ type: 'click', x: w.x, y: w.y, life: 0.5, color: '#fff' });
    return;
  }
  let color = '#7fe07f';
  if (tgt && tgt.team === ENEMY) {
    color = '#ff6050';
    for (const u of mine) if (UNITS[u.type].atk) orderAttack(u, tgt);
  } else if (tgt && tgt.kind === 'node') {
    color = '#ffd95a';
    const spots = groupTiles(mine.length, tgt.tx, tgt.ty);
    mine.forEach((u, i) => u.type === 'villager' ? orderGather(u, tgt) : orderMove(u, w.x, w.y, spots[i]));
  } else if (tgt && tgt.kind === 'building' && tgt.team === PLAYER) {
    color = '#ffd95a';
    let farmTaken = false;
    for (const u of mine) {
      if (u.type === 'villager') {
        if (!tgt.built || tgt.hp < tgt.maxHp) orderBuild(u, tgt);
        else if (tgt.type === 'farm' && !farmTaken) { tgt.worker = u; farmTaken = true; orderGather(u, tgt); }
        else if (BUILDINGS[tgt.type].dropoff && u.carry > 0) { orderReturn(u, u.order.node && u.order.node.kind === 'node' ? u.order.node : null); u.order.drop = tgt; }
        else orderMove(u, w.x, w.y);
      } else if (u.type === 'caravan' && tgt.type === 'caravanserai' && tgt.built) orderTrade(u, tgt);
      else orderMove(u, w.x, w.y);
    }
  } else {
    const spots = groupTiles(mine.length, tileOf(w.x), tileOf(w.y));
    mine.forEach((u, i) => orderMove(u, w.x, w.y, spots[i]));
  }
  W.effects.push({ type: 'click', x: w.x, y: w.y, life: 0.5, color });
}

function issueAMove(w) {
  const mine = myUnits();
  const spots = groupTiles(mine.length, tileOf(w.x), tileOf(w.y));
  mine.forEach((u, i) => orderAMove(u, w.x, w.y, spots[i]));
  W.effects.push({ type: 'click', x: w.x, y: w.y, life: 0.5, color: '#ff6050' });
}

// ---------- Mouse ----------

canvas.addEventListener('mousedown', e => {
  if (!playing()) return;
  const w = screenToWorld(e.clientX, e.clientY);
  if (e.button === 0) {
    if (placing) return tryPlace(w, e.shiftKey);
    if (mode === 'amove') { issueAMove(w); mode = null; return; }
    drag = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, shift: e.shiftKey };
  } else if (e.button === 2) {
    if (placing || mode) { placing = null; mode = null; return; }
    rightClick(w);
  }
});

window.addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
  if (drag) { drag.x = e.clientX; drag.y = e.clientY; }
  if (miniDrag) miniMove(e);
});
document.addEventListener('mouseleave', () => { mouse.inside = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.inside = false; });
window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('mouseup', e => {
  miniDrag = false;
  if (!drag || e.button !== 0) return;
  const d = drag;
  drag = null;
  if (!playing()) return;
  if (Math.abs(d.x - d.sx) + Math.abs(d.y - d.sy) <= 6) {
    const w = screenToWorld(d.x, d.y), t = pickEntity(w.x, w.y), now = performance.now();
    if (!t) return setSel([]);
    if (t.kind === 'unit' && t.team === PLAYER) {
      if (now - lastClick.t < 350 && lastClick.type === t.type) {
        const a = screenToWorld(0, 0), b = screenToWorld(canvas.width, canvas.height);
        setSel(W.units.filter(u => u.team === PLAYER && u.type === t.type && u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y));
      } else if (d.shift && sel.length && sel[0].kind === 'unit' && sel[0].team === PLAYER) {
        setSel(sel.includes(t) ? sel.filter(u => u !== t) : sel.concat(t));
      } else setSel([t]);
      lastClick = { t: now, type: t.type };
    } else setSel([t]);
    return;
  }
  const a = screenToWorld(Math.min(d.sx, d.x), Math.min(d.sy, d.y)), b = screenToWorld(Math.max(d.sx, d.x), Math.max(d.sy, d.y));
  let picked = W.units.filter(u => u.team === PLAYER && !u.dead && u.x >= a.x && u.x <= b.x && u.y >= a.y - 8 && u.y <= b.y + 8);
  if (picked.some(isMilitary)) picked = picked.filter(isMilitary); // soldiers take priority over workers
  if (d.shift && sel.length && sel[0].kind === 'unit' && sel[0].team === PLAYER) picked = sel.concat(picked.filter(u => !sel.includes(u)));
  if (picked.length || !d.shift) setSel(picked);
});

canvas.addEventListener('wheel', e => {
  if (!W) return;
  const before = screenToWorld(e.clientX, e.clientY);
  cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.55, 1.7);
  cam.x = before.x - e.clientX / cam.zoom;
  cam.y = before.y - e.clientY / cam.zoom;
  clampCam();
}, { passive: true });

function miniMove(e) {
  const r = mini.getBoundingClientRect();
  centerOn((e.clientX - r.left) / r.width * WORLD_W, (e.clientY - r.top) / r.height * WORLD_H);
}
mini.addEventListener('mousedown', e => {
  if (!W) return;
  if (e.button === 0) { miniDrag = true; miniMove(e); }
  else if (e.button === 2 && playing()) {
    const r = mini.getBoundingClientRect();
    rightClick({ x: (e.clientX - r.left) / r.width * WORLD_W, y: (e.clientY - r.top) / r.height * WORLD_H });
  }
});

// ---------- Keyboard ----------

window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'F11') { e.preventDefault(); if (window.desktop) window.desktop.toggleFullscreen(); return; }
  if (!W || W.over || e.repeat) return;
  if (e.code === 'Escape') {
    if (!el('howto').classList.contains('hidden')) return;
    if (placing || mode) { placing = null; mode = null; } else togglePause();
    return;
  }
  if (e.code === 'KeyP') return togglePause();
  if (paused) return;
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (e.ctrlKey) { groups[n] = myUnits(); toast('Group ' + n + ' set'); e.preventDefault(); }
    else if (groups[n]) {
      const g = groups[n].filter(u => !u.dead), now = performance.now();
      if (!g.length) return;
      setSel(g);
      if (lastGroup.n === n && now - lastGroup.t < 400) centerOn(g[0].x, g[0].y);
      lastGroup = { t: now, n };
    }
    return;
  }
  if (e.code === 'Period') return nextIdle();
  if (e.code === 'KeyH') {
    const c = W.buildings.find(b => b.team === PLAYER && b.type === 'citadel');
    if (c) { centerOn(c.x, c.y); setSel([c]); }
    return;
  }
  const k = e.code === 'Delete' ? 'Delete' : e.code.startsWith('Key') ? e.code.slice(3) : null;
  const c = k && cmds.find(c => c.key === k);
  if (c) c.act(e);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function nextIdle() {
  const idle = W.units.filter(u => u.team === PLAYER && u.type === 'villager' && u.order.t === 'idle');
  if (!idle.length) return;
  const u = idle[idleCursor++ % idle.length];
  setSel([u]);
  centerOn(u.x, u.y);
}

function updateCamera(dt) {
  if (!W || paused) return;
  let dx = 0, dy = 0;
  if (keys.ArrowLeft || keys.KeyA) dx--;
  if (keys.ArrowRight || keys.KeyD) dx++;
  if (keys.ArrowUp || keys.KeyW) dy--;
  if (keys.ArrowDown || keys.KeyS) dy++;
  if (mouse.inside && document.hasFocus() && !drag) {
    if (mouse.x <= 2) dx--; else if (mouse.x >= window.innerWidth - 3) dx++;
    if (mouse.y <= 2) dy--; else if (mouse.y >= window.innerHeight - 3) dy++;
  }
  if (dx || dy) {
    const v = 900 / cam.zoom * dt;
    cam.x += dx * v; cam.y += dy * v;
    clampCam();
  }
}

// ---------- HUD ----------

const ORDER_TEXT = { idle: 'Idle', move: 'Moving', amove: 'Marching to battle', attack: 'Fighting', build: 'Building', return: 'Carrying goods home', trade: 'Trading' };

function describe(u) {
  const o = u.order;
  if (o.t === 'gather') return o.node.kind === 'building' ? 'Farming' : 'Gathering ' + o.node.res;
  return ORDER_TEXT[o.t] || '';
}

function renderSelInfo() {
  const box = el('selinfo');
  if (!W) return;
  sel = sel.filter(e => !e.dead);
  if (!sel.length) {
    box.innerHTML = '<div class="hint">Left-click or drag to select. Right-click to move, gather, build or attack.<br>Select a Dehqan to construct buildings, or your Citadel to train more Dehqans.</div>';
    return;
  }
  if (sel.length > 1) {
    const by = {};
    for (const u of sel) by[u.type] = (by[u.type] || 0) + 1;
    box.innerHTML = `<div class="sel-sub">${sel.length} units selected</div><div class="multi">` +
      Object.keys(by).map(t => `<div class="grp"><img data-type="${t}" src="${icon('u', t)}" title="${UNITS[t].name}"><span class="n">${by[t]}</span></div>`).join('') + '</div>';
    return;
  }
  const e = sel[0];
  let h = '';
  if (e.kind === 'node') {
    h = `<div class="sel-head"><img src="${icon('n', e.type)}"><div><div class="sel-name">${NODES[e.type].name}</div>
      <div class="sel-sub">${e.amount} ${e.res} left</div></div></div>`;
  } else if (e.kind === 'unit') {
    const d = UNITS[e.type];
    h = `<div class="sel-head"><img src="${icon(e.team === PLAYER ? 'u' : 'e', e.type)}"><div><div class="sel-name">${d.name}${e.team === ENEMY ? ' (enemy)' : ''}</div>
      <div class="bar"><div style="width:${e.hp / e.maxHp * 100}%"></div></div><div class="sel-sub">${Math.ceil(e.hp)} / ${e.maxHp} health</div></div></div>
      <div class="stats">${d.atk ? `Attack <b>${d.atk}</b> &nbsp; Range <b>${d.ranged ? Math.round(d.range / TILE) : 'melee'}</b> &nbsp; ` : ''}Speed <b>${d.speed}</b>` +
      (e.team === PLAYER ? `<br>${describe(e)}${e.carry > 0 ? ` &nbsp; Carrying <b>${e.carry} ${e.carryType}</b>` : ''}` : '') + '</div>';
  } else {
    const d = BUILDINGS[e.type];
    h = `<div class="sel-head"><img src="${icon('b', e.type)}"><div><div class="sel-name">${d.name}${e.team === ENEMY ? ' (enemy)' : ''}</div>` +
      (e.team === NEUTRAL ? '' : `<div class="bar"><div style="width:${e.hp / e.maxHp * 100}%"></div></div><div class="sel-sub">${Math.ceil(e.hp)} / ${e.maxHp} health</div>`) + '</div></div>';
    if (e.team === NEUTRAL) h += `<div class="stats">${d.desc}</div>`;
    else if (!e.built) h += `<div class="stats">Under construction: <b>${Math.floor(e.progress * 100)}%</b></div>`;
    else if (e.team === PLAYER) {
      if (e.queue.length) {
        h += `<div class="queue">` + e.queue.map((t, i) => `<img data-cancel="${i}" src="${icon('u', t)}" title="Click to cancel">`).join('') +
          `</div><div class="bar prog"><div style="width:${e.qt / UNITS[e.queue[0]].time * 100}%"></div></div>`;
      } else if (d.trains) h += '<div class="stats">Right-click the map to set a rally point for new units.</div>';
      else if (e.type === 'farm') h += `<div class="stats">${farmFree(e, null) ? 'No one is working this farm. Right-click it with a Dehqan.' : 'A Dehqan is working this farm.'}</div>`;
      else h += `<div class="stats">${d.desc}</div>`;
    }
  }
  box.innerHTML = h;
}

el('selinfo').addEventListener('mousedown', e => {
  const t = e.target;
  if (!playing()) return;
  if (t.dataset.cancel !== undefined) {
    const b = sel[0], i = +t.dataset.cancel, type = b.queue[i];
    if (!type) return;
    b.queue.splice(i, 1);
    if (i === 0) b.qt = 0;
    pay(PLAYER, UNITS[type].cost, -1);
    W.teams[PLAYER].queued -= UNITS[type].pop;
    renderSelInfo();
  } else if (t.dataset.type) {
    setSel(sel.filter(u => u.type === t.dataset.type));
  }
});

const cmdBox = el('commands');
cmdBox.addEventListener('mousedown', e => {
  const b = e.target.closest('.cmd');
  if (b && playing() && e.button === 0) cmds[+b.dataset.i].act(e);
});
cmdBox.addEventListener('mouseover', e => {
  const b = e.target.closest('.cmd');
  if (b) showTip(cmds[+b.dataset.i]);
});
cmdBox.addEventListener('mouseleave', () => el('tooltip').classList.add('hidden'));

function setText(id, v) {
  const n = el(id);
  if (n.textContent !== v) n.textContent = v;
}

function updateHud(dt) {
  if (!W) return;
  if (sel.some(e => e.dead)) setSel(sel.filter(e => !e.dead));
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.2;
  const tm = W.teams[PLAYER];
  for (const r of RES) setText('r-' + r, String(Math.floor(tm[r])));
  setText('r-pop', tm.pop + '/' + tm.cap);
  const t = Math.floor(W.time);
  setText('clock', String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'));
  const idle = W.units.reduce((n, u) => n + (u.team === PLAYER && u.type === 'villager' && u.order.t === 'idle' ? 1 : 0), 0);
  setText('btn-idle', 'Idle workers: ' + idle);
  el('btn-idle').classList.toggle('active', idle > 0);
  const btns = cmdBox.children;
  for (let i = 0; i < btns.length; i++) btns[i].classList.toggle('off', !!(cmds[i].cost && !canAfford(PLAYER, cmds[i].cost)));
  const hint = el('modehint');
  hint.classList.toggle('hidden', !placing && !mode);
  if (placing) hint.textContent = 'Placing ' + BUILDINGS[placing].name + ': left-click to build, right-click to cancel, hold Shift to place several';
  else if (mode) hint.textContent = 'Attack-move: left-click the destination, right-click to cancel';
  renderSelInfo();
  drawMinimap();
}

function togglePause(force) {
  if (!W || W.over) return;
  paused = force === undefined ? !paused : force;
  el('pause').classList.toggle('hidden', !paused);
  drag = null;
}

el('btn-idle').addEventListener('click', () => { if (playing()) nextIdle(); });
el('btn-menu').addEventListener('click', () => togglePause(true));
el('btn-speed').addEventListener('click', () => {
  speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
  el('btn-speed').textContent = 'Speed ' + speed + 'x';
});
