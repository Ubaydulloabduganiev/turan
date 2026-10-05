'use strict';
// The battlefield: each campaign unit becomes a regiment of little soldiers that the player commands in real time.

const BF = { W: 1200, H: 800 };
const SPEED = { spear: 30, inf: 30, missile: 32, cav: 72, ha: 66, siege: 20 };
const RANGE = { missile: 230, ha: 185 };
let TB = null; // the running battle

const bc = $('bcanvas');
const bx = bc.getContext('2d');

function startTactical(b) {
  return new Promise(resolve => {
    const pl = G.player;
    const playerSide = b.att.faction === pl ? 'att' : 'def';
    const p = G.provinces[b.prov];
    TB = {
      b, resolve, playerSide, regs: [], arrows: [], fx: [], t: 0, paused: false, speed: 1, sel: new Set(), drag: null, over: null,
      terrain: p.terrain, walls: b.kind === 'assault' ? p.b.walls : 0, seed: 1, start: { att: 0, def: 0 },
    };
    // Player always deploys at the bottom
    deploy('att', playerSide === 'att' ? 'bottom' : 'top');
    deploy('def', playerSide === 'def' ? 'bottom' : 'top');
    for (const r of TB.regs) TB.start[r.side] += r.men;
    TB.wallY = TB.walls ? (playerSide === 'def' ? BF.H * 0.62 : BF.H * 0.38) : null;
    TB.breach = TB.walls && sideUnits(b.att).some(x => UNITS[x.u.type].cls === 'siege');
    $('battle').classList.remove('hidden');
    $('busy').classList.add('hidden');
    TB.dead = []; TB.dust = [];
    TB.ground = paintBattleGround(!!window.THREE);
    TB.r3 = null;
    try { TB.r3 = make3D(); } catch (err) { console.error(err); TB.r3 = null; if ($('b3d')) $('b3d').remove(); }
    if (!TB.r3 && window.THREE) TB.ground = paintBattleGround(false);
    $('b-help').textContent = TB.r3
      ? 'Drag to select · Right-click to move or attack (Shift to run) · W A S D move the camera · Q E turn · Wheel zoom · Space pause'
      : 'Drag to select · Right-click to move or attack · Shift + right-click to run · Space to pause';
    $('b-cam').classList.toggle('hidden', !TB.r3);
    resizeBattle();
    renderBattleTop();
    renderBattleCards();
    TB.last = performance.now();
    requestAnimationFrame(battleFrame);
  });
}
HOOKS.fight = startTactical;

function deploy(sideKey, edge) {
  const side = TB.b[sideKey];
  const list = sideUnits(side);
  const faction = side.faction;
  const rows = { front: [], back: [], wing: [], rear: [] };
  for (const x of list) {
    const c = UNITS[x.u.type].cls;
    if (x.u.type === 'general') rows.rear.push(x);
    else if (c === 'missile') rows.front.push(x);
    else if (c === 'cav' || c === 'ha') rows.wing.push(x);
    else if (c === 'siege') rows.rear.push(x);
    else rows.back.push(x);
  }
  const dir = edge === 'bottom' ? -1 : 1;
  const baseY = edge === 'bottom' ? BF.H - 130 : 130;
  const place = (arr, y, x0, x1) => {
    arr.forEach((x, i) => {
      const px = arr.length === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (arr.length - 1);
      addReg(x.u, faction, sideKey, px, y);
    });
  };
  const spread = n => Math.min(640, n * 82);
  const inf = rows.back, mis = rows.front;
  place(mis, baseY + dir * 70, BF.W / 2 - spread(mis.length) / 2, BF.W / 2 + spread(mis.length) / 2);
  place(inf, baseY, BF.W / 2 - spread(inf.length) / 2, BF.W / 2 + spread(inf.length) / 2);
  const left = rows.wing.filter((x, i) => i % 2 === 0), right = rows.wing.filter((x, i) => i % 2 === 1);
  const wx = Math.max(spread(inf.length), spread(mis.length)) / 2 + 100;
  left.forEach((x, i) => addReg(x.u, faction, sideKey, Math.max(40, BF.W / 2 - wx - i * 78), baseY + dir * 20 - (BF.W / 2 - wx - i * 78 < 40 ? dir * 80 : 0)));
  right.forEach((x, i) => addReg(x.u, faction, sideKey, Math.min(BF.W - 40, BF.W / 2 + wx + i * 78), baseY + dir * 20 - (BF.W / 2 + wx + i * 78 > BF.W - 40 ? dir * 80 : 0)));
  place(rows.rear, baseY - dir * 80, BF.W / 2 - 70 * rows.rear.length / 2, BF.W / 2 + 70 * rows.rear.length / 2);
}

function addReg(u, faction, side, x, y) {
  const d = UNITS[u.type];
  TB.regs.push({
    u, d, faction, side, x, y, tx: x, ty: y, face: side === TB.playerSide ? -Math.PI / 2 : Math.PI / 2,
    men: u.men, max: u.men, morale: d.morale * 10 + u.exp * 5, target: null, run: false,
    cd: Math.random(), charge: 0, rout: false, gone: false, id: TB.regs.length, player: side === TB.playerSide, order: null,
    r: d.cls === 'cav' || d.cls === 'ha' ? 32 : 30,
  });
}

// ---------- Simulation ----------

function enemiesOf(r) { return TB.regs.filter(o => o.side !== r.side && !o.gone && !o.rout && o.men > 0); }
function nearest(r, list) {
  let best = null, bd = 1e9;
  for (const o of list) { const d = Math.hypot(o.x - r.x, o.y - r.y); if (d < bd) { bd = d; best = o; } }
  return best;
}

