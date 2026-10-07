'use strict';
// Languages. Texts are written in English in the code and looked up with t(); the dictionaries in
// js/lang/ hold the Uzbek, Russian and Turkish versions. Missing entries fall back to English.

const LANGS = { en: 'English', uz: 'Oʻzbekcha', ru: 'Русский', tr: 'Türkçe' };
const I18N = { uz: {}, ru: {}, tr: {} };
let LANG = 'en';
try { const l = localStorage.getItem('turan-lang'); if (l && LANGS[l]) LANG = l; } catch (e) { /* storage unavailable */ }

// t('Attack {city} with {army}.', { city, army })
function t(s, v) {
  if (s === undefined || s === null) return '';
  let r = (LANG !== 'en' && I18N[LANG] && I18N[LANG][s]) || s;
  if (v) r = r.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));
  return r;
}

function setLang(l) {
  if (!LANGS[l]) return;
  LANG = l;
  try { localStorage.setItem('turan-lang', l); } catch (e) { /* storage unavailable */ }
  document.documentElement.lang = l;
}

// ---------- Places ----------
// [city, region] in each language
const PLACES = {
  uz: {
    samarkand: ['Samarqand', 'Samarqand'], kesh: ['Shahrisabz', 'Kesh'], bukhara: ['Buxoro', 'Buxoro'], termez: ['Termiz', 'Termiz'], balkh: ['Balx', 'Balx'],
    jizzakh: ['Jizzax', 'Ustrushona'], tashkent: ['Toshkent', 'Choch'], khujand: ['Xoʻjand', 'Xoʻjand'], shiberghan: ['Shibirgʻon', 'Juzjon'], chaghaniyan: ['Denov', 'Chagʻoniyon'],
    almaliq: ['Olmaliq', 'Yuqori Ili'], ili: ['Olmaota', 'Ili vodiysi'], chu: ['Bolosogʻun', 'Chu vodiysi'], issykkul: ['Barsxon', 'Issiqkoʻl'], talas: ['Taroz', 'Talas'],
    fergana: ['Andijon', 'Fargʻona'], kashgar: ['Qashqar', 'Qashqar'], yarkand: ['Yorkent', 'Yorkent'], aksu: ['Oqsuv', 'Oqsuv'], kucha: ['Kuchar', 'Kuchar'],
    zhetysu: ['Qoratol', 'Yettisuv'], tarbagatai: ['Emil', 'Tarbagʻatoy'], sighnaq: ['Sigʻnoq', 'Quyi Sirdaryo'], jend: ['Jand', 'Sirdaryo deltasi'], ulytau: ['Ulugʻtogʻ', 'Ulugʻtogʻ'],
    turgai: ['Toʻrgʻay', 'Toʻrgʻay'], saryarka: ['Qarqaraly', 'Saryarqa'], ishim: ['Ishim', 'Ishim'], irgiz: ['Irgʻiz', 'Irgʻiz'], betpakdala: ['Moʻyinqum', 'Betpoqdala'],
    sarai: ['Saroy', 'Quyi Itil'], hajjitarkhan: ['Hojitarxon', 'Itil deltasi'], ukek: ['Uvek', 'Yuqori Itil'], saraichik: ['Saroychiq', 'Yoyiq quyilishi'], yaik: ['Yoyiq', 'Yoyiq'],
    emba: ['Emba', 'Emba'], mugodzhar: ['Mugʻojar', 'Mugʻojar'], mangyshlak: ['Mangʻishloq', 'Mangʻishloq'], urgench: ['Urganch', 'Xorazm'], khiva: ['Xiva', 'Janubiy Xorazm'],
    kath: ['Kat', 'Kat'], kungrad: ['Qoʻngʻirot', 'Orol boʻyi'], ustyurt: ['Ustyurt', 'Ustyurt'], herat: ['Hirot', 'Hirot'], badghis: ['Qalai Nav', 'Bodgʻis'],
    ghur: ['Firuzkoh', 'Gʻur'], farah: ['Farah', 'Farah'], sabzevar: ['Sabzavor', 'Bayhaq'], nishapur: ['Nishopur', 'Nishopur'], damghan: ['Domgʻon', 'Qumis'],
    isfarayin: ['Isfaroyin', 'Isfaroyin'], otrar: ['Oʻtror', 'Oʻtror'], kunduz: ['Qunduz', 'Qunduz'], khuttal: ['Kulob', 'Xuttalon'], badakhshan: ['Fayzobod', 'Badaxshon'],
    amul: ['Omul', 'Omul'], merv: ['Marv', 'Marv'], sarakhs: ['Saraxs', 'Saraxs'], tus: ['Tus', 'Tus'], abiward: ['Obivard', 'Obivard'],
    astarabad: ['Astrobod', 'Gurgon'], mazandaran: ['Sori', 'Mozandaron'], rayy: ['Ray', 'Ray'], kabul: ['Kobul', 'Kobul'], kandahar: ['Qandahor', 'Qandahor'],
    quhistan: ['Tun', 'Quhiston'], sistan: ['Zaranj', 'Seyiston'], kyzylkum: ['Boʻkantov', 'Qizilqum'], karakum: ['Darvoza', 'Qoraqum'], dehistan: ['Dehiston', 'Dehiston'],
    balkhan: ['Balxon', 'Balxon'], ertis: ['Semey', 'Irtish'],
  },
  ru: {
    samarkand: ['Самарканд', 'Самарканд'], kesh: ['Шахрисабз', 'Кеш'], bukhara: ['Бухара', 'Бухара'], termez: ['Термез', 'Термез'], balkh: ['Балх', 'Балх'],
    jizzakh: ['Джизак', 'Уструшана'], tashkent: ['Ташкент', 'Шаш'], khujand: ['Ходжент', 'Ходжент'], shiberghan: ['Шибарган', 'Джузджан'], chaghaniyan: ['Денау', 'Чаганиан'],
    almaliq: ['Алмалык', 'Верхнее Или'], ili: ['Алматы', 'Долина Или'], chu: ['Баласагун', 'Чуйская долина'], issykkul: ['Барсхан', 'Иссык-Куль'], talas: ['Тараз', 'Талас'],
    fergana: ['Андижан', 'Фергана'], kashgar: ['Кашгар', 'Кашгар'], yarkand: ['Яркенд', 'Яркенд'], aksu: ['Аксу', 'Аксу'], kucha: ['Куча', 'Куча'],
    zhetysu: ['Каратал', 'Семиречье'], tarbagatai: ['Эмиль', 'Тарбагатай'], sighnaq: ['Сыгнак', 'Нижняя Сырдарья'], jend: ['Дженд', 'Дельта Сырдарьи'], ulytau: ['Улытау', 'Улытау'],
    turgai: ['Тургай', 'Тургай'], saryarka: ['Каркаралы', 'Сары-Арка'], ishim: ['Ишим', 'Ишим'], irgiz: ['Иргиз', 'Иргиз'], betpakdala: ['Мойынкум', 'Бетпак-Дала'],
    sarai: ['Сарай', 'Нижняя Волга'], hajjitarkhan: ['Хаджи-Тархан', 'Дельта Волги'], ukek: ['Укек', 'Верхняя Волга'], saraichik: ['Сарайчик', 'Устье Яика'], yaik: ['Яик', 'Яик'],
    emba: ['Эмба', 'Эмба'], mugodzhar: ['Мугоджары', 'Мугоджары'], mangyshlak: ['Мангышлак', 'Мангышлак'], urgench: ['Ургенч', 'Хорезм'], khiva: ['Хива', 'Южный Хорезм'],
    kath: ['Кят', 'Кят'], kungrad: ['Кунград', 'Приаралье'], ustyurt: ['Устюрт', 'Устюрт'], herat: ['Герат', 'Герат'], badghis: ['Калайи-Нау', 'Бадгис'],
    ghur: ['Фирузкух', 'Гур'], farah: ['Фарах', 'Фарах'], sabzevar: ['Себзевар', 'Бейхак'], nishapur: ['Нишапур', 'Нишапур'], damghan: ['Дамган', 'Кумис'],
    isfarayin: ['Исфераин', 'Исфераин'], otrar: ['Отрар', 'Отрар'], kunduz: ['Кундуз', 'Кундуз'], khuttal: ['Куляб', 'Хутталь'], badakhshan: ['Файзабад', 'Бадахшан'],
    amul: ['Амуль', 'Амуль'], merv: ['Мерв', 'Мерв'], sarakhs: ['Серахс', 'Серахс'], tus: ['Тус', 'Тус'], abiward: ['Абиверд', 'Абиверд'],
    astarabad: ['Астрабад', 'Горган'], mazandaran: ['Сари', 'Мазендеран'], rayy: ['Рей', 'Рей'], kabul: ['Кабул', 'Кабул'], kandahar: ['Кандагар', 'Кандагар'],
    quhistan: ['Тун', 'Кухистан'], sistan: ['Зарандж', 'Систан'], kyzylkum: ['Букантау', 'Кызылкум'], karakum: ['Дарваза', 'Каракум'], dehistan: ['Дехистан', 'Дехистан'],
    balkhan: ['Балхан', 'Балхан'], ertis: ['Семей', 'Иртыш'],
  },
  tr: {
    samarkand: ['Semerkant', 'Semerkant'], kesh: ['Şehrisebz', 'Keş'], bukhara: ['Buhara', 'Buhara'], termez: ['Tirmiz', 'Tirmiz'], balkh: ['Belh', 'Belh'],
    jizzakh: ['Cizzah', 'Usruşana'], tashkent: ['Taşkent', 'Şaş'], khujand: ['Hocent', 'Hocent'], shiberghan: ['Şibirgan', 'Cüzcan'], chaghaniyan: ['Denov', 'Çağaniyan'],
    almaliq: ['Almalık', 'Yukarı İli'], ili: ['Almatı', 'İli Vadisi'], chu: ['Balasagun', 'Çu Vadisi'], issykkul: ['Barsgan', 'Isık Göl'], talas: ['Taraz', 'Talas'],
    fergana: ['Andican', 'Fergana'], kashgar: ['Kaşgar', 'Kaşgar'], yarkand: ['Yarkent', 'Yarkent'], aksu: ['Aksu', 'Aksu'], kucha: ['Kuça', 'Kuça'],
    zhetysu: ['Karatal', 'Yedisu'], tarbagatai: ['Emil', 'Tarbagatay'], sighnaq: ['Sığnak', 'Aşağı Seyhun'], jend: ['Cend', 'Seyhun Deltası'], ulytau: ['Ulutav', 'Ulutav'],
    turgai: ['Turgay', 'Turgay'], saryarka: ['Karkaralı', 'Sarıarka'], ishim: ['İşim', 'İşim'], irgiz: ['Irgız', 'Irgız'], betpakdala: ['Moyınkum', 'Betpakdala'],
    sarai: ['Saray', 'Aşağı İdil'], hajjitarkhan: ['Hacı Tarhan', 'İdil Deltası'], ukek: ['Ukek', 'Yukarı İdil'], saraichik: ['Saraycık', 'Yayık Ağzı'], yaik: ['Yayık', 'Yayık'],
    emba: ['Emba', 'Emba'], mugodzhar: ['Mugocar', 'Mugocar'], mangyshlak: ['Mangışlak', 'Mangışlak'], urgench: ['Ürgenç', 'Harezm'], khiva: ['Hive', 'Güney Harezm'],
    kath: ['Kas', 'Kas'], kungrad: ['Kongrat', 'Aral Kıyısı'], ustyurt: ['Üstyurt', 'Üstyurt'], herat: ['Herat', 'Herat'], badghis: ['Kalâ-i Nev', 'Badgis'],
    ghur: ['Firuzkuh', 'Gur'], farah: ['Ferah', 'Ferah'], sabzevar: ['Sebzevar', 'Beyhak'], nishapur: ['Nişabur', 'Nişabur'], damghan: ['Damgan', 'Kumis'],
    isfarayin: ['İsferayin', 'İsferayin'], otrar: ['Otrar', 'Otrar'], kunduz: ['Kunduz', 'Kunduz'], khuttal: ['Külab', 'Huttal'], badakhshan: ['Feyzabad', 'Bedahşan'],
    amul: ['Amul', 'Amul'], merv: ['Merv', 'Merv'], sarakhs: ['Serahs', 'Serahs'], tus: ['Tus', 'Tus'], abiward: ['Ebiverd', 'Ebiverd'],
    astarabad: ['Esterâbâd', 'Gürgan'], mazandaran: ['Sari', 'Mazenderan'], rayy: ['Rey', 'Rey'], kabul: ['Kâbil', 'Kâbil'], kandahar: ['Kandahar', 'Kandahar'],
    quhistan: ['Tun', 'Kuhistan'], sistan: ['Zerenc', 'Sistan'], kyzylkum: ['Bukantav', 'Kızılkum'], karakum: ['Derveze', 'Karakum'], dehistan: ['Dihistan', 'Dihistan'],
    balkhan: ['Balkan', 'Balkan'], ertis: ['Semey', 'İrtiş'],
  },
};
const GEO = {
  'Caspian Sea': ['Kaspiy dengizi', 'Каспийское море', 'Hazar Denizi'], 'Kara-Bogaz': ['Qorabogʻoz', 'Кара-Богаз', 'Karabogaz'],
  'Aral Sea': ['Orol dengizi', 'Аральское море', 'Aral Gölü'], 'Lake Balkhash': ['Balxash koʻli', 'Озеро Балхаш', 'Balkaş Gölü'],
  Caucasus: ['Kavkaz', 'Кавказ', 'Kafkasya'], Shirvan: ['Shirvon', 'Ширван', 'Şirvan'], 'Persian Plateau': ['Eron yassitogʻligi', 'Иранское нагорье', 'İran Platosu'],
  'Dasht-e Kavir': ['Dashti Kavir', 'Деште-Кевир', 'Deşt-i Kevir'], 'Dasht-e Lut': ['Dashti Lut', 'Деште-Лут', 'Deşt-i Lut'], Hazarajat: ['Hazorajot', 'Хазараджат', 'Hazaracat'],
  'Hindu Kush': ['Hindukush', 'Гиндукуш', 'Hindukuş'], Pamir: ['Pomir', 'Памир', 'Pamir'], Karakoram: ['Qoraqurum', 'Каракорум', 'Karakurum'], Kunlun: ['Kunlun', 'Куньлунь', 'Kunlun'],
  Taklamakan: ['Taklamakon', 'Такла-Макан', 'Taklamakan'], 'Tian Shan': ['Tyanshan', 'Тянь-Шань', 'Tanrı Dağları'], Altai: ['Oltoy', 'Алтай', 'Altay'],
  'Dzungarian Gate': ['Jungʻoriya darvozasi', 'Джунгарские ворота', 'Cungarya Kapısı'],
};
const cityOf = p => (LANG !== 'en' && PLACES[LANG][p.id]) ? PLACES[LANG][p.id][0] : p.city;
const regionOf = p => (LANG !== 'en' && PLACES[LANG][p.id]) ? PLACES[LANG][p.id][1] : p.name;
const cityById = id => cityOf(G && G.provinces[id] ? G.provinces[id] : { id, city: (PROVINCE_DATA.find(d => d[0] === id) || [])[2] });
const geoName = n => LANG === 'en' || !GEO[n] ? n : GEO[n][{ uz: 0, ru: 1, tr: 2 }[LANG]];

