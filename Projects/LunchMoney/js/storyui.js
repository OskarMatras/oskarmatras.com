// @ts-check
/**
 * The story player: a full-screen scene over the game. Characters walk in from the sides and talk one line
 * at a time (click, Space or Enter for the next), the crowd along the bottom cheers, boos or gasps, and the
 * screen jolts when the Sixth-Grader arrives. What is said comes from story.js; this file only draws it.
 */
import { face, CROWD } from './faces.js';
import { SCENES, WHO } from './story.js';
import { TURFS } from './data.js';
import { getLang, t } from './strings.js';
import { sfx } from './audio.js';

/** @typedef {import('./story.js').Beat} Beat */

let root = /** @type {HTMLElement|null} */ (null);
/** @type {{ id: string, i: number, done: () => void, typing: any, full: string }|null} */
let cur = null;
const SLOTS = /** @type {const} */ (['L', 'M', 'R']);
/** What each slot shows right now: 'id:mood' with a ! when it is a silhouette. @type {Record<string, string>} */
let held = { L: '', M: '', R: '' };
let crowdMode = 'off';
let bgNow = '';

const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function ensure() {
  if (root) return root;
  const r = document.createElement('div');
  r.id = 'story'; r.hidden = true; r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true');
  r.innerHTML = `<div class="stBack"></div><div class="stSpot"></div>
    <div class="stCrowd" aria-hidden="true"></div>
    <div class="stFig stL" aria-hidden="true"></div><div class="stFig stM" aria-hidden="true"></div><div class="stFig stR" aria-hidden="true"></div>
    <div class="stCard" hidden></div>
    <div class="stBox"><b class="stWho"></b><p class="stText" aria-live="polite"></p><span class="stHint" aria-hidden="true"></span></div>
    <button type="button" class="stSkip"></button><div class="stDots" aria-hidden="true"></div>`;
  document.body.appendChild(r);
  r.addEventListener('click', e => {
    if ((/** @type {HTMLElement} */ (e.target)).closest('.stSkip')) { end(); return; }
    next();
  });
  addEventListener('keydown', e => {
    if (!cur || !root || root.hidden) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); next(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); }
  }, true);
  root = r;
  return r;
}

export const storyOpen = () => !!cur;
export const storyId = () => (cur ? cur.id : null);

/** Play a scene from its first line. @param {string} id @param {() => void} done called when it ends or is skipped */
export function showStory(id, done) {
  const r = ensure();
  if (!SCENES[id]) { done(); return; }
  cur = { id, i: -1, done, typing: null, full: '' };
  held = { L: '', M: '', R: '' }; crowdMode = 'off'; bgNow = '';
  r.hidden = false; r.dataset.scene = id;
  for (const s of SLOTS) setFigure(s, '', true);
  paintCrowd('off');
  document.body.classList.add('inStory');
  /** @type {HTMLElement} */ (r.querySelector('.stSkip')).textContent = t('story.skip');
  next();
}

function end() {
  if (!cur || !root) return;
  clearInterval(cur.typing);
  const d = cur.done; cur = null;
  root.hidden = true; document.body.classList.remove('inStory');
  d();
}

/** First click finishes the line that is being typed; the next one moves on. */
function next() {
  if (!cur) return;
  if (cur.typing) { finishTyping(); return; }
  const beats = SCENES[cur.id];
  cur.i++;
  if (cur.i >= beats.length) { end(); return; }
  show(beats[cur.i]);
}

/** @param {Beat} b */
function show(b) {
  const r = /** @type {HTMLElement} */ (root);
  if (b.bg && b.bg !== bgNow) { r.classList.remove('bg-' + bgNow); r.classList.add('bg-' + b.bg); bgNow = b.bg; }
  for (const s of SLOTS) if (b[s] !== undefined) setFigure(s, b[s] || '');
  if (b.crowd && b.crowd !== crowdMode) paintCrowd(b.crowd);
  const card = /** @type {HTMLElement} */ (r.querySelector('.stCard'));
  const box = /** @type {HTMLElement} */ (r.querySelector('.stBox'));
  card.hidden = !b.card; box.hidden = !!b.card;
  const text = (getLang() === 'da' ? b.da : b.en) || b.en || '';
  // Whoever is speaking steps forward; the others dim a little.
  const speaker = b.w;
  for (const s of SLOTS) {
    const f = /** @type {HTMLElement} */ (r.querySelector('.st' + s));
    const id = (held[s] || '').split(':')[0];
    f.classList.toggle('talk', !!id && id === speaker);
    f.classList.toggle('quiet', !!id && speaker !== 'narr' && id !== speaker);
  }
  if (b.fx === 'thud') { r.classList.remove('thud'); void r.offsetWidth; r.classList.add('thud'); sfx.boom(); }
  if (b.fx === 'bell') sfx.win();
  if (b.card) {
    card.textContent = text; card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    const c = /** @type {NonNullable<typeof cur>} */ (cur);
    c.full = text; c.typing = setTimeout(() => { c.typing = null; }, 1400);   // a chapter card holds for a moment, then a click moves on
    box.hidden = true;
  } else {
    const who = /** @type {HTMLElement} */ (r.querySelector('.stWho'));
    const w = WHO[speaker];
    who.textContent = w ? (getLang() === 'da' ? w.da : w.en) : '';
    who.hidden = !w; box.classList.toggle('narr', !w);
    type(text);
  }
  const total = SCENES[/** @type {NonNullable<typeof cur>} */ (cur).id].length, i = /** @type {NonNullable<typeof cur>} */ (cur).i;
  /** @type {HTMLElement} */ (r.querySelector('.stDots')).textContent = i + 1 + ' / ' + total;
}