function inWall(y) { return TB.wallY !== null && Math.abs(y - TB.wallY) < 22; }
function behindWall(r) {
  if (TB.wallY === null) return false;
  const defBottom = TB.playerSide === 'def';
  return r.side === 'def' && (defBottom ? r.y > TB.wallY : r.y < TB.wallY);
}

function speedOf(r) {
  let s = SPEED[r.d.cls] * (r.run ? 1.45 : 1);
  if (TB.terrain === 'mountain' && (r.d.cls === 'cav' || r.d.cls === 'ha')) s *= 0.75;
  if (inWall(r.y) && !TB.breach) s *= 0.3;
  if (r.rout) s *= 1.2;
  return s;
}

function aiControl(r) {
  // Simple battlefield sense for the computer's regiments (and idle player regiments defending themselves)
  const foes = enemiesOf(r);
  if (!foes.length) return;
  const n = nearest(r, foes), dn = Math.hypot(n.x - r.x, n.y - r.y);
  if (r.d.cls === 'missile' || r.d.cls === 'ha') {
    if (r.d.cls === 'ha') {
      const melee = foes.filter(o => o.d.cls !== 'missile' && o.d.cls !== 'ha');
      const threat = nearest(r, melee);
      if (threat && Math.hypot(threat.x - r.x, threat.y - r.y) < 110) {
        const a = Math.atan2(r.y - threat.y, r.x - threat.x);
        r.tx = clampN(r.x + Math.cos(a) * 120, 20, BF.W - 20); r.ty = clampN(r.y + Math.sin(a) * 120, 20, BF.H - 20); r.target = null;
        return;
      }
    }
    r.target = n;
    if (dn > RANGE[r.d.cls] * 0.9) { r.tx = n.x; r.ty = n.y; } else { r.tx = r.x; r.ty = r.y; }
    return;
  }
  // Defenders behind walls wait for the enemy to come close
  if (behindWall(r) && dn > 160) { r.tx = r.x; r.ty = r.y; return; }
  // Cavalry prefers archers and the flanks
  let t = n;
  if (r.d.cls === 'cav') {
    const soft = foes.filter(o => o.d.cls === 'missile' || o.d.cls === 'siege');
    const s = nearest(r, soft);
    if (s && Math.hypot(s.x - r.x, s.y - r.y) < dn + 250) t = s;
  }
  r.target = t;
}

function stepBattle(dt) {
  TB.t += dt;
  const regs = TB.regs;
  for (const r of regs) {
    if (r.gone) continue;
    r.cd -= dt;
    if (r.rout) {
      const home = r.side === TB.playerSide ? BF.H + 60 : -60;
      r.ty = home; r.tx = r.x;
      moveReg(r, dt);
      if (r.y > BF.H + 40 || r.y < -40) r.gone = true;
      continue;
    }
    if (!r.player || !r.order) {
      if (!r.player) { if (TB.t > (r.side === 'def' && TB.walls ? 0 : 1.5) || r.d.cls === 'missile') aiControl(r); }
      else autoDefend(r);
    }
    const t = r.target && !r.target.gone && !r.target.rout && r.target.men > 0 ? r.target : null;
    if (!t) r.target = null;
    // Ranged attack
    if (t && RANGE[r.d.cls] && !inMelee(r)) {
      const d = Math.hypot(t.x - r.x, t.y - r.y);
      if (d <= RANGE[r.d.cls] + (behindWall(r) ? 40 : 0)) {
        if (!r.order || r.order === 'attack') { r.tx = r.x; r.ty = r.y; }
        r.face = Math.atan2(t.y - r.y, t.x - r.x);
        if (r.cd <= 0) shoot(r, t);
      } else if (r.order !== 'move') { r.tx = t.x; r.ty = t.y; }
    } else if (t && r.order !== 'move') { r.tx = t.x; r.ty = t.y; }
    moveReg(r, dt);
  }
  // Melee
  for (let i = 0; i < regs.length; i++) {
    const a = regs[i];
    if (a.gone || a.men <= 0) continue;
    for (let j = i + 1; j < regs.length; j++) {
      const c = regs[j];
      if (c.gone || c.men <= 0 || c.side === a.side) continue;
      const d = Math.hypot(a.x - c.x, a.y - c.y);
      if (d < a.r + c.r) {
        meleeHit(a, c, dt); meleeHit(c, a, dt);
        // push apart a little so blocks stay readable
        const push = (a.r + c.r - d) * 0.5, ang = Math.atan2(c.y - a.y, c.x - a.x);
        if (push > 6) { a.x -= Math.cos(ang) * (push - 6) * 0.5; a.y -= Math.sin(ang) * (push - 6) * 0.5; c.x += Math.cos(ang) * (push - 6) * 0.5; c.y += Math.sin(ang) * (push - 6) * 0.5; }
      }
    }
  }
  // Friendly regiments do not stack on each other
  for (let i = 0; i < regs.length; i++) for (let j = i + 1; j < regs.length; j++) {
    const a = regs[i], c = regs[j];
    if (a.gone || c.gone || a.side !== c.side) continue;
    const d = Math.hypot(a.x - c.x, a.y - c.y), m = (a.r + c.r) * 0.85;
    if (d < m && d > 0.01) { const k = (m - d) / d * 0.25; a.x -= (c.x - a.x) * k; a.y -= (c.y - a.y) * k; c.x += (c.x - a.x) * k; c.y += (c.y - a.y) * k; }
  }
  // The fallen and the dust
  for (const r of regs) {
    if (r.lastMen === undefined) r.lastMen = r.men;
    let lost = Math.floor((r.lastMen - r.men) / 3);
    if (lost > 0) {
      r.lastMen = r.men;
      const col = FACTIONS[r.faction].dark;
      while (lost-- > 0 && TB.dead.length < 900) TB.dead.push({ x: r.x + (Math.random() - 0.5) * r.r * 1.6, y: r.y + (Math.random() - 0.5) * r.r * 1.2, a: Math.random() * 3, c: col });
    }
    if (r.moving && (r.d.cls === 'cav' || r.d.cls === 'ha' || r.run) && Math.random() < dt * 14 && TB.dust.length < 160)
      TB.dust.push({ x: r.x - Math.cos(r.face) * r.r + (Math.random() - 0.5) * 30, y: r.y - Math.sin(r.face) * r.r + (Math.random() - 0.5) * 20, life: 1 });
  }
  for (const d of TB.dust) { d.life -= dt * 0.8; d.y -= dt * 6; }
  TB.dust = TB.dust.filter(d => d.life > 0);
  // Morale
  for (const r of regs) {
    if (r.gone || r.rout) continue;
    if (r.men <= 0) { r.gone = true; continue; }
    const loss = 1 - r.men / r.max;
    const friends = regs.filter(o => o.side === r.side && !o.gone && !o.rout).length;
    const general = regs.some(o => o.side === r.side && o.u.type === 'general' && !o.gone && !o.rout && Math.hypot(o.x - r.x, o.y - r.y) < 300);
    const m = r.morale - loss * 80 - (friends < 3 ? 15 : 0) + (general ? 12 : 0) - (r.flanked > 0 ? 25 : 0);
    if (r.flanked > 0) r.flanked -= dt;
    if (m < 8) { r.rout = true; r.target = null; r.order = null; TB.fx.push({ x: r.x, y: r.y - 30, text: 'Routing!', life: 1.5, color: '#ffb0a0' }); }
  }
  for (const a of TB.arrows) a.life -= dt;
  TB.arrows = TB.arrows.filter(a => a.life > 0);
  for (const f of TB.fx) { f.life -= dt; f.y -= 12 * dt; }
  TB.fx = TB.fx.filter(f => f.life > 0);
  checkBattleEnd();
}

