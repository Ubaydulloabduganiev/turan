'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');
const cam = { x: 0, y: 0, zoom: 1 };
const TOP_H = 38, BOTTOM_H = 190;

let terrainCanvas = null, miniTerrain = null;
const fogCanvas = document.createElement('canvas');
fogCanvas.width = MAP_W; fogCanvas.height = MAP_H;
const fogCtx = fogCanvas.getContext('2d');
const fogImg = fogCtx.createImageData(MAP_W, MAP_H);

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  clampCam();
}

function clampCam() {
  const vw = canvas.width / cam.zoom, vh = canvas.height / cam.zoom;
  const top = -TOP_H / cam.zoom, bot = WORLD_H + BOTTOM_H / cam.zoom - vh;
  cam.x = vw >= WORLD_W ? (WORLD_W - vw) / 2 : clamp(cam.x, 0, WORLD_W - vw);
  cam.y = bot < top ? (top + bot) / 2 : clamp(cam.y, top, bot);
}

function centerOn(x, y) {
  cam.x = x - canvas.width / cam.zoom / 2;
  cam.y = y - (canvas.height - BOTTOM_H + TOP_H) / cam.zoom / 2;
  clampCam();
}

// Stable per-tile random number in [0, 1)
function th(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) ^ (W ? W.seed : 0);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function ell(c, x, y, rx, ry) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}

// ---------- Terrain ----------

function buildTerrain() {
  terrainCanvas = document.createElement('canvas');
  terrainCanvas.width = WORLD_W; terrainCanvas.height = WORLD_H;
  const c = terrainCanvas.getContext('2d');
  miniTerrain = document.createElement('canvas');
  miniTerrain.width = MAP_W; miniTerrain.height = MAP_H;
  const m = miniTerrain.getContext('2d');
  const miniCol = ['#8f9f52', '#d4b874', '#3f8fb3', '#77695a'];
  const land = (x, y) => inMap(x, y) && W.terrain[tidx(x, y)] !== T_WATER;

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = W.terrain[tidx(x, y)], r = th(x, y), r2 = th(x + 91, y + 37), px = x * TILE, py = y * TILE;
      m.fillStyle = miniCol[t]; m.fillRect(x, y, 1, 1);
      if (t === T_GRASS) {
        c.fillStyle = `hsl(${70 + r * 5},33%,${45 + r2 * 2}%)`; c.fillRect(px, py, TILE, TILE);
        c.strokeStyle = 'rgba(70,90,30,.45)'; c.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const gx = px + th(x + k * 7, y + 3) * 28 + 2, gy = py + th(x + 5, y + k * 11) * 26 + 5;
          c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 2, gy - 4); c.moveTo(gx, gy); c.lineTo(gx + 2, gy - 4); c.stroke();
        }
      } else if (t === T_SAND) {
        c.fillStyle = `hsl(${39 + r * 3},50%,${66 + r2 * 2}%)`; c.fillRect(px, py, TILE, TILE);
        c.fillStyle = 'rgba(150,115,60,.35)';
        for (let k = 0; k < 4; k++) c.fillRect(px + th(x + k * 13, y) * 30, py + th(x, y + k * 17) * 30, 2, 1);
        if (r > 0.8) {
          c.strokeStyle = 'rgba(255,240,200,.35)'; c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(px + 4, py + 20); c.quadraticCurveTo(px + 16, py + 12, px + 28, py + 20); c.stroke();
        }
      } else if (t === T_WATER) {
        c.fillStyle = `hsl(${197 + r * 3},52%,${43 + r2 * 2}%)`; c.fillRect(px, py, TILE, TILE);
        c.strokeStyle = 'rgba(210,240,250,.35)'; c.lineWidth = 1.2;
        for (let k = 0; k < 2; k++) {
          const wx = px + th(x + k * 3, y + 9) * 18, wy = py + 8 + k * 14 + r * 4;
          c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(wx + 5, wy - 3, wx + 10, wy); c.stroke();
        }
      } else {
        c.fillStyle = `hsl(30,18%,${40 + r * 5}%)`; c.fillRect(px, py, TILE, TILE);
      }
    }
  }
  // Sandy banks where water meets land
  c.fillStyle = 'rgba(236,216,160,.6)';
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (W.terrain[tidx(x, y)] !== T_WATER) continue;
      const px = x * TILE, py = y * TILE;
      if (land(x, y - 1)) c.fillRect(px, py, TILE, 4);
      if (land(x, y + 1)) c.fillRect(px, py + TILE - 4, TILE, 4);
      if (land(x - 1, y)) c.fillRect(px, py, 4, TILE);
      if (land(x + 1, y)) c.fillRect(px + TILE - 4, py, 4, TILE);
    }
  }
  // Mountain peaks, drawn back to front so they overlap nicely
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (W.terrain[tidx(x, y)] !== T_MOUNTAIN) continue;
      const r = th(x, y), px = x * TILE, py = y * TILE, ax = px + 10 + r * 12, ay = py - 8 - th(x + 3, y + 8) * 10;
      c.fillStyle = '#9a8872';
      c.beginPath(); c.moveTo(px - 5, py + TILE); c.lineTo(ax, ay); c.lineTo(px + TILE + 5, py + TILE); c.fill();
      c.fillStyle = '#6f6050';
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(px + TILE + 5, py + TILE); c.lineTo(ax + 3, py + TILE); c.fill();
      c.fillStyle = '#f4f1ea';
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax - 6, ay + 11); c.lineTo(ax - 1, ay + 8); c.lineTo(ax + 3, ay + 12); c.lineTo(ax + 7, ay + 11); c.fill();
    }
  }
  m.fillStyle = '#4c6b2c';
  for (const n of W.nodes) if (n.type === 'tree') m.fillRect(n.tx, n.ty, 1, 1);
}

