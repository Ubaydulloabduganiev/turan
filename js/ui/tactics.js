'use strict';
// The art of the battlefield, on top of the simulation in tactical.js: hills, woods and streams that change
// the fight; a city's gate and towers; the camera's opening sweep; the slow-motion moment of a cavalry charge;
// and the general's own manoeuvres (feigned retreat, shield wall, arrow storm...).

// ---------- The lie of the land ----------

function makeFeatures() {
  const rnd = mulberry32(TB.b.prov.length * 7919 + G.turn * 13 + 5);
  const terr = TB.terrain, F = [];
  TB.feats = F;
  TB.naval = TB.b.kind === 'naval';
  if (TB.wallY !== null || TB.naval) return; // the ground before a city's walls is cleared; at sea there is only water
  // Attacking across a great river: deep water, one bridge and one ford
  if (TB.b.river) {
    const bx = BF.W * (0.38 + rnd() * 0.24), fx = bx < BF.W / 2 ? BF.W * (0.72 + rnd() * 0.12) : BF.W * (0.16 + rnd() * 0.12);
    F.push({ type: 'stream', river: TB.b.river, deep: true, w: 38, y: BF.H / 2 + (rnd() - 0.5) * 30, ph: rnd() * 6, fords: [fx], bridge: bx });
  }
  const nh = terr === 'mountain' ? 3 : terr === 'river' || terr === 'oasis' ? 1 : 2;
  for (let i = 0; i < nh; i++) {
    const side = (i + Math.floor(rnd() * 2)) % 2 ? 1 : -1;
    F.push({ type: 'hill', x: BF.W / 2 + side * (200 + rnd() * 300), y: 250 + rnd() * 300, r: 95 + rnd() * 55, h: terr === 'mountain' ? 36 : 24 });
  }
  if (terr !== 'desert' && rnd() < (terr === 'mountain' ? 0.5 : 0.85)) {
    const side = rnd() < 0.5 ? -1 : 1;
    const w = { type: 'wood', x: BF.W / 2 + side * (300 + rnd() * 180), y: 320 + rnd() * 160, r: 75 + rnd() * 30 };
    // no hill under the trees
    for (let i = F.length - 1; i >= 0; i--) if (Math.hypot(F[i].x - w.x, F[i].y - w.y) < (F[i].r + w.r) * 0.9) F.splice(i, 1);
    F.push(w);
  }
  if (!TB.b.river && (terr === 'river' || (terr === 'oasis' && rnd() < 0.6) || (terr === 'steppe' && rnd() < 0.25))) {
    F.push({ type: 'stream', w: 20, y: BF.H / 2 + (rnd() - 0.5) * 50, ph: rnd() * 6, fords: [BF.W * (0.2 + rnd() * 0.15), BF.W * (0.65 + rnd() * 0.15)] });
  }
}
const featOf = type => (TB && TB.feats || []).find(f => f.type === type);
const streamY = (f, x) => f.y + Math.sin(x * 0.011 + f.ph) * 16;
function hillAt(x, y) { for (const f of TB.feats || []) if (f.type === 'hill' && Math.hypot(x - f.x, y - f.y) < f.r * 0.8) return f; return null; }
function woodAt(x, y) { const f = featOf('wood'); return !!f && Math.hypot(x - f.x, y - f.y) < f.r; }
// 'water', 'deep', 'ford', 'bridge' or null
function streamAt(x, y) {
  const f = featOf('stream');
  if (!f || Math.abs(y - streamY(f, x)) > (f.w || 20)) return null;
  if (f.bridge && Math.abs(x - f.bridge) < 26) return 'bridge';
  if (f.fords.some(fx => Math.abs(x - fx) < 45)) return 'ford';
  return f.deep ? 'deep' : 'water';
}
// Extra height of the ground in 3D
function featHeight(x, z) {
  let h = 0;
  for (const f of TB.feats || []) {
    if (f.type === 'hill') { const d = Math.hypot(x - f.x, z - f.y) / f.r; h += f.h * Math.exp(-d * d * 1.8); }
    if (f.type === 'stream') {
      if (f.bridge && Math.abs(x - f.bridge) < 22 && Math.abs(z - streamY(f, x)) < f.w + 14) { h += 2.4; continue; } // the bridge deck
      const k = Math.max(0, 1 - Math.abs(z - streamY(f, x)) / ((f.w || 20) + 8));
      const ford = f.fords.some(fx => Math.abs(x - fx) < 45);
      h -= (ford ? 2.8 : f.deep ? 12 : 8) * Math.min(1, k * 1.6);
    }
  }
  return h;
}

