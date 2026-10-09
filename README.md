# Turan: Khanates of the Silk Road

A turn-based grand strategy game in the style of *Rome: Total War*, set in Turkistan in 1370. It runs in any modern browser with no installation and no build step.

The Chagatai Khanate has broken apart. Amir Temur has just taken power at Balkh, and six other powers are fighting over Central Asia. Choose one, build up its cities, raise armies, make and break alliances, and conquer Turkistan.

## How to play

- **Locally:** open `index.html` in Chrome, Firefox, Edge or Safari.
- **Online:** turn on GitHub Pages for this repository (Settings → Pages → deploy from the `main` branch, root folder). The game is then served at `https://<user>.github.io/turan/`.

**The last nation standing wins.** Destroy your rivals in war, or force them to submit and hand you their crowns. You lose if your last city falls. Each turn is half a year (Spring and Autumn), starting in 1370.

Playing is simple: click any city. In your own cities you issue royal decrees, recruit and build. In anyone else's city you see its ruler and can attack it with any army in reach, or deal with its ruler right there: trade, alliance, marriage, gifts, tribute, a demand to submit, or a declaration of war. Your vizier suggests good moves every turn.

## The nations

| Nation | Ruler in 1370 | Capital | Difficulty |
|---|---|---|---|
| Chagatai Ulus of Amir Temur | Amir Temur | Samarkand | Easy |
| Khanate of Moghulistan | Qamar al-Din Dughlat | Almaliq | Normal |
| White Horde (Aq Orda) | Urus Khan | Sighnaq | Normal |
| Golden Horde | Beglerbeg Mamai | Sarai | Normal |
| Khwarezm (Sufi dynasty) | Husayn Sufi | Urgench | Hard |
| Kartids of Herat | Ghiyath al-Din Pir Ali | Herat | Hard |
| Sarbadars of Sabzevar | Khwaja Ali Mu'ayyad | Sabzevar | Hard |

Independent cities such as Otrar, Merv, Kabul, Kandahar and Rayy are held by local lords and tribes, and can be taken by anyone.

## Features

