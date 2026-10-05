'use strict';
// The battlefield in 3D (three.js). The simulation in tactical.js stays the same; this file only draws it:
// every regiment becomes a block of individual soldiers on rolling ground under a real sky.
// When three.js or WebGL is unavailable, tactical.js keeps using its 2D drawing.

const B3 = {};

function make3D() {
  if (!window.THREE) return null;
  const T = THREE;
  const small = Math.min(innerWidth, innerHeight) < 700;
  const canvas = document.createElement('canvas');
  canvas.id = 'b3d';
  $('battle').insertBefore(canvas, $('bcanvas'));
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' });
  } catch (e) { canvas.remove(); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const R = { T, renderer, scene, canvas, small, meshes: [], banners: [], rings: [], t: 0 };
  const rnd = mulberry32(TB.b.prov.length * 131 + G.turn);

  // ---------- Light and sky: a spring morning or a golden autumn afternoon ----------
  const autumn = G.turn % 2 === 1;
  const sky = autumn ? { top: '#5d86b8', hor: '#f2c98f', sun: '#ffd8a0', ground: '#6b5a3a' } : { top: '#6f9fd2', hor: '#e6e1cf', sun: '#fff1d8', ground: '#5d6a40' };
  if (TB.terrain === 'desert') sky.hor = '#f0d2a0';
  scene.fog = new T.Fog(sky.hor, 900, 3400);
  const dome = new T.SphereGeometry(5000, 32, 16);
  const topC = new T.Color(sky.top), horC = new T.Color(sky.hor), cols = [];
  for (let i = 0; i < dome.attributes.position.count; i++) {
    const y = dome.attributes.position.getY(i) / 5000;
    const c = horC.clone().lerp(topC, Math.pow(Math.max(0, y), 0.55));
    cols.push(c.r, c.g, c.b);
  }
  dome.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  const skyMesh = new T.Mesh(dome, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
  skyMesh.position.set(BF.W / 2, 0, BF.H / 2);
  scene.add(skyMesh);

  scene.add(new T.HemisphereLight(sky.top, sky.ground, 0.5));
  const sun = new T.DirectionalLight(sky.sun, 1.1);
  sun.position.set(BF.W / 2 + (autumn ? 700 : -700), 900, BF.H / 2 - 500);
  sun.target.position.set(BF.W / 2, 0, BF.H / 2);
  sun.castShadow = !small;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -800, right: 800, top: 650, bottom: -650, near: 200, far: 2600 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  // ---------- Ground ----------
  const wallZ = TB.wallY;
  const hgt = (x, z) => {
    let h = 7 * Math.sin(x * 0.0065 + 1.3) * Math.cos(z * 0.0058) + 4 * Math.sin((x + z) * 0.012) + 2.5 * Math.cos(x * 0.021 - z * 0.017);
    if (wallZ !== null) h *= clampN(Math.abs(z - wallZ) / 140, 0.15, 1);
    return h;
  };
  R.hgt = hgt;
  const fieldGeo = new T.PlaneGeometry(BF.W, BF.H, 120, 80);
  fieldGeo.rotateX(-Math.PI / 2);
  fieldGeo.translate(BF.W / 2, 0, BF.H / 2);
  const fp = fieldGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setY(i, hgt(fp.getX(i), fp.getZ(i)));
  fieldGeo.computeVertexNormals();
  const tex = new T.CanvasTexture(TB.ground);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  // polygonOffset keeps the field drawn over the land beneath it at any distance
  const field = new T.Mesh(fieldGeo, new T.MeshLambertMaterial({ map: tex, color: '#cdc3a4', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  field.receiveShadow = true;
  scene.add(field);
  R.field = field;

  // The land beyond the battlefield, fading into haze
  const base = new T.Color((GROUND[TB.terrain] || GROUND.steppe)[0]);
  const outerGeo = new T.PlaneGeometry(9000, 9000, 140, 140);
  outerGeo.rotateX(-Math.PI / 2);
  outerGeo.translate(BF.W / 2, 0, BF.H / 2);
  const op = outerGeo.attributes.position, ocol = [];
  for (let i = 0; i < op.count; i++) {
    const x = op.getX(i), z = op.getZ(i);
    const dx = Math.max(0, Math.abs(x - BF.W / 2) - BF.W / 2), dz = Math.max(0, Math.abs(z - BF.H / 2) - BF.H / 2), d = Math.hypot(dx, dz);
    op.setY(i, hgt(x, z) - (d > 0 ? 0.8 : 6) + Math.pow(d / 400, 1.6) * 18 * (0.6 + 0.4 * Math.sin(x * 0.004) * Math.cos(z * 0.005)));
    const v = 0.88 + 0.12 * Math.sin(x * 0.013) * Math.cos(z * 0.011);
    ocol.push(base.r * v * 0.85, base.g * v * 0.82, base.b * v * 0.74);
  }
  outerGeo.setAttribute('color', new T.Float32BufferAttribute(ocol, 3));
  outerGeo.computeVertexNormals();
  const outer = new T.Mesh(outerGeo, new T.MeshLambertMaterial({ vertexColors: true }));
  outer.receiveShadow = true;
  scene.add(outer);

  // Distant mountains on the horizon
  const peaks = TB.terrain === 'mountain' ? 46 : TB.terrain === 'desert' ? 16 : 26;
  for (let i = 0; i < peaks; i++) {
    const a = rnd() * Math.PI * 2, dist = 1900 + rnd() * 1300;
    const h = (TB.terrain === 'mountain' ? 380 : 180) + rnd() * (TB.terrain === 'mountain' ? 520 : 300), r = 260 + rnd() * 420;
    const g = new T.ConeGeometry(r, h, 7, 3);
    const c = [];
    for (let k = 0; k < g.attributes.position.count; k++) {
      const y = g.attributes.position.getY(k) / h + 0.5;
      const snow = h > 520 && y > 0.78;
      c.push(...(snow ? [0.92, 0.93, 0.95] : [0.38 + y * 0.12, 0.35 + y * 0.1, 0.3 + y * 0.08]));
    }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    m.position.set(BF.W / 2 + Math.cos(a) * dist, h / 2 - 30, BF.H / 2 + Math.sin(a) * dist);
    m.rotation.y = rnd() * 3;
    scene.add(m);
  }

  // Poplars and rocks around the edges of the field
  const edgeSpot = () => {
    for (;;) {
      const x = -500 + rnd() * (BF.W + 1000), z = -400 + rnd() * (BF.H + 800);
      if (x > 40 && x < BF.W - 40 && z > 20 && z < BF.H - 20) continue;
      return [x, z];
    }
  };
  if (TB.terrain !== 'desert') {
    const n = TB.terrain === 'mountain' ? 40 : 140;
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.6, 0.9, 8, 5).translate(0, 4, 0), new T.MeshLambertMaterial({ color: '#4a3826' }), n);
    const crown = new T.InstancedMesh(new T.ConeGeometry(4.2, 24, 7).translate(0, 18, 0), new T.MeshLambertMaterial({ color: '#ffffff' }), n);
    const d = new T.Object3D();
    for (let i = 0; i < n; i++) {
      const [x, z] = edgeSpot(), s = 0.7 + rnd() * 0.7;
      d.position.set(x, hgt(x, z), z); d.scale.set(s, s * (0.8 + rnd() * 0.5), s); d.rotation.y = rnd() * 6; d.updateMatrix();
      trunk.setMatrixAt(i, d.matrix); crown.setMatrixAt(i, d.matrix);
      crown.setColorAt(i, new T.Color().setHSL(0.2 + rnd() * 0.07, 0.32, 0.3 + rnd() * 0.12));
    }
    trunk.castShadow = crown.castShadow = true;
    scene.add(trunk, crown);
  }
  {
    const n = TB.terrain === 'mountain' || TB.terrain === 'desert' ? 90 : 30;
    const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(5, 0), new T.MeshLambertMaterial({ color: '#8b8170', flatShading: true }), n);
    const d = new T.Object3D();
    for (let i = 0; i < n; i++) {
      const [x, z] = edgeSpot(), s = 0.5 + rnd() * 2;
      d.position.set(x, hgt(x, z) + s, z); d.scale.set(s * (1 + rnd()), s * 0.7, s); d.rotation.set(rnd(), rnd() * 6, rnd()); d.updateMatrix();
      rocks.setMatrixAt(i, d.matrix);
    }
    rocks.castShadow = true; rocks.receiveShadow = true;
    scene.add(rocks);
  }

  // City walls when storming a city
  if (wallZ !== null) buildWalls3D(R, wallZ);

  // ---------- Soldiers ----------
  buildArmies3D(R);

  // Arrows in flight
  R.arrows = new T.InstancedMesh(new T.CylinderGeometry(0.09, 0.09, 5, 3).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: '#2a1d10' }), 600);
  R.arrows.frustumCulled = false;
  scene.add(R.arrows);

  // Dust from charges and the melee
  const puff = document.createElement('canvas'); puff.width = puff.height = 64;
  const px = puff.getContext('2d'), pg = px.createRadialGradient(32, 32, 0, 32, 32, 32);
  pg.addColorStop(0, 'rgba(255,255,255,0.9)'); pg.addColorStop(1, 'rgba(255,255,255,0)');
  px.fillStyle = pg; px.fillRect(0, 0, 64, 64);
  R.dustGeo = new T.BufferGeometry();
  R.dustGeo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(400 * 3), 3));
  const dust = new T.Points(R.dustGeo, new T.PointsMaterial({ size: 34, map: new T.CanvasTexture(puff), transparent: true, opacity: 0.32, depthWrite: false, color: TB.terrain === 'desert' ? '#e8d3a8' : '#cdbb98' }));
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------- Camera ----------
  R.camera = new T.PerspectiveCamera(42, innerWidth / innerHeight, 8, 12000);
  R.cam = { tx: BF.W / 2, tz: BF.H * 0.6, dist: small ? 900 : 700, yaw: 0, pitch: 0.68 };
  R.keys = {};
  R.raycaster = new T.Raycaster();
  resize3D(R);
  return R;
}

