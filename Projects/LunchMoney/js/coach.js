// @ts-check
/**
 * Pip: the guide.
 *
 * Pip is the kind kid who shows you round. In the prologue (tutorial.js) Pip walks you through the first game
 * step by step; afterwards Pip is a light touch: one thing at a time, in a line or two, and only when you reach it
 * (the first bully, the board growing, the first Trick...). The jokes are there so the explanations are
 * remembered, not so they take longer.
 *
 * Staying out of the way matters more than anything else here:
 *  - The speech bubble is click-through. Only Pip's face (and the tiny "Skip tips") take
 *    clicks, so even if he overlaps a button, that button still works.
 *  - Pip picks the corner of the screen with the least in it: the one whose buttons, squares and
 *    pieces are covered the least, and stays put unless that corner gets busy.
 *  - Pip hides behind dialogs, leaves by itself once you have moved on (you placed the X, you left
 *    the shop) or after a few seconds, and never repeats a line. Clicking the face sends Pip away.
 *  - What has been said is remembered per device. "Skip tips" turns it off for good; Run info can
 *    bring it back or replay everything.
 *  - In the prologue the bubble stays until the step is done (it waits for the Next button, or for
 *    you to do what it asks), and it can sit over a dialog.
 *
 * The state of the game decides what is said (sync() runs after every render), so the engine does
 * not need to know the tips exist.
 */
import { S, SET, saveSettings } from './state.js';
import { t, getLang } from './strings.js';
import { winCells } from './rules.js';
import { face } from './faces.js';
import { current as tutCurrent, ack as tutAck, tutOn, BASICS } from './tutorial.js';

/** @typedef {{ id: string, mood: string, anchor: string, when: () => boolean, keep?: () => boolean, vars?: () => Record<string, any>, text?: string, react?: boolean, key?: string, tut?: boolean, next?: boolean, overDialog?: boolean }} Step */

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

/* ---------------- Pip's face ----------------
 * The same cartoon kid as in the story (faces.js), with a mood: only the eyes and mouth change. */
/** @type {Record<string, string>} */
const FACE_MOOD = { wink: 'grin', smug: 'grin', sweat: 'worry', shock: 'shock' };
/** @param {string} [mood] happy | grin | shock | worry | cheer | boo | gasp */
export function pip(mood = 'happy') { return face('pip', 64, FACE_MOOD[mood] || mood); }

/* ---------------- the bubble ---------------- */
/** @type {{ step: Step, timer: any, corner: string|null, lang: string }|null} */
let current = null;
let quietUntil = 0, quietTimer = /** @type {any} */ (null);
/** @type {HTMLElement|null} */
let root = null;
/** What "Skip the tutorial" does: the interface registers it (the engine is not imported here). @type {(() => void)|null} */
let skipHandler = null;
/** @param {() => void} fn */
export const onSkipTutorial = fn => { skipHandler = fn; };

function ensure() {
  if (root) return root;
  const r = document.createElement('div');
  r.id = 'coach'; r.hidden = true;
  r.innerHTML = `<button type="button" class="cAvatar"></button>
    <div class="cBubble" role="status"><b class="cWho">Pip</b><p class="cText"></p><div class="cFoot"><button type="button" class="cSkip"></button><button type="button" class="cNext"></button></div></div>`;
  /** @type {HTMLElement} */ (r.querySelector('.cAvatar')).addEventListener('click', () => { if (current && current.step.tut) return; finish(); });
  /** @type {HTMLElement} */ (r.querySelector('.cSkip')).addEventListener('click', () => {
    if (current && current.step.tut) { if (skipHandler) skipHandler(); return; }
    SET.tips = false; saveSettings(); hide();
  });
  /** @type {HTMLElement} */ (r.querySelector('.cNext')).addEventListener('click', () => { if (current && current.step.tut) { tutAck(current.step.id); hide(); sync(); } });
  document.body.appendChild(r);
  addEventListener('keydown', e => { if (e.key === 'Escape' && current && !r.hidden && !current.step.tut) finish(); });
  addEventListener('resize', () => { if (current) place(current.step); });
  root = r;
  return r;
}

