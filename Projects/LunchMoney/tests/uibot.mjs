// Plays the real page with real mouse clicks (through hit testing, like a person) and reports anything that gets stuck or throws.
// Needs Chrome and the game served at http://localhost:8099/Projects/LunchMoney/
import { launch } from './cdp.mjs';

const CHEAT = process.argv[5] === 'cheat';   // easy targets and plenty of money, to reach (and click through) as many shops as possible
const W = +(process.argv[2] || 1280), H = +(process.argv[3] || 800), MAXMS = +(process.argv[4] || 90000);
const b = await launch({ width: W, height: H, url: 'http://localhost:8099/Projects/LunchMoney/' });
await b.eval(`(async()=>{ const E = await import('/Projects/LunchMoney/js/engine.js'); const st = await import('/Projects/LunchMoney/js/state.js'); window.__E=E; window.__S=st.S; window.__SET=st.SET; window.__R = await import('/Projects/LunchMoney/js/rules.js'); st.SET.speed=4; st.SET.tips=false; })()`);
const centre = async sel => b.eval(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)}); if(!e||e.disabled) return null; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
/** Click an element the way a user would: at its centre, and only if it is what is actually under the pointer. */
async function click(sel, tries = 4) {
  const c = await centre(sel); if (!c) return false;
  const hit = await b.eval(`(()=>{ const t=document.elementFromPoint(${c.x},${c.y}); const e=document.querySelector(${JSON.stringify(sel)}); return !!(t && e && (e===t || e.contains(t))); })()`);
  if (!hit && tries > 1) { await b.sleep(350); return click(sel, tries - 1); }   // an entrance animation may still be running
  if (!hit) { const who = await b.eval(`(()=>{ const t=document.elementFromPoint(${c.x},${c.y}); return t ? t.tagName+'.'+t.className+'#'+t.id : 'none'; })()`); return 'blocked by ' + who; }
  await b.click(c.x, c.y); await b.sleep(60); return true;
}
const state = () => b.eval(`({ phase: __S.phase, busy: __S.busy, ante: __S.ante, blind: __S.blindIdx, mode: __S.mode, pack: !!__S.pack, money: __S.money, hand: (__S.hand||[]).length, N: __S.N, empties: (__S.board||[]).map((c,i)=>c?-1:i).filter(i=>i>=0), xwin: __S.phase==='play'&&__S.g ? [...__R.winCells('X')] : [], owin: __S.phase==='play'&&__S.g ? [...__R.winCells('O')] : [], jokers: (__S.jokers||[]).length, jslots: __R.jokerSlots(), shop: __S.shop && { items: __S.shop.items.map(i=>({kind:i.kind,sold:i.sold,cost:i.cost})), packs: (__S.shop.packs||[]).map(p=>({sold:p.sold,cost:p.cost})), vsold: __S.shop.vSold, v: __S.shop.voucher } })`);

const t0 = Date.now(); const log = []; const problems = [];
let lastKey = '', lastChange = Date.now(), steps = 0;
await b.eval(`(async()=>{ const st = await import('/Projects/LunchMoney/js/state.js'); st.SET.prologueDone = true; st.SET.tips = false; })()`);
await click('[data-act=play]');
while (Date.now() - t0 < MAXMS) {
  const s = await state(); steps++;
  const key = JSON.stringify([s.phase, s.busy, s.ante, s.blind, s.hand, s.empties.length, s.money, s.pack, s.mode]);
  if (key !== lastKey) { lastKey = key; lastChange = Date.now(); }
  if (Date.now() - lastChange > 8000) { problems.push('STUCK in ' + key); await b.shot('shots/uibot-stuck.png'); break; }
  if (s.phase === 'over' || s.phase === 'won') { log.push(`ended: ${s.phase} at ante ${s.ante}.${s.blind}`); break; }
  if (s.busy) { await b.sleep(120); continue; }
  if (s.phase === 'blind') { const r = await click('[data-act=startBlind]'); if (r !== true) problems.push('startBlind click: ' + r); else if (CHEAT) await b.eval(`__S.round.target = 1; __S.money = Math.max(__S.money, 30)`); continue; }
  if (s.phase === 'cashout') { const r = await click('[data-act=cashOut]'); if (r !== true) problems.push('cashOut click: ' + r); continue; }
  if (s.phase === 'play') {
    if (s.mode) { await b.eval(`__E.actions.cancelMode()`); continue; }
    if (!s.hand || !s.empties.length) { await b.sleep(150); continue; }
    const pool = s.xwin.length ? s.xwin : s.owin.length ? s.owin : s.empties;
    const cell = pool[Math.floor(Math.random() * pool.length)];
    const r = await click(`[data-cell="${cell}"]`); if (r !== true) problems.push('cell click: ' + r);
    continue;
  }
  if (s.phase === 'shop') {
    if (s.mode === 'tile') { await click('.cell'); continue; }
    if (s.pack) {
      const opts = await b.eval(`[...document.querySelectorAll('.packScene .sitem:not(:disabled)')].map(e=>e.dataset.act+':'+e.dataset.arg)`);
      if (opts.length) {
        const [act, arg] = opts[0].split(':');
        const r = await click(`.packScene .sitem[data-arg="${arg}"]`);
        if (r !== true) { problems.push('pack option click: ' + r); await b.eval(`__E.actions.skipPack()`); continue; }
        if (act === 'inspectPackOpt') { const t = await click('#insp [data-act=takePack]'); if (t !== true) { await click('[data-act=skipPack]'); } }
        else if (act === 'armPack') { const tg = await click('.tgt:not(:disabled)'); if (tg !== true) await click('[data-act=skipPack]'); }
      } else await click('[data-act=skipPack]');
      continue;
    }
    // buy what we can afford, then leave
    let bought = false;
    for (let i = 0; i < s.shop.items.length && !bought; i++) {
      const it = s.shop.items[i]; if (it.sold || it.cost > s.money) continue;
      if (it.kind === 'joker' && s.jokers >= s.jslots) continue;
      const r = await click(`.sitem[data-arg="i${i}"]`);
      if (r !== true) { problems.push('shop card click: ' + r); continue; }
      const buy = await click('#insp [data-act=buy]'); if (buy === true) bought = true;
    }
    if (!bought) {
      for (let i = 0; i < s.shop.packs.length && !bought; i++) {
        const p = s.shop.packs[i]; if (p.sold || p.cost > s.money) continue;
        if ((await click(`.sitem[data-arg="p${i}"]`)) === true && (await click('#insp [data-act=buyPack]')) === true) bought = true;
      }
    }
    if (!bought) { const r = await click('[data-act=nextRound]'); if (r !== true) problems.push('nextRound click: ' + r); }
    continue;
  }
}
const s = await state();
console.log(`${steps} steps in ${((Date.now() - t0) / 1000).toFixed(0)}s; final: ${s.phase} ante ${s.ante}.${s.blind}`);
for (const l of log) console.log(l);
const errs = b.errors(); if (errs.length) problems.push(...errs.map(e => 'console: ' + e));
console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'no problems');
b.close();
