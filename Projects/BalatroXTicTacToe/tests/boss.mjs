import { runOne } from './bot.mjs';
const by = {}; 
for (let i = 1; i <= 800; i++) { const r = await runOne({ seed: i }); const k = r.boss || '-'; if (r.cause === 'died' && r.blind === 2) { by[r.ante] ||= {}; by[r.ante][k] = (by[r.ante][k] || 0) + 1; } }
// fights per boss: approximate by counting from seeds is hard; just print deaths
console.log(JSON.stringify(by));
