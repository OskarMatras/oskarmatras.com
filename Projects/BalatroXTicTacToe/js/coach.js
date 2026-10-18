// @ts-check
/**
 * Tips: the tutorial. It never stops the game and never lectures; it waits until the
 * player reaches something and then says one short, friendly thing about it.
 *
 *  - One tip at a time, in the order a new player meets things. A tip is only shown
 *    when its moment arrives (the first blind, the first shop, the first Joker...), so
 *    nothing is explained before it matters.
 *  - Each tip highlights what it is about and sits in a small bubble at the top or
 *    bottom of the screen, whichever is further from that thing.
 *  - Click the bubble to dismiss it, or just play on: it leaves by itself when the
 *    moment passes (you placed the X, you left the shop) or after a few seconds.
 *  - What has been shown is remembered per device, so every tip appears once. "Skip
 *    tips" turns them all off; Run info can turn them back on or replay them.
 *
 * The state of the game decides what to show (sync() runs after every render), so the
 * engine does not have to know the tutorial exists.
 */
import { S, SET, saveSettings } from './state.js';
import { t } from './strings.js';

/** @typedef {{ id: string, anchor: string, when: () => boolean, keep?: () => boolean, ttl?: number, vars?: () => Record<string, any> }} Step */

const inPlay = () => S.phase === 'play' && !!S.round && !S.busy;
const hasX = () => Array.isArray(S.board) && S.board.some((/** @type {any} */ c) => c && c.t === 'X');
const inShop = () => S.phase === 'shop' && !S.pack && !S.mode;
const bigVoucher = () => !!S.shop && !S.shop.vSold && (S.shop.voucher === 'board4' || S.shop.voucher === 'board5');
const seen = (/** @type {string} */ id) => !!(SET.seen && SET.seen[id]);

/** In the order a new player meets them. */
/** @type {Step[]} */
const STEPS = [
  { id: 'welcome', anchor: '.bcard.cur', when: () => S.phase === 'blind' && S.ante === 1 && S.blindIdx === 0 && S.stats.lines === 0 },
  { id: 'place', anchor: '#bw', when: () => inPlay() && !hasX() },
  // Once an X is down the "place" tip is moot, so the hand tip follows whether or not it was ever shown.
  { id: 'hand', anchor: '#hand', ttl: 12000, when: () => inPlay() && hasX() && S.stats.lines === 0 && S.hand.length > 0 },
  { id: 'score', anchor: '.calc', ttl: 10000, when: () => inPlay() && S.stats.lines >= 1 },
  { id: 'games', anchor: '.stat.games', ttl: 10000, when: () => inPlay() && S.round.games < S.maxGames },
  { id: 'boss', anchor: '.blindTag', ttl: 12000, when: () => inPlay() && S.blindIdx === 2 },
  { id: 'shop', anchor: '.shopCats', ttl: 18000, when: () => inShop() },
  { id: 'money', anchor: '#money', ttl: 11000, when: () => inShop() && seen('shop') },
  { id: 'joker', anchor: '.tray.jokers', ttl: 12000, when: () => S.jokers.length >= 1 && ['blind', 'play', 'shop'].includes(S.phase) && !S.busy },
  // Growing the board is the biggest decision in the game, so it gets three tips: when the
  // voucher is on offer, a heads-up before it is, and a cheer once it has happened.
  { id: 'boardOffer', anchor: '.shopCat.voucher', ttl: 18000, when: () => inShop() && bigVoucher(), keep: () => S.phase === 'shop' && bigVoucher() },
  { id: 'boardHint', anchor: '.shopCat.voucher', ttl: 14000, when: () => inShop() && S.ante >= 2 && S.N === 3 && !bigVoucher() },
  { id: 'boardGrew', anchor: '.shopCat.voucher', ttl: 12000, vars: () => ({ n: S.N }), when: () => S.N > 3 && ['blind', 'play', 'shop'].includes(S.phase) && !S.busy },
  { id: 'pack', anchor: '.packScene .shopGrid', ttl: 14000, when: () => S.phase === 'shop' && !!S.pack },
];

