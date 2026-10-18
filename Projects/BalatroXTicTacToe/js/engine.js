// @ts-check
/**
 * Game flow: rounds, placing pieces, the rival, scoring, the shop.
 *
 * Every player action is an entry in `actions` (wired to the interface
 * through ui.bind). Turns that animate are async and set S.busy for their
 * whole length, so taps during scoring are ignored and a save never
 * captures a half-finished turn.
 */
import { S, SET, nid, saveRun, clearRun, saveBest, loadRun, saveSettings, growBoard } from './state.js';
import { geo, rc, squareOf, neighbours, isCenter, mirrorOf } from './geometry.js';
import { PIECES, SPECIALS, TILES, JOKERS, ITEMS, VOUCHERS, LINE_TYPES, EDITIONS, EDITS, PACKS, hasJ } from './data.js';
import {
  rand, shuffle, newPiece, freshRun, nextBoss, blindInfo, lineValues, handMax, isBoss,
  emptyCells, oWon, newXLines, viableLines, threats,
} from './rules.js';
import { t, tr, fmt, fmtM } from './strings.js';
import { sfx, resetStep } from './audio.js';
import * as ui from './ui.js';

const sleep = (/** @type {number} */ ms) => new Promise(r => setTimeout(r, ms / SET.speed));
const jokerOf = (/** @type {string} */ id) => S.jokers.find((/** @type {any} */ j) => j.id === id);

/** Re-render and save whenever the run is at rest. */
function settle() { ui.render(); saveRun(); }

/* =================================================================
   Rounds and games
   ================================================================= */
function startBlind() {
  if (S.phase !== 'blind') return;
  sfx.click();
  const b = blindInfo(S.blindIdx);
  let games = S.maxGames, discards = S.maxDiscards;
  if (S.blindIdx === 2 && S.boss.id === 'needle') games = 2;
  if (S.blindIdx === 2 && S.boss.id === 'drought') discards = 0;
  S.round = { score: 0, target: b.target, games, discards, gameNo: 0, reward: b.reward, name: b.name };
  S.phase = 'play'; S.mode = null;
  newGame();
}

function refill() {
  while (S.hand.length < handMax()) {
    // An empty bag never blocks play: you get a temporary Plain X.
    const p = S.g.pile.pop() || { uid: -1, type: 'plain', temp: true };
    p.dealt = true; S.hand.push(p);
  }
  if (S.selIdx >= S.hand.length) S.selIdx = 0;
}

async function newGame() {
  const N = S.N;
  S.board = Array(N * N).fill(null);
  S.round.gameNo++;
  S.g = { scored: [], placements: 0, aiMoves: 0, lines: 0, haste: false, pile: shuffle(S.bag.map((/** @type {any} */ p) => ({ ...p }))) };
  S.hand = []; S.selIdx = 0;
  if (isBoss('wall')) { const cs = [...Array(N * N).keys()].filter(isCenter); S.board[rand(cs)] = { t: 'S' }; }
  if (isBoss('crowd')) shuffle([...Array(N * N).keys()]).slice(0, 2).forEach(i => { S.board[i] = { t: 'S' }; });
  refill();
  if (S.ante === 1 && S.blindIdx === 0 && S.round.gameNo === 1) ui.toast(t('toast.first'));
  const special = S.hand.findIndex((/** @type {any} */ p) => p.type !== 'plain');
  S.selIdx = special >= 0 ? special : 0;
  if (isBoss('echo')) {
    S.busy = true; ui.render();
    await sleep(500); aiMove(); sfx.o();
    S.busy = false;
  }
  settle();
}

function selectPiece(/** @type {string} */ k) {
  if (S.busy || S.phase !== 'play') return;
  S.selIdx = +k; sfx.click(); ui.render();
}

function discard() {
  if (S.busy || !S.hand.length || !S.round.discards) return;
  S.hand.splice(S.selIdx, 1); S.round.discards--;
  refill(); S.selIdx = S.hand.length - 1; sfx.click(); settle();
}

async function onCell(/** @type {string} */ arg) {
  const i = +arg;
  if (S.busy || S.phase !== 'play' || !(i >= 0 && i < S.board.length)) return;
  const c = S.board[i];
  if (S.mode === 'erase') {
    if (c && c.t === 'O') {
      S.board[i] = null; S.items = S.items.filter((/** @type {any} */ x) => x.uid !== S.pending);
      S.mode = null; S.pending = null; sfx.line(); ui.toast(t('toast.erased')); settle();
    } else ui.toast(t('toast.tapO'));
    return;
  }
  if (c || !S.hand.length) return;
  await placeX(i);
}

