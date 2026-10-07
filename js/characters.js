'use strict';
// The people of the age. Rulers, heirs and princes take part in the game; scholars, poets and envoys
// appear in its stories. Birth years follow the sources where they are known and are estimates otherwise.
// look: portrait recipe (hat, beard, colours); see js/ui/portraits.js.

const CHARACTERS = [
  // ----- The house of Temur -----
  { id: 'temur', name: 'Amir Temur', faction: 'temur', born: 1336, died: 1405, role: 'ruler',
    look: { hat: 'crown', beard: 'long', hair: '#8a4a22', robe: '#2f4f8f', trim: '#d8b45a', skin: 1 },
    bio: 'Born near Kesh into the Barlas tribe, lamed in the right leg by arrows in his youth. In 1370 he became Great Amir of the Chagatai Ulus and set out to rebuild the empire of Chinggis Khan.' },
  { id: 'saraymulk', name: 'Saray Mulk Khanum', faction: 'temur', born: 1343, died: 1408, role: 'consort', female: true,
    look: { hat: 'boqta', robe: '#8a2a3a', trim: '#d8b45a', skin: 0 },
    bio: 'A Chinggisid princess, daughter of Qazan Khan. Her marriage to Temur gave him the title Küregen, "royal son-in-law".' },
  { id: 'jahangir', name: 'Jahangir Mirza', faction: 'temur', born: 1356, died: 1376, role: 'prince',
    look: { hat: 'turban', beard: 'none', hair: '#3a2210', robe: '#2a6b5a', trim: '#d8b45a', skin: 1 },
    bio: "Temur's eldest son and first heir. Historically he died young in 1376, a loss his father grieved deeply." },
  { id: 'umarshaikh', name: 'Umar Shaikh Mirza', faction: 'temur', born: 1356, died: 1394, role: 'prince', joins: 1371,
    look: { hat: 'helmet', beard: 'short', hair: '#2a1a0e', robe: '#6a3a2a', trim: '#c9b28a', skin: 1 },
    bio: "Temur's second son, a hard-fighting commander who governed Fergana and later Fars." },
  { id: 'miranshah', name: 'Miran Shah', faction: 'temur', born: 1366, died: 1408, role: 'prince', joins: 1382,
    look: { hat: 'turban', beard: 'short', hair: '#2a1a0e', robe: '#7a2a2a', trim: '#d8b45a', skin: 1 },
    bio: "Temur's third son, conqueror of Herat for his father in 1381 and later governor of Azerbaijan." },
  { id: 'muhammadsultan', name: 'Muhammad Sultan Mirza', faction: 'temur', born: 1375, died: 1403, role: 'prince', joins: 1391,
    look: { hat: 'turban', beard: 'goatee', hair: '#3a2210', robe: '#3a5a8a', trim: '#d8b45a', skin: 0 },
    bio: "Jahangir's son and Temur's favourite grandson, chosen as heir. The Gur-e-Amir was first built as his tomb." },
  { id: 'shahrukh', name: 'Shah Rukh', faction: 'temur', born: 1377, died: 1447, role: 'prince', joins: 1393,
    look: { hat: 'turban', beard: 'short', hair: '#2a1a0e', robe: '#2a6b3a', trim: '#e6d29a', skin: 0 },
    bio: "Temur's youngest son, a pious and patient prince who would rule the empire from Herat for forty years." },
  { id: 'khalilsultan', name: 'Khalil Sultan', faction: 'temur', born: 1384, died: 1411, role: 'prince', joins: 1400,
    look: { hat: 'turban', beard: 'none', hair: '#2a1a0e', robe: '#8a5a1a', trim: '#e6d29a', skin: 0 },
    bio: "Son of Miran Shah, a brave young commander who seized Samarkand after Temur's death." },
  { id: 'ulughbeg', name: 'Ulugh Beg', faction: 'temur', born: 1394, died: 1449, role: 'prince', joins: 1410,
    look: { hat: 'turban', beard: 'none', hair: '#2a1a0e', robe: '#2a3a7a', trim: '#e6d29a', skin: 0 },
    bio: 'Son of Shah Rukh. Astronomer and mathematician; his observatory and star tables made Samarkand famous across the world.' },
  { id: 'sayfnukuz', name: 'Sayf al-Din Nuküz', faction: 'temur', born: 1330, died: 1405, role: 'amir',
    look: { hat: 'helmet', beard: 'long', hair: '#555', robe: '#4a4a3a', trim: '#9a9a8a', skin: 1 },
    bio: "One of Temur's oldest companions and most trusted amirs." },

  // ----- Moghulistan -----
  { id: 'qamaraldin', name: 'Qamar al-Din Dughlat', faction: 'moghul', born: 1325, died: 1392, role: 'ruler',
    look: { hat: 'mongol', beard: 'mustache', hair: '#1a1410', robe: '#2f7a3f', trim: '#c9a85a', skin: 2 },
    bio: 'Dughlat amir who made himself khan of Moghulistan. For twenty years he fought Temur and vanished into the steppe whenever he was beaten.' },
  { id: 'khizrkhoja', name: 'Khizr Khoja', faction: 'moghul', born: 1360, died: 1399, role: 'prince',
    look: { hat: 'mongol', beard: 'goatee', hair: '#1a1410', robe: '#3a6a8a', trim: '#c9a85a', skin: 2 },
    bio: 'A son of the Chagatayid line, hidden from Qamar al-Din as a child. He became khan in 1389 and later made peace with Temur.' },

  // ----- The White Horde -----
  { id: 'urus', name: 'Urus Khan', faction: 'white', born: 1320, died: 1377, role: 'ruler',
    look: { hat: 'fur', beard: 'forked', hair: '#5a5040', robe: '#e6dcc0', trim: '#8a6a2a', skin: 1 },
    bio: 'Khan of the White Horde from Sighnaq. He meant to reunite all the lands of Jochi and drove Mamai’s puppet from Sarai in 1373.' },
  { id: 'toqtaqiya', name: 'Toqtaqiya', faction: 'white', born: 1345, died: 1377, role: 'prince',
    look: { hat: 'fur', beard: 'short', hair: '#2a1a10', robe: '#c9b88a', trim: '#7a5a2a', skin: 1 },
    bio: "Urus Khan's son, who ruled only a few weeks after his father." },
  { id: 'temurmalik', name: 'Temur-Malik', faction: 'white', born: 1348, died: 1378, role: 'prince',
    look: { hat: 'kalpak', beard: 'short', hair: '#2a1a10', robe: '#b8a070', trim: '#6a4a2a', skin: 1 },
    bio: 'Another son of Urus Khan, a fierce warrior but a careless ruler. Toqtamish overthrew him in 1378.' },
  { id: 'toqtamish', name: 'Toqtamish', faction: 'white', born: 1342, died: 1406, role: 'prince',
    look: { hat: 'fur', beard: 'goatee', hair: '#2a1a10', robe: '#a8402c', trim: '#d8b45a', skin: 1 },
    bio: 'A Jochid prince who fled to Temur, then with his help became khan of the White and Golden Hordes, and finally his bitter enemy.' },

  // ----- The Golden Horde -----
  { id: 'mamai', name: 'Beglerbeg Mamai', faction: 'golden', born: 1335, died: 1380, role: 'ruler',
    look: { hat: 'mongol', beard: 'mustache', hair: '#2a1a10', robe: '#b8861a', trim: '#7a1f12', skin: 1 },
    bio: 'A Kiyat noble who ruled the western Golden Horde through puppet khans. His defeat at Kulikovo in 1380 ended his power.' },
  { id: 'muhammadsultankhan', name: 'Muhammad-Sultan', faction: 'golden', born: 1350, died: 1379, role: 'prince',
    look: { hat: 'crown', beard: 'none', hair: '#2a1a10', robe: '#d9a21b', trim: '#7a1f12', skin: 1 },
    bio: "Mamai's puppet khan, a Chinggisid with the right blood but no power of his own." },
  { id: 'edigu', name: 'Edigu', faction: 'golden', born: 1352, died: 1419, role: 'amir', joins: 1372,
    look: { hat: 'kalpak', beard: 'short', hair: '#2a1a10', robe: '#6a4a2a', trim: '#c9a85a', skin: 1 },
    bio: 'An emir of the Manghit tribe, a great general and kingmaker. He would later found the Nogai Horde.' },

  // ----- Khwarezm -----
  { id: 'husaynsufi', name: 'Husayn Sufi', faction: 'khwarezm', born: 1330, died: 1372, role: 'ruler',
    look: { hat: 'turban', beard: 'long', hair: '#3a2a1a', robe: '#6a3a8a', trim: '#d8b45a', skin: 1 },
    bio: 'Chief of the Qungrat tribe who made Khwarezm independent and seized Kath and Khiva from Transoxiana.' },
  { id: 'yusufsufi', name: 'Yusuf Sufi', faction: 'khwarezm', born: 1335, died: 1380, role: 'prince',
    look: { hat: 'turban', beard: 'short', hair: '#3a2a1a', robe: '#4a2a6a', trim: '#c9b28a', skin: 1 },
    bio: "Husayn Sufi's brother and successor, who agreed to marry his niece Khanzada to Temur's son Jahangir." },

  // ----- The Kartids -----
  { id: 'pirali', name: 'Ghiyath al-Din Pir Ali', faction: 'kart', born: 1335, died: 1383, role: 'ruler',
    look: { hat: 'turban', beard: 'long', hair: '#2a1a0e', robe: '#b8502a', trim: '#e6d29a', skin: 0 },
    bio: 'The last great Kart malik of Herat, a patron of builders and poets, who ruled from 1370 until Temur took his city.' },
  { id: 'pirmuhammad', name: 'Pir Muhammad', faction: 'kart', born: 1355, died: 1390, role: 'prince',
    look: { hat: 'turban', beard: 'short', hair: '#2a1a0e', robe: '#8a3a1a', trim: '#e6d29a', skin: 0 },
    bio: "Pir Ali's son and heir, trained to defend the walls of Herat." },

  // ----- The Sarbadars -----
  { id: 'alimuayyad', name: "Khwaja Ali Mu'ayyad", faction: 'sarbadar', born: 1335, died: 1386, role: 'ruler',
    look: { hat: 'taj', beard: 'long', hair: '#2a1a0e', robe: '#2a7a78', trim: '#d8d0b0', skin: 0 },
    bio: 'The last ruler of the Sarbadars of Sabzevar, a Shia lord who kept his small state alive between great powers.' },
  { id: 'ruknaldin', name: 'Darvish Rukn al-Din', faction: 'sarbadar', born: 1340, died: 1381, role: 'amir',
    look: { hat: 'taj', beard: 'forked', hair: '#2a1a0e', robe: '#5a4a3a', trim: '#a89a7a', skin: 1 },
    bio: 'A dervish leader who could raise the poor of Khorasan with a single sermon.' },

  // ----- Notable figures of the age (they appear in stories) -----
  { id: 'naqshband', name: 'Baha al-Din Naqshband', faction: null, born: 1318, died: 1389, role: 'scholar',
    look: { hat: 'taj', beard: 'long', hair: '#ddd', robe: '#5a4a3a', trim: '#a89a7a', skin: 1 },
    bio: 'The Sufi master of Bukhara, founder of the Naqshbandi order, which spread across the Muslim world.' },
  { id: 'hafez', name: 'Hafez of Shiraz', faction: null, born: 1315, died: 1390, role: 'poet',
    look: { hat: 'turban', beard: 'long', hair: '#bbb', robe: '#3a5a4a', trim: '#e6d29a', skin: 0 },
    bio: 'The greatest lyric poet of Persia. A famous legend tells how he met Temur in Shiraz.' },
  { id: 'kamal', name: 'Kamal Khujandi', faction: null, born: 1321, died: 1400, role: 'poet',
    look: { hat: 'turban', beard: 'long', hair: '#ccc', robe: '#4a3a6a', trim: '#e6d29a', skin: 1 },
    bio: 'A poet born in Khujand who lived in Tabriz, admired for his short, polished ghazals.' },
  { id: 'taftazani', name: "Sa'd al-Din Taftazani", faction: null, born: 1322, died: 1390, role: 'scholar',
    look: { hat: 'turban', beard: 'long', hair: '#999', robe: '#2a2a4a', trim: '#c9b28a', skin: 0 },
    bio: "One of the most learned men of his age, master of logic, rhetoric and law, honoured at Temur's court in Samarkand." },
  { id: 'shami', name: 'Nizam al-Din Shami', faction: null, born: 1340, died: 1411, role: 'scholar',
    look: { hat: 'turban', beard: 'short', hair: '#555', robe: '#4a5a3a', trim: '#c9b28a', skin: 0 },
    bio: "A historian whom Temur commissioned to write the Zafarnama, the Book of Victories, in plain Persian." },
  { id: 'ibnkhaldun', name: 'Ibn Khaldun', faction: null, born: 1332, died: 1406, role: 'scholar',
    look: { hat: 'turban', beard: 'long', hair: '#aaa', robe: '#e6dcc0', trim: '#8a6a2a', skin: 0 },
    bio: 'The North African historian and thinker. In 1401, outside Damascus, he spent weeks in conversation with Temur.' },
  { id: 'jurjani', name: 'Mir Sayyid Sharif Jurjani', faction: null, born: 1339, died: 1414, role: 'scholar',
    look: { hat: 'turban', beard: 'long', hair: '#777', robe: '#2a3a5a', trim: '#c9b28a', skin: 0 },
    bio: 'A great master of logic, grammar and theology. Temur brought him from Shiraz to teach in Samarkand.' },
  { id: 'qadizada', name: 'Qadi-zada al-Rumi', faction: null, born: 1364, died: 1436, role: 'scholar',
    look: { hat: 'turban', beard: 'short', hair: '#3a2a1a', robe: '#3a3a6a', trim: '#e6d29a', skin: 0 },
    bio: 'A mathematician and astronomer from Bursa who came to Samarkand. He later taught Ulugh Beg and helped found his observatory.' },
  { id: 'kashi', name: 'Ghiyath al-Din al-Kashi', faction: null, born: 1380, died: 1429, role: 'scholar',
    look: { hat: 'turban', beard: 'short', hair: '#2a1a0e', robe: '#2a5a6a', trim: '#e6d29a', skin: 0 },
    bio: 'A brilliant mathematician and astronomer who calculated the number π to sixteen places, a record that stood for two centuries.' },
  { id: 'maraghi', name: "Abd al-Qadir Maraghi", faction: null, born: 1353, died: 1435, role: 'poet',
    look: { hat: 'turban', beard: 'long', hair: '#4a3a2a', robe: '#6a2a3a', trim: '#e6d29a', skin: 0 },
    bio: 'The finest musician and composer of his time, who wrote books on the theory of music and played at the courts of Tabriz and Samarkand.' },
  { id: 'abdalhayy', name: "Khwaja Abd al-Hayy", faction: null, born: 1350, died: 1405, role: 'poet',
    look: { hat: 'turban', beard: 'short', hair: '#4a3a2a', robe: '#5a4a2a', trim: '#e6d29a', skin: 0 },
    bio: 'A master painter of Baghdad and Tabriz whom Temur brought to Samarkand. His pupils founded the great school of Persian miniature painting.' },
  { id: 'lutfi', name: 'Mawlana Lutfi', faction: null, born: 1366, died: 1465, role: 'poet',
    look: { hat: 'turban', beard: 'long', hair: '#2a1a0e', robe: '#3a6a4a', trim: '#e6d29a', skin: 1 },
    bio: 'A poet of Herat who wrote in Chagatai Turki. Alisher Navoi later called him the king of the poets of his age.' },
  { id: 'yazdi', name: 'Sharaf al-Din Ali Yazdi', faction: null, born: 1370, died: 1454, role: 'scholar',
    look: { hat: 'turban', beard: 'short', hair: '#2a1a0e', robe: '#4a3a2a', trim: '#c9b28a', skin: 0 },
    bio: "A historian and poet who wrote the most famous Zafarnama, the Book of Victories, the great history of Temur's life." },
  { id: 'clavijo', name: 'Ruy González de Clavijo', faction: null, born: 1360, died: 1412, role: 'envoy',
    look: { hat: 'european', beard: 'short', hair: '#4a3020', robe: '#7a1a1a', trim: '#1a1a1a', skin: 0 },
    bio: "Envoy of King Henry III of Castile. His account of Temur's court in Samarkand in 1404 is one of the best we have." },
];

