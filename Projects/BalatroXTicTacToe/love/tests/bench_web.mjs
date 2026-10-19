// Measures the web version's main-thread cost while a bot plays it, using
// headless Chrome and the DevTools protocol. Serve a COPY of the web game
// (e.g. `git archive` of the commit you want) with any static server first;
// this script never touches the website repo.
//
//   node tests/bench_web.mjs <url> [seconds] [chromePath]
//
// Reports Chrome's own task/script/layout/style durations per rendered frame,
// rAF callback time and frame interval. Headless Chrome has no real display, so
// the frame interval only shows whether the page keeps up with 60 Hz.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const url = process.argv[2];
const seconds = +(process.argv[3] ?? 30);
const chrome = process.argv[4] ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const port = 9333 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bxt-bench-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1024,768', '--disable-gpu-vsync=false', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.some(t => t.type === 'page')) break; } catch {}
  await sleep(200);
}
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

const HOOK = `(() => {
  const B = window.__bench = { frames: [], cb: [], last: 0, cur: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = fn => raf(ts => { const t0 = performance.now(); if (ts !== B.last) { if (B.last) { B.frames.push(ts - B.last); B.cb.push(B.cur); } B.last = ts; B.cur = 0; } fn(ts); B.cur += performance.now() - t0; });
  const q = s => document.querySelector(s);
  const click = el => { if (el && !el.disabled) { el.click(); return true; } return false; };
  const pick = list => list[Math.floor(Math.random() * list.length)];
  window.addEventListener('DOMContentLoaded', () => {
    setInterval(() => {
      const phase = document.body.dataset.phase;
      if (phase === 'title') click(q('[data-act=newRun]'));
      else if (phase === 'blind') click(q('[data-act=startBlind]'));
      else if (phase === 'play') {
        if (!q('.boardWrap.armed')) return;
        const sp = [...document.querySelectorAll('.hp:not(.sel)')].find(h => !h.querySelector('.t-plain'));
        if (sp && Math.random() < 0.7) { click(sp); return; }
        click(pick([...document.querySelectorAll('#board .cell.empty')]));
      } else if (phase === 'cashout') click(q('[data-act=cashOut]'));
      else if (phase === 'shop') {
        if (q('[data-act=takePack]:not([disabled])')) { click(q('[data-act=takePack]:not([disabled])')); return; }
        if (q('[data-act=skipPack]')) { click(q('[data-act=skipPack]')); return; }
        if (q('.tiling')) { click(pick([...document.querySelectorAll('#tileBoard .cell')])); return; }
        const buys = [...document.querySelectorAll('[data-act=buy]:not([disabled]),[data-act=buyPack]:not([disabled])')];
        if (buys.length && Math.random() < 0.6) click(pick(buys)); else click(q('[data-act=nextRound]'));
      } else if (phase === 'over') click(q('[data-act=newRun]'));
    }, 120);
    setTimeout(() => { for (let i = 0; i < 2; i++) click(q('[data-act=toggleSpeed]')); }, 500);
  });
})()`;

await send('Page.enable'); await send('Performance.enable'); await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
await send('Page.navigate', { url });
await sleep(3000);
const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map(m => [m.name, m.value]));
const m0 = await metrics(); const f0 = await evalJs('window.__bench.frames.length');
await sleep(seconds * 1000);
const m1 = await metrics();
const B = await evalJs('JSON.stringify({ frames: window.__bench.frames.slice(' + f0 + '), cb: window.__bench.cb.slice(' + f0 + '), phase: document.body.dataset.phase, ante: (document.querySelector("#side .stat.ante b")||{}).textContent })');
const b = JSON.parse(B);
const d = k => (m1[k] - m0[k]);
const stat = a => { const s = [...a].sort((x, y) => x - y); return { mean: a.reduce((x, y) => x + y, 0) / a.length, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };
const n = b.frames.length;
const fi = stat(b.frames), cb = stat(b.cb);
console.log(`web (${url})  ${seconds}s, ${n} rAF frames, phase at end: ${b.phase}, ante ${b.ante}`);
console.log(`frame interval ms: mean ${fi.mean.toFixed(2)} p95 ${fi.p95.toFixed(2)} max ${fi.max.toFixed(2)}  (=> ${(1000 / fi.mean).toFixed(0)} fps)`);
console.log(`rAF callbacks, summed per frame, ms:  mean ${cb.mean.toFixed(3)} p95 ${cb.p95.toFixed(3)} max ${cb.max.toFixed(3)}`);
console.log(`main-thread ms per frame: task ${(d('TaskDuration') * 1000 / n).toFixed(2)}  script ${(d('ScriptDuration') * 1000 / n).toFixed(2)}  layout ${(d('LayoutDuration') * 1000 / n).toFixed(2)}  style ${(d('RecalcStyleDuration') * 1000 / n).toFixed(2)}`);
ws.close(); proc.kill();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(0);