/** One full turn: your X, bombs, scoring, the rival's answer, end checks. @param {number} i */
async function placeX(i) {
  S.busy = true;
  const threatsBefore = threats().length;
  const p = S.hand.splice(S.selIdx, 1)[0];
  S.board[i] = { t: 'X', p, fresh: true };
  S.g.placements++;
  sfx.place(); ui.render();

  if (p.type === 'bomb') {
    const targets = neighbours(i).filter(k => S.board[k] && S.board[k].t === 'O');
    if (targets.length) {
      const k = rand(targets);
      await sleep(200); ui.pop(ui.cellEl(k), t('pop.boom'), 'xmult'); sfx.boom();
      S.board[k] = null;
      const demo = jokerOf('demolition');
      if (demo) { demo.data.m = (demo.data.m || 0) + 3; ui.jig(ui.jokerEl(demo.uid)); }
      ui.render();
    }
  }
  if (p.type === 'mirror') {
    const m = mirrorOf(i);
    if (m !== i && !S.board[m]) {
      await sleep(180);
      S.board[m] = { t: 'X', p: { uid: -2, type: 'plain', temp: true, mirrored: true }, fresh: true };
      sfx.place(); ui.render(); ui.pop(ui.cellEl(m), t('pop.mirror'), 'info');
    }
  }

  const fresh = newXLines();
  if (fresh.length) {
    S.g.scored.push(...fresh); ui.render();
    await sleep(250);
    for (const li of fresh) await scoreLine(li, fresh.length, threatsBefore);
    ui.render();
  }
  if (S.round.score >= S.round.target) { await sleep(500); return winBlind(); }
  if (fresh.length && !hasJ('overtime')) return endGame('win');

  const free = S.g.haste || p.type === 'ghost' || (hasJ('doubletap') && S.g.placements === 1);
  if (S.g.haste && p.type !== 'ghost') S.g.haste = false;
  const live = emptyCells().length && viableLines().length;
  if (free && live) ui.pop(ui.cellEl(i), t('pop.free'), 'info');
  if (!free && live) {
    await sleep(380);
    const oi = aiMove(); sfx.o(); ui.render();
    if (oWon()) {
      const guard = jokerOf('guardian');
      if (guard && Math.random() < .5 && oi !== null) {
        await sleep(250); S.board[oi] = null;
        ui.pop(ui.cellEl(oi), t('pop.fizzled'), 'info'); ui.jig(ui.jokerEl(guard.uid)); ui.render();
      } else { await sleep(300); return endGame('busted'); }
    }
  }
  refill();
  const end = !emptyCells().length ? 'full' : (!viableLines().length ? 'dry' : null);
  if (end) return endGame(end);
  S.busy = false; settle();
}

/**
 * The rival. It takes a winning square if it sees one, blocks your
 * two-in-a-row with a probability that rises every ante, and otherwise
 * picks the square that best builds its own lines while getting in your
 * way, with some noise so it is not predictable.
 * @returns {number|null}
 */
function aiMove() {
  const E = emptyCells(); if (!E.length) return null;
  S.g.aiMoves++;
  const a = Math.min(S.ante, 10), master = isBoss('master');
  let blockP = Math.min(.9, .3 + .08 * (a - 1)) + (master ? .35 : 0) - (hasJ('sleepy') ? .25 : 0);
  blockP = Math.max(0, Math.min(.97, blockP));
  const winP = master ? 1 : Math.min(1, .55 + .07 * (a - 1));
  const G = geo();
  /** @type {number|null} */ let pick = null;
  if (hasJ('bully') && S.g.aiMoves === 1) pick = rand(E);
  const completing = (/** @type {string} */ who) => {
    /** @type {number[]} */ const out = [];
    G.lines.forEach((l, li) => {
      const n = l.cells.filter(i => S.board[i] && S.board[i].t === who).length;
      const em = l.cells.filter(i => !S.board[i]);
      if (n === 2 && em.length === 1 && (who === 'O' || !S.g.scored.includes(li))) out.push(em[0]);
    });
    return out;
  };
  if (pick === null) { const w = completing('O'); if (w.length && Math.random() < winP) pick = rand(w); }
  if (pick === null) { const th = completing('X'); if (th.length && Math.random() < blockP) pick = rand(th); }
  if (pick === null) {
    let bestScore = -1e9;
    for (const i of E) {
      let s = G.through[i] * 0.6;
      G.lines.forEach((l, li) => {
        if (!l.cells.includes(i)) return;
        const cs = l.cells.map(j => S.board[j]);
        const nx = cs.filter(c => c && c.t === 'X').length, no = cs.filter(c => c && c.t === 'O').length, ns = cs.filter(c => c && c.t === 'S').length;
        if (!nx && !ns) s += 1.4 * no;
        if (!no && !ns && !S.g.scored.includes(li)) s += blockP * nx;
      });
      s += Math.random() * 2.5;
      if (s > bestScore) { bestScore = s; pick = i; }
    }
  }
  if (pick === null) return null;
  S.board[pick] = { t: 'O', fresh: true };
  return pick;
}

