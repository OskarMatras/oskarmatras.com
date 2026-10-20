// The prologue, headless: the story queue, the guarded tutorial shop, the ambush and the hand-over to the real game.
import { S, SET, E, R, GEO, seed } from './bot.mjs';
const A = E.actions;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const tick = () => new Promise(r => setTimeout(r, 0));
async function settle() { for (let i = 0; i < 400 && S.busy; i++) await tick(); await tick(); }
const toasts = []; globalThis.__rec = (k, a) => { if (k === 'toast') toasts.push(a); };

/** Place X wherever it adds most to a line that is still open. */
async function playOne() {
  const L = GEO.geo().lines;
  let best = -1, cell = null;
  for (const l of L) {
    const cs = l.cells.map(i => S.board[i]);
    if (cs.some(c => c && c.t !== 'X')) continue;
    const n = cs.filter(Boolean).length;
    for (const i of l.cells) if (!S.board[i] && n > best) { best = n; cell = i; }
  }
  if (cell === null) cell = R.emptyCells()[0];
  S.selIdx = Math.max(0, S.hand.findIndex(p => p.type === 'red'));
  await A.cell(String(cell)); await settle();
}
async function playUntil(cond, limit = 80) { for (let i = 0; i < limit && !cond(); i++) { if (S.busy) { await settle(); continue; } await playOne(); } }

seed(11);
SET.prologueDone = false; SET.seen = {};
A.play();
ok(S.tut && S.tut.on, 'play() starts the prologue the first time');
ok(S.scene && S.scene.queue[0] === 'intro' && S.scene.after === 'bout1', 'the intro scene is queued');
A.startBlind(); A.cell('0');
ok(S.phase === 'blind', 'nothing but the story works while a scene is showing');
A.storyDone(); await settle();
ok(S.phase === 'play' && S.tut.bout === 1 && !S.scene, 'after the intro the first bout starts');
ok(S.round.target === 50 && S.blindIdx === 0, 'the first bout has a target of 50');

// the first X must go in the middle
S.selIdx = 0;
await A.cell('0'); await settle();
ok(!S.board[0], 'guided: the first X cannot go in a corner');
await A.cell('4'); await settle();
ok(S.board[4] && S.board[4].t === 'X', 'guided: the middle works');
await playUntil(() => S.phase !== 'play');
ok(S.phase === 'cashout' && S.tut.bout === 1, 'bout 1 is won with one row (phase ' + S.phase + ')');
A.cashOut();
ok(S.phase === 'shop', 'cash-out leads to the shop');
ok(S.shop.items[0].id === 'jester' && S.shop.packs[0].type === 'piece', 'the tutorial shop is stocked with the lesson');
// the shop is free: buy what you like, in any order, and leave
const money0 = S.money;
A.buy('i1'); ok(S.items.some(i => i.id === 'chalk_row'), 'the Row Chalk can be bought before the Class Clown');
S.money += 10; const m1 = S.money; A.reroll(); ok(S.money < m1, 'the shop is free: a restock works');
A.buyPack('1'); ok(S.pack && S.pack.type === 'chalk', 'the second pack can be opened');
A.skipPack(); ok(!S.pack, 'and skipped');
// leaving without the lesson purchases: Pip hands them over
const bagBefore = S.bag.length;
A.nextRound(); await settle();
ok(S.jokers.some(j => j.id === 'jester') && S.bag.some(p => p.type === 'red') && S.bag.length === bagBefore + 1, 'without them, Pip gives a Class Clown and a Red-Pen X');
ok(S.phase === 'play' && S.tut.bout === 2 && S.blindIdx === 1 && S.round.target === 150, 'bout 2 starts with a target of 150');
ok(S.hand.some(p => p.type === 'red'), 'the Red-Pen X is in the first hand of bout 2');
await playUntil(() => S.phase !== 'play');
ok(S.phase === 'cashout', 'bout 2 is won with the build (phase ' + S.phase + ')');
A.cashOut();
ok(S.scene && S.scene.queue[0] === 'ambush_intro' && S.scene.after === 'bout3', 'the ambush scene follows the second bout');
A.storyDone(); await settle();
ok(S.phase === 'play' && S.tut.bout === 3 && S.boss.id === 'ollie' && S.blindIdx === 2, 'the Sixth-Grader takes the third bout');
ok(S.round.games === 2, 'the ambush is two games long');
ok(S.board[4] && S.board[4].t === 'O', 'he starts in the middle');
ok(R.isMuzzled(S.jokers[0]) && R.ambush(), 'every Trick is confiscated and special X count as plain');

// lose it
S.round.target = 600;
await playUntil(() => S.scene || S.phase !== 'play', 200);
ok(S.phase === 'blind' && S.scene && S.scene.queue.join() === 'ambush_lose,tour' && S.scene.after === 'finish', 'losing the third bout leads to the defeat scene and the tour (phase ' + S.phase + ')');
ok(S.money === 0, 'he takes the lunch money');
A.storyDone(); ok(S.scene && S.scene.queue[0] === 'tour', 'the tour follows');
A.storyDone();
ok(!S.tut && !S.scene && SET.prologueDone && S.phase === 'blind' && S.ante === 1 && S.money === 4, 'the real game starts fresh');
ok(SET.seen.place && SET.seen.shop, 'the light tips skip the basics afterwards');

// the same title button now starts a normal run
SET.prologueDone = true; A.play();
ok(!S.tut && !S.scene, 'later, the title button starts a normal run');

// the real finale: his scene before the bout, and the win scene
seed(5); R.freshRun(); S.ante = 8; S.blindIdx = 2; S.boss = { id: 'ollie' }; S.phase = 'blind';
A.startBlind();
ok(S.scene && S.scene.queue[0] === 'finale_intro' && S.phase === 'blind', 'turf 8: the Sixth-Grader makes an entrance first');
A.storyDone(); await settle();
ok(S.phase === 'play' && S.boss.id === 'ollie', 'then the bout starts');
S.jokers = [{ uid: 1, id: 'jester', ed: null, data: {} }, { uid: 2, id: 'center', ed: null, data: {} }, { uid: 3, id: 'corner', ed: null, data: {} }];
ok(R.isMuzzled(S.jokers[0]) && R.isMuzzled(S.jokers[1]) && !R.isMuzzled(S.jokers[2]), 'the finale confiscates only the two leftmost Tricks');
ok(!R.ambush(), 'and special X still score');

// ... and after the win the scene comes before the victory screen
S.phase = 'cashout'; S.cashout = { rows: [], notes: [], total: 0, finalWin: true }; S.round = { score: 1, target: 1, games: 1, discards: 0, gameNo: 1, reward: 0, name: 'x' };
A.cashOut();
ok(S.phase === 'won' && S.scene && S.scene.queue[0] === 'finale_win', 'the win scene plays over the victory screen');
A.storyDone();
ok(S.phase === 'won' && !S.scene, 'and then the victory screen is there');

console.log(`prologue: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
