'use strict';

const TILE = 32, MAP_W = 80, MAP_H = 80, MAP_N = MAP_W * MAP_H;
const WORLD_W = MAP_W * TILE, WORLD_H = MAP_H * TILE;
const T_GRASS = 0, T_SAND = 1, T_WATER = 2, T_MOUNTAIN = 3;
const PLAYER = 0, ENEMY = 1, NEUTRAL = 2;
const TEAM_COLOR = ['#1aa3c8', '#d2432f', '#d9a62b'];
const TEAM_DARK = ['#0e6a85', '#8d281b', '#8f6a12'];
const POP_MAX = 80;
const CARRY = 10;
const QUEUE_MAX = 5;
const RES = ['food', 'wood', 'stone', 'gold'];
const RES_COLOR = { food: '#d9534f', wood: '#8a5a2b', stone: '#9aa0a6', gold: '#f2c230' };
const GATHER_RATE = { food: 0.9, wood: 0.8, stone: 0.7, gold: 0.7 };
const FARM_RATE = 0.5;
const TRADE_GOLD_PER_TILE = 1.3;

const NODES = {
  tree: { name: 'Poplar', res: 'wood', amount: 120 },
  berry: { name: 'Pomegranate bush', res: 'food', amount: 200 },
  gold: { name: 'Gold vein', res: 'gold', amount: 500 },
  stone: { name: 'Stone quarry', res: 'stone', amount: 400 },
};

// speed and range are in pixels, sight in tiles, time in seconds
const UNITS = {
  villager: {
    name: 'Dehqan', desc: 'Worker. Gathers food, wood, stone and gold, and constructs or repairs buildings.',
    hp: 40, speed: 62, atk: 3, range: 12, cd: 1.5, sight: 6, cost: { food: 50 }, time: 11, pop: 1, vsBuilding: 0.5,
  },
  spearman: {
    name: 'Spearman', desc: 'Sturdy infantry. Deals double damage to mounted troops.',
    hp: 75, speed: 58, atk: 8, range: 14, cd: 1.1, sight: 6, cost: { food: 45, wood: 20 }, time: 12, pop: 1,
    vsMounted: 2.2, vsBuilding: 0.6,
  },
  archer: {
    name: 'Archer', desc: 'Ranged infantry. Fragile, and weak against buildings.',
    hp: 45, speed: 58, atk: 7, range: 135, cd: 1.6, sight: 8, cost: { wood: 35, gold: 30 }, time: 14, pop: 1,
    ranged: true, vsBuilding: 0.35,
  },
  horseArcher: {
    name: 'Horse Archer', desc: 'Fast mounted archer. Ideal for raiding and chasing.',
    hp: 85, speed: 102, atk: 8, range: 120, cd: 1.5, sight: 9, cost: { food: 70, gold: 55 }, time: 18, pop: 1,
    ranged: true, mounted: true, vsBuilding: 0.35,
  },
  batyr: {
    name: 'Batyr', desc: 'Elite heavy cavalry. Smashes buildings and infantry alike.',
    hp: 150, speed: 90, atk: 14, range: 16, cd: 1.3, sight: 7, cost: { food: 90, gold: 70 }, time: 22, pop: 1,
    mounted: true, vsBuilding: 1.8,
  },
  caravan: {
    name: 'Caravan', desc: 'Travels between its Caravanserai and the Grand Bazaar, bringing back gold on every trip.',
    hp: 90, speed: 54, atk: 0, range: 0, cd: 1, sight: 5, cost: { wood: 80, gold: 40 }, time: 20, pop: 1,
  },
};

const BUILDINGS = {
  citadel: {
    name: 'Citadel', desc: 'Heart of your khanate. Trains Dehqans, stores resources and shoots arrows. Lose every Citadel and you lose.',
    size: 3, hp: 2400, cost: { wood: 300, stone: 300 }, time: 70, pop: 10, sight: 9, trains: ['villager'],
    dropoff: true, atk: 9, range: 175, cd: 1.2, key: 'C',
  },
  yurt: {
    name: 'Yurt', desc: 'Houses 5 more people.',
    size: 2, hp: 300, cost: { wood: 40 }, time: 12, pop: 5, sight: 4, key: 'Q',
  },
  farm: {
    name: 'Farm', desc: 'One Dehqan can work it for an endless supply of food.',
    size: 2, hp: 220, cost: { wood: 60 }, time: 12, sight: 3, key: 'E',
  },
  storehouse: {
    name: 'Storehouse', desc: 'Drop-off point for gathered resources. Build it next to forests and mines.',
    size: 2, hp: 400, cost: { wood: 80 }, time: 15, sight: 4, dropoff: true, key: 'R',
  },
  barracks: {
    name: 'Barracks', desc: 'Trains Spearmen and Archers.',
    size: 3, hp: 800, cost: { wood: 150, stone: 50 }, time: 30, sight: 5, trains: ['spearman', 'archer'], key: 'T',
  },
  stable: {
    name: 'Stable', desc: 'Trains Horse Archers and Batyrs.',
    size: 3, hp: 800, cost: { wood: 175, gold: 75 }, time: 35, sight: 5, trains: ['horseArcher', 'batyr'], key: 'F',
  },
  caravanserai: {
    name: 'Caravanserai', desc: 'Trains Caravans that trade with the Grand Bazaar for gold. Longer routes pay more.',
    size: 3, hp: 700, cost: { wood: 150, stone: 100 }, time: 35, sight: 5, trains: ['caravan'], key: 'G',
  },
  tower: {
    name: 'Watchtower', desc: 'Shoots arrows at enemies in range.',
    size: 1, hp: 500, cost: { stone: 120, wood: 40 }, time: 25, sight: 10, atk: 11, range: 190, cd: 1.4, key: 'Z',
  },
  bazaar: {
    name: 'Grand Bazaar', desc: 'The neutral trading city of the Silk Road. Caravans earn gold here.',
    size: 4, hp: 99999, sight: 0,
  },
};
const BUILD_ORDER = ['yurt', 'farm', 'storehouse', 'barracks', 'stable', 'caravanserai', 'tower', 'citadel'];

const DIFF = {
  // armyRate: how many soldiers per minute of game time the rival allows itself to field
  easy: { label: 'Easy', vill: 10, gather: 0.75, firstAttack: 600, waveBase: 3, waveGrow: 2, maxArmy: 16, armyRate: 1, attackGap: 200 },
  normal: { label: 'Normal', vill: 15, gather: 1.0, firstAttack: 450, waveBase: 5, waveGrow: 3, maxArmy: 28, armyRate: 2, attackGap: 150 },
  hard: { label: 'Hard', vill: 20, gather: 1.25, firstAttack: 300, waveBase: 8, waveGrow: 4, maxArmy: 40, armyRate: 3.5, attackGap: 110 },
};
