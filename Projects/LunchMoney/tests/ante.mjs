import { launch } from './cdp.mjs';
const b = await launch({ width: 1280, height: 800, url: 'http://localhost:8099/Projects/LunchMoney/' });
await b.eval(`(async()=>{ const E = await import('/Projects/LunchMoney/js/engine.js'); const st = await import('/Projects/LunchMoney/js/state.js'); window.__E=E; window.__S=st.S; st.SET.tips=false; E.actions.newRun(); })()`);
await b.sleep(380); await b.shot('shots/ante1.png');
await b.sleep(400); await b.shot('shots/ante2.png');
console.log(b.errors()); b.close();
