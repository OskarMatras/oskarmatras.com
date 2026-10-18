// @ts-check
/**
 * Ollie: the tutorial.
 *
 * Ollie is the rival O, who somehow ended up running the tutorial. He explains one thing at a
 * time, in a line or two, and only when you reach it (the first blind, the first shop, the first
 * Joker...). The jokes are there so the explanations are remembered, not so they take longer.
 *
 * Staying out of the way matters more than anything else here:
 *  - The speech bubble is click-through. Only Ollie's face (and the tiny "Skip tips") take
 *    clicks, so even if he overlaps a button, that button still works.
 *  - He picks the corner of the screen with the least in it: the one whose buttons, squares and
 *    pieces he covers the least, and stays put unless that corner gets busy.
 *  - He hides behind dialogs, leaves by himself once you have moved on (you placed the X, you left
 *    the shop) or after a few seconds, and never repeats himself. Clicking his face sends him away.
 *  - What he has said is remembered per device. "Skip tips" turns him off for good; Run info can
 *    bring him back or replay everything.
 *
 * The state of the game decides what he says (sync() runs after every render), so the engine does
 * not need to know the tutorial exists.
 */
import { S, SET, saveSettings } from './state.js';
import { t, getLang } from './strings.js';
import { winCells } from './rules.js';

/** @typedef {{ id: string, mood: string, anchor: string, when: () => boolean, keep?: () => boolean, vars?: () => Record<string, any>, text?: string, react?: boolean }} Step */

const inPlay = () => S.phase === 'play' && !!S.round && !S.busy;
const hasX = () => Array.isArray(S.board) && S.board.some((/** @type {any} */ c) => c && c.t === 'X');
const inShop = () => S.phase === 'shop' && !S.pack && !S.mode;
const bigVoucher = () => !!S.shop && !S.shop.vSold && (S.shop.voucher === 'board4' || S.shop.voucher === 'board5');
const seen = (/** @type {string} */ id) => !!(SET.seen && SET.seen[id]);

/** In the order a new player meets them. */
/** @type {Step[]} */
const STEPS = [
  { id: 'welcome', mood: 'wink', anchor: '.bcard.cur', when: () => S.phase === 'blind' && S.ante === 1 && S.blindIdx === 0 && S.stats.lines === 0 },
  { id: 'place', mood: 'smug', anchor: '#bw', when: () => inPlay() && !hasX() },
  // Once an X is down the "place" line is moot, so the hand line follows whether or not it was ever said.
  { id: 'hand', mood: 'smug', anchor: '#hand', when: () => inPlay() && hasX() && S.stats.lines === 0 && S.hand.length > 0 },
  // The first time the board shows a square where the rival would win (red) or you would score (gold).
  { id: 'danger', mood: 'smug', anchor: '#bw', when: () => inPlay() && hasX() && winCells('O').size > 0 },
  { id: 'score', mood: 'shock', anchor: '.calc', when: () => inPlay() && S.stats.lines >= 1 },
  { id: 'games', mood: 'sweat', anchor: '.stat.games', when: () => inPlay() && S.round.games < S.maxGames },
  { id: 'boss', mood: 'sweat', anchor: '.blindTag', when: () => inPlay() && S.blindIdx === 2 },
  // The first game on a bigger board, however it got bigger (the ante that opens with one, or a voucher).
  { id: 'boardGrew', mood: 'shock', anchor: '#bw', vars: () => ({ n: S.N }), when: () => inPlay() && S.N > 3 },
  { id: 'shop', mood: 'happy', anchor: '.shopCats', when: () => inShop() },
  { id: 'money', mood: 'smug', anchor: '#money', when: () => inShop() && seen('shop') },
  { id: 'joker', mood: 'happy', anchor: '.tray.jokers', when: () => S.jokers.length >= 1 && ['blind', 'play', 'shop'].includes(S.phase) && !S.busy },
  { id: 'boardOffer', mood: 'happy', anchor: '.shopCat.voucher', vars: () => ({ n: S.shop && S.shop.voucher === 'board5' ? 5 : 4 }),
    when: () => inShop() && bigVoucher(), keep: () => S.phase === 'shop' && bigVoucher() },
  { id: 'pack', mood: 'wink', anchor: '.packScene .shopGrid', when: () => S.phase === 'shop' && !!S.pack },
];

/** Basics a returning player already knows, so a saved run in progress does not re-teach them. */
const BASICS = ['welcome', 'place', 'hand', 'danger', 'score', 'games', 'shop', 'money', 'joker'];

/* ---------------- Ollie's face ----------------
 * An orange ring like the rival's O on the board, with a face in the hole. The mood is only the
 * eyes, brows and mouth, so it costs nothing to change it per line. */