- **Campaign map** of 72 provinces, placed by real latitude and longitude, with the Caspian and Aral Seas, Lake Balkhash, the Pamir, the Tian Shan and the great deserts.
- **Economy:** taxes, Silk Road trade, trade agreements, army upkeep, population growth, public order and revolts.
- **Buildings:** walls, barracks, stables, bazaars, irrigation (aryks and qanats) and mosques, with three levels each.
- **Armies:** 15 unit types, including a unique unit for each nation (Temur's Tovachi Guard, the Sarbadar Dervishes, Ghuri Highlanders and others). Generals gain stars with victories, grow old and die.
- **War:** field battles, sieges, storming the walls and sallies. Spearmen beat cavalry, horse archers rule the steppe, and walls favour the defender.
- **Real-time 3D battles:** fight any battle yourself on a 3D battlefield (three.js) with hundreds of individual soldiers, cavalry, arrows, dust, city walls and a free camera, or auto-resolve it. Without WebGL the game falls back to a 2D battlefield.
- **Diplomacy:** peace, alliances, trade, royal marriages, tribute, gifts and demands to submit. Broken rulers may surrender their whole realm, as the Sarbadars did to Temur in 1381. Rulers remember betrayals.
- **Stories:** most turns put a choice before you (a Sufi master's request, bandits on the Silk Road, a Ming envoy, a pretender, a caught spy, Navruz…), each with real consequences.
- **The council's requests:** tasks with deadlines and gold rewards.
- **Plunder:** armies in enemy land can raid the countryside for gold.
- **Wonders:** the Bibi-Khanym Mosque, Ak-Saray Palace, Mausoleum of Yasawi, Musalla of Herat and Grand Bazaar of Sarai, each with a realm-wide bonus for whoever holds the city.
- **A living map:** caravans on the Silk Road, boats on the Caspian and Aral, grazing herds, birds, drifting clouds, smoke over besieged cities, waving banners, and armies that visibly march and clash.
- **Royal decrees:** hold a feast, levy militia or raise a special tax in any of your cities.
- **Vizier:** up to three suggested moves each turn; click one to jump there.
- **Rival AI:** every rival plays by the same rules as you. It builds, recruits, declares war, besieges cities and sends you envoys.
- **History:** events such as the kurultai at Balkh, the death of Urus Khan, the battle of Kulikovo and the return of the plague.
- **Saving:** three save slots plus an autosave every turn, stored in the browser.

## Controls

| Campaign | |
|---|---|
| Drag / mouse wheel / pinch | Move and zoom the map |
| Click | Select a province or an army |
| Click a highlighted province, or right-click | March the selected army |
| Enter | End turn |
| D / R / C | Diplomacy / Realm / Chronicle |
| Esc | Close or open the menu |

| Battle | |
|---|---|
| Click or drag | Select regiments |
| Right-click | Move, or attack an enemy |
| Shift + right-click | Run |
| Ctrl + A | Select all |
| W A S D / Q E / mouse wheel | Move, turn and zoom the camera |
| Space | Pause |

## Historical notes

The starting situation follows the historical record of spring 1370, simplified where needed for play:

- Temur defeated Amir Husayn at Balkh and was proclaimed Great Amir on 10 April 1370. He ruled through a puppet khan, Soyurghatmish, and married the Chinggisid princess Saray Mulk Khanum to take the title Küregen ("royal son-in-law").
- Qamar al-Din Dughlat ruled Moghulistan from 1368 to 1390. He was the only Dughlat ever to proclaim himself khan, and he survived Temur's many campaigns by withdrawing into the steppe.
- Urus Khan ruled the White Horde from Sighnaq from 1369 to 1377, and drove Mamai's puppet khan from Sarai in 1373.
- Mamai, a Kiyat noble who was not a descendant of Chinggis Khan, held power in the Golden Horde through puppet khans until his defeat at Kulikovo in 1380.
- Husayn Sufi of the Qungrat tribe ruled Khwarezm from Urgench. He seized Kath and Khiva, and refused to return them, which brought Temur's invasion of 1372.
- Ghiyath al-Din Pir Ali inherited Herat in 1370 from his father Mu'izz al-Din Husayn; Sarakhs passed to his step-brother. Temur took Herat in 1381.
- The Sarbadars ("heads on the gallows") had ruled from Sabzevar since the rising of 1337, until Khwaja Ali Mu'ayyad submitted to Temur in 1381.

Sources consulted include the Wikipedia articles on Timur, Amir Husayn, Qamar-ud-din Khan Dughlat, Urus Khan, the White Horde, the Sufi dynasty, the Kart dynasty and the Sarbadars; the UNESCO Silk Road knowledge bank article *Central Asia under Timur*; and e-history.kz on the history of Kazakhstan.

## Project layout

```
index.html          the page
css/style.css       all styles
js/data.js          nations, provinces, units, buildings and historical events
js/mapgen.js        builds the map from province coordinates (Voronoi cells)
js/engine/          game rules with no browser code: state, battles, actions, turns, AI
js/ui/              map, panels, dialogs, the battlefield and screen flow
```

The engine in `js/engine/` does not touch the page, so it can be run and tested in Node.js.

## Tests

The game is tested in a real browser: every window's buttons, the city panel on desktop and phone, language
switching, saving and loading (also saves from older versions), every campaign, the daily challenges, battles
with every unit, sixty turns of the computer rulers and hot seat.

    cd tests && npm install && npx playwright install chromium   # once
    node tests/run.js              # the quick tests (about two minutes)
    node tests/run.js buttons      # only tests whose name contains "buttons"
    node tests/run.js --long       # also the slow balance runs of every campaign

They also run on GitHub on every push (.github/workflows/tests.yml).
