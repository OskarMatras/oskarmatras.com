import { runOne, summarize } from './bot.mjs';
const N = +(process.argv[2] || 600), opt = JSON.parse(process.argv[3] || '{}');
const res = []; for (let i = 1; i <= N; i++) res.push(await runOne({ ...opt, seed: i }));
const s = summarize(res); const rows = [];
for (let a = 1; a <= 8; a++) rows.push(`ante ${a}: ` + [0, 1, 2].map(b => String(s.deaths[`${a}.${b}`] || 0).padStart(3)).join(' ') + `  (${[0,1,2].reduce((x,b)=>x+(s.deaths[`${a}.${b}`]||0),0)})`);
console.log(`runs ${N} won ${s.won} (${(100*s.won/N).toFixed(1)}%) avgAnte ${s.avgAnte}`); console.log(rows.join('\n'));