// ---------- Geometry helpers ----------

function colored(g, hex) {
  const T = THREE, c = new T.Color(hex);
  g = g.index ? g.toNonIndexed() : g;
  const a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new T.BufferAttribute(a, 3));
  return g;
}
function merge(list) {
  const T = THREE;
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (let g of list) {
    g = g.index ? g.toNonIndexed() : g;
    pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o);
    if (g.attributes.color) col.set(g.attributes.color.array, o); else col.fill(1, o, o + g.attributes.position.count * 3);
    o += g.attributes.position.count * 3;
  }
  const m = new T.BufferGeometry();
  m.setAttribute('position', new T.BufferAttribute(pos, 3));
  m.setAttribute('normal', new T.BufferAttribute(nor, 3));
  m.setAttribute('color', new T.BufferAttribute(col, 3));
  return m;
}

// Each soldier is two meshes: fixed-colour parts (skin, steel, wood, leather) and parts in the nation's colour.
// Local forward is +x, up is +y. Sizes are roughly in metres times 2.
function soldierGeos(kind) {
  const T = THREE;
  const skin = '#d1a67c', steel = '#9ea2a6', wood = '#5c3f22', leather = '#3d3127', boot = '#2c241c';
  const head = (x, y) => colored(new T.SphereGeometry(0.72, 7, 6).translate(x, y, 0), skin);
  const helmet = (x, y) => merge([colored(new T.ConeGeometry(0.84, 1.6, 7).translate(x, y, 0), steel), colored(new T.CylinderGeometry(0.86, 0.86, 0.3, 7).translate(x, y - 0.75, 0), leather)]);
  if (kind === 'cav' || kind === 'ha' || kind === 'general') {
    const horse = merge([
      colored(new T.BoxGeometry(6.2, 2.5, 2).translate(0, 4.7, 0), '#ffffff'),
      colored(new T.BoxGeometry(2.8, 1.2, 1.1).rotateZ(0.9).translate(3.6, 6.3, 0), '#ffffff'),
      colored(new T.BoxGeometry(2.1, 0.9, 0.9).rotateZ(-0.35).translate(4.8, 7.2, 0), '#ffffff'),
      ...[[2.3, 0.65], [2.3, -0.65], [-2.3, 0.65], [-2.3, -0.65]].map(([x, z]) => colored(new T.BoxGeometry(0.5, 3.6, 0.5).translate(x, 1.8, z), '#ffffff')),
      colored(new T.BoxGeometry(0.4, 2.6, 0.35).rotateZ(-0.5).translate(-3.6, 4.4, 0), '#ffffff'),
    ]);
    const fixed = [
      colored(new T.BoxGeometry(1.4, 0.25, 2.2).translate(-0.2, 6.05, 0), '#7a2a1a'), // saddle cloth
      colored(new T.BoxGeometry(0.5, 2.4, 0.5).translate(0.1, 5.3, 1.1), boot), colored(new T.BoxGeometry(0.5, 2.4, 0.5).translate(0.1, 5.3, -1.1), boot),
      head(-0.1, 9.65), helmet(-0.1, 10.55),
    ];
    if (kind === 'cav') fixed.push(colored(new T.CylinderGeometry(0.11, 0.11, 15, 4).rotateZ(-1.15).translate(3, 8.6, 0.9), wood), colored(new T.ConeGeometry(0.3, 1.2, 4).rotateZ(-1.15).translate(9.9, 11.6, 0.9), steel));
    if (kind === 'ha') fixed.push(colored(new T.TorusGeometry(1.7, 0.1, 4, 10, Math.PI).rotateZ(-Math.PI / 2).translate(0.9, 8, 0.9), wood), colored(new T.CylinderGeometry(0.4, 0.4, 2.2, 5).rotateX(0.3).translate(-1, 7.8, -1.1), leather));
    if (kind === 'general') fixed.push(colored(new T.CylinderGeometry(0.12, 0.12, 9, 4).translate(-0.8, 12.5, -1), wood), colored(new T.BoxGeometry(0.15, 3, 3.8).translate(-0.8, 15.2, -2.9), '#d8b45a'));
    const tunic = merge([colored(new T.CylinderGeometry(0.8, 1.15, 3.1, 7).translate(-0.2, 7.6, 0), '#ffffff')]);
    return { horse, fixed: merge(fixed), tunic };
  }
  const fixed = [
    colored(new T.BoxGeometry(0.5, 3.1, 0.55).translate(0, 1.55, 0.42), boot), colored(new T.BoxGeometry(0.5, 3.1, 0.55).translate(0, 1.55, -0.42), boot),
    head(0.05, 6.95), helmet(0.05, 7.9),
  ];
  if (kind === 'spear' || kind === 'inf') fixed.push(merge([colored(new T.CylinderGeometry(1.4, 1.4, 0.3, 10).rotateZ(Math.PI / 2).translate(0.85, 4.5, -0.95), kind === 'inf' ? '#8c7650' : '#6e4a2a'), colored(new T.SphereGeometry(0.35, 5, 4).translate(1.02, 4.5, -0.95), steel)]));
  if (kind === 'spear') fixed.push(colored(new T.CylinderGeometry(0.11, 0.11, 13, 4).rotateZ(-0.22).translate(0.95, 6.9, 0.95), wood), colored(new T.ConeGeometry(0.28, 1.1, 4).rotateZ(-0.22).translate(2.45, 13.2, 0.95), steel));
  if (kind === 'inf') fixed.push(colored(new T.BoxGeometry(0.18, 2.8, 0.35).rotateZ(-0.5).translate(1.4, 4.9, 0.95), steel));
  if (kind === 'missile') fixed.push(colored(new T.TorusGeometry(1.8, 0.1, 4, 10, Math.PI).rotateZ(-Math.PI / 2).translate(1, 4.9, 0.7), wood), colored(new T.CylinderGeometry(0.4, 0.4, 2.4, 5).rotateX(0.25).translate(-0.7, 5, -0.8), leather));
  if (kind === 'siege') fixed.push(colored(new T.BoxGeometry(0.2, 3.2, 0.2).translate(0.8, 4, 0.9), wood), colored(new T.BoxGeometry(1.4, 0.6, 0.4).translate(0.8, 5.6, 0.9), steel));
  const tunic = merge([colored(new T.CylinderGeometry(0.88, 1.28, 3.5, 7).translate(0, 4.65, 0), '#ffffff'), colored(new T.BoxGeometry(1.6, 0.3, 2.3).translate(0, 3.1, 0), '#ffffff')]);
  return { fixed: merge(fixed), tunic };
}