// Speed, attack and defence on this ground
function groundSpeed(r) {
  let s = 1;
  const mounted = r.d.cls === 'cav' || r.d.cls === 'ha';
  if (hillAt(r.x, r.y)) s *= 0.88;
  if (woodAt(r.x, r.y)) s *= mounted ? 0.55 : 0.8;
  const w = streamAt(r.x, r.y);
  if (w === 'water') s *= 0.35; else if (w === 'deep') s *= 0.15; else if (w === 'ford') s *= 0.8;
  return s;
}
function groundMelee(a, c) {
  let k = 1;
  const ha = hillAt(a.x, a.y), hc = hillAt(c.x, c.y);
  if (ha && !hc) k *= 1.2;
  if (hc && !ha) k *= 0.8;
  if ((a.d.cls === 'cav' || a.d.cls === 'ha') && woodAt(a.x, a.y)) k *= 0.7;
  const wc = streamAt(c.x, c.y);
  if (wc === 'water') k *= 1.3; else if (wc === 'deep') k *= 1.6; // men in the water defend badly
  else if (wc === 'bridge' && !streamAt(a.x, a.y)) k *= 0.8; // a few men hold a bridge against many
  return k;
}
const groundRange = r => hillAt(r.x, r.y) ? 40 : 0;
function groundShot(r, t) { return (hillAt(r.x, r.y) ? 1.15 : 1) * (woodAt(t.x, t.y) ? 0.55 : 1); }

function featureNote() {
  const out = [];
  if (featOf('hill')) out.push(t('Hills: those who hold them fight and shoot better.'));
  if (featOf('wood')) out.push(t('A wood: it slows horsemen and shelters men from arrows.'));
  const st = featOf('stream');
  if (st && st.river) out.push(t('The {river}: the water is deep. Cross by the bridge or the ford, or swim slowly under the enemy’s arrows.', { river: geoName(st.river) }));
  else if (st) out.push(t('A stream: cross it at the fords, or wade slowly through the water.'));
  if (TB.naval) out.push(t('A battle on the water: archers rule, and horsemen fight on foot. Ram and board the enemy boats.'));
  if (TB.gate) out.push(t('Batter down the gate with your foot soldiers, or bring siege engines to knock down the towers.'));
  else if (TB.towers && TB.towers.length) out.push(t('The towers shoot at anyone near the walls. Siege engines can knock them down.'));
  return out.join(' ');
}

// Paints hills, the wood and the stream onto the battlefield floor
function paintFeatures(x, for3d) {
  const rnd = mulberry32(TB.b.prov.length * 31 + 7);
  for (const f of TB.feats || []) {
    if (f.type === 'hill') {
      // light on the sunny slope, shade on the other
      const g = x.createRadialGradient(f.x - f.r * 0.3, f.y - f.r * 0.35, f.r * 0.1, f.x, f.y, f.r * 1.05);
      g.addColorStop(0, for3d ? 'rgba(255,240,190,0.12)' : 'rgba(255,240,190,0.3)'); g.addColorStop(0.6, 'rgba(255,240,190,0.04)'); g.addColorStop(1, 'rgba(255,240,190,0)');
      x.fillStyle = g; x.beginPath(); x.arc(f.x, f.y, f.r * 1.05, 0, Math.PI * 2); x.fill();
      if (!for3d) {
        const s = x.createRadialGradient(f.x + f.r * 0.35, f.y + f.r * 0.4, f.r * 0.1, f.x + f.r * 0.2, f.y + f.r * 0.25, f.r);
        s.addColorStop(0, 'rgba(40,30,10,0.28)'); s.addColorStop(1, 'rgba(40,30,10,0)');
        x.fillStyle = s; x.beginPath(); x.arc(f.x + f.r * 0.2, f.y + f.r * 0.25, f.r, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(70,55,25,0.4)'; x.lineWidth = 1.4;
        for (const k of [0.45, 0.7, 0.92]) { x.beginPath(); x.ellipse(f.x, f.y, f.r * k, f.r * k * 0.9, 0.3, 0, Math.PI * 2); x.stroke(); }
      }
    }
    if (f.type === 'wood') {
      x.fillStyle = 'rgba(30,45,15,0.35)'; x.beginPath(); x.arc(f.x, f.y, f.r, 0, Math.PI * 2); x.fill();
      if (!for3d) for (let i = 0; i < 46; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * f.r * 0.92, px = f.x + Math.cos(a) * d, py = f.y + Math.sin(a) * d, r = 7 + rnd() * 6;
        x.fillStyle = 'rgba(15,20,8,0.35)'; x.beginPath(); x.ellipse(px + 3, py + 3, r, r * 0.6, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = `hsl(${85 + rnd() * 20},${30 + rnd() * 15}%,${22 + rnd() * 10}%)`; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(190,210,120,0.25)'; x.beginPath(); x.arc(px - r * 0.3, py - r * 0.35, r * 0.45, 0, Math.PI * 2); x.fill();
      }
    }
    if (f.type === 'stream') {
      const band = (w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); for (let px = -10; px <= BF.W + 10; px += 10) { const py = streamY(f, px); if (px < 0) x.moveTo(px, py); else x.lineTo(px, py); } x.stroke(); };
      const ww = (f.w || 20) / 20;
      band(46 * ww, 'rgba(110,90,50,0.45)'); // muddy banks
      band(32 * ww, f.deep ? '#3f6f80' : '#4f7f8f'); band(18 * ww, f.deep ? '#5a8fa0' : '#6a9fae');
      for (const fx of f.fords) {
        x.fillStyle = 'rgba(200,185,140,0.75)';
        x.beginPath(); x.ellipse(fx, streamY(f, fx), 40, 16, Math.atan(Math.cos(fx * 0.011 + f.ph) * 0.17), 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(120,170,185,0.5)';
        for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(fx - 30 + i * 7.5, streamY(f, fx) + Math.sin(i * 2.1) * 6, 2.4, 0, Math.PI * 2); x.fill(); }
      }
      if (f.bridge) { // a timber bridge on piers
        const by = streamY(f, f.bridge), L = f.w * 2 + 26;
        x.save(); x.translate(f.bridge, by); x.rotate(Math.atan(Math.cos(f.bridge * 0.011 + f.ph) * 0.17));
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(-20, -L / 2 + 6, 44, L);
        x.fillStyle = '#7a5a36'; x.fillRect(-22, -L / 2, 44, L);
        x.strokeStyle = '#4a3218'; x.lineWidth = 1.2; for (let k = -L / 2 + 4; k < L / 2; k += 6) { x.beginPath(); x.moveTo(-22, k); x.lineTo(22, k); x.stroke(); }
        x.fillStyle = '#5a3e22'; x.fillRect(-24, -L / 2, 4, L); x.fillRect(20, -L / 2, 4, L);
        x.restore();
      }
      x.strokeStyle = 'rgba(230,245,255,0.35)'; x.lineWidth = 1;
      for (let px = 0; px < BF.W; px += 34) { const py = streamY(f, px) + Math.sin(px) * 5; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 12, py + 1); x.stroke(); }
    }
  }
}