// ---------- Art ----------

function flag(c, x, y, team) {
  c.strokeStyle = '#3b2c20'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 14); c.stroke();
  c.fillStyle = TEAM_COLOR[team];
  c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x + 10, y - 11); c.lineTo(x, y - 7); c.fill();
}

function arch(c, x, y, w, h) { // doorway with a pointed top, (x, y) is the bottom-left corner
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h * 0.55);
  c.quadraticCurveTo(x, y - h, x + w / 2, y - h); c.quadraticCurveTo(x + w, y - h, x + w, y - h * 0.55);
  c.lineTo(x + w, y); c.fill();
}

function dome(c, x, y, r, col) {
  c.fillStyle = col;
  c.beginPath(); c.ellipse(x, y, r, r * 0.95, 0, Math.PI, 0); c.fill();
  c.fillStyle = 'rgba(255,255,255,.28)';
  ell(c, x - r * 0.35, y - r * 0.5, r * 0.22, r * 0.32);
  c.fillStyle = '#e8c860'; c.fillRect(x - 1, y - r * 0.95 - 5, 2, 6);
}

function drawBuildingArt(c, type, team, x, y, s) {
  const col = TEAM_COLOR[team], dark = TEAM_DARK[team];
  const wall = '#d9b77c', wallLt = '#e8cc96', shade = '#b08a55', tq = '#1f9db8', door = '#3a2a1a';
  const cx = x + s / 2;
  c.fillStyle = 'rgba(0,0,0,.2)';
  if (type !== 'farm') ell(c, cx, y + s - 5, s * 0.47, s * 0.13);
  switch (type) {
    case 'citadel': {
      dome(c, cx, y + 34, 23, tq);
      c.fillStyle = wall; c.fillRect(x + 6, y + 40, s - 12, s - 48);
      c.fillStyle = shade; c.fillRect(x + 6, y + s - 16, s - 12, 8);
      c.fillStyle = wall;
      for (let i = 0; i < 9; i++) c.fillRect(x + 8 + i * 9.4, y + 35, 5, 6);
      for (const tx of [x + 2, x + s - 20]) {
        c.fillStyle = wallLt; c.fillRect(tx, y + 28, 18, s - 36);
        c.fillStyle = shade; c.fillRect(tx, y + s - 14, 18, 6);
        c.fillStyle = col; c.fillRect(tx, y + 40, 18, 4);
        dome(c, tx + 9, y + 28, 9, tq);
      }
      c.fillStyle = wallLt; c.fillRect(cx - 16, y + 30, 32, s - 38);
      c.strokeStyle = tq; c.lineWidth = 2.5; c.strokeRect(cx - 14.5, y + 31.5, 29, s - 41);
      c.fillStyle = door; arch(c, cx - 8, y + s - 9, 16, 34);
      flag(c, cx, y + 8, team);
      break;
    }
    case 'yurt': {
      c.fillStyle = '#e9dfc6'; c.fillRect(x + 9, y + 30, 46, 24);
      c.fillStyle = '#f4ecd8';
      c.beginPath(); c.moveTo(x + 5, y + 31); c.quadraticCurveTo(cx, y - 2, x + s - 5, y + 31); c.fill();
      c.fillStyle = col; c.fillRect(x + 9, y + 31, 46, 5);
      c.strokeStyle = 'rgba(120,95,60,.5)'; c.lineWidth = 1;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x + 13 + i * 8, y + 37); c.lineTo(x + 13 + i * 8, y + 54); c.stroke(); }
      c.fillStyle = '#6b4a2b'; ell(c, cx, y + 11, 5, 2.5);
      c.fillStyle = dark; c.fillRect(cx - 6, y + 36, 12, 18);
      break;
    }
    case 'farm': {
      c.fillStyle = '#7d5d33'; c.fillRect(x + 3, y + 3, s - 6, s - 6);
      for (let i = 0; i < 7; i++) {
        c.fillStyle = i % 2 ? '#d9b84a' : '#7fa23c';
        c.fillRect(x + 6, y + 6 + i * 8, s - 12, 5);
      }
      c.strokeStyle = '#5b3d22'; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, s - 6, s - 6);
      c.fillStyle = col; c.fillRect(x + 2, y + 2, 5, 5); c.fillRect(x + s - 7, y + 2, 5, 5);
      break;
    }
    case 'storehouse': {
      c.fillStyle = '#a67c4e'; c.fillRect(x + 7, y + 24, 50, 32);
      c.fillStyle = '#7a5632';
      c.beginPath(); c.moveTo(x + 3, y + 26); c.lineTo(cx, y + 8); c.lineTo(x + s - 3, y + 26); c.fill();
      c.strokeStyle = 'rgba(60,40,20,.5)'; c.lineWidth = 1;
      for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(x + 7 + i * 8.3, y + 26); c.lineTo(x + 7 + i * 8.3, y + 56); c.stroke(); }
      c.fillStyle = door; c.fillRect(cx - 7, y + 36, 14, 20);
      c.fillStyle = '#e6d3a3'; ell(c, x + 14, y + 53, 6, 5); ell(c, x + s - 14, y + 53, 6, 5);
      c.fillStyle = col; c.fillRect(cx - 5, y + 14, 10, 6);
      break;
    }
    case 'barracks': {
      c.fillStyle = wall; c.fillRect(x + 6, y + 30, s - 12, s - 40);
      c.fillStyle = shade; c.fillRect(x + 6, y + s - 18, s - 12, 8);
      c.fillStyle = wall;
      for (let i = 0; i < 9; i++) c.fillRect(x + 7 + i * 9.6, y + 24, 6, 7);
      c.fillStyle = door; arch(c, cx - 9, y + s - 10, 18, 30);
      for (const bx of [x + 16, x + s - 26]) {
        c.fillStyle = col; c.fillRect(bx, y + 38, 10, 24);
        c.fillStyle = '#f1e2b8'; ell(c, bx + 5, y + 46, 2.5, 2.5);
      }
      c.strokeStyle = '#5b4630'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x + 12, y + 30); c.lineTo(x + 12, y + 6); c.moveTo(x + s - 12, y + 30); c.lineTo(x + s - 12, y + 6); c.stroke();
      c.fillStyle = '#c9ccd2';
      for (const sx of [x + 12, x + s - 12]) { c.beginPath(); c.moveTo(sx - 3, y + 8); c.lineTo(sx, y); c.lineTo(sx + 3, y + 8); c.fill(); }
      break;
    }
    case 'stable': {
      c.fillStyle = '#b08a55'; c.fillRect(x + 6, y + 34, 52, s - 44);
      c.fillStyle = '#7a5632';
      c.beginPath(); c.moveTo(x + 2, y + 36); c.lineTo(x + 32, y + 14); c.lineTo(x + 62, y + 36); c.fill();
      c.fillStyle = door; arch(c, x + 22, y + s - 10, 20, 30);
      c.fillStyle = col; c.fillRect(x + 27, y + 22, 10, 7);
      c.strokeStyle = '#6b4a2b'; c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(x + 58, y + 58); c.lineTo(x + s - 4, y + 58); c.moveTo(x + 58, y + 70); c.lineTo(x + s - 4, y + 70);
      for (let i = 0; i < 4; i++) { c.moveTo(x + 62 + i * 10, y + 52); c.lineTo(x + 62 + i * 10, y + s - 10); }
      c.stroke();
      c.fillStyle = '#7a4a2a'; ell(c, x + 74, y + 48, 9, 5); ell(c, x + 83, y + 41, 4, 3);
      c.fillRect(x + 68, y + 50, 2, 8); c.fillRect(x + 79, y + 50, 2, 8);
      break;
    }
    case 'caravanserai': {
      c.fillStyle = wall; c.fillRect(x + 4, y + 28, s - 8, s - 38);
      c.fillStyle = '#a98558'; c.fillRect(x + 16, y + 40, s - 32, s - 62);
      c.fillStyle = shade; c.fillRect(x + 4, y + s - 18, s - 8, 8);
      c.fillStyle = door;
      for (let i = 0; i < 3; i++) { arch(c, x + 10 + i * 11, y + s - 18, 7, 12); arch(c, x + s - 39 + i * 11, y + s - 18, 7, 12); }
      c.fillStyle = wallLt; c.fillRect(cx - 12, y + 22, 24, s - 32);
      c.strokeStyle = tq; c.lineWidth = 2; c.strokeRect(cx - 11, y + 23, 22, s - 34);
      c.fillStyle = door; arch(c, cx - 6, y + s - 10, 12, 26);
      dome(c, x + 12, y + 28, 8, tq); dome(c, x + s - 12, y + 28, 8, tq);
      c.fillStyle = col; c.fillRect(x + 22, y + 44, 12, 9); c.fillStyle = '#e6d3a3'; c.fillRect(x + s - 36, y + 44, 12, 9);
      flag(c, cx, y + 22, team);
      break;
    }
    case 'tower': {
      c.fillStyle = wall; c.fillRect(x + 9, y - 16, 14, 44);
      c.fillStyle = shade; c.fillRect(x + 19, y - 16, 4, 44);
      c.fillStyle = tq; c.fillRect(x + 9, y - 4, 14, 3); c.fillRect(x + 9, y + 10, 14, 3);
      c.fillStyle = wallLt; c.fillRect(x + 5, y - 22, 22, 8);
      c.fillStyle = door; c.fillRect(x + 13, y - 20, 6, 4); arch(c, x + 12, y + 28, 8, 10);
      dome(c, x + 16, y - 22, 9, tq);
      c.fillStyle = col; c.fillRect(x + 9, y + 2, 14, 4);
      break;
    }
    case 'bazaar': {
      c.fillStyle = wall; c.fillRect(x + 6, y + 44, s - 12, s - 56);
      c.fillStyle = shade; c.fillRect(x + 6, y + s - 20, s - 12, 8);
      dome(c, x + 30, y + 44, 18, '#2a6fb0'); dome(c, cx, y + 40, 26, tq); dome(c, x + s - 30, y + 44, 18, '#3f9a6a');
      c.fillStyle = wallLt; c.fillRect(cx - 18, y + 38, 36, s - 50);
      c.strokeStyle = '#2a6fb0'; c.lineWidth = 3; c.strokeRect(cx - 16.5, y + 39.5, 33, s - 53);
      c.fillStyle = door; arch(c, cx - 9, y + s - 12, 18, 38);
      const awn = ['#c8402f', '#e2b84a', '#2a6fb0', '#3f9a6a'];
      for (let i = 0; i < 4; i++) {
        const ax = x + 10 + (i < 2 ? i * 20 : s - 60 + (i - 2) * 20);
        c.fillStyle = awn[i];
        c.beginPath(); c.moveTo(ax, y + s - 34); c.lineTo(ax + 18, y + s - 34); c.lineTo(ax + 21, y + s - 26); c.lineTo(ax - 3, y + s - 26); c.fill();
        c.fillStyle = '#f1e2b8'; c.fillRect(ax + 3, y + s - 24, 12, 6);
      }
      break;
    }
  }
}

