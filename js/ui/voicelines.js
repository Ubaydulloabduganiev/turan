'use strict';
// What the recorded voices say in the painted scenes. The scenes on screen name the city or the person; the
// voices speak in general words, so that one recording serves every campaign. role: who speaks.
const NARR = {
  'scene.coronation.start': { role: 'narrator',
    en: 'The amirs and beys gather in the great tent and raise their new ruler on a white felt, as the steppe has done since the days of Chinggis Khan. The realm is yours to rule. Outlast every rival, and Turan will be yours.',
    uz: 'Amirlar va beklar katta o‘tovga yig‘ilib, yangi hukmdorni Chingizxon zamonidan beri bo‘lganidek oq kigizda ko‘tarishadi. Davlat sizning qo‘lingizda. Barcha raqiblardan ustun keling, Turon sizniki bo‘ladi.',
    ru: 'Эмиры и беки собираются в великом шатре и поднимают нового правителя на белом войлоке, как велось в степи со времён Чингисхана. Держава в ваших руках. Переживите всех соперников, и Туран будет вашим.',
    tr: 'Emirler ve beyler büyük çadırda toplanır ve Cengiz Han’ın zamanından beri bozkırda yapıldığı gibi yeni hükümdarı ak keçe üzerinde kaldırır. Devlet sizin elinizde. Bütün rakiplerinizden uzun yaşayın, Turan sizin olacak.' },
  'scene.coronation.next': { role: 'narrator',
    en: 'The old ruler is gone. In the great hall the amirs kneel one by one and swear loyalty to the new sovereign. A new reign begins.',
    uz: 'Eski hukmdor bu dunyodan o‘tdi. Katta saroyda amirlar birin-ketin tiz cho‘kib, yangi hukmdorga sadoqat qasamini ichadi. Yangi saltanat boshlanmoqda.',
    ru: 'Старый правитель ушёл. В большом зале эмиры один за другим преклоняют колени и клянутся в верности новому государю. Начинается новое царствование.',
    tr: 'Eski hükümdar gitti. Büyük salonda emirler birer birer diz çöküp yeni hükümdara bağlılık yemini eder. Yeni bir saltanat başlıyor.' },
  'scene.funeral': { role: 'narrator',
    en: 'The court weeps around the bier. The drums are silent, the amirs tear their robes, and the whole realm mourns. Tomorrow a new ruler will be raised.',
    uz: 'Saroy tobut atrofida yig‘lamoqda. Nog‘oralar jim, amirlar to‘nlarini yirtmoqda, butun mamlakat motam tutmoqda. Ertaga yangi hukmdor taxtga ko‘tariladi.',
    ru: 'Двор плачет у гроба. Барабаны молчат, эмиры рвут на себе одежды, вся держава в трауре. Завтра будет возведён новый правитель.',
    tr: 'Saray tabutun başında ağlıyor. Davullar sustu, emirler giysilerini yırtıyor, bütün ülke yasta. Yarın yeni bir hükümdar tahta çıkarılacak.' },
  'scene.wedding': { role: 'narrator',
    en: 'Kettle-drums thunder and the long karnay trumpets sound. The bride arrives under a canopy of silk, and two houses become one family.',
    uz: 'Nog‘oralar gumburlaydi, uzun karnaylar yangraydi. Kelin ipak soyabon ostida keladi, ikki xonadon bir oilaga aylanadi.',
    ru: 'Гремят литавры, трубят длинные карнаи. Невеста прибывает под шёлковым балдахином, и два дома становятся одной семьёй.',
    tr: 'Kös davulları gürler, uzun karnaylar çalar. Gelin ipek bir gölgelik altında gelir ve iki hanedan tek bir aile olur.' },
  'scene.birth': { role: 'narrator',
    en: 'A child is born to the royal house. Midwives sing over the cradle, and the whole court comes to see the baby.',
    uz: 'Shohona xonadonda farzand dunyoga keldi. Doyalar beshik ustida qo‘shiq aytadi, butun saroy chaqaloqni ko‘rgani keladi.',
    ru: 'В царском доме родился ребёнок. Повитухи поют над колыбелью, и весь двор приходит посмотреть на младенца.',
    tr: 'Hanedanda bir çocuk doğdu. Ebeler beşiğin başında şarkı söyler, bütün saray bebeği görmeye gelir.' },
  'scene.conquest': { role: 'narrator',
    en: 'Your banners fly over the citadel. The city’s elders bring you its keys on a silver dish.',
    uz: 'Bayroqlaringiz qal’a ustida hilpiramoqda. Shahar oqsoqollari uning kalitlarini kumush laganda sizga keltiradi.',
    ru: 'Ваши знамёна развеваются над цитаделью. Старейшины города подносят вам ключи на серебряном блюде.',
    tr: 'Sancaklarınız kalenin üzerinde dalgalanıyor. Şehrin ileri gelenleri anahtarlarını size gümüş bir tepside getiriyor.' },
  'scene.conquest.capital': { role: 'narrator',
    en: 'An enemy capital has fallen. Your banners fly over its citadel, and its people kneel before your governor.',
    uz: 'Dushman poytaxti quladi. Bayroqlaringiz uning qal’asi ustida hilpiramoqda, xalqi esa noibingiz oldida tiz cho‘kmoqda.',
    ru: 'Вражеская столица пала. Ваши знамёна развеваются над её цитаделью, а её жители склоняются перед вашим наместником.',
    tr: 'Bir düşman başkenti düştü. Sancaklarınız kalesinin üzerinde dalgalanıyor ve halkı valinizin önünde diz çöküyor.' },
  'scene.siege': { role: 'narrator',
    en: 'Your army rings the walls. Engineers raise the catapults, and the defenders shout down from the battlements. Starve them out, or storm the walls when you are ready.',
    uz: 'Qo‘shiningiz devorlarni o‘rab oldi. Muhandislar manjaniqlarni o‘rnatmoqda, himoyachilar esa qal’a devorlaridan baqirmoqda. Ularni ochlik bilan bo‘ysundiring yoki tayyor bo‘lganingizda devorlarga hujum qiling.',
    ru: 'Ваше войско окружило стены. Инженеры ставят катапульты, защитники кричат со стен. Возьмите их измором или штурмуйте стены, когда будете готовы.',
    tr: 'Ordunuz surları sardı. Mühendisler mancınıkları kuruyor, savunucular burçlardan bağırıyor. Onları açlıkla teslim alın ya da hazır olduğunuzda surlara saldırın.' },
  'scene.treaty': { role: 'narrator',
    en: 'The envoys exchange sealed letters and robes of honour. The war is over, and the caravans can travel again.',
    uz: 'Elchilar muhrlangan maktublar va xil’atlar almashadi. Urush tugadi, karvonlar yana yo‘lga chiqishi mumkin.',
    ru: 'Послы обмениваются запечатанными грамотами и почётными халатами. Война окончена, и караваны снова могут идти.',
    tr: 'Elçiler mühürlü mektuplar ve hilatler değiş tokuş ediyor. Savaş sona erdi, kervanlar yeniden yola çıkabilir.' },
  'scene.feast': { role: 'narrator',
    en: 'Carpets are spread in the gardens. Musicians play, cooks carry out cauldrons of pilaf, and the whole city eats at the ruler’s expense. For a while, no one has a bad word to say about you.',
    uz: 'Bog‘larda gilamlar to‘shalgan. Sozandalar chalmoqda, oshpazlar qozon-qozon palov olib chiqmoqda, butun shahar hukmdor hisobidan to‘yib yemoqda. Bir muddat hech kim siz haqingizda yomon so‘z aytmaydi.',
    ru: 'В садах расстелены ковры. Играют музыканты, повара выносят котлы плова, и весь город ест за счёт правителя. На время никто не скажет о вас дурного слова.',
    tr: 'Bahçelere halılar serildi. Çalgıcılar çalıyor, aşçılar kazan kazan pilav taşıyor ve bütün şehir hükümdarın hesabına yiyor. Bir süre kimse hakkınızda kötü söz söylemeyecek.' },

  // Amir Temur himself
  'temur.coronation': { role: 'temur',
    en: 'Rasti rusti. Strength lies in justice. If you doubt our power, look at our buildings.',
    uz: 'Rosti-rusti. Kuch adolatdadir. Agar qudratimizga shubhang bo‘lsa, binolarimizga boq.',
    ru: 'Расти-русти. Сила — в справедливости. Если сомневаешься в нашем могуществе, взгляни на наши постройки.',
    tr: 'Rasti rusti. Güç adalettedir. Gücümüzden şüphen varsa, yapılarımıza bak.' },
  'temur.conquest': { role: 'temur',
    en: 'Let the drums sound. This city is under my protection now. Let no soldier harm its people.',
    uz: 'Nog‘oralar chalinsin. Bu shahar endi mening himoyamda. Hech bir askar uning xalqiga zarar yetkazmasin.',
    ru: 'Пусть бьют барабаны. Отныне этот город под моей защитой. Пусть ни один воин не тронет его жителей.',
    tr: 'Davullar çalsın. Bu şehir artık benim korumam altında. Hiçbir asker halkına dokunmasın.' },
  'temur.sack': { role: 'temur',
    en: 'They chose the sword over mercy. Let them have the sword.',
    uz: 'Ular shafqatdan ko‘ra qilichni tanladilar. Qilich ularniki bo‘lsin.',
    ru: 'Они выбрали меч, а не милость. Пусть получат меч.',
    tr: 'Merhamet yerine kılıcı seçtiler. Kılıç onların olsun.' },
  'temur.siege': { role: 'temur',
    en: 'Tell them: open the gates, and live. Close them, and the walls will not save you.',
    uz: 'Ularga ayting: darvozani ochsalar, omon qoladilar. Yopsalar, devorlar ularni qutqarmaydi.',
    ru: 'Скажите им: откройте ворота, и будете жить. Закройте, и стены вас не спасут.',
    tr: 'Onlara söyleyin: kapıları açarlarsa yaşarlar. Kaparlarsa surlar onları kurtarmaz.' },
  'temur.treaty': { role: 'temur',
    en: 'We have made peace. Keep your word, and you will find me a friend.',
    uz: 'Sulh tuzdik. So‘zingda tursang, meni do‘st deb bilasan.',
    ru: 'Мы заключили мир. Держи своё слово, и найдёшь во мне друга.',
    tr: 'Barış yaptık. Sözünü tutarsan, bende bir dost bulursun.' },

  // Every other ruler
  'ruler.coronation': { role: 'ruler',
    en: 'I swear before God and the amirs: I will hold this land with the sword and with justice.',
    uz: 'Olloh va amirlar oldida qasam ichaman: bu yurtni qilich va adolat bilan saqlayman.',
    ru: 'Клянусь перед Богом и эмирами: я буду держать эту землю мечом и справедливостью.',
    tr: 'Allah’ın ve emirlerin önünde yemin ederim: bu toprağı kılıçla ve adaletle tutacağım.' },
  'ruler.conquest': { role: 'ruler',
    en: 'The city is ours. Raise our banner over the citadel.',
    uz: 'Shahar bizniki. Bayrog‘imizni qal’a ustiga tiking.',
    ru: 'Город наш. Поднимите наше знамя над цитаделью.',
    tr: 'Şehir bizim. Sancağımızı kaleye dikin.' },
  'ruler.sack': { role: 'ruler',
    en: 'Let the soldiers take their reward.',
    uz: 'Askarlar o‘z mukofotini olsin.',
    ru: 'Пусть воины возьмут свою награду.',
    tr: 'Askerler ödüllerini alsın.' },
  'ruler.siege': { role: 'ruler',
    en: 'No wall stands forever. We will wait, or we will climb.',
    uz: 'Hech bir devor abadiy turmaydi. Kutamiz yoki oshib o‘tamiz.',
    ru: 'Ни одна стена не стоит вечно. Мы подождём или поднимемся на неё.',
    tr: 'Hiçbir sur sonsuza dek ayakta kalmaz. Bekleriz ya da tırmanırız.' },
  'ruler.treaty': { role: 'ruler',
    en: 'Let there be peace between us, and let the caravans travel again.',
    uz: 'Oramizda tinchlik bo‘lsin, karvonlar yana yo‘lga chiqsin.',
    ru: 'Пусть между нами будет мир, и пусть караваны снова идут.',
    tr: 'Aramızda barış olsun, kervanlar yeniden yola çıksın.' },

  // The queens and princesses
  'queen.wedding': { role: 'queen',
    en: 'May our two houses be one, and may our sons ride side by side.',
    uz: 'Ikki xonadonimiz bir bo‘lsin, o‘g‘illarimiz yonma-yon ot choptirsin.',
    ru: 'Пусть наши два дома станут одним, и пусть наши сыновья скачут бок о бок.',
    tr: 'İki hanedanımız bir olsun, oğullarımız yan yana at sürsün.' },
  'queen.birth': { role: 'queen',
    en: 'Look, my lord: a child for your house.',
    uz: 'Qarang, hukmdorim: xonadoningizga farzand.',
    ru: 'Взгляни, мой господин: дитя для твоего дома.',
    tr: 'Bakın efendim: hanedanınıza bir çocuk.' },
};
const narr = k => NARR[k] ? NARR[k][LANG] || NARR[k].en : '';