/** @param {string} [mood] smug | happy | shock | sweat | wink */
export function ollie(mood = 'smug') {
  /** @param {number} x @param {number} [look] @param {number} [ry] */
  const eye = (x, look = 0, ry = 5.2) => `<ellipse cx="${x}" cy="28" rx="4.4" ry="${ry}" fill="#fff"/><circle cx="${x + look}" cy="${29 + (ry > 5.2 ? 0 : 0.4)}" r="${ry > 5.2 ? 1.7 : 2.3}" fill="#1a2524"/>`;
  const shut = (/** @type {number} */ x) => `<path d="M${x - 4.4} 29 Q${x} 25.5 ${x + 4.4} 29" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  const brow = (/** @type {string} */ d) => `<path d="${d}" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  const mouth = (/** @type {string} */ d, fill = 'none') => `<path d="${d}" stroke="#fff" stroke-width="2.4" fill="${fill}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const faces = {
    smug: eye(25, 1.4) + eye(39, 1.4) + brow('M19.5 21.5 L29 22.5') + brow('M35 19.5 L44.5 16.5') + mouth('M25 40 Q33 44.5 42 37'),
    happy: eye(25) + eye(39) + brow('M19.5 20 L29 18.5') + brow('M35 18.5 L44.5 20') + mouth('M24 38 Q33 49 42 38 Z', '#1a2524'),
    shock: eye(25, 0, 6.4) + eye(39, 0, 6.4) + brow('M19.5 17 L29 14.5') + brow('M35 14.5 L44.5 17') + `<ellipse cx="33" cy="42" rx="3.6" ry="4.6" fill="#1a2524" stroke="#fff" stroke-width="2.2"/>`,
    sweat: eye(25, -1.4) + eye(39, -1.4) + brow('M19.5 18 L29 21.5') + brow('M35 21.5 L44.5 18') + mouth('M25 42 Q29 38.5 33 42 T41 42') + `<path d="M50.5 20 Q54 26 50.5 29 Q47 26 50.5 20 Z" fill="#7cc8ff"/>`,
    wink: shut(25) + eye(39, 0.8) + brow('M35 18.5 L44.5 16') + mouth('M24 38 Q33 47 42 38'),
  };
  const face = /** @type {Record<string, string>} */ (faces)[mood] || faces.smug;
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <circle cx="32" cy="35" r="23" fill="none" stroke="#c9602a" stroke-width="12"/>
    <circle cx="32" cy="32" r="23" fill="none" stroke="#ff7b3a" stroke-width="12"/>
    <path d="M14.5 25 A19 19 0 0 1 27 13.5" fill="none" stroke="#ffb27d" stroke-width="3" stroke-linecap="round" opacity=".85"/>
    <circle cx="32" cy="32" r="17" fill="#1a2524"/>${face}</svg>`;
}

/* ---------------- the bubble ---------------- */
/** @type {{ step: Step, timer: any, corner: string|null, lang: string }|null} */
let current = null;
let quietUntil = 0, quietTimer = /** @type {any} */ (null);
/** @type {HTMLElement|null} */
let root = null;

function ensure() {
  if (root) return root;
  const r = document.createElement('div');
  r.id = 'coach'; r.hidden = true;
  r.innerHTML = `<button type="button" class="cAvatar"></button>
    <div class="cBubble" role="status"><b class="cWho">Ollie</b><p class="cText"></p><div class="cFoot"><button type="button" class="cSkip"></button></div></div>`;
  /** @type {HTMLElement} */ (r.querySelector('.cAvatar')).addEventListener('click', () => finish());
  /** @type {HTMLElement} */ (r.querySelector('.cSkip')).addEventListener('click', () => { SET.tips = false; saveSettings(); hide(); });
  document.body.appendChild(r);
  addEventListener('keydown', e => { if (e.key === 'Escape' && current && !r.hidden) finish(); });
  addEventListener('resize', () => { if (current) place(current.step); });
  root = r;
  return r;
}

/** Put the line (in the current language) and Ollie's mood into the bubble. @param {Step} step */
function fill(step) {
  const r = ensure();
  const text = step.text || t('coach.' + step.id, step.vars ? step.vars() : undefined);
  /** @type {HTMLElement} */ (r.querySelector('.cText')).innerHTML = text;
  const av = /** @type {HTMLElement} */ (r.querySelector('.cAvatar'));
  av.innerHTML = ollie(step.mood); av.setAttribute('aria-label', t('coach.dismiss'));
  /** @type {HTMLElement} */ (r.querySelector('.cSkip')).textContent = t('coach.skip');
  return text;
}

/** How long a line stays up: long enough to read it unhurried, short enough not to hang around. @param {string} html */
const readTime = html => Math.min(14000, 4200 + html.replace(/<[^>]*>/g, '').length * 55);

function clearHighlight() { document.querySelectorAll('.coach-hl').forEach(n => n.classList.remove('coach-hl')); }
/** @param {Step} step */
function highlight(step) {
  clearHighlight();
  const target = step.anchor ? document.querySelector(step.anchor) : null;
  if (target) target.classList.add('coach-hl');
}

