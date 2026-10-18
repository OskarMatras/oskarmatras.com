import { launch } from './cdp.mjs';
const b = await launch({ width: 1280, height: 800, url: 'http://localhost:8099/Projects/BalatroXTicTacToe/' });
await b.eval(`(async()=>{ const E = await import('/Projects/BalatroXTicTacToe/js/engine.js'); const st = await import('/Projects/BalatroXTicTacToe/js/state.js'); const UI = await import('/Projects/BalatroXTicTacToe/js/ui.js'); window.__E=E; window.__S=st.S; window.__UI=UI; st.SET.tips=false; E.actions.newRun(); })()`);
await b.sleep(600);
await b.eval(`(()=>{const S=__S; S.phase='shop'; S.money=50; S.shop={items:[],voucher:null,vSold:true,reroll:5,trimmed:false,packs:[{type:'joker',cost:5,sold:false}]}; S.anteVoucher={ante:1,id:null,bought:true}; __UI.render(); __E.actions.buyPack('0');})()`);
await b.sleep(2500);
await b.shot('shots/jpack.png');
console.log(b.errors()); b.close();