// The wood and the water in 3D
function features3D(R) {
  const T = THREE, rnd = mulberry32(TB.b.prov.length * 53 + 3);
  const w = featOf('wood');
  if (w) {
    const n = R.small ? 22 : 38;
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.7, 1.1, 10, 5).translate(0, 5, 0), new T.MeshLambertMaterial({ color: '#4a3826' }), n);
    const crown = new T.InstancedMesh(new T.IcosahedronGeometry(7, 1).scale(1, 1.25, 1).translate(0, 17, 0), new T.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), n);
    const d = new T.Object3D();
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, dd = Math.sqrt(rnd()) * w.r * 0.95, x = w.x + Math.cos(a) * dd, z = w.y + Math.sin(a) * dd, s = 0.8 + rnd() * 0.6;
      d.position.set(x, R.hgt(x, z), z); d.scale.set(s, s * (0.9 + rnd() * 0.4), s); d.rotation.y = rnd() * 6; d.updateMatrix();
      trunk.setMatrixAt(i, d.matrix); crown.setMatrixAt(i, d.matrix);
      crown.setColorAt(i, new T.Color().setHSL(0.22 + rnd() * 0.06, 0.38, 0.24 + rnd() * 0.1));
    }
    trunk.castShadow = crown.castShadow = true;
    R.scene.add(trunk, crown);
  }
  const s = featOf('stream');
  if (s) {
    const seg = 90, pos = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const x = -400 + (BF.W + 800) * i / seg, y = streamY(s, x);
      const hw = (s.w || 20) + 4;
      pos.push(x, -2.2, y - hw, x, -2.2, y + hw);
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const water = new T.Mesh(g, new T.MeshPhongMaterial({ color: '#4f8396', specular: '#cfe8ff', shininess: 60, transparent: true, opacity: 0.85 }));
    water.receiveShadow = true;
    R.scene.add(water);
    if (s.bridge) {
      const ang = Math.atan(Math.cos(s.bridge * 0.011 + s.ph) * 0.17), L = s.w * 2 + 34, by = streamY(s, s.bridge);
      const wood = new T.MeshLambertMaterial({ color: '#7a5a36' });
      const deck = new T.Mesh(new T.BoxGeometry(44, 2.2, L), wood);
      deck.position.set(s.bridge, 1.2, by); deck.rotation.y = -ang; deck.castShadow = deck.receiveShadow = true;
      R.scene.add(deck);
      for (const side of [-1, 1]) for (let k = -1; k <= 1; k++) {
        const pier = new T.Mesh(new T.CylinderGeometry(1.6, 1.8, 14, 6), new T.MeshLambertMaterial({ color: '#4a3218' }));
        pier.position.set(s.bridge + side * 18, -5, by + k * L / 3); R.scene.add(pier);
      }
      for (const side of [-1, 1]) { const rail = new T.Mesh(new T.BoxGeometry(1.2, 3, L), wood); rail.position.set(s.bridge + side * 21, 3.4, by); rail.rotation.y = -ang; R.scene.add(rail); }
    }
  }
}

