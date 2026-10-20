// The prologue in a real browser: click through the story, play the guided bouts with real clicks, lose to the
// Sixth-Grader, sit through the tour and land in the real game. Screenshots go to shots/pro-*.png.
import { launch } from './cdp.mjs';
const W = +(process.argv[2] || 1280), H = +(process.argv[3] || 800), tag = process.argv[4] || 'pro';
const b = await launch({ width: W, height: H, url: 'http://localhost:8099/Projects/LunchMoney/' });
const ev = x => b.eval(x);
let shots = 0;
const shot = async name => { await b.shot(`shots/${tag}-${String(++shots).padStart(2, '0')}-${name}.png`); };
await ev(`(async()=>{ localStorage.clear(); const E = await import('/Projects/LunchMoney/js/engine.js'); const st = await import('/Projects/LunchMoney/js/state.js'); window.__E=E; window.__S=st.S; })()`);
await b.goto('http://localhost:8099/Projects/LunchMoney/');
await ev(`(async()=>{ const E = await import('/Projects/LunchMoney/js/engine.js'); const st = await import('/Projects/LunchMoney/js/state.js'); window.__E=E; window.__S=st.S; })()`);
await b.sleep(700);
await shot('title');
await ev(`document.querySelector('[data-act="play"]').click()`);
await b.sleep(700);

const storyOpen = () => ev(`!!document.getElementById('story') && !document.getElementById('story').hidden`);
const storyId = () => ev(`document.getElementById('story') ? document.getElementById('story').dataset.scene : ''`);
/** Click through the open scene, with a screenshot every few lines. */
async function scene(label, every = 3) {
  let n = 0;
  while (await storyOpen()) {
    if (n % every === 0) { await b.sleep(1100); await shot(`${label}-${n}`); }
    await ev(`document.getElementById('story').click()`); await b.sleep(150);
    await ev(`document.getElementById('story').click()`); await b.sleep(250);
    if (++n > 40) throw new Error('scene does not end: ' + label);
  }
  await b.sleep(600);
}
const bubble = () => ev(`(()=>{ const c=document.getElementById('coach'); if(!c||c.hidden) return null; return { id: c.querySelector('.cText').textContent.slice(0,50), next: !c.querySelector('.cNext').hidden }; })()`);
const phase = () => ev(`__S.phase`);
let guard = 0;
await scene('intro');
await shot('bout1-start');

// play the guided bouts
async function clickNext() { const bb = await bubble(); if (bb && bb.next) { await ev(`document.querySelector('#coach .cNext').click()`); await b.sleep(250); return true; } return false; }
let shotAt = {};
const once = async name => { if (!shotAt[name]) { shotAt[name] = 1; await shot(name); } };
while (guard++ < 400) {
  if (await storyOpen()) { const id = await storyId(); await scene(id, 4); continue; }
  const ph = await phase();
  const S = await ev(`JSON.stringify({ ph: __S.phase, bout: __S.tut && __S.tut.bout, scene: !!__S.scene, jokers: __S.jokers.length, pack: !!__S.pack, packSold: !!(__S.shop && __S.shop.packs && __S.shop.packs[0].sold), busy: __S.busy, tut: !!__S.tut })`).then(JSON.parse);
  if (!S.tut) break;
  const bb = await bubble();
  if (bb) { await b.sleep(500); await once('bubble-' + bb.id.replace(/[^a-z]/gi, '').slice(0, 14)); }
  if (await clickNext()) continue;
  if (S.busy) { await b.sleep(400); continue; }
  if (S.ph === 'play') {
    // a cell: the middle first, then the best open line
    await ev(`(()=>{ const E=__E.actions, S=__S; const g=(i)=>S.board[i]; const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      let cell=null, best=-1; for (const l of lines) { if (l.some(i=>g(i)&&g(i).t!=='X')) continue; const n=l.filter(i=>g(i)).length; for (const i of l) if(!g(i)&&n>best){best=n;cell=i;} }
      if (cell===null) cell=[0,1,2,3,4,5,6,7,8].find(i=>!g(i)); if (!S.board[4] && cell!==null && S.round && S.round.gameNo===1 && !S.board.some(c=>c)) cell=4;
      if (S.hand.findIndex(p=>p.type==='red')>=0) { S.selIdx=S.hand.findIndex(p=>p.type==='red'); }
      document.querySelector('[data-cell="'+cell+'"]').click(); })()`);
    await b.sleep(900);
    if (S.bout === 3) await once('ambush-play');
    continue;
  }
  if (S.ph === 'cashout') { await once('cashout-' + S.bout); await b.sleep(900); await ev(`document.querySelector('[data-act="cashOut"]').click()`); await b.sleep(500); continue; }
  if (S.ph === 'shop') {
    await b.sleep(500); await once('shop');
    if (S.pack) { await once('pack'); await ev(`__E.actions.takePack('0')`); await b.sleep(300); await ev(`__E.actions.takePack('1')`); await b.sleep(400); continue; }
    if (S.jokers < 1) { await ev(`__E.actions.buy('i0')`); await b.sleep(500); continue; }
    if (!S.packSold) { await ev(`__E.actions.buyPack('0')`); await b.sleep(600); continue; }
    await ev(`__E.actions.nextRound()`); await b.sleep(900); continue;
  }
  await b.sleep(400);
}
await b.sleep(900);
await shot('after');
console.log('final', await ev(`JSON.stringify({ phase: __S.phase, tut: !!__S.tut, scene: !!__S.scene, prologueDone: JSON.parse(localStorage.getItem('lm-settings')||'{}').prologueDone, ante: __S.ante, money: __S.money })`));
console.log('errors', b.errors());
b.close();
