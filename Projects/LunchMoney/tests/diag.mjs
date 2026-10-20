import { runOne, S, summarize } from './bot.mjs';
const N = +(process.argv[2] || 200), opt = JSON.parse(process.argv[3] || '{}');
const per = {};
const slot = () => per[S.ante] ||= { games: 0, lines: 0, busted: 0, draw: 0, full: 0, dry: 0, win: 0, sum: 0, max: 0 };
globalThis.__rec = (k, a, b) => {
  if (!S.round) return;
  const s = slot();
  if (k === 'total') { s.lines++; s.sum += a; s.max = Math.max(s.max, a); }
  if (k === 'banner') {
    s.games++;
    if (b) s.busted++; else if (/won|vandt/i.test(a)) s.win++; else if (/draw|Uafgjort/i.test(a)) s.draw++; else if (/full|fuldt/i.test(a)) s.full++; else s.dry++;
  }
};
const res = [];
for (let i = 1; i <= N; i++) res.push(await runOne({ ...opt, seed: i }));
console.log(JSON.stringify(summarize(res)));
for (const a of Object.keys(per)) { const s = per[a]; console.log(`ante ${a}: games ${s.games}, lines/game ${(s.lines / s.games).toFixed(2)}, busted ${(100 * s.busted / s.games).toFixed(0)}%, wins ${(100 * s.win / s.games).toFixed(0)}%, dry/full/draw ${(100 * (s.dry + s.full + s.draw) / s.games).toFixed(0)}%, avg line ${Math.round(s.sum / Math.max(1, s.lines))}, max ${s.max}`); }
