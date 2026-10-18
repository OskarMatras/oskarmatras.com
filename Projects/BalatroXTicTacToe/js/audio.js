// @ts-check
/**
 * All the sound, made with the Web Audio API, so the game ships no audio files.
 *
 * Browsers (iOS Safari especially) only allow sound after a user gesture, so `unlock()` is
 * called from the first pointerdown.
 *
 * Three layers share one small mixing desk:
 *   - sound effects: short synthesised voices (a bright ding for chips, a slap for mult, a rising
 *     sweep for a multiplier...). Scoring climbs a musical scale, so a long chain sounds like a run
 *     up a keyboard instead of a pile of beeps.
 *   - a little reverb on everything, so the effects sit in a room.
 *   - a looping soundtrack made on the fly: bass, pad, a plucked arpeggio and a quiet kit, in a mood
 *     that follows the screen (calm for menus, driving for a round, darker for a boss, mellow for the
 *     shop). It starts and stops with the Music setting and never plays before the first click.
 */
import { SET } from './state.js';

/** @type {AudioContext|null} */
let ac = null;
/** @type {GainNode|null} */ let sfxBus = null;
/** @type {GainNode|null} */ let musBus = null;
/** @type {GainNode|null} */ let verbIn = null;
/** @type {AudioBuffer|null} */ let noiseBuf = null;

export function unlock() {
  try {
    if (!ac) {
      const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!Ctx) return;
      ac = new Ctx();
      build(ac);
    }
    // The soundtrack may only start once the context is really running, which resume() reports a moment later.
    if (ac.state === 'suspended') ac.resume().then(syncMusic, () => {});
    syncMusic();
  } catch (e) { ac = null; }
}

/** @param {AudioContext} a */
function build(a) {
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  const master = a.createGain(); master.gain.value = 0.9;
  comp.connect(master); master.connect(a.destination);
  sfxBus = a.createGain(); sfxBus.gain.value = 1; sfxBus.connect(comp);
  musBus = a.createGain(); musBus.gain.value = 0.0; musBus.connect(comp);
  // A short, dark room: decaying noise as an impulse response.
  const len = Math.floor(a.sampleRate * 1.5), ir = a.createBuffer(2, len, a.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  const conv = a.createConvolver(); conv.buffer = ir;
  verbIn = a.createGain(); verbIn.gain.value = 0.22;
  const verbLp = a.createBiquadFilter(); verbLp.type = 'lowpass'; verbLp.frequency.value = 3200;
  verbIn.connect(conv); conv.connect(verbLp); verbLp.connect(comp);
  noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
}

const live = () => !!(SET.sound && ac && ac.state === 'running' && sfxBus);
/** Semitones above A4 to hertz. @param {number} n */
const hz = n => 440 * Math.pow(2, n / 12);

/**
 * One note. A short attack avoids clicks; two slightly detuned oscillators make it fatter.
 * @param {number} f @param {number} [d] @param {OscillatorType} [type] @param {number} [v] @param {number} [slide]
 * @param {{ at?: number, bus?: GainNode|null, fat?: number, verb?: number, lp?: number, attack?: number }} [o]
 */
function tone(f, d = 0.08, type = 'square', v = 0.04, slide = 0, o = {}) {
  if (!ac || (!o.bus && !live())) return;
  try {
    const t = ac.currentTime + (o.at || 0), bus = o.bus || sfxBus;
    if (!bus) return;
    const g = ac.createGain(), a = o.attack ?? 0.006;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    /** @type {AudioNode} */ let out = g;
    if (o.lp) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; g.connect(lp); out = lp; }
    out.connect(bus);
    if (o.verb && verbIn) { const s = ac.createGain(); s.gain.value = o.verb; out.connect(s); s.connect(verbIn); }
    const voices = o.fat ? [-o.fat, o.fat] : [0];
    for (const det of voices) {
      const osc = ac.createOscillator();
      osc.type = type; osc.detune.value = det;
      osc.frequency.setValueAtTime(f, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + d);
      osc.connect(g); osc.start(t); osc.stop(t + d + 0.03);
    }
  } catch (e) { /* ignore */ }
}

/**
 * A burst of filtered noise: a tick, a hat, a whoosh, a paper flick.
 * @param {number} d @param {number} v @param {number} f centre frequency @param {number} [q] @param {BiquadFilterType} [kind]
 * @param {{ at?: number, bus?: GainNode|null, sweep?: number }} [o]
 */
function noise(d, v, f, q = 1, kind = 'bandpass', o = {}) {
  if (!ac || !noiseBuf || (!o.bus && !live())) return;
  try {
    const t = ac.currentTime + (o.at || 0), bus = o.bus || sfxBus;
    if (!bus) return;
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = kind; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (o.sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * o.sweep), t + d);
    const g = ac.createGain();
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(fl); fl.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + d + 0.02);
  } catch (e) { /* ignore */ }
}

