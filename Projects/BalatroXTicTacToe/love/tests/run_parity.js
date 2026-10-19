// Runs the whole parity test: for each seed, play a scripted game on the web
// game's JS engine, replay it on the Lua port under LÖVE (headless), compare.
// Usage: node tests/run_parity.js [firstSeed] [count] [steps]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const first = +(process.argv[2] ?? 1), count = +(process.argv[3] ?? 40), steps = +(process.argv[4] ?? 600);
const candidates = [process.env.LOVEC, 'C:/Program Files/LOVE/lovec.exe', '/usr/bin/love', '/usr/local/bin/love'].filter(Boolean);
const lovec = candidates.find(p => fs.existsSync(p)) ?? 'lovec';
const seeds = [];
for (let s = first; s < first + count; s++) {
  seeds.push(s);
  // The web engine runs headless: tests/hooks.mjs (in the web game's tests folder) swaps its ui.js and audio.js for stubs.
  const hooks = pathToFileURL(path.join(root, '..', 'tests', 'register.mjs')).href;
  const a = spawnSync('node', ['--import', hooks, path.join(root, 'tests/gen_trace.js'), String(s), String(steps)], { encoding: 'utf8' });
  if (a.status) { console.log(a.stdout, a.stderr); process.exit(2); }
  const out = path.join(root, 'tests/out');
  const b = spawnSync(lovec, ['.', '--parity', `tests/out/js_${s}.json`, `tests/out/lua_${s}.json`], { cwd: root, encoding: 'utf8' });
  if (b.status) { console.log('lua failed', b.stdout, b.stderr); }
}
const c = spawnSync('node', [path.join(root, 'tests/compare.js'), ...seeds.map(String)], { encoding: 'utf8' });
process.stdout.write(c.stdout + c.stderr);
process.exit(c.status ?? 1);