/* =================================================================
   Scoring
   ================================================================= */
/** Apply one effect with its popup and sound. @param {any} ctx @param {any} e @param {HTMLElement|null} target */
async function apply(ctx, e, target) {
  if (target && target.classList.contains('joker')) ui.jig(target);
  // ui.hit() is the juice: the card jumps, sparks burst, points fly into the counter and it pops.
  // It is pure decoration, so the sleeps below (the pacing of the sequence) are unchanged.
  if (e.chips) { ctx.chips += e.chips; ui.pop(target, '+' + fmt(e.chips), 'chips'); sfx.chips(); ui.setCalc(ctx.chips, ctx.mult); ui.hit(target, 'chips', e.chips); await sleep(e.mult || e.xmult || e.money ? 190 : 280); }
  if (e.mult) { ctx.mult += e.mult; ui.pop(target, t('pop.mult', { n: fmtM(e.mult) }), 'mult'); sfx.mult(); ui.setCalc(ctx.chips, ctx.mult); ui.hit(target, 'mult', e.mult); await sleep(e.xmult || e.money ? 190 : 280); }
  if (e.xmult) { ctx.mult *= e.xmult; ui.pop(target, t('pop.xmult', { n: fmtM(e.xmult) }), 'xmult'); sfx.xmult(); ui.setCalc(ctx.chips, ctx.mult); ui.hit(target, 'xmult', ctx.mult); ui.shake(.1); await sleep(e.money ? 220 : 360); }
  if (e.money) { S.money += e.money; ui.pop(target, '+$' + e.money, 'money'); sfx.money(); ui.setMoney(); ui.hit(target, 'money', e.money); await sleep(260); }
}

/** One X scoring, including its retriggers. @param {any} ctx @param {number} i @param {boolean} isFirst */
async function scoreX(ctx, i, isFirst) {
  const p = S.board[i].p, P = /** @type {any} */ (PIECES)[p.type], target = ui.cellEl(i), sq = squareOf(i);
  const thief = isBoss('thief');
  const reps = 1 + (P.retrig || 0) + (sq.echo || 0) + (isFirst && hasJ('echoj') ? 1 : 0);
  const squareTimes = hasJ('grandstand') ? 2 : 1;
  for (let r = 0; r < reps; r++) {
    if (r > 0) { ui.pop(target, t('pop.again'), 'info'); await sleep(220); }
    if (P.chips) await apply(ctx, { chips: P.chips }, target);
    if (P.mult) await apply(ctx, { mult: P.mult }, target);
    if (P.xmult) await apply(ctx, { xmult: p.type === 'glass' && hasJ('glassjaw') ? 3 : P.xmult }, target);
    if (p.type === 'gold' && !thief) await apply(ctx, { money: 2 }, target);
    if (p.type === 'lucky') {
      if (Math.random() < 1 / 3) await apply(ctx, { mult: 15 }, target);
      if (Math.random() < 1 / 12) await apply(ctx, { money: 10 }, target);
    }
    for (let k = 0; k < squareTimes; k++) {
      if (sq.rich) await apply(ctx, { chips: 30 * sq.rich }, target);
      if (sq.hot) await apply(ctx, { mult: 4 * sq.hot }, target);
      if (sq.gild && !thief) await apply(ctx, { money: sq.gild }, target);
    }
    for (const j of S.jokers) {
      const d = JOKERS[j.id];
      if (d.x) { const e = d.x(ctx, i, p, j); if (e) await apply(ctx, e, ui.jokerEl(j.uid)); }
    }
  }
}