function buildArmies3D(R) {
  const T = THREE;
  const kindOf = r => r.u.type === 'general' ? 'general' : r.d.cls;
  const need = {};
  for (const r of TB.regs) {
    r.per = (r.d.cls === 'cav' || r.d.cls === 'ha') ? 3 : 4;
    const k = kindOf(r);
    need[k] = (need[k] || 0) + Math.ceil(r.max / r.per);
  }
  const fixedMat = new T.MeshLambertMaterial({ vertexColors: true });
  // Meshes tinted per soldier each get their own material and a colour buffer from the start
  // (three.js r128 cannot share one material between tinted and untinted instanced meshes)
  const tinted = (geo, cap) => {
    const m = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: '#ffffff' }), cap);
    m.setColorAt(0, new T.Color('#ffffff'));
    return m;
  };
  R.pools = {};
  for (const k in need) {
    const g = soldierGeos(k), cap = need[k];
    const pool = { cap, used: 0, fixed: new T.InstancedMesh(g.fixed, fixedMat, cap), tunic: tinted(g.tunic, cap) };
    if (g.horse) pool.horse = tinted(g.horse, cap);
    for (const m of [pool.fixed, pool.tunic, pool.horse]) if (m) { m.castShadow = true; m.frustumCulled = false; R.scene.add(m); }
    R.pools[k] = pool;
  }
  // The fallen: bodies (and horses) left lying on the field
  const infG = soldierGeos('inf');
  const cavG = soldierGeos('cav');
  R.deadCap = 1400;
  R.deadUsed = 0;
  R.dead = { fixed: new T.InstancedMesh(infG.fixed, fixedMat, R.deadCap), tunic: tinted(infG.tunic, R.deadCap) };
  R.deadHorse = tinted(cavG.horse, 400);
  R.deadHorseUsed = 0;
  for (const m of [R.dead.fixed, R.dead.tunic, R.deadHorse]) { m.count = 0; m.frustumCulled = false; m.receiveShadow = true; R.scene.add(m); }

  // Each soldier is a figure that walks to its place in the formation
  const d = new T.Object3D();
  for (const r of TB.regs) {
    const k = kindOf(r), pool = R.pools[k];
    r.kind3 = k;
    r.figs = [];
    const n = Math.ceil(r.max / r.per);
    for (let i = 0; i < n; i++) {
      const s = slotOf(r, i, n);
      r.figs.push({ slot: pool.used++, i, x: s.x, z: s.z, face: r.face, ph: Math.random() * 6.28, jx: (Math.random() - 0.5) * 1.6, jz: (Math.random() - 0.5) * 1.6, alive: true });
    }
    const col = new T.Color(r.u.type === 'general' ? '#d9b04a' : FACTIONS[r.faction].color);
    for (const f of r.figs) {
      pool.tunic.setColorAt(f.slot, col.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.06));
      if (pool.horse) pool.horse.setColorAt(f.slot, new T.Color().setHSL(0.07 + Math.random() * 0.03, 0.45 + Math.random() * 0.2, 0.16 + Math.random() * 0.22));
    }
    // Banner on a pole, carried at the back of the regiment
    const flag = bannerTexture(r.faction);
    const grp = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 26, 5).translate(0, 13, 0), new T.MeshLambertMaterial({ color: '#4a3016' }));
    const bar = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 9, 4).rotateZ(Math.PI / 2).translate(4.5, 25, 0), pole.material);
    const cloth = new T.Mesh(new T.PlaneGeometry(9, 12).translate(4.5, 18.8, 0), new T.MeshLambertMaterial({ map: flag, side: T.DoubleSide, transparent: true, alphaTest: 0.3 }));
    const knob = new T.Mesh(new T.SphereGeometry(0.7, 6, 5).translate(0, 26.5, 0), new T.MeshLambertMaterial({ color: '#e1b54c' }));
    pole.castShadow = cloth.castShadow = true;
    grp.add(pole, bar, cloth, knob);
    R.scene.add(grp);
    r.banner = grp;
    r.cloth = cloth;
    // Selection ring
    const ring = new T.Mesh(new T.RingGeometry(r.r + 1, r.r + 2.6, 48).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.6, depthTest: false }));
    ring.renderOrder = 5; ring.visible = false;
    R.scene.add(ring);
    r.ring = ring;
  }
  d.scale.set(0, 0, 0); d.updateMatrix();
  for (const k in R.pools) for (const m of ['fixed', 'tunic', 'horse']) if (R.pools[k][m]) for (let i = 0; i < R.pools[k].cap; i++) R.pools[k][m].setMatrixAt(i, d.matrix);
}

