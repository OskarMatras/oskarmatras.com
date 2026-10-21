// Every Trick, one at a time, against a drawn game in a boss bout: the game must always carry on.
import { S, SET, E, D, R, seed } from './bot.mjs';
const A = E.actions;
const tick = () => new Promise(r => setTimeout(r, 0));
const problems = [];
process.on('unhandledRejection', e => problems.push('unhandled: ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' | ')));
let n = 0;
for (const id of Object.keys(D.JOKERS)) {
  for (const bossId of ['master', 'wall']) {
    seed(3); R.freshRun(); S.jokerSlots = 6;
    S.jokers = [{ uid: 901, id, ed: null, data: {} }];
    S.ante = 3; S.blindIdx = 2; S.boss = { id: bossId }; S.phase = 'blind';
    A.startBlind(); for (let i = 0; i < 50 && S.busy; i++) await tick();
    const X = () => ({ t: 'X', p: { uid: -Math.floor(Math.random() * 1e6) - 10, type: 'plain' } }), O = () => ({ t: 'O' });
    S.board = [X(), O(), X(), X(), O(), O(), O(), X(), null]; S.hand = [{ uid: 970, type: 'plain' }, { uid: 971, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
    A.cell('8');
    let ticks = 0; while (S.busy && ticks++ < 3000) await tick();
    await tick();
    n++;
    if (S.busy) problems.push(`${id} (${bossId}): the game is stuck after a draw`);
    else if (S.round && S.round.gameNo < 2 && S.phase === 'play') problems.push(`${id} (${bossId}): no new game after a draw`);
  }
}
// a Trick that throws in the middle of scoring must not freeze the game
D.JOKERS.jester.line = () => { throw new Error('boom'); };
seed(3); R.freshRun(); S.jokers = [{ uid: 902, id: 'jester', ed: null, data: {} }]; S.phase = 'blind'; A.startBlind(); for (let i = 0; i < 50 && S.busy; i++) await tick();
S.board = [{ t: 'X', p: { uid: -1, type: 'plain' } }, { t: 'X', p: { uid: -2, type: 'plain' } }, null, null, null, null, null, null, null]; S.hand = [{ uid: 980, type: 'plain' }, { uid: 981, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
const realError = console.error; console.error = () => {};
A.cell('2'); { let k = 0; while (S.busy && k++ < 3000) await tick(); } await tick();
console.error = realError;
if (S.busy) problems.push('an error in a Trick froze the game');
console.log(`drawjokers: ${n} runs, ${problems.length} problems`);
problems.slice(0, 20).forEach(p => console.log('  ' + p));
process.exit(problems.length ? 1 : 0);
