import { launch } from './cdp.mjs';
const b = await launch({ width: 1280, height: 800, url: 'http://localhost:8099/Projects/LunchMoney/' });
const hide = () => b.eval(`document.getElementById('coach')&&(document.getElementById('coach').style.display='none')`);
await b.eval(`(async()=>{ const E = await import('/Projects/LunchMoney/js/engine.js'); const st = await import('/Projects/LunchMoney/js/state.js'); window.__E=E; window.__S=st.S; window.__st=st; E.actions.newRun(); })()`);
await b.sleep(700);
// shop with money
await b.eval(`(()=>{const S=__S; S.money=60; S.phase='shop'; S.blindIdx=1; S.shop={items:[{kind:'joker',id:'snowball',ed:'poly',cost:6,sold:false},{kind:'piece',id:'cursed',cost:5,sold:false}],voucher:'rack',vSold:false,reroll:5,trimmed:false,packs:[{type:'joker',cost:5,sold:false},{type:'piece',cost:4,sold:false}]}; S.anteVoucher={ante:1,id:'rack',bought:false}; __E.actions.cancelMode&&0; document.getElementById('coach')&&(document.getElementById('coach').style.display='none'); })()`);
await b.eval(`import('/Projects/LunchMoney/js/ui.js').then(u=>u.render())`);
await b.sleep(1200); await hide();
await b.shot('shots/fx-shop.png');
await b.eval(`__E.actions.buy('i0')`);
for (let i = 0; i < 4; i++) { await b.sleep(110); await b.shot(`shots/fx-buy${i}.png`); }
// scoring with big multiplier
await b.sleep(600);
await b.eval(`(()=>{const S=__S; S.phase='blind'; S.shop=null; S.levels.row=6; S.jokers.push({uid:50,id:'diag',ed:null,data:{}},{uid:51,id:'combo',ed:null,data:{}},{uid:52,id:'banana',ed:null,data:{}},{uid:53,id:'midas',ed:null,data:{}}); S.bag=S.bag.concat([{uid:970,type:'glass'},{uid:971,type:'glass'},{uid:972,type:'glass'}]); __E.actions.startBlind();})()`);
await b.sleep(2200); await hide();
await b.eval(`(()=>{const S=__S; S.round.target=9e9; S.board[0]={t:'X',p:{uid:-5,type:'glass'}}; S.board[1]={t:'X',p:{uid:-6,type:'glass'}}; S.hand=[{uid:960,type:'glass'},{uid:961,type:'plain'},{uid:962,type:'plain'}]; S.selIdx=0; __E.actions.cell('2');})()`);
for (let i = 0; i < 9; i++) { await b.sleep(380); await b.shot(`shots/fx-score${i}.png`); }
console.log('errors', b.errors());
b.close();
