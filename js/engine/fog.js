'use strict';
// Fog of war. A ruler sees his own lands and the country around them, the land around his armies
// (horsemen scout two provinces out), his allies' lands, and wherever his spies are. Beyond that,
// enemy armies are hidden: they can come out of the fog without warning.

const fogOn = () => !!G && G.fog !== false;
let FOG = null;

function fogKey() {
  const pl = G.player;
  let k = G.turn + '|' + (G.spyTurn || '') + '|';
  for (const a of Object.values(G.armies)) if (a.owner === pl) k += a.prov + ',';
  for (const p of Object.values(G.provinces)) if (p.owner === pl) k += p.idx + '.';
  return k;
}

// The provinces the player can see this moment
function visibleProvs() {
  const key = fogKey();
  if (FOG && FOG.key === key && FOG.g === G) return FOG.set;
  const pl = G.player, set = new Set();
  const around = (pid, steps) => {
    let ring = [pid];
    set.add(pid);
    for (let s = 0; s < steps; s++) {
      const next = [];
      for (const id of ring) for (const n of G.provinces[id].adj) if (!set.has(n)) { set.add(n); next.push(n); }
      ring = next;
    }
  };
  for (const p of Object.values(G.provinces)) {
    if (p.owner === pl) around(p.id, 1);
    else if (p.owner !== 'rebels' && rel(pl, p.owner).alliance) set.add(p.id);
  }
  for (const a of Object.values(G.armies)) {
    if (a.owner !== pl) continue;
    let riders = 0, men = 0;
    for (const u of a.units) { men += u.men; if (UNITS[u.type].cls === 'cav' || UNITS[u.type].cls === 'ha') riders += u.men; }
    around(a.prov, men && riders / men >= 0.4 ? 2 : 1);
  }
  for (const pid in G.spies || {}) if (G.spies[pid] >= G.turn) around(pid, 1);
  FOG = { key, g: G, set };
  return set;
}
const provVisible = pid => !fogOn() || visibleProvs().has(pid);
function armyVisible(a) {
  if (!fogOn() || a.owner === G.player) return true;
  if (a.owner !== 'rebels' && rel(G.player, a.owner).alliance) return true;
  return visibleProvs().has(a.prov);
}

// A spy in a foreign city watches the city and the roads around it for eight turns
function plantSpy(pid) {
  G.spies = G.spies || {};
  G.spies[pid] = G.turn + 8;
  G.spyTurn = (G.spyTurn || 0) + 1;
}
const spyThere = pid => !!(G.spies && G.spies[pid] >= G.turn);

// Old spies go home
function fogTurn() {
  if (!G.spies) return;
  for (const pid in G.spies) if (G.spies[pid] < G.turn) delete G.spies[pid];
}