const bannerCache = {};
function bannerTexture(f) {
  if (bannerCache[f]) return bannerCache[f];
  const T = THREE, c = document.createElement('canvas');
  c.width = 96; c.height = 128;
  const tex = new T.CanvasTexture(c);
  const img = new Image();
  img.onload = () => { c.getContext('2d').drawImage(img, 0, 0, 96, 128); tex.needsUpdate = true; };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(flagSVG(f).replace('<svg ', '<svg width="96" height="128" preserveAspectRatio="none" '));
  bannerCache[f] = tex;
  return tex;
}

// Where figure i of n stands, relative to the regiment's centre and facing
function slotOf(r, i, n) {
  const mounted = r.d.cls === 'cav' || r.d.cls === 'ha';
  const cols = mounted ? 6 : 10, sp = mounted ? 11 : 6.6;
  const rows = Math.ceil(n / cols);
  const col = i % cols, row = Math.floor(i / cols);
  const lx = (col - (Math.min(cols, n) - 1) / 2) * sp, ly = (rows - 1) / 2 * sp - row * sp; // row 0 is the front
  const fx = Math.cos(r.face), fz = Math.sin(r.face);
  return { x: r.x + fx * ly - fz * lx, z: r.y + fz * ly + fx * lx, row };
}

function buildWalls3D(R, wz) {
  const T = THREE;
  const inside = TB.playerSide === 'def' ? 1 : -1;
  const mat = new T.MeshLambertMaterial({ color: '#cdb084' });
  const dark = new T.MeshLambertMaterial({ color: '#8f7654' });
  const gap = TB.breach ? 130 : 0;
  const seg = (x0, x1) => {
    if (x1 - x0 < 2) return;
    const m = new T.Mesh(new T.BoxGeometry(x1 - x0, 15, 8), mat);
    m.position.set((x0 + x1) / 2, 7.5 + R.hgt((x0 + x1) / 2, wz), wz + inside * 6);
    m.castShadow = m.receiveShadow = true;
    R.scene.add(m);
    const n = Math.floor((x1 - x0) / 7);
    const cren = new T.InstancedMesh(new T.BoxGeometry(3.6, 3, 8.4), mat, n);
    const d = new T.Object3D();
    for (let i = 0; i < n; i++) { d.position.set(x0 + 3.5 + i * 7, 16.5 + R.hgt(x0, wz), wz + inside * 6); d.updateMatrix(); cren.setMatrixAt(i, d.matrix); }
    cren.castShadow = true;
    R.scene.add(cren);
  };
  seg(-300, BF.W / 2 - gap / 2 - (gap ? 0 : 26));
  seg(BF.W / 2 + gap / 2 + (gap ? 0 : 26), BF.W + 300);
  for (let x = -140; x < BF.W + 300; x += 200) {
    if (Math.abs(x - BF.W / 2) < 90) continue;
    const t = new T.Mesh(new T.CylinderGeometry(13, 15, 26, 12), mat);
    t.position.set(x, 13 + R.hgt(x, wz), wz + inside * 6);
    t.castShadow = t.receiveShadow = true;
    R.scene.add(t);
    const top = new T.Mesh(new T.CylinderGeometry(15, 15, 3, 12), dark);
    top.position.set(x, 27.5 + R.hgt(x, wz), wz + inside * 6);
    R.scene.add(top);
  }
  if (!gap) {
    // The gatehouse, with a tiled portal
    const g = new T.Mesh(new T.BoxGeometry(56, 30, 14), mat);
    g.position.set(BF.W / 2, 15 + R.hgt(BF.W / 2, wz), wz + inside * 6);
    g.castShadow = true;
    const door = new T.Mesh(new T.BoxGeometry(22, 18, 15), new T.MeshLambertMaterial({ color: '#3a2716' }));
    door.position.set(BF.W / 2, 9 + R.hgt(BF.W / 2, wz), wz + inside * 6);
    const tile = new T.Mesh(new T.BoxGeometry(58, 3, 15), new T.MeshLambertMaterial({ color: '#2a8f8a' }));
    tile.position.set(BF.W / 2, 29 + R.hgt(BF.W / 2, wz), wz + inside * 6);
    R.scene.add(g, door, tile);
  } else {
    const rubble = new T.InstancedMesh(new T.DodecahedronGeometry(4, 0), mat, 26);
    const d = new T.Object3D();
    for (let i = 0; i < 26; i++) { d.position.set(BF.W / 2 - 65 + Math.random() * 130, R.hgt(BF.W / 2, wz) + Math.random() * 3, wz + (Math.random() - 0.5) * 30); d.rotation.set(Math.random(), Math.random(), 0); d.scale.setScalar(0.6 + Math.random()); d.updateMatrix(); rubble.setMatrixAt(i, d.matrix); }
    rubble.castShadow = true;
    R.scene.add(rubble);
  }
}

