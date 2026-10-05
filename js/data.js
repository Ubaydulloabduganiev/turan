'use strict';
// Historical setting: Turkistan in the spring of 1370, the year Amir Temur took power at Balkh.
// Provinces are placed by real longitude/latitude; a few borders and allegiances are simplified for play.

const GAME = {
  START_YEAR: 1370,
  MAX_ARMY: 16,
  SEASONS: ['Spring', 'Autumn'],
};

// nomad: steppe people (horse units need no stables, cities rarely accept them gladly)
const FACTIONS = {
  temur: {
    name: 'Amir Temur', full: 'Chagatai Ulus of Amir Temur', adj: 'Temurid', color: '#2f6fb3', dark: '#1b416b',
    capital: 'samarkand', nomad: false, difficulty: 'Easy', title: 'Great Amir of Transoxiana', leader: 'Amir Temur', heir: 'Jahangir Mirza',
    generals: [['Amir Temur', 5, 34], ['Jahangir Mirza', 2, 14], ['Sayf al-Din Nuküz', 3, 40]],
    unique: 'tovachi', names: 'turkic',
    blurb: 'Temur, of the Barlas tribe of Kesh, has just beaten his old ally Amir Husayn at Balkh. In April 1370 a kurultai proclaimed him Great Amir of the Chagatai Ulus. Because he is not descended from Chinggis Khan, he rules in the name of a puppet khan, Soyurghatmish, and married the Chinggisid princess Saray Mulk Khanum to call himself Küregen, the "royal son-in-law". Transoxiana is rich, its cities are loyal, and its army is the best on the map, but every neighbour fears him.',
    play: 'Strong start with rich oasis cities. Expand into Khwarezm, Moghulistan and Khorasan, as Temur did.',
  },
  moghul: {
    name: 'Moghulistan', full: 'Khanate of Moghulistan', adj: 'Moghul', color: '#3f8f4f', dark: '#245a2f',
    capital: 'almaliq', nomad: true, difficulty: 'Normal', title: 'Khan of Moghulistan', leader: 'Qamar al-Din Dughlat', heir: 'Khizr Khoja',
    generals: [['Qamar al-Din Dughlat', 4, 45], ['Khizr Khoja', 2, 20]],
    unique: 'dughlat', names: 'mongol',
    blurb: 'The eastern half of the old Chagatai Khanate: the grasslands of Zhetysu, the Ili and the Tian Shan, with the oasis towns of Kashgar and Fergana. After the death of Ilyas Khoja, the Dughlat amir Qamar al-Din made himself khan, the only Dughlat ever to do so. Temur will invade again and again; historically the Moghuls survived by retreating into the endless steppe.',
    play: 'Huge but thinly peopled. Swarms of cheap horse archers; hold the passes and raid the rich west.',
  },
  white: {
    name: 'White Horde', full: 'White Horde (Aq Orda)', adj: 'Aq Orda', color: '#cfc6a8', dark: '#7d7458',
    capital: 'sighnaq', nomad: true, difficulty: 'Normal', title: 'Khan of the White Horde', leader: 'Urus Khan', heir: 'Toqtaqiya',
    generals: [['Urus Khan', 3, 50], ['Toqtaqiya', 1, 25], ['Temur-Malik', 2, 22]],
    unique: 'kipchak', names: 'turkic',
    blurb: 'The eastern wing of the Jochid ulus, ruling the Kipchak steppe from Sighnaq on the Syr Darya. Urus Khan (r. 1369–1377) dreams of reuniting the whole Golden Horde and marched on Sarai in 1373. His young rival Toqtamish will flee to Temur for help, a quarrel that shaped the next thirty years.',
    play: 'Vast empty steppe and very little gold. Take the Syr Darya towns and push towards Sarai or Transoxiana.',
  },
  golden: {
    name: 'Golden Horde', full: 'Golden Horde (Ulus of Jochi)', adj: 'Jochid', color: '#d9a21b', dark: '#86630f',
    capital: 'sarai', nomad: true, difficulty: 'Normal', title: 'Beglerbeg of the Golden Horde', leader: 'Beglerbeg Mamai', heir: 'Muhammad-Sultan',
    generals: [['Beglerbeg Mamai', 4, 45], ['Muhammad-Sultan', 1, 20]],
    unique: 'ordu', names: 'turkic',
    blurb: 'The great Jochid empire on the Volga, torn by the "Great Troubles" since 1359. The real power is the beglerbeg Mamai, a Kiyat noble who is not of Chinggis\'s line and rules through puppet khans. Sarai is the richest trading city on the northern Silk Road, but enemies press from the east and from Russia. Mamai will meet disaster at Kulikovo in 1380.',
    play: 'Rich capital and strong cavalry, but a long open frontier. Unite the steppe before the White Horde does.',
  },
  khwarezm: {
    name: 'Khwarezm', full: 'Khwarezm under the Sufi dynasty', adj: 'Khwarezmian', color: '#8a4fa6', dark: '#552f68',
    capital: 'urgench', nomad: false, difficulty: 'Hard', title: 'Amir of Khwarezm', leader: 'Husayn Sufi', heir: 'Yusuf Sufi',
    generals: [['Husayn Sufi', 3, 45], ['Yusuf Sufi', 2, 35]],
    unique: 'qangli', names: 'turkic',
    blurb: 'The ancient oasis of the lower Amu Darya. Husayn Sufi of the Qungrat tribe broke away from the Golden Horde around 1361, took Urgench, and then seized Kath and Khiva from Transoxiana. His refusal to give them back brought Temur\'s armies in 1372; historically Urgench fell for good in 1379.',
    play: 'A small rich island between the deserts. Fortify Urgench and strike before Temur is ready.',
  },
  kart: {
    name: 'Kartids of Herat', full: 'Kart dynasty of Herat', adj: 'Kartid', color: '#c9572c', dark: '#7c3218',
    capital: 'herat', nomad: false, difficulty: 'Hard', title: 'Malik of Herat', leader: 'Ghiyath al-Din Pir Ali', heir: 'Pir Muhammad',
    generals: [['Ghiyath al-Din Pir Ali', 2, 35], ['Pir Muhammad', 1, 15]],
    unique: 'ghuri', names: 'persian',
    blurb: 'A Tajik dynasty, related to the Ghurids, ruling Herat since 1245. In 1370 Ghiyath al-Din Pir Ali has just inherited the throne from his father Mu\'izz al-Din Husayn, but his step-brother holds Sarakhs. Herat is one of the jewels of Khorasan, with strong walls and fine workshops. Temur took it in 1381.',
    play: 'Rich, well-walled and mountainous. Unite Khorasan before the steppe armies arrive.',
  },
  sarbadar: {
    name: 'Sarbadars', full: 'Sarbadar state of Sabzevar', adj: 'Sarbadar', color: '#2a8c8a', dark: '#175553',
    capital: 'sabzevar', nomad: false, difficulty: 'Hard', title: 'Lord of Sabzevar', leader: "Khwaja Ali Mu'ayyad", heir: 'Darvish Rukn al-Din',
    generals: [["Khwaja Ali Mu'ayyad", 2, 35], ['Darvish Rukn al-Din', 2, 30]],
    unique: 'dervish', names: 'persian',
    blurb: 'The "heads on the gallows": in 1337 the people of Sabzevar rose against their Mongol lords and swore they would rather hang than submit. Led by a mix of Shia dervishes and local nobles, the Sarbadars have held western Khorasan for a generation. Khwaja Ali Mu\'ayyad submitted to Temur in 1381.',
    play: 'Few lands but fanatical infantry. Survive between Herat, the Caspian lords and the steppe.',
  },
  rebels: {
    name: 'Independent', full: 'Independent lords and tribes', adj: 'Independent', color: '#8c8273', dark: '#58514a',
    capital: null, nomad: false, names: 'persian', unique: null, generals: [],
  },
};
const PLAYABLE = ['temur', 'moghul', 'white', 'golden', 'khwarezm', 'kart', 'sarbadar'];

