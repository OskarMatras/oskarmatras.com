// @ts-check
/**
 * Card feel: the slow idle sway, the lean toward your cursor, and the
 * sheen that slides across a card as it tilts.
 *
 * Technique (after studying how Balatro-style card feel is built, e.g. the
 * MIT-licensed mixandjam/balatro-feel recreation):
 *  - Every card "breathes": its X and Y tilt follow sin/cos of time, phase
 *    shifted per card so neighbours never move in lockstep.
 *  - Under the pointer the idle sway shrinks and the card leans toward the
 *    pointer instead, and it gets an overshooting scale plus a small
 *    rotation punch on enter.
 *  - Nothing jumps: each frame the current tilt eases a fixed fraction of
 *    the way to its target (exponential smoothing), so motion is fluid at
 *    any frame rate.
 *  - The tilt is written to CSS variables. CSS turns them into a 3D
 *    rotation, a glare spot that slides opposite the lean, and the edition
 *    patterns (foil, holographic, polychrome) whose position and hue are
 *    driven by the same tilt, which is what makes the shine read as a
 *    surface catching light.
 *
 * Any element with data-tilt="<stable key>" takes part. The key survives
 * re-renders, so a card keeps its motion when the DOM is rebuilt.
 */

/** @typedef {{rx:number, ry:number, hover:boolean, phase:number}} TiltState */

/** @type {Map<string, TiltState>} */
const states = new Map();
const pointer = { x: -1e4, y: -1e4, active: false };

const IDLE_TILT = 7;      // degrees of idle sway
const HOVER_TILT = 18;    // max degrees toward the pointer
const EASE = 10;          // smoothing rate (higher = snappier), per second

/** Cheap stable hash so each card gets its own sway phase. @param {string} s */
function phaseOf(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h % 628) / 100; }

export function startCardFx() {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  const finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, { passive: true });
  // On touch screens a card leans toward your finger while you press it.
  addEventListener('pointerdown', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, { passive: true });
  addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') { pointer.active = false; } }, { passive: true });
  addEventListener('pointercancel', () => { pointer.active = false; }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.active = false; });

  let last = performance.now();
  const frame = (/** @type {number} */ now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden) tick(now / 1000, dt, finePointer);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** @param {number} t @param {number} dt @param {boolean} finePointer */
function tick(t, dt, finePointer) {
  const els = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-tilt]'));
  const k = 1 - Math.exp(-EASE * dt);
  const seen = new Set();
  els.forEach(el => {
    const key = el.dataset.tilt || '';
    seen.add(key);
    let s = states.get(key);
    if (!s) { s = { rx: 0, ry: 0, hover: false, phase: phaseOf(key) }; states.set(key, s); }

    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const inside = pointer.active && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
    if (inside !== s.hover) {
      s.hover = inside;
      el.classList.toggle('is-hover', inside);
      if (inside && finePointer) punch(el);
    }

    // Target: idle sway, damped while hovered, plus the lean toward the pointer.
    const sway = inside ? 0.2 : 1;
    let tx = Math.sin(t * 1.1 + s.phase) * IDLE_TILT * sway;
    let ty = Math.cos(t * 0.9 + s.phase) * IDLE_TILT * sway;
    if (inside) {
      const nx = ((pointer.x - r.left) / r.width - 0.5) * 2;   // -1..1
      const ny = ((pointer.y - r.top) / r.height - 0.5) * 2;
      tx += -ny * HOVER_TILT;
      ty += nx * HOVER_TILT;
    }
    s.rx += (tx - s.rx) * k;
    s.ry += (ty - s.ry) * k;

    el.style.setProperty('--rx', s.rx.toFixed(2) + 'deg');
    el.style.setProperty('--ry', s.ry.toFixed(2) + 'deg');
    // Light comes from the upper left: the glare slides opposite the lean.
    el.style.setProperty('--gx', (50 - s.ry * 2.6).toFixed(1) + '%');
    el.style.setProperty('--gy', (35 + s.rx * 2.6).toFixed(1) + '%');
    el.style.setProperty('--sx', (-s.ry * 0.3).toFixed(1) + 'px');
    el.style.setProperty('--sy', (4 + s.rx * 0.2 + (inside ? 3 : 0)).toFixed(1) + 'px');
    // A single 0..1 value the edition patterns slide along.
    el.style.setProperty('--sheen', ((s.ry - s.rx) / (HOVER_TILT * 2) + 0.5).toFixed(3));
  });
  // Forget cards that are gone (sold, used, left the shop).
  if (states.size > seen.size + 40) for (const key of states.keys()) if (!seen.has(key)) states.delete(key);
}

/** Short rotational wobble, like a card being flicked. @param {HTMLElement} el */
export function punch(el) {
  el.classList.remove('punch'); void el.offsetWidth; el.classList.add('punch');
}
