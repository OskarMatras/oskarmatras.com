// Plays scripted games on the web game's own engine (../js, run under
// node with a seeded RNG and no browser) and records, after every action, a
// digest of the whole run state. tests/lua_replay.lua replays the same actions
// on the Lua port and records its digests; tests/compare.js diffs the two.
//
// Usage: node tests/gen_trace.js <seed> [maxSteps] [outFile]
import fs from 'node:fs';
import path from 'node:path';

const seed = +(process.argv[2] ?? 1);
const maxSteps = +(process.argv[3] ?? 500);
const outFile = process.argv[4] ?? path.join(import.meta.dirname, 'out', `js_${seed}.json`);

// ---- deterministic environment -------------------------------------------
// xorshift32, identical to src/rng.lua
let rx = (seed | 0) || 1;
Math.random = () => {
  rx ^= rx << 13; rx ^= rx >>> 17; rx ^= rx << 5;
  return (rx >>> 0) / 4294967296;
};
globalThis.setTimeout = (fn) => { queueMicrotask(fn); return 0; };

const { S, snapshot, nid } = await import('../../js/state.js');
const { freshRun, newPiece, blindInfo, lineValues } = await import('../../js/rules.js');
const { actions } = await import('../../js/engine.js');
const D = await import('../../js/data.js');
const { geo } = await import('../../js/geometry.js');
const { setLang } = await import('../../js/strings.js');
setLang('en');

// ---- policy RNG (separate from the game's) --------------------------------
let ps = (seed * 7919 + 17) >>> 0;
const pr = () => { ps = (ps * 1664525 + 1013904223) % 4294967296; return ps / 4294967296; };
const pick = a => a[Math.floor(pr() * a.length)];

// ---- digest ---------------------------------------------------------------
function strip(v) {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) { if (k === 'fresh' || k === 'dealt') continue; o[k] = strip(v[k]); }
    return o;
  }
  return v;
}
const digest = () => { const s = snapshot(); return strip(JSON.parse(JSON.stringify(s))); };

// ---- setup (cheats that put interesting states on the table) -------------
function makeSetup() {
  const sp = {};
  sp.ante = pick([1, 1, 2, 3, 4, 5, 6, 8, 9, 10]);
  sp.money = pick([4, 20, 60, 150, 400]);
  if (pr() < 0.5) sp.N = pick([3, 4, 5]);
  const nj = Math.floor(pr() * 6);
  sp.jokers = [];
  const ids = Object.keys(D.JOKERS);
  for (let i = 0; i < nj; i++) sp.jokers.push({ id: pick(ids), ed: pick([null, null, null, 'foil', 'holo', 'poly']) });
  sp.bag = [];
  const nb = Math.floor(pr() * 8);
  for (let i = 0; i < nb; i++) sp.bag.push(pick(D.SPECIALS));
  sp.items = [];
  if (pr() < 0.4) sp.items.push(pick(Object.keys(D.ITEMS)));
  sp.squares = {};
  const N = sp.N || 3;
  const nsq = Math.floor(pr() * 4);
  for (let i = 0; i < nsq; i++) {
    const key = `${Math.floor(pr() * N)},${Math.floor(pr() * N)}`;
    sp.squares[key] = sp.squares[key] || {};
    const tk = pick(Object.keys(D.TILES));
    sp.squares[key][tk] = 1 + Math.floor(pr() * 2);
  }
  sp.levels = { row: 1 + Math.floor(pr() * 4), col: 1 + Math.floor(pr() * 3), diag: 1 + Math.floor(pr() * 3), draw: 1 + Math.floor(pr() * 3) };
  sp.boss = pr() < 0.7 ? pick(Object.keys(D.BOSSES)) : null;
  sp.jokerSlots = 9; sp.itemSlots = 3; sp.handSize = pick([3, 3, 4]);
  return sp;
}
function applySetup(sp) {
  S.ante = sp.ante; S.money = sp.money;
  if (sp.N) S.N = sp.N;
  S.board = Array(S.N * S.N).fill(null);
  for (const j of sp.jokers) S.jokers.push({ uid: nid(), id: j.id, ed: j.ed || null, data: {} });
  for (const ty of sp.bag) S.bag.push(newPiece(ty));
  for (const id of sp.items) S.items.push({ uid: nid(), id });
  Object.assign(S.squares, JSON.parse(JSON.stringify(sp.squares)));
  Object.assign(S.levels, sp.levels);
  if (sp.boss) { S.boss = { id: sp.boss }; S.usedBosses.push(sp.boss); }
  S.jokerSlots = sp.jokerSlots; S.itemSlots = sp.itemSlots; S.handSize = sp.handSize;
}

