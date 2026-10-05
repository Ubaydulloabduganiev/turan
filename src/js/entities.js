'use strict';

let W = null; // the current world

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// Distance from the point (u.x, u.y) to the body of a target entity.
function edgeDist(u, t) {
  if (t.kind === 'unit') return Math.max(0, Math.hypot(u.x - t.x, u.y - t.y) - 8);
  const h = (t.kind === 'building' ? t.size : 1) * TILE / 2;
  return Math.hypot(Math.max(Math.abs(u.x - t.x) - h, 0), Math.max(Math.abs(u.y - t.y) - h, 0));
}

function mkTeam(gatherMod) {
  return { food: 200, wood: 200, stone: 100, gold: 50, pop: 0, cap: 0, queued: 0, gatherMod, stats: { trained: 0, kills: 0, lost: 0, razed: 0 } };
}

function canAfford(team, cost) {
  const tm = W.teams[team];
  for (const r in cost) if (tm[r] < cost[r]) return false;
  return true;
}
function pay(team, cost, sign = 1) {
  const tm = W.teams[team];
  for (const r in cost) tm[r] -= cost[r] * sign;
}

function newWorld(seed, diffKey) {
  const diff = DIFF[diffKey];
  W = {
    seed, diffKey, diff, time: 0, nextId: 1, terrain: null, blocked: null, bases: null,
    nodeAt: new Array(MAP_N).fill(null), bldAt: new Array(MAP_N).fill(null),
    nodes: [], units: [], buildings: [], projectiles: [], effects: [],
    explored: new Uint8Array(MAP_N), visible: new Uint8Array(MAP_N), fogT: 0, fogDirty: true,
    over: null, bazaar: null, alertT: -99, needClean: false,
    teams: [mkTeam(1), mkTeam(diff.gather), mkTeam(1)],
    ai: { t: 0, wave: 0, nextAttack: diff.firstAttack, attackers: [] },
  };
  generateMap(seed);
  W.bazaar = makeBuilding('bazaar', NEUTRAL, 38, 38, true);
  const start = [[-2, 2], [0, 2], [2, 2], [2, 0]];
  for (const team of [PLAYER, ENEMY]) {
    const b = W.bases[team], sg = team === PLAYER ? 1 : -1;
    makeBuilding('citadel', team, b.x - 1, b.y - 1, true);
    for (const [ox, oy] of start) makeUnit('villager', team, (b.x + ox * sg + 0.5) * TILE, (b.y + oy * sg + 0.5) * TILE);
  }
  updateFog();
}

// ---------- Creation ----------

function makeUnit(type, team, x, y) {
  const d = UNITS[type];
  const u = {
    id: W.nextId++, kind: 'unit', type, team, x, y, hp: d.hp, maxHp: d.hp, path: null, pi: 0, goal: null,
    order: { t: 'idle' }, cd: 0, carry: 0, carryType: null, gt: 0, face: team === PLAYER ? 1 : -1,
    scan: Math.random() * 0.4, anim: Math.random() * 10, dead: false, lastHit: -99,
    anchored: false, moving: false, working: false, sel: false,
  };
  W.units.push(u);
  W.teams[team].pop += d.pop;
  return u;
}

function makeBuilding(type, team, tx, ty, built) {
  const d = BUILDINGS[type];
  const b = {
    id: W.nextId++, kind: 'building', type, team, tx, ty, size: d.size,
    x: (tx + d.size / 2) * TILE, y: (ty + d.size / 2) * TILE,
    hp: built ? d.hp : Math.max(1, d.hp * 0.1), maxHp: d.hp, built, progress: built ? 1 : 0,
    queue: [], qt: 0, rally: null, cd: 0, dead: false, worker: null, lastHit: -99, seen: team === PLAYER, sel: false,
  };
  for (let y = ty; y < ty + d.size; y++) {
    for (let x = tx; x < tx + d.size; x++) { W.blocked[tidx(x, y)] = 1; W.bldAt[tidx(x, y)] = b; }
  }
  W.buildings.push(b);
  if (built) recalcPop(team);
  return b;
}

