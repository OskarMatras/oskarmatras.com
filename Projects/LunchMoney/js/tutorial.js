// @ts-check
/**
 * The prologue tutorial: a short scripted run against Pip.
 *
 * Three bouts on the first turf. The first two are easy and teach the game (Pip plays gently, the shop is stocked
 * with exactly what the lesson needs); the third is the Sixth-Grader, who arrives and counters the very build the
 * lessons set up. Between them are story scenes (story.js). All of it is saved in `S.tut`, so a reload lands back
 * in the same spot.
 *
 * This module is state only (no page): the rules of the tutorial live here, the speech bubble that reads them is
 * in coach.js, and the engine asks `allows()` before it lets a guided action through.
 *
 *   S.tut = { on, guided, bout (1..3), done: { stepId: 1 }, built: { jester, red } }
 *   S.scene = { queue: ['intro'], after: 'bout1' }   the story scenes still to play, and what happens after them
 */
import { S } from './state.js';
import { winCells } from './rules.js';
import { LINE_TYPES } from './data.js';
import { tr, fmt } from './strings.js';

/** Basics a player who has done the prologue already knows, so the light tips do not teach them again. */
export const BASICS = ['welcome', 'place', 'hand', 'danger', 'score', 'games', 'shop', 'money', 'joker'];

const T = () => S.tut || null;
export const tutOn = () => !!(S.tut && S.tut.on);
const bout = () => (S.tut ? S.tut.bout : 0);
const inPlay = () => S.phase === 'play' && !!S.round && !S.busy;
const hasX = () => S.board.some((/** @type {any} */ c) => c && c.t === 'X');
const hasO = () => S.board.some((/** @type {any} */ c) => c && c.t === 'O');
const inShop = () => S.phase === 'shop' && !S.pack && !S.mode;
const packSold = (/** @type {number} */ i) => !!(S.shop && S.shop.packs && S.shop.packs[i] && S.shop.packs[i].sold);

/** What the last line was and what it scored, for the cash-out lesson. */
function lineVars() {
  const k = S.stats && S.stats.bestType, L = k && /** @type {any} */ (LINE_TYPES)[k];
  return { s: fmt((S.round && S.round.score) || 0), type: L ? tr(L.name).toLowerCase() : '' };
}

/** Where the run is, as one number the steps can be ordered by: bout * 10 + (play 1, cash-out 2, shop 3). */
export function stage() {
  if (!tutOn()) return 0;
  const k = S.phase === 'play' ? 1 : S.phase === 'cashout' ? 2 : S.phase === 'shop' ? 3 : 0;
  return bout() * 10 + k;
}

/**
 * @typedef {{ id: string, at: number, mood: string, anchor: string, when: () => boolean, done?: () => boolean,
 *   next?: boolean, optional?: boolean, overDialog?: boolean, vars?: () => Record<string, any>, point?: string }} TutStep
 * `point` is what Pip walks over to and points at (one or more elements, visited in turn); it defaults to `anchor`.
 * `at` is the stage the step belongs to: once the run is past it, the step is dropped. `next` steps wait for the
 * Next button; the others finish by themselves when `done()` says so.
 * @type {TutStep[]}
 */