const TERRAIN = {
  oasis: { name: 'Oasis', tax: 9, grow: 1.0, color: '#b7a76a' },
  river: { name: 'River valley', tax: 8, grow: 1.0, color: '#a9a76a' },
  steppe: { name: 'Steppe', tax: 4, grow: 0.6, color: '#b9b07a' },
  desert: { name: 'Desert', tax: 3, grow: 0.3, color: '#d2bb84' },
  mountain: { name: 'Mountains', tax: 5, grow: 0.6, color: '#9b8f72' },
};

// [id, region, city, lon, lat, owner, population (thousands), terrain, on the Silk Road,
//  [walls, barracks, stables, market, farms, madrasa], starting garrison]
const PROVINCE_DATA = [
  // Chagatai Ulus of Amir Temur (Transoxiana)
  ['samarkand', 'Samarkand', 'Samarkand', 66.96, 39.65, 'temur', 60, 'oasis', 1, [3, 2, 2, 3, 2, 2], 'spear spear archer archer horsearch'],
  ['kesh', 'Kesh', 'Shahrisabz', 66.3, 38.85, 'temur', 22, 'oasis', 0, [1, 1, 2, 1, 1, 1], 'spear archer'],
  ['bukhara', 'Bukhara', 'Bukhara', 64.42, 39.77, 'temur', 45, 'oasis', 1, [2, 1, 1, 2, 2, 3], 'spear archer'],
  ['termez', 'Termez', 'Termez', 67.5, 37.4, 'temur', 18, 'river', 1, [2, 1, 1, 1, 1, 1], 'spear'],
  ['balkh', 'Balkh', 'Balkh', 66.7, 36.6, 'temur', 25, 'oasis', 1, [2, 1, 1, 2, 1, 2], 'spear archer'],
  ['jizzakh', 'Ustrushana', 'Jizzakh', 68.0, 40.1, 'temur', 12, 'oasis', 1, [1, 1, 1, 0, 1, 0], 'militia'],
  ['tashkent', 'Shash', 'Tashkent', 69.25, 41.3, 'temur', 25, 'oasis', 1, [2, 1, 1, 1, 1, 1], 'spear archer'],
  ['khujand', 'Khujand', 'Khujand', 69.6, 40.28, 'temur', 15, 'river', 1, [1, 1, 0, 1, 1, 0], 'militia'],
  ['shiberghan', 'Jowzjan', 'Shiberghan', 65.75, 36.66, 'temur', 10, 'steppe', 0, [1, 0, 1, 0, 0, 0], 'militia'],
  ['chaghaniyan', 'Chaghaniyan', 'Denov', 67.9, 38.3, 'temur', 10, 'mountain', 0, [1, 0, 0, 0, 1, 0], 'militia'],

  // Moghulistan
  ['almaliq', 'Ili Upstream', 'Almaliq', 80.6, 44.0, 'moghul', 15, 'steppe', 1, [1, 0, 2, 1, 0, 1], 'horsearch horsearch lancer'],
  ['ili', 'Ili Valley', 'Almaty', 76.9, 43.25, 'moghul', 10, 'steppe', 1, [0, 0, 1, 0, 0, 0], 'horsearch'],
  ['chu', 'Chu Valley', 'Balasagun', 75.3, 42.8, 'moghul', 8, 'steppe', 1, [1, 0, 1, 0, 0, 0], 'horsearch'],
  ['issykkul', 'Issyk-Kul', 'Barskhan', 77.9, 42.2, 'moghul', 6, 'mountain', 0, [0, 0, 1, 0, 0, 0], 'militia'],
  ['talas', 'Talas', 'Taraz', 71.4, 42.9, 'moghul', 10, 'steppe', 1, [1, 0, 1, 0, 0, 0], 'horsearch'],
  ['fergana', 'Fergana', 'Andijan', 72.34, 40.78, 'moghul', 30, 'oasis', 1, [1, 1, 1, 1, 1, 1], 'spear archer'],
  ['kashgar', 'Kashgar', 'Kashgar', 75.98, 39.47, 'moghul', 30, 'oasis', 1, [2, 1, 1, 2, 1, 1], 'spear archer horsearch'],
  ['yarkand', 'Yarkand', 'Yarkand', 77.25, 38.4, 'moghul', 20, 'oasis', 1, [1, 0, 0, 1, 1, 1], 'militia archer'],
  ['aksu', 'Aksu', 'Aksu', 80.26, 41.17, 'moghul', 12, 'oasis', 1, [1, 0, 1, 1, 0, 0], 'militia'],
  ['kucha', 'Kucha', 'Kucha', 82.96, 41.72, 'moghul', 12, 'oasis', 1, [1, 0, 0, 1, 1, 0], 'militia'],
  ['zhetysu', 'Zhetysu', 'Karatal', 79.2, 45.1, 'moghul', 6, 'steppe', 0, [0, 0, 1, 0, 0, 0], 'horsearch'],
  ['tarbagatai', 'Tarbagatai', 'Emil', 83.0, 46.7, 'moghul', 5, 'steppe', 0, [0, 0, 1, 0, 0, 0], 'horsearch'],

  // White Horde
  ['sighnaq', 'Lower Syr', 'Sighnaq', 68.2, 44.1, 'white', 15, 'river', 1, [2, 0, 2, 1, 0, 1], 'horsearch horsearch lancer spear'],
  ['jend', 'Syr Delta', 'Jend', 64.5, 44.3, 'white', 8, 'river', 0, [1, 0, 1, 0, 0, 0], 'horsearch'],
  ['ulytau', 'Ulytau', 'Ulytau', 67.0, 48.2, 'white', 5, 'steppe', 0, [0, 0, 1, 0, 0, 0], 'horsearch'],
  ['turgai', 'Turgai', 'Turgai', 63.5, 49.8, 'white', 4, 'steppe', 0, [0, 0, 1, 0, 0, 0], 'horsearch'],
  ['saryarka', 'Sary-Arka', 'Karkaraly', 73.0, 49.5, 'white', 5, 'steppe', 0, [0, 0, 1, 0, 0, 0], 'horsearch'],
  ['ishim', 'Ishim', 'Ishim', 69.5, 51.3, 'white', 4, 'steppe', 0, [0, 0, 1, 0, 0, 0], 'militia'],
  ['irgiz', 'Irgiz', 'Irgiz', 61.0, 48.3, 'white', 4, 'steppe', 0, [0, 0, 1, 0, 0, 0], 'horsearch'],
  ['betpakdala', 'Betpak-Dala', 'Moyynkum', 70.8, 45.8, 'white', 2, 'desert', 0, [0, 0, 0, 0, 0, 0], 'militia'],

  // Golden Horde
  ['sarai', 'Lower Volga', 'Sarai', 46.8, 48.2, 'golden', 45, 'river', 1, [2, 1, 2, 3, 0, 2], 'horsearch horsearch lancer heavycav spear archer'],
  ['hajjitarkhan', 'Volga Delta', 'Hajji Tarkhan', 48.0, 46.35, 'golden', 15, 'river', 1, [1, 1, 1, 2, 0, 1], 'spear horsearch'],
  ['ukek', 'Upper Volga', 'Ukek', 46.5, 51.3, 'golden', 8, 'river', 0, [1, 0, 1, 1, 0, 0], 'militia'],
  ['saraichik', 'Yaik Mouth', 'Saraichik', 51.9, 47.4, 'golden', 10, 'river', 1, [1, 0, 1, 1, 0, 1], 'horsearch'],
  ['yaik', 'Yaik', 'Yaik', 51.4, 51.0, 'golden', 5, 'steppe', 0, [0, 0, 1, 0, 0, 0], 'horsearch'],
  ['emba', 'Emba', 'Emba', 55.0, 47.5, 'golden', 4, 'steppe', 0, [0, 0, 1, 0, 0, 0], 'horsearch'],
  ['mugodzhar', 'Mugodzhar', 'Mugodzhar', 57.8, 50.0, 'golden', 4, 'steppe', 0, [0, 0, 1, 0, 0, 0], 'horsearch'],
  ['mangyshlak', 'Mangyshlak', 'Mangyshlak', 52.0, 44.2, 'golden', 4, 'desert', 1, [0, 0, 1, 0, 0, 0], 'militia'],

  // Khwarezm
  ['urgench', 'Khwarezm', 'Urgench', 59.15, 42.32, 'khwarezm', 40, 'oasis', 1, [3, 2, 2, 2, 2, 2], 'spear spear archer archer heavycav'],
  ['khiva', 'Southern Khwarezm', 'Khiva', 60.36, 41.38, 'khwarezm', 25, 'oasis', 1, [1, 1, 1, 1, 2, 1], 'spear archer'],
  ['kath', 'Kath', 'Kath', 61.6, 42.2, 'khwarezm', 15, 'river', 1, [1, 1, 0, 1, 1, 0], 'militia archer'],
  ['kungrad', 'Aral Shore', 'Kungrad', 58.6, 43.4, 'khwarezm', 8, 'river', 0, [0, 0, 1, 0, 1, 0], 'horsearch'],
  ['ustyurt', 'Ustyurt', 'Ustyurt', 56.8, 43.6, 'khwarezm', 3, 'desert', 0, [0, 0, 0, 0, 0, 0], 'militia'],

  // Kartids of Herat
  ['herat', 'Herat', 'Herat', 62.2, 34.35, 'kart', 50, 'oasis', 1, [3, 2, 1, 2, 2, 3], 'spear spear archer archer heavyinf'],
  ['badghis', 'Badghis', 'Qal\'a-i Naw', 63.3, 35.3, 'kart', 8, 'steppe', 0, [1, 0, 1, 0, 0, 0], 'militia'],
  ['ghur', 'Ghur', 'Firozkoh', 64.9, 34.3, 'kart', 10, 'mountain', 0, [2, 1, 0, 0, 0, 1], 'spear archer'],
  ['farah', 'Farah', 'Farah', 62.1, 32.4, 'kart', 12, 'river', 0, [1, 0, 0, 1, 1, 0], 'militia'],

  // Sarbadars
  ['sabzevar', 'Bayhaq', 'Sabzevar', 57.68, 36.21, 'sarbadar', 25, 'oasis', 1, [2, 1, 1, 1, 1, 2], 'spear archer dervish'],
  ['nishapur', 'Nishapur', 'Nishapur', 58.8, 36.0, 'sarbadar', 35, 'oasis', 1, [2, 1, 1, 2, 2, 2], 'spear archer'],
  ['damghan', 'Qumis', 'Damghan', 54.35, 36.17, 'sarbadar', 10, 'oasis', 1, [1, 0, 0, 1, 1, 0], 'militia'],
  ['isfarayin', 'Isfarayin', 'Isfarayin', 57.5, 37.1, 'sarbadar', 8, 'mountain', 0, [1, 0, 0, 0, 1, 0], 'militia'],

  // Independent lords, towns and tribes
  ['otrar', 'Otrar', 'Otrar', 68.3, 42.85, 'rebels', 15, 'oasis', 1, [2, 1, 0, 1, 1, 0], 'spear archer'],
  ['kunduz', 'Kunduz', 'Kunduz', 68.86, 36.73, 'rebels', 12, 'river', 0, [1, 0, 1, 0, 1, 0], 'horsearch militia'],
  ['khuttal', 'Khuttal', 'Kulob', 69.78, 37.91, 'rebels', 12, 'mountain', 0, [1, 0, 1, 0, 0, 0], 'spear'],
  ['badakhshan', 'Badakhshan', 'Faizabad', 70.58, 37.12, 'rebels', 10, 'mountain', 0, [1, 0, 0, 0, 0, 0], 'spear archer'],
  ['amul', 'Amul', 'Amul', 63.6, 39.1, 'rebels', 10, 'river', 1, [1, 0, 0, 1, 0, 0], 'militia'],
  ['merv', 'Merv', 'Merv', 61.83, 37.6, 'rebels', 20, 'oasis', 1, [2, 0, 0, 1, 1, 0], 'militia archer'],
  ['sarakhs', 'Sarakhs', 'Sarakhs', 61.15, 36.53, 'rebels', 10, 'oasis', 1, [1, 0, 0, 1, 0, 0], 'militia'],
  ['tus', 'Tus', 'Tus', 59.6, 36.5, 'rebels', 20, 'oasis', 1, [2, 0, 0, 1, 1, 1], 'spear archer'],
  ['abiward', 'Abiward', 'Abiward', 58.4, 38.0, 'rebels', 8, 'oasis', 0, [1, 0, 0, 0, 0, 0], 'militia'],
  ['astarabad', 'Gorgan', 'Astarabad', 54.43, 36.84, 'rebels', 15, 'oasis', 1, [1, 0, 1, 1, 1, 0], 'spear horsearch'],
  ['mazandaran', 'Mazandaran', 'Sari', 53.06, 36.56, 'rebels', 20, 'river', 0, [1, 0, 0, 1, 1, 0], 'spear'],
  ['rayy', 'Rayy', 'Rayy', 51.4, 35.6, 'rebels', 30, 'oasis', 1, [2, 1, 0, 1, 1, 1], 'spear archer'],
  ['kabul', 'Kabul', 'Kabul', 69.17, 34.53, 'rebels', 20, 'mountain', 1, [2, 0, 0, 1, 1, 0], 'spear archer'],
  ['kandahar', 'Kandahar', 'Kandahar', 65.7, 31.6, 'rebels', 18, 'oasis', 1, [2, 0, 0, 1, 1, 0], 'spear archer'],
  ['quhistan', 'Quhistan', 'Tun', 58.2, 33.9, 'rebels', 10, 'mountain', 0, [1, 0, 0, 0, 0, 0], 'militia'],
  ['sistan', 'Sistan', 'Zaranj', 61.5, 31.0, 'rebels', 15, 'river', 0, [1, 0, 0, 1, 1, 0], 'spear'],
  ['kyzylkum', 'Kyzylkum', 'Bukantau', 63.8, 42.0, 'rebels', 3, 'desert', 0, [0, 0, 0, 0, 0, 0], 'horsearch'],
  ['karakum', 'Karakum', 'Darvaza', 59.5, 39.6, 'rebels', 3, 'desert', 0, [0, 0, 0, 0, 0, 0], 'horsearch'],
  ['dehistan', 'Dehistan', 'Dehistan', 54.7, 38.1, 'rebels', 6, 'desert', 0, [0, 0, 0, 0, 0, 0], 'horsearch'],
  ['balkhan', 'Balkhan', 'Balkhan', 54.9, 40.0, 'rebels', 3, 'desert', 0, [0, 0, 0, 0, 0, 0], 'horsearch'],
  ['ertis', 'Irtysh', 'Semey', 78.0, 50.3, 'rebels', 4, 'steppe', 0, [0, 0, 0, 0, 0, 0], 'horsearch'],
];

