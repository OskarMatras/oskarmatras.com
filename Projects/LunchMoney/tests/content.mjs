import { runOne, S, D, R, summarize } from './bot.mjs';
const N = +(process.argv[2] || 150), what = process.argv[3] || 'jokers';
const prog = r => r.ante + (r.wonRun ? 1 : 0) - 1 + r.blind / 3 + (r.cause === 'died' ? 0 : 0);
async function avg(setup) {
  let sum = 0, won = 0, stall = 0;
  for (let i = 1; i <= N; i++) { const r = await runOne({ seed: i, setup }); sum += prog(r); won += r.wonRun ? 1 : 0; stall += r.stalls; }
  return { avg: sum / N, won, stall };
}
const base = await avg(null);
console.log('baseline', base.avg.toFixed(2), 'won', base.won);
const rows = [];
if (what === 'jokers') {
  for (const id of Object.keys(D.JOKERS)) {
    const r = await avg(() => { S.jokers.push({ uid: 900, id, ed: null, data: {} }); if (D.JOKERS[id].req && id.match(/longshot|bigsky/)) {} });
    rows.push([id, r.avg - base.avg, r.won, r.stall]);
  }
} else if (what === 'pieces') {
  for (const id of D.SPECIALS) {
    const r = await avg(() => { for (let k = 0; k < 3; k++) { const p = R.newPiece(id); S.bag.push(p); } });
    rows.push([id, r.avg - base.avg, r.won, r.stall]);
  }
}
rows.sort((a, b) => b[1] - a[1]);
for (const [id, d, w, s] of rows) console.log(id.padEnd(14), (d >= 0 ? '+' : '') + d.toFixed(2), 'won', w, s ? 'STALLS ' + s : '');