function drawUnitArt(c, type, team, anim, moving, working, carryType, swing) {
  const d = UNITS[type], col = TEAM_COLOR[team], dark = TEAM_DARK[team], skin = '#e2b58c';
  const step = moving ? Math.sin(anim * 14) : 0;
  c.lineCap = 'round';
  if (d.mounted || type === 'caravan') {
    const camel = type === 'caravan';
    const body = camel ? '#c49a5e' : type === 'batyr' ? '#3d2a1c' : '#7a4a2a';
    c.strokeStyle = body; c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(-6, 2); c.lineTo(-6 - step * 3, 9); c.moveTo(-3, 2); c.lineTo(-3 + step * 3, 9);
    c.moveTo(5, 2); c.lineTo(5 + step * 3, 9); c.moveTo(8, 2); c.lineTo(8 - step * 3, 9);
    c.stroke();
    c.fillStyle = body; ell(c, 1, 0, 10, 5);
    c.lineWidth = 3.5; c.beginPath(); c.moveTo(8, -2); c.lineTo(13, -9); c.stroke();
    ell(c, 14.5, -9.5, 3.6, 2.4);
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(-9, -1); c.lineTo(-13, 4); c.stroke();
    if (camel) {
      ell(c, 0, -5, 5, 4);
      c.fillStyle = col; c.fillRect(-8, -6, 5, 8); c.fillRect(3, -6, 5, 8);
      c.fillStyle = '#f1e2b8'; c.fillRect(-6, -10, 12, 4);
      if (carryType === 'gold') { c.fillStyle = RES_COLOR.gold; ell(c, 0, -12, 3, 3); }
    } else {
      c.fillStyle = dark; c.fillRect(-4, -5, 8, 3);
      c.fillStyle = col; c.fillRect(-3, -14, 6, 10);
      c.fillStyle = skin; ell(c, 0, -17, 3.2, 3.2);
      if (type === 'batyr') {
        c.fillStyle = '#c9ccd2'; c.beginPath(); c.ellipse(0, -18, 3.6, 3.6, 0, Math.PI, 0); c.fill(); c.fillRect(-0.7, -24, 1.4, 3);
        c.strokeStyle = '#d8d8d8'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(-3, -9); c.lineTo(17 + (swing > 0 ? 4 : 0), -19); c.stroke();
        c.fillStyle = col; c.beginPath(); c.moveTo(11, -16); c.lineTo(15, -22); c.lineTo(9, -19); c.fill();
      } else {
        c.fillStyle = '#5a3b22'; c.fillRect(-3.5, -21.5, 7, 3);
        c.strokeStyle = '#4a3220'; c.lineWidth = 1.4;
        c.beginPath(); c.arc(5, -13, 6, -1.2, 1.2); c.stroke();
        c.lineWidth = 0.7; c.beginPath(); c.moveTo(7.2, -18.6); c.lineTo(7.2, -7.4); c.stroke();
      }
    }
    return;
  }
  c.strokeStyle = '#3b2c20'; c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(-2, 3); c.lineTo(-2 - step * 2.5, 9); c.moveTo(2, 3); c.lineTo(2 + step * 2.5, 9); c.stroke();
  c.fillStyle = col; c.fillRect(-4.5, -6, 9, 10);
  c.fillStyle = dark; c.fillRect(-4.5, 0, 9, 1.8);
  c.fillStyle = skin; ell(c, 0, -9.5, 3.6, 3.6);
  if (type === 'villager') {
    c.fillStyle = '#2f2a26'; c.beginPath(); c.ellipse(0, -11, 3.7, 2.6, 0, Math.PI, 0); c.fill();
    if (working) {
      const a = Math.sin(anim * 9) * 0.9 - 0.4;
      c.strokeStyle = '#6b4a2b'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(4, -3); c.lineTo(4 + Math.cos(a) * 9, -3 + Math.sin(a) * 9); c.stroke();
      c.fillStyle = '#9aa0a6'; ell(c, 4 + Math.cos(a) * 9, -3 + Math.sin(a) * 9, 2.2, 2.2);
    } else if (carryType) {
      c.fillStyle = RES_COLOR[carryType]; ell(c, -5.5, -4, 3.6, 3.6);
    }
  } else if (type === 'spearman') {
    c.fillStyle = '#c9ccd2'; c.beginPath(); c.ellipse(0, -10.5, 3.9, 3.6, 0, Math.PI, 0); c.fill();
    const t = swing > 0 ? 4 : 0;
    c.strokeStyle = '#6b4a2b'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(4 + t, 7); c.lineTo(7 + t, -17); c.stroke();
    c.fillStyle = '#d8d8d8'; c.beginPath(); c.moveTo(5 + t, -16); c.lineTo(7.4 + t, -22); c.lineTo(9 + t, -16); c.fill();
    c.fillStyle = dark; ell(c, -4.5, -1, 3.4, 4.2); c.fillStyle = '#e8c860'; ell(c, -4.5, -1, 1.2, 1.2);
  } else if (type === 'archer') {
    c.fillStyle = '#6b4a2b'; c.fillRect(-4, -13.5, 8, 3);
    c.strokeStyle = '#4a3220'; c.lineWidth = 1.4; c.beginPath(); c.arc(4, -2, 7, -1.25, 1.25); c.stroke();
    c.lineWidth = 0.7; c.beginPath(); c.moveTo(6.2, -8.6); c.lineTo(6.2, 4.6); c.stroke();
    c.fillStyle = '#8a5a2b'; c.fillRect(-6.5, -6, 2.2, 8);
  }
}