// Seas, lakes and impassable country. They shape the map but cannot be entered.
const BARRIER_DATA = [
  ['Caspian Sea', 'water', 49.4, 45.3], ['Caspian Sea', 'water', 51.3, 45.8], ['Caspian Sea', 'water', 50.0, 43.8],
  ['Caspian Sea', 'water', 51.2, 42.2], ['Caspian Sea', 'water', 50.9, 40.5], ['Caspian Sea', 'water', 51.0, 38.8],
  ['Caspian Sea', 'water', 52.4, 37.6], ['Kara-Bogaz', 'water', 53.4, 41.3],
  ['Aral Sea', 'water', 59.6, 45.2], ['Aral Sea', 'water', 60.8, 45.9], ['Aral Sea', 'water', 59.4, 44.2], ['Aral Sea', 'water', 61.0, 44.6],
  ['Lake Balkhash', 'water', 74.2, 46.6], ['Lake Balkhash', 'water', 76.5, 46.4], ['Lake Balkhash', 'water', 78.2, 46.1],
  ['Caucasus', 'mountain', 46.4, 42.6], ['Shirvan', 'mountain', 47.8, 39.6],
  ['Persian Plateau', 'mountain', 49.0, 33.4], ['Dasht-e Kavir', 'desert', 53.8, 33.8], ['Dasht-e Lut', 'desert', 57.6, 31.6],
  ['Hazarajat', 'mountain', 67.4, 33.4], ['Hindu Kush', 'mountain', 71.0, 35.4], ['Pamir', 'mountain', 73.8, 38.3],
  ['Karakoram', 'mountain', 75.0, 35.8], ['Kunlun', 'mountain', 79.5, 36.2], ['Kunlun', 'mountain', 83.6, 37.2],
  ['Taklamakan', 'desert', 80.4, 39.2], ['Taklamakan', 'desert', 83.6, 39.7], ['Tian Shan', 'mountain', 74.0, 41.2],
  ['Altai', 'mountain', 84.4, 50.0], ['Dzungarian Gate', 'mountain', 84.4, 44.0],
];

