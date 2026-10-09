'use strict';
// Builds the campaign map from province coordinates: a Voronoi diagram of the cities, clipped to the map frame,
// with seas and mountain ranges as cells of their own and wobbly borders shared exactly between neighbours.

const MAP = { LON0: 25.5, LON1: 85.0, LAT0: 25.0, LAT1: 52.5, K: 52, COS: Math.cos(42 * Math.PI / 180) };
MAP.W = Math.round((MAP.LON1 - MAP.LON0) * MAP.COS * MAP.K);
MAP.H = Math.round((MAP.LAT1 - MAP.LAT0) * MAP.K);

function project(lon, lat) {
  return { x: (lon - MAP.LON0) * MAP.COS * MAP.K, y: (MAP.LAT1 - lat) * MAP.K };
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Clips a convex polygon to the half-plane closer to `a` than to `b`. Each vertex carries the label of the
// edge that starts at it (the neighbour on the other side, or -1 for the map frame).
function clipCell(poly, a, b, nb) {
  const nx = b.x - a.x, ny = b.y - a.y, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const f = p => (p.x - mx) * nx + (p.y - my) * ny;
  const out = [], n = poly.length;
  for (let k = 0; k < n; k++) {
    const P = poly[k], Q = poly[(k + 1) % n], fp = f(P), fq = f(Q);
    const cross = () => { const t = fp / (fp - fq); return { x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t }; };
    if (fp <= 0) {
      out.push({ x: P.x, y: P.y, e: P.e });
      if (fq > 0) { const I = cross(); out.push({ x: I.x, y: I.y, e: nb }); }
    } else if (fq <= 0) {
      const I = cross(); out.push({ x: I.x, y: I.y, e: P.e });
    }
  }
  return out;
}

// Midpoint displacement between two points, deterministic for a given key.
function wobble(a, b, key, depth) {
  const rng = mulberry32(key);
  const pts = [a, b];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
      const off = (rng() - 0.5) * len * 0.42;
      next.push({ x: (p.x + q.x) / 2 - dy / len * off, y: (p.y + q.y) / 2 + dx / len * off }, q);
    }
    pts.splice(0, pts.length, ...next);
  }
  return pts;
}

function buildMap() {
  const sites = [];
  for (const d of PROVINCE_DATA) sites.push({ id: d[0], kind: 'province', ...project(d[3], d[4]) });
  for (const d of BARRIER_DATA) sites.push({ id: null, name: d[0], kind: d[1], ...project(d[2], d[3]) });
  const frame = [{ x: 0, y: 0, e: -1 }, { x: MAP.W, y: 0, e: -1 }, { x: MAP.W, y: MAP.H, e: -1 }, { x: 0, y: MAP.H, e: -1 }];
  const cells = sites.map((s, i) => {
    let poly = frame.map(v => ({ ...v }));
    const others = sites.map((o, j) => ({ j, d: (o.x - s.x) ** 2 + (o.y - s.y) ** 2 })).filter(o => o.j !== i).sort((p, q) => p.d - q.d);
    for (const o of others) {
      // A site further than twice the furthest vertex cannot cut the cell any more.
      let far = 0;
      for (const v of poly) far = Math.max(far, (v.x - s.x) ** 2 + (v.y - s.y) ** 2);
      if (o.d > 4 * far) break;
      poly = clipCell(poly, s, sites[o.j], o.j);
    }
    return poly;
  });

  // Shared borders: each pair of cells gets one wobbly line, used forwards by one and backwards by the other.
  const edgeCache = new Map();
  const adj = sites.map(() => new Set());
  const outlines = cells.map((poly, i) => {
    const pts = [];
    for (let k = 0; k < poly.length; k++) {
      const P = poly[k], Q = poly[(k + 1) % poly.length];
      const len = Math.hypot(Q.x - P.x, Q.y - P.y);
      if (P.e >= 0 && len > 4) { adj[i].add(P.e); adj[P.e].add(i); }
      if (P.e < 0 || len < 2) { pts.push({ x: P.x, y: P.y }); continue; }
      const lo = Math.min(i, P.e), hi = Math.max(i, P.e), key = lo * 1000 + hi;
      let line = edgeCache.get(key);
      if (!line) {
        line = { from: i, pts: wobble({ x: P.x, y: P.y }, { x: Q.x, y: Q.y }, key * 7 + 13, len > 60 ? 4 : len > 25 ? 3 : 2) };
        edgeCache.set(key, line);
      }
      const seg = line.from === i ? line.pts : line.pts.slice().reverse();
      for (let s = 0; s < seg.length - 1; s++) pts.push(seg[s]);
    }
    return pts;
  });

  const edges = [];
  for (const [key, line] of edgeCache) edges.push({ a: Math.floor(key / 1000), b: key % 1000, pts: line.pts });
  return { sites, cells, outlines, adj, edges };
}

function linePath(pts) {
  let d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
  for (let i = 1; i < pts.length; i++) d += 'L' + pts[i].x.toFixed(1) + ' ' + pts[i].y.toFixed(1);
  return d;
}

function outlinePath(pts) {
  let d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
  for (let i = 1; i < pts.length; i++) d += 'L' + pts[i].x.toFixed(1) + ' ' + pts[i].y.toFixed(1);
  return d + 'Z';
}
