// @ts-check
/**
 * The Yard Book: what carries over between runs.
 *
 * Every run starts from rock bottom: $4, eight plain X and no Tricks. What you keep is knowledge and access. A new
 * player can only find 12 simple Tricks in Squint's stall; the rest are locked behind milestones, each of which opens a
 * themed group ("block the rival and finish a line", "finish two lines with one X"...). So every run has something to
 * chase, the first runs are readable, and the shop grows with the player instead of burying them on day one.
 *
 * Progress lives under its own key, so it never touches a run in progress. Everything here is wrapped in try/catch:
 * with no storage the game simply plays with the starting Tricks.
 */
import { S } from './state.js';
import { JOKERS, PIECES, ITEMS, TILES, gate } from './data.js';

const KEY = 'lm-meta';

/** What every player can find from the start: simple Tricks (one idea each), three X pieces, the chalks and three squares. */
export const START_PIECES = ['red', 'blue', 'gold'], START_ITEMS = ['chalk_row', 'chalk_col', 'chalk_diag', 'chalk_draw', 'chalk_rainbow'], START_TILES = ['hot', 'rich', 'gild'];
/** The Tricks every player starts with: simple, readable, one idea each. */
export const START_TRICKS = ['jester', 'center', 'corner', 'edge', 'rowfan', 'colfan', 'plainjane', 'soreloser', 'taxman', 'scout', 'goldtooth', 'speedrun'];

/**
 * @typedef {{ id: string, name: {en:string,da:string}, goal: {en:string,da:string}, on: string, tricks: string[],
 *   test: (e: any) => boolean, pieces?: string[], items?: string[], tiles?: string[] }} Milestone
 * `on` is the event that can complete it: bout | line | ante | cash | won. `tricks` is what it unlocks; the last milestone
 * also takes every Trick no other one lists, so a new Trick is never unreachable.
 * @type {Milestone[]}
 */
export const MILESTONES = [
  { id: 'first', on: 'bout', name: { en: 'First Bet', da: 'Første væddemål' }, goal: { en: 'Win a bet', da: 'Vind et væddemål' },
    tricks: ['spite', 'crowded', 'landlord', 'cartographer'], pieces: ['lucky'], tiles: ['echo'], test: () => true },
  { id: 'bully', on: 'bout', name: { en: 'Bully Basher', da: 'Bøllebanker' }, goal: { en: 'Beat a bully', da: 'Slå en bølle' },
    tricks: ['pennant', 'jeweler', 'heldback', 'hoarder', 'toolbox'], items: ['hourglass', 'reshuffle'], test: e => !!e.boss },
  { id: 'block', on: 'line', name: { en: 'Two Birds', da: 'To fluer' }, goal: { en: 'Block the rival and finish a line with the same X', da: 'Bloker modstanderen og afslut en linje med samme X' },
    tricks: ['pincer', 'hermit', 'daredevil', 'guardian'], pieces: ['bomb', 'ghost'], tiles: ['trap', 'safe'], test: e => !!e.block },
  { id: 'double', on: 'line', name: { en: 'Double Trouble', da: 'Dobbelt op' }, goal: { en: 'Finish two lines with one X', da: 'Afslut to linjer med ét X' },
    tricks: ['fork', 'crossroads', 'checkmate', 'longshot'], pieces: ['twin', 'mirror'], items: ['eraser'], tiles: ['star'], test: e => !!e.double },
  { id: 'turf3', on: 'ante', name: { en: 'Moving Up', da: 'Rykket op' }, goal: { en: 'Reach turf 3', da: 'Nå revir 3' },
    tricks: ['diag', 'catsgame', 'bluemoon', 'bullseye', 'perimeter', 'sprawl'], pieces: ['glass', 'steel'], items: ['sprint'], test: e => e.ante >= 3 },
  { id: 'bigline', on: 'line', name: { en: 'Big Swagger', da: 'Stor swagger' }, goal: { en: 'Score 1,000 in a single line', da: 'Score 1.000 i én linje' },
    tricks: ['snowball', 'ironclad', 'echoj', 'curtain', 'gallery'], pieces: ['sprout', 'hunter'], items: ['amplifier'], test: e => e.total >= 1000 },
  { id: 'pencilcase', on: 'bout', name: { en: 'Pencil Case', da: 'Penalhus' }, goal: { en: 'Win a bet with 5 special X in your bag', da: 'Vind et væddemål med 5 specielle X i posen' },
    tricks: ['collector', 'variety', 'matching', 'rainbow', 'purist'], pieces: ['turncoat'], items: ['forge', 'safetynet'], test: e => e.special >= 5 },
  { id: 'chalkdust', on: 'bout', name: { en: 'Chalk Dust', da: 'Kridtstøv' }, goal: { en: 'Level a score type up to 3', da: 'Hæv en scoretype til niveau 3' },
    tricks: ['chalkboard', 'minimalist', 'showoff'], test: e => e.chalk >= 3 },
  { id: 'saver', on: 'cash', name: { en: 'Piggy Bank', da: 'Sparegris' }, goal: { en: 'Cash out holding $20 or more', da: 'Hæv med $20 eller mere på lommen' },
    tricks: ['piggy', 'banker', 'doubletap'], items: ['miser'], test: e => e.money >= 20 },
  { id: 'turf5', on: 'ante', name: { en: 'Top of the Yard', da: 'Skolegårdens top' }, goal: { en: 'Reach turf 5', da: 'Nå revir 5' },
    tricks: ['bigsky', 'demolition', 'ghosttown', 'redalert', 'twinpeaks', 'fourleaf', 'reflection', 'greenhouse', 'exorcist'], test: e => e.ante >= 5 },
  { id: 'legend', on: 'line', name: { en: 'Legend', da: 'Legende' }, goal: { en: 'Score 25,000 in a single line', da: 'Score 25.000 i én linje' },
    tricks: ['combo', 'momentum', 'banana', 'midas', 'glassjaw', 'grandstand'], pieces: ['cursed'], test: e => e.total >= 25000 },
  { id: 'king', on: 'won', name: { en: 'King of the Yard', da: 'Skolegårdens konge' }, goal: { en: 'Beat the Sixth-Grader on turf 8', da: 'Slå Sjetteklassen på revir 8' },
    tricks: [], test: () => true },
];
/** Everything that no earlier milestone lists belongs to the last one, so nothing is ever unreachable. */
{
  const last = MILESTONES[MILESTONES.length - 1];
  const rest = (/** @type {string[]} */ all, /** @type {string[]} */ start, /** @type {'tricks'|'pieces'|'items'|'tiles'} */ key) => {
    const listed = new Set(MILESTONES.flatMap(m => m[key] || []).concat(start));
    return all.filter(id => !listed.has(id));
  };
  last.tricks = rest(Object.keys(JOKERS), START_TRICKS, 'tricks');
  last.pieces = rest(Object.keys(PIECES).filter(k => k !== 'plain'), START_PIECES, 'pieces');
  last.items = rest(Object.keys(ITEMS), START_ITEMS, 'items');
  last.tiles = rest(Object.keys(TILES), START_TILES, 'tiles');
}
/** Everything one milestone unlocks, as a count. @param {Milestone} m */
export const rewardCount = m => m.tricks.length + (m.pieces || []).length + (m.items || []).length + (m.tiles || []).length;