export const STEPS = [
  // Bout 1: the basics, against Pip.
  { id: 'place', at: 11, mood: 'happy', anchor: '#bw', point: '[data-cell="4"]', when: () => inPlay() && !hasX(), done: () => hasX() },
  { id: 'answer', at: 11, mood: 'grin', anchor: '#bw', point: '#board .cell.o', when: () => inPlay() && hasO(), next: true },
  { id: 'hand', at: 11, mood: 'happy', anchor: '#hand', point: '#hand .hp', when: () => inPlay() && S.hand.length > 0, next: true },
  { id: 'toss', at: 11, mood: 'grin', anchor: '[data-act="discard"]', when: () => inPlay() && S.hand.length > 0, next: true },
  { id: 'danger', at: 11, mood: 'shock', anchor: '#bw', point: '#board .cell.danger', optional: true, when: () => inPlay() && winCells('O').size > 0, next: true },
  { id: 'line', at: 11, mood: 'happy', anchor: '#bw', point: '[data-cell="0"],[data-cell="1"],[data-cell="2"]', when: () => inPlay(), done: () => S.stats.lines >= 1 || S.phase !== 'play' },
  { id: 'cash1', at: 12, mood: 'cheer', anchor: '.modal', point: '.modal .rr, .modal [data-act="cashOut"]', overDialog: true, when: () => S.phase === 'cashout', next: true, vars: lineVars },
  // The shop, stocked on purpose.
  { id: 'shop_in', at: 13, mood: 'happy', anchor: '.shopCats', point: '.shopCat', when: () => inShop(), next: true },
  { id: 'buy_trick', at: 13, mood: 'happy', anchor: '.sitem[data-arg="i0"]', optional: true, when: () => inShop() && !S.jokers.some((/** @type {any} */ j) => j.id === 'jester'), done: () => S.jokers.length >= 1 },
  { id: 'trick_tray', at: 13, mood: 'grin', anchor: '.tray.jokers', point: '.tray.jokers .joker', optional: true, when: () => inShop() && S.jokers.length >= 1, next: true },
  { id: 'buy_pack', at: 13, mood: 'wink', anchor: '.sitem.pack[data-arg="p0"]', optional: true, when: () => inShop() && !packSold(0) && S.money >= 4, done: () => packSold(0) },
  { id: 'pack_pick', at: 13, mood: 'happy', anchor: '.packScene .shopGrid', point: '.packScene .sitem', optional: true, when: () => S.phase === 'shop' && !!S.pack, done: () => !S.pack },
  { id: 'go_on', at: 13, mood: 'cheer', anchor: '[data-act="nextRound"]', when: () => inShop(), done: () => S.phase !== 'shop' },
  // Bout 2: the build in action.
  { id: 'b2_start', at: 21, mood: 'grin', anchor: '.tray.jokers', point: '.tray.jokers .joker', when: () => inPlay(), next: true },
  { id: 'b2_red', at: 21, mood: 'happy', anchor: '#hand', point: '#hand .hp:has(.t-red)', optional: true, when: () => inPlay() && S.hand.some((/** @type {any} */ p) => p.type === 'red'), next: true },
  { id: 'b2_line', at: 21, mood: 'cheer', anchor: '#bw', point: '.tray.jokers .joker, .calc', when: () => inPlay(), done: () => S.stats.lines >= 2 || S.phase !== 'play' },
  { id: 'cash2', at: 22, mood: 'cheer', anchor: '.modal', point: '.modal .rr', overDialog: true, when: () => S.phase === 'cashout', next: true },
  // Bout 3: the Sixth-Grader.
  { id: 'amb', at: 31, mood: 'shock', anchor: '.tray.jokers', point: '.tray.jokers .joker, #board .cell.o', when: () => inPlay(), next: true },
  { id: 'amb2', at: 31, mood: 'worry', anchor: '#bw', point: '#board .cell.o', optional: true, when: () => inPlay() && S.round.gameNo >= 2, next: true },
];

/** The step to show now, or null. Steps the run has moved past, or that finished on their own, are retired as they are found. @returns {TutStep|null} */
export function current() {
  const tu = T(); if (!tu || !tu.on) return null;
  tu.done = tu.done || {};
  const now = stage();
  for (const st of STEPS) {
    if (tu.done[st.id]) continue;
    if (now > st.at) { tu.done[st.id] = 1; continue; }
    if (now < st.at) return null;
    if (st.done && st.done()) { tu.done[st.id] = 1; continue; }
    if (!st.when()) { if (st.optional) continue; return null; }
    return st;
  }
  return null;
}
/** The Next button (or the step's own condition) retires a step. @param {string} id */
export function ack(id) { const tu = T(); if (tu) { tu.done = tu.done || {}; tu.done[id] = 1; } }

/**
 * May a guided action go through right now? Only the very first X is guided (it goes in the middle). The shop is
 * free: Pip explains it, and then the player buys what they like (see nextRound in engine.js for the gifts).
 * @param {string} action @param {string} [arg]
 */
export function allows(action, arg = '') {
  const tu = T();
  if (!tu || !tu.on || tu.guided === false) return true;
  if (S.phase === 'play' && bout() === 1 && S.round && S.round.gameNo === 1 && action === 'cell' && !hasX() && S.hand.length) return arg === '4';
  return true;
}
