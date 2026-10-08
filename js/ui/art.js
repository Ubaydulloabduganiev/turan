'use strict';
// Banners and unit pictures, drawn as small inline SVGs.

const EMBLEMS = {
  // Temur's sign of three rings
  temur: c => `<g fill="none" stroke="${c}" stroke-width="3.2"><circle cx="20" cy="17" r="5.2"/><circle cx="13.5" cy="28" r="5.2"/><circle cx="26.5" cy="28" r="5.2"/></g>`,
  moghul: c => `<path d="M24 12a11 11 0 1 0 0 22a8.5 8.5 0 1 1 0-22z" fill="${c}"/><circle cx="28" cy="18" r="1.8" fill="${c}"/>`,
  white: c => `<path d="M20 11v24M12 15c0 7 4 10 8 10s8-3 8-10" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`,
  golden: c => `<path d="M13 13l7 9 7-9M20 22v13M14 31h12" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  khwarezm: c => `<path d="M20 9l3.2 7.3 7.8-1.6-4.6 6.5 4.6 6.5-7.8-1.6L20 33.4l-3.2-7.3-7.8 1.6 4.6-6.5L9 14.7l7.8 1.6z" fill="${c}"/>`,
  kart: c => `<path d="M12 35V22c0-6 8-10 8-13 0 3 8 7 8 13v13z" fill="${c}"/><path d="M17 35v-8c0-2 3-4 3-4s3 2 3 4v8z" fill="#00000055"/>`,
  sarbadar: c => `<g fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"><path d="M10 34L30 12M30 34L10 12"/><path d="M8 14l4-4M32 14l-4-4" stroke-width="4"/></g>`,
  rebels: c => `<path d="M13 14l14 18M27 14L13 32" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`,
};

function flagSVG(f, cls = '') {
  const F = FACTIONS[f], light = f === 'white';
  const em = (EMBLEMS[f] || EMBLEMS.rebels)(light ? '#5b4a2c' : f === 'golden' ? '#7a1f12' : '#f6e7b8');
  return `<svg class="${cls}" viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M2 2h36v38l-18-6-18 6z" fill="${F.color}" stroke="${F.dark}" stroke-width="2"/>` +
    `<path d="M2 2h36v5H2z" fill="#00000030"/>${em}</svg>`;
}