/** Shared by lines and draws: X's in order, held Steel, Jokers, then the total. @param {any} ctx @param {string} label */
async function runScore(ctx, label) {
  resetStep();
  ui.setCalc(ctx.chips, ctx.mult, label); sfx.line(); ui.bumpCalc('chips'); ui.bumpCalc('mult');
  ui.markCells(ctx.cells, 'scoring', true);
  await sleep(480);
  for (let k = 0; k < ctx.cells.length; k++) await scoreX(ctx, ctx.cells[k], k === 0);

  const held = S.board.map((/** @type {any} */ c, /** @type {number} */ i) => (c && c.t === 'X' && c.p.type === 'steel' && !c.shattered && !ctx.cells.includes(i)) ? i : -1).filter((/** @type {number} */ i) => i >= 0);
  for (const i of held) {
    ui.markCells([i], 'held', true);
    await apply(ctx, { xmult: hasJ('ironclad') ? 2 : 1.5 }, ui.cellEl(i));
    ui.markCells([i], 'held', false);
  }
  for (const j of S.jokers) {
    const d = JOKERS[j.id];
    if (d.line) { const e = d.line(ctx, j); if (e) await apply(ctx, e, ui.jokerEl(j.uid)); }
    if (j.ed && EDITIONS[j.ed]) await apply(ctx, EDITIONS[j.ed].effect, ui.jokerEl(j.uid));
  }

  const total = Math.floor(ctx.chips * ctx.mult);
  sfx.score(); ui.showTotal(total); ui.pop(ui.boardEl(), '+' + fmt(total), 'money');
  // Half the blind's target is a nudge; the whole target (or more) is the full shake.
  const hit = total / Math.max(1, S.round.target);
  if (hit > 0.5) ui.shake((hit - 0.5) * 2);
  ui.celebrate(hit);
  const from = S.round.score; S.round.score += total;
  for (let s = 1; s <= 14; s++) { ui.setRoundScore(from + total * s / 14); await sleep(28); }

  S.played[ctx.type]++; S.stats.lines++;
  if (total > S.stats.bestLine) { S.stats.bestLine = total; S.stats.bestType = ctx.type; }
  for (const i of ctx.cells) {
    const c = S.board[i];
    if (c && c.p && c.p.type === 'glass' && !c.shattered && (hasJ('glassjaw') || Math.random() < .25)) {
      c.shattered = true; S.bag = S.bag.filter((/** @type {any} */ q) => q.uid !== c.p.uid);
      ui.pop(ui.cellEl(i), t('pop.shattered'), 'dim'); sfx.bad();
    }
  }
  ui.refreshRack();
  await sleep(420);
  ui.markCells(ctx.cells, 'scoring', false);
  ui.setCalc(0, 0, '');
}

/** @param {number} li @param {number} simult @param {number} threatsOpen */
async function scoreLine(li, simult, threatsOpen) {
  const l = geo().lines[li], v = lineValues(l.type);
  await runScore({ type: l.type, li, cells: l.cells, chips: v.chips, mult: v.mult, simult, forked: threatsOpen >= 2, threats: threatsOpen },
    `${tr(/** @type {any} */ (LINE_TYPES)[l.type].name)} <small>${t('lvl', { n: S.levels[l.type] })}</small>`);
  S.g.lines++;
}
async function scoreDraw() {
  const cells = S.board.map((/** @type {any} */ c, /** @type {number} */ i) => (c && c.t === 'X') ? i : -1).filter((/** @type {number} */ i) => i >= 0);
  const v = lineValues('draw');
  await runScore({ type: 'draw', li: -1, cells, chips: v.chips, mult: v.mult, simult: 0, forked: false, threats: 0 },
    `${tr(LINE_TYPES.draw.name)} <small>${t('lvl', { n: S.levels.draw })}</small>`);
}

/** @param {'win'|'busted'|'full'|'dry'} reason */
async function endGame(reason) {
  S.busy = true; ui.render();
  if (reason === 'win') { S.stats.wins++; ui.banner(t('banner.win')); sfx.win(); }
  else if (reason === 'busted') {
    ui.banner(t('banner.busted'), true); sfx.bad();
    const sl = jokerOf('soreloser');
    if (sl) { S.money += 3; ui.setMoney(); ui.pop(ui.jokerEl(sl.uid), '+$3', 'money'); sfx.money(); }
  } else if (S.g.lines === 0) {
    const b = ui.banner(t('banner.draw')); await sleep(700); if (b) b.remove();
    await scoreDraw();
    if (S.round.score >= S.round.target) { await sleep(400); return winBlind(); }
    ui.banner(t('banner.draw'));
  } else ui.banner(reason === 'full' ? t('banner.full') : t('banner.dry'));

  await sleep(1200);
  S.round.games--;
  S.busy = false;
  if (S.round.games <= 0) return gameOver();
  await newGame();
}

function gameOver() {
  S.phase = 'over'; S.busy = false;
  saveBest(); clearRun(); sfx.bad(); ui.render();
}

/**
 * Antes that open with a bigger board, whatever the player bought: { ante: board size }.
 * The game starts as plain 3×3 and picks up complexity quickly, so by ante 4 everyone has 4×4.
 */
const BOARD_GROWS = { 4: 4 };

