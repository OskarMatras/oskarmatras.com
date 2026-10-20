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

/** @typedef {{ id: string, mood: string, anchor: string, when: () => boolean, keep?: () => boolean, vars?: () => Record<string, any>, text?: string, react?: boolean, key?: string, tut?: boolean, next?: boolean, overDialog?: boolean, point?: string }} Step */

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
/** True while Pip has stopped the game to explain something (explain()): the prologue steps wait. */
let explaining = false;
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
  /** @type {HTMLElement} */ (r.querySelector('.cNext')).addEventListener('click', () => {
    if (!current || !current.step.tut) return;
    const res = /** @type {any} */ (current).resolve;
    tutAck(current.step.id); hide();
    if (res) { explaining = false; res(); } else sync();
  });
  document.body.appendChild(r);
  addEventListener('keydown', e => { if (e.key === 'Escape' && current && !r.hidden && !current.step.tut) finish(); });
  addEventListener('resize', () => { if (current) place(current.step); });
  root = r;
  return r;
}

/* ---------------- Pip points ----------------
 * In the prologue Pip does not just talk: Pip walks out of the corner to what the step is about, wobbles beside it and
 * points. When there are several things (the squares of a row, the Marbles and Swagger boxes, each piece in the hand)
 * Pip hops from one to the next. The corner avatar stays hidden while Pip is out, and the whole thing is click-through. */
/** @type {HTMLElement|null} */
let ptr = null;
/** @type {{ els: Element[], i: number, timer: any, mood: string }} */
const pt = { els: [], i: 0, timer: null, mood: '' };