function drawNode(c, n) {
  const x = n.tx * TILE, y = n.ty * TILE, r = th(n.tx, n.ty);
  if (n.sel) { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2); }
  c.fillStyle = 'rgba(0,0,0,.22)'; ell(c, x + 16, y + 27, 11, 4);
  if (n.type === 'tree') {
    c.fillStyle = '#5b3d22'; c.fillRect(x + 14.5, y + 16, 3.5, 11);
    c.fillStyle = `hsl(${100 + r * 20},36%,${26 + r * 8}%)`; ell(c, x + 16 + (r - 0.5) * 4, y + 6 - r * 4, 7.5 + r * 2, 15);
    c.fillStyle = 'rgba(190,220,120,.3)'; ell(c, x + 13 + (r - 0.5) * 4, y + 2 - r * 4, 3, 8);
  } else if (n.type === 'berry') {
    c.fillStyle = '#4a7a2c'; ell(c, x + 16, y + 17, 12, 9);
    c.fillStyle = '#5f953a'; ell(c, x + 12, y + 14, 6, 5);
    c.fillStyle = '#c62b3a';
    const k = Math.ceil(n.amount / n.max * 6);
    for (let i = 0; i < k; i++) ell(c, x + 7 + th(n.tx + i, n.ty) * 18, y + 11 + th(n.tx, n.ty + i) * 11, 2.2, 2.2);
  } else {
    const gold = n.type === 'gold';
    c.fillStyle = gold ? '#8c8577' : '#8f949b';
    c.beginPath(); c.moveTo(x + 3, y + 27); c.lineTo(x + 8, y + 12); c.lineTo(x + 16, y + 7); c.lineTo(x + 26, y + 13); c.lineTo(x + 29, y + 27); c.fill();
    c.fillStyle = gold ? '#6f695e' : '#6d7278';
    c.beginPath(); c.moveTo(x + 16, y + 7); c.lineTo(x + 26, y + 13); c.lineTo(x + 29, y + 27); c.lineTo(x + 18, y + 27); c.fill();
    if (gold) { c.fillStyle = '#f4c430'; ell(c, x + 11, y + 17, 2.8, 2.2); ell(c, x + 20, y + 13, 2.4, 2); ell(c, x + 22, y + 22, 2.8, 2.2); ell(c, x + 13, y + 24, 2, 1.8); }
    else { c.fillStyle = '#c3c8ce'; c.beginPath(); c.moveTo(x + 8, y + 12); c.lineTo(x + 16, y + 7); c.lineTo(x + 14, y + 16); c.fill(); }
  }
}