function winBlind() {
  sfx.win(); ui.celebrate(2.4);   // a big burst over the board, before the screen changes under it
  const r = S.round, rows = [], notes = [];
  rows.push([t('cash.cleared', { name: r.name }), r.reward]);
  const left = Math.max(0, r.games - 1);
  rows.push([left === 1 ? t('cash.unused1') : t('cash.unused', { n: left }), left]);
  rows.push([t('cash.interest'), Math.min(5, Math.floor(S.money / 5))]);
  for (const j of S.jokers) { const d = JOKERS[j.id]; if (d.endRound) rows.push([d.name, d.endRound(j)]); }
  const boom = S.jokers.filter((/** @type {any} */ j) => j.id === 'banana' && Math.random() < .2);
  if (boom.length) { S.jokers = S.jokers.filter((/** @type {any} */ j) => !boom.includes(j)); notes.push(t('cash.banana')); }
  S.cashout = { rows, notes, total: rows.reduce((s, x) => s + /** @type {number} */ (x[1]), 0), finalWin: false };
  S.phase = 'cashout'; S.mode = null; S.busy = false;
  if (S.blindIdx === 2) {
    S.cashout.finalWin = S.ante === 8 && !S.endless;
    S.ante++; S.blindIdx = 0; nextBoss();
    // Before makeShop(), so the shop (and its voucher roll) already knows the new board size.
    const to = /** @type {Record<number, number>} */ (BOARD_GROWS)[S.ante];
    if (to) growBoard(to);
  } else S.blindIdx++;
  saveBest(); makeShop(); settle();
}

function cashOut() {
  if (S.phase !== 'cashout') return;
  S.money += S.cashout.total; sfx.money();
  const fin = S.cashout.finalWin;
  S.cashout = null; S.phase = fin ? 'won' : 'shop';
  settle();
}

function skipBlind() {
  if (S.phase !== 'blind' || S.blindIdx > 1) return;
  if (S.items.length >= S.itemSlots) { ui.toast(t('toast.itemsFull')); return; }
  S.items.push({ uid: nid(), id: rand(Object.keys(ITEMS)) });
  sfx.line(); ui.toast(t('toast.skipped'));
  S.blindIdx++; settle();
}

/* =================================================================
   Shop
   ================================================================= */
/** A Joker the run can use right now (board-size Jokers wait for a bigger board). @param {number} [edBoost] */
function genJoker(edBoost = 1, /** @type {string[]} */ avoid = []) {
  const rr = Math.random(), rar = rr < .1 ? 3 : rr < .38 ? 2 : 1;
  const ok = (/** @type {string} */ id) => !hasJ(id) && !avoid.includes(id) && (!JOKERS[id].req || JOKERS[id].req())
    && !(S.shop && S.shop.items.some((/** @type {any} */ it) => it.id === id));
  let pool = Object.keys(JOKERS).filter(id => JOKERS[id].rar === rar && ok(id));
  if (!pool.length) pool = Object.keys(JOKERS).filter(ok);
  if (!pool.length) pool = Object.keys(JOKERS);
  const id = rand(pool);
  // One roll decides the finish: 3% polychrome, 6% holographic, 10% foil (boosted in Joker Packs).
  let ed = null, edRoll = Math.random();
  for (const k of ['poly', 'holo', 'foil']) { const ch = EDITIONS[k].chance * edBoost; if (edRoll < ch) { ed = k; break; } edRoll -= ch; }
  return { kind: 'joker', id, ed, cost: JOKERS[id].cost + (ed ? EDITIONS[ed].cost : 0), sold: false };
}
/** The shop always offers this many random cards, one ante voucher and this many packs. */
const CARD_SLOTS = 2, PACK_SLOTS = 2;

