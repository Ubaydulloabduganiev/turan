'use strict';

// The rival khan. Plays by the same rules as the player (same costs, gathering and population),
// but sees the whole map. Thinks once a second.

const AI_WEIGHTS = { food: 0.36, wood: 0.34, gold: 0.18, stone: 0.12 };

function aiGatherRes(u) {
  const o = u.order;
  if (o.t === 'gather') return o.node.kind === 'building' ? 'food' : o.node.res;
  if (o.t === 'return') return u.carryType;
  return null;
}

function aiAssign(v, cit, vills) {
  const counts = { food: 0, wood: 0, gold: 0, stone: 0 };
  let total = 0;
  for (const o of vills) {
    const r = aiGatherRes(o);
    if (r) { counts[r]++; total++; }
  }
  const tm = W.teams[ENEMY];
  const order = RES.slice().sort((a, b) =>
    (AI_WEIGHTS[b] - counts[b] / (total + 1) - (tm[b] > 900 ? 1 : 0)) - (AI_WEIGHTS[a] - counts[a] / (total + 1) - (tm[a] > 900 ? 1 : 0)));
  for (const res of order) {
    if (res === 'food') {
      const farm = findFreeFarm(v);
      if (farm) { farm.worker = v; return orderGather(v, farm); }
      const bush = nearestNode('food', cit.x, cit.y, 16);
      if (bush) return orderGather(v, bush);
      continue;
    }
    const n = nearestNode(res, cit.x, cit.y, 40);
    if (n) return orderGather(v, n);
  }
}

function aiBuildSpot(type, cit) {
  const s = BUILDINGS[type].size;
  const from = type === 'tower' ? 6 : 3;
  for (let r = from; r <= 18; r++) {
    for (let t = 0; t < 14; t++) {
      const a = Math.random() * Math.PI * 2;
      const tx = Math.round(cit.tx + 1 + Math.cos(a) * r - s / 2), ty = Math.round(cit.ty + 1 + Math.sin(a) * r - s / 2);
      let ok = true;
      for (let y = ty - 1; y <= ty + s && ok; y++) {
        for (let x = tx - 1; x <= tx + s; x++) {
          if (!inMap(x, y) || W.blocked[tidx(x, y)]) { ok = false; break; }
        }
      }
      if (ok) return { x: tx, y: ty };
    }
  }
  return null;
}

function aiPickBuilder(vills, b) {
  let best = null, bd = 1e9;
  for (const v of vills) {
    if (v.order.t === 'build') continue;
    const d = dist(v.x, v.y, b.x, b.y) + (v.carry > 0 ? 200 : 0);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

function aiUpdate(dt) {
  const ai = W.ai;
  ai.t += dt;
  if (ai.t < 1) return;
  ai.t = 0;
  const cfg = W.diff, tm = W.teams[ENEMY];
  const mine = W.buildings.filter(b => b.team === ENEMY && !b.dead);
  const cit = mine.find(b => b.type === 'citadel' && b.built);
  if (!cit) return;
  const units = W.units.filter(u => u.team === ENEMY && !u.dead);
  const vills = units.filter(u => u.type === 'villager');
  const army = units.filter(isMilitary);
  const count = t => mine.reduce((n, b) => n + (b.type === t ? 1 : 0), 0);

  // Workers
  if (vills.length < cfg.vill && cit.queue.length < 2) trainUnit(cit, 'villager');
  for (const b of mine) {
    if (!b.built && !vills.some(v => v.order.t === 'build' && v.order.b === b)) {
      const v = aiPickBuilder(vills, b);
      if (v) orderBuild(v, b);
    }
  }
  for (const v of vills) if (v.order.t === 'idle') aiAssign(v, cit, vills);

  // Construction, one building at a time
  let want = null;
  if (!mine.some(b => !b.built)) {
    const farms = count('farm');
    const needFarms = nearestNode('food', cit.x, cit.y, 16) ? 0 : Math.min(7, Math.ceil(vills.length * 0.36));
    if (tm.cap - tm.pop - tm.queued <= 2 && tm.cap < POP_MAX) want = 'yurt';
    else if (vills.length >= 5 && count('barracks') < 1) want = 'barracks';
    else if (farms < needFarms) want = 'farm';
    else if (vills.length >= 9 && count('stable') < 1) want = 'stable';
    else if (W.time > 240 && count('tower') < 2) want = 'tower';
    else if (W.time > 300 && count('caravanserai') < 1) want = 'caravanserai';
    else if (W.time > 480 && count('barracks') < 2) want = 'barracks';
    else if (W.time > 600 && count('tower') < 4) want = 'tower';
    if (want && canAfford(ENEMY, BUILDINGS[want].cost)) {
      const spot = aiBuildSpot(want, cit);
      if (spot) {
        pay(ENEMY, BUILDINGS[want].cost);
        const b = makeBuilding(want, ENEMY, spot.x, spot.y, false);
        const dx = WORLD_W / 2 - cit.x, dy = WORLD_H / 2 - cit.y, dl = Math.hypot(dx, dy);
        b.rally = { x: cit.x + dx / dl * 6 * TILE, y: cit.y + dy / dl * 6 * TILE };
        const v = aiPickBuilder(vills, b);
        if (v) orderBuild(v, b);
        want = null;
      }
    }
  }

  // Training. Do not spend a resource we are still saving up for the next building.
  const saving = want ? RES.filter(r => tm[r] < (BUILDINGS[want].cost[r] || 0)) : [];
  const train = (b, type) => { if (!saving.some(r => UNITS[type].cost[r])) trainUnit(b, type); };
  for (const b of mine) {
    if (!b.built || b.queue.length >= 2) continue;
    if (b.type === 'caravanserai') {
      if (units.filter(u => u.type === 'caravan').length + b.queue.length < 3) train(b, 'caravan');
    } else if ((b.type === 'barracks' || b.type === 'stable') && army.length < Math.min(cfg.maxArmy, 3 + W.time / 60 * cfg.armyRate)) {
      const list = BUILDINGS[b.type].trains;
      train(b, list[(Math.random() * list.length) | 0]);
    }
  }

  // Defence: idle troops at home rush to whatever was hit last.
  ai.attackers = ai.attackers.filter(u => !u.dead);
  const hurt = mine.find(b => W.time - b.lastHit < 4) || vills.find(v => W.time - v.lastHit < 4);
  if (hurt) {
    for (const u of army) if (u.order.t === 'idle' && !ai.attackers.includes(u)) orderAMove(u, hurt.x, hurt.y);
  }

  // Attack waves that grow over time.
  if (W.time >= ai.nextAttack) {
    const size = Math.min(cfg.maxArmy, cfg.waveBase + ai.wave * cfg.waveGrow);
    const home = army.filter(u => !ai.attackers.includes(u));
    if (home.length >= size) {
      ai.attackers.push(...home.slice(0, size));
      ai.wave++;
      ai.nextAttack = W.time + cfg.attackGap;
      toast('Scouts report an enemy war party on the march!', 'warn');
    }
  }
  if (ai.attackers.length) {
    let cx = 0, cy = 0;
    for (const u of ai.attackers) { cx += u.x; cy += u.y; }
    cx /= ai.attackers.length; cy /= ai.attackers.length;
    let target = null, bd = 1e9;
    for (const b of W.buildings) {
      if (b.team !== PLAYER || b.dead) continue;
      const d = dist(cx, cy, b.x, b.y);
      if (d < bd) { bd = d; target = b; }
    }
    if (target) for (const u of ai.attackers) if (u.order.t === 'idle') orderAMove(u, target.x, target.y);
  }
}
