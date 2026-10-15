// @ts-check
/**
 * Tiny synth sound effects with the Web Audio API, so the game ships no
 * audio files. Browsers (iOS Safari especially) only allow sound after a
 * user gesture, so `unlock()` is called from the first pointerdown.
 */
import { SET } from './state.js';

/** @type {AudioContext|null} */
let ac = null;

export function unlock() {
  try {
    if (!ac) {
      const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!Ctx) return;
      ac = new Ctx();
    }
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { ac = null; }
}

/** @param {number} f @param {number} [d] @param {OscillatorType} [type] @param {number} [v] @param {number} [slide] */
function tone(f, d = 0.08, type = 'square', v = 0.04, slide = 0) {
  if (!SET.sound || !ac || ac.state !== 'running') return;
  try {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + d + 0.02);
  } catch (e) { /* ignore */ }
}
const later = (/** @type {number} */ ms, /** @type {() => void} */ fn) => setTimeout(fn, ms);

/** Pitch climbs while a score is being counted, then resets. */
let step = 0;
export const resetStep = () => { step = 0; };

export const sfx = {
  click: () => tone(660, .04, 'square', .025),
  place: () => tone(330, .09, 'triangle', .08, 1.6),
  o: () => tone(180, .12, 'sawtooth', .03, .7),
  chips: () => { tone(480 + Math.min(step, 30) * 35, .06, 'square', .03); step++; },
  mult: () => { tone(720 + Math.min(step, 30) * 30, .08, 'triangle', .06); step++; },
  xmult: () => tone(300, .15, 'sawtooth', .05, 2.5),
  score: () => { tone(523, .12, 'triangle', .07); later(70, () => tone(659, .12, 'triangle', .07)); later(140, () => tone(784, .2, 'triangle', .07)); },
  money: () => { tone(1200, .05, 'square', .03); later(50, () => tone(1600, .08, 'square', .03)); },
  bad: () => tone(160, .35, 'sawtooth', .06, .5),
  win: () => { [523, 659, 784, 1046].forEach((f, i) => later(i * 90, () => tone(f, .18, 'triangle', .07))); },
  line: () => tone(440, .1, 'triangle', .06, 1.5),
  boom: () => tone(90, .3, 'sawtooth', .08, .4),
};
