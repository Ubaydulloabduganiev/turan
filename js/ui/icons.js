'use strict';
// One set of icons for the whole interface, drawn in the same hand: fine gold lines on a 24-unit square,
// in the manner of the line work in a Timurid manuscript. icon('coin') gives an inline SVG that takes the
// colour of the text around it.

const ICONS = {
  coin: '<circle cx="12" cy="12" r="8.5" fill="currentColor" fill-opacity=".14"/><circle cx="12" cy="12" r="5.8"/><path d="M9.2 10.6h5.6M9.8 13.4h4.4"/>',
  coins: '<ellipse cx="9" cy="16.5" rx="6" ry="2.5"/><path d="M3 16.5v2c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-2"/><ellipse cx="15" cy="8" rx="6" ry="2.5"/><path d="M9 8v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V8"/><path d="M9 11.5v1"/>',
  flag: '<path d="M5 21V3"/><path d="M5 4h13l-3.5 4.5L18 13H5" fill="currentColor" fill-opacity=".22"/>',
  crown: '<path d="M3.5 17.5 2.5 8l5 4L12 4.5l4.5 7.5 5-4-1 9.5z" fill="currentColor" fill-opacity=".22"/><path d="M4 21h16"/><circle cx="12" cy="13.5" r="1.3" fill="currentColor"/>',
  swords: '<path d="M4 4l10.5 10.5M20 4 9.5 14.5"/><path d="M12.5 16.5l3-3M11.5 16.5l-3-3"/><path d="M15 17l3.5 3.5M9 17l-3.5 3.5"/><path d="M4 4l2.8.4M4 4l.4 2.8M20 4l-2.8.4M20 4l-.4 2.8"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8.2-8 9.3-4.5-1.1-8-4.3-8-9.3V6z" fill="currentColor" fill-opacity=".18"/><path d="M12 7.5l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z"/>',
  horse: '<path d="M16.5 21v-4.5c0-3.2-1-5.3-3.2-6.8l1.2-3-2.2-.6L10.6 3.5 8.8 6.6 5.3 9.2 3.8 12.6l2.1 1.6 3.1-1.6 1.6 1.1C9.5 15.8 9 18 9 21" fill="currentColor" fill-opacity=".2"/><path d="M13.2 6.2c2.4.7 4.6 3 5.4 6.3"/><circle cx="8.7" cy="9.1" r=".8" fill="currentColor"/>',
  camel: '<path d="M3 20v-5c0-2.2 1.3-3.5 3-3.6.8-2.7 2.6-3.6 3.7-.6.9-2.3 2.8-2.6 3.8-.2h2.5l1-3.6h2.6l1.4 1.8-2.1 1v4.2L18 20"/><path d="M7 15.5V20M14 15.5V20"/>',
  castle: '<path d="M3.5 21V9h3V6h2v3h2.5V6h2v3H15V6h2v3h3.5v12z" fill="currentColor" fill-opacity=".16"/><path d="M10 21v-4a2 2 0 0 1 4 0v4M7 13h1M16 13h1"/>',
  dome: '<path d="M5 21v-7a7 7 0 0 1 14 0v7" fill="currentColor" fill-opacity=".16"/><path d="M12 7V3.5M10.5 4.5h3M3 21h18M9.5 21v-3a2.5 2.5 0 0 1 5 0v3"/><path d="M21 21V10l-1-1-1 1v11M3 21V10l1-1 1 1"/>',
  book: '<path d="M3.5 5.5c3-1.2 5.6-1 8.5 1 2.9-2 5.5-2.2 8.5-1v13.5c-3-1.2-5.6-1-8.5 1-2.9-2-5.5-2.2-8.5-1z" fill="currentColor" fill-opacity=".14"/><path d="M12 6.5V20M6 9h3.5M6 12h3.5M14.5 9H18M14.5 12H18"/>',
  scroll: '<path d="M7 4h11a2 2 0 0 1 0 4h-2"/><path d="M16 6v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3h10a3 3 0 0 0 3 3" /><path d="M7 4a2 2 0 0 0-2 2v11M9 9h4M9 12.5h4"/>',
  star: '<rect x="5.5" y="5.5" width="13" height="13" fill="currentColor" fill-opacity=".14"/><rect x="5.5" y="5.5" width="13" height="13" transform="rotate(45 12 12)"/><circle cx="12" cy="12" r="2.4"/>',
  sun: '<circle cx="12" cy="12" r="4.2" fill="currentColor" fill-opacity=".2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  olive: '<path d="M4 20C8 16 12 10 19 4"/><path d="M8 15.5c-2.6.2-4-.8-4.5-2.6 2.6-.4 4.1.6 4.5 2.6zM11 12c-.4-2.6.6-4.1 2.4-4.6.4 2.6-.6 4.1-2.4 4.6zM12.4 10.7c2.4-1 4.1-.5 5.2 1-2.4 1-4.1.5-5.2-1zM15.4 7.3c-.2-2.3.8-3.6 2.5-4 .2 2.3-.8 3.6-2.5 4z" fill="currentColor" fill-opacity=".3"/>',
  rings: '<circle cx="9" cy="13" r="5.5"/><circle cx="15" cy="13" r="5.5"/><path d="M15 7.5l-1.6-2.3h3.2z" fill="currentColor"/>',
  handshake: '<path d="M2.5 11l3.5-3.5 4 1.5 3-1.5 3.5 1 5 3.5"/><path d="M6 13.5l4 4c.8.8 2 .8 2.8 0l4.7-4.7M9 11l3.3-1.8c.6-.3 1.4-.2 1.9.3l3.3 3.5"/><path d="M8 15.5l-1.5 1.5M10.5 18l-1.5 1.5"/>',
  hourglass: '<path d="M6 3h12M6 21h12"/><path d="M7.5 3c0 4.5 9 5.5 9 9s-9 4.5-9 9M16.5 3c0 4.5-9 5.5-9 9s9 4.5 9 9"/><path d="M9.5 19.5h5l-2.5-2z" fill="currentColor"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>',
  flame: '<path d="M12 2.5c1 4.5 6.5 6.5 6.5 12a6.5 6.5 0 0 1-13 0c0-3.2 2-4.6 2.3-7.5 2 1.3 3 3.3 3 5.5 1.3-2.3 1.7-5.8 1.2-10z" fill="currentColor" fill-opacity=".22"/>',
  check: '<path d="M4.5 12.5l5 5L19.5 6.5"/>',
  cross: '<path d="M6 6l12 12M18 6 6 18"/>',
  sail: '<path d="M2.5 17h19l-3.2 4H5.7z" fill="currentColor" fill-opacity=".22"/><path d="M12 2.5V17"/><path d="M12 3.5 19.5 15H12z" fill="currentColor" fill-opacity=".22"/><path d="M11 6 5 14h6"/>',
  heart: '<path d="M12 20.5S3.5 15 3.5 9.2A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.5 2.6C20.5 15 12 20.5 12 20.5z" fill="currentColor" fill-opacity=".22"/>',
  skull: '<path d="M12 3c-4.7 0-8 3.2-8 7.5 0 2.6 1.3 4.4 3 5.3V19h10v-3.2c1.7-.9 3-2.7 3-5.3C20 6.2 16.7 3 12 3z"/><circle cx="9" cy="11" r="1.8" fill="currentColor"/><circle cx="15" cy="11" r="1.8" fill="currentColor"/><path d="M10 19v2M14 19v2M12 14l-1 2h2z"/>',
  bow: '<path d="M6 3c8 3 10 15 0 18"/><path d="M6 3v18"/><path d="M3 12h18M18 9.5 21 12l-3 2.5M5 10.5 3 12l2 1.5"/>',
  scales: '<path d="M12 3.5V20M8 20.5h8M4.5 7h15"/><path d="M4.5 7 2 13a2.6 2.2 0 0 0 5 0zM19.5 7 17 13a2.6 2.2 0 0 0 5 0z" fill="currentColor" fill-opacity=".2"/><circle cx="12" cy="4.5" r="1.2" fill="currentColor"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.4-4 2.8-6.3 6-6.3s5.6 2.3 6 6.3"/><circle cx="16.5" cy="7" r="2.6"/><path d="M15.5 12c2.8 0 4.9 2.1 5.5 5.5"/>',
  walls: '<path d="M2.5 20.5V11h3V8.5h2.5V11h3V8.5h2V11h3V8.5h2.5V11h3v9.5z" fill="currentColor" fill-opacity=".16"/><path d="M2.5 15h19M7 15v5.5M12 11v4M17 15v5.5"/>',
  mountain: '<path d="M2 20 9 7.5l4 6.5 3-4 6 10z" fill="currentColor" fill-opacity=".18"/><path d="M7.4 10.4 9 11.5l1.6-1.1"/>',
  silk: '<path d="M6 4h12M6 20h12"/><path d="M8 4v16M16 4v16"/><path d="M8 8l8 2M8 11l8 2M8 14l8 2" opacity=".8"/><path d="M16 17c2 0 3.5.5 4.5 2"/>',
  astrolabe: '<circle cx="12" cy="13.5" r="7"/><circle cx="12" cy="13.5" r="3.6"/><path d="M12 6.5V3.8M10.5 3.8h3M5.5 13.5h13M8 9l8 9"/><circle cx="12" cy="13.5" r=".9" fill="currentColor"/>',
  quill: '<path d="M20 3.5C12 4.5 7 10 5.5 18.5L4 21"/><path d="M20 3.5c-1 5.5-4.5 10-10.5 11.5"/><path d="M8 13.5l3.5-.5M10 10.5l3.8-.6M12.5 7.5l3.8-.4"/>',
  seal: '<circle cx="12" cy="10" r="6.5" fill="currentColor" fill-opacity=".16"/><circle cx="12" cy="10" r="3.8"/><path d="M8.5 15.5 7 21l5-2.5 5 2.5-1.5-5.5"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3.2" fill="currentColor" fill-opacity=".25"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
  hammer: '<path d="M14 4.5 19.5 10M11.5 7 17 12.5M13 5.5l-2-1.5-3 1 2.5 2.5"/><path d="M14.2 9.8 4 20" stroke-width="2.4"/>',
  spear: '<path d="M4 20 18.5 5.5"/><path d="M18.5 5.5 21 3l-.6 3.4-1.9-.9z" fill="currentColor"/><path d="M14 10l3.5 1-1 3.5-3.5-1z" fill="currentColor" fill-opacity=".3"/>',
  letter: '<rect x="3" y="5.5" width="18" height="13" rx="1.2"/><path d="m3.5 6.5 8.5 7 8.5-7"/><circle cx="12" cy="15" r="2" fill="currentColor"/>',
  medal: '<path d="M8 3l2.5 7M16 3l-2.5 7"/><circle cx="12" cy="15" r="5.5" fill="currentColor" fill-opacity=".2"/><path d="M12 12l.9 1.9 2.1.3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.4 2.1-.3z" fill="currentColor"/>',
  trophy: '<path d="M7 3.5h10v5a5 5 0 0 1-10 0z" fill="currentColor" fill-opacity=".2"/><path d="M7 5.5H4c0 3 1.2 4.5 3.3 5M17 5.5h3c0 3-1.2 4.5-3.3 5M12 13.5v3.5M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
  horn: '<path d="M3 15c5 0 11-2.5 15-9l2 1.5c-2 6-7 10-14 11.5z" fill="currentColor" fill-opacity=".2"/><path d="M3 15v3.5M7 14.5l1 3.5"/>',
  banner: '<path d="M6 21V3"/><path d="M6 4h12v10l-3-2-3 2-3-2-3 2" fill="currentColor" fill-opacity=".22"/>',
  dove: '<path d="M3 13c3 .5 5.5-.5 7.5-3L14 5.5c1 2 1 4 0 6 3-1.5 5-1.5 7-.5-2 3-5 5.5-9.5 6L9 20l-.5-3C6 17 4 15.5 3 13z" fill="currentColor" fill-opacity=".2"/><circle cx="15.5" cy="8" r=".6" fill="currentColor"/>',
  chain: '<rect x="2.5" y="9" width="10" height="6" rx="3"/><rect x="11.5" y="9" width="10" height="6" rx="3"/>',
  dagger: '<path d="M12 2.5l2 3v9h-4v-9z" fill="currentColor" fill-opacity=".22"/><path d="M7.5 14.5h9M12 14.5V19"/><circle cx="12" cy="20.5" r="1.4"/>',
  cup: '<path d="M5.5 5h13l-1.5 8a5 5 0 0 1-10 0z" fill="currentColor" fill-opacity=".2"/><path d="M12 18v3M8.5 21.5h7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  left: '<path d="M8 6a8 8 0 1 1-2.5 9"/><path d="M8 2.5V6.5H4"/>',
  right: '<path d="M16 6a8 8 0 1 0 2.5 9"/><path d="M16 2.5V6.5H20"/>',
  arrow: '<path d="M4 12h15M14 7l5 5-5 5"/>',
  diamond: '<path d="M12 3l7 9-7 9-7-9z" fill="currentColor" fill-opacity=".3"/>',
  order: '<path d="M9 4.5h6M12 2.5v2"/><path d="M8 7.5h8l-1.2 9.5H9.2z" fill="currentColor" fill-opacity=".2"/><path d="M7 17h10M10 20.5h4M12 17v3.5M10.5 10.5h3"/>',
  terrain: '<path d="M2 19c3-4 5-5 7-5s3 1.5 5 1.5 4-2.5 8-6.5" /><path d="M2 21h20"/><path d="M14 5l2.5 3H11.5z" fill="currentColor" fill-opacity=".3"/>',
  income: '<path d="M4 18 9.5 12.5l3.5 3.5L20 9"/><path d="M15 9h5v5"/>',
};

// An inline SVG icon. `cls` adds classes, `title` a tooltip.
function icon(name, cls = '', title = '') {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${title ? `<title>${title}</title>` : ''}${body}</svg>`;
}
// Old marks in saved texts and data become icons
const GLYPH_ICON = { '⚔': 'swords', '🏰': 'castle', '⚑': 'banner', '♛': 'crown', '🙇': 'seal', '👑': 'crown', '🐎': 'horse', '✧': 'star', '🐪': 'camel',
  '✦': 'star', '☀': 'sun', '🗓': 'calendar', '🔥': 'flame', '⚖': 'scales', '💍': 'rings', '❦': 'rings', '🤝': 'handshake', '🐫': 'camel', '☮': 'dove',
  '🛡': 'shield', '💰': 'coins', '🕌': 'dome', '🏛': 'star', '📜': 'scroll', '☼': 'astrolabe', '🌟': 'sun', '⏳': 'hourglass', '📖': 'book', '➶': 'bow',
  '☠': 'skull', '✓': 'check', '❤': 'heart', '⛵': 'sail', '▶': 'play', '✕': 'cross', '★': 'star' };
const glyphIcon = (g, cls) => GLYPH_ICON[g] ? icon(GLYPH_ICON[g], cls) : g;