// ---------- Per frame ----------

function resize3D(R) {
  R.renderer.setSize(innerWidth, innerHeight, false);
  R.camera.aspect = innerWidth / innerHeight;
  R.camera.updateProjectionMatrix();
}

function updateCamera3D(R, dt) {
  const c = R.cam, k = R.keys, sp = c.dist * 0.9 * dt;
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw); // forward on the ground
  if (k.KeyW || k.ArrowUp) { c.tx += fx * sp; c.tz += fz * sp; }
  if (k.KeyS || k.ArrowDown) { c.tx -= fx * sp; c.tz -= fz * sp; }
  if (k.KeyA || k.ArrowLeft) { c.tx += fz * sp; c.tz -= fx * sp; }
  if (k.KeyD || k.ArrowRight) { c.tx -= fz * sp; c.tz += fx * sp; }
  if (k.KeyQ) c.yaw += dt * 1.2;
  if (k.KeyE) c.yaw -= dt * 1.2;
  if (k.KeyR || k.Equal) c.dist = Math.max(160, c.dist - c.dist * dt * 1.2);
  if (k.KeyF || k.Minus) c.dist = Math.min(1700, c.dist + c.dist * dt * 1.2);
  c.tx = clampN(c.tx, -200, BF.W + 200); c.tz = clampN(c.tz, -200, BF.H + 200);
  c.pitch = clampN(0.38 + (c.dist - 160) / 1540 * 0.55, 0.38, 0.95);
  const cp = Math.cos(c.pitch);
  const th = R.hgt(c.tx, c.tz);
  R.camera.position.set(c.tx + Math.sin(c.yaw) * c.dist * cp, th + c.dist * Math.sin(c.pitch), c.tz + Math.cos(c.yaw) * c.dist * cp);
  R.camera.lookAt(c.tx, th, c.tz);
}

