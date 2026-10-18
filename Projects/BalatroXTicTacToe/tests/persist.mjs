// Save in the middle of every kind of screen, reload the page, press Continue, and check we land in the same place.
import { launch } from './cdp.mjs';
const URL = 'http://localhost:8099/Projects/BalatroXTicTacToe/';
const b = await launch({ width: 1280, height: 800, url: URL });
const init = `(async()=>{ const E = await import('/Projects/BalatroXTicTacToe/js/engine.js'); const st = await import('/Projects/BalatroXTicTacToe/js/state.js'); const UI = await import('/Projects/BalatroXTicTacToe/js/ui.js'); window.__E=E; window.__S=st.S; window.__st=st; window.__UI=UI; st.SET.tips=false; })()`;
await b.eval(init); await b.sleep(400);
const scenarios = {
  blind: `__E.actions.newRun()`,
  play: `__E.actions.newRun(); __E.actions.startBlind();`,
  playMid: `__E.actions.newRun(); __E.actions.startBlind(); setTimeout(()=>__E.actions.cell('4'), 800);`,
  shop: `__E.actions.newRun(); __S.money=20; __E.actions.startBlind(); setTimeout(()=>{ __S.round.target=1; __S.board[0]={t:'X',p:{uid:-5,type:'plain'}}; __S.board[1]={t:'X',p:{uid:-6,type:'plain'}}; __E.actions.cell('2'); setTimeout(()=>__E.actions.cashOut(), 5500); }, 800);`,
  pack: `__E.actions.newRun(); __S.money=20; __E.actions.startBlind(); setTimeout(()=>{ __S.round.target=1; __S.board[0]={t:'X',p:{uid:-5,type:'plain'}}; __S.board[1]={t:'X',p:{uid:-6,type:'plain'}}; __E.actions.cell('2'); setTimeout(()=>{ __E.actions.cashOut(); __S.money=30; __E.actions.buyPack('0'); }, 5500); }, 800);`,
};
const waits = { blind: 600, play: 1500, playMid: 3500, shop: 9500, pack: 10500 };
for (const [name, code] of Object.entries(scenarios)) {
  await b.goto(URL); await b.eval(init); await b.sleep(300);
  await b.eval(`localStorage.removeItem('bxt-run-v3')`);
  await b.eval(code); await b.sleep(waits[name]);
  const before = await b.eval(`({phase:__S.phase, ante:__S.ante, blind:__S.blindIdx, money:__S.money, jokers:__S.jokers.length, hand:__S.hand.length, board:__S.board.filter(Boolean).length, pack:!!__S.pack, shop:!!__S.shop, busy:__S.busy})`);
  await b.goto(URL); await b.eval(init); await b.sleep(400);
  const clicked = await b.eval(`(()=>{ const e=document.querySelector('[data-act=continueRun]'); if(!e) return false; e.click(); return true; })()`);
  await b.sleep(900);
  const after = await b.eval(`({phase:__S.phase, ante:__S.ante, blind:__S.blindIdx, money:__S.money, jokers:__S.jokers.length, hand:__S.hand.length, board:__S.board.filter(Boolean).length, pack:!!__S.pack, shop:!!__S.shop, busy:__S.busy})`);
  const same = JSON.stringify(before) === JSON.stringify(after);
  console.log(name.padEnd(8), clicked ? 'continue clicked' : 'NO CONTINUE BUTTON', same ? 'same state' : 'DIFFERENT', same ? '' : JSON.stringify({ before, after }));
}
console.log('errors', b.errors());
b.close();