// ---- policy ---------------------------------------------------------------
const steps = [];
let setupDone = false;
function nextAction() {
  const P = S.phase;
  if (P === 'title') return ['newRun', null];
  if (P === 'over') return ['newRun', null];
  if (P === 'won') return ['endless', null];
  if (P === 'blind') {
    if (S.ante === 1 && S.blindIdx === 0 && S.money === 4 && !setupDone && S.jokers.length === 0) {
      setupDone = true;
      if (pr() < 0.7) return ['setup', makeSetup()];
    }
    if (S.blindIdx < 2 && pr() < 0.12) return ['skipBlind', null];
    return ['startBlind', null];
  }
  if (P === 'cashout') return ['cashOut', null];
  if (P === 'play') {
    if (S.mode === 'erase') {
      const os = S.board.map((c, i) => (c && c.t === 'O') ? i : -1).filter(i => i >= 0);
      if (os.length && pr() > 0.1) return ['cell', String(pick(os))];
      return ['cancelMode', null];
    }
    // items
    if (S.items.length && pr() < 0.25) {
      const c = pick(S.items);
      const why = actions.itemBlocked(String(c.uid));
      return ['useItem', String(c.uid), why];
    }
    if (S.items.length && pr() < 0.04) return ['sellItem', String(pick(S.items).uid)];
    if (S.jokers.length && pr() < 0.02) return ['sellJoker', String(pick(S.jokers).uid)];
    const noSpecials = S.hand.every(p => p.type === 'plain') && S.g.pile.every(p => p.type === 'plain');
    if (S.hand.length && S.round.discards && !noSpecials && pr() < 0.15) return ['discard', null];
    // choose a piece
    if (pr() < 0.45 && S.hand.length > 1) {
      const k = Math.floor(pr() * S.hand.length);
      if (k !== S.selIdx) return ['selectPiece', String(k)];
    }
    const sp = S.hand.findIndex(p => p.type !== 'plain');
    if (sp >= 0 && sp !== S.selIdx && pr() < 0.6) return ['selectPiece', String(sp)];
    // choose a cell
    const E = S.board.map((c, i) => c ? -1 : i).filter(i => i >= 0);
    if (!E.length) return ['discard', null];
    const G = geo();
    const wins = [];
    G.lines.forEach((l, li) => {
      const xs = l.cells.filter(i => S.board[i] && S.board[i].t === 'X').length;
      const em = l.cells.filter(i => !S.board[i]);
      if (xs === 2 && em.length === 1 && !S.g.scored.includes(li)) wins.push(em[0]);
    });
    if (wins.length && pr() < 0.8) return ['cell', String(pick(wins))];
    return ['cell', String(pick(E))];
  }
  if (P === 'shop') {
    if (S.mode === 'tile') {
      if (pr() < 0.1) return ['cancelTile', null];
      return ['applyTile', String(Math.floor(pr() * S.N * S.N))];
    }
    if (S.pack) {
      const opts = S.pack.options.map((o, i) => o.taken ? -1 : i).filter(i => i >= 0);
      if (!opts.length || pr() < 0.1) return ['skipPack', null];
      return ['takePack', String(pick(opts))];
    }
    const sh = S.shop;
    const cands = [];
    sh.items.forEach((it, i) => { if (!it.sold && S.money >= it.cost) cands.push(['buy', 'i' + i]); });
    if (!sh.tile.sold && S.money >= sh.tile.cost) cands.push(['buy', 't']);
    if (sh.voucher && !sh.vSold && S.money >= 10) cands.push(['buy', 'v']);
    sh.packs.forEach((pk, i) => { if (!pk.sold && S.money >= pk.cost) cands.push(['buyPack', String(i)]); });
    if (S.money >= sh.reroll && pr() < 0.5) cands.push(['reroll', null]);
    if (!sh.trimmed && S.money >= 3) cands.push(['trim', null]);
    if (S.jokers.length >= S.jokerSlots && pr() < 0.5) cands.push(['sellJoker', String(pick(S.jokers).uid)]);
    if (S.items.length && pr() < 0.2) cands.push(['useItem', String(pick(S.items).uid)]);
    if (!cands.length || pr() < 0.2) return ['nextRound', null];
    return pick(cands);
  }
  return null;
}

async function run(act, arg) {
  if (act === 'setup') { applySetup(arg); return; }
  const r = actions[act](arg);
  await r;
  await new Promise(res => setImmediate(res));
  for (let k = 0; k < 100 && S.busy; k++) await new Promise(res => setImmediate(res));
}

// ---- units: pure functions compared directly -----------------------------
function units() {
  const u = { blind: [], values: [], geo: [] };
  freshRun();
  for (const boss of Object.keys(D.BOSSES)) {
    for (let a = 1; a <= 12; a++) {
      S.ante = a; S.boss = { id: boss };
      for (let idx = 0; idx < 3; idx++) { const b = blindInfo(idx); u.blind.push([boss, a, idx, b.target, b.reward, b.name, b.desc]); }
    }
  }
  S.ante = 1;
  for (const ty of D.LINE_ORDER) for (let l = 1; l <= 8; l++) { S.levels[ty] = l; const v = lineValues(ty); u.values.push([ty, l, v.chips, v.mult]); }
  for (const N of [3, 4, 5]) {
    S.N = N; const g = geo();
    u.geo.push([N, g.lines.length, g.lines.map(l => [l.type, l.dr, l.dc, ...l.cells]), g.through]);
  }
  return u;
}

// ---- go -------------------------------------------------------------------
freshRun(); S.phase = 'title';
const u = units();
freshRun(); S.phase = 'title';
let err = null;
for (let n = 0; n < maxSteps; n++) {
  const a = nextAction();
  if (!a) break;
  const [act, arg, why] = a;
  if (act === 'useItem' && why) { n--; continue; } // only record usable items
  try { await run(act, arg); } catch (e) { err = String(e.stack || e); break; }
  steps.push({ act, arg: act === 'setup' ? arg : (arg ?? null), d: digest() });
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ seed, units: u, steps, err }));
console.log(`js seed ${seed}: ${steps.length} steps${err ? ' ERROR ' + err.split('\n')[0] : ''}`);
