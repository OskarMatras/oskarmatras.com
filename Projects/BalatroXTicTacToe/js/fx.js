// @ts-check
/**
 * Particles: sparks, dust, rings and streams of points flying to a counter.
 *
 * One transparent canvas over the page, drawn only while something is alive (it stops its own
 * animation loop when the last particle dies, so an idle game costs nothing). Sparks are crisp
 * little squares rather than soft circles, to match the pixel look of the rest of the game.
 *
 * Everything here is decoration: skipped for anyone who asked for reduced motion, never touches
 * the game state, and capped so a long scoring chain cannot pile up thousands of particles.
 *
 * Where the ideas come from: these are standard game-feel techniques (squash and stretch, sparks that
 * fly into the counter they feed, impact rings and dust). The approach to Balatro-style card motion
 * was studied from the public, MIT-licensed community recreation mixandjam/balatro-feel; no code was
 * copied from it, and nothing here comes from Balatro itself.
 */
import { SET } from './state.js';

/** @typedef {{ x:number, y:number, vx:number, vy:number, ay:number, life:number, max:number, size:number, color:string, kind:'sq'|'ring'|'seek', grow?:number, tx?:number, ty?:number, delay?:number, trail?:{x:number,y:number}[], onArrive?:()=>void }} P */

/** Colours for each kind of thing that can score, light to dark so a burst has some depth. */
export const PALETTE = {
  chips: ['#2f8ff0', '#7cc0ff', '#d6ebff'],
  mult: ['#f0463a', '#ff9a8f', '#ffe0dc'],
  xmult: ['#ff5a3c', '#ffd05a', '#fff3c4'],
  money: ['#f6b92c', '#ffe08a', '#fff6c8'],
  dust: ['#d9cdb4', '#a39d8c', '#7a7566'],
  win: ['#f6b92c', '#45c67b', '#2f8ff0', '#f0463a', '#fff'],
};

const MAX = 380;
/** @type {P[]} */ const ps = [];
/** @type {HTMLCanvasElement|null} */ let cv = null;
/** @type {CanvasRenderingContext2D|null} */ let g = null;
let dpr = 1, raf = 0, last = 0;

const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
/** The faster the player runs the game, the quicker the effects should be over. */
const pace = () => Math.min(3, Math.max(1, SET.speed || 1));
const rnd = (/** @type {number} */ a, /** @type {number} */ b) => a + Math.random() * (b - a);
const pick = (/** @type {string[]} */ a) => a[Math.floor(Math.random() * a.length)];

function ensure() {
  if (cv) return true;
  const c = document.createElement('canvas');
  c.id = 'fx'; c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:48';
  document.body.appendChild(c);
  cv = c; g = c.getContext('2d');
  if (!g) return false;
  const size = () => { dpr = Math.min(2, window.devicePixelRatio || 1); c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr); };
  size(); addEventListener('resize', size);
  return true;
}

/** @param {P} p */
function add(p) { if (ps.length < MAX) ps.push(p); if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }

