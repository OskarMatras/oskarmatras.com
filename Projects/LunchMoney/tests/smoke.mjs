import { S, D, R, GEO, seed, E } from './bot.mjs';
let bad = 0, calls = 0;
const types = Object.keys(D.PIECES);
for (const N of [3, 4, 5]) for (let rep = 0; rep < 60; rep++) {
  seed(rep * 7 + N); R.freshRun(); S.N = N; S.phase = 'play'; S.blindIdx = 0;
  S.round = { score: 0, target: 100, games: 4, discards: 3, gameNo: 1, reward: 3 };
  S.board = Array(N * N).fill(null).map(() => { const r = Math.random(); return r < .4 ? { t: 'X', p: { uid: Math.floor(Math.random() * 1e6), type: types[Math.floor(Math.random() * types.length)] } } : r < .6 ? { t: 'O' } : null; });
  S.g = { scored: [], placements: 4, aiMoves: 3, lines: Math.floor(Math.random() * 3), haste: false, pile: [] };
  S.hand = [{ uid: 1, type: 'plain' }]; S.money = Math.floor(Math.random() * 60); S.items = [{ uid: 9, id: 'eraser' }];
  S.levels = { row: 1 + rep % 3, col: 1, diag: 2, draw: 1 };
  const L = GEO.geo().lines;
  for (const li of [0, Math.floor(L.length / 2), L.length - 1]) {
    const l = L[li]; for (const i of l.cells) if (!S.board[i] || S.board[i].t !== 'X') S.board[i] = { t: 'X', p: { uid: 5000 + i, type: types[(i + rep) % types.length] } };
    const ctx = { type: l.type, li, cells: l.cells, chips: 20, mult: 3, simult: 1, forked: rep % 2 === 0, threats: rep % 4, oThreat: rep % 3 };
    for (const [id, d] of Object.entries(D.JOKERS)) {
      const j = { uid: 1, id, ed: null, data: { m: 3, n: 2 } }; S.jokers = [j];
      for (const hook of ['x', 'line']) {
        if (!d[hook]) continue;
        try {
          const r = hook === 'x' ? d.x(ctx, l.cells[0], S.board[l.cells[0]].p, j) : d.line(ctx, j);
          calls++;
          if (r) for (const k of Object.keys(r)) if (!['chips', 'mult', 'xmult', 'money'].includes(k) || !Number.isFinite(r[k])) { bad++; console.log('BAD effect', id, hook, JSON.stringify(r)); }
        } catch (e) { bad++; console.log('THROW', id, hook, N, e.message); }
      }
      try { d.desc(j); } catch (e) { bad++; console.log('desc throws', id); }
    }
  }
}
console.log(`smoke: ${calls} hook calls, ${bad} problems`);