/** One random card: a Joker, a piece, a square upgrade, or a chalk/tool. */
function genItem() {
  const roll = Math.random();
  if (roll < .45) return genJoker();
  if (roll < .65) { const id = rand(SPECIALS); return { kind: 'piece', id, cost: /** @type {any} */ (PIECES)[id].cost, sold: false }; }
  if (roll < .8) return { kind: 'tile', id: rand(Object.keys(TILES)), cost: 4, sold: false };
  const ids = Object.keys(ITEMS);
  const chalks = ids.filter(i => ITEMS[i].kind === 'chalk'), tools = ids.filter(i => ITEMS[i].kind === 'tool');
  return { kind: 'item', id: Math.random() < .6 ? rand(chalks) : rand(tools), cost: 3, sold: false };
}
function makeShop() {
  S.shop = { items: [], voucher: null, vSold: false, reroll: S.vouchers.includes('coupon') ? 2 : 5, trimmed: false, packs: [] };
  for (let i = 0; i < CARD_SLOTS; i++) S.shop.items.push(genItem());
  const kinds = shuffle(Object.keys(PACKS));
  S.shop.packs = kinds.slice(0, PACK_SLOTS).map(type => ({ type, cost: PACKS[type].cost, sold: false }));
  // One voucher per ante: rolled the first time the ante opens a shop, then it waits
  // in every shop of that ante until it is bought (it is never re-rolled), and once
  // bought there is none until the next ante.
  if (!S.anteVoucher || S.anteVoucher.ante !== S.ante) {
    const vs = Object.keys(VOUCHERS).filter(v => !S.vouchers.includes(v) && (!VOUCHERS[v].req || VOUCHERS[v].req()));
    S.anteVoucher = { ante: S.ante, id: vs.length ? rand(vs) : null, bought: false };
  }
  S.shop.voucher = S.anteVoucher.id; S.shop.vSold = S.anteVoucher.bought;
}
function buy(/** @type {string} */ key) {
  const sh = S.shop;
  if (S.phase !== 'shop' || !sh || S.mode || S.pack) return;
  if (key === 'v') {
    const av = S.anteVoucher;
    if (!av || !av.id || av.bought) return;
    if (S.money < 10) { ui.toast(t('toast.noMoney')); return; }
    S.money -= 10; av.bought = true; sh.vSold = true; S.vouchers.push(av.id); VOUCHERS[av.id].apply(); sfx.win();
    if (av.id === 'board4' || av.id === 'board5') ui.toast(t('toast.board', { n: S.N }));
    settle(); return;
  }
  const it = sh.items[+key.slice(1)];
  if (!it || it.sold) return;
  if (S.money < it.cost) { ui.toast(t('toast.noMoney')); return; }
  if (it.kind === 'joker') {
    if (S.jokers.length >= S.jokerSlots) { ui.toast(t('toast.jokersFull')); return; }
    S.jokers.push({ uid: nid(), id: it.id, ed: it.ed || null, data: {} });
  } else if (it.kind === 'piece') {
    S.bag.push(newPiece(it.id)); ui.toast(t('toast.pieceAdded', { name: tr(/** @type {any} */ (PIECES)[it.id].name) }));
  } else if (it.kind === 'tile') {
    S.mode = 'tile'; S.pending = it.id; sh.tileFrom = key;   // remembered so Cancel can refund this card
  } else {
    if (S.items.length >= S.itemSlots) { ui.toast(t('toast.itemsFull')); return; }
    S.items.push({ uid: nid(), id: it.id });
  }
  S.money -= it.cost; it.sold = true; sfx.money();
  S.mode === 'tile' ? ui.render() : settle();
}
function applyTile(/** @type {string} */ arg) {
  if (S.mode !== 'tile') return;
  const key = rc(+arg).join(',');
  const sq = S.squares[key] || (S.squares[key] = {});
  sq[S.pending] = (sq[S.pending] || 0) + 1;
  ui.toast(t('toast.tileApplied', { name: tr(/** @type {any} */ (TILES)[S.pending].name) }));
  S.mode = null; S.pending = null; S.shop.tileFromPack = false; S.shop.tileFrom = null; sfx.win(); settle();
}
function cancelTile() {
  if (S.mode !== 'tile') return;
  // A tile bought as a shop card is refunded; one picked from a pack is simply dropped.
  if (S.shop.tileFromPack) S.shop.tileFromPack = false;
  else {
    const it = S.shop.tileFrom && S.shop.items[+S.shop.tileFrom.slice(1)];
    if (it) { S.money += it.cost; it.sold = false; }
  }
  S.shop.tileFrom = null;
  S.mode = null; S.pending = null; settle();
}
function trim() {
  const sh = S.shop; if (!sh || sh.trimmed) return;
  if (S.money < 3) { ui.toast(t('toast.noMoney')); return; }
  const k = S.bag.findIndex((/** @type {any} */ p) => p.type === 'plain'); if (k < 0 || S.bag.length <= 5) return;
  S.bag.splice(k, 1); S.money -= 3; sh.trimmed = true; sfx.click(); ui.toast(t('toast.trimmed')); settle();
}
function reroll() {
  const sh = S.shop; if (!sh || S.mode || S.pack) return;
  if (S.money < sh.reroll) { ui.toast(t('toast.noMoney')); return; }
  S.money -= sh.reroll; sh.reroll++; sh.items = [];
  for (let i = 0; i < CARD_SLOTS; i++) sh.items.push(genItem());
  sfx.click(); settle();
}
function nextRound() { if (S.phase !== 'shop' || S.mode || S.pack) return; sfx.click(); S.phase = 'blind'; S.shop = null; settle(); }