/** The typewriter: a few characters a frame, with a soft blip for speech. @param {string} text */
function type(text) {
  const c = /** @type {NonNullable<typeof cur>} */ (cur);
  const p = /** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (root)).querySelector('.stText'));
  const hint = /** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (root)).querySelector('.stHint'));
  c.full = text; p.textContent = ''; hint.textContent = '';
  if (reduce()) { p.textContent = text; hint.textContent = '▶'; return; }
  let n = 0;
  clearInterval(c.typing);
  c.typing = setInterval(() => {
    n += 2; p.textContent = text.slice(0, n);
    if (n % 6 === 0) sfx.click();
    if (n >= text.length) { clearInterval(c.typing); c.typing = null; hint.textContent = '▶'; }
  }, 22);
}
function finishTyping() {
  const c = /** @type {NonNullable<typeof cur>} */ (cur);
  clearInterval(c.typing); clearTimeout(c.typing); c.typing = null;
  const r = /** @type {HTMLElement} */ (root);
  if (!/** @type {HTMLElement} */ (r.querySelector('.stCard')).hidden) return;
  /** @type {HTMLElement} */ (r.querySelector('.stText')).textContent = c.full;
  /** @type {HTMLElement} */ (r.querySelector('.stHint')).textContent = '▶';
}

/** Put a character in a slot, walking in from the side if the slot was empty. @param {'L'|'M'|'R'} slot @param {string} spec @param {boolean} [instant] */
function setFigure(slot, spec, instant = false) {
  const el = /** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (root)).querySelector('.st' + slot));
  const was = held[slot];
  if (spec === was) return;
  held[slot] = spec;
  if (!spec) {
    if (instant || !was || reduce()) { el.innerHTML = ''; el.className = 'stFig st' + slot; return; }
    el.classList.add('leave');
    const keep = spec;
    setTimeout(() => { if (held[slot] === keep) { el.innerHTML = ''; el.className = 'stFig st' + slot; } }, 420);
    return;
  }
  const [id, mood = '', ] = spec.replace('!', '').split(':');
  const dark = spec.includes('!');
  const wasId = was ? was.replace('!', '').split(':')[0] : '';
  const size = slot === 'M' ? 190 : 300;
  el.innerHTML = face(id, size, mood);
  el.className = 'stFig st' + slot + (dark ? ' sil' : '') + (wasId === id && !reduce() ? '' : ' enter');
  el.dataset.who = id;
  if (wasId !== id) sfx.deal(slot === 'L' ? 0 : slot === 'M' ? 1 : 2);
}

/** The kids along the bottom. @param {string} mode */
function paintCrowd(mode) {
  const el = /** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (root)).querySelector('.stCrowd'));
  const prev = crowdMode; crowdMode = mode;
  if (mode === 'off') { el.className = 'stCrowd'; el.innerHTML = ''; return; }
  const mood = mode === 'cheer' || mode === 'boo' || mode === 'gasp' ? mode : '';
  if (mode === 'turf') {
    el.className = 'stCrowd turf enter';
    el.innerHTML = TURFS.map(tf => `<span class="kid" title="${tf.kid}">${face(tf.id, 96, '')}<i>${tf.kid}</i></span>`).join('');
    return;
  }
  const kids = CROWD.slice(0, 12);
  el.className = 'stCrowd ' + mode + (prev === 'off' || prev === 'turf' ? ' enter' : '');
  el.innerHTML = kids.map((id, k) => `<span class="kid" style="--k:${k}">${face(id, 84, mood)}</span>`).join('');
}