function canPlace(type, tx, ty, needExplored) {
  const s = BUILDINGS[type].size;
  for (let y = ty; y < ty + s; y++) {
    for (let x = tx; x < tx + s; x++) {
      if (!inMap(x, y)) return false;
      const i = tidx(x, y);
      if (W.blocked[i] || (needExplored && !W.explored[i])) return false;
    }
  }
  return true;
}

function recalcPop(team) {
  let cap = 0;
  for (const b of W.buildings) if (b.team === team && b.built && !b.dead) cap += BUILDINGS[b.type].pop || 0;
  W.teams[team].cap = Math.min(POP_MAX, cap);
}

function completeBuilding(b) {
  b.built = true; b.progress = 1;
  recalcPop(b.team);
  if (b.team === PLAYER) toast(BUILDINGS[b.type].name + ' completed', 'good');
}

function removeNode(n) {
  n.dead = true;
  const i = tidx(n.tx, n.ty);
  W.blocked[i] = 0; W.nodeAt[i] = null;
  W.needClean = true;
}

// ---------- Lookups ----------

function nodeAccessible(n) {
  for (const [ox, oy] of DIRS) {
    const x = n.tx + ox, y = n.ty + oy;
    if (inMap(x, y) && !W.blocked[tidx(x, y)]) return true;
  }
  return false;
}

function nearestNode(res, x, y, maxTiles, exclude) {
  let best = null, bd = maxTiles * TILE;
  for (const n of W.nodes) {
    if (n.dead || n.res !== res || n === exclude) continue;
    const d = dist(x, y, n.x, n.y);
    if (d < bd && nodeAccessible(n)) { bd = d; best = n; }
  }
  return best;
}

