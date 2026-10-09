'use strict';
// Weather follows the months. In spring the rivers rise and may flood a province's fields; in summer and
// autumn the wind may raise a sandstorm over the desert and steppe; in winter snow closes the mountain
// passes, and armies caught there lose men to the cold.

function weatherTurn() {
  G.weather = { flood: null, storm: null };
  const season = seasonOf(), m = monthOf();
  if (season === 'spring' && rng() < 0.25) {
    const rivers = Object.values(G.provinces).filter(p => p.terrain === 'river' && p.pop >= 8);
    if (rivers.length) {
      const p = pick(rivers);
      G.weather.flood = p.id;
      p.pop = Math.max(1, p.pop * 0.97);
      if (isHuman(p.owner)) tell(p.owner, { minor: true, title: t('Floods in {city}', { city: cityOf(p) }), text: t('The spring waters have burst the canals of {city}. Its fields are under water, and this season it pays less tax.', { city: cityOf(p) }), prov: p.id });
    }
  }
  if (m >= 5 && m <= 9 && rng() < 0.3) {
    const dry = Object.values(G.provinces).filter(p => p.terrain === 'desert' || p.terrain === 'steppe');
    // A storm is likelier where armies are on the move
    const busy = dry.filter(p => armiesIn(p.id).length);
    const pool = busy.length && rng() < 0.6 ? busy : dry;
    if (pool.length) {
      const p = pick(pool);
      G.weather.storm = p.id;
      for (const a of armiesIn(p.id)) {
        for (const u of a.units) u.men = Math.max(1, Math.round(u.men * 0.92));
        if (isHuman(a.owner)) tell(a.owner, { minor: true, title: t('Sandstorm'), text: t('A sandstorm caught our army at {city}. Men and horses were lost in the dust.', { city: cityOf(p) }), prov: p.id });
      }
    }
  }
  if (season === 'winter' && tpy() === 12) {
    // Snow in the passes: armies camped in the mountains outside their own walls suffer
    const told = new Set();
    for (const a of Object.values(G.armies)) {
      const p = G.provinces[a.prov];
      if (!p || p.terrain !== 'mountain' || (p.owner === a.owner && p.b.walls > 0) || rng() > 0.5) continue;
      for (const u of a.units) u.men = Math.max(1, Math.round(u.men * 0.95));
      if (isHuman(a.owner) && !told.has(a.owner + p.id)) { told.add(a.owner + p.id); tell(a.owner, { minor: true, title: t('Snow in the passes'), text: t('Winter has closed the passes around {city}. Our army there loses men to the cold. Bring it down to a city with walls.', { city: cityOf(p) }), prov: p.id }); }
    }
  }
}
const isFlooded = p => !!(G.weather && G.weather.flood === p.id);
