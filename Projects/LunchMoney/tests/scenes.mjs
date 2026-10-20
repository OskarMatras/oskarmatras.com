import { launch } from './cdp.mjs';
const W = +(process.argv[2] || 1280), H = +(process.argv[3] || 800), tag = process.argv[4] || 'd';
const b = await launch({ width: W, height: H, url: 'http://localhost:8099/Projects/LunchMoney/' });
const hideCoach = () => b.eval(`document.getElementById('coach')&&(document.getElementById('coach').style.display='none')`);
await b.eval(`(async()=>{ const E = await import('/Projects/LunchMoney/js/engine.js'); const st = await import('/Projects/LunchMoney/js/state.js'); window.__E=E; window.__S=st.S; window.__st=st; })()`);
await b.sleep(500);
await b.shot(`shots/${tag}-1-title.png`);
await b.eval(`__E.actions.newRun()`); await b.sleep(900);
await b.shot(`shots/${tag}-2-blind.png`);
await b.eval(`(()=>{const S=__S; S.jokers.push({uid:901,id:'jester',ed:'foil',data:{}},{uid:902,id:'taxman',ed:null,data:{}}); S.items.push({uid:910,id:'chalk_row'}); S.bag.push({uid:950,type:'red'},{uid:951,type:'lucky'}); S.money=14; __E.actions.startBlind();})()`);
await b.sleep(2500); await hideCoach();
await b.shot(`shots/${tag}-3-play.png`);
// score a row with frames
await b.eval(`(()=>{const S=__S; S.round.target=300; S.board[0]={t:'X',p:{uid:-5,type:'plain'}}; S.board[1]={t:'X',p:{uid:-6,type:'red'}}; S.hand=[{uid:960,type:'lucky'},{uid:961,type:'plain'},{uid:962,type:'plain'}]; S.selIdx=0; __E.actions.cell('2');})()`);
for (let i = 0; i < 5; i++) { await b.sleep(520); await b.shot(`shots/${tag}-4-score${i}.png`); }
await b.sleep(4500);
await b.shot(`shots/${tag}-5-cashout.png`);
await b.eval(`__E.actions.cashOut()`); await b.sleep(1500); await hideCoach();
await b.shot(`shots/${tag}-6-shop.png`);
await b.eval(`(()=>{__S.money=40; __E.actions.buyPack('0');})()`); await b.sleep(2200);
await b.shot(`shots/${tag}-7-pack.png`);
await b.eval(`__E.actions.skipPack(); __E.actions.nextRound()`); await b.sleep(800);
await b.eval(`__E.actions.startBlind()`); await b.sleep(1500); await hideCoach();
await b.shot(`shots/${tag}-8-big.png`);
console.log('errors', b.errors());
b.close();