/** @param {number} now */
function loop(now) {
  // Never let time run backwards (a frame timestamp can be a hair earlier than when a particle was made),
  // and never let one long frame fling everything across the screen.
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  const c = /** @type {HTMLCanvasElement} */ (cv), ctx = /** @type {CanvasRenderingContext2D} */ (g);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
  ctx.imageSmoothingEnabled = false;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    if (p.delay && p.delay > 0) { p.delay -= dt; continue; }
    p.life += dt;
    if (p.kind === 'seek') {
      // Homing: accelerate toward the counter, so a stream of points visibly "feeds" it.
      const dx = /** @type {number} */ (p.tx) - p.x, dy = /** @type {number} */ (p.ty) - p.y, d = Math.hypot(dx, dy) || 1;
      const pull = 2400 * Math.min(1, p.life * 2.2 + 0.15);
      p.vx += (dx / d) * pull * dt; p.vy += (dy / d) * pull * dt;
      p.vx *= 0.94; p.vy *= 0.94;
      if (d < 14 || p.life > p.max) { if (p.onArrive) p.onArrive(); ps.splice(i, 1); continue; }
    } else if (p.life >= p.max) { ps.splice(i, 1); continue; }
    if (p.kind === 'seek') { (p.trail || (p.trail = [])).push({ x: p.x, y: p.y }); if (p.trail.length > 6) p.trail.shift(); }
    p.vy += p.ay * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const k = p.kind === 'seek' ? 1 : 1 - p.life / p.max;
    if (p.kind === 'ring') {
      const r = Math.max(0.5, p.size + (p.grow || 0) * p.life);
      ctx.globalAlpha = Math.max(0, k * 0.95); ctx.lineWidth = 5 * k + 1.5; ctx.strokeStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.stroke();
    } else {
      // A streak behind a flying point, so a stream reads as motion rather than a few dots.
      if (p.trail) p.trail.forEach((t, j) => {
        const f = (j + 1) / (p.trail ? p.trail.length : 1), ts = p.size * f * 0.8;
        ctx.globalAlpha = f * 0.45; ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(t.x - ts / 2), Math.round(t.y - ts / 2), Math.round(ts), Math.round(ts));
      });
      const s = Math.max(2, p.size * (p.kind === 'seek' ? 1 : 0.4 + 0.6 * k));
      ctx.globalAlpha = Math.min(1, k * 1.6); ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s));
      // A bright glint in one corner: the little pixel-art highlight that makes a spark sparkle.
      ctx.globalAlpha = Math.min(1, k * 1.2) * 0.9; ctx.fillStyle = '#fff';
      const gs = Math.max(1, Math.round(s * 0.38));
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), gs, gs);
    }
  }
  ctx.globalAlpha = 1;
  if (ps.length && !document.hidden) raf = requestAnimationFrame(loop);
  else { raf = 0; if (!ps.length) ctx.clearRect(0, 0, c.width / dpr, c.height / dpr); }
}

/** Centre of an element on screen, or null if it is not there. @param {Element|null} el */
export function centreOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width || r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null;
}

/**
 * A burst of square sparks flying outward and falling a little.
 * @param {number} x @param {number} y @param {string[]} colors @param {number} [n] @param {{ speed?: number, up?: number, gravity?: number, size?: number }} [o]
 */
export function burst(x, y, colors, n = 10, o = {}) {
  if (reduced() || !ensure()) return;
  const sp = (o.speed || 190) , k = pace();
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.2832), v = rnd(0.35, 1) * sp;
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 40), ay: o.gravity ?? 520, life: 0, max: rnd(0.38, 0.7) / k,
      size: rnd(7, 13) * (o.size || 1), color: pick(colors), kind: 'sq' });
  }
}

/** One ring that expands and fades: the "thud" of something landing. @param {number} x @param {number} y @param {string} color @param {number} [size] */
export function ring(x, y, color, size = 14) {
  if (reduced() || !ensure()) return;
  add({ x, y, vx: 0, vy: 0, ay: 0, life: 0, max: 0.4 / pace(), size, grow: 150, color, kind: 'ring' });
}

/** Puffs of dust along the bottom of something that has just landed. @param {number} x @param {number} y @param {number} [w] */
export function dust(x, y, w = 40) {
  if (reduced() || !ensure()) return;
  const k = pace();
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    add({ x: x + side * rnd(0, w / 2), y, vx: side * rnd(40, 150), vy: rnd(-70, -10), ay: 160, life: 0, max: rnd(0.3, 0.55) / k, size: rnd(4, 7), color: pick(PALETTE.dust), kind: 'sq' });
  }
}

/**
 * A short stream of points flying from one place to a counter, and `onArrive` when each lands.
 * @param {{x:number,y:number}} from @param {{x:number,y:number}} to @param {string[]} colors @param {number} [n] @param {() => void} [onArrive]
 */
export function stream(from, to, colors, n = 6, onArrive) {
  if (reduced() || !ensure()) { if (onArrive) onArrive(); return; }
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.2832), v = rnd(60, 190);
    add({ x: from.x, y: from.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, ay: 0, life: 0, max: 0.9 / pace(), size: rnd(8, 12), color: pick(colors),
      kind: 'seek', tx: to.x + rnd(-8, 8), ty: to.y + rnd(-4, 4), delay: i * 0.025, onArrive: i === 0 ? onArrive : undefined });
  }
}

/** Stop and clear everything, e.g. when the screen changes under the effects. */
export function clear() { ps.length = 0; }