/* ---------------- booster packs ---------------- */
/** @param {string} type */
function packOptions(type) {
  const P = PACKS[type];
  if (type === 'joker') { const out = []; for (let i = 0; i < P.show; i++) out.push(genJoker(2.5, out.map(o => o.id))); return out; }
  if (type === 'piece') return shuffle([...SPECIALS]).slice(0, P.show).map(id => ({ kind: 'piece', id }));
  if (type === 'chalk') return shuffle(Object.keys(ITEMS).filter(i => ITEMS[i].kind === 'chalk')).slice(0, P.show).map(id => ({ kind: 'item', id }));
  if (type === 'builder') return shuffle(Object.keys(TILES)).slice(0, P.show).map(id => ({ kind: 'tile', id }));
  if (type === 'forge') return Object.keys(EDITS).map(id => ({ kind: 'edit', id }));
  return shuffle(Object.keys(ITEMS).filter(i => ITEMS[i].kind === 'tool')).slice(0, P.show).map(id => ({ kind: 'item', id }));
}
function buyPack(/** @type {string} */ arg) {
  const sh = S.shop, pk = sh && sh.packs && sh.packs[+arg];
  if (S.phase !== 'shop' || S.mode || S.pack || !pk || pk.sold) return;
  if (S.money < pk.cost) { ui.toast(t('toast.noMoney')); return; }
  S.money -= pk.cost; pk.sold = true; sfx.win();
  const P = PACKS[pk.type];
  // A pack that edits your X shows a random handful of them (by uid, so a reload keeps the same ones).
  const targets = P.targets ? shuffle(S.bag.map((/** @type {any} */ p) => p.uid)).slice(0, P.targets) : null;
  S.pack = { type: pk.type, options: packOptions(pk.type), left: P.choose, targets, armed: null };
  settle();
}
/** Forge Pack: tap an edit to ready it (tap again to put it back), then tap the X it should change. */
function armPack(/** @type {string} */ arg) {
  const pk = S.pack; if (!pk || !pk.targets) return;
  const o = pk.options[+arg]; if (!o || o.taken) return;
  pk.armed = pk.armed === +arg ? null : +arg; sfx.click(); settle();
}
function editPiece(/** @type {string} */ arg) {
  const pk = S.pack; if (!pk || !pk.targets || pk.armed === null || pk.armed === undefined) return;
  const o = pk.options[pk.armed], p = S.bag.find((/** @type {any} */ x) => String(x.uid) === arg);
  if (!o || o.taken || !p) return;
  const P = /** @type {any} */ (PIECES);
  if (o.id === 'smelt') {
    p.type = rand(SPECIALS.filter(k => k !== p.type)); sfx.win();
    ui.toast(t('toast.smelted', { name: tr(P[p.type].name) }));
  } else if (o.id === 'twin') {
    S.bag.push(newPiece(p.type)); sfx.win();
    ui.toast(t('toast.twinned', { name: tr(P[p.type].name) }));
  } else if (o.id === 'scrap') {
    if (S.bag.length <= 5) { ui.toast(t('toast.bagMin')); return; }   // the bag never drops below 5, same as Trim
    S.bag = S.bag.filter((/** @type {any} */ x) => x !== p); S.money += 3; sfx.money();
    ui.toast(t('toast.scrapped'));
  }
  o.taken = true; pk.left--; pk.armed = null;
  if (pk.left <= 0) S.pack = null;
  settle();
}
function takePack(/** @type {string} */ arg) {
  const pk = S.pack; if (!pk) return;
  const o = pk.options[+arg]; if (!o || o.taken || o.kind === 'edit') return;
  if (o.kind === 'joker') {
    if (S.jokers.length >= S.jokerSlots) { ui.toast(t('toast.jokersFull')); return; }
    S.jokers.push({ uid: nid(), id: o.id, ed: o.ed || null, data: {} });
  } else if (o.kind === 'piece') {
    S.bag.push(newPiece(o.id)); ui.toast(t('toast.pieceAdded', { name: tr(/** @type {any} */ (PIECES)[o.id].name) }));
  } else if (o.kind === 'tile') {
    S.pack = null; S.mode = 'tile'; S.pending = o.id; S.shop.tileFromPack = true; sfx.win(); ui.render(); return;
  } else if (ITEMS[o.id].kind === 'chalk') {
    const d = ITEMS[o.id]; S.levels[d.lt]++;
    ui.toast(t('toast.level', { name: tr(/** @type {any} */ (LINE_TYPES)[d.lt].name), n: S.levels[d.lt] }));
  } else {
    if (S.items.length >= S.itemSlots) { ui.toast(t('toast.itemsFull')); return; }
    S.items.push({ uid: nid(), id: o.id });
  }
  o.taken = true; pk.left--; sfx.money();
  if (pk.left <= 0) S.pack = null;
  settle();
}
function skipPack() { if (!S.pack) return; S.pack = null; sfx.click(); settle(); }

/* =================================================================
   Jokers and items in the rack
   ================================================================= */
