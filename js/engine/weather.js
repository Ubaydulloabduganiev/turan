'use strict';
// Weather. In spring the rivers rise and may flood a province's fields; in autumn the wind may raise a
// sandstorm over the desert and steppe. Both last one season.

function weatherTurn() {
  G.weather = { flood: null, storm: null };
  const spring = G.turn % 2 === 0;
  if (spring && rng() < 0.35) {
    const rivers = Object.values(G.provinces).filter(p => p.terrain === 'river' && p.pop >= 8);
    if (rivers.length) {
      const p = pick(rivers);
      G.weather.flood = p.id;
      p.pop = Math.max(1, p.pop * 0.97);
      if (isHuman(p.owner)) tell(p.owner, { minor: true, title: t('Floods in {city}', { city: cityOf(p) }), text: t('The spring waters have burst the canals of {city}. Its fields are under water, and this season it pays less tax.', { city: cityOf(p) }), prov: p.id });
    }
  }
  if (!spring && rng() < 0.45) {
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
}
const isFlooded = p => !!(G.weather && G.weather.flood === p.id);
