// Edge cases of the prologue in a real browser: Escape, reload in the middle (of a bout and of a scene), skipping,
// Notes over a tutorial step, the language switch, replaying the story. Screenshots go to shots/edge-*.png.
import { launch } from './cdp.mjs';
const URL = 'http://localhost:8099/Projects/LunchMoney/';
const b = await launch({ width: 1280, height: 800, url: URL });
const ev = x => b.eval(x);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const imp = `(async()=>{ const E = await import('/Projects/LunchMoney/js/engine.js'); const st = await import('/Projects/LunchMoney/js/state.js'); const UI = await import('/Projects/LunchMoney/js/ui.js'); window.__E=E; window.__S=st.S; window.__UI=UI; window.__st=st; })()`;
const load = async () => { await b.goto(URL); await ev(imp); await b.sleep(700); };
const storyOpen = () => ev(`!!document.getElementById('story') && !document.getElementById('story').hidden`);
const bubbleText = () => ev(`(()=>{ const c=document.getElementById('coach'); return c && !c.hidden ? c.querySelector('.cText').textContent : null; })()`);
const clickStory = async n => { for (let i = 0; i < n; i++) { await ev(`document.getElementById('story').click()`); await b.sleep(120); await ev(`document.getElementById('story').click()`); await b.sleep(200); } };

await ev(`localStorage.clear()`); await load();
await ev(`document.querySelector('[data-act="play"]').click()`); await b.sleep(600);
ok(await storyOpen(), 'the story opens on Start');
await clickStory(2);
// Escape ends the scene and the first bout begins
await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await b.sleep(1500);
ok(!(await storyOpen()), 'Escape skips the scene');
ok((await ev(`__S.phase`)) === 'play' && (await ev(`__S.tut.bout`)) === 1, 'the first bout starts after the scene');
const t1 = await bubbleText();
ok(t1 && t1.includes('middle square'), 'Pip asks for the middle square (' + t1 + ')');

// a click on a corner does nothing, the middle works
await ev(`document.querySelector('[data-cell="0"]').click()`); await b.sleep(400);
ok((await ev(`!__S.board[0]`)), 'a corner is refused in the first move');
await ev(`document.querySelector('[data-cell="4"]').click()`); await b.sleep(1800);
ok((await ev(`!!__S.board[4]`)), 'the middle is accepted');

// Notes covers Pip, and Pip comes back
await ev(`__UI.showModal('info')`); await b.sleep(400);
ok((await bubbleText()) === null, 'Pip steps aside behind Notes');
await b.shot('shots/edge-notes.png');
await ev(`__UI.showModal(null)`); await b.sleep(500);
ok((await bubbleText()) !== null, 'Pip is back after Notes');

// language switch mid-step
await ev(`document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: 'da' } }))`); await b.sleep(500);
const da = await bubbleText();
ok(da && /Svar|Pip|svar|felt|brik|hånd|midter|Det er mig|kridt/i.test(da) && !/Tap the/.test(da), 'the bubble switches to Danish (' + (da || '').slice(0, 40) + ')');
await b.shot('shots/edge-da-bubble.png');
await ev(`document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: 'en' } }))`); await b.sleep(300);

// reload in the middle of the bout: Continue lands in the same place
await ev(`__st.saveRun()`);
await load();
const cont = await ev(`!!document.querySelector('[data-act="continueRun"]')`);
ok(cont, 'a Continue button is offered after a reload mid-prologue');
await ev(`document.querySelector('[data-act="continueRun"]').click()`); await b.sleep(900);
ok((await ev(`__S.phase`)) === 'play' && (await ev(`!!__S.tut && __S.tut.bout`)) === 1 && (await ev(`__S.board.some(c=>c&&c.t==='X')`)), 'the bout is restored with the X on the board');
ok((await bubbleText()) !== null, 'Pip is there again after the reload');

// Skip the tutorial from the bubble
await ev(`document.querySelector('#coach .cSkip').click()`); await b.sleep(900);
const after = JSON.parse(await ev(`JSON.stringify({ tut: !!__S.tut, scene: !!__S.scene, phase: __S.phase, done: JSON.parse(localStorage.getItem('lm-settings')||'{}').prologueDone, deckModal: !document.getElementById('overlay').hidden })`));
ok(!after.tut && !after.scene && after.done, 'Skip the tutorial leads to the real game');
await b.shot('shots/edge-after-skip.png');

// Replay the story from the title
await ev(`__E.actions.abandon()`); await b.sleep(500);
ok(await ev(`!!document.querySelector('[data-act="replayStory"]')`), 'the title offers Replay the story once it has been seen');
await ev(`document.querySelector('[data-act="replayStory"]').click()`); await b.sleep(700);
ok((await storyOpen()) && (await ev(`!!__S.tut`)), 'Replay the story starts the prologue again');

// reload while a scene is on screen
await ev(`__st.saveRun()`);
await load();
await ev(`document.querySelector('[data-act="continueRun"]').click()`); await b.sleep(900);
ok(await storyOpen(), 'a reload in the middle of a scene resumes it');

// Danish scene text fits
await ev(`document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: 'da' } }))`); await b.sleep(300);
await clickStory(5); await b.sleep(1400);
await b.shot('shots/edge-da-scene.png');
const fit = await ev(`(()=>{ const t=document.querySelector('#story .stText'); const b=document.querySelector('#story .stBox'); return t.scrollHeight <= b.clientHeight; })()`);
ok(fit, 'Danish scene text fits in the speech box');
console.log(`edge: ${pass} passed, ${fail} failed`);
console.log('errors', b.errors());
b.close();
process.exit(fail ? 1 : 0);
