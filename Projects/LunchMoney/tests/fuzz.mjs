// Chaos test: random (often nonsensical) actions in every phase. Nothing may throw, and the run's numbers must stay sane.
import { S, SET, E, R, D, seed } from './bot.mjs';
const A = E.actions;
const N = +(process.argv[2] || 200), STEPS = +(process.argv[3] || 1500);
const problems = new Map(); let actions = 0;
process.on('unhandledRejection', e => note('unhandled rejection: ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join(' | ')));
function note(m) { problems.set(m, (problems.get(m) || 0) + 1); }
const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = n => Math.floor(Math.random() * n);
function invariants(where) {
  if (!Number.isFinite(S.money) || S.money < 0) note(`${where}: money ${S.money}`);
  if (S.jokers.length > R.jokerSlots() + 1) note(`${where}: ${S.jokers.length} jokers in ${R.jokerSlots()} slots`);
  if (S.items.length > S.itemSlots) note(`${where}: ${S.items.length} items in ${S.itemSlots} slots`);
  if (S.phase === 'play' && (!Array.isArray(S.board) || S.board.length !== S.N * S.N)) note(`${where}: board size ${S.board && S.board.length} for N=${S.N}`);
  if (S.bag.length < 1) note(`${where}: empty bag`);
  if (S.phase === 'play' && S.round && !Number.isFinite(S.round.score)) note(`${where}: round score ${S.round.score}`);
  if (S.phase === 'play' && S.hand.length > R.handMax()) note(`${where}: hand ${S.hand.length} > ${R.handMax()}`);
  for (const k of Object.keys(S.levels)) if (!(S.levels[k] >= 1)) note(`${where}: level ${k} = ${S.levels[k]}`);
}
async function step() {
  const ph = S.phase; actions++;
  const uids = () => [...S.items.map(i => String(i.uid)), ...S.jokers.map(j => String(j.uid)), '999'];
  const cells = () => String(rnd(S.N * S.N + 2) - 1);
  const choices = {
    blind: [() => A.startBlind(), () => A.startBlind(), () => A.skipBlind(), () => A.cell('0')],
    cashout: [() => A.cashOut()],
    play: [() => A.selectPiece(String(rnd(5))), () => A.cell(cells()), () => A.cell(cells()), () => A.cell(cells()), () => A.discard(), () => A.useItem(pick(uids())), () => A.cancelMode(), () => A.sellJoker(pick(uids())), () => A.moveJoker(pick(uids()) + ':' + pick(['-1', '1'])), () => A.sellItem(pick(uids())), () => A.buy('i0'), () => A.nextRound(), () => A.applyTile(cells())],
    shop: [() => A.buy('i' + rnd(4)), () => A.buy('v'), () => A.reroll(), () => A.trim(), () => A.buyPack(String(rnd(4))), () => A.takePack(String(rnd(5))), () => A.armPack(String(rnd(4))), () => A.editPiece(String(S.bag.length ? pick(S.bag).uid : 1)), () => A.applyTile(cells()), () => A.cancelTile(), () => A.skipPack(), () => A.sellJoker(pick(uids())), () => A.sellItem(pick(uids())), () => A.useItem(pick(uids())), () => A.moveJoker(pick(uids()) + ':1'), () => A.nextRound(), () => A.nextRound(), () => A.cell(cells())],
    won: [() => A.endless()], over: [() => null], title: [() => null],
  };
  const f = pick(choices[ph] || [() => null]);
  try { await f(); } catch (e) { note(`${ph}: threw ${(e && e.stack || e).toString().split('\n').slice(0, 2).join(' | ')}`); }
  invariants(ph);
}
let finished = 0;
for (let run = 1; run <= N; run++) {
  seed(run * 31); SET.speed = 1; R.freshRun(pick(R.unlockedDecks()));
  // sprinkle: random content so unusual states come up
  for (let k = 0; k < rnd(5); k++) S.jokers.push({ uid: 7000 + k, id: pick(Object.keys(D.JOKERS)), ed: pick([null, null, 'foil', 'holo', 'poly', 'negative']), data: {} });
  S.money = rnd(80); if (Math.random() < .3) { S.ante = 1 + rnd(8); if (S.ante >= 4) { S.N = 4; S.board = Array(16).fill(null); } }
  for (let i = 0; i < STEPS && S.phase !== 'over'; i++) { let w = 0; while (S.busy && w++ < 3000) await new Promise(r => setTimeout(r, 0)); if (S.busy) { note(`stuck busy in ${S.phase} (run ${run}, step ${i})`); S.busy = false; } await step(); }
  if (S.phase === 'over') finished++;
}
console.log(`fuzz: ${N} runs, ${actions} actions, ${finished} runs ended by game over`);
if (problems.size) { console.log('PROBLEMS:'); for (const [m, n] of [...problems].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(String(n).padStart(5), m); } else console.log('no problems');
