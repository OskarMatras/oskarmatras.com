let now = 0, started = 0, intervals = [];
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
const node = () => new Proxy({ connect() {}, start() { started++; }, stop() {}, frequency: param(), gain: param(), Q: param(), detune: param() }, { get: (t, k) => (k in t ? t[k] : param()), set: (t, k, v) => { t[k] = v; return true; } });
class AC { constructor() { this.state = 'running'; this.sampleRate = 8000; this.destination = node(); }
  get currentTime() { return now; } resume() {}
  createDynamicsCompressor() { return node(); } createGain() { return node(); } createBiquadFilter() { return node(); } createOscillator() { return node(); }
  createConvolver() { return node(); } createBufferSource() { return node(); }
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l) }; } }
globalThis.window = globalThis; globalThis.AudioContext = AC;
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
globalThis.document = { hidden: false };
globalThis.setInterval = (f) => { intervals.push(f); return intervals.length; }; globalThis.clearInterval = () => {};
const A = await import('../js/audio.js');
A.unlock();
for (const m of ['calm', 'play', 'boss', 'shop']) {
  A.setMood(m); started = 0;
  for (let i = 0; i < 400; i++) { now += 0.09; intervals.forEach(f => f()); }
  console.log(m, 'oscillators/noises started in ~36s:', started);
}
for (const k of Object.keys(A.sfx)) A.sfx[k](1);
console.log('sfx ok');
