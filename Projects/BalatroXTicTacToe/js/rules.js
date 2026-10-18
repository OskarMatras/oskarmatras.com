// @ts-check
/**
 * Pure rule helpers shared by the engine and the interface: starting a
 * run, blind targets, score-type values, board queries. Nothing here
 * touches the DOM or waits on animation.
 */
import { S, nid } from './state.js';
import { geo } from './geometry.js';
import { BOSSES, ANTE_BASE, LINE_TYPES, hasJ } from './data.js';
import { t, tr } from './strings.js';

/** @template T @param {T[]} a @returns {T} */
export const rand = a => a[Math.floor(Math.random() * a.length)];
/** @template T @param {T[]} a @returns {T[]} */
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** @param {string} type */
export const newPiece = type => ({ uid: nid(), type });

function pickBoss() {
  const used = S.usedBosses || [];
  const pool = Object.keys(BOSSES).filter(b => !used.includes(b));
  return { id: rand(pool.length ? pool : Object.keys(BOSSES)) };
}
export function nextBoss() { S.boss = pickBoss(); S.usedBosses.push(S.boss.id); }

export function freshRun() {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, {
    phase: 'blind', ante: 1, blindIdx: 0, money: 4, N: 3,
    bag: Array.from({ length: 8 }, () => newPiece('plain')), hand: [], selIdx: 0, squares: {},
    jokers: [], items: [], levels: { row: 1, col: 1, diag: 1, draw: 1 }, played: { row: 0, col: 0, diag: 0, draw: 0 },
    vouchers: [], maxGames: 4, maxDiscards: 3, handSize: 3, jokerSlots: 5, itemSlots: 2,
    usedBosses: [], boss: null, round: null, board: Array(9).fill(null), g: null, shop: null,
    mode: null, pending: null, anteVoucher: null, growAnim: null,
    stats: { bestLine: 0, bestType: '', lines: 0, wins: 0 }, endless: false, busy: false, cashout: null,
  });
  nextBoss();
}

/** Target, reward and label for blind 0 (small), 1 (big) or 2 (boss) of the current ante. @param {number} idx */
export function blindInfo(idx) {
  const a = S.ante;
  const base = a <= 8 ? ANTE_BASE[a - 1] : Math.round(50000 * Math.pow(2, a - 8) / 100) * 100;
  if (idx === 2) {
    const b = BOSSES[S.boss.id];
    const m = S.boss.id === 'needle' ? 1.5 : 2;
    return { name: tr(b.name), target: Math.round(base * m), reward: 5, color: b.color, desc: tr(b.desc), boss: true };
  }
  return idx === 0
    ? { name: t('blind.small'), target: base, reward: 3, color: '#2f6f9f', desc: t('blind.smallDesc'), boss: false }
    : { name: t('blind.big'), target: Math.round(base * 1.5), reward: 4, color: '#b8862a', desc: t('blind.bigDesc'), boss: false };
}

/** Base chips and mult of a score type at its current level. @param {string} type */
export function lineValues(type) {
  const h = /** @type {any} */ (LINE_TYPES)[type], l = S.levels[type];
  return { chips: h.c + h.dc * (l - 1), mult: h.m + h.dm * (l - 1) };
}

export const handMax = () => S.handSize + (hasJ('scout') ? 1 : 0);
/** Boss effects only apply while the boss blind is being played. @param {string} id */
export const isBoss = id => S.phase === 'play' && S.blindIdx === 2 && S.boss && S.boss.id === id;

/* ---- board queries ---- */
export const emptyCells = () => S.board.map((/** @type {any} */ c, /** @type {number} */ i) => (c ? -1 : i)).filter((/** @type {number} */ i) => i >= 0);
const allLines = () => geo().lines.map((l, li) => li);
/** @param {number} li */
const cellsOf = li => geo().lines[li].cells.map(i => S.board[i]);
export const oWon = () => geo().lines.some(l => l.cells.every(i => S.board[i] && S.board[i].t === 'O'));
/** Lines that just became three X's and have not scored yet. */
export const newXLines = () => allLines().filter(li => !S.g.scored.includes(li) && cellsOf(li).every(c => c && c.t === 'X'));
/** Lines X could still complete. */
export const viableLines = () => allLines().filter(li => !S.g.scored.includes(li) && cellsOf(li).every(c => !c || c.t === 'X'));
/** Lines one X away from scoring. */
export const threats = () => allLines().filter(li => {
  if (S.g.scored.includes(li)) return false;
  const cs = cellsOf(li);
  return cs.filter(c => c && c.t === 'X').length === 2 && cs.filter(c => !c).length === 1;
});