/** Put the line (in the current language) and Pip's mood into the bubble. @param {Step} step */
function fill(step) {
  const r = ensure();
  const text = step.text || t(step.key || 'coach.' + step.id, step.vars ? step.vars() : undefined);
  /** @type {HTMLElement} */ (r.querySelector('.cText')).innerHTML = text;
  const av = /** @type {HTMLElement} */ (r.querySelector('.cAvatar'));
  av.innerHTML = pip(step.mood); av.setAttribute('aria-label', t('coach.dismiss'));
  /** @type {HTMLElement} */ (r.querySelector('.cSkip')).textContent = step.tut ? t('tut.skip') : t('coach.skip');
  const nx = /** @type {HTMLElement} */ (r.querySelector('.cNext'));
  nx.hidden = !(step.tut && step.next); nx.textContent = t('tut.next');
  r.classList.toggle('tut', !!step.tut);
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

/** Everything on screen the player might want to click, except Pip. @param {HTMLElement} r */
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
/** Highlight what the line is about, and park Pip in the corner that has the least in it. @param {Step} step */
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
  current = { step, timer: step.tut ? null : setTimeout(finish, step.react ? 3400 + text.replace(/<[^>]*>/g, '').length * 42 : readTime(text)), corner: null, lang: getLang() };
  place(step);
}

function hide() {
  if (current && current.timer) clearTimeout(current.timer);
  current = null; clearHighlight();
  if (root) root.hidden = true;
}

/** Pip has said the piece (or you moved on): remember it, and leave a beat before the next line. */
function finish() {
  if (!current) return;
  if (current.step.tut) { tutAck(current.step.id); hide(); return; }
  SET.seen = SET.seen || {}; SET.seen[current.step.id] = 1; saveSettings();
  hide();
  quietUntil = Date.now() + 2600;
  clearTimeout(quietTimer); quietTimer = setTimeout(sync, 2650);
}

const dialogOpen = () => { const o = document.getElementById('overlay'); return !!o && !o.hidden; };

/** Look at the game and say, move or retire a line. Called after every render. */
export function sync() {
  if (tutOn()) return syncTutorial();
  if (current && current.step.tut) hide();   // the prologue is over
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

/** The prologue's steps (tutorial.js): the bubble stays until the step is done, and may sit over a dialog. */
function syncTutorial() {
  const st = tutCurrent();
  if (!st) { if (current) hide(); return; }
  if (current && current.step.id === st.id) {
    /** @type {HTMLElement} */ (root).hidden = dialogOpen() && !st.overDialog;
    if (current.lang !== getLang()) { fill(current.step); current.lang = getLang(); }
    place(current.step);
    return;
  }
  hide();
  show({ id: st.id, key: 'tut.' + st.id, vars: st.vars, tut: true, next: !!st.next, overDialog: !!st.overDialog, mood: st.mood, anchor: st.anchor, when: () => true });
}

/* ---------------- Pip's asides ----------------
 * Apart from teaching, Pip cheers you on and winces for you: a short line when something notable happens (you
 * lose a game, you score big, you spring a trap, the Sixth-Grader cheats). They are rate-limited so they stay a treat, never run over a tutorial
 * line, and switch off with the rest of the tips. */
let lastAside = 0;
/** @type {Record<string, number>} */ const asides = {};
/** @type {Record<string, string>} */
const ASIDE_MOOD = { bust: 'worry', bigscore: 'cheer', blindwon: 'cheer', bosswon: 'cheer', cursed: 'worry', turncoat: 'shock', trap: 'grin', net: 'grin', cheat: 'boo' };
/** @param {string} kind bust | bigscore | blindwon | bosswon | cursed | turncoat | trap | net | cheat */
export function react(kind) {
  if (tutOn() || !SET.tips || current || dialogOpen() || Date.now() - lastAside < 14000) return;
  if (asides[kind] && Math.random() < 0.45) return;   // the first time always; after that, only now and then
  const lines = [];
  for (let i = 0; i < 6; i++) { const k = 'react.' + kind + '.' + i, s = t(k); if (s !== k) lines.push(s); }
  if (!lines.length) return;
  asides[kind] = (asides[kind] || 0) + 1; lastAside = Date.now();
  show({ id: 'react', mood: ASIDE_MOOD[kind] || 'happy', anchor: '', when: () => true, keep: () => true, react: true, text: lines[Math.floor(Math.random() * lines.length)] });
}

/** Say everything again, from the start. */
export function replay() { hide(); SET.seen = {}; SET.baselined = true; SET.tips = true; saveSettings(); sync(); }
