// One simulated player, many runs in a row, keeping the Yard Book: how fast do things unlock and how far do runs get?
import { S, runOne } from './bot.mjs';
const G = new URL('../js/', import.meta.url).href;
const M = await import(G + 'meta.js');
globalThis.__lmUnlockAll = false; M.reset();
const N = +(process.argv[2] || 60); const rows = []; let firstDone = {};
for (let i = 1; i <= N; i++) {
  await runOne({ seed: 1000 + i });
  const c = M.trickCount(); const ms = M.MILESTONES.filter(m => M.isDone(m.id)).length;
  for (const m of M.MILESTONES) if (M.isDone(m.id) && !firstDone[m.id]) firstDone[m.id] = i;
  rows.push({ i, ante: S.ante, tricks: c.open, ms });
}
const avg = (a, b) => (rows.slice(a, b).reduce((s, r) => s + r.ante, 0) / Math.max(1, rows.slice(a, b).length)).toFixed(2);
console.log(`runs 1-10 avg ante ${avg(0, 10)} | 11-30 ${avg(10, 30)} | 31-${N} ${avg(30, N)}`);
console.log('milestone reached on run:', M.MILESTONES.map(m => `${m.id}:${firstDone[m.id] || '-'}`).join('  '));
console.log('tricks open after runs 1,5,10,20,40:', [1, 5, 10, 20, 40].filter(k => rows[k - 1]).map(k => `${k}:${rows[k - 1].tricks}/${M.trickCount().all}`).join('  '));
globalThis.__lmUnlockAll = true; M.reset();
