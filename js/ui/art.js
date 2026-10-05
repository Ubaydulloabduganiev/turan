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
function unitSVG(type, f) {
  const c = FACTIONS[f] ? FACTIONS[f].color : '#888', dk = FACTIONS[f] ? FACTIONS[f].dark : '#444';
  const d = UNITS[type];
  const man = (x, y, s = 1, weapon = '') =>
    `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-15" r="3.2" fill="#e8c9a0"/><path d="M-3.8-17.5h7.6l-1-2.5h-5.6z" fill="${dk}"/>` +
    `<path d="M-4-11h8l1 9h-10z" fill="${c}" stroke="${dk}" stroke-width="0.8"/><path d="M-3-2v8M3-2v8" stroke="#3a2a1a" stroke-width="2"/>${weapon}</g>`;
  const spear = '<path d="M5-26v30" stroke="#6b4a2a" stroke-width="1.3"/><path d="M5-29l1.6 4h-3.2z" fill="#ccc"/>';
  const bow = '<path d="M5-18q6 6 0 12" fill="none" stroke="#6b4a2a" stroke-width="1.5"/><path d="M5-18v12" stroke="#ddd" stroke-width="0.5"/>';
  const sword = '<path d="M5-10l6-9" stroke="#ccc" stroke-width="1.6"/>';
  const horse = (x, y, rider) =>
    `<g transform="translate(${x} ${y})"><path d="M-14 0c0-6 4-8 10-8h10l6-6 4 2-3 6c0 6-2 8-5 8h-16c-3 0-6 0-6-2z" fill="#7a5a3a" stroke="#3a2a1a" stroke-width="0.8"/>` +
    `<path d="M-11 0v9M-6 0v9M5 0v9M9 0v9" stroke="#3a2a1a" stroke-width="2"/><path d="M-14-2l-4 5" stroke="#3a2a1a" stroke-width="2"/>${rider}</g>`;
  const rider = w => `<g transform="translate(-1 -6)"><circle cx="0" cy="-13" r="3" fill="#e8c9a0"/><path d="M-3.5-15.5h7l-1-2.5h-5z" fill="${dk}"/><path d="M-4-10h8l1 9h-10z" fill="${c}" stroke="${dk}" stroke-width="0.8"/>${w}</g>`;
  let body = '';
  switch (d.cls) {
    case 'spear': body = man(22, 38, 1, spear) + man(40, 40, 1, spear) + man(58, 38, 1, spear); break;
    case 'missile': body = man(24, 39, 1, bow) + man(44, 39, 1, bow) + man(62, 39, 1, bow); break;
    case 'inf': body = man(24, 39, 1, sword) + man(42, 40, 1.05, sword) + man(60, 39, 1, sword); break;
    case 'ha': body = horse(28, 33, rider(bow)) + horse(58, 36, rider(bow)); break;
    case 'cav': body = horse(28, 33, rider(type === 'general' ? '<path d="M6-30v26" stroke="#6b4a2a" stroke-width="1.3"/><path d="M6-30h10l-3 4 3 4H6z" fill="' + c + '"/>' : spear)) + horse(58, 36, rider(spear)); break;
    case 'siege': body = '<path d="M20 42l14-26 14 26M34 16l22-10" stroke="#5a3a1f" stroke-width="3" fill="none"/><circle cx="56" cy="6" r="3" fill="#555"/>' + man(66, 40, 0.9, ''); break;
  }
  return `<svg viewBox="0 0 80 48" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

function stars(n) { return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)); }

function attitudeWord(att) {
  return att >= 50 ? 'Devoted' : att >= 20 ? 'Friendly' : att > -20 ? 'Neutral' : att > -50 ? 'Hostile' : 'Bitter enemy';
}
function attitudeColor(att) { return att >= 20 ? '#5aa55a' : att > -20 ? '#c9b25a' : '#c84a3a'; }
