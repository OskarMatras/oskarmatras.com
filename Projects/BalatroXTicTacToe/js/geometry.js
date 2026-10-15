// @ts-check
/**
 * Board geometry for an N×N grid where three in a row always wins.
 * Lines are every run of three cells horizontally, vertically or along
 * either diagonal, so a 4×4 board has 24 lines and a 5×5 board 48.
 * Results are cached per board size.
 */
import { S } from './state.js';

/** @typedef {{cells:number[], type:'row'|'col'|'diag'}} Line */

/** @type {Record<number, {N:number, lines:Line[], through:number[]}>} */
const cache = {};

export function geo() {
  const N = S.N;
  if (cache[N]) return cache[N];
  /** @type {Line[]} */
  const lines = [];
  /** @type {[number, number, 'row'|'col'|'diag'][]} */
  const dirs = [[0, 1, 'row'], [1, 0, 'col'], [1, 1, 'diag'], [1, -1, 'diag']];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc, type] of dirs) {
    const r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (r2 < 0 || r2 >= N || c2 < 0 || c2 >= N) continue;
    lines.push({ cells: [r * N + c, (r + dr) * N + c + dc, r2 * N + c2], type });
  }
  const through = Array(N * N).fill(0);
  lines.forEach(l => l.cells.forEach(i => through[i]++));
  return (cache[N] = { N, lines, through });
}

/** @param {number} i */
export const rc = i => [Math.floor(i / S.N), i % S.N];
/** @param {number} i */
export function isCorner(i) { const [r, c] = rc(i), m = S.N - 1; return (r === 0 || r === m) && (c === 0 || c === m); }
/** @param {number} i */
export function isEdge(i) { const [r, c] = rc(i), m = S.N - 1; return (r === 0 || r === m || c === 0 || c === m) && !isCorner(i); }
/** Odd boards have one center square, even boards the middle four. @param {number} i */
export function isCenter(i) {
  const [r, c] = rc(i), N = S.N;
  if (N % 2) return r === (N - 1) / 2 && c === (N - 1) / 2;
  return (r === N / 2 || r === N / 2 - 1) && (c === N / 2 || c === N / 2 - 1);
}
/** Square upgrades are keyed by "row,col" so they survive the board growing. @param {number} i */
export const squareOf = i => S.squares[rc(i).join(',')] || {};
/** @param {number} i */
export function neighbours(i) {
  const [r, c] = rc(i); const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const r2 = r + dr, c2 = c + dc;
    if ((dr || dc) && r2 >= 0 && c2 >= 0 && r2 < S.N && c2 < S.N) out.push(r2 * S.N + c2);
  }
  return out;
}