// ---------- People ----------
// Known names in Uzbek, Russian and Turkish; anything else is transliterated (Russian) or kept.
const PEOPLE = {
  'Amir Temur': ['Amir Temur', 'Амир Тимур', 'Emir Timur'],
  'Saray Mulk Khanum': ['Saroy Mulk xonim', 'Сарай Мульк-ханым', 'Saray Mülk Hanım'],
  'Jahangir Mirza': ['Jahongir Mirzo', 'Джахангир-мирза', 'Cihangir Mirza'],
  'Umar Shaikh Mirza': ['Umarshayx Mirzo', 'Умар-шейх-мирза', 'Ömer Şeyh Mirza'],
  'Miran Shah': ['Mironshoh', 'Миран-шах', 'Miranşah'],
  'Muhammad Sultan Mirza': ['Muhammad Sulton Mirzo', 'Мухаммад-Султан-мирза', 'Muhammed Sultan Mirza'],
  'Shah Rukh': ['Shohrux', 'Шахрух', 'Şahruh'],
  'Khalil Sultan': ['Xalil Sulton', 'Халиль-Султан', 'Halil Sultan'],
  'Ulugh Beg': ['Mirzo Ulugʻbek', 'Улугбек', 'Uluğ Bey'],
  'Sayf al-Din Nuküz': ['Sayfiddin Nukuz', 'Сайф ад-Дин Нукуз', 'Seyfeddin Nüküz'],
  'Qamar al-Din Dughlat': ['Qamariddin Dugʻlat', 'Камар ад-Дин Дуглат', 'Kamereddin Duğlat'],
  'Khizr Khoja': ['Xizr Xoja', 'Хизр-Ходжа', 'Hızır Hoca'],
  'Urus Khan': ['Urusxon', 'Урус-хан', 'Urus Han'],
  'Toqtaqiya': ['Toʻqtaqiya', 'Тохтакия', 'Toktakıya'],
  'Temur-Malik': ['Temur Malik', 'Тимур-Мелик', 'Timur Melik'],
  'Toqtamish': ['Toʻxtamish', 'Тохтамыш', 'Toktamış'],
  'Beglerbeg Mamai': ['Beklarbegi Mamay', 'Беклярбек Мамай', 'Beylerbeyi Mamay'],
  'Muhammad-Sultan': ['Muhammad Sulton', 'Мухаммад-Султан', 'Muhammed Sultan'],
  'Edigu': ['Edigu', 'Едигей', 'Edige'],
  'Husayn Sufi': ['Husayn Soʻfi', 'Хусейн Суфи', 'Hüseyin Sufi'],
  'Yusuf Sufi': ['Yusuf Soʻfi', 'Юсуф Суфи', 'Yusuf Sufi'],
  'Ghiyath al-Din Pir Ali': ['Gʻiyosiddin Pir Ali', 'Гияс ад-Дин Пир Али', 'Gıyaseddin Pir Ali'],
  'Pir Muhammad': ['Pir Muhammad', 'Пир-Мухаммад', 'Pir Muhammed'],
  "Khwaja Ali Mu'ayyad": ['Xoja Ali Muayyad', 'Ходжа Али Муайяд', 'Hace Ali Müeyyed'],
  'Darvish Rukn al-Din': ['Darvesh Ruknuddin', 'Дервиш Рукн ад-Дин', 'Derviş Rükneddin'],
  'Baha al-Din Naqshband': ['Bahouddin Naqshband', 'Бахауддин Накшбанд', 'Bahaeddin Nakşibend'],
  'Hafez of Shiraz': ['Hofiz Sheroziy', 'Хафиз Ширази', 'Şirazlı Hafız'],
  'Kamal Khujandi': ['Kamol Xoʻjandiy', 'Камал Худжанди', 'Kemal Hucendi'],
  "Sa'd al-Din Taftazani": ['Saʼduddin Taftazoniy', 'Саад ад-Дин Тафтазани', 'Sadeddin Teftazani'],
  'Nizam al-Din Shami': ['Nizomiddin Shomiy', 'Низам ад-Дин Шами', 'Nizameddin Şami'],
  'Ibn Khaldun': ['Ibn Xaldun', 'Ибн Хальдун', 'İbn Haldun'],
  'Mir Sayyid Sharif Jurjani': ['Mir Sayyid Sharif Jurjoniy', 'Мир Сейид Шариф Джурджани', 'Seyyid Şerif Cürcani'],
  'Qadi-zada al-Rumi': ['Qozizoda Rumiy', 'Кази-заде ар-Руми', 'Bursalı Kadızade-i Rumi'],
  'Ghiyath al-Din al-Kashi': ['G‘iyosiddin Koshiy', 'Гияс ад-Дин аль-Каши', 'Gıyaseddin el-Kaşi'],
  'Abd al-Qadir Maraghi': ['Abdulqodir Marog‘iy', 'Абд аль-Кадир Мараги', 'Abdülkadir Meragi'],
  'Khwaja Abd al-Hayy': ['Xoja Abdulhay', 'Ходжа Абд аль-Хайй', 'Hace Abdülhay'],
  'Mawlana Lutfi': ['Mavlono Lutfiy', 'Мавлана Лютфи', 'Mevlana Lutfi'],
  'Sharaf al-Din Ali Yazdi': ['Sharafiddin Ali Yazdiy', 'Шараф ад-Дин Али Язди', 'Şerafeddin Ali Yezdi'],
  'Ruy González de Clavijo': ['Rui Gonsales de Klavixo', 'Руи Гонсалес де Клавихо', 'Ruy González de Clavijo'],
  'Darvish Rukn': ['Darvesh Rukn', 'Дервиш Рукн', 'Derviş Rükn'],
};
function translitRu(s) {
  const m = { a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'дж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс', y: 'й', z: 'з', ü: 'ю', ö: 'ё', "'": 'ъ' };
  return s.replace(/kh|sh|ch|zh|gh|ya|yu|ts/gi, d => ({ kh: 'х', sh: 'ш', ch: 'ч', zh: 'ж', gh: 'г', ya: 'я', yu: 'ю', ts: 'ц' })[d.toLowerCase()] || d)
    .replace(/[a-zA-Züö']/g, ch => { const lo = ch.toLowerCase(), r = m[lo] !== undefined ? m[lo] : ch; return ch === lo ? r : r.charAt(0).toUpperCase() + r.slice(1); });
}
function pn(name) {
  if (!name || LANG === 'en') return name || '';
  const k = { uz: 0, ru: 1, tr: 2 }[LANG];
  if (PEOPLE[name]) return PEOPLE[name][k];
  return LANG === 'ru' ? translitRu(name) : name;
}

// Russian needs three plural forms; the others are simple
function plural(n, one, few, many) {
  if (LANG !== 'ru') return n === 1 ? one : (few || one);
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

// ---------- Shortcuts for game names ----------
const fName = f => t(FACTIONS[f].name);
const fFull = f => t(FACTIONS[f].full);
const fAdj = f => t(FACTIONS[f].adj);
const fTitle = f => t(FACTIONS[f].title);
const uName = type => t(UNITS[type].name);
const bName = k => t(BUILDINGS[k].name);
const bLevel = (k, l) => t(BUILDINGS[k].levels[l]);
const wName = id => t(WONDERS[id].name);
const terrName = k => t(TERRAIN[k].name);
