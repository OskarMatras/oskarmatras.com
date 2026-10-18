// Headless bot: plays whole runs of the real engine (UI and sound stubbed by hooks.mjs).
import './register.mjs';
const G = new URL('../js/', import.meta.url).href;
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
globalThis.window = globalThis;
globalThis.setTimeout = (f) => { queueMicrotask(f); return 0; };
const { S, SET } = await import(G + 'state.js');
const E = await import(G + 'engine.js');
const D = await import(G + 'data.js');
const R = await import(G + 'rules.js');
const GEO = await import(G + 'geometry.js');
export { S, SET, E, D, R, GEO };
const A = E.actions;

/* seeded rng so a bad run can be replayed */
export function seed(n) {
  let a = n >>> 0;
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const PV = { sprout: 4, cursed: 6, turncoat: 4, hunter: 3, plain: 1, red: 3, blue: 3, gold: 3, lucky: 3, glass: 6, steel: 3, bomb: 3, ghost: 3, mirror: 3, twin: 4 };
const cellsOfLine = l => l.cells.map(i => S.board[i]);

function lineInfo() {
  const L = GEO.geo().lines;
  const myThreat = new Set(), oWin = new Set();
  L.forEach((l, li) => {
    const cs = cellsOfLine(l);
    const nx = cs.filter(c => c && c.t === 'X').length, no = cs.filter(c => c && c.t === 'O').length, ne = cs.filter(c => !c).length;
    if (no === 2 && ne === 1) oWin.add(l.cells.find(i => !S.board[i]));
    if (nx === 2 && ne === 1 && !S.g.scored.includes(li)) myThreat.add(l.cells.find(i => !S.board[i]));
  });
  return { myThreat, oWin };
}

function chooseMove(skill = 1) {
  const L = GEO.geo().lines, through = GEO.geo().through;
  const { myThreat, oWin } = lineInfo();
  let best = null, bestV = -1e9;
  const empties = R.emptyCells();
  const haveFree = S.g.haste || (D.hasJ('doubletap') && S.g.placements === 0);
  for (let k = 0; k < S.hand.length; k++) {
    const p = S.hand[k];
    for (const i of empties) {
      let v = through[i] * 0.4 + Math.random() * 0.3;
      const free = haveFree || p.type === 'ghost';
      let completes = 0, builds = 0;
      L.forEach((l, li) => {
        if (!l.cells.includes(i) || S.g.scored.includes(li)) return;
        const cs = cellsOfLine(l);
        if (cs.some(c => c && (c.t === 'O' || c.t === 'S'))) return;
        const nx = cs.filter(c => c && c.t === 'X').length;
        if (nx === 2) completes++;
        else if (nx === 1) builds++;
      });
      if (completes) v += 100 * completes + (PV[p.type] || 2) * 2;
      v += builds * 3;
      if (builds >= 2) v += 4;
      if (!completes) v -= (PV[p.type] || 2) * 0.5 * (skill ? 1 : 0);
      if (p.type === 'bomb' && GEO.neighbours(i).some(n => S.board[n] && S.board[n].t === 'O')) v += 6;
      if (p.type === 'mirror' && !S.board[GEO.mirrorOf(i)]) v += 4;
      if (p.type === 'steel') v -= 2;
      if (p.type === 'ghost') v += 2;
      if (oWin.size) {
        if (oWin.has(i)) v += (free ? 5 : 90);
        else if (!free && !completes) v -= 200;
      }
      if (myThreat.has(i) && !completes) v += 1;
      if (v > bestV) { bestV = v; best = { k, i }; }
    }
  }
  return best;
}

async function playRound(stats, opt) {
  A.startBlind();
  let guard = 0;
  while (S.phase === 'play') {
    if (++guard > 3000) { stats.stalls++; stats.stallInfo = { ante: S.ante, blind: S.blindIdx, boardN: S.N, hand: S.hand.length, busy: S.busy, mode: S.mode }; return 'stall'; }
    if (S.busy) { await Promise.resolve(); continue; }
    if (S.items.length) {
      const { oWin } = lineInfo();
      for (const it of [...S.items]) {
        const d = D.ITEMS[it.id];
        if (d.kind === 'chalk' || it.id === 'miser' || it.id === 'forge') { A.useItem(String(it.uid)); continue; }
        if (it.id === 'eraser' && oWin.size && !S.mode) {
          A.useItem(String(it.uid));
          const o = S.board.findIndex((c, i) => c && c.t === 'O' && GEO.geo().lines.some(l => l.cells.includes(i) && l.cells.filter(j => S.board[j] && S.board[j].t === 'O').length === 2));
          if (S.mode === 'erase') await A.cell(String(o >= 0 ? o : S.board.findIndex(c => c && c.t === 'O')));
          continue;
        }
        if (it.id === 'sprint' && !S.g.haste && S.hand.length && R.threats().length) { A.useItem(String(it.uid)); continue; }
      }
    }
    if (S.phase !== 'play') break;
    if (S.round.discards > 0 && opt.discard !== false && S.g.placements === 0) {
      const plainIdx = S.hand.findIndex(p => p.type === 'plain');
      const specialsLeft = S.g.pile.some(p => p.type !== 'plain');
      const perGame = S.round.discards / Math.max(1, S.round.games);
      if (plainIdx >= 0 && specialsLeft && stats._dg < Math.ceil(perGame)) { A.selectPiece(String(plainIdx)); A.discard(); stats._dg++; continue; }
    }
    if (!S.hand.length) { stats.stalls++; stats.stallInfo = { why: 'empty hand' }; return 'stall'; }
    const m = chooseMove(opt.skill ?? 1);
    if (!m) { stats.stalls++; stats.stallInfo = { why: 'no move' }; return 'stall'; }
    const before = S.round && S.round.gameNo;
    A.selectPiece(String(m.k));
    await A.cell(String(m.i));
    if (S.round && S.round.gameNo !== before) stats._dg = 0;
  }
  return S.phase;
}

/* ---- shopping ---- */
const jokerScore = id => { const j = D.JOKERS[id]; return j.rar * 2 + j.cost * 0.2; };
const isUseNow = c => D.ITEMS[c.id].kind === 'chalk' || c.id === 'miser' || c.id === 'forge';

function resolveMode() {
  if (S.mode === 'tile') {
    const cells = [...Array(S.N * S.N).keys()];
    cells.sort((a, b) => GEO.geo().through[b] - GEO.geo().through[a]);
    A.applyTile(String(cells[0]));
  }
}
function openPack() {
  let guard = 0;
  while (S.pack && guard++ < 10) {
    const pk = S.pack;
    if (pk.targets) {
      const o = pk.options.findIndex(o => !o.taken && o.id === 'smelt');
      const plain = S.bag.find(p => pk.targets.includes(p.uid) && p.type === 'plain');
      if (o >= 0 && plain) { A.armPack(String(o)); A.editPiece(String(plain.uid)); continue; }
      const tw = pk.options.findIndex(o => !o.taken && o.id === 'twin');
      const sp = S.bag.find(p => pk.targets.includes(p.uid) && p.type !== 'plain');
      if (tw >= 0 && sp) { A.armPack(String(tw)); A.editPiece(String(sp.uid)); continue; }
      A.skipPack(); break;
    }
    let bestI = -1, bestV = -1;
    pk.options.forEach((o, i) => {
      if (o.taken) return;
      let v = 1;
      if (o.kind === 'joker') v = S.jokers.length >= R.jokerSlots() ? -1 : 10 + jokerScore(o.id) + (o.ed ? 2 : 0);
      else if (o.kind === 'piece') v = 5 + (PV[o.id] || 3);
      else if (o.kind === 'tile') v = 6;
      else if (o.kind === 'item') v = D.ITEMS[o.id].kind === 'chalk' ? 7 : (S.items.length >= S.itemSlots ? -1 : 4);
      if (v > bestV) { bestV = v; bestI = i; }
    });
    if (bestI < 0 || bestV < 0) { A.skipPack(); break; }
    A.takePack(String(bestI));
    resolveMode();
  }
  if (S.pack) A.skipPack();
}
const PACK_ORDER = { joker: 0, chalk: 1, forge: 2, builder: 3, piece: 4, tool: 5 };
function shop(stats, opt) {
  const reserve = opt.reserve ?? 0;
  let guard = 0, rerolls = 0;
  while (S.phase === 'shop' && guard++ < 60) {
    if (S.mode) { resolveMode(); continue; }
    if (S.pack) { openPack(); continue; }
    const sh = S.shop; let acted = false;
    if (!sh.vSold && sh.voucher && S.money >= 10) {
      const before = S.money; A.buy('v');
      if (S.money < before) { stats.vouchers.push(sh.voucher); continue; }
    }
    const order = sh.items.map((it, i) => ({ it, i })).filter(x => !x.it.sold).sort((a, b) => {
      const sc = x => x.it.kind === 'joker' ? 30 + jokerScore(x.it.id) : x.it.kind === 'item' && D.ITEMS[x.it.id].kind === 'chalk' ? 20 : x.it.kind === 'piece' ? 12 : x.it.kind === 'tile' ? 14 : 5;
      return sc(b) - sc(a);
    });
    for (const { it, i } of order) {
      if (S.money - it.cost < (it.kind === 'joker' ? 0 : reserve)) continue;
      if (it.kind === 'joker' && S.jokers.length >= R.jokerSlots()) {
        const worst = [...S.jokers].sort((a, b) => jokerScore(a.id) - jokerScore(b.id))[0];
        if (jokerScore(it.id) > jokerScore(worst.id) + 2 && S.money >= it.cost) A.sellJoker(String(worst.uid)); else continue;
      }
      if (it.kind === 'item' && S.items.length >= S.itemSlots) continue;
      const before = S.money; A.buy('c' + i);
      if (S.money < before) { acted = true; stats.bought.push(it.id); break; }
    }
    if (acted) { for (const c of [...S.items]) if (isUseNow(c)) A.useItem(String(c.uid)); continue; }
    const pks = sh.packs.map((p, i) => ({ p, i })).filter(x => !x.p.sold).sort((a, b) => PACK_ORDER[a.p.type] - PACK_ORDER[b.p.type]);
    for (const { p, i } of pks) {
      if (p.type === 'joker' && S.jokers.length >= R.jokerSlots()) continue;
      if (S.money - p.cost < (p.type === 'joker' ? 0 : reserve)) continue;
      const before = S.money; A.buyPack(String(i));
      if (S.money < before) { acted = true; stats.packs.push(p.type); break; }
    }
    if (acted) continue;
    if (S.money >= sh.reroll + 8 + reserve && rerolls < 2) { rerolls++; A.reroll(); continue; }
    break;
  }
  for (const c of [...S.items]) if (isUseNow(c)) A.useItem(String(c.uid));
  if (S.phase === 'shop') A.nextRound();
}

export async function runOne(opt = {}) {
  seed(opt.seed ?? 1);
  SET.speed = 1; SET.sound = false;
  R.freshRun(opt.deck);
  if (opt.setup) opt.setup();
  const stats = { seed: opt.seed, ante: 0, blind: 0, stalls: 0, bought: [], packs: [], vouchers: [], cause: '', scoreFrac: 0, _dg: 0, wonRun: false, jokersAtEnd: [] };
  let loops = 0;
  while (loops++ < 300) {
    if (S.phase === 'blind' || S.phase === 'play') { const r = await playRound(stats, opt); if (r === 'stall') break; continue; }
    if (S.phase === 'cashout') { A.cashOut(); continue; }
    if (S.phase === 'shop') { shop(stats, opt); continue; }
    if (S.phase === 'won') { stats.wonRun = true; break; }
    break;
  }
  stats.ante = S.ante; stats.blind = S.blindIdx;
  if (S.phase === 'over') { stats.cause = 'died'; stats.scoreFrac = S.round ? S.round.score / S.round.target : 0; stats.boss = S.blindIdx === 2 ? S.boss.id : ''; }
  stats.jokersAtEnd = S.jokers.map(j => j.id);
  stats.bestLine = S.stats ? S.stats.bestLine : 0; stats.money = S.money; stats.N = S.N;
  stats.bagSpecials = S.bag.filter(p => p.type !== 'plain').length;
  stats.levels = { ...S.levels };
  return stats;
}

export function summarize(res) {
  const n = res.length, byBlind = {};
  for (const r of res) { const k = `${r.ante}.${r.blind}`; byBlind[k] = (byBlind[k] || 0) + 1; }
  return {
    runs: n, won: res.filter(r => r.wonRun).length, stalls: res.filter(r => r.stalls).length,
    avgAnte: +(res.reduce((s, r) => s + r.ante, 0) / n).toFixed(2), deaths: byBlind,
  };
}

if (process.argv[1] && process.argv[1].endsWith('bot.mjs')) {
  const n = +(process.argv[2] || 50); const opt = JSON.parse(process.argv[3] || '{}');
  const res = [];
  for (let s = 1; s <= n; s++) res.push(await runOne({ ...opt, seed: s }));
  console.log(JSON.stringify(summarize(res)));
  const st = res.find(r => r.stalls);
  if (st) console.log('stall sample', JSON.stringify(st));
}