const CHAR_BY_ID = {};
for (const c of CHARACTERS) CHAR_BY_ID[c.id] = c;
function charByName(name) { return CHARACTERS.find(c => c.name === name) || null; }

// Princes come of age (or appear on the scene) in their historical years and take command of an army.
function comingOfAge() {
  G.charsJoined = G.charsJoined || [];
  for (const c of CHARACTERS) {
    if (!c.joins || !c.faction || G.charsJoined.includes(c.id) || year() < c.joins) continue;
    G.charsJoined.push(c.id);
    const st = G.factions[c.faction];
    if (!st || !st.alive) continue;
    const cap = G.provinces[st.capital];
    if (!cap || cap.owner !== c.faction) continue;
    const units = FACTIONS[c.faction].nomad ? ['horsearch', 'horsearch', 'lancer'] : ['spear', 'archer', 'lancer'];
    addArmy(c.faction, cap.id, units, makeGeneral(c.faction, c.name, 2, year() - c.born, false));
    if (c.faction === G.player) {
      log(dateText() + ': ' + t('{name} joins your court and takes command of an army.', { name: pn(c.name) }), 'big');
      HOOKS.notify({ title: pn(c.name), text: t('{name} has come of age and rides out to serve you at the head of his own troops in {city}.', { name: pn(c.name), city: cityOf(cap) }) + ' ' + t(c.bio), who: c.id, prov: cap.id });
    }
  }
}

// Everyone of a faction who is part of the story now: ruler, generals, consort, family yet to come
function courtOf(f) {
  const out = [];
  const st = G.factions[f];
  for (const a of armiesOf(f)) if (a.general) out.push({ name: a.general.name, age: a.general.age, cmd: a.general.cmd, leader: a.general.leader, army: a.id, prov: a.prov });
  if (st.leader && !out.some(x => x.name === st.leader)) out.unshift({ name: st.leader, leader: true });
  for (const c of CHARACTERS) {
    if (c.faction !== f || out.some(x => x.name === c.name)) continue;
    const age = year() - c.born;
    if (c.role === 'consort' && year() < c.died) out.push({ name: c.name, age, consort: true });
    else if (c.joins && !(G.charsJoined || []).includes(c.id) && age >= 0) out.push({ name: c.name, age, child: true });
  }
  out.sort((a, b) => (b.leader - a.leader) || (!!a.child - !!b.child));
  return out;
}