/** @returns {{ done: Record<string, number> }} */
function load() {
  try { const v = localStorage.getItem(KEY); const d = v ? JSON.parse(v) : null; if (d && d.done) return d; } catch (e) { /* no storage */ }
  return { done: {} };
}
/** @param {{ done: Record<string, number> }} d */
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* no storage */ } }

/** Tests and simulations play with everything open. */
const everything = () => !!(/** @type {any} */ (globalThis).__lmUnlockAll);

export const isDone = (/** @type {string} */ id) => !!load().done[id];
/** Can this Trick turn up in a shop or pack right now? @param {string} id */
export function trickOpen(id) {
  if (everything() || START_TRICKS.includes(id)) return true;
  const d = load().done;
  return MILESTONES.some(m => d[m.id] && m.tricks.includes(id));
}
/** Can this X piece / tool / square upgrade turn up in a shop or pack? */
const openIn = (/** @type {'pieces'|'items'|'tiles'} */ key, /** @type {string[]} */ start) => (/** @type {string} */ id) => {
  if (everything() || start.includes(id)) return true;
  const d = load().done;
  return MILESTONES.some(m => d[m.id] && (m[key] || []).includes(id));
};
export const pieceOpen = openIn('pieces', START_PIECES), itemOpen = openIn('items', START_ITEMS), tileOpen = openIn('tiles', START_TILES);
/** How many Tricks are open, and how many exist. */
export function trickCount() { const all = Object.keys(JOKERS); return { open: all.filter(trickOpen).length, all: all.length }; }
/** Which milestone unlocks a given Trick (for the Yard Book). @param {string} id */
export const milestoneOf = id => MILESTONES.find(m => m.tricks.includes(id)) || null;

/**
 * Something happened in the game: complete any milestone it earns. Returns the ones just completed.
 * Nothing counts during the prologue. @param {string} on bout | line | ante | cash | won @param {any} [e]
 * @returns {Milestone[]}
 */
export function note(on, e = {}) {
  if (S.tut && S.tut.on) return [];
  const d = load(), got = [];
  for (const m of MILESTONES) {
    if (m.on !== on || d.done[m.id]) continue;
    let ok = false;
    try { ok = m.test(e); } catch (err) { ok = false; }
    if (ok) { d.done[m.id] = 1; got.push(m); }
  }
  if (got.length) save(d);
  return got;
}
gate.open = trickOpen;   // data.js asks this when a starting set picks a Trick
/** Wipe the Yard Book (tests only). */
export function reset() { try { localStorage.removeItem(KEY); } catch (e) { /* no storage */ } }