// cls: inf, spear (anti-cavalry infantry), missile (foot archers), cav (shock cavalry), ha (horse archers), siege
const UNITS = {
  militia: { name: 'Town Militia', cls: 'spear', men: 120, atk: 4, def: 6, morale: 4, missile: 0, cost: 160, upkeep: 35, build: 0 },
  spear: { name: 'Spearmen', cls: 'spear', men: 100, atk: 6, def: 9, morale: 6, missile: 0, cost: 300, upkeep: 60, build: 1 },
  archer: { name: 'Foot Archers', cls: 'missile', men: 90, atk: 3, def: 3, morale: 5, missile: 7, cost: 280, upkeep: 55, build: 1 },
  heavyinf: { name: 'Armoured Infantry', cls: 'inf', men: 90, atk: 10, def: 10, morale: 8, missile: 0, cost: 520, upkeep: 90, build: 2 },
  horsearch: { name: 'Horse Archers', cls: 'ha', men: 60, atk: 4, def: 4, morale: 6, missile: 7, cost: 420, upkeep: 80, stable: 1 },
  lancer: { name: 'Steppe Lancers', cls: 'cav', men: 60, atk: 8, def: 5, morale: 6, missile: 0, cost: 400, upkeep: 75, stable: 1 },
  heavycav: { name: 'Heavy Cavalry', cls: 'cav', men: 50, atk: 12, def: 11, morale: 9, missile: 0, cost: 760, upkeep: 130, stable: 2 },
  siege: { name: 'Siege Engineers', cls: 'siege', men: 40, atk: 3, def: 2, morale: 4, missile: 0, cost: 450, upkeep: 70, build: 2 },
  general: { name: "General's Guard", cls: 'cav', men: 30, atk: 12, def: 12, morale: 12, missile: 0, cost: 0, upkeep: 100 },
  // Unique units
  tovachi: { name: 'Tovachi Guard', cls: 'cav', men: 50, atk: 14, def: 12, morale: 11, missile: 0, cost: 900, upkeep: 150, stable: 2, only: 'temur',
    desc: 'Temur\'s elite heavy horsemen, armoured riders who could shoot and charge.' },
  dughlat: { name: 'Dughlat Riders', cls: 'ha', men: 60, atk: 6, def: 5, morale: 9, missile: 9, cost: 520, upkeep: 90, stable: 1, only: 'moghul',
    desc: 'Clan horsemen of the Dughlat amirs, the backbone of Moghul power.' },
  kipchak: { name: 'Kipchak Horse Archers', cls: 'ha', men: 70, atk: 4, def: 4, morale: 6, missile: 7, cost: 340, upkeep: 65, stable: 0, only: 'white',
    desc: 'Cheap and numerous riders of the Desht-i Kipchak.' },
  ordu: { name: 'Ordu Lancers', cls: 'cav', men: 55, atk: 13, def: 10, morale: 10, missile: 0, cost: 820, upkeep: 135, stable: 2, only: 'golden',
    desc: 'Heavy lancers of the Horde\'s great camp at Sarai.' },
  qangli: { name: 'Qangli Cavalry', cls: 'cav', men: 55, atk: 11, def: 10, morale: 9, missile: 0, cost: 700, upkeep: 120, stable: 2, only: 'khwarezm',
    desc: 'Turkic cavalry in the old service of the Khwarezmshahs.' },
  ghuri: { name: 'Ghuri Highlanders', cls: 'inf', men: 100, atk: 9, def: 11, morale: 9, missile: 0, cost: 480, upkeep: 85, build: 1, only: 'kart',
    desc: 'Tough mountain infantry from Ghur, deadly in rough country.' },
  dervish: { name: 'Sarbadar Dervishes', cls: 'inf', men: 100, atk: 10, def: 5, morale: 13, missile: 0, cost: 360, upkeep: 60, build: 1, only: 'sarbadar',
    desc: 'Fighting dervishes who swore they would rather hang than submit.' },
};
const UNIT_ORDER = ['militia', 'spear', 'archer', 'heavyinf', 'horsearch', 'lancer', 'heavycav', 'siege', 'tovachi', 'dughlat', 'kipchak', 'ordu', 'qangli', 'ghuri', 'dervish'];