/** Basics a returning player already knows, so a saved run in progress does not re-teach them. */
const BASICS = ['welcome', 'place', 'hand', 'score', 'games', 'shop', 'money', 'joker'];

/** @type {{ step: Step, timer: any }|null} */
let current = null;
let quietUntil = 0, quietTimer = /** @type {any} */ (null);
/** @type {HTMLElement|null} */
let bubble = null;

function ensureBubble() {
  if (bubble) return bubble;
  bubble = document.createElement('div');
  bubble.id = 'coach'; bubble.setAttribute('role', 'status'); bubble.hidden = true;
  bubble.addEventListener('click', e => {
    const skip = /** @type {HTMLElement} */ (e.target).closest('[data-coach="skip"]');
    if (skip) { SET.tips = false; saveSettings(); hide(); return; }
    finish();
  });
  document.body.appendChild(bubble);
  addEventListener('keydown', e => { if (e.key === 'Escape' && current) finish(); });
  return bubble;
}

function clearHighlight() { document.querySelectorAll('.coach-hl').forEach(n => n.classList.remove('coach-hl')); }

/** Highlight the thing the tip is about and park the bubble on whichever side is clear of it. @param {Step} step */
function place(step) {
  const b = ensureBubble();
  clearHighlight();
  const target = /** @type {HTMLElement|null} */ (document.querySelector(step.anchor));
  if (target) target.classList.add('coach-hl');
  const r = target ? target.getBoundingClientRect() : null;
  const low = r ? (r.top + r.bottom) / 2 > innerHeight * 0.55 : false;
  b.classList.toggle('top', low);
  b.classList.toggle('bottom', !low);
}

/** @param {Step} step */
function show(step) {
  const b = ensureBubble();
  b.innerHTML = `<p>${t('coach.' + step.id, step.vars ? step.vars() : undefined)}</p>
    <div class="cFoot"><span>${t('coach.tap')}</span><button type="button" class="cSkip" data-coach="skip">${t('coach.skip')}</button></div>`;
  b.hidden = false;
  place(step);
  current = { step, timer: step.ttl ? setTimeout(finish, step.ttl) : null };
}

function hide() {
  if (current && current.timer) clearTimeout(current.timer);
  current = null; clearHighlight();
  if (bubble) bubble.hidden = true;
}

/** The tip has done its job (or its moment passed): remember it, and leave a beat before the next. */
function finish() {
  if (!current) return;
  SET.seen = SET.seen || {}; SET.seen[current.step.id] = 1; saveSettings();
  hide();
  quietUntil = Date.now() + 1400;
  clearTimeout(quietTimer); quietTimer = setTimeout(sync, 1450);
}

/** Look at the game and show, move or retire a tip. Called after every render. */
export function sync() {
  if (!SET.tips) { if (current) hide(); return; }
  SET.seen = SET.seen || {};
  if (!SET.baselined && S.phase !== 'title' && S.phase !== 'over') {
    SET.baselined = true;
    if (S.ante > 1 || S.stats.lines > 0 || S.jokers.length > 0) BASICS.forEach(id => { SET.seen[id] = 1; });
    saveSettings();
  }
  if (current) {
    const keep = current.step.keep || current.step.when;
    if (!keep()) finish(); else place(current.step);   // re-find it: a render replaces the elements
    return;
  }
  if (Date.now() < quietUntil || document.getElementById('overlay') && !/** @type {HTMLElement} */ (document.getElementById('overlay')).hidden) return;
  const next = STEPS.find(s => !seen(s.id) && s.when());
  if (next) show(next);
}

/** Show every tip again, from the start. */
export function replay() { hide(); SET.seen = {}; SET.baselined = true; SET.tips = true; saveSettings(); sync(); }