function render3D(R, dt) {
  const T = THREE, t = TB.t;
  R.t += dt;
  updateCamera3D(R, dt);
  const d = new T.Object3D();
  const zero = new T.Matrix4().makeScale(0, 0, 0);
  for (const r of TB.regs) {
    const pool = R.pools[r.kind3];
    const mounted = !!pool.horse;
    // Soldiers die one by one, from the front rank back
    const want = r.gone && r.men > 0 ? 0 : Math.max(0, Math.ceil(r.men / r.per - 0.25));
    let alive = r.figs.filter(f => f.alive);
    if (alive.length > want) {
      const escaped = r.gone && r.men > 0;
      const fx = Math.cos(r.face), fz = Math.sin(r.face);
      alive.sort((a, b) => (b.x * fx + b.z * fz) - (a.x * fx + a.z * fz));
      for (const f of alive.slice(0, alive.length - want)) {
        f.alive = false;
        if (!escaped) addCorpse3D(R, f, r, mounted);
      }
      alive = alive.slice(alive.length - want);
    }
    const fight = !r.rout && inMelee(r);
    // The survivors close ranks: rear soldiers step forward into the gaps
    alive.sort((a, b) => a.i - b.i);
    alive.forEach((f, j) => { f.j = j; });
    const n = alive.length;
    const speed = SPEED[r.d.cls] * (r.run ? 1.6 : 1.3) * (r.rout ? 1.4 : 1);
    for (const f of r.figs) {
      if (!f.alive) continue;
      const s = slotOf(r, f.j, n);
      let tx = s.x + f.jx, tz = s.z + f.jz;
      if (r.rout) { tx += Math.sin(f.ph * 3 + t) * 14; tz += Math.cos(f.ph * 5 + t) * 14; }
      const dx = tx - f.x, dz = tz - f.z, dist = Math.hypot(dx, dz);
      const step = Math.min(dist, (speed + dist * 1.5) * dt);
      if (dist > 0.3) { f.x += dx / dist * step; f.z += dz / dist * step; }
      const walking = dist > 1.2 || r.moving;
      const targetFace = dist > 4 && !fight ? Math.atan2(dz, dx) : r.rout ? r.face : r.face;
      f.face += ((targetFace - f.face + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 6);
      let ox = 0, oz = 0, bob = 0, tilt = 0;
      if (walking) bob = Math.abs(Math.sin(R.t * (mounted ? 11 : 8) + f.ph)) * (mounted ? 1.1 : 0.55);
      if (walking && mounted) tilt = Math.sin(R.t * 11 + f.ph) * 0.06;
      if (fight && s.row < 2) { const l = Math.sin(R.t * 7 + f.ph) * 1.3; ox = Math.cos(f.face) * l; oz = Math.sin(f.face) * l; tilt = Math.sin(R.t * 7 + f.ph) * 0.08; }
      d.position.set(f.x + ox, R.hgt(f.x, f.z) + bob, f.z + oz);
      d.rotation.set(0, -f.face, tilt);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      pool.fixed.setMatrixAt(f.slot, d.matrix);
      pool.tunic.setMatrixAt(f.slot, d.matrix);
      if (pool.horse) pool.horse.setMatrixAt(f.slot, d.matrix);
    }
    for (const f of r.figs) if (!f.alive) { pool.fixed.setMatrixAt(f.slot, zero); pool.tunic.setMatrixAt(f.slot, zero); if (pool.horse) pool.horse.setMatrixAt(f.slot, zero); }
    // Banner follows the regiment; hidden once it has fled or died
    const show = !r.gone && alive.length > 0;
    r.banner.visible = show;
    if (show) {
      const bxp = r.x - Math.cos(r.face) * 8, bzp = r.y - Math.sin(r.face) * 8;
      r.banner.position.set(bxp, R.hgt(bxp, bzp) + (mounted ? 4 : 0), bzp);
      r.banner.rotation.y = Math.atan2(R.camera.position.x - bxp, R.camera.position.z - bzp) + 0.45;
      r.cloth.rotation.y = Math.sin(R.t * 2 + r.id) * 0.25;
    }
    r.ring.visible = show && (TB.sel.has(r.id) || (!r.player && [...TB.sel].some(id => TB.regs[id].target === r)));
    if (r.ring.visible) {
      r.ring.material.color.set(r.player ? '#ffe08a' : '#ff7a5a');
      r.ring.position.set(r.x, R.hgt(r.x, r.y) + 1.5, r.y);
    }
  }
  for (const k in R.pools) { const p = R.pools[k]; p.fixed.instanceMatrix.needsUpdate = p.tunic.instanceMatrix.needsUpdate = true; if (p.horse) p.horse.instanceMatrix.needsUpdate = true; }
  // Arrows on their arcs
  let ai = 0;
  for (const a of TB.arrows) {
    if (ai >= 600) break;
    const k = 1 - a.life / a.max, k2 = Math.min(1, k + 0.03);
    const L = Math.hypot(a.x1 - a.x0, a.y1 - a.y0), arc = 20 + L * 0.28;
    const p = (q) => [a.x0 + (a.x1 - a.x0) * q, R.hgt(a.x0, a.y0) * (1 - q) + R.hgt(a.x1, a.y1) * q + 6 + Math.sin(q * Math.PI) * arc, a.y0 + (a.y1 - a.y0) * q];
    const [x, y, z] = p(k), [x2, y2, z2] = p(k2);
    d.position.set(x, y, z); d.scale.set(1, 1, 1); d.rotation.set(0, 0, 0); d.lookAt(x2, y2, z2); d.updateMatrix();
    R.arrows.setMatrixAt(ai++, d.matrix);
  }
  R.arrows.count = ai;
  R.arrows.instanceMatrix.needsUpdate = true;
  // Dust
  const pos = R.dustGeo.attributes.position.array;
  let di = 0;
  for (const p of TB.dust) { if (di >= 400) break; pos[di * 3] = p.x; pos[di * 3 + 1] = R.hgt(p.x, p.y) + 3 + (1 - p.life) * 8; pos[di * 3 + 2] = p.y; di++; }
  R.dustGeo.setDrawRange(0, di);
  R.dustGeo.attributes.position.needsUpdate = true;
  R.renderer.render(R.scene, R.camera);
}

function addCorpse3D(R, f, r, mounted) {
  const T = THREE, d = new T.Object3D();
  const col = new T.Color(r.u.type === 'general' ? '#d9b04a' : FACTIONS[r.faction].color).multiplyScalar(0.75);
  const side = Math.random() < 0.5 ? 1 : -1;
  if (mounted && R.deadHorseUsed < 400) {
    d.position.set(f.x, R.hgt(f.x, f.z) + 1, f.z);
    d.rotation.set(side * Math.PI / 2, -f.face + (Math.random() - 0.5), 0);
    d.updateMatrix();
    R.deadHorse.setMatrixAt(R.deadHorseUsed, d.matrix);
    R.deadHorse.setColorAt(R.deadHorseUsed, new T.Color().setHSL(0.07, 0.45, 0.2));
    R.deadHorseUsed++;
    R.deadHorse.count = R.deadHorseUsed;
    R.deadHorse.instanceMatrix.needsUpdate = true;
    if (R.deadHorse.instanceColor) R.deadHorse.instanceColor.needsUpdate = true;
  }
  const i = R.deadUsed % R.deadCap;
  R.deadUsed++;
  d.position.set(f.x + (mounted ? 4 : 0), R.hgt(f.x, f.z) + 1.1, f.z);
  d.rotation.set(side * Math.PI / 2, Math.random() * 6.28, 0);
  d.updateMatrix();
  R.dead.fixed.setMatrixAt(i, d.matrix);
  R.dead.tunic.setMatrixAt(i, d.matrix);
  R.dead.tunic.setColorAt(i, col);
  R.dead.fixed.count = R.dead.tunic.count = Math.min(R.deadUsed, R.deadCap);
  R.dead.fixed.instanceMatrix.needsUpdate = R.dead.tunic.instanceMatrix.needsUpdate = true;
  if (R.dead.tunic.instanceColor) R.dead.tunic.instanceColor.needsUpdate = true;
}

// Screen <-> battlefield
function screenToField3D(R, sx, sy) {
  const T = THREE;
  const v = new T.Vector2(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
  R.raycaster.setFromCamera(v, R.camera);
  const hit = R.raycaster.intersectObject(R.field)[0];
  if (hit) return { x: hit.point.x, y: hit.point.z };
  const plane = new T.Plane(new T.Vector3(0, 1, 0), 0), p = new T.Vector3();
  R.raycaster.ray.intersectPlane(plane, p);
  return { x: p.x, y: p.z };
}
function fieldToScreen3D(R, x, y, up = 6) {
  const v = new THREE.Vector3(x, R.hgt(x, y) + up, y).project(R.camera);
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, behind: v.z > 1 };
}

function dispose3D(R) {
  R.scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map && !Object.values(bannerCache).includes(m.map)) m.map.dispose(); m.dispose(); } }
  });
  R.renderer.dispose();
  R.canvas.remove();
}