function drawBar(c, x, y, w, frac, col) {
  c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x - 1, y - 1, w + 2, 5);
  c.fillStyle = col || (frac > 0.5 ? '#56c256' : frac > 0.25 ? '#e2b84a' : '#e0503c');
  c.fillRect(x, y, w * clamp(frac, 0, 1), 3);
}

function drawBuilding(c, b) {
  const s = b.size * TILE, x = b.tx * TILE, y = b.ty * TILE;
  if (b.sel) {
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.setLineDash([6, 4]);
    c.strokeRect(x + 1, y + 1, s - 2, s - 2); c.setLineDash([]);
  }
  if (!b.built) {
    c.fillStyle = 'rgba(110,80,40,.4)'; c.fillRect(x + 2, y + 2, s - 4, s - 4);
    c.globalAlpha = 0.3 + 0.6 * b.progress;
  }
  drawBuildingArt(c, b.type, b.team, x, y, s);
  c.globalAlpha = 1;
  if (!b.built) {
    c.strokeStyle = 'rgba(90,60,30,.8)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 8; i < s; i += 16) { c.moveTo(x + i, y + 4); c.lineTo(x + i, y + s - 4); c.moveTo(x + 4, y + i); c.lineTo(x + s - 4, y + i); }
    c.stroke();
    drawBar(c, x + 4, y + s - 8, s - 8, b.progress, '#1f9db8');
  } else if (b.hp < b.maxHp * 0.5 && b.type !== 'farm') {
    for (let i = 0; i < b.size + 1; i++) {
      const fx = x + s * (0.2 + 0.6 * th(b.tx + i, b.ty)), fy = y + s * (0.35 + 0.4 * th(b.tx, b.ty + i));
      const f = 5 + Math.sin(W.time * 9 + i * 2) * 2;
      c.fillStyle = '#e0602a'; c.beginPath(); c.moveTo(fx - 4, fy); c.quadraticCurveTo(fx, fy - f * 2.4, fx + 4, fy); c.fill();
      c.fillStyle = '#f7c948'; c.beginPath(); c.moveTo(fx - 2, fy); c.quadraticCurveTo(fx, fy - f * 1.3, fx + 2, fy); c.fill();
    }
  }
  if (b.team !== NEUTRAL && (b.sel || b.hp < b.maxHp) && b.built) drawBar(c, x + 4, y - (b.type === 'tower' ? 36 : 6), s - 8, b.hp / b.maxHp);
}

