// Every English interface string has a Danish one (and the other way round); placeholders match.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../js/strings.js', import.meta.url), 'utf8');
const grab = name => { const i = src.indexOf(`const ${name} = {`), j = src.indexOf('\n};', i); return src.slice(i + `const ${name} = {`.length, j); };
const keys = block => {
  const m = new Map();
  for (const r of block.matchAll(/'([\w.]+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/g)) m.set(r[1], r[2] ?? r[3] ?? r[4] ?? '');
  return m;
};
const en = keys(grab('EN')), da = keys(grab('DA'));
let bad = 0;
for (const k of en.keys()) if (!da.has(k)) { bad++; console.log('missing in DA:', k); }
for (const k of da.keys()) if (!en.has(k)) { bad++; console.log('missing in EN:', k); }
const ph = s => (s.match(/\{\w+\}|\$\{\w+\}/g) || []).sort().join(',');
for (const [k, v] of en) if (da.has(k) && ph(v) !== ph(da.get(k))) { bad++; console.log('placeholders differ:', k, ph(v), 'vs', ph(da.get(k))); }
console.log(`i18n: ${en.size} EN keys, ${da.size} DA keys, ${bad} problems`);