const BUILDINGS = {
  walls: { name: 'Walls', levels: ['No walls', 'Palisade', 'Stone walls', 'Great walls'], cost: [0, 400, 1000, 2000], turns: [0, 2, 3, 4],
    desc: 'Defenders fight from the walls and a siege takes longer.' },
  barracks: { name: 'Barracks', levels: ['None', 'Militia yard', 'Barracks', 'Arsenal'], cost: [0, 300, 800, 1600], turns: [0, 1, 2, 3],
    desc: 'Unlocks infantry, archers and siege engineers.' },
  stables: { name: 'Stables', levels: ['None', 'Horse pens', 'Stables', 'Royal stud'], cost: [0, 350, 900, 1800], turns: [0, 1, 2, 3],
    desc: 'Unlocks cavalry. Steppe nations train light horsemen without them.' },
  market: { name: 'Bazaar', levels: ['None', 'Bazaar', 'Grand bazaar', 'Caravan hub'], cost: [0, 400, 1000, 2000], turns: [0, 2, 3, 4],
    desc: '+20% tax income per level, and more from Silk Road trade.' },
  farms: { name: 'Irrigation', levels: ['None', 'Aryk canals', 'Large aryks', 'Qanat network'], cost: [0, 300, 700, 1400], turns: [0, 2, 3, 3],
    desc: 'Population grows faster.' },
  madrasa: { name: 'Mosque', levels: ['None', 'Mosque', 'Madrasa', 'Great madrasa'], cost: [0, 350, 900, 1800], turns: [0, 2, 3, 4],
    desc: '+8 public order per level.' },
};
const BUILDING_ORDER = ['walls', 'barracks', 'stables', 'market', 'farms', 'madrasa'];