// ---------- The city's gate and towers ----------

function makeFort() {
  TB.gate = null; TB.towers = []; TB.stones = [];
  if (TB.wallY === null) return;
  if (!TB.breach) TB.gate = { x: BF.W / 2, hp: 70 + 45 * TB.walls, max: 70 + 45 * TB.walls, broken: false };
  for (let x = 60; x < BF.W; x += 200) if (Math.abs(x - BF.W / 2) >= 90) TB.towers.push({ x, hp: 60 + 25 * TB.walls, max: 60 + 25 * TB.walls, cd: Math.random() * 2, down: false });
}
// Where men can pass the wall at full speed
function wallOpen(r) {
  if (TB.breach) return true;
  const atGate = TB.gate && Math.abs(r.x - TB.gate.x) < 55;
  return !!atGate && (TB.gate.broken || r.side === 'def');
}
function wallSpeed(r) {
  if (TB.wallY === null || !inWall(r.y) || wallOpen(r)) return 1;
  return TB.gate && Math.abs(r.x - TB.gate.x) < 55 ? 0.05 : 0.3; // the closed gate holds; elsewhere, ladders
}

function fortStep(dt) {
  if (TB.wallY === null) return;
  const attackers = TB.regs.filter(r => r.side === 'att' && !r.gone && !r.rout && r.men > 0);
  const manned = TB.regs.some(r => r.side === 'def' && !r.gone && !r.rout && r.men > 0);
  // The towers shoot at attackers close to the walls
  if (manned) for (const tw of TB.towers) {
    if (tw.down) continue;
    tw.cd -= dt;
    if (tw.cd > 0) continue;
    let best = null, bd = 240;
    for (const r of attackers) { const d = Math.hypot(r.x - tw.x, r.y - TB.wallY); if (d < bd) { bd = d; best = r; } }
    if (!best) { tw.cd = 0.5; continue; }
    tw.cd = 2.2;
    let dmg = (2 + TB.walls) * 6 / (best.d.def + 6);
    if (best.wall > TB.t) dmg *= 0.4;
    best.men = Math.max(0, best.men - dmg);
    for (let i = 0; i < 4; i++) TB.arrows.push({ x0: tw.x + (Math.random() - 0.5) * 14, y0: TB.wallY, x1: best.x + (Math.random() - 0.5) * 40, y1: best.y + (Math.random() - 0.5) * 30, life: 0.6, max: 0.6, h0: 26 });
  }
  // Foot soldiers at the closed gate batter it
  const g = TB.gate;
  if (g && !g.broken) {
    for (const r of attackers) {
      if (r.d.cls === 'cav' || r.d.cls === 'ha' || r.d.cls === 'missile') continue;
      if (Math.abs(r.x - g.x) < 55 && Math.abs(r.y - TB.wallY) < 50) g.hp -= r.men / 100 * r.d.atk * 0.35 * dt;
    }
  }
  // Siege engines throw stones at the towers and the gate
  for (const r of attackers) {
    if (r.d.cls !== 'siege') continue;
    r.bomb = (r.bomb === undefined ? 1.5 : r.bomb) - dt;
    if (r.bomb > 0) continue;
    const marks = [...TB.towers.filter(x => !x.down), ...(g && !g.broken ? [g] : [])];
    let best = null, bd = 560;
    for (const m of marks) { const d = Math.hypot(m.x - r.x, TB.wallY - r.y); if (d < bd) { bd = d; best = m; } }
    r.bomb = 4;
    if (!best) continue;
    TB.stones.push({ x0: r.x, y0: r.y, x1: best.x + (Math.random() - 0.5) * 20, y1: TB.wallY, life: 1.4, max: 1.4, hit: best, dmg: (20 + Math.random() * 14) * r.men / r.max });
  }
  for (const s of TB.stones) {
    s.life -= dt;
    if (s.life <= 0 && s.hit) {
      s.hit.hp -= s.dmg;
      TB.dust.push({ x: s.x1, y: s.y1, life: 1 }, { x: s.x1 + 10, y: s.y1 - 5, life: 1 });
      sfx('clash', { vol: 0.3, rate: 0.5, gap: 0.3 });
      s.hit = null;
    }
  }
  TB.stones = TB.stones.filter(s => s.life > 0);
  // Fallen towers and a broken gate
  for (const tw of TB.towers) if (!tw.down && tw.hp <= 0) {
    tw.down = true;
    TB.fx.push({ x: tw.x, y: TB.wallY - 30, text: t('A tower falls!'), life: 2.2, color: '#ffe08a' });
    for (let i = 0; i < 10; i++) TB.dust.push({ x: tw.x + (Math.random() - 0.5) * 50, y: TB.wallY + (Math.random() - 0.5) * 30, life: 1 });
  }
  if (g && !g.broken && g.hp <= 0) {
    g.broken = true;
    TB.fx.push({ x: g.x, y: TB.wallY - 30, text: t('The gate is broken!'), life: 2.5, color: '#ffe08a' });
    sfx('cheer', { vol: 0.6 });
    for (let i = 0; i < 12; i++) TB.dust.push({ x: g.x + (Math.random() - 0.5) * 60, y: TB.wallY + (Math.random() - 0.5) * 30, life: 1 });
    renderBattleTop();
  }
}

