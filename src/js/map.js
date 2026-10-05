'use strict';

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const tidx = (x, y) => y * MAP_W + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
const tileOf = v => clamp(Math.floor(v / TILE), 0, MAP_W - 1);

// Smooth value noise over the whole map, `cells` controls feature size.
function makeNoise(rng, cells) {
  const g = cells + 2, v = new Float32Array(g * g);
  for (let i = 0; i < v.length; i++) v[i] = rng();
  return (x, y) => {
    const fx = x / MAP_W * cells, fy = y / MAP_H * cells;
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = v[iy * g + ix], b = v[iy * g + ix + 1], c = v[(iy + 1) * g + ix], d = v[(iy + 1) * g + ix + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

// ---------- Pathfinding (A* on the tile grid) ----------

const PF = {
  g: new Float32Array(MAP_N), f: new Float32Array(MAP_N), from: new Int32Array(MAP_N),
  mark: new Uint32Array(MAP_N), closed: new Uint32Array(MAP_N), gen: 0, heap: [],
};
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

function heapPush(h, f, v) {
  let i = h.length; h.push(v);
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (f[h[p]] <= f[v]) break;
    h[i] = h[p]; i = p;
  }
  h[i] = v;
}

function heapPop(h, f) {
  const top = h[0], last = h.pop(), n = h.length;
  if (n) {
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && f[h[c + 1]] < f[h[c]]) c++;
      if (f[h[c]] >= f[last]) break;
      h[i] = h[c]; i = c;
    }
    h[i] = last;
  }
  return top;
}

// goal: { x, y, w, h, adj } in tiles. With `adj` the path ends on any free tile touching the rectangle,
// otherwise on the tile (x, y) itself. Returns pixel waypoints; `path.ok` is false when the goal was unreachable
// and the path only leads to the closest reachable tile.
function findPath(sx, sy, goal) {
  const gx0 = goal.x, gy0 = goal.y, gx1 = goal.x + (goal.w || 1) - 1, gy1 = goal.y + (goal.h || 1) - 1, adj = !!goal.adj;
  const hfn = (x, y) => {
    let dx = x < gx0 ? gx0 - x : x > gx1 ? x - gx1 : 0, dy = y < gy0 ? gy0 - y : y > gy1 ? y - gy1 : 0;
    if (adj) { dx = Math.max(0, dx - 1); dy = Math.max(0, dy - 1); }
    return dx + dy - 0.5858 * Math.min(dx, dy);
  };
  const isGoal = (x, y) => {
    const dx = x < gx0 ? gx0 - x : x > gx1 ? x - gx1 : 0, dy = y < gy0 ? gy0 - y : y > gy1 ? y - gy1 : 0;
    return adj ? (dx <= 1 && dy <= 1 && dx + dy > 0) : (dx === 0 && dy === 0);
  };
  const path = [];
  path.ok = true;
  if (isGoal(sx, sy)) return path;

  const gen = ++PF.gen, g = PF.g, f = PF.f, from = PF.from, mark = PF.mark, closed = PF.closed, heap = PF.heap;
  const blocked = W.blocked;
  heap.length = 0;
  const s = tidx(sx, sy);
  g[s] = 0; f[s] = hfn(sx, sy); from[s] = -1; mark[s] = gen;
  heapPush(heap, f, s);
  let best = s, bestH = f[s], found = -1;
  while (heap.length) {
    const c = heapPop(heap, f);
    if (closed[c] === gen) continue;
    closed[c] = gen;
    const cx = c % MAP_W, cy = (c / MAP_W) | 0;
    if (isGoal(cx, cy)) { found = c; break; }
    const h = f[c] - g[c];
    if (h < bestH) { bestH = h; best = c; }
    for (let k = 0; k < 8; k++) {
      const ox = DIRS[k][0], oy = DIRS[k][1];
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const n = ny * MAP_W + nx;
      if (blocked[n] || closed[n] === gen) continue;
      if (ox && oy && (blocked[cy * MAP_W + nx] || blocked[ny * MAP_W + cx])) continue;
      const ng = g[c] + DIRS[k][2];
      if (mark[n] !== gen || ng < g[n]) {
        g[n] = ng; f[n] = ng + hfn(nx, ny); from[n] = c; mark[n] = gen;
        heapPush(heap, f, n);
      }
    }
  }
  let end = found >= 0 ? found : best;
  while (end !== s && end !== -1) {
    path.push({ x: (end % MAP_W + 0.5) * TILE, y: (((end / MAP_W) | 0) + 0.5) * TILE });
    end = from[end];
  }
  path.reverse();
  path.ok = found >= 0;
  return path;
}

function nearestFree(tx, ty, maxR = 16) {
  tx = clamp(tx, 0, MAP_W - 1); ty = clamp(ty, 0, MAP_H - 1);
  if (!W.blocked[tidx(tx, ty)]) return { x: tx, y: ty };
  for (let r = 1; r <= maxR; r++) {
    let best = null, bd = 1e9;
    for (let y = ty - r; y <= ty + r; y++) {
      for (let x = tx - r; x <= tx + r; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r || !inMap(x, y) || W.blocked[tidx(x, y)]) continue;
        const d = (x - tx) * (x - tx) + (y - ty) * (y - ty);
        if (d < bd) { bd = d; best = { x, y }; }
      }
    }
    if (best) return best;
  }
  return null;
}