const NAMES = {
  turkic: ['Arslan', 'Bahadur', 'Tughluq', 'Qutlugh', 'Ak-Buga', 'Bayan', 'Toghan', 'Kepek', 'Jaku', 'Elchi Bugha', 'Mubarak Shah', 'Shaykh Ali', 'Ilchigidai', 'Khitay Bahadur', 'Burunduq', 'Idiku', 'Tash Temur', 'Sarybuga'],
  mongol: ['Khudaydad', 'Bulat', 'Temur-Bugha', 'Esen', 'Tokhta', 'Shir Bahram', 'Anqa Tura', 'Sarig', 'Bekchik', 'Yusuf', 'Muhammad Beg', 'Shams al-Din'],
  persian: ['Mahmud', 'Hasan', 'Ali', 'Shams al-Din', 'Nizam al-Din', 'Fakhr al-Din', 'Muhammad', 'Abdallah', 'Qutb al-Din', 'Ghiyath', 'Jalal', 'Rukn al-Din', 'Yahya', 'Lutf Allah'],
};

// Historical events. `when` is [year, season index]. `if` names factions that must still exist.
const EVENTS = [
  { when: [1370, 0], title: 'Kurultai at Balkh', text: 'In April 1370 the amirs of the Chagatai Ulus gather at Balkh and proclaim Temur their Great Amir. A descendant of Ögedei, Soyurghatmish, is raised as puppet khan.', effect: { faction: 'temur', order: 10 } },
  { when: [1371, 1], title: 'Khwarezm defies Temur', text: 'Husayn Sufi refuses to hand back Kath and Khiva to the Chagatai Ulus. Temur swears to take them by force.', effect: { relation: ['temur', 'khwarezm', -40] } },
  { when: [1373, 0], title: 'Urus Khan marches on Sarai', text: 'Urus Khan of the White Horde drives Mamai\'s puppet khan from Sarai and claims the throne of all the Jochids.', effect: { relation: ['white', 'golden', -50] } },
  { when: [1375, 1], title: 'Toqtamish flees to Temur', text: 'The young Jochid prince Toqtamish, defeated by Urus Khan, takes refuge at Temur\'s court. Temur gives him Otrar and Sauran and an army.', effect: { relation: ['temur', 'white', -30] } },
  { when: [1377, 1], title: 'Death of Urus Khan', text: 'Urus Khan dies in the winter of 1377. His sons quarrel over the throne, and the White Horde is shaken.', effect: { faction: 'white', order: -15, leader: 'Toqtamish' } },
  { when: [1380, 1], title: 'Battle of Kulikovo', text: 'On the field of Kulikovo, Prince Dmitry of Moscow defeats Mamai. The Golden Horde loses many of its best riders.', effect: { faction: 'golden', armyLoss: 0.35 } },
  { when: [1381, 0], title: 'Plague on the Silk Road', text: 'The Black Death returns along the caravan routes. Towns on the Silk Road lose many of their people.', effect: { plague: 0.12 } },
  { when: [1388, 1], title: 'A great caravan from China', text: 'A rich caravan arrives from Ming China, bringing silk and porcelain to the bazaars of the west.', effect: { silkGold: 400 } },
  { when: [1399, 0], title: 'Bibi-Khanym rises in Samarkand', text: 'Masons from across the conquered lands raise a great congregational mosque in Samarkand. Whoever holds the city gains prestige.', effect: { holder: 'samarkand', order: 15, gold: 1000 } },
];

