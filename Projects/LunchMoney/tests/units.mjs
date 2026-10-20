import { S, SET, E, D, R, GEO, seed } from './bot.mjs';
const A = E.actions;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const piece = (type, uid) => ({ uid, type });
const X = (type = 'plain', uid = -50) => ({ t: 'X', p: { uid, type } });
const totals = []; globalThis.__rec = (k, a) => { if (k === 'total') totals.push(a); };

function start(opts = {}) {
  seed(opts.seed ?? 7); R.freshRun();
  if (opts.N) { S.N = opts.N; S.board = Array(opts.N * opts.N).fill(null); }
  if (opts.setup) opts.setup();
  S.phase = 'blind'; S.blindIdx = opts.blind ?? 0;
  A.startBlind();
  if (opts.after) opts.after();
}
const tick = () => new Promise(r => setTimeout(r, 0));
async function settle() { for (let i = 0; i < 200 && S.busy; i++) await tick(); }

// --- sprout grows and persists in the bag
{
  start({ setup() { S.bag = [piece('sprout', 301), ...Array.from({ length: 7 }, (_, i) => piece('plain', 310 + i))]; } , after() {} });
  // force hand
  S.hand = [{ uid: 301, type: 'sprout' }, { uid: 302, type: 'plain' }, { uid: 303, type: 'plain' }]; S.selIdx = 0;
  S.round.target = 1e9;
  S.board[1] = X('plain'); S.board[2] = X('plain');
  await A.cell('0'); await settle();
  const bs = S.bag.find(p => p.uid === 301);
  ok(bs && bs.grow === 1, 'sprout grows by 1 in bag (got ' + (bs && bs.grow) + ')');
}
// --- cursed gives the rival two answers
{
  start({}); S.hand = [{ uid: 401, type: 'cursed' }, { uid: 402, type: 'plain' }, { uid: 403, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
  const before = S.board.filter(c => c && c.t === 'O').length;
  await A.cell('4'); await settle();
  const after = S.board.filter(c => c && c.t === 'O').length;
  ok(after - before === 2, 'cursed: rival placed 2 O (got ' + (after - before) + ')');
}
// --- exorcist cancels it
{
  start({ setup() { S.jokers.push({ uid: 5, id: 'exorcist', data: {} }); } }); S.hand = [{ uid: 401, type: 'cursed' }, { uid: 402, type: 'plain' }, { uid: 403, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
  await A.cell('4'); await settle();
  ok(S.board.filter(c => c && c.t === 'O').length === 1, 'exorcist: only one O');
}
// --- turncoat flips an adjacent O
{
  start({}); S.board[0] = { t: 'O' }; S.hand = [{ uid: 501, type: 'turncoat' }, { uid: 502, type: 'plain' }, { uid: 503, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
  await A.cell('1'); await settle();
  ok(S.board[0] && S.board[0].t === 'X', 'turncoat turned the O at 0 into X');
}
// --- trap square removes the rival's O and pays
{
  start({ setup() { S.squares = {}; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S.squares[r + ',' + c] = { trap: 1 }; S.money = 0; } });
  S.hand = [{ uid: 601, type: 'plain' }, { uid: 602, type: 'plain' }, { uid: 603, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
  await A.cell('4'); await settle();
  ok(S.board.filter(c => c && c.t === 'O').length === 0 && S.money === 2, 'trap: O removed and $2 paid (money ' + S.money + ')');
}
// --- safe squares: rival avoids them
{
  let hits = 0;
  for (let k = 0; k < 30; k++) {
    start({ seed: 100 + k, setup() { S.squares = { '0,0': { safe: 1 }, '0,1': { safe: 1 }, '0,2': { safe: 1 }, '1,0': { safe: 1 } }; } });
    S.hand = [{ uid: 701, type: 'plain' }, { uid: 702, type: 'plain' }, { uid: 703, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
    await A.cell('8'); await settle();
    S.board.forEach((c, i) => { if (c && c.t === 'O' && [0, 1, 2, 3].includes(i)) hits++; });
  }
  ok(hits === 0, 'safe squares never chosen by the rival (' + hits + ')');
}
// --- safety net catches a bust
{
  start({ setup() { S.items.push({ uid: 801, id: 'safetynet' }); } });
  S.board[0] = { t: 'O' }; S.board[1] = { t: 'O' };
  S.hand = [{ uid: 811, type: 'plain' }, { uid: 812, type: 'plain' }, { uid: 813, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
  // rival will complete at 2 unless we block; place far away, sure rival wins (winP high at ante 1 ~.55): loop seeds
  let used = false;
  for (let k = 0; k < 20 && !used; k++) {
    start({ seed: 200 + k, setup() { S.items.push({ uid: 801, id: 'safetynet' }); } });
    S.board[0] = { t: 'O' }; S.board[1] = { t: 'O' }; S.hand = [{ uid: 811, type: 'plain' }, { uid: 812, type: 'plain' }, { uid: 813, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
    await A.cell('8'); await settle();
    if (!S.items.some(i => i.id === 'safetynet')) used = true;
    if (S.phase === 'over' || S.round.games < 4) { /* a bust slipped through without a net? */ if (S.items.some(i => i.id === 'safetynet')) {} }
  }
  ok(used, 'safety net was used up when the rival completed a line');
}
// --- reshuffle
{
  start({ setup() { S.items.push({ uid: 901, id: 'reshuffle' }); } });
  const old = S.hand.map(p => p.uid).join(',');
  A.useItem('901');
  ok(S.hand.length === 3 && S.hand.map(p => p.uid).join(',') !== old && !S.items.length, 'reshuffle dealt a fresh hand and was used');
}
// --- rainbow chalk
{
  start({ setup() { S.items.push({ uid: 902, id: 'chalk_rainbow' }); } });
  A.useItem('902');
  ok(S.levels.row === 2 && S.levels.col === 2 && S.levels.diag === 2 && S.levels.draw === 1, 'rainbow chalk levels row/col/diag');
}
// --- clamp: hand size
{
  start({ blind: 2, setup() { S.boss = { id: 'clamp' }; } });
  ok(S.hand.length === 2, 'clamp: hand of 2 (got ' + S.hand.length + ')');
}
// --- siege: two O at start
{
  start({ blind: 2, setup() { S.boss = { id: 'siege' }; } });
  ok(S.board.filter(c => c && c.t === 'O').length === 1, 'siege starts with 1 O on 3x3');
}
// --- toll
{
  start({ blind: 2, setup() { S.boss = { id: 'toll' }; S.money = 5; } });
  S.round.target = 1e9; S.selIdx = 0; await A.cell('4'); await settle();
  ok(S.money === 4, 'toll costs $1 per X (money ' + S.money + ')');
}
// --- muzzle silences leftmost joker, copycat copies the right one
{
  totals.length = 0;
  start({ setup() { S.jokers.push({ uid: 11, id: 'jester', data: {} }); } });
  S.board[0] = X(); S.board[1] = X(); S.hand = [{ uid: 1001, type: 'plain' }, { uid: 1002, type: 'plain' }, { uid: 1003, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
  await A.cell('2'); await settle();
  const plainTotal = totals.pop();
  totals.length = 0;
  start({ blind: 2, setup() { S.boss = { id: 'muzzle' }; S.jokers.push({ uid: 11, id: 'jester', data: {} }); } });
  S.board[0] = X(); S.board[1] = X(); S.hand = [{ uid: 1001, type: 'plain' }, { uid: 1002, type: 'plain' }, { uid: 1003, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
  await A.cell('2'); await settle();
  const muzzled = totals.pop();
  ok(plainTotal > muzzled, `muzzle silenced the only Joker (${plainTotal} vs ${muzzled})`);
  totals.length = 0;
  start({ setup() { S.jokers.push({ uid: 12, id: 'copycat', data: {} }, { uid: 11, id: 'jester', data: {} }); } });
  S.board[0] = X(); S.board[1] = X(); S.hand = [{ uid: 1001, type: 'plain' }, { uid: 1002, type: 'plain' }, { uid: 1003, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
  await A.cell('2'); await settle();
  const copy = totals.pop();
  ok(copy > plainTotal, `copycat doubled the jester (${copy} vs ${plainTotal})`);
}
// --- vouchers
{
  start({ setup() { S.ante = 3; } });
  S.phase = 'shop'; // makeShop via winning a blind is complex: call buy through a fake shop
  S.shop = { items: [], voucher: 'overstock', vSold: false, reroll: 5, trimmed: false, packs: [] };
  S.anteVoucher = { ante: 3, id: 'overstock', bought: false }; S.money = 30;
  A.buy('v');
  ok(S.cardSlots === 3 && S.shop.items.length === 1, 'overstock: +1 card slot and a card now');
  S.anteVoucher = { ante: 3, id: 'compound', bought: false }; S.shop.vSold = false; S.shop.voucher = 'compound'; A.buy('v');
  ok(S.interestCap === 10, 'compound interest cap 10');
  S.anteVoucher = { ante: 3, id: 'clearance', bought: false }; S.shop.vSold = false; S.shop.voucher = 'clearance';
  S.shop.items = [{ kind: 'piece', id: 'red', cost: 4, sold: false }]; A.buy('v');
  ok(S.discount === 1 && S.shop.items[0].cost === 3, 'clearance lowers current prices');
}
// --- hot streak and snowball via gameEnd
{
  const j = { uid: 21, id: 'hotstreak', data: {} };
  D.JOKERS.hotstreak.gameEnd(j, { lines: 2, reason: 'dry' }); D.JOKERS.hotstreak.gameEnd(j, { lines: 1, reason: 'dry' });
  ok(j.data.n === 2, 'hot streak counts games in a row');
  D.JOKERS.hotstreak.gameEnd(j, { lines: 0, reason: 'dry' }); ok(j.data.n === 0, 'hot streak resets');
  const s = { uid: 22, id: 'snowball', data: { m: 9 } }; D.JOKERS.snowball.gameEnd(s, { reason: 'busted', lines: 1 }); ok(s.data.m === 4, 'snowball halves on bust');
}
// --- open play: line does not end game on 4x4
{
  start({ N: 4 }); S.round.target = 1e9;
  S.board[0] = X(); S.board[1] = X(); S.hand = [{ uid: 1101, type: 'plain' }, { uid: 1102, type: 'plain' }, { uid: 1103, type: 'plain' }]; S.selIdx = 0;
  const g0 = S.round.gameNo;
  await A.cell('2'); await settle();
  ok(S.round.gameNo === g0 && S.g.lines >= 1, 'on 4x4 a line does not end the game');
}
// --- moving jokers
{
  start({ setup() { S.jokers.push({ uid: 31, id: 'jester', data: {} }, { uid: 32, id: 'copycat', data: {} }); } });
  A.moveJoker('32:-1');
  ok(S.jokers[0].id === 'copycat', 'joker moved left');
  A.moveJoker('32:-1'); ok(S.jokers[0].id === 'copycat', 'cannot move past the end');
}
// --- hourglass and amplifier
{
  start({ setup() { S.items.push({ uid: 41, id: 'hourglass' }, { uid: 42, id: 'amplifier' }); } });
  const g = S.round.games; A.useItem('41'); ok(S.round.games === g + 1, 'hourglass: +1 game');
  totals.length = 0;
  S.board[0] = X(); S.board[1] = X(); S.hand = [{ uid: 1201, type: 'plain' }, { uid: 1202, type: 'plain' }, { uid: 1203, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
  await A.cell('2'); await settle(); const plain = totals.pop();
  start({ setup() { S.items.push({ uid: 42, id: 'amplifier' }); } });
  A.useItem('42'); ok(S.g.amp === true && !S.items.length, 'amplifier armed and used up');
  S.board[0] = X(); S.board[1] = X(); S.hand = [{ uid: 1201, type: 'plain' }, { uid: 1202, type: 'plain' }, { uid: 1203, type: 'plain' }]; S.selIdx = 0; S.round.target = 1e9;
  await A.cell('2'); await settle(); const amped = totals.pop();
  ok(amped >= plain * 1.9, `amplifier doubles the line (${plain} -> ${amped})`);
}
console.log(`units: ${pass} passed, ${fail} failed`);
