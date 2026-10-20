// Minimal Chrome DevTools Protocol driver: launch headless Chrome, evaluate JS in the page, take screenshots.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const get = url => new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }).on('error', rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ width = 1280, height = 800, dpr = 1, url, port = 9333 } = {}) {
  const dir = fs.mkdtempSync(process.env.TEMP + '/cdp-');
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' });
  let ws, tries = 0, list;
  while (tries++ < 50) { try { list = JSON.parse(await get(`http://127.0.0.1:${port}/json`)); if (list.length) break; } catch (e) { /* not up yet */ } await sleep(200); }
  const page = list.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const events = [];
  ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method) events.push(d); });
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: width < 500 });
  const api = {
    send, events,
    async goto(u) { await send('Page.navigate', { url: u }); await sleep(900); },
    async eval(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails)); return r.result && r.result.result ? r.result.result.value : undefined; },
    async shot(file, clip) { fs.mkdirSync(file.replace(/[\/][^\/]*$/, '') || '.', { recursive: true }); const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); return file; },
    async resize(w, h, d = dpr) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: d, mobile: w < 500 }); },
    async click(x, y) { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); },
    async move(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); },
    errors() { return events.filter(e => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')).map(e => JSON.stringify(e.params).slice(0, 400)); },
    sleep,
    close() { try { ws.close(); } catch (e) { /* */ } proc.kill(); },
  };
  if (url) await api.goto(url);
  return api;
}