function nearestDropoff(u) {
  let best = null, bd = 1e9;
  for (const b of W.buildings) {
    if (b.team !== u.team || b.dead || !b.built || !BUILDINGS[b.type].dropoff) continue;
    const d = edgeDist(u, b);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

const farmFree = (b, u) => !b.worker || b.worker === u || b.worker.dead || b.worker.order.node !== b;

function findFreeFarm(u) {
  let best = null, bd = 1e9;
  for (const b of W.buildings) {
    if (b.team !== u.team || b.dead || !b.built || b.type !== 'farm' || !farmFree(b, u)) continue;
    const d = edgeDist(u, b);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

const rectGoal = b => ({ x: b.tx, y: b.ty, w: b.size, h: b.size, adj: true });
const isMilitary = u => u.type !== 'villager' && UNITS[u.type].atk > 0;

// ---------- Orders ----------

function setPath(u, goal) {
  u.goal = goal;
  const tx = tileOf(u.x), ty = tileOf(u.y);
  u.path = findPath(tx, ty, goal);
  u.pi = 0;
  // Already on a goal tile: step to its centre, which is always within working range of the target.
  if (!u.path.length && u.path.ok) {
    const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
    if (Math.abs(cx - u.x) + Math.abs(cy - u.y) > 2) u.path.push({ x: cx, y: cy });
  }
}
function setIdle(u) { u.order = { t: 'idle' }; u.path = null; }

function orderMove(u, x, y, tile) {
  const f = tile || nearestFree(tileOf(x), tileOf(y));
  if (!f) return;
  u.order = { t: 'move' };
  setPath(u, { x: f.x, y: f.y });
}
function orderAMove(u, x, y, tile) {
  if (!isMilitary(u)) return orderMove(u, x, y, tile);
  const f = tile || nearestFree(tileOf(x), tileOf(y));
  if (!f) return;
  u.order = { t: 'amove', x: (f.x + 0.5) * TILE, y: (f.y + 0.5) * TILE };
  setPath(u, { x: f.x, y: f.y });
}
function orderAttack(u, target, resume, auto) {
  if (!UNITS[u.type].atk) return;
  u.order = { t: 'attack', target, resume: resume || null, auto: !!auto, rp: 0, fail: 0 };
  u.path = null;
}
function orderGather(u, node) {
  if (u.type !== 'villager') return;
  if (node.kind === 'node' && !nodeAccessible(node)) {
    node = nearestNode(node.res, node.x, node.y, 10) || node;
  }
  u.order = { t: 'gather', node, rp: 0, fail: 0 };
  u.path = null;
}
function orderBuild(u, b) {
  if (u.type !== 'villager') return;
  u.order = { t: 'build', b, rp: 0, fail: 0 };
  u.path = null;
}
function orderReturn(u, node) {
  u.order = { t: 'return', node: node || null, drop: null, rp: 0, fail: 0 };
  u.path = null;
}
function orderTrade(u, home) {
  if (u.type !== 'caravan') return;
  u.order = { t: 'trade', home, leg: u.carry > 0 ? 'back' : 'out', rp: 0, fail: 0 };
  u.path = null;
}

// ---------- Movement ----------

// Advances along the current path. Returns true when the path is finished.
function followPath(u, d, dt) {
  if (!u.path || u.pi >= u.path.length) return true;
  let step = d.speed * dt, guard = 0;
  while (step > 0 && u.pi < u.path.length) {
    const p = u.path[u.pi];
    if (W.blocked[tidx(tileOf(p.x), tileOf(p.y))] && u.goal && guard++ < 2) {
      setPath(u, u.goal); // something was built on our route
      continue;
    }
    const dx = p.x - u.x, dy = p.y - u.y, dd = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.5) u.face = dx > 0 ? 1 : -1;
    if (dd <= step) { u.x = p.x; u.y = p.y; u.pi++; step -= dd; } else { u.x += dx / dd * step; u.y += dy / dd * step; step = 0; }
  }
  u.moving = true;
  return u.pi >= u.path.length;
}

// Walks towards a goal, re-planning at most about once a second. o.fail counts unreachable attempts.
function approach(u, d, dt, goal, o) {
  o.rp -= dt;
  if (!u.path || u.pi >= u.path.length) {
    if (o.rp > 0) return;
    o.rp = 0.7 + Math.random() * 0.3;
    setPath(u, goal);
    if (!u.path.ok) o.fail++;
    if (!u.path.length) return;
  }
  followPath(u, d, dt);
}

// ---------- Combat ----------

function acquire(u, d, dt) {
  u.scan -= dt;
  if (u.scan > 0) return null;
  u.scan = 0.4;
  const r = d.sight * TILE;
  let best = null, bd = r;
  for (const e of W.units) {
    if (e.team === u.team || e.dead) continue;
    const dd = dist(u.x, u.y, e.x, e.y);
    if (dd < bd) { bd = dd; best = e; }
  }
  if (best) return best;
  for (const b of W.buildings) {
    if (b.team === u.team || b.team === NEUTRAL || b.dead) continue;
    const dd = edgeDist(u, b);
    if (dd < bd) { bd = dd; best = b; }
  }
  return best;
}

function damageMod(d, t) {
  if (t.kind === 'building') return d.vsBuilding || 1;
  if (d.vsMounted && UNITS[t.type].mounted) return d.vsMounted;
  return 1;
}

function strike(src, d, t) {
  const dmg = d.atk * damageMod(d, t);
  if (d.ranged || src.kind === 'building') {
    W.projectiles.push({ x: src.x, y: src.y - (src.kind === 'building' ? 30 : 8), target: t, dmg, src });
  } else {
    applyDamage(t, dmg, src);
  }
}

function applyDamage(t, dmg, src) {
  if (t.dead) return;
  t.hp -= dmg;
  t.lastHit = W.time;
  if (t.team === PLAYER) notifyAttack(t);
  if (t.hp <= 0) return kill(t, src);
  if (t.kind === 'unit' && src && !src.dead && t.order.t === 'idle' && isMilitary(t)) orderAttack(t, src, null, true);
}

function notifyAttack(t) {
  if (W.time - W.alertT < 12) return;
  W.alertT = W.time;
  W.effects.push({ type: 'ping', x: t.x, y: t.y, life: 5 });
  toast(t.kind === 'building' ? 'Our ' + BUILDINGS[t.type].name + ' is under attack!' : 'Our people are under attack!', 'warn');
}

function kill(t, src) {
  if (t.dead) return;
  t.dead = true;
  W.needClean = true;
  const tm = W.teams[t.team];
  if (t.kind === 'unit') {
    tm.pop -= UNITS[t.type].pop;
    tm.stats.lost++;
    if (src) W.teams[src.team].stats.kills++;
    W.effects.push({ type: 'death', x: t.x, y: t.y, life: 6 });
    return;
  }
  for (let y = t.ty; y < t.ty + t.size; y++) {
    for (let x = t.tx; x < t.tx + t.size; x++) { W.blocked[tidx(x, y)] = 0; W.bldAt[tidx(x, y)] = null; }
  }
  for (const q of t.queue) tm.queued -= UNITS[q].pop;
  t.queue = [];
  if (src) W.teams[src.team].stats.razed++;
  W.effects.push({ type: 'rubble', x: t.x, y: t.y, r: t.size * TILE / 2, life: 10 });
  recalcPop(t.team);
  for (const team of [PLAYER, ENEMY]) {
    if (!W.over && !W.buildings.some(b => b.team === team && b.type === 'citadel' && !b.dead)) W.over = team === PLAYER ? 'lose' : 'win';
  }
}

function finishAttack(u) {
  const r = u.order.resume;
  if (r) orderAMove(u, r.x, r.y); else setIdle(u);
}

function doAttack(u, d, dt) {
  const o = u.order, t = o.target;
  if (!t || t.dead) return finishAttack(u);
  const dd = edgeDist(u, t);
  if (o.auto && dd > d.sight * TILE * 1.8) return finishAttack(u);
  const reach = t.kind === 'building' ? Math.max(d.range, 24) : d.range;
  if (dd <= reach) {
    u.anchored = true; u.path = null;
    if (Math.abs(t.x - u.x) > 1) u.face = t.x > u.x ? 1 : -1;
    if (u.cd <= 0) { u.cd = d.cd; u.swing = 0.25; strike(u, d, t); }
    return;
  }
  o.rp -= dt;
  const done = !u.path || u.pi >= u.path.length;
  if (o.rp <= 0 && (done || t.kind === 'unit')) {
    o.rp = 0.6 + Math.random() * 0.3;
    if (t.kind === 'building') setPath(u, rectGoal(t));
    else {
      const tx = tileOf(t.x), ty = tileOf(t.y);
      setPath(u, W.blocked[tidx(tx, ty)] ? { x: tx, y: ty, w: 1, h: 1, adj: true } : { x: tx, y: ty });
    }
    if (!u.path.ok) o.fail++;
    if (o.fail > 6) return finishAttack(u);
  }
  followPath(u, d, dt);
}

// ---------- Economy ----------

function doGather(u, d, dt) {
  const o = u.order, n = o.node, tm = W.teams[u.team];
  if (n.kind === 'building') { // farm
    if (n.dead || !n.built) return setIdle(u);
    if (!farmFree(n, u)) {
      const other = findFreeFarm(u);
      if (!other) return setIdle(u);
      o.node = other; other.worker = u; u.path = null;
      return;
    }
    n.worker = u;
    if (edgeDist(u, n) <= 24) {
      u.anchored = true; u.working = true; u.path = null;
      tm.food += FARM_RATE * tm.gatherMod * dt;
    } else {
      approach(u, d, dt, rectGoal(n), o);
      if (o.fail > 4) setIdle(u);
    }
    return;
  }
  if (n.dead) {
    const next = nearestNode(n.res, n.x, n.y, 10);
    if (next) { o.node = next; o.fail = 0; u.path = null; } else if (u.carry > 0) orderReturn(u, null); else setIdle(u);
    return;
  }
  if (u.carryType !== n.res) { u.carry = 0; u.carryType = n.res; }
  if (u.carry >= CARRY) return orderReturn(u, n);
  if (dist(u.x, u.y, n.x, n.y) <= 46) {
    u.anchored = true; u.working = true; u.path = null;
    if (Math.abs(n.x - u.x) > 1) u.face = n.x > u.x ? 1 : -1;
    u.gt += GATHER_RATE[n.res] * tm.gatherMod * dt;
    while (u.gt >= 1 && u.carry < CARRY && n.amount > 0) { u.gt--; u.carry++; n.amount--; }
    if (n.amount <= 0) removeNode(n);
  } else {
    approach(u, d, dt, { x: n.tx, y: n.ty, w: 1, h: 1, adj: true }, o);
    if (o.fail > 3) {
      const next = nearestNode(n.res, u.x, u.y, 14, n);
      if (next) { o.node = next; o.fail = 0; u.path = null; } else setIdle(u);
    }
  }
}

function doReturn(u, d, dt) {
  const o = u.order;
  if (!o.drop || o.drop.dead) {
    o.drop = nearestDropoff(u); u.path = null;
    if (!o.drop) return setIdle(u);
  }
  if (edgeDist(u, o.drop) <= 24) {
    if (u.carryType) W.teams[u.team][u.carryType] += u.carry;
    u.carry = 0;
    const n = o.node;
    if (n && !n.dead) return orderGather(u, n);
    const next = n ? nearestNode(n.res, n.x, n.y, 10) : null;
    return next ? orderGather(u, next) : setIdle(u);
  }
  approach(u, d, dt, rectGoal(o.drop), o);
  if (o.fail > 4) setIdle(u);
}

function doBuild(u, d, dt) {
  const o = u.order, b = o.b;
  if (b.dead) return setIdle(u);
  if (b.built && b.hp >= b.maxHp) {
    if (b.type === 'farm' && farmFree(b, u)) return orderGather(u, b);
    const next = W.buildings.find(x => x.team === u.team && !x.dead && !x.built && dist(x.x, x.y, u.x, u.y) < 12 * TILE);
    return next ? orderBuild(u, next) : setIdle(u);
  }
  if (edgeDist(u, b) <= 24) {
    u.anchored = true; u.working = true; u.path = null;
    if (Math.abs(b.x - u.x) > 1) u.face = b.x > u.x ? 1 : -1;
    if (!b.built) {
      const t = BUILDINGS[b.type].time;
      b.progress += dt / t;
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.9 * dt / t);
      if (b.progress >= 1) completeBuilding(b);
    } else {
      b.hp = Math.min(b.maxHp, b.hp + 25 * dt);
    }
  } else {
    approach(u, d, dt, rectGoal(b), o);
    if (o.fail > 4) setIdle(u);
  }
}

function doTrade(u, d, dt) {
  const o = u.order;
  if (!o.home || o.home.dead) {
    o.home = W.buildings.find(b => b.team === u.team && b.type === 'caravanserai' && b.built && !b.dead);
    u.path = null;
    if (!o.home) return setIdle(u);
  }
  const target = o.leg === 'out' ? W.bazaar : o.home;
  if (edgeDist(u, target) <= 24) {
    u.path = null; o.rp = 0;
    if (o.leg === 'out') {
      u.carry = Math.round(dist(o.home.x, o.home.y, W.bazaar.x, W.bazaar.y) / TILE * TRADE_GOLD_PER_TILE);
      u.carryType = 'gold';
      o.leg = 'back';
    } else {
      W.teams[u.team].gold += u.carry;
      if (u.team === PLAYER) W.effects.push({ type: 'text', x: u.x, y: u.y - 14, text: '+' + u.carry + ' gold', life: 2 });
      u.carry = 0;
      o.leg = 'out';
    }
    return;
  }
  approach(u, d, dt, rectGoal(target), o);
}

// ---------- Per-frame updates ----------

function updateUnit(u, dt) {
  const d = UNITS[u.type], o = u.order;
  u.cd -= dt; u.anim += dt;
  if (u.swing > 0) u.swing -= dt;
  u.anchored = false; u.moving = false; u.working = false;
  switch (o.t) {
    case 'idle':
      if (isMilitary(u)) {
        const t = acquire(u, d, dt);
        if (t) orderAttack(u, t, null, true);
      }
      break;
    case 'move':
      if (followPath(u, d, dt)) setIdle(u);
      break;
    case 'amove': {
      const t = acquire(u, d, dt);
      if (t) orderAttack(u, t, { x: o.x, y: o.y }, true);
      else if (followPath(u, d, dt)) setIdle(u);
      break;
    }
    case 'attack': doAttack(u, d, dt); break;
    case 'gather': doGather(u, d, dt); break;
    case 'return': doReturn(u, d, dt); break;
    case 'build': doBuild(u, d, dt); break;
    case 'trade': doTrade(u, d, dt); break;
  }
}

function freeTileAround(b, toward) {
  const tx = toward ? toward.x / TILE : MAP_W / 2, ty = toward ? toward.y / TILE : MAP_H / 2;
  for (let r = 1; r <= 4; r++) {
    let best = null, bd = 1e9;
    const x0 = b.tx - r, y0 = b.ty - r, x1 = b.tx + b.size - 1 + r, y1 = b.ty + b.size - 1 + r;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if ((x !== x0 && x !== x1 && y !== y0 && y !== y1) || !inMap(x, y) || W.blocked[tidx(x, y)]) continue;
        const dd = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
        if (dd < bd) { bd = dd; best = { x, y }; }
      }
    }
    if (best) return best;
  }
  return nearestFree(b.tx, b.ty) || { x: b.tx, y: b.ty };
}

