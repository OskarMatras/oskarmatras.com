// The Yard Book: what a new player can find, and how the milestones open the rest.
import { S, SET, E, D, R, seed } from './bot.mjs';
const G = new URL('../js/', import.meta.url).href;
const M = await import(G + 'meta.js');
const A = E.actions;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const tick = () => new Promise(r => setTimeout(r, 0));
async function settle() { for (let i = 0; i < 3000 && S.busy; i++) await tick(); await tick(); }
const X = () => ({ t: 'X', p: { uid: -Math.floor(Math.random() * 1e6) - 10, type: 'plain' } });

globalThis.__lmUnlockAll = false; M.reset(); R.freshRun();

// structure: every Trick is either a starter or belongs to exactly one milestone
{
  const owner = {};
  for (const m of M.MILESTONES) for (const id of m.tricks) { owner[id] = (owner[id] || 0) + 1; ok(id in D.JOKERS, `milestone ${m.id} lists a Trick that exists: ${id}`); }
  for (const [key, all, start, label] of [['pieces', Object.keys(D.PIECES).filter(k => k !== 'plain'), M.START_PIECES, 'X piece'], ['items', Object.keys(D.ITEMS), M.START_ITEMS, 'item'], ['tiles', Object.keys(D.TILES), M.START_TILES, 'square']]) {
    const own = {}; for (const m of M.MILESTONES) for (const id of (m[key] || [])) own[id] = (own[id] || 0) + 1;
    ok(all.every(id => start.includes(id) || own[id] === 1), `every ${label} is a starter or in exactly one milestone`);
  }
  for (const id of M.START_TRICKS) ok(id in D.JOKERS && !owner[id], `starter ${id} exists and is in no milestone`);
  const missing = Object.keys(D.JOKERS).filter(id => !owner[id] && !M.START_TRICKS.includes(id));
  ok(missing.length === 0, 'every Trick can be unlocked: ' + missing.join());
  ok(Object.values(owner).every(n => n === 1), 'no Trick is in two milestones');
}
// a new player: only the starters
{
  const c = M.trickCount();
  ok(c.open === M.START_TRICKS.length && c.all === Object.keys(D.JOKERS).length, `a new player has ${c.open}/${c.all} Tricks open`);
  seed(8); let bad = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    M.reset(); R.freshRun(); S.ante = 4;
    S.phase = 'play'; S.blindIdx = 0; S.round = { score: 0, target: 1, games: 1, discards: 0, gameNo: 1, reward: 0, name: 'x' };
    S.g = { scored: [], placements: 0, aiMoves: 0, lines: 0, pile: [] }; S.board = [X(), X(), null, null, null, null, null, null, null]; S.hand = [{ uid: 990, type: 'plain' }]; S.selIdx = 0;
    A.cell('2'); await settle();
    for (const it of (S.shop ? S.shop.items : [])) if (it.kind === 'joker') { n++; if (!M.trickOpen(it.id)) bad++; }
    for (const it of (S.shop ? S.shop.items : [])) { if (it.kind === 'piece' && !M.pieceOpen(it.id)) bad++; if (it.kind === 'item' && !M.itemOpen(it.id)) bad++; if (it.kind === 'tile' && !M.tileOpen(it.id)) bad++; }
  }
  ok(n > 100 && bad === 0, `shops only sell starter Tricks to a new player (${n} Tricks seen, ${bad} locked ones)`);
}
// milestones
{
  M.reset(); R.freshRun();
  ok(M.note('bout', { boss: false, special: 0, chalk: 1 }).map(m => m.id).join() === 'first', 'winning a bet completes First Bet');
  ok(M.note('bout', { boss: false }).length === 0, 'and only once');
  ok(M.trickOpen('spite') && !M.trickOpen('fork'), 'its Tricks open, the others stay locked');
  ok(M.note('bout', { boss: true, special: 6, chalk: 3 }).map(m => m.id).sort().join() === 'bully,chalkdust,pencilcase', 'a bully win with 6 special X and chalk level 3 completes three milestones');
  ok(M.note('line', { total: 90, block: true, double: false }).map(m => m.id).join() === 'block', 'a block that finishes a line');
  ok(M.note('line', { total: 240, block: false, double: true }).map(m => m.id).join() === 'double', 'a double');
  ok(M.note('line', { total: 1500, block: false, double: false }).map(m => m.id).join() === 'bigline', 'a 1,500 line');
  ok(M.note('line', { total: 30000 }).map(m => m.id).join() === 'legend', 'a 30,000 line');
  ok(M.note('ante', { ante: 3 }).map(m => m.id).join() === 'turf3' && M.note('ante', { ante: 5 }).map(m => m.id).join() === 'turf5', 'turf 3 and turf 5');
  ok(M.note('cash', { money: 25 }).map(m => m.id).join() === 'saver', 'cashing out with $25');
  ok(M.note('won').map(m => m.id).join() === 'king', 'beating the Sixth-Grader');
  ok(M.trickCount().open === M.trickCount().all, 'everything is open at the end (' + M.trickCount().open + '/' + M.trickCount().all + ')');
  // the prologue counts for nothing
  M.reset(); R.freshRun(); S.tut = { on: true };
  ok(M.note('bout', { boss: true }).length === 0, 'nothing counts in the prologue');
  S.tut = null;
}
// through the real game: a bout win unlocks and announces
{
  M.reset(); seed(6); R.freshRun(); S.phase = 'play'; S.blindIdx = 0; S.round = { score: 0, target: 1, games: 1, discards: 0, gameNo: 1, reward: 0, name: 'x' };
  S.g = { scored: [], placements: 0, aiMoves: 0, lines: 0, pile: [] }; S.board = [X(), X(), null, null, null, null, null, null, null]; S.hand = [{ uid: 990, type: 'plain' }]; S.selIdx = 0;
  A.cell('2'); await settle();
  ok(M.isDone('first') && (S.unlocked || []).includes('first'), 'a won bout unlocks First Bet and remembers it for the end-of-run sheet');
}
// the Class Clown deck never starts with a locked Trick
{
  M.reset(); let bad = 0;
  for (let i = 0; i < 100; i++) { seed(i); R.freshRun('joker'); if (!M.START_TRICKS.includes(S.jokers[0].id)) bad++; }
  ok(bad === 0, 'the Class Clown deck starts with an open Trick');
}
globalThis.__lmUnlockAll = true; M.reset();
console.log(`meta: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