function drawUnit(c, u) {
  c.save();
  c.translate(u.x, u.y);
  if (u.sel) { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 6, 11, 6, 0, 0, Math.PI * 2); c.stroke(); }
  c.fillStyle = 'rgba(0,0,0,.25)'; ell(c, 0, 7, 8, 3.5);
  c.scale(u.face, 1);
  drawUnitArt(c, u.type, u.team, u.anim, u.moving, u.working, u.carry > 0 ? u.carryType : null, u.swing);
  c.restore();
  if (u.sel || u.hp < u.maxHp) drawBar(c, u.x - 9, u.y - (UNITS[u.type].mounted ? 30 : 22), 18, u.hp / u.maxHp);
}

// ---------- Icons for the HUD ----------

const iconCache = {};
function icon(kind, type) {
  const key = kind + type;
  if (iconCache[key]) return iconCache[key];
  const cv = document.createElement('canvas');
  cv.width = cv.height = 48;
  const c = cv.getContext('2d');
  if (kind === 'b') {
    const s = BUILDINGS[type].size * TILE, tall = type === 'tower' ? 26 : 0;
    const k = 44 / (s + tall);
    c.translate(24 - s * k / 2, 2 + tall * k); c.scale(k, k);
    drawBuildingArt(c, type, type === 'bazaar' ? NEUTRAL : PLAYER, 0, 0, s);
  } else if (kind === 'n') {
    c.translate(4, 10); c.scale(1.25, 1.25);
    drawNode(c, { type, tx: 0, ty: 0, amount: 1, max: 1 });
  } else {
    c.translate(22, 31); c.scale(1.9, 1.9);
    drawUnitArt(c, type, kind === 'e' ? ENEMY : PLAYER, 0, false, false, null, 0);
  }
  return (iconCache[key] = cv.toDataURL());
}