/** Everything on screen the player might want to click, except Ollie himself. @param {HTMLElement} r */
function busyRects(r) {
  /** @type {DOMRect[]} */ const out = [];
  document.querySelectorAll('button, a[href], [data-act], input, .cell, .hp').forEach(e => {
    if (r.contains(e)) return;
    const b = e.getBoundingClientRect();
    if (b.width < 4 || b.height < 4 || b.bottom < 0 || b.top > innerHeight) return;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    out.push(b);
  });
  return out;
}
/** @param {DOMRect} a @param {DOMRect[]} rects */
function overlapArea(a, rects) {
  let sum = 0;
  for (const b of rects) {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 0 && h > 0) sum += w * h;
  }
  return sum;
}

const CORNERS = ['bl', 'br', 'tr', 'tl'];
/** Highlight what the line is about, and park Ollie in the corner that has the least in it. @param {Step} step */
function place(step) {
  const r = ensure();
  highlight(step);
  if (r.hidden) return;
  const rects = busyRects(r);
  // Try the corner he is already in first, so he only moves when it has become busy.
  const order = current && current.corner ? [current.corner, ...CORNERS.filter(c => c !== current.corner)] : CORNERS;
  /** @type {{ c: string, a: number }|null} */ let best = null;
  for (const c of order) {
    r.dataset.corner = c;
    const a = overlapArea(r.getBoundingClientRect(), rects);
    if (!best || a < best.a - 1) best = { c, a };
    if (best.a === 0) break;
  }
  r.dataset.corner = /** @type {{ c: string }} */ (best).c;
  if (current) current.corner = /** @type {{ c: string }} */ (best).c;
}

/** @param {Step} step */
function show(step) {
  const r = ensure();
  const text = fill(step);
  r.hidden = false;
  current = { step, timer: setTimeout(finish, step.react ? 3400 + text.replace(/<[^>]*>/g, '').length * 42 : readTime(text)), corner: null, lang: getLang() };
  place(step);
}

function hide() {
  if (current && current.timer) clearTimeout(current.timer);
  current = null; clearHighlight();
  if (root) root.hidden = true;
}

/** He has said his piece (or you moved on): remember it, and leave a beat before the next line. */
function finish() {
  if (!current) return;
  SET.seen = SET.seen || {}; SET.seen[current.step.id] = 1; saveSettings();
  hide();
  quietUntil = Date.now() + 2600;
  clearTimeout(quietTimer); quietTimer = setTimeout(sync, 2650);
}

const dialogOpen = () => { const o = document.getElementById('overlay'); return !!o && !o.hidden; };

/** Look at the game and say, move or retire a line. Called after every render. */
export function sync() {
  if (!SET.tips) { if (current) hide(); return; }
  SET.seen = SET.seen || {};
  if (!SET.baselined && S.phase !== 'title' && S.phase !== 'over') {
    SET.baselined = true;
    if (S.ante > 1 || S.stats.lines > 0 || S.jokers.length > 0) BASICS.forEach(id => { SET.seen[id] = 1; });
    if (S.N > 3) SET.seen.boardGrew = 1;   // an old run with a bigger board has already seen it grow
    saveSettings();
  }
  if (current) {
    const keep = current.step.keep || current.step.when;
    if (!keep()) { finish(); return; }
    if (dialogOpen()) { /** @type {HTMLElement} */ (root).hidden = true; clearHighlight(); return; }   // quiet behind a dialog
    /** @type {HTMLElement} */ (root).hidden = false;
    if (current.lang !== getLang()) { fill(current.step); current.lang = getLang(); }               // language switched mid-line
    place(current.step);   // a render replaces the elements, so find them again
    return;
  }
  if (dialogOpen() || Date.now() < quietUntil) return;
  const next = STEPS.find(s => !seen(s.id) && s.when());
  if (next) show(next);
}

/* ---------------- Ollie's asides ----------------
 * Apart from teaching, he heckles: a short line when something notable happens (he wins, you score
 * big, you spring a trap). They are rate-limited so they stay a treat, never run over a tutorial
 * line, and switch off with the rest of the tips. */
let lastAside = 0;
/** @type {Record<string, number>} */ const asides = {};
/** @type {Record<string, string>} */
const ASIDE_MOOD = { bust: 'smug', bigscore: 'shock', blindwon: 'sweat', bosswon: 'shock', cursed: 'smug', turncoat: 'shock', trap: 'shock', net: 'sweat' };
/** @param {string} kind bust | bigscore | blindwon | bosswon | cursed | turncoat | trap | net */
export function react(kind) {
  if (!SET.tips || current || dialogOpen() || Date.now() - lastAside < 14000) return;
  if (asides[kind] && Math.random() < 0.45) return;   // the first time always; after that, only now and then
  const lines = [];
  for (let i = 0; i < 6; i++) { const k = 'react.' + kind + '.' + i, s = t(k); if (s !== k) lines.push(s); }
  if (!lines.length) return;
  asides[kind] = (asides[kind] || 0) + 1; lastAside = Date.now();
  show({ id: 'react', mood: ASIDE_MOOD[kind] || 'smug', anchor: '', when: () => true, keep: () => true, react: true, text: lines[Math.floor(Math.random() * lines.length)] });
}

/** Say everything again, from the start. */
export function replay() { hide(); SET.seen = {}; SET.baselined = true; SET.tips = true; saveSettings(); sync(); }