// The gate, towers and stones in 2D
function drawFort2D(c) {
  if (TB.wallY === null) return;
  const wy = TB.wallY;
  if (TB.gate && TB.gate.broken) { c.fillStyle = '#2b2416'; c.fillRect(TB.gate.x - 26, wy - 14, 52, 28); c.fillStyle = '#8f7652'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(TB.gate.x - 22 + i * 9, wy + 10 + (i % 2) * 5, 4, 0, Math.PI * 2); c.fill(); } }
  for (const tw of TB.towers) if (tw.down) {
    c.fillStyle = 'rgba(60,45,25,0.85)'; c.beginPath(); c.arc(tw.x, wy, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#a58a60'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(tw.x - 18 + (i * 13) % 36, wy - 12 + (i * 7) % 24, 4 + (i % 3) * 2, 0, Math.PI * 2); c.fill(); }
  }
  if (TB.gate && !TB.gate.broken && TB.gate.hp < TB.gate.max) {
    c.fillStyle = '#000a'; c.fillRect(TB.gate.x - 24, wy - 30, 48, 5);
    c.fillStyle = '#e8b04a'; c.fillRect(TB.gate.x - 24, wy - 30, 48 * Math.max(0, TB.gate.hp) / TB.gate.max, 5);
  }
  c.fillStyle = '#5d5040';
  for (const s of TB.stones) {
    const k = 1 - s.life / s.max, x = s.x0 + (s.x1 - s.x0) * k, y = s.y0 + (s.y1 - s.y0) * k - Math.sin(k * Math.PI) * 120;
    c.beginPath(); c.arc(x, y, 4.5, 0, Math.PI * 2); c.fill();
  }
}

// The same in 3D: towers crumble, the gate falls, stones fly
function fort3D(R) {
  if (!R.fort) return;
  const T = THREE;
  for (const tw of TB.towers) {
    const m = R.fort.towers[tw.x];
    if (!m || !tw.down) continue;
    m.k = Math.max(0.12, (m.k === undefined ? 1 : m.k) - 0.03);
    for (const o of m.parts) { o.scale.y = m.k; o.position.y = o.userData.y0 * m.k; }
  }
  if (TB.gate && TB.gate.broken && R.fort.gate && R.fort.gate[0].visible) {
    for (const o of R.fort.gate) o.visible = false;
    const rub = new T.InstancedMesh(new T.DodecahedronGeometry(4, 0), new T.MeshLambertMaterial({ color: '#cdb084' }), 18), d = new T.Object3D();
    for (let i = 0; i < 18; i++) { d.position.set(TB.gate.x - 24 + Math.random() * 48, R.hgt(TB.gate.x, TB.wallY) + Math.random() * 5, TB.wallY + (Math.random() - 0.5) * 24); d.rotation.set(Math.random(), Math.random(), 0); d.scale.setScalar(0.6 + Math.random()); d.updateMatrix(); rub.setMatrixAt(i, d.matrix); }
    R.scene.add(rub);
  }
  // stones in flight
  if (!R.stones) { R.stones = new T.InstancedMesh(new T.DodecahedronGeometry(3, 0), new T.MeshLambertMaterial({ color: '#6e6150' }), 40); R.stones.frustumCulled = false; R.scene.add(R.stones); }
  const d = new T.Object3D();
  let n = 0;
  for (const s of TB.stones) {
    if (n >= 40) break;
    const k = 1 - s.life / s.max, x = s.x0 + (s.x1 - s.x0) * k, z = s.y0 + (s.y1 - s.y0) * k;
    d.position.set(x, R.hgt(x, z) + 10 + Math.sin(k * Math.PI) * 160, z); d.rotation.set(k * 9, k * 7, 0); d.updateMatrix();
    R.stones.setMatrixAt(n++, d.matrix);
  }
  R.stones.count = n; R.stones.instanceMatrix.needsUpdate = true;
}