// n distinct free tiles spreading out from (tx, ty), used to give each unit in a group its own destination.
function groupTiles(n, tx, ty) {
  const s = nearestFree(tx, ty);
  if (!s) return [];
  const out = [s], seen = new Set([tidx(s.x, s.y)]);
  for (let i = 0; i < out.length && out.length < n; i++) {
    const c = out[i];
    for (const [ox, oy] of DIRS) {
      const x = c.x + ox, y = c.y + oy;
      if (!inMap(x, y)) continue;
      const k = tidx(x, y);
      if (seen.has(k) || W.blocked[k]) continue;
      seen.add(k); out.push({ x, y });
      if (out.length >= n) break;
    }
  }
  return out;
}

// ---------- Map generation ----------
// The map is point-symmetric: the player starts bottom-left, the rival top-right, and a river with three
// fords runs along the diagonal between them. The Grand Bazaar sits on the central ford.
function generateMap(seed) {
  const PB = { x: 11, y: 68 }, EB = { x: MAP_W - 1 - 11, y: MAP_H - 1 - 68 };
  const CX = (MAP_W - 1) / 2, CY = (MAP_H - 1) / 2;
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);
    const n1 = makeNoise(rng, 6), n2 = makeNoise(rng, 9), n3 = makeNoise(rng, 10);
    const base = (x, y) => {
      const d = y - x, s = x + y - (MAP_W - 1);
      const cdist = Math.hypot(x - CX, y - CY), bdist = Math.hypot(x - PB.x, y - PB.y);
      if (cdist < 6) return T_SAND;
      const off = d - (Math.sin(s * 0.09) * 5 + Math.sin(s * 0.23) * 2);
      if (Math.abs(off) <= 1.7) return Math.abs(Math.abs(s) - 44) <= 2 ? T_SAND : T_WATER;
      if (bdist < 8) return T_GRASS;
      if (n2(x, y) > 0.74 && bdist > 12 && cdist > 10 && Math.abs(off) > 3) return T_MOUNTAIN;
      return n1(x, y) > 0.56 ? T_SAND : T_GRASS;
    };
    const terrain = new Uint8Array(MAP_N);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const own = y > x || (y === x && x < MAP_W / 2);
        terrain[tidx(x, y)] = own ? base(x, y) : base(MAP_W - 1 - x, MAP_H - 1 - y);
      }
    }

    const nodes = [], used = new Uint8Array(MAP_N);
    const add = (type, x, y) => {
      x = Math.round(x); y = Math.round(y);
      if (!inMap(x, y) || y - x < 4) return false;
      const i = tidx(x, y);
      if (used[i] || terrain[i] > T_SAND) return false;
      if (Math.hypot(x - PB.x, y - PB.y) < 4 || Math.hypot(x - CX, y - CY) < 7) return false;
      const mx = MAP_W - 1 - x, my = MAP_H - 1 - y;
      used[i] = 1; used[tidx(mx, my)] = 1;
      nodes.push({ type, x, y }, { type, x: mx, y: my });
      return true;
    };
    const cluster = (type, cx, cy, count, spread) => {
      for (let t = 0, placed = 0; t < count * 14 && placed < count; t++) {
        if (add(type, cx + (rng() * 2 - 1) * spread, cy + (rng() * 2 - 1) * spread)) placed++;
      }
    };
    const a0 = rng() * Math.PI * 2;
    const ring = (a, r) => [PB.x + Math.cos(a0 + a) * r, PB.y + Math.sin(a0 + a) * r];
    cluster('berry', ...ring(0, 5.5), 6, 1.5);
    cluster('tree', ...ring(1.6, 8), 16, 2.5);
    cluster('stone', ...ring(2.5, 9.5), 4, 1.3);
    cluster('gold', ...ring(3.3, 8), 4, 1.3);
    cluster('tree', ...ring(4.7, 8.5), 12, 2.2);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (terrain[tidx(x, y)] === T_GRASS && n3(x, y) > 0.68 && rng() < 0.7 && Math.hypot(x - PB.x, y - PB.y) > 10) add('tree', x, y);
      }
    }
    const far = () => {
      for (let t = 0; t < 50; t++) {
        const x = rng() * MAP_W, y = rng() * MAP_H;
        if (y - x >= 6 && Math.hypot(x - PB.x, y - PB.y) > 15) return [x, y];
      }
      return [PB.x + 16, PB.y - 4];
    };
    for (let k = 0; k < 5; k++) cluster('gold', ...far(), 3, 1.2);
    for (let k = 0; k < 5; k++) cluster('stone', ...far(), 3, 1.2);
    for (let k = 0; k < 4; k++) cluster('berry', ...far(), 4, 1.3);

    const blocked = new Uint8Array(MAP_N);
    for (let i = 0; i < MAP_N; i++) blocked[i] = terrain[i] > T_SAND || used[i] ? 1 : 0;
    W.terrain = terrain; W.blocked = blocked;
    if (!findPath(PB.x, PB.y, { x: EB.x, y: EB.y }).ok) continue;
    if (!findPath(PB.x, PB.y, { x: 38, y: 38, w: 4, h: 4, adj: true }).ok) continue;

    W.bases = [PB, EB];
    for (const n of nodes) {
      const def = NODES[n.type];
      const node = {
        id: W.nextId++, kind: 'node', type: n.type, res: def.res, tx: n.x, ty: n.y,
        x: (n.x + 0.5) * TILE, y: (n.y + 0.5) * TILE, amount: def.amount, max: def.amount, dead: false, team: NEUTRAL,
      };
      W.nodes.push(node);
      W.nodeAt[tidx(n.x, n.y)] = node;
    }
    return;
  }
  throw new Error('Map generation failed');
}