const RANDOM_EVENTS = [
  { title: 'Good harvest', text: 'The aryks run full and the harvest is plentiful in {p}.', w: 3, apply: (p) => { p.pop *= 1.04; } },
  { title: 'Locusts', text: 'A cloud of locusts strips the fields of {p}.', w: 2, apply: (p) => { p.pop *= 0.95; p.unrest = Math.max(0, p.unrest) + 10; } },
  { title: 'Earthquake', text: 'An earthquake shakes {p}, damaging the walls.', w: 1, apply: (p) => { if (p.b.walls > 0) p.b.walls--; } },
  { title: 'Wandering scholars', text: 'Scholars and Sufi masters settle in {p}. The people are content.', w: 2, apply: (p) => { p.unrest -= 15; } },
  { title: 'Rich caravan', text: 'A caravan laden with silk passes through {p} and pays generous tolls.', w: 3, silk: true, apply: (p, s, f) => { f.gold += 250; } },
  { title: 'Nomad raid', text: 'Nomad raiders sweep through the villages of {p}.', w: 2, apply: (p) => { p.pop *= 0.96; p.unrest = Math.max(0, p.unrest) + 8; } },
];

// Major rivers as [lon, lat] polylines, from source to mouth (drawn on the map only)
const RIVERS = [
  { name: 'Amu Darya', w: 3.6, pts: [[71.4, 37.1], [70.0, 37.3], [68.8, 37.2], [67.3, 37.2], [66.4, 37.4], [65.2, 37.85], [64.3, 38.6], [63.6, 39.1], [62.6, 40.0], [61.5, 40.9], [60.9, 41.5], [60.3, 42.2], [59.7, 42.7], [59.4, 43.6], [59.5, 44.1]] },
  { name: 'Syr Darya', w: 3.2, pts: [[73.3, 40.9], [72.0, 40.9], [70.8, 40.7], [69.6, 40.3], [68.8, 40.9], [68.4, 41.8], [68.2, 42.8], [67.6, 43.6], [66.5, 44.4], [65.5, 44.8], [64.5, 44.6], [63.0, 45.3], [61.9, 45.9]] },
  { name: 'Zeravshan', w: 1.8, pts: [[70.0, 39.4], [68.5, 39.5], [67.0, 39.6], [66.0, 39.7], [64.8, 39.7], [64.0, 39.4]] },
  { name: 'Ili', w: 2.6, pts: [[83.5, 43.8], [80.8, 43.95], [79.0, 43.8], [77.5, 44.0], [76.5, 44.8], [75.6, 45.6], [75.0, 46.2]] },
  { name: 'Chu', w: 1.6, pts: [[76.6, 42.5], [75.3, 42.85], [74.0, 43.4], [72.5, 44.3], [71.0, 45.0]] },
  { name: 'Talas', w: 1.4, pts: [[73.0, 42.3], [71.8, 42.7], [71.0, 43.4], [70.3, 44.0]] },
  { name: 'Volga', w: 4.2, pts: [[45.6, 52.5], [46.2, 51.0], [46.0, 49.5], [46.5, 48.6], [47.3, 47.8], [47.9, 46.9], [48.0, 46.3], [48.7, 45.9]] },
  { name: 'Yaik', w: 2.6, pts: [[58.5, 52.5], [57.0, 51.6], [55.0, 51.5], [52.5, 51.3], [51.4, 51.2], [51.5, 50.0], [51.8, 48.8], [51.9, 47.5], [51.9, 46.9]] },
  { name: 'Emba', w: 1.4, pts: [[57.5, 48.7], [55.5, 47.6], [54.0, 46.9], [53.4, 46.6]] },
  { name: 'Murghab', w: 1.6, pts: [[64.5, 35.6], [63.5, 36.2], [62.4, 37.0], [61.9, 37.6], [61.7, 38.3]] },
  { name: 'Hari Rud', w: 1.8, pts: [[65.5, 34.6], [64.0, 34.4], [62.2, 34.4], [61.2, 34.7], [61.1, 35.6], [61.15, 36.5], [60.6, 37.4], [60.4, 37.9]] },
  { name: 'Helmand', w: 2.2, pts: [[68.0, 34.2], [66.5, 32.6], [65.0, 31.6], [62.5, 31.0], [61.6, 31.2]] },
  { name: 'Irtysh', w: 3.0, pts: [[85.5, 48.0], [83.3, 49.2], [80.3, 50.4], [78.0, 51.0], [76.5, 52.5]] },
  { name: 'Ishim', w: 1.6, pts: [[71.5, 50.8], [69.5, 51.6], [69.0, 52.5]] },
  { name: 'Turgai', w: 1.2, pts: [[64.5, 51.0], [63.5, 49.8], [62.8, 48.6], [62.2, 48.2]] },
  { name: 'Tarim', w: 2.4, pts: [[75.6, 39.4], [77.5, 40.0], [79.5, 40.5], [81.0, 40.6], [83.5, 40.9], [85.5, 41.0]] },
  { name: 'Yarkand', w: 1.8, pts: [[76.6, 37.0], [77.25, 38.4], [78.5, 39.6], [79.8, 40.4]] },
  { name: 'Kabul', w: 1.4, pts: [[68.6, 34.5], [69.17, 34.53], [70.5, 34.4], [71.6, 34.0]] },
];