function ensurePointer() {
  if (ptr) return ptr;
  const p = document.createElement('div');
  p.id = 'pipPoint'; p.hidden = true; p.setAttribute('aria-hidden', 'true');
  p.innerHTML = '<span class="ppPip"></span><svg class="ppArrow" viewBox="0 0 60 36" width="60" height="36"><path d="M4 18 H40 M30 6 L50 18 L30 30" fill="none" stroke="#1b1612" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 18 H40 M30 6 L50 18 L30 30" fill="none" stroke="#ffd84a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.body.appendChild(p);
  ptr = p;
  return p;
}
function hidePointer() {
  clearInterval(pt.timer); pt.timer = null; pt.els = []; pt.i = 0;
  if (ptr) ptr.hidden = true;
  if (root) root.classList.remove('pointing');
}
/** Stand beside the element, on the side with room, and aim the arrow at it. @param {Element} el */
function standBeside(el) {
  const p = ensurePointer(), r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2, gap = 70;
  /** @type {[number, number][]} */
  const spots = [[r.left - gap, cy], [r.right + gap, cy], [cx, r.top - gap], [cx, r.bottom + gap]];
  // never stand on another thing Pip is about to point at (the Swagger box beside the Marbles box)
  const others = pt.els.filter(e => e !== el).map(e => e.getBoundingClientRect());
  const clear = (/** @type {[number, number]} */ s) => !others.some(o => s[0] + 34 > o.left && s[0] - 34 < o.right && s[1] + 34 > o.top && s[1] - 34 < o.bottom);
  const ok = (/** @type {[number, number]} */ s) => s[0] > 40 && s[0] < innerWidth - 40 && s[1] > 40 && s[1] < innerHeight - 40 && clear(s);
  const [px, py] = spots.find(ok) || [Math.min(innerWidth - 50, r.right + 40), Math.min(innerHeight - 50, cy)];
  // aim at the nearest point of the element, not its middle, so the arrow ends at the edge of what it points at
  const tx = Math.max(r.left, Math.min(px, r.right)), ty = Math.max(r.top, Math.min(py, r.bottom));
  const ang = Math.atan2(ty - py, tx - px);
  p.style.left = (px - 32) + 'px'; p.style.top = (py - 32) + 'px';
  const ar = /** @type {HTMLElement} */ (p.querySelector('.ppArrow'));
  ar.style.left = (32 + Math.cos(ang) * 46 - 30) + 'px'; ar.style.top = (32 + Math.sin(ang) * 46 - 18) + 'px';
  ar.style.rotate = ang + 'rad';
}
/** (Re)aim the pointer at what the step says. Called whenever the bubble is placed, which is after every redraw. @param {Step} step */
function updatePointer(step) {
  if (!step.tut || !root || root.hidden) { hidePointer(); return; }
  const sel = step.point || step.anchor;
  const els = sel ? [...document.querySelectorAll(sel)].filter(e => { const b = e.getBoundingClientRect(); return b.width > 4 && b.height > 4; }) : [];
  if (!els.length) { hidePointer(); return; }
  const p = ensurePointer();
  const same = pt.els.length === els.length && pt.els[0] && els[0] && pt.els[0].isConnected && els[0].className === pt.els[0].className && pt.mood === step.mood && !p.hidden;
  pt.els = els; if (pt.i >= els.length) pt.i = 0;
  if (!same || p.hidden) {
    p.querySelector('.ppPip').innerHTML = pip(step.mood); pt.mood = step.mood;
    if (p.hidden) {   // walk out of the corner: start where the avatar sits, then move on the next frame
      const av = /** @type {HTMLElement} */ (root.querySelector('.cAvatar')).getBoundingClientRect();
      p.style.transition = 'none'; p.style.left = av.left + 'px'; p.style.top = av.top + 'px'; p.hidden = false;
      void p.offsetWidth; p.style.transition = '';
    }
    root.classList.add('pointing');
  }
  standBeside(els[pt.i]);
  if (els.length > 1 && !pt.timer) pt.timer = setInterval(() => { if (!pt.els.length) return; pt.i = (pt.i + 1) % pt.els.length; if (pt.els[pt.i].isConnected) standBeside(pt.els[pt.i]); }, 1500);
  if (els.length < 2 && pt.timer) { clearInterval(pt.timer); pt.timer = null; }
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
  if (step.anchor) document.querySelectorAll(step.anchor).forEach(n => n.classList.add('coach-hl'));
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
  // what Pip is pointing at counts as busy too, so the bubble does not cover it
  document.querySelectorAll('.coach-hl').forEach(e => { const b = e.getBoundingClientRect(); if (b.width > 4 && b.height > 4) out.push(b); });
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
  updatePointer(step);
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
  current = null; clearHighlight(); hidePointer();
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

/**
 * Stop the game and explain something: Pip talks, `anchor` (any number of elements) is highlighted, and the
 * returned promise resolves when the player presses Next. The engine awaits it in the middle of scoring.
 * @param {string} key a string key (tut.sc_...) @param {string} anchor @param {Record<string, any>} [vars] @param {string} [point] what Pip points at
 * @returns {Promise<void>}
 */
export function explain(key, anchor, vars = {}, point = '') {
  return new Promise(resolve => {
    explaining = true; hide();
    show({ id: 'x:' + key, key, vars: () => vars, tut: true, next: true, mood: 'happy', anchor, point, when: () => true, overDialog: true });
    if (current) /** @type {any} */ (current).resolve = resolve;
  });
}

/** The prologue's steps (tutorial.js): the bubble stays until the step is done, and may sit over a dialog. */
function syncTutorial() {
  if (explaining) {   // Pip has stopped the game: keep the bubble where it is, in the right language
    if (current) {
      if (current.lang !== getLang()) { fill(current.step); current.lang = getLang(); }
      place(current.step);
    }
    return;
  }
  const st = tutCurrent();
  if (!st) { if (current) hide(); return; }
  if (current && current.step.id === st.id) {
    /** @type {HTMLElement} */ (root).hidden = dialogOpen() && !st.overDialog;
    if (current.lang !== getLang()) { fill(current.step); current.lang = getLang(); }
    place(current.step);
    return;
  }
  hide();
  show({ id: st.id, key: 'tut.' + st.id, vars: st.vars, point: st.point, tut: true, next: !!st.next, overDialog: !!st.overDialog, mood: st.mood, anchor: st.anchor, when: () => true });
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