function autoDefend(r) {
  // An idle player regiment fights back against enemies that come close
  const foes = enemiesOf(r);
  const n = nearest(r, foes);
  if (!n) return;
  const d = Math.hypot(n.x - r.x, n.y - r.y);
  if (RANGE[r.d.cls] && d < RANGE[r.d.cls]) r.target = n;
  else if (d < r.r + n.r + 25) r.target = n;
}

function inMelee(r) { return TB.regs.some(o => o.side !== r.side && !o.gone && o.men > 0 && Math.hypot(o.x - r.x, o.y - r.y) < r.r + o.r + 4); }

function moveReg(r, dt) {
  const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy);
  r.moving = d > 3 && !inMelee(r);
  if (!r.moving) { r.charge = Math.max(0, r.charge - dt); if (r.order === 'move' && d <= 3) r.order = null; return; }
  const step = speedOf(r) * dt;
  r.face = Math.atan2(dy, dx);
  if (d <= step) { r.x = r.tx; r.y = r.ty; } else { r.x += dx / d * step; r.y += dy / d * step; }
  r.x = clampN(r.x, 10, BF.W - 10);
  if (!r.rout) r.y = clampN(r.y, 10, BF.H - 10);
  if (r.d.cls === 'cav' && d > 60) r.charge = 2.2; // momentum for a charge
}