// ---------- The opening sweep and the slow-motion charge ----------

function introCamera(R, c) {
  // From high above the enemy's lines, round and down to behind your own army
  const total = TB.introMax, k = 1 - Math.max(0, TB.intro) / total, e = k * k * (3 - 2 * k);
  const yaw = c.yaw + (1 - e) * 2.6, dist = c.dist + (1 - e) * 650, tx = BF.W / 2 + (c.tx - BF.W / 2) * e, tz = BF.H / 2 + (c.tz - BF.H / 2) * e;
  const pitch = 0.32 + e * (clampN(0.38 + (c.dist - 160) / 1540 * 0.55, 0.38, 0.95) - 0.32);
  return { tx, tz, yaw, dist, pitch };
}
function slowCamera(c) {
  const k = Math.sin(Math.PI * Math.min(1, 1 - TB.slow / TB.slowMax)), a = TB.slowAt;
  return { tx: c.tx + (a.x - c.tx) * k * 0.7, tz: c.tz + (a.y - c.tz) * k * 0.7, yaw: c.yaw, dist: c.dist + (Math.min(c.dist, 380) - c.dist) * k, pitch: null };
}
// A cavalry charge strikes home: time slows for a moment
function chargeMoment(a) {
  if (!TB || TB.slowCD > 0 || TB.over) return;
  TB.slowMax = TB.slow = 1.7; TB.slowCD = 28; TB.slowAt = { x: a.x, y: a.y };
  TB.fx.push({ x: a.x, y: a.y - 40, text: t('Charge!'), life: 1.6, color: a.player ? '#ffe08a' : '#ff9a8a' });
  sfx('gallop', { vol: 0.8 }); sfx('clash', { vol: 0.8, rate: 0.75 });
}

function drawIntro(c) {
  const w = innerWidth, h = innerHeight;
  // Letterbox bars for the cinematic moments
  const bar = TB.intro > 0 ? 1 : TB.slow > 0 ? Math.sin(Math.PI * (1 - TB.slow / TB.slowMax)) : 0;
  if (bar > 0) { c.fillStyle = `rgba(0,0,0,${0.85 * bar})`; c.fillRect(0, 0, w, h * 0.09 * bar); c.fillRect(0, h - h * 0.09 * bar, w, h * 0.09 * bar); }
  if (!(TB.intro > 0)) return;
  const k = TB.intro / TB.introMax, a = Math.min(1, (1 - k) * 4, k * 3);
  const p = G.provinces[TB.b.prov];
  c.save(); c.globalAlpha = a; c.textAlign = 'center';
  const big = Math.min(64, w / 12);
  c.font = `${big}px Cinzel, Georgia, serif`; c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.fillStyle = '#ffe9a8';
  const title = TB.b.kind === 'naval' ? t('Battle on the {sea}', { sea: geoName(TB.b.sea) }) : t('Battle of {city}', { city: cityOf(p) });
  c.strokeText(title, w / 2, h * 0.42); c.fillText(title, w / 2, h * 0.42);
  c.font = `${Math.round(big * 0.36)}px Cinzel, Georgia, serif`; c.lineWidth = 4; c.fillStyle = '#f0e2c0';
  const sub = `${fName(TB.b.att.faction)} · ${fName(TB.b.def.faction)} · ${dateText()}`;
  c.strokeText(sub, w / 2, h * 0.42 + big * 0.75); c.fillText(sub, w / 2, h * 0.42 + big * 0.75);
  c.font = `italic ${Math.round(big * 0.27)}px Georgia, serif`; c.fillStyle = 'rgba(240,226,192,0.8)';
  c.fillText(t(TB.touch ? 'Tap to begin' : 'Click to begin'), w / 2, h * 0.86);
  c.restore();
}
function skipIntro() {
  if (!TB || !(TB.intro > 0)) return false;
  TB.intro = 0;
  const note = featureNote();
  if (note) battleFlash(note);
  return true;
}

// ---------- The general's manoeuvres ----------

const genReg = side => TB.regs.find(r => r.side === side && r.u.type === 'general' && !r.gone && !r.rout && r.men > 0);
const ownRegs = (side, pred) => TB.regs.filter(r => r.side === side && !r.gone && !r.rout && r.men > 0 && pred(r));
const mountedR = r => r.d.cls === 'cav' || r.d.cls === 'ha';
const footR = r => r.d.cls === 'spear' || r.d.cls === 'inf';
const shootR = r => r.d.cls === 'missile' || r.d.cls === 'ha';