/** Pitch climbs a pentatonic scale while a score is being counted, then resets. */
let step = 0;
export const resetStep = () => { step = 0; };
const PENT = [0, 2, 4, 7, 9];
/** The note `n` steps up the scale, in semitones above A3. @param {number} n */
const climb = n => { const k = Math.min(n, 24); return -12 + PENT[k % 5] + 12 * Math.floor(k / 5); };

export const sfx = {
  click: () => { tone(hz(7), .05, 'sine', .05, .8); noise(.025, .03, 4200, 1, 'highpass'); },
  place: () => { tone(hz(-9), .12, 'triangle', .1, .6, { verb: .2 }); noise(.05, .04, 1400, 1.2); },
  o: () => { tone(hz(-17), .16, 'sawtooth', .04, .6, { lp: 900, verb: .3 }); noise(.07, .03, 700, 2); },
  /** Chips: a clean bell that climbs the scale. */
  chips: () => { const f = hz(climb(step) + 12); tone(f, .16, 'sine', .07, 1, { verb: .35 }); tone(f * 2.01, .09, 'sine', .025); step++; },
  /** Mult: a rounder, lower pluck on the same scale, with a slap of noise. */
  mult: () => { const f = hz(climb(step)); tone(f, .14, 'triangle', .09, 1, { fat: 6, verb: .25 }); noise(.04, .035, 1800, 1.5); step++; },
  /** A multiplier: a sweep up, a crack and a sub-bass thump. */
  xmult: () => {
    tone(hz(-12), .32, 'sawtooth', .07, 4, { fat: 10, lp: 2600, verb: .45 });
    tone(hz(-24), .26, 'sine', .14, .5);
    noise(.3, .06, 500, 0.8, 'bandpass', { sweep: 8 });
    tone(hz(climb(step) + 24), .22, 'triangle', .05, 1, { at: .06, verb: .5 }); step += 2;
  },
  /** The line's total: a little rising arpeggio with shimmer. */
  score: () => { [0, 4, 7, 12].forEach((s, i) => tone(hz(s + 3), .22, 'triangle', .07, 1, { at: i * .06, fat: 5, verb: .45 })); },
  money: () => { tone(hz(31), .07, 'square', .035, 1); tone(hz(38), .16, 'square', .03, 1, { at: .06, verb: .3 }); },
  bad: () => { tone(hz(-5), .5, 'sawtooth', .07, .5, { fat: 12, lp: 1100, verb: .4 }); tone(hz(-12), .6, 'sine', .1, .6, { at: .08 }); noise(.35, .05, 300, 1, 'lowpass'); },
  win: () => { [0, 4, 7, 12, 16].forEach((s, i) => tone(hz(s + 3), .5, 'triangle', .07, 1, { at: i * .09, fat: 6, verb: .5 })); tone(hz(-9), .8, 'sine', .08, 1, { at: .3 }); },
  line: () => { tone(hz(3), .12, 'triangle', .06, 1.5, { verb: .3 }); noise(.08, .03, 3000, 1, 'highpass'); },
  boom: () => { tone(hz(-33), .45, 'sine', .22, .35); noise(.35, .12, 900, .6, 'lowpass', { sweep: .2 }); tone(hz(-15), .2, 'sawtooth', .05, .4); },
  /** The weight of a piece landing on the board: a low thump with a click on top. */
  thud: () => { tone(hz(-29), .13, 'sine', .16, .55); noise(.03, .05, 2400, 1); },
  /** Cards sweeping into a hand: a quick papery flick, one per card. @param {number} [i] */
  deal: (i = 0) => { noise(.07, .05, 3000 + i * 500, 1.5, 'bandpass', { sweep: .5 }); tone(hz(10 + i * 2), .03, 'triangle', .02, 1.4); },
  /** A pack opening: a rising sparkle. */
  sparkle: () => { [24, 29, 33, 36, 41].forEach((s, i) => tone(hz(s), .16, 'sine', .035, 1, { at: i * .05, verb: .6 })); },
  /** A card flies to where it belongs. */
  whoosh: () => { noise(.22, .06, 600, 1, 'bandpass', { sweep: 7 }); },
};

/* ======================================================================
   The soundtrack
   ====================================================================== */