// ---------- Frame ----------

function render() {
  const cw = canvas.width, ch = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0c0a07'; ctx.fillRect(0, 0, cw, ch);
  if (!W || !terrainCanvas) return;
  const z = cam.zoom, vw = cw / z, vh = ch / z;
  ctx.setTransform(z, 0, 0, z, -Math.round(cam.x * z), -Math.round(cam.y * z));
  const sx = Math.max(0, cam.x), sy = Math.max(0, cam.y), ex = Math.min(WORLD_W, cam.x + vw), ey = Math.min(WORLD_H, cam.y + vh);
  if (ex > sx && ey > sy) ctx.drawImage(terrainCanvas, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);

  // Collect everything in view, then paint back to front
  const list = [];
  const tx0 = clamp(Math.floor(sx / TILE) - 1, 0, MAP_W - 1), tx1 = clamp(Math.floor(ex / TILE) + 1, 0, MAP_W - 1);
  const ty0 = clamp(Math.floor(sy / TILE) - 1, 0, MAP_H - 1), ty1 = clamp(Math.floor(ey / TILE) + 2, 0, MAP_H - 1);
  for (let y = ty0; y <= ty1; y++) {
    for (let x = tx0; x <= tx1; x++) {
      const i = tidx(x, y), n = W.nodeAt[i];
      if (n && W.explored[i]) list.push({ y: n.y + 10, e: n });
    }
  }
  const pad = 80;
  for (const b of W.buildings) {
    if (!b.seen || b.x < sx - pad - 64 || b.x > ex + pad + 64 || b.y < sy - pad - 64 || b.y > ey + pad + 64) continue;
    list.push({ y: b.type === 'farm' ? b.y - 40 : b.y + b.size * TILE / 2 - 6, e: b });
  }
  for (const u of W.units) {
    if (u.x < sx - 20 || u.x > ex + 20 || u.y < sy - 20 || u.y > ey + 30) continue;
    if (u.team !== PLAYER && !W.visible[tidx(tileOf(u.x), tileOf(u.y))]) continue;
    list.push({ y: u.y, e: u });
  }
  list.sort((a, b) => a.y - b.y);

  for (const e of W.effects) {
    if (e.type === 'death') { ctx.fillStyle = `rgba(120,20,15,${Math.min(0.5, e.life * 0.1)})`; ell(ctx, e.x, e.y + 6, 8, 4); }
    else if (e.type === 'rubble') {
      ctx.fillStyle = `rgba(60,48,36,${Math.min(0.6, e.life * 0.1)})`;
      for (let i = 0; i < 6; i++) ell(ctx, e.x + (th(i, 3) - 0.5) * e.r * 1.6, e.y + (th(3, i) - 0.5) * e.r * 1.6, e.r * 0.3, e.r * 0.2);
    }
  }
  for (const it of list) {
    const e = it.e;
    if (e.kind === 'unit') drawUnit(ctx, e); else if (e.kind === 'building') drawBuilding(ctx, e); else drawNode(ctx, e);
  }

  ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 1.5;
  for (const p of W.projectiles) {
    if (!W.visible[tidx(tileOf(p.x), tileOf(p.y))]) continue;
    const a = p.ang || 0;
    ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * 7, p.y - Math.sin(a) * 7); ctx.lineTo(p.x, p.y); ctx.stroke();
  }

  // Fog of war
  if (W.fogDirty) {
    const d = fogImg.data;
    for (let i = 0; i < MAP_N; i++) d[i * 4 + 3] = W.visible[i] ? 0 : W.explored[i] ? 105 : 255;
    fogCtx.putImageData(fogImg, 0, 0);
    W.fogDirty = false;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(fogCanvas, 0, 0, MAP_W, MAP_H, 0, 0, WORLD_W, WORLD_H);

  for (const e of W.effects) {
    if (e.type === 'text') {
      ctx.font = 'bold 13px Segoe UI, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(e.text, e.x + 1, e.y + 1);
      ctx.fillStyle = '#ffd95a'; ctx.fillText(e.text, e.x, e.y);
    } else if (e.type === 'click') {
      ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.globalAlpha = Math.min(1, e.life * 2.5);
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 4 + (0.5 - e.life) * 22, 2 + (0.5 - e.life) * 11, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  drawOverlays(ctx);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (drag && Math.abs(drag.x - drag.sx) + Math.abs(drag.y - drag.sy) > 6) {
    const x = Math.min(drag.sx, drag.x), y = Math.min(drag.sy, drag.y), w = Math.abs(drag.x - drag.sx), h = Math.abs(drag.y - drag.sy);
    ctx.fillStyle = 'rgba(140,230,250,.12)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#8fe3f5'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }
}

// Rally flags and the building placement ghost (world space)
function drawOverlays(c) {
  for (const b of sel) {
    if (b.kind !== 'building' || b.team !== PLAYER || !b.rally) continue;
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.rally.x, b.rally.y); c.stroke(); c.setLineDash([]);
    flag(c, b.rally.x, b.rally.y, PLAYER);
  }
  if (placing) {
    const w = screenToWorld(mouse.x, mouse.y), s = BUILDINGS[placing].size;
    const tx = Math.round(w.x / TILE - s / 2), ty = Math.round(w.y / TILE - s / 2);
    const ok = canPlace(placing, tx, ty, true);
    c.fillStyle = ok ? 'rgba(90,220,120,.3)' : 'rgba(230,70,60,.4)';
    c.fillRect(tx * TILE, ty * TILE, s * TILE, s * TILE);
    c.globalAlpha = 0.65;
    drawBuildingArt(c, placing, PLAYER, tx * TILE, ty * TILE, s * TILE);
    c.globalAlpha = 1;
    const range = BUILDINGS[placing].range;
    if (range) {
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1; c.setLineDash([5, 5]);
      c.beginPath(); c.arc((tx + s / 2) * TILE, (ty + s / 2) * TILE, range + s * TILE / 2, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
  }
}

function drawMinimap() {
  const k = mini.width / MAP_W;
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(miniTerrain, 0, 0, mini.width, mini.height);
  for (const b of W.buildings) {
    if (!b.seen) continue;
    mctx.fillStyle = TEAM_COLOR[b.team];
    mctx.fillRect(b.tx * k, b.ty * k, Math.max(3, b.size * k), Math.max(3, b.size * k));
  }
  for (const u of W.units) {
    if (u.team !== PLAYER && !W.visible[tidx(tileOf(u.x), tileOf(u.y))]) continue;
    mctx.fillStyle = u.team === PLAYER ? '#c8f4ff' : '#ff8a7a';
    mctx.fillRect(u.x / TILE * k - 1, u.y / TILE * k - 1, 2.5, 2.5);
  }
  mctx.imageSmoothingEnabled = true;
  mctx.drawImage(fogCanvas, 0, 0, mini.width, mini.height);
  for (const e of W.effects) {
    if (e.type !== 'ping') continue;
    const r = 4 + (e.life % 1) * 10;
    mctx.strokeStyle = '#ff5544'; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.arc(e.x / TILE * k, e.y / TILE * k, r, 0, Math.PI * 2); mctx.stroke();
  }
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 1;
  mctx.strokeRect(cam.x / TILE * k + 0.5, cam.y / TILE * k + 0.5, canvas.width / cam.zoom / TILE * k, canvas.height / cam.zoom / TILE * k);
}
