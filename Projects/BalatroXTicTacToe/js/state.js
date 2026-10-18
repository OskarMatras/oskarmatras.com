// @ts-check
/**
 * The whole run is one plain JSON object, `S`. Nothing in it holds a
 * function or a DOM node, so saving is JSON.stringify and loading is
 * Object.assign. Modules import `S` and mutate it in place; the binding
 * never changes, only its contents.
 *
 * Storage can be missing or throw (private mode, blocked site data,
 * iOS storage pressure), so every access is wrapped and the game runs
 * the same without it.
 */

/** @type {any} */
export const S = {};

/** Per-device preferences, separate from the run. */
export const SET = { speed: 1, sound: true, crt: true };

const KEY_RUN = 'bxt-run-v3';
const KEY_SET = 'bxt-settings';
const KEY_BEST = 'bxt-best';

let uid = 1;
export const nid = () => uid++;

function read(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
}

export function loadSettings() { const s = read(KEY_SET); if (s) Object.assign(SET, s); }
export function saveSettings() { write(KEY_SET, SET); }

/** Saved only at settled moments (never mid-animation), so a restore always lands in a consistent state. */
export function saveRun() {
  if (S.busy || !S.phase || S.phase === 'title' || S.phase === 'over') return;
  write(KEY_RUN, { v: 3, S, uid });
}
export function clearRun() { try { localStorage.removeItem(KEY_RUN); } catch (e) { /* ignore */ } }
export function hasSavedRun() { const d = read(KEY_RUN); return !!(d && d.v === 3 && d.S && d.S.bag); }
export function loadRun() {
  const d = read(KEY_RUN);
  if (!d || d.v !== 3 || !d.S || !d.S.bag) return false;
  replaceState(d.S, d.uid);
  return true;
}
/** @param {any} data @param {number} [nextUid] */
export function replaceState(data, nextUid) {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, data);
  if (nextUid) uid = nextUid;
  S.busy = false; S.mode = null; S.pending = null;
}
export function snapshot() { return { S: JSON.parse(JSON.stringify(S)), uid }; }

export function best() { return read(KEY_BEST) || { ante: 0, score: 0 }; }
export function saveBest() {
  const b = best();
  b.ante = Math.max(b.ante || 0, S.ante || 0);
  b.score = Math.max(b.score || 0, (S.stats && S.stats.bestLine) || 0);
  write(KEY_BEST, b);
}
