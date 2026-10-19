// Compares the JS and Lua digests step by step and reports the first
// difference per seed (after a divergence later steps mean nothing).
// Usage: node tests/compare.js <seed> [<seed> ...]
import fs from 'node:fs';
import path from 'node:path';

const out = path.join(import.meta.dirname, 'out');
// Canonical form: sorted keys, null-valued keys dropped, empty {} and [] equal.
function canon(v) {
  if (Array.isArray(v)) return v.length ? v.map(canon) : [];
  if (v && typeof v === 'object') {
    const ks = Object.keys(v).filter(k => v[k] !== null && v[k] !== undefined).sort();
    if (!ks.length) return [];
    const o = {}; for (const k of ks) o[k] = canon(v[k]);
    return o;
  }
  return v;
}
function firstDiff(a, b, p = '') {
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) return [p, a, b];
  if (a && typeof a === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDiff(a[k], b[k], p + (Array.isArray(a) ? `[${k}]` : '.' + k));
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : [p, a, b];
}
let bad = 0, total = 0, stepsTotal = 0;
for (const seed of process.argv.slice(2)) {
  const js = JSON.parse(fs.readFileSync(path.join(out, `js_${seed}.json`)));
  const lu = JSON.parse(fs.readFileSync(path.join(out, `lua_${seed}.json`)));
  total++;
  const problems = [];
  const ud = firstDiff(canon(js.units), canon(lu.units));
  if (ud) problems.push(`units differ at ${ud[0]}: js=${JSON.stringify(ud[1])} lua=${JSON.stringify(ud[2])}`);
  if (js.err) problems.push(`JS engine threw: ${js.err.split('\n')[0]}`);
  if (lu.err) problems.push(`Lua error: ${lu.err.split('\n').slice(0, 3).join(' | ')}`);
  const n = Math.min(js.steps.length, lu.steps.length);
  stepsTotal += n;
  for (let i = 0; i < n; i++) {
    const d = firstDiff(canon(js.steps[i].d), canon(lu.steps[i].d ?? lu.steps[i]));
    if (d) {
      problems.push(`step ${i} (${js.steps[i].act} ${JSON.stringify(js.steps[i].arg)}) differs at ${d[0]}: js=${JSON.stringify(d[1])} lua=${JSON.stringify(d[2])}`);
      break;
    }
  }
  if (js.steps.length !== lu.steps.length && !lu.err) problems.push(`step count js=${js.steps.length} lua=${lu.steps.length}`);
  if (problems.length) { bad++; console.log(`seed ${seed}: MISMATCH\n  ` + problems.join('\n  ')); }
}
console.log(`${total - bad}/${total} seeds identical (${stepsTotal} compared steps)`);
process.exit(bad ? 1 : 0);
