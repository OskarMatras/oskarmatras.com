// Analytic power index: for each Joker, how much does it multiply a typical line's score on random plausible boards?
import { S, D, R, GEO, seed } from './bot.mjs';
const types = Object.keys(D.PIECES), specials = D.SPECIALS;
const rows = [];
const apply = (acc, e) => { if (!e) return; if (e.chips) acc.c += e.chips; if (e.mult) acc.m += e.mult; if (e.xmult) acc.m *= e.xmult; if (e.money) acc.$ += e.money; };
function trial(id, N, rep) {
  seed(rep * 13 + N * 5 + 1); R.freshRun(); S.N = N; S.phase = 'play'; S.blindIdx = 0;
  const ante = N === 3 ? 2 : 5; S.ante = ante;
  S.round = { score: 0, target: 1000, games: 4, discards: 2, gameNo: 1, reward: 3 };
  // a mid-run bag: 12 pieces, a third special
  S.bag = Array.from({ length: 12 }, (_, i) => ({ uid: i + 1, type: Math.random() < .35 ? specials[Math.floor(Math.random() * specials.length)] : 'plain' }));
  S.money = 10 + Math.floor(Math.random() * 20); S.items = Math.random() < .5 ? [{ uid: 99, id: 'eraser' }] : [];
  S.levels = { row: 2, col: 2, diag: 2, draw: 1 };
  S.board = Array(N * N).fill(null).map(() => { const r = Math.random(); return r < .35 ? { t: 'X', p: { uid: 100, type: types[Math.floor(Math.random() * types.length)] } } : r < .6 ? { t: 'O' } : null; });
  S.g = { scored: [], placements: 3 + Math.floor(Math.random() * 3), aiMoves: 3, lines: N === 3 ? 0 : Math.floor(Math.random() * 3), haste: false, pile: [] };
  S.hand = Array.from({ length: Math.floor(Math.random() * 3) }, () => ({ uid: 1, type: 'plain' }));
  const L = GEO.geo().lines, l = L[Math.floor(Math.random() * L.length)];
  for (const i of l.cells) S.board[i] = { t: 'X', p: { uid: 200 + i, type: Math.random() < .4 ? specials[Math.floor(Math.random() * specials.length)] : 'plain' } };
  const li = L.indexOf(l);
  const ctx = { type: l.type, li, cells: l.cells, chips: 40, mult: 6, simult: 1, forked: Math.random() < .2, threats: Math.floor(Math.random() * 3), oThreat: Math.random() < .3 ? 1 : 0 };
  S.jokers = id ? [{ uid: 1, id, ed: null, data: { m: 6, n: 8 } }] : [];
  const acc = { c: ctx.chips, m: ctx.mult, $: 0 };
  // pieces' own scoring is the same with or without the joker, so only the joker's hooks are applied
  for (const i of l.cells) for (const j of S.jokers) { const d = D.JOKERS[j.id]; if (d.x) apply(acc, d.x(ctx, i, S.board[i].p, j)); }
  for (const j of S.jokers) { const d = D.JOKERS[j.id]; if (d.line) apply(acc, d.line(ctx, j)); }
  return { score: acc.c * acc.m, money: acc.$, fired: acc.c !== ctx.chips || acc.m !== ctx.mult || acc.$ > 0 };
}
const base = (N) => { let s = 0; for (let r = 0; r < 300; r++) s += trial(null, N, r).score; return s / 300; };
const B = { 3: base(3), 4: base(4) };
for (const id of Object.keys(D.JOKERS)) {
  const out = {};
  for (const N of [3, 4]) {
    let s = 0, f = 0, m = 0; const n = 400;
    for (let r = 0; r < n; r++) { const t = trial(id, N, r); s += t.score; f += t.fired ? 1 : 0; m += t.money; }
    out[N] = { ratio: s / n / B[N], fired: f / n, money: m / n };
  }
  rows.push([id, D.JOKERS[id].rar, D.JOKERS[id].cost, out[3], out[4]]);
}
rows.sort((a, b) => b[4].ratio - a[4].ratio);
console.log('joker'.padEnd(13), 'rar cost | 3x3: x-score fired money | 4x4: x-score fired money');
for (const [id, rar, cost, a, b] of rows) console.log(id.padEnd(13), String(rar).padStart(2), String(cost).padStart(3), '|', a.ratio.toFixed(2).padStart(6), (100 * a.fired).toFixed(0).padStart(4) + '%', a.money.toFixed(1).padStart(5), '|', b.ratio.toFixed(2).padStart(6), (100 * b.fired).toFixed(0).padStart(4) + '%', b.money.toFixed(1).padStart(5));