/** @typedef {{ bpm:number, root:number, chords:number[][], arp:number[], bassPattern:number[], kick:number[], snare:number[], hat:number, pad:number, arpVol:number, bassVol:number, drums:number }} Mood */
// Chords are semitone offsets from `root` (A = 0): each bar holds one chord (root first).
/** @type {Record<string, Mood>} */
const MOODS = {
  // Menus and between rounds: slow, warm and sparse.
  calm: { bpm: 76, root: -24, chords: [[0, 7, 12, 15, 19], [-4, 3, 8, 12, 15], [3, 7, 10, 14, 19], [-2, 5, 9, 14, 17]], arp: [0, 2, 4, 2, 3, 2, 4, 1],
    bassPattern: [1, 0, 0, 0, 1, 0, 0, 0], kick: [], snare: [], hat: 0, pad: 1, arpVol: 0.5, bassVol: 0.8, drums: 0 },
  // A round: a steady groove.
  play: { bpm: 94, root: -24, chords: [[0, 7, 12, 15, 19], [-4, 3, 8, 12, 15], [3, 7, 10, 14, 19], [-2, 5, 9, 14, 17]], arp: [0, 3, 2, 4, 3, 2, 1, 2, 0, 4, 3, 2, 4, 3, 2, 1],
    bassPattern: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0], kick: [0, 6, 8, 14], snare: [4, 12], hat: 2, pad: 1, arpVol: 0.8, bassVol: 1, drums: 1 },
  // A boss: lower, faster and darker (a minor chord with a flat second).
  boss: { bpm: 108, root: -26, chords: [[0, 7, 12, 15, 19], [1, 8, 13, 16, 20], [-4, 3, 8, 12, 15], [-2, 5, 8, 14, 17]], arp: [0, 2, 3, 2, 4, 3, 2, 3, 0, 3, 4, 2, 4, 3, 2, 1],
    bassPattern: [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1], kick: [0, 3, 6, 8, 11, 14], snare: [4, 12], hat: 1, pad: 1, arpVol: 0.9, bassVol: 1.1, drums: 1.2 },
  // The shop: jazzier chords, laid back.
  shop: { bpm: 84, root: -17, chords: [[0, 7, 10, 14, 17], [5, 9, 12, 16, 19], [-5, 4, 7, 11, 14], [-3, 4, 9, 12, 16]], arp: [0, 2, 4, 3, 1, 3, 4, 2],
    bassPattern: [1, 0, 0, 1, 0, 0, 1, 0], kick: [0, 10], snare: [8], hat: 4, pad: 1, arpVol: 0.65, bassVol: 0.9, drums: 0.6 },
};
/** @type {string} */ let mood = 'calm';
/** @type {string} */ let nextMood = 'calm';
let timer = 0, nextTime = 0, tick = 0;

/** Ask for a different mood. It changes at the start of the next bar, so it never cuts a phrase. @param {'calm'|'play'|'boss'|'shop'|'off'} m */
export function setMood(m) { nextMood = m; if (m !== 'off' && ac) syncMusic(); }

function musicWanted() { return !!(SET.sound && SET.music !== false && ac && nextMood !== 'off'); }

/** Start or stop the loop to match the settings (called after any setting changes). */
export function syncMusic() {
  if (!ac || !musBus) return;
  const want = musicWanted() && ac.state === 'running' && !document.hidden;
  musBus.gain.cancelScheduledValues(ac.currentTime);
  musBus.gain.linearRampToValueAtTime(want ? 0.3 : 0, ac.currentTime + (want ? 1.2 : 0.4));
  if (want && !timer) { nextTime = ac.currentTime + 0.1; tick = 0; mood = nextMood; timer = window.setInterval(schedule, 90); }
  if (!want && timer) { clearInterval(timer); timer = 0; }
}

function schedule() {
  if (!ac || !musBus) return;
  const bus = musBus;
  // After a stall (a throttled tab, a long frame) do not replay the notes that were missed: carry on from now.
  if (nextTime < ac.currentTime - 0.3) nextTime = ac.currentTime + 0.05;
  while (nextTime < ac.currentTime + 0.25) {
    const M = MOODS[mood] || MOODS.calm, sixteenth = 60 / M.bpm / 4;
    const inBar = tick % 16, bar = Math.floor(tick / 16) % M.chords.length, chord = M.chords[bar], at = nextTime - ac.currentTime;
    if (inBar === 0) {
      if (nextMood !== mood && MOODS[nextMood]) { mood = nextMood; }
      // The pad: the whole chord, long and soft.
      if (M.pad) for (const s of chord.slice(1, 4)) tone(hz(M.root + s + 12), sixteenth * 15, 'sawtooth', 0.018, 1, { at, bus, fat: 9, lp: 1300, attack: 0.5 });
    }
    if (M.bassPattern[inBar % M.bassPattern.length] && inBar % (M.bassPattern.length === 8 ? 2 : 1) === 0) {
      tone(hz(M.root + chord[0]), sixteenth * 1.8, 'triangle', 0.15 * M.bassVol, 1, { at, bus, lp: 500 });
    }
    // The arpeggio: chord tones, plucked.
    const ai = M.arp[tick % M.arp.length];
    if (inBar % (M.drums ? 1 : 2) === 0) tone(hz(M.root + 12 + chord[ai % chord.length]), sixteenth * 2.2, 'triangle', 0.05 * M.arpVol, 1, { at, bus, verb: .4, lp: 3200 });
    // Drums, kept quiet and dull so they sit under everything.
    if (M.drums) {
      if (M.kick.includes(inBar)) tone(hz(-33), .14, 'sine', 0.2 * M.drums, .4, { at, bus });
      if (M.snare.includes(inBar)) noise(.12, 0.07 * M.drums, 1800, 0.9, 'bandpass', { at, bus });
      if (M.hat && inBar % M.hat === 0) noise(.035, 0.02 * M.drums, 7000, 0.7, 'highpass', { at, bus });
    }
    nextTime += sixteenth; tick++;
  }
}
