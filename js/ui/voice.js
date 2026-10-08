'use strict';
// Narration: a storyteller's voice reads the painted scenes, the turning points of history and the great
// events aloud, in the language of the game. It uses the voices built into the device: almost every phone and
// computer speaks English, Russian and Turkish; Uzbek voices come with newer Windows, Android and Apple systems.

const VOICE = { on: true, voices: [], speaking: false };
try { VOICE.on = localStorage.getItem('turan-voice') !== 'off'; } catch (e) { /* storage unavailable */ }
const hasSpeech = () => typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
function loadVoices() { if (hasSpeech()) VOICE.voices = speechSynthesis.getVoices() || []; }
if (hasSpeech()) { loadVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', loadVoices); }

// The best storyteller the device has for a language: natural and online voices first
function voiceFor(lang) {
  const list = VOICE.voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(lang));
  if (!list.length) return null;
  const score = v => (/natural|neural|premium|enhanced|online/i.test(v.name) ? 4 : 0) + (/google|microsoft|apple|siri/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  return list.slice().sort((a, b) => score(b) - score(a))[0];
}
const canNarrate = () => hasSpeech() && !!voiceFor(LANG);

function narrate(text) {
  if (!VOICE.on || !hasSpeech() || !text) return;
  const v = voiceFor(LANG);
  if (!v) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/<[^>]+>/g, ''));
    u.voice = v; u.lang = v.lang; u.rate = 0.93; u.pitch = 0.92;
    u.onstart = () => duckMusic(true);
    u.onend = u.onerror = () => duckMusic(false);
    speechSynthesis.speak(u);
  } catch (e) { /* the device refused */ }
}
function hush() { if (hasSpeech()) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } duckMusic(false); }
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
  if (!hasSpeech() || !canNarrate()) return t('Narration: no voice on this device');
  return t(VOICE.on ? 'Narration: on' : 'Narration: off');
}