function makeAbilities() {
  TB.abil = {};
  TB.terror = { att: 0, def: 0 };
  for (const side of ['att', 'def']) {
    const g = sideGeneral(TB.b[side]);
    TB.abil[side] = { g, list: generalAbilities(g, TB.b[side].faction), cd: {}, think: 3 + Math.random() * 2 };
  }
}
// Why an ability cannot be used now, or '' when it can
function abilBlock(side, id) {
  const A = TB.abil[side];
  if (!genReg(side)) return t('Your general has left the field.');
  if (TB.naval && (id === 'feint' || id === 'charge')) return t('Not on the water.');
  if ((A.cd[id] || 0) > TB.t) return t('Ready in {n} s', { n: Math.ceil(A.cd[id] - TB.t) });
  const need = { feint: mountedR, charge: r => r.d.cls === 'cav' || r.u.type === 'general', shieldwall: footR, volley: shootR }[id];
  if (need && !ownRegs(side, need).length) return t('You have no men for this.');
  if (id === 'rally' && !TB.regs.some(r => r.side === side && r.rout && !r.gone)) return t('No one is fleeing.');
  return '';
}

function useAbility(side, id) {
  if (!TB || TB.over || abilBlock(side, id)) return false;
  const A = TB.abil[side], other = side === 'att' ? 'def' : 'att', mine = side === TB.playerSide;
  A.cd[id] = TB.t + ABILITIES[id].cd;
  const home = (side === TB.playerSide) ? 1 : -1; // the player's side is at the bottom
  const foes = TB.regs.filter(o => o.side === other && !o.gone && !o.rout && o.men > 0);
  if (id === 'feint') {
    const riders = ownRegs(side, mountedR);
    for (const r of riders) { r.feint = TB.t + 2.6; r.target = null; r.run = true; r.tx = r.x; r.ty = clampN(r.y + home * 170, 20, BF.H - 20); }
    for (const o of foes) {
      if (o.d.cls === 'missile' || o.d.cls === 'siege') continue;
      const lure = nearest(o, riders);
      if (lure && Math.hypot(lure.x - o.x, lure.y - o.y) < 280) { o.disorder = TB.t + 9; if (!o.player || !o.order) { o.target = lure; o.run = true; } }
    }
  } else if (id === 'charge') {
    for (const r of ownRegs(side, x => x.d.cls === 'cav' || (x.u.type === 'general' && side !== TB.playerSide))) {
      r.target = nearest(r, foes); r.charge = 3; r.run = true; r.boost = TB.t + 10; r.boostAmt = 15; if (r.player) r.order = 'attack';
    }
  } else if (id === 'shieldwall') {
    for (const r of ownRegs(side, footR)) { r.wall = TB.t + 15; r.tx = r.x; r.ty = r.y; if (r.player) r.order = null; }
  } else if (id === 'volley') {
    for (const r of ownRegs(side, shootR)) {
      const tg = r.target && !r.target.gone ? r.target : nearest(r, foes);
      if (tg && Math.hypot(tg.x - r.x, tg.y - r.y) < (RANGE[r.d.cls] + groundRange(r)) * 1.2) shoot(r, tg, 2);
    }
    sfx('arrows', { vol: 0.9 });
  } else if (id === 'rally') {
    const g = genReg(side);
    for (const r of TB.regs) {
      if (r.side !== side || r.gone || r.men <= 0) continue;
      if (r.rout && Math.hypot(r.x - g.x, r.y - g.y) < 420) { r.rout = false; r.boost = TB.t + 18; r.boostAmt = 40; r.tx = r.x; r.ty = r.y; }
      else if (!r.rout) { r.boost = TB.t + 12; r.boostAmt = Math.max(r.boost > TB.t ? r.boostAmt || 0 : 0, 12); }
    }
  } else if (id === 'terror') {
    TB.terror[other] = TB.t + 12;
  }
  const name = t(ABILITIES[id].name);
  TB.fx.push({ x: BF.W / 2, y: BF.H * (mine ? 0.7 : 0.3), text: (mine ? '' : fName(TB.b[side].faction) + ': ') + name + '!', life: 2.2, color: mine ? '#ffe08a' : '#ff9a8a', mid: true });
  sfx(id === 'volley' ? 'arrows' : id === 'terror' || id === 'rally' ? 'army' : 'horn', { vol: 0.8 });
  if (mine) battleFlash(t(ABILITIES[id].desc));
  else battleFlash(t('The enemy general orders: {name}.', { name }));
  renderAbilities();
  return true;
}

// What the manoeuvres do every moment
function abilityStep(r) {
  // Riders in a feigned retreat turn round when it ends and charge whoever chased them
  if (r.feint && TB.t >= r.feint) {
    r.feint = 0;
    const foes = enemiesOf(r), lured = foes.filter(o => o.disorder > TB.t);
    r.target = nearest(r, lured.length ? lured : foes);
    if (r.target) { r.charge = 2.5; r.boost = TB.t + 8; r.boostAmt = 12; if (r.player) r.order = 'attack'; }
    TB.fx.push({ x: r.x, y: r.y - 30, text: t('They turn!'), life: 1.4, color: r.player ? '#ffe08a' : '#ff9a8a' });
  }
  return r.feint > TB.t; // still riding away
}
function abilMorale(r) {
  return (r.boost > TB.t ? r.boostAmt || 12 : 0) - (TB.terror[r.side] > TB.t ? 18 : 0) - (r.disorder > TB.t ? 12 : 0);
}