/** @param {any} j */
export function jokerSellValue(j) { return Math.max(1, Math.floor((JOKERS[j.id].cost + (j.ed && EDITIONS[j.ed] ? EDITIONS[j.ed].cost : 0)) / 2)); }
function sellJoker(/** @type {string} */ uid) {
  if (S.busy) return;
  const j = S.jokers.find((/** @type {any} */ x) => String(x.uid) === uid); if (!j) return;
  S.money += jokerSellValue(j);
  S.jokers = S.jokers.filter((/** @type {any} */ x) => x !== j); sfx.money(); settle();
}
function sellItem(/** @type {string} */ uid) {
  if (S.busy) return;
  S.items = S.items.filter((/** @type {any} */ x) => String(x.uid) !== uid); S.money += 1; sfx.money(); settle();
}
/** Reason an item can't be used right now, or '' if it can. @param {string} uid */
function itemBlocked(uid) {
  const c = S.items.find((/** @type {any} */ x) => String(x.uid) === uid); if (!c) return ' ';
  const d = ITEMS[c.id];
  if (S.busy) return t('why.busy');
  if (d.kind === 'chalk' || d.need === 'any') return '';
  if (S.phase !== 'play') return t('why.round');
  if (S.mode) return t('why.mode');
  if (d.need === 'board') return S.board.some((/** @type {any} */ x) => x && x.t === 'O') ? '' : t('why.noO');
  if (d.need === 'play') return S.g.haste ? t('why.active') : '';
  return '';
}
function useItem(/** @type {string} */ uid) {
  if (itemBlocked(uid)) return;
  const c = S.items.find((/** @type {any} */ x) => String(x.uid) === uid); const d = ITEMS[c.id];
  const drop = () => { S.items = S.items.filter((/** @type {any} */ x) => x !== c); };
  if (d.kind === 'chalk') {
    S.levels[d.lt]++; drop(); sfx.win();
    ui.toast(t('toast.level', { name: tr(/** @type {any} */ (LINE_TYPES)[d.lt].name), n: S.levels[d.lt] }));
  } else if (c.id === 'miser') {
    const g = Math.min(20, S.money); S.money += g; drop(); sfx.money(); ui.toast(t('toast.money', { n: g }));
  } else if (c.id === 'forge') {
    const plains = S.bag.filter((/** @type {any} */ p) => p.type === 'plain');
    if (!plains.length) { ui.toast(t('toast.noPlain')); return; }
    const p = rand(plains); p.type = rand(SPECIALS); drop(); sfx.win();
    ui.toast(t('toast.forged', { name: tr(/** @type {any} */ (PIECES)[p.type].name) }));
  } else if (c.id === 'eraser') {
    S.mode = 'erase'; S.pending = c.uid; ui.render(); return;
  } else if (c.id === 'sprint') {
    S.g.haste = true; drop(); sfx.line(); ui.toast(t('toast.free'));
  }
  settle();
}
function cancelMode() {
  if (S.mode === 'erase') { S.mode = null; S.pending = null; ui.render(); }
  else if (S.mode === 'tile') cancelTile();
}

/* =================================================================
   Run lifecycle and settings
   ================================================================= */
function newRun() { sfx.click(); ui.showModal(null); clearRun(); freshRun(); settle(); }
function continueRun() {
  sfx.click(); ui.showModal(null);
  if (!loadRun()) { freshRun(); }
  settle();
}
function abandon() { clearRun(); S.phase = 'title'; ui.render(); }
function endless() { S.endless = true; S.phase = 'shop'; settle(); }
function toggleSpeed() { SET.speed = SET.speed === 1 ? 2 : SET.speed === 2 ? 4 : 1; saveSettings(); ui.render(); ui.refreshModal(); }
function toggleSound() { SET.sound = !SET.sound; saveSettings(); ui.render(); ui.refreshModal(); sfx.click(); }
function toggleTips() { SET.tips = !SET.tips; saveSettings(); ui.render(); ui.refreshModal(); sfx.click(); }
function replayTips() { ui.replayTips(); ui.render(); ui.refreshModal(); sfx.click(); ui.toast(t('toast.tipsReplay')); }
function toggleCrt() { SET.crt = !SET.crt; saveSettings(); ui.applyCrt(); ui.render(); ui.refreshModal(); sfx.click(); }

export const actions = {
  cell: onCell, selectPiece, discard, startBlind, skipBlind,
  buy, reroll, trim, applyTile, cancelTile, nextRound, cashOut, buyPack, takePack, skipPack, armPack, editPiece,
  sellJoker, sellItem, useItem, itemBlocked, cancelMode,
  newRun, continueRun, abandon, endless, toggleSpeed, toggleSound, toggleCrt, toggleTips, replayTips,
};
