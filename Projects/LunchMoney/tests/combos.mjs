// Combos (block bonus, doubles), the shop that grows with the turfs, and the board growing on turf 2.
import { S, SET, E, D, R, GEO, seed } from './bot.mjs';
const A = E.actions;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const tick = () => new Promise(r => setTimeout(r, 0));
async function settle() { for (let i = 0; i < 3000 && S.busy; i++) await tick(); await tick(); }
const totals = []; globalThis.__rec = (k, a) => { if (k === 'total') totals.push(a); };
const X = (uid = -Math.floor(Math.random() * 1e6) - 10, type = 'plain') => ({ t: 'X', p: { uid, type } }), O = () => ({ t: 'O' });

async function game(N, board, cell, opts = {}) {
  seed(4); R.freshRun(); if (N !== 3) { S.N = N; S.board = Array(N * N).fill(null); }
  S.jokers = opts.jokers || []; S.phase = 'blind'; S.blindIdx = 0; A.startBlind(); await settle();
  S.board = board; S.hand = [{ uid: 990, type: 'plain' }, { uid: 991, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
  totals.length = 0; A.cell(String(cell)); await settle();
  return totals.slice();
}

// one line, nothing special: the reference value
{
  const t = await game(3, [X(), X(), null, null, null, null, null, null, null], 2);
  ok(t.length === 1 && t[0] === 60, 'a plain row is worth 60 (15+15 Marbles x 2 Swagger), got ' + t);
}
// a block that finishes the line: column 2 is X, X and the rival threatens the top row at the same square
{
  const b = [O(), O(), null, null, null, X(), null, null, X()];
  const t = await game(3, b, 2);
  ok(t.length === 1 && t[0] === 90, 'blocking and finishing a line gives x1.5 Swagger (90), got ' + t);
}
// a block that does not finish a line gives nothing extra
{
  const b = [O(), O(), null, null, null, null, null, null, null];
  const t = await game(3, b, 2);
  ok(t.length === 0, 'a block alone scores nothing');
}
// a double on a 4x4 board: X X _ X, and the X in the gap finishes two lines at once
{
  const b = Array(16).fill(null); b[0] = X(); b[1] = X(); b[3] = X();
  const t = await game(4, b, 2);
  ok(t.length === 2 && t[0] === 120 && t[1] === 120, 'a double scores each line with x2 Swagger (120 + 120), got ' + t);
}
// the board points them out
{
  R.freshRun(); S.N = 4; S.board = Array(16).fill(null); S.board[0] = X(); S.board[1] = X(); S.board[3] = X();
  S.g = { scored: [], placements: 0, aiMoves: 0, lines: 0 };
  const cc = R.completeCounts();
  ok(cc.get(2) === 2, 'the board knows the gap finishes two lines (got ' + cc.get(2) + ')');
}

// the shop grows with the turfs
{
  R.freshRun(); S.ante = 1;
  ok(R.pieceIds().join() === 'red,blue,gold' && R.tileIds().length === 0 && R.itemIds().length === 0 && R.jokerRarities().join() === '1', 'turf 1: only the basics');
  ok(R.packTypes().join() === 'joker,piece', 'turf 1 packs: Trick Bag and Pencil Pack');
  S.ante = 2; ok(R.itemIds().every(i => D.ITEMS[i].kind === 'chalk') && R.itemIds().length > 0 && R.jokerRarities().join() === '1,2', 'turf 2: chalk and Sneaky Tricks');
  S.ante = 3; ok(R.tileIds().length === 4 && R.itemIds().some(i => D.ITEMS[i].kind === 'tool') && R.pieceIds().includes('glass'), 'turf 3: squares, tools and more X');
  S.ante = 4; ok(R.jokerRarities().join() === '1,2,3' && R.pieceIds().length === 14 && R.packTypes().includes('forge'), 'turf 4: everything');
  // two thousand turf-1 shops never show anything locked
  seed(9); R.freshRun(); let bad = 0, shops = 0;
  for (let i = 0; i < 400; i++) {
    R.freshRun(); S.ante = 1; S.phase = 'blind'; S.round = { score: 0, target: 1, games: 1, discards: 0, gameNo: 1, reward: 0, name: 'x' };
    S.board = Array(9).fill(null); S.g = { scored: [], placements: 0, aiMoves: 0, lines: 0 };
    // the shop is made when a blind is won; drive it through a won first bout
    S.phase = 'play'; S.blindIdx = 0; S.board = [X(), X(), null, null, null, null, null, null, null]; S.hand = [{ uid: 990, type: 'plain' }]; S.selIdx = 0; S.round.target = 1;
    A.cell('2'); await settle();
    const sh = S.shop; if (!sh) continue; shops++;
    for (const it of sh.items) {
      if (it.kind === 'tile' || it.kind === 'item') bad++;
      if (it.kind === 'piece' && !R.pieceIds().includes(it.id)) bad++;
      if (it.kind === 'joker' && (D.JOKERS[it.id].rar !== 1 || it.ed)) bad++;
    }
    for (const pk of sh.packs) if (!['joker', 'piece'].includes(pk.type)) bad++;
  }
  ok(shops > 300 && bad === 0, `turf-1 shops (${shops}) only stock what is unlocked (${bad} problems)`);
}

// the board grows on turf 2
{
  seed(2); R.freshRun(); S.phase = 'play'; S.ante = 1; S.blindIdx = 2; S.boss = { id: 'wall' };
  S.round = { score: 0, target: 1, games: 1, discards: 0, gameNo: 1, reward: 0, name: 'x' };
  S.g = { scored: [], placements: 0, aiMoves: 0, lines: 0, pile: [] }; S.board = [X(), X(), null, null, null, null, null, null, null]; S.hand = [{ uid: 990, type: 'plain' }]; S.selIdx = 0;
  A.cell('2'); await settle();
  ok(S.ante === 2 && S.N === 4, 'beating the turf 1 boss opens turf 2 on a 4x4 board (ante ' + S.ante + ', N ' + S.N + ')');
}

console.log(`combos: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