// The computer's general uses his manoeuvres when the moment is right
function aiAbilities(dt) {
  for (const side of ['att', 'def']) {
    if (side === TB.playerSide) continue;
    const A = TB.abil[side];
    if (!A.list.length) continue;
    A.think -= dt;
    if (A.think > 0) continue;
    A.think = 1 + Math.random();
    const other = side === 'att' ? 'def' : 'att';
    const foes = TB.regs.filter(o => o.side === other && !o.gone && !o.rout && o.men > 0);
    const near = (list, d) => list.some(r => foes.some(o => Math.hypot(o.x - r.x, o.y - r.y) < d));
    for (const id of A.list) {
      if (abilBlock(side, id)) continue;
      let go = false;
      if (id === 'feint') go = near(ownRegs(side, mountedR), 200) && foes.some(o => o.d.cls !== 'missile');
      if (id === 'charge') go = TB.t > 6 && near(ownRegs(side, r => r.d.cls === 'cav'), 320);
      if (id === 'shieldwall') go = ownRegs(side, footR).some(r => foes.some(o => mountedR(o) && Math.hypot(o.x - r.x, o.y - r.y) < 160));
      if (id === 'volley') go = ownRegs(side, shootR).some(r => r.target && !r.target.gone && Math.hypot(r.target.x - r.x, r.target.y - r.y) < RANGE[r.d.cls]);
      if (id === 'rally') go = true;
      if (id === 'terror') go = TB.t > 10 && TB.regs.some(r => r.side === side && !r.gone && inMelee(r));
      if (go && Math.random() < 0.6) { useAbility(side, id); break; }
    }
  }
}

function renderAbilities() {
  const el = $('b-abil');
  if (!el || !TB) return;
  const A = TB.abil && TB.abil[TB.playerSide];
  if (!A || !A.list.length) { el.innerHTML = ''; el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `<div class="ab-gen">${pn(A.g.name)}</div>` + A.list.map((id, i) => {
    const why = abilBlock(TB.playerSide, id), cd = (A.cd[id] || 0) - TB.t, ab = ABILITIES[id];
    const pct = cd > 0 ? Math.round(cd / ab.cd * 100) : 0;
    return `<button class="abil ${why ? 'off' : ''}" data-ab="${id}" title="${t(ab.desc)}${why ? ' — ' + why : ''}"><span class="ab-i">${ab.icon}</span><span class="ab-n">${t(ab.name)}</span>${TB.touch ? '' : `<kbd>${i + 1}</kbd>`}<i style="height:${pct}%"></i></button>`;
  }).join('');
  placeAbilities();
}
// On phones the buttons go wherever there is room: under the battle buttons, or just above the unit cards
function placeAbilities() {
  const el = $('b-abil'), st = el.style;
  st.top = st.bottom = st.left = st.right = st.alignItems = '';
  if (!matchMedia('(max-width: 760px), (max-height: 520px)').matches) return;
  const bb = $('b-buttons').getBoundingClientRect(), cards = $('b-cards').getBoundingClientRect(), h = el.offsetHeight;
  if (bb.bottom + 8 + h < cards.top - 6) { st.top = bb.bottom + 8 + 'px'; st.bottom = 'auto'; st.right = (innerWidth - bb.right) + 'px'; st.left = 'auto'; st.alignItems = 'flex-end'; }
  else st.bottom = (innerHeight - cards.top + 6) + 'px';
}
$('b-abil').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-ab]');
  if (!b || !TB || TB.over) return;
  e.preventDefault();
  if (skipIntro()) return;
  const why = abilBlock(TB.playerSide, b.dataset.ab);
  if (why) { battleFlash(t(ABILITIES[b.dataset.ab].name) + ': ' + why); return; }
  useAbility(TB.playerSide, b.dataset.ab);
});
window.addEventListener('keydown', e => {
  if (!TB || TB.over || $('battle').classList.contains('hidden')) return;
  if (TB.intro > 0) { skipIntro(); return; }
  const n = e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : -1;
  const A = TB.abil && TB.abil[TB.playerSide];
  if (n < 0 || !A || !A.list[n]) return;
  const why = abilBlock(TB.playerSide, A.list[n]);
  if (why) battleFlash(t(ABILITIES[A.list[n]].name) + ': ' + why); else useAbility(TB.playerSide, A.list[n]);
});