function spawnUnit(b, type) {
  const spot = freeTileAround(b, b.rally);
  const u = makeUnit(type, b.team, (spot.x + 0.5) * TILE, (spot.y + 0.5) * TILE);
  W.teams[b.team].stats.trained++;
  if (type === 'caravan') return orderTrade(u, b);
  const r = b.rally;
  if (!r) return;
  if (type === 'villager' && r.target && !r.target.dead) {
    if (r.target.kind === 'node' || r.target.type === 'farm') return orderGather(u, r.target);
    if (!r.target.built) return orderBuild(u, r.target);
  }
  orderMove(u, r.x, r.y);
}

function nearestEnemyUnit(b, range) {
  let best = null, bd = range;
  for (const e of W.units) {
    if (e.team === b.team || e.dead) continue;
    const dd = dist(b.x, b.y, e.x, e.y) - b.size * TILE / 2;
    if (dd < bd) { bd = dd; best = e; }
  }
  return best;
}

function updateBuilding(b, dt) {
  if (!b.built || b.dead) return;
  const d = BUILDINGS[b.type];
  if (b.queue.length) {
    b.qt += dt;
    if (b.qt >= UNITS[b.queue[0]].time) {
      const type = b.queue.shift();
      b.qt = 0;
      W.teams[b.team].queued -= UNITS[type].pop;
      spawnUnit(b, type);
    }
  }
  if (d.atk) {
    b.cd -= dt;
    if (b.cd <= 0) {
      const t = nearestEnemyUnit(b, d.range);
      if (t) { b.cd = d.cd; strike(b, d, t); } else b.cd = 0.3;
    }
  }
}