function meleeHit(a, c, dt) {
  if (a.rout) return;
  const d = a.d, e = c.d;
  let atk = d.atk;
  if (d.cls === 'spear' && (e.cls === 'cav' || e.cls === 'ha')) atk *= 1.8;
  if ((d.cls === 'cav') && a.charge > 0) { atk *= 2.2; a.charge -= dt * 1.5; }
  if (d.cls === 'missile' || d.cls === 'ha') atk *= 0.7;
  let def = e.def + (behindWall(c) ? 4 : 0) + (inWall(c.y) && !TB.breach && c.side === 'def' ? 3 : 0);
  if (e.cls === 'cav' && d.cls === 'spear') def *= 0.8;
  // Attacks from behind hurt more and shake morale
  const ang = Math.atan2(a.y - c.y, a.x - c.x);
  let rel = Math.abs(((ang - c.face) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  if (rel > 2.2) { atk *= 1.5; c.flanked = 1.5; }
  const kills = a.men / 100 * atk / (def + 4) * 2.1 * dt * (1 + a.u.exp * 0.08) * (c.rout ? 2 : 1);
  c.men = Math.max(0, c.men - kills);
  a.face = Math.atan2(c.y - a.y, c.x - a.x);
}

function shoot(r, t) {
  r.cd = r.d.cls === 'ha' ? 2.0 : 2.4;
  let dmg = r.men / 100 * r.d.missile / (t.d.def + 6) * 5.5 * (1 + r.u.exp * 0.08);
  if (behindWall(t) && !TB.breach) dmg *= 0.5;
  if (t.d.cls === 'cav' || t.d.cls === 'ha') dmg *= 0.85;
  t.men = Math.max(0, t.men - dmg);
  for (let i = 0; i < 5; i++) {
    TB.arrows.push({ x0: r.x + (Math.random() - 0.5) * 30, y0: r.y + (Math.random() - 0.5) * 20, x1: t.x + (Math.random() - 0.5) * 40, y1: t.y + (Math.random() - 0.5) * 30, life: 0.6, max: 0.6 });
  }
}

function sideMen(side) { return TB.regs.filter(r => r.side === side && !r.gone && !r.rout).reduce((n, r) => n + r.men, 0); }

function checkBattleEnd() {
  if (TB.over) return;
  const a = sideMen('att'), d = sideMen('def');
  if (a <= 0 || d <= 0) endTactical(a > 0 ? 'att' : 'def');
  else if (TB.t > 420) endTactical(a / TB.start.att >= d / TB.start.def ? 'att' : 'def');
}

function endTactical(winner, quiet) {
  TB.over = winner;
  // Write the survivors back to the campaign. Routed men who escaped come home; the beaten side loses more stragglers.
  for (const r of TB.regs) {
    let men = r.men;
    if (r.side !== winner) men *= r.rout && !r.gone ? 0.75 : r.gone && r.men > 0 ? 0.7 : 1;
    r.u.men = Math.max(0, Math.round(men));
  }
  const loserSide = winner === 'att' ? 'def' : 'att';
  const left = TB.regs.filter(r => r.side === loserSide).reduce((n, r) => n + r.u.men, 0);
  const res = { winner, rout: left < TB.start[loserSide] * 0.3 };
  const pw = (winner === TB.playerSide);
  const done = () => {
    if (TB.r3) { dispose3D(TB.r3); TB.r3 = null; }
    $('battle').classList.add('hidden');
    if (turnBusy) $('busy').classList.remove('hidden');
    const resolve = TB.resolve;
    TB = null;
    resolve(res);
  };
  if (quiet) return done();
  TB.fx.push({ x: BF.W / 2, y: BF.H / 2, text: pw ? 'VICTORY' : 'DEFEAT', life: 99, color: pw ? '#ffe08a' : '#ff9a8a', big: true });
  setTimeout(done, 1600);
}

// ---------- Drawing ----------

function resizeBattle() {
  bc.width = window.innerWidth * devicePixelRatio;
  bc.height = window.innerHeight * devicePixelRatio;
  const top = 44, bottom = 96;
  const s = Math.min(window.innerWidth / BF.W, (window.innerHeight - top - bottom) / BF.H);
  TB.view = { s, ox: (window.innerWidth - BF.W * s) / 2, oy: top + (window.innerHeight - top - bottom - BF.H * s) / 2 };
}
window.addEventListener('resize', () => { if (TB) { resizeBattle(); if (TB.r3) resize3D(TB.r3); } });
const toField = (sx, sy) => TB.r3 ? screenToField3D(TB.r3, sx, sy) : bToWorld(sx, sy);
const toScreen = (x, y, up) => TB.r3 ? fieldToScreen3D(TB.r3, x, y, up) : { x: TB.view.ox + x * TB.view.s, y: TB.view.oy + y * TB.view.s };

// The regiment under a point on the screen, if any
function pickReg(sx, sy, pred) {
  let best = null, bd = 1e9;
  for (const r of TB.regs) {
    if (r.gone || !pred(r)) continue;
    const c = toScreen(r.x, r.y, 4), e = toScreen(r.x + r.r, r.y, 4);
    if (c.behind) continue;
    const rad = Math.max(14, Math.hypot(e.x - c.x, e.y - c.y) + 6), d = Math.hypot(c.x - sx, c.y - sy);
    if (d < rad && d < bd) { bd = d; best = r; }
  }
  return best;
}

// Labels, health bars and the selection box drawn over the 3D view
function drawOverlay3D() {
  const c = bx;
  c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  c.clearRect(0, 0, innerWidth, innerHeight);
  for (const r of TB.regs) {
    if (r.gone) continue;
    const p = toScreen(r.x, r.y, r.d.cls === 'cav' || r.d.cls === 'ha' ? 38 : 32);
    if (p.behind) continue;
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(p.x - 17, p.y, 34, 5);
    c.fillStyle = r.rout ? '#d0503a' : r.player ? '#8fe07a' : '#ff8a70';
    c.fillRect(p.x - 16, p.y + 1, 32 * Math.max(0, r.men) / r.max, 3);
  }
  if (TB.drag && TB.drag.moved) {
    c.strokeStyle = '#ffe08a'; c.lineWidth = 1.5; c.fillStyle = 'rgba(255,224,138,0.08)';
    const x = Math.min(TB.drag.x0, TB.drag.x1), y = Math.min(TB.drag.y0, TB.drag.y1), w = Math.abs(TB.drag.x1 - TB.drag.x0), h = Math.abs(TB.drag.y1 - TB.drag.y0);
    c.fillRect(x, y, w, h); c.strokeRect(x, y, w, h);
  }
  for (const f of TB.fx) {
    const p = f.big ? { x: innerWidth / 2, y: innerHeight / 2 } : toScreen(f.x, f.y, 20);
    c.font = (f.big ? 92 : 20) + 'px Cinzel, Georgia, serif';
    c.textAlign = 'center'; c.lineWidth = f.big ? 7 : 4; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.fillStyle = f.color;
    c.strokeText(f.text, p.x, p.y); c.fillText(f.text, p.x, p.y);
  }
  if (TB.paused && !TB.over) {
    c.font = '28px Cinzel, Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#ffe08a'; c.strokeStyle = '#000'; c.lineWidth = 4;
    c.strokeText('Paused — press Space', innerWidth / 2, 100); c.fillText('Paused — press Space', innerWidth / 2, 100);
  }
}
const bToWorld = (x, y) => ({ x: (x - TB.view.ox) / TB.view.s, y: (y - TB.view.oy) / TB.view.s });

const GROUND = { steppe: ['#8b9a52', '#7a8a46'], oasis: ['#7f9a4e', '#6e8a40'], river: ['#6f9450', '#5f8444'], desert: ['#c9ad74', '#b99c63'], mountain: ['#8a8564', '#77725a'] };

// The battlefield floor, painted once: ground colour, texture, scrub, rocks or dunes, light and walls
function paintBattleGround(for3d) {
  const c = document.createElement('canvas');
  c.width = BF.W; c.height = BF.H;
  const x = c.getContext('2d'), rnd = mulberry32(TB.b.prov.length * 977 + G.turn);
  const g = GROUND[TB.terrain] || GROUND.steppe;
  x.fillStyle = g[0]; x.fillRect(0, 0, BF.W, BF.H);
  const n = noiseCanvas(128, 3 + G.turn, [4, 8, 16, 32]);
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.55; x.drawImage(n, 0, 0, BF.W, BF.H);
  x.globalAlpha = 0.25; x.fillStyle = x.createPattern(noiseCanvas(64, 9, [16, 32]), 'repeat'); x.fillRect(0, 0, BF.W, BF.H);
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  if (TB.terrain === 'desert') {
    for (let i = 0; i < 160; i++) {
      const px = rnd() * BF.W, py = rnd() * BF.H, w = 20 + rnd() * 40;
      x.strokeStyle = 'rgba(255,236,190,0.45)'; x.lineWidth = 2; x.beginPath(); x.moveTo(px - w, py); x.quadraticCurveTo(px, py - w * 0.4, px + w, py); x.stroke();
      x.strokeStyle = 'rgba(140,100,50,0.3)'; x.beginPath(); x.moveTo(px - w * 0.3, py - w * 0.2); x.quadraticCurveTo(px + w * 0.4, py - w * 0.08, px + w, py); x.stroke();
    }
  } else {
    for (let i = 0; i < 1400; i++) {
      const px = rnd() * BF.W, py = rnd() * BF.H;
      x.strokeStyle = rnd() < 0.5 ? 'rgba(60,70,30,0.5)' : 'rgba(200,190,120,0.45)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px - 1.5, py - 4); x.moveTo(px + 1.5, py); x.lineTo(px + 2.5, py - 5); x.stroke();
    }
  }
  if (for3d) {
    // In 3D the trees and rocks are real objects; the ground only needs to fade into the land around it
    const base = (GROUND[TB.terrain] || GROUND.steppe)[0];
    for (const [x0, y0, x1, y1] of [[0, 0, 0, 90], [0, BF.H, 0, BF.H - 90], [0, 0, 90, 0], [BF.W, 0, BF.W - 90, 0]]) {
      const gr = x.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, base); gr.addColorStop(1, base + '00');
      x.fillStyle = gr; x.fillRect(0, 0, BF.W, BF.H);
    }
    if (TB.walls) paintWalls2D(x);
    return c;
  }
  // Rocks, bushes or trees, kept to the edges where they will not hide the fighting
  const edge = () => { const side = rnd(); return side < 0.5 ? [rnd() < 0.5 ? rnd() * 140 : BF.W - rnd() * 140, rnd() * BF.H] : [rnd() * BF.W, rnd() < 0.5 ? rnd() * 50 : BF.H - rnd() * 50]; };
  for (let i = 0; i < 46; i++) {
    const [px, py] = edge(), r = 6 + rnd() * 12;
    x.fillStyle = 'rgba(20,14,6,0.3)'; x.beginPath(); x.ellipse(px + r * 0.5, py + r * 0.35, r, r * 0.45, 0, 0, Math.PI * 2); x.fill();
    if (TB.terrain === 'mountain' || TB.terrain === 'desert') {
      x.fillStyle = '#8a7f68'; x.beginPath(); x.moveTo(px - r, py + r * 0.3); x.lineTo(px - r * 0.4, py - r * 0.6); x.lineTo(px + r * 0.5, py - r * 0.5); x.lineTo(px + r, py + r * 0.3); x.fill();
      x.fillStyle = '#5f5644'; x.beginPath(); x.moveTo(px + r * 0.5, py - r * 0.5); x.lineTo(px + r, py + r * 0.3); x.lineTo(px, py + r * 0.3); x.fill();
    } else {
      x.fillStyle = '#3f5a2c'; x.beginPath(); x.arc(px, py - r * 0.3, r, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(160,190,100,0.35)'; x.beginPath(); x.arc(px - r * 0.3, py - r * 0.7, r * 0.5, 0, Math.PI * 2); x.fill();
    }
  }
  if (TB.walls) paintWalls2D(x);
  // Warm light from the upper left, and a vignette
  const l = x.createLinearGradient(0, 0, BF.W, BF.H); l.addColorStop(0, 'rgba(255,220,160,0.18)'); l.addColorStop(1, 'rgba(40,30,60,0.2)');
  x.fillStyle = l; x.fillRect(0, 0, BF.W, BF.H);
  const v = x.createRadialGradient(BF.W / 2, BF.H / 2, BF.H * 0.35, BF.W / 2, BF.H / 2, BF.W * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,6,2,0.5)');
  x.fillStyle = v; x.fillRect(0, 0, BF.W, BF.H);
  return c;
}

// City walls with towers and a gate, as seen from above (used by the 2D view; in 3D only their footprint)
function paintWalls2D(x) {
  {
    const wy = TB.playerSide === 'def' ? BF.H * 0.62 : BF.H * 0.38, inside = TB.playerSide === 'def' ? 1 : -1;
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, wy - 10 + inside * 14, BF.W, 22);
    const wall = x.createLinearGradient(0, wy - 16, 0, wy + 16); wall.addColorStop(0, '#d9c49a'); wall.addColorStop(1, '#8f7652');
    x.fillStyle = wall; x.fillRect(0, wy - 14, BF.W, 28);
    x.fillStyle = '#6d5a3c'; for (let px = 0; px < BF.W; px += 18) x.fillRect(px, wy - 14 - 6, 10, 6);
    x.strokeStyle = 'rgba(80,60,36,0.5)'; x.lineWidth = 1; for (let py = wy - 10; py < wy + 14; py += 7) { x.beginPath(); x.moveTo(0, py); x.lineTo(BF.W, py); x.stroke(); }
    for (let px = 60; px < BF.W; px += 200) {
      x.fillStyle = '#00000040'; x.beginPath(); x.ellipse(px + 8, wy + 22, 26, 8, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = wall; x.beginPath(); x.arc(px, wy, 24, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#6d5a3c'; x.lineWidth = 3; x.stroke();
    }
    x.fillStyle = '#3b2a18'; x.fillRect(BF.W / 2 - 26, wy - 14, 52, 28);
    x.fillStyle = '#2a8f8a'; x.fillRect(BF.W / 2 - 30, wy - 18, 60, 5);
  }
}

function drawBattle() {
  const c = bx, v = TB.view;
  c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  c.fillStyle = '#0d0f17';
  c.fillRect(0, 0, window.innerWidth, window.innerHeight);
  c.save();
  c.translate(v.ox, v.oy); c.scale(v.s, v.s);
  c.drawImage(TB.ground, 0, 0);
  if (TB.breach && TB.wallY !== null) {
    c.fillStyle = 'rgba(70,52,30,0.9)'; c.beginPath(); c.ellipse(BF.W / 2, TB.wallY, 70, 18, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8f7652'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(BF.W / 2 - 60 + i * 15, TB.wallY + ((i * 7) % 11) - 5, 5 + (i % 3) * 2, 0, Math.PI * 2); c.fill(); }
  }
  // The fallen
  for (const d of TB.dead) {
    c.fillStyle = d.c; c.globalAlpha = 0.75;
    c.beginPath(); c.ellipse(d.x, d.y, 3.2, 1.4, d.a, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // Movement lines for selected regiments
  c.lineWidth = 1.5; c.setLineDash([6, 6]);
  for (const r of TB.regs) {
    if (!TB.sel.has(r.id) || r.gone) continue;
    if (Math.hypot(r.tx - r.x, r.ty - r.y) > 5) { c.strokeStyle = r.target ? '#ff8a70' : '#ffffffaa'; c.beginPath(); c.moveTo(r.x, r.y); c.lineTo(r.tx, r.ty); c.stroke(); }
  }
  c.setLineDash([]);
  const order = TB.regs.filter(r => !r.gone).sort((a, b) => a.y - b.y);
  for (const r of order) drawRegiment(c, r);
  for (const d of TB.dust) {
    c.fillStyle = `rgba(210,190,150,${0.35 * d.life})`;
    c.beginPath(); c.arc(d.x, d.y, 4 + (1 - d.life) * 10, 0, Math.PI * 2); c.fill();
  }
  // Arrows
  c.strokeStyle = '#2a1a0a'; c.lineWidth = 1;
  for (const a of TB.arrows) {
    const k = 1 - a.life / a.max, x = a.x0 + (a.x1 - a.x0) * k, y = a.y0 + (a.y1 - a.y0) * k - Math.sin(k * Math.PI) * 40;
    const ang = Math.atan2(a.y1 - a.y0, a.x1 - a.x0);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(ang) * 9, y - Math.sin(ang) * 9); c.stroke();
  }
  // Selection box
  if (TB.drag && TB.drag.moved) {
    const a = bToWorld(TB.drag.x0, TB.drag.y0), b = bToWorld(TB.drag.x1, TB.drag.y1);
    c.strokeStyle = '#ffe08a'; c.lineWidth = 1.5 / v.s; c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }
  for (const f of TB.fx) {
    c.font = (f.big ? 90 : 18) + 'px Palatino Linotype, Georgia, serif';
    c.textAlign = 'center'; c.lineWidth = f.big ? 6 : 3; c.strokeStyle = '#000a'; c.fillStyle = f.color;
    c.strokeText(f.text, f.x, f.y); c.fillText(f.text, f.x, f.y);
  }
  c.restore();
  if (TB.paused && !TB.over) {
    c.font = '28px Palatino Linotype, Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#ffe08a';
    c.fillText('Paused — press Space', window.innerWidth / 2, 90);
  }
}

function drawRegiment(c, r) {
  const F = FACTIONS[r.faction];
  const n = Math.max(1, Math.ceil(r.men / (r.d.cls === 'cav' || r.d.cls === 'ha' ? 3 : 4)));
  const mounted = r.d.cls === 'cav' || r.d.cls === 'ha';
  const cols = mounted ? 6 : 10, sp = mounted ? 13 : 8.5;
  const rows = Math.ceil(n / cols);
  const cos = Math.cos(r.face + Math.PI / 2), sin = Math.sin(r.face + Math.PI / 2);
  const sel = TB.sel.has(r.id);
  const t = TB.t;
  const fighting = inMelee(r);
  for (let i = 0; i < n; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    let lx = (col - (Math.min(cols, n) - 1) / 2) * sp, ly = (row - (rows - 1) / 2) * sp;
    if (r.rout) { lx += Math.sin(i * 12.9 + t) * 10; ly += Math.cos(i * 7.3 + t) * 10; }
    if (fighting) { lx += Math.sin(i * 3.1 + t * 9) * 2; ly += Math.cos(i * 5.7 + t * 8) * 2; }
    const x = r.x + lx * cos - ly * sin, y = r.y + lx * sin + ly * cos + (r.moving ? Math.sin(t * 10 + i) * 0.8 : 0);
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath(); c.ellipse(x + 2, y + 2.5, mounted ? 6 : 3.4, mounted ? 2.4 : 1.4, 0, 0, Math.PI * 2); c.fill();
    if (mounted) {
      c.fillStyle = (i % 3) ? '#5c432b' : '#7a5a38';
      c.beginPath(); c.ellipse(x, y, 6, 3.2, r.face, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a2a18';
      c.beginPath(); c.arc(x + Math.cos(r.face) * 6, y + Math.sin(r.face) * 6 - 1, 1.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = r.u.type === 'general' ? '#ffd75a' : F.color;
      c.beginPath(); c.arc(x, y - 2.4, 2.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c9c4b6';
      c.beginPath(); c.arc(x, y - 4.6, 1.4, 0, Math.PI * 2); c.fill();
      if (r.d.cls === 'cav') { c.strokeStyle = '#3a2a1a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x + Math.cos(r.face) * 11, y - 2 + Math.sin(r.face) * 11); c.stroke(); }
    } else {
      c.fillStyle = F.dark;
      c.beginPath(); c.arc(x, y, 3.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = F.color;
      c.beginPath(); c.arc(x, y - 0.8, 2.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = r.d.cls === 'inf' ? '#b9b6ad' : '#e2c9a0';
      c.beginPath(); c.arc(x, y - 2.6, 1.3, 0, Math.PI * 2); c.fill();
      if (r.d.cls === 'spear' || r.d.cls === 'inf') {
        // round shield on the forward side
        c.fillStyle = r.d.cls === 'inf' ? '#8c7a5a' : '#7a5a38';
        c.beginPath(); c.arc(x + Math.cos(r.face + 0.6) * 2.6, y + Math.sin(r.face + 0.6) * 2.6, 1.9, 0, Math.PI * 2); c.fill();
      }
      if (r.d.cls === 'spear') { c.strokeStyle = '#3a2a1a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(r.face) * 9, y + Math.sin(r.face) * 9); c.stroke(); }
      if (r.d.cls === 'missile') { c.strokeStyle = '#4a3218'; c.lineWidth = 0.8; c.beginPath(); c.arc(x + Math.cos(r.face) * 2, y + Math.sin(r.face) * 2, 3, r.face - 1.2, r.face + 1.2); c.stroke(); }
    }
  }
  // Banner
  const bx0 = r.x, by0 = r.y - r.r - 12;
  c.strokeStyle = '#2a1a0a'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(bx0, by0 + 16); c.lineTo(bx0, by0 - 8); c.stroke();
  c.beginPath(); c.moveTo(bx0, by0 - 8); c.lineTo(bx0 + 16, by0 - 8); c.lineTo(bx0 + 16, by0 + 4); c.lineTo(bx0 + 8, by0 + 1); c.lineTo(bx0, by0 + 4); c.closePath();
  c.fillStyle = F.color; c.fill(); c.strokeStyle = F.dark; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = '#e8c15c'; c.beginPath(); c.arc(bx0, by0 - 9, 1.6, 0, Math.PI * 2); c.fill();
  if (sel) { c.strokeStyle = '#ffe08a'; c.lineWidth = 2; c.beginPath(); c.ellipse(r.x, r.y, r.r + 8, r.r + 4, 0, 0, Math.PI * 2); c.stroke(); }
  // Strength bar
  c.fillStyle = '#000a'; c.fillRect(r.x - 16, r.y + r.r + 4, 32, 4);
  c.fillStyle = r.rout ? '#d0503a' : r.player ? '#7fe07f' : '#ff8a70';
  c.fillRect(r.x - 16, r.y + r.r + 4, 32 * r.men / r.max, 4);
}

function renderBattleTop() {
  const b = TB.b, p = G.provinces[b.prov];
  const side = s => {
    const f = b[s].faction, total = TB.start[s], now = sideMen(s);
    return `<div class="bside">${flagSVG(f)}<div><div>${FACTIONS[f].name}${s === TB.playerSide ? ' (you)' : ''}</div><div class="meter"><div style="width:${Math.round(now / total * 100)}%;background:${FACTIONS[f].color}"></div></div></div><div>${fmt(now)}</div></div>`;
  };
  $('b-top').innerHTML = side('att') + `<div>Battle of ${p.city}${TB.walls ? ' · storming the walls' + (TB.breach ? ' (breach made)' : '') : ''}</div>` + side('def');
}

function renderBattleCards() {
  const mine = TB.regs.filter(r => r.player);
  $('b-cards').innerHTML = mine.map(r => `<div class="ucard ${TB.sel.has(r.id) ? 'sel' : ''}" data-r="${r.id}" style="${r.gone || r.rout ? 'opacity:.35' : ''}" title="${r.d.name}">${unitSVG(r.u.type, r.faction)}<div class="men">${Math.round(r.men)}</div><div class="bar"><div style="width:${Math.round(r.men / r.max * 100)}%"></div></div></div>`).join('');
}

let cardT = 0;
function battleFrame(now) {
  if (!TB) return;
  const dt = Math.min(0.05, (now - TB.last) / 1000);
  TB.last = now;
  if (!TB.paused && !TB.over) for (let i = 0; i < TB.speed; i++) stepBattle(dt);
  if (TB.r3) { render3D(TB.r3, dt); drawOverlay3D(); } else drawBattle();
  cardT -= dt;
  if (cardT <= 0 && TB) { cardT = 0.3; renderBattleTop(); renderBattleCards(); }
  if (TB) requestAnimationFrame(battleFrame);
}

// ---------- Battle input ----------

const touches = new Map();
bc.addEventListener('pointerdown', e => {
  if (!TB || TB.over) return;
  if (TB.r3) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.button === 1 || touches.size === 2) { TB.pan = { x: e.clientX, y: e.clientY, pinch: touches.size === 2 ? touchSpan() : 0 }; TB.drag = null; e.preventDefault(); return; }
  }
  if (e.button === 2) { battleOrder(e); return; }
  TB.drag = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, moved: false, shift: e.shiftKey };
});
function touchSpan() { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
bc.addEventListener('pointermove', e => {
  if (!TB) return;
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (TB.r3 && TB.pan) {
    const c = TB.r3.cam, k = c.dist / 700;
    const dx = e.clientX - TB.pan.x, dy = e.clientY - TB.pan.y;
    if (TB.pan.pinch && touches.size === 2) { const sp = touchSpan(); c.dist = clampN(c.dist * TB.pan.pinch / sp, 160, 1700); TB.pan.pinch = sp; }
    c.tx -= (Math.cos(c.yaw) * dx + Math.sin(c.yaw) * dy) * k;
    c.tz -= (-Math.sin(c.yaw) * dx + Math.cos(c.yaw) * dy) * k;
    TB.pan.x = e.clientX; TB.pan.y = e.clientY;
    return;
  }
  if (!TB.drag) return;
  TB.drag.x1 = e.clientX; TB.drag.y1 = e.clientY;
  if (Math.abs(TB.drag.x1 - TB.drag.x0) + Math.abs(TB.drag.y1 - TB.drag.y0) > 6) TB.drag.moved = true;
});
bc.addEventListener('pointerup', e => {
  touches.delete(e.pointerId);
  if (TB && TB.pan) { if (touches.size < 2) TB.pan = null; return; }
  if (!TB || !TB.drag) return;
  const d = TB.drag;
  TB.drag = null;
  if (e.button === 2) return;
  if (d.moved) {
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    if (!d.shift) TB.sel.clear();
    for (const r of TB.regs) {
      if (!r.player || r.gone || r.rout) continue;
      const p = toScreen(r.x, r.y, 4);
      if (!p.behind && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) TB.sel.add(r.id);
    }
  } else {
    const w = toField(e.clientX, e.clientY);
    const hit = pickReg(e.clientX, e.clientY, r => r.player) || pickReg(e.clientX, e.clientY, r => !r.player);
    if (hit && hit.player) {
      if (!d.shift) TB.sel.clear();
      TB.sel.add(hit.id);
    } else if (hit && !hit.player && TB.sel.size) {
      orderAttackReg(hit, false); // left-click on an enemy with troops selected = attack (good for touch)
    } else if (!hit && TB.sel.size && e.pointerType !== 'mouse') {
      battleMoveTo(w, false);
    } else if (!d.shift) TB.sel.clear();
  }
  renderBattleCards();
});
bc.addEventListener('contextmenu', e => e.preventDefault());

function battleOrder(e) {
  if (!TB.sel.size) return;
  const w = toField(e.clientX, e.clientY);
  const hit = pickReg(e.clientX, e.clientY, r => !r.player);
  if (hit) orderAttackReg(hit, e.shiftKey); else battleMoveTo(w, e.shiftKey);
}
function orderAttackReg(t, run) {
  for (const id of TB.sel) { const r = TB.regs[id]; if (r.gone || r.rout) continue; r.target = t; r.order = 'attack'; r.run = run; }
}
function battleMoveTo(w, run) {
  const list = [...TB.sel].map(id => TB.regs[id]).filter(r => !r.gone && !r.rout);
  if (!list.length) return;
  // Keep the group's shape around the clicked point
  const cx = list.reduce((s, r) => s + r.x, 0) / list.length, cy = list.reduce((s, r) => s + r.y, 0) / list.length;
  for (const r of list) {
    r.tx = clampN(w.x + (r.x - cx), 15, BF.W - 15); r.ty = clampN(w.y + (r.y - cy), 15, BF.H - 15);
    r.target = null; r.order = 'move'; r.run = run;
  }
  TB.fx.push({ x: w.x, y: w.y, text: '✕', life: 0.5, color: '#fff' });
}

$('b-cards').addEventListener('click', e => {
  const c = e.target.closest('[data-r]');
  if (!c || !TB) return;
  const id = +c.dataset.r;
  if (!e.shiftKey) TB.sel.clear();
  TB.sel.add(id);
  renderBattleCards();
});
$('b-speed').onclick = () => { if (!TB) return; TB.speed = TB.speed === 1 ? 2 : TB.speed === 2 ? 4 : 1; $('b-speed').textContent = 'Speed ' + TB.speed + '×'; };
$('b-auto').onclick = () => {
  if (!TB || TB.over) return;
  // Finish the fight by the numbers from where it stands now
  for (const r of TB.regs) r.u.men = Math.round(r.men * (r.rout || r.gone ? 0.6 : 1));
  const res = autoResolve(TB.b);
  for (const r of TB.regs) r.men = r.u.men;
  endTactical(res.winner, true);
};
$('b-retreat').onclick = () => {
  if (!TB || TB.over) return;
  for (const r of TB.regs) if (r.player && !r.gone) r.men *= 0.85; // a fighting withdrawal costs men
  endTactical(TB.playerSide === 'att' ? 'def' : 'att', true);
};
bc.addEventListener('wheel', e => {
  if (!TB || !TB.r3) return;
  e.preventDefault();
  TB.r3.cam.dist = clampN(TB.r3.cam.dist * (e.deltaY > 0 ? 1.12 : 1 / 1.12), 160, 1700);
}, { passive: false });
window.addEventListener('keyup', e => { if (TB && TB.r3) TB.r3.keys[e.code] = false; });
window.addEventListener('blur', () => { if (TB && TB.r3) TB.r3.keys = {}; });
$('b-cam').addEventListener('click', e => {
  const b = e.target.closest('[data-cam]');
  if (!b || !TB || !TB.r3) return;
  const c = TB.r3.cam, k = b.dataset.cam;
  if (k === 'left') c.yaw += 0.5; if (k === 'right') c.yaw -= 0.5;
  if (k === 'in') c.dist = Math.max(160, c.dist / 1.3); if (k === 'out') c.dist = Math.min(1700, c.dist * 1.3);
});
window.addEventListener('keydown', e => {
  if (!TB || $('battle').classList.contains('hidden')) return;
  if (TB.r3 && !e.ctrlKey && !e.metaKey) TB.r3.keys[e.code] = true;
  if (e.code === 'Space') { TB.paused = !TB.paused; e.preventDefault(); }
  if (e.key === 'a' && e.ctrlKey) { e.preventDefault(); for (const r of TB.regs) if (r.player && !r.gone && !r.rout) TB.sel.add(r.id); renderBattleCards(); }
});
