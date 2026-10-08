'use strict';
// Narration: a storyteller's voice reads the painted scenes, the turning points of history and the great
// events aloud, in the language of the game. It uses the voices built into the device: almost every phone and
// computer speaks English and Russian; Uzbek voices come with Microsoft Edge and newer phones. Where there is no
// Uzbek voice, a Turkish one reads the Uzbek text, which it pronounces fairly well.

const VOICE = { on: true, speaking: false, pick: {}, q: [], gen: 0 };
try {
  VOICE.on = localStorage.getItem('turan-voice') !== 'off';
  VOICE.pick = JSON.parse(localStorage.getItem('turan-voice-pick') || '{}');
} catch (e) { /* storage unavailable */ }
const hasSpeech = () => typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
const allVoices = () => { try { return hasSpeech() ? speechSynthesis.getVoices() || [] : []; } catch (e) { return []; } };
if (hasSpeech()) { allVoices(); try { speechSynthesis.addEventListener('voiceschanged', () => allVoices()); } catch (e) { /* old browser */ } }

// Languages that can stand in when the device has no voice for the game's language
const VOICE_FALLBACK = { uz: ['tr'] };
const voiceLang = v => (v.lang || '').toLowerCase().replace('_', '-').slice(0, 2);
// Every voice that could read this language, best first: the player's own choice, then natural and online voices
function voicesFor(lang) {
  const vs = allVoices(), out = [];
  for (const l of [lang, ...(VOICE_FALLBACK[lang] || [])]) {
    const list = vs.filter(v => voiceLang(v) === l);
    const score = v => (/natural|neural|premium|enhanced/i.test(v.name) ? 4 : 0) + (/online/i.test(v.name) ? 2 : 0) + (/microsoft|apple|siri/i.test(v.name) ? 1 : 0);
    out.push(...list.sort((a, b) => score(b) - score(a)));
  }
  const mine = VOICE.pick[lang] && out.find(v => v.name === VOICE.pick[lang]);
  return mine ? [mine, ...out.filter(v => v !== mine)] : out;
}
const canNarrate = () => hasSpeech() && voicesFor(LANG).length > 0;

// Long texts go in short pieces: some browsers fall silent after about fifteen seconds of one utterance
function sentences(text) {
  const parts = String(text).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…»"”]*\s*/g) || [];
  const out = [];
  for (const p of parts) { if (out.length && (out[out.length - 1] + p).length < 160) out[out.length - 1] += p; else out.push(p); }
  return out.map(s => s.trim()).filter(Boolean);
}

function narrate(text, force) {
  if ((!VOICE.on && !force) || !hasSpeech() || !text) return;
  const list = voicesFor(LANG);
  if (!list.length) return;
  const gen = ++VOICE.gen;
  try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  // A pause after cancelling, or the browser may drop what comes next
  setTimeout(() => { if (gen === VOICE.gen) speakParts(sentences(text), list, 0, gen); }, 160);
}
function speakParts(parts, list, vi, gen) {
  if (!parts.length || gen !== VOICE.gen) { duckMusic(false); return; }
  const v = list[vi];
  if (!v) { duckMusic(false); return; }
  const u = new SpeechSynthesisUtterance(parts[0]);
  u.voice = v; u.lang = v.lang; u.rate = 0.93; u.pitch = 0.95; u.volume = 1;
  let started = false;
  u.onstart = () => { started = true; duckMusic(true); };
  u.onend = () => { VOICE.q = VOICE.q.filter(x => x !== u); speakParts(parts.slice(1), list, vi, gen); };
  // A voice that fails (an online voice with no connection, say) hands over to the next one
  u.onerror = e => { VOICE.q = VOICE.q.filter(x => x !== u); if (gen !== VOICE.gen || (e && (e.error === 'interrupted' || e.error === 'canceled'))) return; speakParts(parts, list, started ? vi : vi + 1, gen); };
  VOICE.q.push(u); // keep a reference: some browsers forget utterances and cut them off
  try { speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { duckMusic(false); }
}
function hush() { VOICE.gen++; if (hasSpeech()) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } VOICE.q = []; duckMusic(false); }
// The music steps back while the storyteller speaks
function duckMusic(on) {
  if (VOICE.speaking === on) return;
  VOICE.speaking = on;
  try { if (SND.cur) setVol(SND.cur, musicLevel() * (on ? 0.3 : 1)); } catch (e) { /* no music */ }
}
function setNarration(on) {
  VOICE.on = on;
  try { localStorage.setItem('turan-voice', on ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
  if (!on) hush();
}
function narrationLabel() {
  if (!canNarrate()) return t('Narration: no voice on this device');
  return t(VOICE.on ? 'Narration: on' : 'Narration: off');
}

// The narration settings: on or off, which voice, and a test
function openNarration() {
  const render = () => {
    const list = voicesFor(LANG), cur = list[0];
    if (!hasSpeech()) return `<h3>${t('Narration')}</h3><p>${t('This browser cannot speak. Try Google Chrome, Microsoft Edge or Safari.')}</p>`;
    if (!list.length) return `<h3>${t('Narration')}</h3><p>${t('This device has no voice for this language.')}</p><p class="note">${t('On a computer, Microsoft Edge has Uzbek, Russian, Turkish and English voices built in. In other browsers, add a voice in your system’s speech settings (text-to-speech), then open the game again. You can also switch the game to another language.')}</p>`;
    const opts = list.map(v => `<option value="${v.name.replace(/"/g, '&quot;')}" ${v === cur ? 'selected' : ''}>${v.name} (${v.lang})</option>`).join('');
    const stand = voiceLang(cur) !== LANG ? `<p class="note">${t('There is no voice for this language on this device, so a voice of another language reads it. Microsoft Edge has Uzbek voices built in.')}</p>` : '';
    return `<h3>${t('Narration')}</h3><p>${t('A storyteller reads the painted scenes, the turning points of history and the great events aloud.')}</p>
      <div class="btnrow"><button data-v="toggle" class="${VOICE.on ? 'big' : ''}">${narrationLabel()}</button><button data-v="test">▶ ${t('Test the voice')}</button></div>
      <p><label>${t('Voice')}: <select data-v="pick">${opts}</select></label></p>${stand}`;
  };
  const sample = () => narrate(t('A storyteller will read the great scenes and the turning points of history aloud.'), true);
  return showModal(render(), [{ label: t('Close'), value: null, cls: 'big' }], {
    cancel: null,
    onOpen: m => { m.addEventListener('change', e => { if (e.target.dataset.v === 'pick') { VOICE.pick[LANG] = e.target.value; try { localStorage.setItem('turan-voice-pick', JSON.stringify(VOICE.pick)); } catch (err) { /* ignore */ } sample(); } }); },
    onClick: e => {
      const b = e.target.closest('[data-v]');
      if (!b || b.tagName === 'SELECT') return;
      if (b.dataset.v === 'toggle') { setNarration(!VOICE.on); if (VOICE.on) sample(); $('modal').querySelector('[data-v="toggle"]').outerHTML = `<button data-v="toggle" class="${VOICE.on ? 'big' : ''}">${narrationLabel()}</button>`; }
      if (b.dataset.v === 'test') sample();
    },
  });
}
