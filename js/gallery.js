'use strict';
// Real art in the game: Timurid, Persian and Mughal miniatures for the people and the great scenes, and
// paintings and photographs of the special places. Sources and licences: js/credits.js.

const G_ = 'img/portraits/gen/';
const ART = {
  // Portraits of historical people, by character id. Where no likeness survives, a figure from a
  // miniature painted at the Timurid courts stands in.
  portraits: {
    temur: 'img/portraits/temur.jpg', shahrukh: 'img/portraits/shahrukh.jpg', ulughbeg: 'img/portraits/ulughbeg.jpg',
    miranshah: 'img/portraits/miranshah.jpg', umarshaikh: 'img/portraits/umarshaikh.jpg', sayfnukuz: 'img/portraits/sayfnukuz.jpg',
    saraymulk: 'img/portraits/saraymulk.jpg', toqtamish: 'img/portraits/toqtamish.jpg', hafez: 'img/portraits/hafez.jpg',
    toqtaqiya: 'img/portraits/toqtaqiya.jpg', kamal: 'img/portraits/kamal.jpg', shami: 'img/portraits/shami.jpg',
    naqshband: 'img/portraits/naqshband.jpg', pirali: 'img/portraits/pirali.jpg', edigu: 'img/portraits/edigu.jpg',
    muhammadsultankhan: 'img/portraits/muhammadsultankhan.jpg', clavijo: 'img/portraits/clavijo.jpg', ibnkhaldun: G_ + 'persian1.jpg',
    jahangir: G_ + 'turkic2.jpg', muhammadsultan: G_ + 'mongol3.jpg', khalilsultan: G_ + 'turkic4.jpg',
    qamaraldin: G_ + 'mongol1.jpg', khizrkhoja: G_ + 'mongol2.jpg', urus: G_ + 'turkic3.jpg', temurmalik: G_ + 'soldier1.jpg',
    mamai: G_ + 'mongol4.jpg', husaynsufi: G_ + 'persian3.jpg', yusufsufi: G_ + 'persian1.jpg',
  },
  // Figures from period miniatures, for everyone the chronicles did not paint
  generic: {
    turkic: [G_ + 'turkic2.jpg', G_ + 'turkic3.jpg', G_ + 'turkic4.jpg', G_ + 'soldier1.jpg', G_ + 'mongol3.jpg'],
    mongol: [G_ + 'mongol1.jpg', G_ + 'mongol2.jpg', G_ + 'mongol3.jpg', G_ + 'mongol4.jpg', G_ + 'soldier1.jpg'],
    persian: [G_ + 'persian1.jpg', G_ + 'persian3.jpg', G_ + 'turkic2.jpg', G_ + 'turkic4.jpg'],
    female: [G_ + 'female1.jpg', G_ + 'female5.jpg', G_ + 'female6.jpg', G_ + 'female7.jpg', G_ + 'female8.jpg'],
    young: [G_ + 'young1.jpg'],
  },
  // Story figures
  types: { ming: 'img/portraits/ming.jpg', genoese: 'img/portraits/clavijo.jpg', soldier: G_ + 'soldier1.jpg', merchant: G_ + 'persian1.jpg', herder: G_ + 'mongol2.jpg', pretender: G_ + 'mongol4.jpg', spy: G_ + 'turkic3.jpg' },
  scenes: {
    wedding: 'img/scenes/wedding.jpg', coronation: 'img/scenes/coronation.jpg',
    conquest: 'img/scenes/conquest.jpg', birth: 'img/scenes/birth.jpg',
  },
  places: {},
  title: 'img/title.jpg',
  // Where the slow camera drifts in each picture
  focus: {
    'img/scenes/wedding.jpg': { focus: [0.72, 0.45] },
    'img/scenes/coronation.jpg': { focus: [0.5, 0.55] },
    'img/scenes/conquest.jpg': { focus: [0.62, 0.3] },
    'img/scenes/birth.jpg': { focus: [0.62, 0.35] },
  },
};
// Special places, when their picture is present
for (const id of ['afrasiyab', 'samanid', 'irongate', 'horses', 'issykkul', 'tashrabat', 'jade', 'ulytau', 'caviar', 'ayazkala', 'bamiyan', 'turquoise', 'lapis', 'merv', 'altai'])
  ART.places[id] = 'img/places/' + id + '.jpg';