function trainUnit(b, type) {
  const d = UNITS[type], tm = W.teams[b.team];
  if (!b.built || b.dead || b.queue.length >= QUEUE_MAX) return 'queue';
  if (!canAfford(b.team, d.cost)) return 'cost';
  if (tm.pop + tm.queued + d.pop > tm.cap) return 'pop';
  pay(b.team, d.cost);
  tm.queued += d.pop;
  b.queue.push(type);
  return null;
}

function updateProjectiles(dt) {
  const list = W.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i], t = p.target;
    if (t.dead) { list.splice(i, 1); continue; }
    const ty = t.kind === 'unit' ? t.y - 6 : t.y;
    const dx = t.x - p.x, dy = ty - p.y, dd = Math.hypot(dx, dy), step = 340 * dt;
    const hitR = t.kind === 'unit' ? 6 : t.size * TILE * 0.3;
    if (dd <= step + hitR) { applyDamage(t, p.dmg, p.src); list.splice(i, 1); continue; }
    p.x += dx / dd * step; p.y += dy / dd * step; p.ang = Math.atan2(dy, dx);
  }
}

// Soft collisions: units that are walking or standing idle push each other apart.
function separate(dt) {
  const us = W.units, n = us.length, R = 13;
  for (let i = 0; i < n; i++) {
    const a = us[i];
    for (let j = i + 1; j < n; j++) {
      const b = us[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      if (dx > R || dx < -R || dy > R || dy < -R || (a.anchored && b.anchored)) continue;
      let dd = Math.hypot(dx, dy);
      if (dd >= R) continue;
      if (dd < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dd = Math.hypot(dx, dy); }
      // Kept well below walking speed so units heading opposite ways slide past instead of deadlocking.
      const push = (R - dd) * 2.5 * dt;
      dx = dx / dd * push; dy = dy / dd * push;
      if (!a.anchored) { const k = a.moving ? 0.5 : 1; nudge(a, -dx * k, -dy * k); }
      if (!b.anchored) { const k = b.moving ? 0.5 : 1; nudge(b, dx * k, dy * k); }
    }
  }
}

function nudge(u, dx, dy) {
  const nx = clamp(u.x + dx, 4, WORLD_W - 4), ny = clamp(u.y + dy, 4, WORLD_H - 4);
  if (W.blocked[tidx(tileOf(nx), tileOf(ny))] && !W.blocked[tidx(tileOf(u.x), tileOf(u.y))]) return;
  u.x = nx; u.y = ny;
}

function updateFog() {
  const vis = W.visible, exp = W.explored;
  vis.fill(0);
  const stamp = (cx, cy, r) => {
    const r2 = r * r + r;
    for (let y = Math.max(0, cy - r); y <= Math.min(MAP_H - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(MAP_W - 1, cx + r); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) { const i = tidx(x, y); vis[i] = 1; exp[i] = 1; }
      }
    }
  };
  for (const u of W.units) if (u.team === PLAYER && !u.dead) stamp(tileOf(u.x), tileOf(u.y), UNITS[u.type].sight);
  for (const b of W.buildings) {
    if (b.team === PLAYER && !b.dead) stamp(tileOf(b.x), tileOf(b.y), b.built ? BUILDINGS[b.type].sight : 2);
  }
  for (const b of W.buildings) {
    if (b.seen) continue;
    for (let y = b.ty; y < b.ty + b.size && !b.seen; y++) {
      for (let x = b.tx; x < b.tx + b.size; x++) if (vis[tidx(x, y)]) { b.seen = true; break; }
    }
  }
  W.fogDirty = true;
}

function updateWorld(dt) {
  W.time += dt;
  for (const u of W.units) if (!u.dead) updateUnit(u, dt);
  for (const b of W.buildings) updateBuilding(b, dt);
  updateProjectiles(dt);
  separate(dt);
  for (let i = W.effects.length - 1; i >= 0; i--) {
    const e = W.effects[i];
    e.life -= dt;
    if (e.type === 'text') e.y -= 14 * dt;
    if (e.life <= 0) W.effects.splice(i, 1);
  }
  if (W.needClean) {
    W.units = W.units.filter(u => !u.dead);
    W.buildings = W.buildings.filter(b => !b.dead);
    W.nodes = W.nodes.filter(n => !n.dead);
    W.needClean = false;
  }
  W.fogT -= dt;
  if (W.fogT <= 0) { W.fogT = 0.25; updateFog(); }
  aiUpdate(dt);
}