// A small battlefield picture for each unit type, in the owner's colour.
// Soldiers in the manner of a Timurid miniature: flat jewel colours with gold edges, kaftans in the
// nation's colour, white turbans or steel helmets, slim horses with fringed saddle cloths, on parchment.
function unitSVG(type, f) {
  const c = FACTIONS[f] ? FACTIONS[f].color : '#888', dk = FACTIONS[f] ? FACTIONS[f].dark : '#444';
  const d = UNITS[type], nomad = FACTIONS[f] && FACTIONS[f].nomad;
  const gold = '#d8a93a', ink = '#2a1a0c', skin = '#efcfa4';
  const heavy = type === 'heavyinf' || type === 'heavycav' || type === 'tovachi' || type === 'ordu' || type === 'qangli';
  // Headwear: a white turban for townsmen, a fur-trimmed cap for steppe riders, a spired helmet for the armoured
  const hat = (kind) => kind === 'helm'
    ? `<path d="M-3.4-15.6a3.4 3.6 0 0 1 6.8 0z" fill="#a9b0b8" stroke="${ink}" stroke-width=".5"/><path d="M0-19.2v-2.6" stroke="#a9b0b8" stroke-width="1"/><path d="M-3.6-15.4h7.2" stroke="${gold}" stroke-width=".7"/>`
    : kind === 'cap'
      ? `<path d="M-3.6-15.4q0-4.4 3.6-4.6 3.6.2 3.6 4.6z" fill="${dk}" stroke="${ink}" stroke-width=".5"/><path d="M-3.9-15.4h7.8" stroke="#e8dcc0" stroke-width="1.3"/>`
      : `<path d="M-3.8-15.6q0-4 3.8-4.2 3.8.2 3.8 4.2z" fill="#f4efe2" stroke="${ink}" stroke-width=".5"/><path d="M-3.6-17.2q3.6 1.4 7.2 0" stroke="#d9d0bb" stroke-width=".6" fill="none"/><circle cx="0" cy="-19.6" r=".9" fill="${c}"/>`;
  const head = kind => `<circle cx="0" cy="-14" r="2.9" fill="${skin}" stroke="${ink}" stroke-width=".45"/><path d="M-2.2-12.6q2.2 2.4 4.4 0v1.2q-2.2 1.8-4.4 0z" fill="#2b1a10"/>${hat(kind)}`;
  // A standing soldier: kaftan to the knee, gold belt, patterned hem, boots
  const man = (x, y, s, kind, weapon) => `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="6.6" rx="5" ry="1.2" fill="#00000033"/>
    <path d="M-2.4 2.6l-.6 4h2.2l.4-4zM2.4 2.6l.6 4H.8l-.4-4z" fill="#7a1f12" stroke="${ink}" stroke-width=".35"/>
    <path d="M-3.6-10.6h7.2l1.6 13.4h-10.4z" fill="${heavy ? '#8e979e' : c}" stroke="${ink}" stroke-width=".55"/>
    ${heavy ? `<path d="M-3.4-8h6.8M-3.6-5.4h7.2M-3.9-2.8h7.8M-4.2-.2h8.4" stroke="#5d656b" stroke-width=".45"/><path d="M-4.6 1.4h9.2l.4 1.4h-10z" fill="${c}"/>` : `<path d="M0-10.6v13.4" stroke="${dk}" stroke-width=".5"/><path d="M-5 2.8h10" stroke="${gold}" stroke-width=".8" stroke-dasharray=".8 .9"/>`}
    <path d="M-3.9-4.6h7.8" stroke="${gold}" stroke-width="1"/>
    ${head(kind)}${weapon}</g>`;
  const spear = `<path d="M5.2-24v31" stroke="#6b4626" stroke-width="1.1"/><path d="M5.2-27.6l1.4 3.8h-2.8z" fill="#dfe3e6" stroke="${ink}" stroke-width=".3"/><path d="M4.4-22.4h1.6" stroke="${c}" stroke-width="1.6"/>`;
  const shield = `<circle cx="-4.6" cy="-4.6" r="3.6" fill="${dk}" stroke="${gold}" stroke-width=".7"/><circle cx="-4.6" cy="-4.6" r="1" fill="${gold}"/>`;
  const bow = `<path d="M5-17q7 6 0 13" fill="none" stroke="#6b4626" stroke-width="1.2"/><path d="M5-17v13" stroke="#efe6d0" stroke-width=".35"/><path d="M-4-9l-2 8" stroke="${dk}" stroke-width="2.2"/><path d="M-4.6-9.4l.6-1.8M-5.4-9.6l.4-1.8" stroke="${gold}" stroke-width=".4"/>`;
  const sword = `<path d="M4.4-6.6q4-5.6 6.4-11" fill="none" stroke="#dfe3e6" stroke-width="1.2"/><path d="M3.4-6l2.4 1.4" stroke="${gold}" stroke-width="1"/>`;
  const axe = `<path d="M5-20v24" stroke="#6b4626" stroke-width="1.1"/><path d="M5-20q4 1 4 4l-4-.6z" fill="#dfe3e6" stroke="${ink}" stroke-width=".3"/>`;
  // A slim horse with an arched neck and a fringed saddle cloth
  const horse = (x, y, coat, rider, barded) => `<g transform="translate(${x} ${y})">
    <ellipse cx="0" cy="9.6" rx="13" ry="1.6" fill="#00000033"/>
    <path d="M-9 1l-1.6 8.4M-5.4 1.6l.2 8.2M6 1.6l-1.2 8M9.4 .6l1.4 8.6" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M-12 -2q-3 3-2.4 7" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M-12-1.6q0-6 7-6.4h11q2.6-.4 4.4-3.2l2.2-3.4q.8-1.2 2.2-.8l4.6 3q1 .9-.2 1.8l-1.8.4-3-1.2-2 2.8q-1.2 5.4-4.8 8.2-6 2.2-14 1.4-6.6-.6-7.6-3.6z" fill="${coat}" stroke="${ink}" stroke-width=".6"/>
    <path d="M13.4-15.2l.6-2.4" stroke="${ink}" stroke-width=".9"/><path d="M11-12.2q2-1.2 3.2-3.4" stroke="${ink}" stroke-width=".8" fill="none"/>
    ${barded ? `<path d="M-11-3.6h20l-1.6 6.4h-17z" fill="#8e979e" stroke="${ink}" stroke-width=".45"/><path d="M-10.4-.8h18M-9.8 1.6h16" stroke="#5d656b" stroke-width=".4"/>` : `<path d="M-5.6-7.6h9.6l1 7.2h-11.6z" fill="${dk}" stroke="${gold}" stroke-width=".6"/><path d="M-6.2-.4h11.4" stroke="${gold}" stroke-width="1" stroke-dasharray=".6 .8"/>`}
    <g transform="translate(-.6 -9)">${rider}</g></g>`;
  const rider = (kind, weapon) => `<path d="M-1.6 1.4l-1.6 5" stroke="#7a1f12" stroke-width="1.6"/><path d="M-3.4-9.4h6.8l1 9.8h-8.8z" fill="${heavy ? '#8e979e' : c}" stroke="${ink}" stroke-width=".5"/>${heavy ? '<path d="M-3.2-6.6h6.6M-3.4-3.8h7M-3.6-1h7.4" stroke="#5d656b" stroke-width=".4"/>' : ''}<path d="M-3.6-4.4h7.2" stroke="${gold}" stroke-width=".9"/><g transform="translate(0 1.4)">${head(kind)}</g>${weapon}`;
  const lance = `<path d="M3-26l4 30" stroke="#6b4626" stroke-width="1.1"/><path d="M2.6-29.2l1.8 3.6-2.6.4z" fill="#dfe3e6"/><path d="M3.2-25.4l5 1.4-4.4 1.6z" fill="${c}"/>`;
  const hbow = `<path d="M-6-14q-7 6 0 12" fill="none" stroke="#6b4626" stroke-width="1.2"/><path d="M-6-14v12" stroke="#efe6d0" stroke-width=".35"/><path d="M-6-8h9" stroke="#efe6d0" stroke-width=".35"/>`;
  const banner = `<path d="M4-31v34" stroke="#6b4626" stroke-width="1.1"/><path d="M4-31h11l-3 3.6 3 3.6H4z" fill="${c}" stroke="${gold}" stroke-width=".6"/><circle cx="4" cy="-31.6" r="1.1" fill="${gold}"/>`;
  const coats = ['#f1ede4', '#8a5a33', '#3b2a1e', '#c69a62'];
  const kindFoot = heavy ? 'helm' : nomad ? 'cap' : 'turban';
  let body = '';
  switch (d.cls) {
    case 'spear': body = man(20, 36, 1, kindFoot, spear + shield) + man(40, 38, 1.05, kindFoot, spear + shield) + man(60, 36, 1, kindFoot, spear + shield); break;
    case 'missile': body = man(22, 37, 1, nomad ? 'cap' : 'turban', bow) + man(42, 38, 1.04, nomad ? 'cap' : 'turban', bow) + man(62, 37, 1, nomad ? 'cap' : 'turban', bow); break;
    case 'inf': body = man(22, 37, 1, 'helm', type === 'ghuri' ? axe : sword + shield) + man(42, 38, 1.06, 'helm', type === 'ghuri' ? axe : sword + shield) + man(62, 37, 1, 'helm', type === 'ghuri' ? axe : sword + shield); break;
    case 'ha': body = horse(25, 32, coats[1], rider('cap', hbow)) + horse(57, 35, coats[0], rider('cap', hbow)); break;
    case 'cav': {
      const w = type === 'general' ? banner : lance, k = heavy || type === 'general' ? 'helm' : nomad ? 'cap' : 'turban';
      body = horse(25, 32, type === 'general' ? coats[0] : coats[2], rider(k, w), heavy) + horse(57, 35, coats[3], rider(k, type === 'general' ? lance : w), heavy);
      break;
    }
    case 'siege': body = `<path d="M14 42l12-24 12 24M26 18l26-12" stroke="#6b4626" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M26 18l-4 9" stroke="#6b4626" stroke-width="2"/><rect x="18" y="26" width="7" height="6" fill="#5b4a3a" stroke="${ink}" stroke-width=".5"/><path d="M52 6l2 12" stroke="#c9b28a" stroke-width=".6"/><circle cx="54.4" cy="19" r="2.4" fill="#8a8580" stroke="${ink}" stroke-width=".5"/>` + man(66, 37, .95, 'turban', ''); break;
  }
  return `<svg viewBox="0 0 80 48" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="ucpa" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#f3e7c6"/><stop offset="1" stop-color="#cdb27a"/></radialGradient></defs>
    <rect x=".8" y=".8" width="78.4" height="46.4" rx="2.4" fill="url(#ucpa)" stroke="${gold}" stroke-width="1"/>
    <path d="M1 43.6q20-3 39-1t39-.6v4.4H1z" fill="#9aa25a" opacity=".55"/>
    <path d="M6 44l1-2.4 1 2.4M70 43.6l1-2.2 1 2.2M34 44.2l.8-2 .8 2" stroke="#5c6a2a" stroke-width=".7" fill="none"/>
    ${body}</svg>`;
}

function stars(n) { return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)); }

function attitudeWord(att) {
  return t(att >= 50 ? 'Devoted' : att >= 20 ? 'Friendly' : att > -20 ? 'Neutral' : att > -50 ? 'Hostile' : 'Bitter enemy');
}
function attitudeColor(att) { return att >= 20 ? '#5aa55a' : att > -20 ? '#c9b25a' : '#c84a3a'; }
