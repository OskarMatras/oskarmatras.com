// One command to keep the Lua port in step with the web game (which lives one folder up).
//
//   node tools/sync.mjs                  regenerate content, say what is not ported yet, syntax-check, smoke-test
//   node tools/sync.mjs --parity 20      ... and replay 20 scripted games on both engines (the real test)
//   node tools/sync.mjs --show <id>      print the web source of a Joker's hooks (what to port)
//   node tools/sync.mjs --accept a,b     record Jokers a and b as ported at the web's current hooks
//                                        (do this only after the parity test is green)
//   node tools/sync.mjs --no-smoke       skip the autoplay run
//
// Regenerating is always safe: content the Lua engine does not implement is left out of its shops (see data.lua)
// and listed here, so the Lua game keeps running while the port catches up.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { hookHash } from './hookhash.mjs';

const here = import.meta.dirname, root = path.resolve(here, '..'), web = path.resolve(root, '..');
const args = process.argv.slice(2);
const has = f => args.includes(f), val = f => args[args.indexOf(f) + 1];
const lovec = [process.env.LOVEC, 'C:/Program Files/LOVE/lovec.exe', '/usr/bin/love', '/usr/local/bin/love'].filter(Boolean).find(p => fs.existsSync(p)) ?? 'lovec';
const run = (cmd, a, opt = {}) => spawnSync(cmd, a, { cwd: root, encoding: 'utf8', ...opt });
const D = await import(pathToFileURL(path.join(web, 'js', 'data.js')).href + '?t=' + Date.now());

if (has('--show')) {
  const j = D.JOKERS[val('--show')];
  if (!j) { console.log('no such Joker in the web game'); process.exit(1); }
  for (const k of ['line', 'x', 'endRound', 'req', 'val', 'gameEnd']) if (j[k]) console.log(`${k}: ${j[k].toString()}\n`);
  console.log('desc:', JSON.stringify(j.desc({ data: {} })));
  process.exit(0);
}

if (has('--accept')) {
  const ids = val('--accept').split(',').map(s => s.trim()).filter(Boolean);
  const file = path.join(root, 'src', 'ported.lua');
  const text = fs.readFileSync(file, 'utf8');
  const current = Object.fromEntries([...text.matchAll(/^\s+(\w+) = "([0-9a-f]+)",$/gm)].map(m => [m[1], m[2]]));
  for (const id of ids) {
    if (!D.JOKERS[id]) { console.log('unknown Joker', id); process.exit(1); }
    current[id] = hookHash(D.JOKERS[id]);
  }
  const head = text.slice(0, text.indexOf('return {'));
  fs.writeFileSync(file, head + 'return {\n  jokers = {\n' + Object.entries(current).map(([k, v]) => `    ${k} = "${v}",\n`).join('') + '  },\n}\n');
  console.log('recorded', ids.join(', '));
  process.exit(0);
}

let bad = 0;
const step = (name, r) => { const ok = r.status === 0; if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) console.log((r.stdout || '') + (r.stderr || '')); return r; };

const web_head = spawnSync('git', ['-C', web, 'log', '-1', '--format=%h %s'], { encoding: 'utf8' }).stdout.trim();
console.log(`web game: ${web_head}\n`);
step('regenerate content_gen.lua and strings_gen.lua', run('node', [path.join(here, 'gen_content.js')]));

const rep = run(lovec, ['.', '--report']);
const lines = (rep.stdout || '').split('\n').filter(l => l.startsWith('[bxt]'));
console.log(lines.length ? '\nWhat the Lua port still owes the web game:\n' + lines.map(l => '  ' + l.replace('[bxt] ', '')).join('\n') + '\n' : '\nNothing outstanding: every web card is ported.\n');

step('syntax check (lovec . --check)', run(lovec, ['.', '--check']));
if (!has('--no-smoke')) {
  const r = run(lovec, ['.', '--autoplay', '--seed', '3'], { timeout: 180000 });
  const ok = r.status === 0 && /ANTE 1 COMPLETE/.test(r.stdout || '');
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} autoplay smoke test (a bot plays ante 1 through the real UI)`);
  if (!ok) console.log((r.stdout || '') + (r.stderr || ''));
}
if (has('--parity')) {
  const n = val('--parity') && /^\d+$/.test(val('--parity')) ? val('--parity') : '20';
  const r = run('node', [path.join(root, 'tests', 'run_parity.js'), '1', n, '600']);
  const tail = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-12).join('\n');
  if (r.status !== 0) bad++;
  console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} parity: ${n} scripted games, JS engine vs Lua engine\n${tail}`);
}
console.log(bad ? `\n${bad} problem(s)` : '\nall good');
process.exit(bad ? 1 : 0);
