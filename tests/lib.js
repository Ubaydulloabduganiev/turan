'use strict';
// Shared helpers for the browser tests: a small static server for the game, a browser, and a fresh page
// that has skipped the opening film and the tutorial.
const http = require('http'), fs = require('fs'), path = require('path');
const pw = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node-tools/node_modules/playwright'); } })();

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, () => res(srv));
  });
}

let browser = null, server = null;
async function setup() {
  server = await serve();
  browser = await pw.chromium.launch();
}
async function teardown() { if (browser) await browser.close(); if (server) server.close(); }

// A page of the game. lang: the interface language; opts.viewport; opts.keepIntro to see the opening.
async function page(lang = 'en', opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, acceptDownloads: true, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  // The 3D library comes from a CDN; the tests use the 2D fallback so they need no network
  await p.route('https://**', r => r.abort());
  await p.addInitScript(([l, intro]) => { try { if (!sessionStorage.getItem('t-init')) { localStorage.clear(); localStorage.setItem('turan-lang', l); localStorage.setItem('turan-tutorial', 'done'); if (!intro) localStorage.setItem('turan-intro', 'seen'); sessionStorage.setItem('t-init', '1'); } } catch (e) { /* private mode */ } }, [lang, !!opts.keepIntro]);
  await p.goto(`http://localhost:${server.address().port}/index.html`);
  await p.waitForFunction(() => typeof G !== 'undefined' && document.getElementById('btn-new'));
  await p.waitForTimeout(400);
  p.close2 = () => ctx.close();
  return p;
}

// Waits until no film scene or window is open, dismissing them as a player would
async function settle(p, quietMs = 1200) {
  let calm = 0;
  for (let i = 0; i < 120 && calm < quietMs; i += 1) {
    await p.waitForTimeout(150);
    const s = await p.evaluate(() => ({ cine: !!document.querySelector('#cinema.shown'), modal: typeof modalOpen !== 'undefined' && modalOpen, busy: typeof turnBusy !== 'undefined' && turnBusy }));
    if (s.cine) { await p.evaluate(() => { const b = document.querySelector('#cinema.shown .cine-go'); if (b) b.click(); }); calm = 0; continue; }
    if (s.modal) { await p.evaluate(() => closeModal()); calm = 0; continue; }
    calm = s.busy ? 0 : calm + 150;
  }
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
}

// Starts a grand campaign through the menus, as a person would
async function startGrand(p, nation = 'temur') {
  await p.click('#btn-new'); await p.waitForTimeout(300);
  await p.click('[data-camp="grand"]'); await p.waitForTimeout(300);
  await p.click(`[data-f="${nation}"]`); await p.click('#pick-go');
  await p.waitForFunction(() => G && !document.getElementById('game').classList.contains('hidden'), null, { timeout: 20000 });
  await settle(p);
}

// Quiet engine hooks for running turns in code
async function quietHooks(p) {
  await p.evaluate(() => { HOOKS.offer = async () => false; HOOKS.defend = async () => 'auto'; HOOKS.march = async () => {}; HOOKS.clash = async () => {}; HOOKS.fight = null; HOOKS.notify = () => {}; HOOKS.focus = async f => { G.player = f; }; });
}

function assert(ok, msg) { if (!ok) throw new Error(msg); }

module.exports = { pw, setup, teardown, page, startGrand, settle, quietHooks, assert, ROOT };