// What the voices say for a scene: the ruler or queen first, then the storyteller
function sceneVoice(sc) {
  const who = typeof G !== 'undefined' && G && G.factions[G.player] && G.factions[G.player].leader === 'Amir Temur' ? 'temur' : 'ruler';
  switch (sc.kind) {
    case 'coronation': return sc.start ? [narr('scene.coronation.start'), narr(who + '.coronation')] : [narr('scene.coronation.next'), narr(who + '.coronation')];
    case 'funeral': return [narr('scene.funeral')];
    case 'wedding': return [narr('scene.wedding'), narr('queen.wedding')];
    case 'birth': return [narr('scene.birth'), narr('queen.birth')];
    case 'conquest': return sc.sack ? [t('Your soldiers pour through the broken gates and sack the city. The loot is carried out by the cartload.'), narr(who + '.sack')]
      : [narr(sc.capital ? 'scene.conquest.capital' : 'scene.conquest'), narr(who + '.conquest')];
    case 'siege': return [narr('scene.siege'), narr(who + '.siege')];
    case 'treaty': return [narr('scene.treaty'), narr(who + '.treaty')];
    case 'feast': return [narr('scene.feast')];
    case 'scholar': { const c = CHAR_BY_ID[sc.id]; return [t(c.bio), t('Instruments, books and pupils follow him. Your court is becoming a place of learning.')]; }
    case 'place': { const L = LANDMARKS[sc.id]; return [t(L.name), t(L.text)]; }
  }
  return [];
}
