// @ts-check
/**
 * Everything that touches the DOM.
 *
 * Rendering is plain template strings into four containers (ledger, rack,
 * stage, overlay). The game is turn based, so re-rendering a panel on
 * each change is cheap and keeps the state the single source of truth.
 *
 * Input uses one delegated listener: any element with data-act="name"
 * (and optional data-arg) calls actions[name](arg). The engine registers
 * those actions through bind(), so this module never imports the engine.
 *
 * The scoring animation calls the fx helpers at the bottom (pop, setCalc,
 * banner, ...) which update only the elements they touch.
 */
import { S, SET, best, hasSavedRun } from './state.js';
import { geo, squareOf } from './geometry.js';
import { LINE_TYPES, LINE_ORDER, PIECES, TILES, RARITY, JOKERS, ITEMS, VOUCHERS, BOSSES, EDITIONS, EDITS, PACKS, hasJ } from './data.js';
import { sync as syncCoach, ollie } from './coach.js';
import * as fx from './fx.js';
import { punch } from './cardfx.js';
import { blindInfo, lineValues, handMax } from './rules.js';
import { t, tr, fmt, fmtM, getLang } from './strings.js';
import { sfx } from './audio.js';

/** @type {Record<string, (arg?: string) => any>} */
let actions = {};
/** @param {Record<string, (arg?: string) => any>} a */
export function bind(a) { actions = a; }

const $ = (/** @type {string} */ s) => /** @type {HTMLElement|null} */ (document.querySelector(s));
const el = {
  side: /** @type {HTMLElement} */ ($('#side')), rack: /** @type {HTMLElement} */ ($('#rack')),
  stage: /** @type {HTMLElement} */ ($('#stage')), overlay: /** @type {HTMLElement} */ ($('#overlay')),
  insp: /** @type {HTMLElement} */ ($('#insp')), toast: /** @type {HTMLElement} */ ($('#toast')),
};
const esc = (/** @type {string} */ s) => String(s).replace(/[&<>"]/g, c => (/** @type {any} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }))[c]);

/** Modal currently open on top of the phase screen ('info' | 'bag' | null). */
let modal = /** @type {string|null} */ (null);
let abandonArmed = false;

/* =================================================================
   Rendering
   ================================================================= */
export function render() {
  document.body.dataset.phase = S.phase;
  if (tipFor && !document.body.contains(tipFor)) hideTip();
  renderSide(); renderRack(); renderStage(); renderOverlay();
  syncCoach();   // the tutorial reads the game state and shows, moves or retires a tip
}
export { replay as replayTips } from './coach.js';

function renderSide() {
  const inPlay = S.phase === 'play' && S.round;
  let tag;
  if (inPlay) {
    const b = blindInfo(S.blindIdx);
    tag = `<div class="blindTag" style="--bc:${b.color}"><div class="bname">${esc(b.name)}</div><div class="bdesc">${esc(b.desc)}</div>
      <div class="btarget"><span>${t('ui.scoreAtLeast')}</span><b>${fmt(S.round.target)}</b><span class="rew">${'$'.repeat(b.reward)}</span></div></div>`;
  } else if (S.phase === 'shop' || S.phase === 'cashout' || S.phase === 'won') {
    tag = `<div class="blindTag" style="--bc:var(--voucher)"><div class="bname">${t('ui.shop')}</div><div class="bdesc">${t('ui.shopDesc')}</div>
      <div class="btarget"><span>${t('ui.nextUp')}</span><b class="plain">${esc(blindInfo(S.blindIdx).name)}</b></div></div>`;
  } else {
    tag = `<div class="blindTag" style="--bc:var(--panel-3)"><div class="bname">${t('ui.chooseBlind')}</div><div class="bdesc">${t('ui.anteN', { n: S.ante })}</div>
      <div class="btarget"><span>${t('ui.nextTarget')}</span><b>${fmt(blindInfo(S.blindIdx).target)}</b></div></div>`;
  }
  const r = S.round || {};
  el.side.innerHTML = `${tag}
    <div class="roundScore"><span>${t('ui.roundScore')}</span><b id="rs">${fmt(inPlay ? r.score : 0)}</b></div>
    <div class="calc"><div id="hname" class="hname">&nbsp;</div>
      <div class="cm"><div id="chips" class="chipsBox">0</div><span class="x">X</span><div id="mult" class="multBox">0</div></div></div>
    <div class="stat games"><span>${t('ui.games')}</span><b>${inPlay ? r.games : S.maxGames}</b></div>
    <div class="stat disc"><span>${t('ui.discards')}</span><b>${inPlay ? r.discards : S.maxDiscards}</b></div>
    <div class="moneyBox" id="money">$${S.money}</div>
    <div class="stat ante"><span>${t('ui.ante')}</span><b>${S.ante}<small>/8</small></b></div>
    <div class="stat rnd"><span>${t('ui.round')}</span><b>${(S.ante - 1) * 3 + S.blindIdx + 1}</b></div>
    <div class="sideBtns">
      <button class="btn red" data-act="openInfo">${t('ui.runInfo')}</button>
      <button class="btn" data-act="openBag">${t('ui.bag')}</button>
      <button class="btn opt" data-act="toggleSpeed">${t('ui.speed', { n: SET.speed })}</button>
      <button class="btn opt" data-act="toggleSound" aria-pressed="${SET.sound}">${SET.sound ? t('ui.soundOn') : t('ui.soundOff')}</button>
      <button class="btn opt" data-act="toggleCrt" aria-pressed="${SET.crt}">${SET.crt ? t('ui.crtOn') : t('ui.crtOff')}</button>
    </div>`;
}

function renderRack() {
  const js = S.jokers.map((/** @type {any} */ j) => {
    const d = JOKERS[j.id];
    return `<button class="joker${j.ed ? ' ed-' + j.ed : ''}" style="--jc:${RARITY[d.rar].color}" data-tilt="j${j.uid}" data-tip="joker:${j.uid}" data-act="inspectJoker" data-arg="${j.uid}" data-joker="${j.uid}" aria-label="${esc(d.name)}${j.ed ? ' (' + esc(tr(EDITIONS[j.ed].name)) + ')' : ''}">
      <span class="gl">${d.gl}</span><span class="nm">${esc(d.name)}</span>${d.val ? `<span class="val">${d.val(j)}</span>` : ''}</button>`;
  }).join('');
  const its = S.items.map((/** @type {any} */ c) => {
    const d = ITEMS[c.id];
    return `<button class="cons" style="--cc:${d.kind === 'chalk' ? 'var(--chalk)' : 'var(--tool)'}" data-tilt="c${c.uid}" data-tip="item:${c.uid}" data-act="inspectItem" data-arg="${c.uid}" data-item="${c.uid}" aria-label="${esc(tr(d.name))}">
      <span class="gl">${d.gl}</span><span class="nm">${esc(tr(d.name))}</span></button>`;
  }).join('');
  el.rack.innerHTML = `<div class="tray jokers"><div class="lbl"><span>${t('ui.jokers')}</span><span>${S.jokers.length}/${S.jokerSlots}</span></div>
      <div class="slots">${js || `<div class="empty">${t('ui.noJokers')}</div>`}</div></div>
    <div class="tray items"><div class="lbl"><span>${t('ui.items')}</span><span>${S.items.length}/${S.itemSlots}</span></div><div class="slots">${its}</div></div>`;
}

function renderStage() {
  if (S.phase === 'play') return renderPlay();
  // An open pack is its own scene: the shop steps out of the way, but the Joker and item
  // trays above stay live, so you can sell something to make room for what you pick.
  if (S.phase === 'shop' && S.pack) return renderPackScene();
  if (S.phase === 'shop' || S.phase === 'cashout' || S.phase === 'won') return renderShop();
  return renderBlinds();
}

/** @param {any} p @param {string} [extra] */
function pieceHTML(p, extra = '') {
  const P = /** @type {any} */ (PIECES)[p.type];
  const label = tr(P.short);
  return `<span class="piece t-${p.type}${extra}" style="--pc:${P.pc}"><span class="xg">X</span>${label ? `<span class="pl">${label}</span>` : ''}</span>`;
}
/** @param {number} i */
function tilesHTML(i) {
  const s = squareOf(i);
  const b = Object.keys(TILES).filter(k => s[k]).map(k => `<span class="tb ${k}">${/** @type {any} */ (TILES)[k].badge(s[k])}</span>`).join('');
  return b ? `<span class="tiles">${b}</span>` : '';
}
/** @param {string} id @param {any[]} board @param {string} act */
/** Pieces placed since the board was last drawn: renderPlay() drops them in with an impact once they are on screen. */
let justPlaced = /** @type {{ i: number, kind: 'x'|'o' }[]} */ ([]);
function boardHTML(id, board, act) {
  const N = S.N;
  const cells = board.map((c, i) => {
    let inner = '', cls = 'empty';
    if (c) {
      if (c.t === 'X') { cls = 'x'; inner = pieceHTML(c.p, c.shattered ? ' shattered' : ''); }
      else if (c.t === 'O') { cls = 'o'; inner = `<span class="oMark"></span>`; }
      else { cls = 's'; inner = `<span class="stone">${t('stone')}</span>`; }
      if (c.fresh && id === 'board' && (c.t === 'X' || c.t === 'O')) justPlaced.push({ i, kind: c.t === 'O' ? 'o' : 'x' });
      c.fresh = false;
    }
    const up = Object.keys(squareOf(i)).length ? ' up' : '';
    const tip = c && c.t === 'X' && act === 'cell' ? ` data-tip="piece:${c.p.type}"` : '';
    return `<button class="cell ${cls}"${tip} data-act="${act}" data-arg="${i}" data-cell="${i}" aria-label="${t('aria.square', { n: i + 1 })}"><span class="slot${up}">${tilesHTML(i)}${inner}</span></button>`;
  }).join('');
  return `<div class="board" id="${id}" role="grid" aria-label="${t('aria.board')}" style="--n:${N}">${cells}</div>`;
}

function renderPlay() {
  const armed = !S.busy && !S.mode && S.hand.length;
  const G = geo();
  const strikes = S.g.scored.map((/** @type {number} */ li) => {
    const l = G.lines[li];
    const p = (/** @type {number} */ i) => [(i % S.N) + .5, Math.floor(i / S.N) + .5];
    const [x1, y1] = p(l.cells[0]), [x2, y2] = p(l.cells[2]);
    const dx = (x2 - x1) * .12, dy = (y2 - y1) * .12;
    return `<line x1="${x1 - dx}" y1="${y1 - dy}" x2="${x2 + dx}" y2="${y2 + dy}"/>`;
  }).join('');
  const allPlain = S.hand.every((/** @type {any} */ p) => p.type === 'plain');
  const noSpecials = allPlain && S.g.pile.every((/** @type {any} */ p) => p.type === 'plain');
  const hand = S.hand.map((/** @type {any} */ p, /** @type {number} */ k) =>
    `<button class="hp${k === S.selIdx ? ' sel' : ''}${p.dealt ? ' deal' : ''}" style="--k:${k};--fan:${(k - (S.hand.length - 1) / 2).toFixed(2)}" data-tilt="h${p.uid}-${k}" data-tip="piece:${p.type}" data-act="selectPiece" data-arg="${k}" aria-pressed="${k === S.selIdx}" aria-label="${esc(tr(/** @type {any} */ (PIECES)[p.type].name))}">${pieceHTML(p)}</button>`).join('');
  S.hand.forEach((/** @type {any} */ p, /** @type {number} */ k) => { if (p.dealt) setTimeout(() => sfx.deal(k), k * 70 / speedK()); p.dealt = false; });
  // Instructions float over the board instead of sitting in the layout, so nothing below it moves.
  const modeBar = S.mode === 'erase'
    ? `<div class="modeBar" role="status">${t('hint.erase')} <button class="btn small" data-act="cancelMode">${t('btn.cancel')}</button></div>` : '';
  el.stage.innerHTML = `<div class="playArea">
    <div class="boardArea"><div class="boardWrap${armed ? ' armed' : ''}${S.mode === 'erase' ? ' erasing' : ''}" id="bw">
      ${boardHTML('board', S.board, 'cell')}
      <svg id="strikes" viewBox="0 0 ${S.N} ${S.N}" preserveAspectRatio="none" aria-hidden="true">${strikes}</svg>${modeBar}</div></div>
    <div class="handMeta"><span>${t('meta.game', { n: S.round.gameNo, m: S.round.gameNo + S.round.games - 1 })}</span>
      <span>${hasJ('overtime') ? t('meta.overtime') : t('meta.firstLine')}</span><span>${t('meta.bag', { n: S.g.pile.length })}</span></div>
    <div class="handRow"><div id="hand">${hand}</div>
      <button class="btn red" data-act="discard" ${(!S.hand.length || !S.round.discards || S.busy || S.mode || noSpecials) ? 'disabled' : ''}>${t('btn.discard')}</button></div>
  </div>`;
  const placed = justPlaced; justPlaced = [];
  placed.forEach(p => impact(p.i, p.kind));
  if (S.growAnim) scheduleGrow();
}

/* ---------------- the board grows ----------------
 * The first time a bigger board is drawn, the board stretches into place and the new squares
 * pop in outward from the old ones. It waits a beat for the screen to settle (starting a game
 * redraws several times), plays once, and is skipped for anyone who asked for reduced motion. */
let growTimer = /** @type {any} */ (null);
function scheduleGrow() {
  if (growTimer) return;
  growTimer = setTimeout(() => { growTimer = null; playGrow(); }, 320);
}
function playGrow() {
  const g = S.growAnim;
  if (!g || S.phase !== 'play') return;
  S.growAnim = null;   // once only: later renders (a move, a discard) must not replay it
  banner(t('banner.grow', { n: g.to }));
  sfx.win();
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bw = $('#bw'); if (!bw || !bw.animate) return;
  bw.animate([{ transform: 'scale(.74)', opacity: 0 }, { transform: 'scale(1.035)', opacity: 1, offset: .62 }, { transform: 'scale(1)', opacity: 1 }],
    { duration: 820, easing: 'cubic-bezier(.2,.8,.25,1)' });
  bw.querySelectorAll('.cell').forEach(c => {
    const i = +(/** @type {HTMLElement} */ (c).dataset.cell), r = Math.floor(i / g.to), k = i % g.to;
    if (r < g.from && k < g.from) return;                      // an old square: it just sits there
    const ring = Math.max(r, k) - g.from + 1;                  // 1 = the first new row or column, 2 = the next...
    c.animate([{ transform: 'scale(.15)', opacity: 0 }, { transform: 'scale(1.14)', opacity: 1, offset: .62 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 520, delay: 420 + ring * 130 + (r + k) * 28, easing: 'ease-out', fill: 'backwards' });
  });
}

function renderBlinds() {
  const cards = [0, 1, 2].map(i => {
    const b = blindInfo(i), cur = i === S.blindIdx, done = i < S.blindIdx;
    const btns = cur
      ? `<button class="btn gold big" data-act="startBlind">${t('btn.play')}</button>${i < 2 ? `<button class="btn" data-act="skipBlind">${t('btn.skip')}</button>` : ''}`
      : `<button class="btn" disabled>${done ? t('btn.defeated') : t('btn.upcoming')}</button>`;
    return `<div class="bcard${cur ? ' cur' : ''}${done ? ' done' : ''}"><div class="bchip" style="--bc:${b.color}">${i === 2 ? t('ui.boss') : i === 0 ? 'S' : 'B'}</div>
      <h3>${esc(b.name)}</h3><div class="t">${t('ui.scoreAtLeast')}<b>${fmt(b.target)}</b>${t('ui.reward')} <span class="gold">${'$'.repeat(b.reward)}</span></div>
      <div class="eff">${esc(b.desc)}</div>${btns}</div>`;
  }).join('');
  el.stage.innerHTML = `<div class="scrollPane"><div class="panelBox"><h2>${t('ui.anteN', { n: S.ante })} ${S.ante > 8 ? t('ui.endless') : ''}</h2><div class="blinds">${cards}</div></div></div>`;
}

/** @param {any} it */
function itemView(it) {
  if (it.kind === 'joker') {
    const d = JOKERS[it.id];
    const ed = it.ed && EDITIONS[it.ed];
    return { vis: `<span class="joker${ed ? ' ed-' + it.ed : ''}" style="--jc:${RARITY[d.rar].color}" data-tilt="s${it.id}"><span class="gl">${d.gl}</span></span>`, name: d.name,
      kind: (ed ? tr(ed.name) + ' ' : '') + t('kind.joker', { r: tr(RARITY[d.rar].name) }),
      desc: tr(d.desc({ data: {} })) + (ed ? `<span class="edline ed-${it.ed}">${tr(ed.name)}: ${tr(ed.desc)}</span>` : '') };
  }
  if (it.kind === 'piece') {
    const P = /** @type {any} */ (PIECES)[it.id];
    return { vis: `<span class="hpv" data-tilt="sp${it.id}">${pieceHTML({ type: it.id })}</span>`, name: tr(P.name), kind: t('kind.piece'), desc: tr(P.desc) };
  }
  if (it.kind === 'tile') {
    const T = /** @type {any} */ (TILES)[it.id];
    return { vis: `<span class="cons" style="--cc:var(--panel-3)"><span class="gl"><span class="tb big ${it.id}">${T.badge(1)}</span></span></span>`, name: tr(T.name), kind: t('kind.tile'), desc: tr(T.desc) };
  }
  if (it.kind === 'voucher') {
    const d = VOUCHERS[it.id];
    return { vis: `<span class="cons" style="--cc:var(--voucher)"><span class="gl sm">${d.gl}</span></span>`, name: tr(d.name), kind: t('kind.voucher'), desc: tr(d.desc) };
  }
  const d = ITEMS[it.id];
  return { vis: `<span class="cons" style="--cc:${d.kind === 'chalk' ? 'var(--chalk)' : 'var(--tool)'}"><span class="gl">${d.gl}</span></span>`, name: tr(d.name), kind: d.kind === 'chalk' ? t('kind.chalk') : t('kind.tool'), desc: itemDesc(d) };
}
/** @param {any} d */
export function itemDesc(d) {
  if (d.kind !== 'chalk') return tr(d.desc);
  const L = /** @type {any} */ (LINE_TYPES)[d.lt];
  return t('chalk.desc', { name: tr(L.name), c: L.dc, m: L.dm });
}

function renderShop() {
  const sh = S.shop;
  if (!sh) { el.stage.innerHTML = ''; return; }
  /** One card. The whole card is the button: tapping it opens a menu with what you can do. @param {any} it @param {string} key */
  const card = (it, key) => {
    const v = itemView(it);
    return `<button type="button" class="sitem${it.sold ? ' sold' : ''}" data-act="inspectShop" data-arg="${key}" ${it.sold || S.mode ? 'disabled' : ''} aria-label="${esc(v.name)}, $${it.cost}">${v.vis}<span class="nm2">${esc(v.name)}</span><span class="kind">${v.kind}</span>
      <span class="ds">${v.desc}</span><span class="price">${it.sold ? t('btn.sold') : '$' + it.cost}</span></button>`;
  };
  /** A labelled shelf of the shop. @param {string} cls @param {string} title @param {string} hint @param {string} body */
  const shelf = (cls, title, hint, body) => `<section class="shopCat ${cls}"><h3>${title}</h3><p class="catHint">${hint}</p>${body ? `<div class="shopGrid">${body}</div>` : ''}</section>`;
  const cards = sh.items.map((/** @type {any} */ it, /** @type {number} */ i) => card(it, 'i' + i)).join('');
  const voucherHint = !sh.voucher ? t('shop.voucherNone') : sh.vSold ? t('shop.voucherSold') : t('shop.voucherHint');
  const voucher = sh.voucher ? card({ kind: 'voucher', id: sh.voucher, cost: 10, sold: sh.vSold }, 'v') : '';
  const pick = S.mode === 'tile'
    ? `<div class="tilePick"><div class="hint">${t('tile.pick', { name: tr(/** @type {any} */ (TILES)[S.pending].name) })}</div>
        <div class="boardWrap tiling small">${boardHTML('tileBoard', Array(S.N * S.N).fill(null), 'applyTile')}</div>
        <button class="btn" data-act="cancelTile">${t('btn.cancelRefund')}</button></div>`
    : '';
  const plainN = S.bag.filter((/** @type {any} */ p) => p.type === 'plain').length;
  const packs = (sh.packs || []).map((/** @type {any} */ pk, /** @type {number} */ i) => {
    const P = PACKS[pk.type];
    return `<button type="button" class="sitem pack${pk.sold ? ' sold' : ''}" data-act="inspectShop" data-arg="p${i}" ${pk.sold || S.mode ? 'disabled' : ''} aria-label="${esc(tr(P.name))}, $${pk.cost}"><span class="packArt" style="--pk:${P.color}" data-tilt="pk${i}${pk.type}"><span class="gl">${P.gl}</span><span class="pkName">${tr(P.name)}</span></span>
      <span class="nm2">${tr(P.name)}</span><span class="kind">${t('kind.pack')}</span><span class="ds">${tr(P.desc)}</span><span class="price">${pk.sold ? t('btn.sold') : '$' + pk.cost}</span></button>`;
  }).join('');
  el.stage.innerHTML = `<div class="scrollPane"><div class="panelBox"><h2>${t('ui.shop')}</h2>
    <div class="shopCats">${shelf('cards', t('shop.cards'), t('shop.cardsHint'), cards)}${shelf('voucher', t('shop.voucher'), voucherHint, voucher)}${packs ? shelf('packs', t('ui.packs'), t('shop.packsHint'), packs) : ''}</div>${pick}
    <div class="shopBar"><div class="row">
      <button class="btn green big" data-act="reroll" ${S.mode ? 'disabled' : ''}>${t('btn.reroll', { n: sh.reroll })}</button>
      <button class="btn big" data-act="trim" title="${esc(t('trim.title'))}" ${(S.mode || plainN === 0 || S.bag.length <= 5 || sh.trimmed) ? 'disabled' : ''}>${t('btn.trim')}</button></div>
      <button class="btn red big" data-act="nextRound" ${S.mode ? 'disabled' : ''}>${t('btn.nextRound')}</button></div></div></div>`;
  if (S.mode === 'tile') { const tp = el.stage.querySelector('.tilePick'); if (tp) tp.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

/** An opened booster pack. It is its own scene, so the Joker and item trays above stay clickable. */
function renderPackScene() {
  const pk = S.pack, P = PACKS[pk.type];
  const firstLook = !pk.revealed;   // the cards flip up the first time only, not on every redraw
  pk.revealed = true;
  /** @param {any} o */
  const view = o => {
    if (o.kind !== 'edit') return itemView(o);
    const E = EDITS[o.id];
    return { vis: `<span class="cons" style="--cc:var(--tool)"><span class="gl">${E.gl}</span></span>`, name: tr(E.name), kind: t('kind.edit'), desc: tr(E.desc) };
  };
  const opts = pk.options.map((/** @type {any} */ o, /** @type {number} */ i) => {
    const v = view(o), armed = pk.armed === i;
    // Edits need an X to act on, so tapping one readies it; everything else opens its menu.
    return `<button type="button" class="sitem${o.taken ? ' sold' : ''}${armed ? ' armed' : ''}${firstLook ? ' reveal' : ''}" style="--i:${i}" data-act="${o.kind === 'edit' ? 'armPack' : 'inspectPackOpt'}" data-arg="${i}" ${o.taken ? 'disabled' : ''}${o.kind === 'edit' ? ` aria-pressed="${armed}"` : ''} aria-label="${esc(v.name)}">${v.vis}<span class="nm2">${esc(v.name)}</span><span class="kind">${v.kind}</span><span class="ds">${v.desc}</span></button>`;
  }).join('');
  const open = pk.options.filter((/** @type {any} */ o) => !o.taken);
  const hint = S.jokers.length >= S.jokerSlots && open.some((/** @type {any} */ o) => o.kind === 'joker') ? t('pack.sellJoker')
    : S.items.length >= S.itemSlots && open.some((/** @type {any} */ o) => o.kind === 'item' && ITEMS[o.id].kind !== 'chalk') ? t('pack.sellItem') : '';
  let targets = '';
  if (pk.targets) {
    const armedEdit = pk.armed === null || pk.armed === undefined ? null : EDITS[pk.options[pk.armed].id];
    const tiles = pk.targets.map((/** @type {number} */ uid) => S.bag.find((/** @type {any} */ x) => x.uid === uid)).filter(Boolean).map((/** @type {any} */ p) => {
      const nm = tr(/** @type {any} */ (PIECES)[p.type].name);
      return `<button type="button" class="tgt" data-act="editPiece" data-arg="${p.uid}" ${armedEdit ? '' : 'disabled'} aria-label="${esc(nm)}"><span class="hpv">${pieceHTML(p)}</span><span class="tn">${esc(nm)}</span></button>`;
    }).join('');
    targets = `<section class="shopCat packTargets"><h3>${t('pack.targets', { n: pk.targets.length })}</h3>
      <p class="catHint">${armedEdit ? t('pack.armedHint', { name: esc(tr(armedEdit.name)) }) : t('pack.pickEdit')}</p><div class="tgtRow">${tiles}</div></section>`;
  }
  el.stage.innerHTML = `<div class="scrollPane"><div class="panelBox packScene"><h2>${tr(P.name)}</h2>
    <p class="packSub">${pk.left === 1 ? t('pack.left1') : t('pack.left', { n: pk.left })}</p>
    <div class="shopGrid">${opts}</div>${hint ? `<p class="packHint">${hint}</p>` : ''}${targets}
    <div class="shopBar packBar"><button class="btn big" data-act="skipPack">${t('btn.skipPack')}</button></div></div></div>`;
  if (firstLook) {   // the pack bursts open
    sfx.sparkle();
    const c = fx.centreOf(el.stage.querySelector('.packScene .shopGrid'));
    if (c) { fx.ring(c.x, c.y, P.color, 24); fx.burst(c.x, c.y, [P.color, '#ffe08a', '#fff'], 22, { speed: 260, up: 90 }); }
  }
}

/* ---------------- overlays ---------------- */
/** @param {string|null} kind */
export function showModal(kind) { modal = kind; abandonArmed = false; renderOverlay(); syncCoach(); }   // Ollie steps aside for a dialog, and comes back after it

function renderOverlay() {
  let kind = modal;
  if (!kind) kind = ({ title: 'title', cashout: 'cashout', over: 'over', won: 'won' })[/** @type {'title'} */ (S.phase)] || null;
  if (!kind) { el.overlay.hidden = true; el.overlay.innerHTML = ''; return; }
  el.overlay.hidden = false;
  let h = '';
  if (kind === 'title') {
    const b = best();
    h = `<div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="mt">
      <h1 class="title" id="mt"><span>BALATRO</span> <span class="x">X</span> <span>TICTACTOE</span></h1>
      <p class="subtitle">${t('title.sub')}${b.ante ? ' ' + t('title.best', { a: b.ante, s: fmt(b.score) }) : ''}</p>
      ${SET.tips && !(SET.seen && SET.seen.welcome)
        ? `<div class="titleOllie"><span class="tOllie">${ollie('wink')}</span><p>${t('title.tipsLine')}</p></div>`   // new players get taught as they play, not up front
        : `<div class="howto"><div>${t('how.1')}</div><div>${t('how.2')}</div><div>${t('how.3')}</div><div>${t('how.4')}</div></div>`}
      <div class="btnRow">${hasSavedRun() ? `<button class="btn gold big" data-act="continueRun">${t('btn.continue')}</button>` : ''}
        <button class="btn ${hasSavedRun() ? '' : 'gold '}big" data-act="newRun">${t('btn.newRun')}</button></div></div>`;
  } else if (kind === 'cashout') {
    const c = S.cashout;
    const tally = !c.revealed;   // the sheet totals up line by line the first time only, not on every redraw
    c.revealed = true;
    if (tally) c.rows.forEach((/** @type {any} */ r, /** @type {number} */ i) => { if (r[1] > 0) setTimeout(() => sfx.money(), (250 + i * 170) / speedK()); });
    h = `<div class="modal" role="dialog" aria-modal="true"><h2>${t('cash.title')}</h2><p>${t('cash.final', { a: fmt(S.round.score), b: fmt(S.round.target) })}</p>
      <div class="rowsList">${c.rows.map((/** @type {any} */ r, /** @type {number} */ i) => `<div class="rr${tally ? ' tally' : ''}" style="--i:${i}"><span>${r[0]}</span><b>${r[1] > 0 ? '$' + r[1] : '-'}</b></div>`).join('')}</div>
      ${c.notes.map((/** @type {string} */ n) => `<p>${n}</p>`).join('')}
      <div class="btnRow"><button class="btn gold big" data-act="cashOut">${t('cash.btn', { n: c.total })}</button></div></div>`;
  } else if (kind === 'over') {
    const r = S.round || { score: 0, target: 0 };
    h = `<div class="modal" role="dialog" aria-modal="true"><h2 class="bad">${t('over.title')}</h2>
      <p>${t('over.text', { name: esc(blindInfo(S.blindIdx).name), a: S.ante, s: fmt(r.score), t: fmt(r.target) })}</p>
      <div class="rowsList"><div class="rr"><span>${t('over.best')}</span><b>${fmt(S.stats.bestLine)}${S.stats.bestType ? ` (${tr(/** @type {any} */ (LINE_TYPES)[S.stats.bestType].name)})` : ''}</b></div>
        <div class="rr"><span>${t('over.lines')}</span><b>${S.stats.lines}</b></div>
        <div class="rr"><span>${t('over.jokers')}</span><b class="plain">${S.jokers.map((/** @type {any} */ j) => esc(JOKERS[j.id].name)).join(', ') || t('none')}</b></div></div>
      <div class="btnRow"><button class="btn gold big" data-act="newRun">${t('btn.newRun')}</button></div></div>`;
  } else if (kind === 'won') {
    h = `<div class="modal" role="dialog" aria-modal="true"><h2 class="good">${t('won.title')}</h2><p>${t('won.text', { s: fmt(S.stats.bestLine) })}</p>
      <div class="btnRow"><button class="btn gold big" data-act="endless">${t('btn.endless')}</button><button class="btn big" data-act="newRun">${t('btn.newRun')}</button></div></div>`;
  } else if (kind === 'info') {
    const rows = LINE_ORDER.map(k => { const v = lineValues(k); return `<tr><td>${tr(/** @type {any} */ (LINE_TYPES)[k].name)}</td><td>${S.levels[k]}</td><td><i>${v.chips}</i> &times; <em>${v.mult}</em></td><td>${S.played[k]}</td></tr>`; }).join('');
    const vs = S.vouchers.length ? S.vouchers.map((/** @type {string} */ v) => tr(VOUCHERS[v].name)).join(', ') : t('info.noneYet');
    const boss = BOSSES[S.boss.id];
    h = `<div class="modal" role="dialog" aria-modal="true"><h2>${t('info.title')}</h2>
      <div class="tblWrap"><table class="lv"><tr><th>${t('info.type')}</th><th>${t('info.level')}</th><th>${t('info.base')}</th><th>${t('info.scored')}</th></tr>${rows}</table></div>
      <p>${t('info.p1', { n: S.N })}</p><p>${t('info.boss', { name: tr(boss.name), desc: tr(boss.desc) })}</p><p>${t('info.vouchers', { list: vs })}</p>
      <div class="btnRow"><button class="btn" data-act="toggleSpeed">${t('ui.speed', { n: SET.speed })}</button>
        <button class="btn" data-act="toggleSound" aria-pressed="${SET.sound}">${SET.sound ? t('ui.soundOn') : t('ui.soundOff')}</button>
        <button class="btn" data-act="toggleCrt" aria-pressed="${SET.crt}">${SET.crt ? t('ui.crtOn') : t('ui.crtOff')}</button></div>
      <div class="btnRow"><button class="btn" data-act="toggleTips" aria-pressed="${SET.tips}">${SET.tips ? t('ui.tipsOn') : t('ui.tipsOff')}</button>
        <button class="btn" data-act="replayTips">${t('ui.tipsReplay')}</button>
        <button class="btn" data-act="toggleLang" lang="${getLang()}">${t('ui.lang')}</button></div>
      <div class="btnRow"><button class="btn big" data-act="closeModal">${t('btn.close')}</button>
        <button class="btn red" data-act="abandon">${abandonArmed ? t('btn.abandonSure') : t('btn.abandon')}</button></div></div>`;
  } else if (kind === 'bag') {
    /** @type {Record<string, number>} */ const counts = {};
    S.bag.forEach((/** @type {any} */ p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
    h = `<div class="modal" role="dialog" aria-modal="true"><h2>${t('bag.title', { n: S.bag.length })}</h2><p>${t('bag.text', { n: handMax() })}</p>
      <div class="bagGrid">${S.bag.map((/** @type {any} */ p) => `<span class="hpv">${pieceHTML(p)}</span>`).join('')}</div>
      <div class="rowsList">${Object.keys(counts).map(k => { const P = /** @type {any} */ (PIECES)[k]; return `<div class="rr"><span class="nowrap">${esc(tr(P.name))} &times;${counts[k]}</span><span class="dim">${tr(P.desc)}</span></div>`; }).join('')}</div>
      <div class="btnRow"><button class="btn big" data-act="closeModal">${t('btn.close')}</button></div></div>`;
  }
  el.overlay.innerHTML = h;
  const first = /** @type {HTMLElement|null} */ (el.overlay.querySelector('.btn'));
  if (first && !el.overlay.contains(document.activeElement)) first.focus({ preventScroll: true });
}

/* ---------------- inspector popover ---------------- */
export function hideInsp() { el.insp.hidden = true; }
/** @param {HTMLElement} anchor */
function placeInsp(anchor) {
  const p = el.insp; p.hidden = false;
  const r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
  const x = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  let y = r.bottom + 8; if (y + h > innerHeight - 12) y = Math.max(12, r.top - h - 8);
  p.style.left = x + 'px'; p.style.top = y + 'px';
  // The action is the only button in the menu, so keyboard users land right on it.
  const go = /** @type {HTMLElement|null} */ (p.querySelector('.btn:not(:disabled)'));
  if (go) go.focus({ preventScroll: true });
}
/** Menu text under a card: the reason an action is unavailable, or nothing. @param {string} why */
const whyLine = why => (why ? `<p class="why">${why}</p>` : '');
/**
 * Tap a shop card: a small menu with the one thing you can do with it.
 * @param {string} key 'i0'/'i1' for a card, 'v' for the voucher, 'p0'/'p1' for a pack
 * @param {HTMLElement} anchor
 */
function inspectShop(key, anchor) {
  const sh = S.shop; if (!sh) return;
  const isPack = key[0] === 'p';
  const pk = isPack ? sh.packs[+key.slice(1)] : null;
  const it = isPack ? null : key === 'v' ? { kind: 'voucher', id: sh.voucher, cost: 10, sold: sh.vSold } : sh.items[+key.slice(1)];
  if (isPack ? !pk || pk.sold : !it || it.sold) return;
  const cost = isPack ? pk.cost : it.cost;
  let head;
  if (isPack) { const P = PACKS[pk.type]; head = `<h4>${tr(P.name)}</h4><span class="tag" style="--tc:${P.color}">${t('kind.pack')}</span><p>${tr(P.desc)}</p>`; }
  else { const v = itemView(it); head = `<h4>${esc(v.name)}</h4><span class="tag" style="--tc:var(--gold)">${v.kind}</span><p>${v.desc}</p>`; }
  // A full tray is fixed by selling something in the tray, which a menu opened over it could
  // cover (it flips upward when the card is low on screen). So say it in a toast, not a menu.
  const full = it && it.kind === 'joker' && S.jokers.length >= S.jokerSlots ? t('toast.jokersFull')
    : it && it.kind === 'item' && S.items.length >= S.itemSlots ? t('toast.itemsFull') : '';
  if (full && S.money >= cost) { hideInsp(); toast(full); return; }
  const why = S.money < cost ? t('why.need', { n: cost - S.money }) : '';
  el.insp.innerHTML = `${head}${whyLine(why)}
    <div class="row"><button class="btn gold" data-act="${isPack ? 'buyPack' : 'buy'}" data-arg="${isPack ? key.slice(1) : key}" ${why ? 'disabled' : ''}>${t(isPack ? 'btn.open' : 'btn.buy')} $${cost}</button></div>`;
  placeInsp(anchor);
}
/** Tap something in an open pack: a menu with Take, or why you can't yet. @param {string} i @param {HTMLElement} anchor */
function inspectPackOpt(i, anchor) {
  const pk = S.pack, o = pk && pk.options[+i]; if (!o || o.taken) return;
  const v = itemView(o);
  // No room: the banner in the scene already explains, and the tray must stay reachable to sell
  // from, so a toast, not a menu that could land on top of it.
  const full = o.kind === 'joker' && S.jokers.length >= S.jokerSlots ? t('pack.sellJoker')
    : o.kind === 'item' && ITEMS[o.id].kind !== 'chalk' && S.items.length >= S.itemSlots ? t('pack.sellItem') : '';
  if (full) { hideInsp(); toast(full); return; }
  el.insp.innerHTML = `<h4>${esc(v.name)}</h4><span class="tag" style="--tc:var(--gold)">${v.kind}</span><p>${v.desc}</p>
    <div class="row"><button class="btn gold" data-act="takePack" data-arg="${i}">${t('btn.take')}</button></div>`;
  placeInsp(anchor);
}
/** @param {string} uid @param {HTMLElement} anchor */
function inspectJoker(uid, anchor) {
  const j = S.jokers.find((/** @type {any} */ x) => String(x.uid) === uid); if (!j) return;
  const d = JOKERS[j.id], ed = j.ed && EDITIONS[j.ed];
  const sell = Math.max(1, Math.floor((d.cost + (ed ? ed.cost : 0)) / 2));
  el.insp.innerHTML = `<h4>${esc(d.name)}</h4><span class="tag" style="--tc:${RARITY[d.rar].color}">${t('kind.joker', { r: tr(RARITY[d.rar].name) })}</span>${ed ? ` <span class="tag ed-tag ed-${j.ed}">${tr(ed.name)}</span>` : ''}
    <p>${tr(d.desc(j))}${ed ? `<span class="edline ed-${j.ed}">${tr(ed.name)}: ${tr(ed.desc)}</span>` : ''}</p>
    <div class="row"><button class="btn red" data-act="sellJoker" data-arg="${uid}" ${S.busy ? 'disabled' : ''}>${t('btn.sell', { n: sell })}</button></div>`;
  placeInsp(anchor);
}
/** @param {string} uid @param {HTMLElement} anchor */
function inspectItem(uid, anchor) {
  const c = S.items.find((/** @type {any} */ x) => String(x.uid) === uid); if (!c) return;
  const d = ITEMS[c.id], why = actions.itemBlocked ? actions.itemBlocked(uid) : '';
  el.insp.innerHTML = `<h4>${esc(tr(d.name))}</h4><span class="tag" style="--tc:${d.kind === 'chalk' ? 'var(--chalk)' : 'var(--tool)'}">${d.kind === 'chalk' ? t('tag.chalk') : t('tag.tool')}</span><p>${itemDesc(d)}</p>
    ${why ? `<p class="why">${why}</p>` : ''}
    <div class="row"><button class="btn gold" data-act="useItem" data-arg="${uid}" ${why ? 'disabled' : ''}>${t('btn.use')}</button>
    <button class="btn red" data-act="sellItem" data-arg="${uid}" ${S.busy ? 'disabled' : ''}>${t('btn.sell', { n: 1 })}</button></div>`;
  placeInsp(anchor);
}

/* ---------------- input: one delegated listener ---------------- */
/** UI-only actions that never change the run. */
/** @type {Record<string, (arg: string, target: HTMLElement) => void>} */
const local = {
  inspectJoker: (a, el2) => inspectJoker(a, el2),
  inspectItem: (a, el2) => inspectItem(a, el2),
  inspectShop: (a, el2) => inspectShop(a, el2),
  inspectPackOpt: (a, el2) => inspectPackOpt(a, el2),
  // Same switch as the one in the top bar: i18n.js stores the choice and fires `langchange`, which re-renders.
  toggleLang: () => { const w = /** @type {any} */ (window); if (w.I18N) w.I18N.set(getLang() === 'da' ? 'en' : 'da'); },
  hideInsp: () => hideInsp(),
  openInfo: () => showModal('info'),
  openBag: () => showModal('bag'),
  closeModal: () => showModal(null),
  abandon: () => {
    if (!abandonArmed) { abandonArmed = true; renderOverlay(); return; }
    modal = null; abandonArmed = false; if (actions.abandon) actions.abandon();
  },
};

/* ---------------- hover tooltips (mouse only; touch uses tap) ---------------- */
const tipEl = /** @type {HTMLElement} */ ($('#tip'));
let tipFor = /** @type {HTMLElement|null} */ (null);
/** @param {string} spec */
function tipHTML(spec) {
  const [kind, id] = spec.split(':');
  if (kind === 'piece') { const P = /** @type {any} */ (PIECES)[id]; return P ? `<b>${esc(tr(P.name))}</b><span>${tr(P.desc)}</span>` : ''; }
  if (kind === 'joker') {
    const j = S.jokers.find((/** @type {any} */ x) => String(x.uid) === id); if (!j) return '';
    const d = JOKERS[j.id], ed = j.ed && EDITIONS[j.ed];
    return `<b>${esc(d.name)}</b><span>${tr(d.desc(j))}</span>${ed ? `<span class="edline ed-${j.ed}">${tr(ed.name)}: ${tr(ed.desc)}</span>` : ''}`;
  }
  if (kind === 'item') {
    const c = S.items.find((/** @type {any} */ x) => String(x.uid) === id); if (!c) return '';
    const d = ITEMS[c.id]; return `<b>${esc(tr(d.name))}</b><span>${itemDesc(d)}</span>`;
  }
  return '';
}
function hideTip() { tipEl.hidden = true; tipFor = null; }
/** @param {HTMLElement} target */
function showTip(target) {
  const html = tipHTML(target.dataset.tip || '');
  if (!html) { hideTip(); return; }
  tipFor = target; tipEl.innerHTML = html; tipEl.hidden = false;
  const r = target.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  const x = Math.max(10, Math.min(innerWidth - w - 10, r.left + r.width / 2 - w / 2));
  let y = r.top - h - 10; if (y < 10) y = r.bottom + 10;
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
}
/** @param {string} type @param {HTMLElement} anchor */
function inspectPiece(type, anchor) {
  const P = /** @type {any} */ (PIECES)[type]; if (!P) return;
  el.insp.innerHTML = `<h4>${esc(tr(P.name))}</h4><p>${tr(P.desc)}</p>`;   // information only: tap anywhere else to dismiss
  placeInsp(anchor);
}

export function initInput() {
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const tgt = /** @type {HTMLElement|null} */ ((/** @type {HTMLElement} */ (e.target)).closest('[data-tip]'));
    if (tgt && tgt !== tipFor) showTip(tgt);
    else if (!tgt && tipFor) hideTip();
  });
  document.addEventListener('pointerdown', hideTip, true);
  addEventListener('scroll', hideTip, true);
  document.addEventListener('click', e => {
    const target = /** @type {HTMLElement} */ (e.target);
    const btn = /** @type {HTMLElement|null} */ (target.closest('[data-act]'));
    if (!btn || (btn instanceof HTMLButtonElement && btn.disabled)) {
      if (!el.insp.hidden && !el.insp.contains(target)) hideInsp();
      return;
    }
    const act = btn.dataset.act || '', arg = btn.dataset.arg || '';
    if (!act.startsWith('inspect') && act !== 'hideInsp') hideInsp();
    if (act === 'selectPiece' && S.phase === 'play' && !S.busy && +arg === S.selIdx) {
      // Tapping the piece you already hold shows what it does (touch has no hover).
      const p = S.hand[+arg]; if (p) inspectPiece(p.type, btn); return;
    }
    if (local[act]) { local[act](arg, btn); return; }
    if (actions[act]) actions[act](arg);
  });
  el.overlay.addEventListener('click', e => { if (e.target === el.overlay && (modal === 'info' || modal === 'bag')) showModal(null); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hideInsp();
      if (modal) showModal(null);
      else if (actions.cancelMode) actions.cancelMode();
    }
    if (S.phase === 'play' && !modal && S.N === 3 && /^[1-9]$/.test(e.key) && actions.cell) {
      // Number keys follow a phone keypad: 1 is the top-left square.
      actions.cell(String(+e.key - 1));
    }
  });
  addEventListener('resize', hideInsp);
}

/* =================================================================
   Effects used while scoring
   ================================================================= */
export const cellEl = (/** @type {number} */ i) => /** @type {HTMLElement|null} */ (document.querySelector(`#board [data-cell="${i}"]`));
export const jokerEl = (/** @type {number} */ uid) => /** @type {HTMLElement|null} */ (document.querySelector(`[data-joker="${uid}"]`));
export const boardEl = () => $('#bw');

let toastTimer = 0;
/** @param {string} msg */
export function toast(msg) {
  el.toast.textContent = msg; el.toast.classList.add('on');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.toast.classList.remove('on'), 1900);
}
/** Floating "+30" style label over an element. @param {HTMLElement|null} target @param {string} text @param {string} cls */
export function pop(target, text, cls) {
  if (!target) return;
  const r = target.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'pop ' + cls; p.textContent = text;
  p.style.left = (r.left + r.width / 2) + 'px'; p.style.top = (r.top + r.height * 0.3) + 'px';
  p.style.animationDuration = (0.8 / Math.max(1, SET.speed * 0.7)) + 's';
  p.style.setProperty('--rot', ((Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 5)).toFixed(1) + 'deg');   // each label tips its own way
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1000);
}
/** @param {HTMLElement|null} e @param {string} cls */
function retrigger(e, cls) { if (!e) return; e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); }
export const bump = (/** @type {HTMLElement|null} */ e) => { retrigger(e, 'bump'); setTimeout(() => e && e.classList.remove('bump'), 90); };
export const jig = (/** @type {HTMLElement|null} */ e) => { retrigger(e, 'jig'); if (e) punch(e); };
/** Screen shake. `power` is 0..1: a nudge at 0, the full thing at 1. The CSS reads --sk as a unitless amount. @param {number} [power] */
export const shake = (power = 1) => {
  const app = $('#app');
  if (app) app.style.setProperty('--sk', (2 + 9 * Math.min(1, Math.max(0, power))).toFixed(1));
  retrigger(app, 'shake');
};
/** The CRT layer is pure CSS, switched by a class on <html>. */
export const applyCrt = () => document.documentElement.classList.toggle('crt', !!SET.crt);
/** @param {number} chips @param {number} mult @param {string} [name] */
export function setCalc(chips, mult, name) {
  const c = $('#chips'), m = $('#mult'), h = $('#hname');
  if (c) c.textContent = fmt(chips);
  if (m) m.textContent = fmtM(mult);
  if (h && name !== undefined) h.innerHTML = name || '&nbsp;';
}
export const bumpCalc = (/** @type {'chips'|'mult'} */ which) => bumpCounter(which, 1.22);

/* ---------------- the choreography of a score ----------------
 * When something scores, it should feel like it hit: the card jumps and lands with a squash,
 * sparks burst from it, a short stream of points flies into the counter it feeds, and the counter
 * pops (hard when the effect fires, softer again when the stream arrives). Bigger effects, and
 * multipliers above all, get more of everything. All of it is decoration on top of the engine's
 * timing, so the sequence takes exactly as long as before. */
const calmMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const speedK = () => Math.min(3, Math.max(1, SET.speed || 1));
/** @param {'chips'|'mult'|'xmult'|'money'} kind */
const counterFor = kind => (kind === 'chips' ? '#chips' : kind === 'money' ? '#money' : '#mult');

/** Pop a counter: it swells, tips a little and flashes. @param {'chips'|'mult'|'xmult'|'money'} kind @param {number} [power] */
function bumpCounter(kind, power = 1.3) {
  const e = $(counterFor(kind));
  if (!e || !e.animate || calmMotion()) return;
  const tip = kind === 'chips' ? -4 : 4;
  e.animate([{ scale: '1', rotate: '0deg', filter: 'brightness(1)' }, { scale: String(power), rotate: tip + 'deg', filter: 'brightness(1.6)', offset: .3 }, { scale: '1', rotate: '0deg', filter: 'brightness(1)' }],
    { duration: 320 / speedK(), easing: 'cubic-bezier(.3,1.6,.5,1)' });
}

/** An X jumps, tips and lands with a squash. @param {HTMLElement|null} target @param {number} [power] */
function jump(target, power = 1) {
  const el = target && target.classList.contains('cell') ? target.querySelector('.piece') : null;
  if (!el || !el.animate || calmMotion()) return;
  const rot = (Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 4), up = 1 + .14 * power;
  el.animate([
    { translate: '0 0', scale: '1 1', rotate: '0deg' },
    { translate: `0 ${-14 * power}px`, scale: `${up} ${up}`, rotate: rot + 'deg', offset: .36 },
    { translate: '0 0', scale: `${1 + .1 * power} ${1 - .12 * power}`, rotate: (-rot / 3) + 'deg', offset: .66 },
    { translate: '0 0', scale: '1 1', rotate: '0deg' },
  ], { duration: 420 / speedK(), easing: 'cubic-bezier(.3,1.4,.5,1)' });
}

/**
 * Something just scored.
 * @param {HTMLElement|null} target the card, square or Joker that did it
 * @param {'chips'|'mult'|'xmult'|'money'} kind @param {number} [amount]
 */
export function hit(target, kind, amount = 1) {
  bumpCounter(kind, kind === 'xmult' ? 1.5 : 1.3);
  const c = fx.centreOf(target);
  if (!c) return;
  const colors = fx.PALETTE[kind], big = kind === 'xmult' ? 1.6 : 1;
  fx.burst(c.x, c.y, colors, Math.round((12 + Math.min(12, Math.log10(1 + Math.abs(amount)) * 5)) * big), { speed: 210 * big });
  fx.ring(c.x, c.y, colors[1], kind === 'xmult' ? 22 : 14);
  const dest = fx.centreOf($(counterFor(kind)));
  if (dest) fx.stream(c, dest, colors, kind === 'xmult' ? 10 : 7, () => bumpCounter(kind, 1.12));
  jump(target, kind === 'xmult' ? 1.35 : 1);
}

/** The line's total lands: a burst over the board, bigger the closer it gets to (or the further it passes) the target. @param {number} ratio total / blind target */
export function celebrate(ratio) {
  const c = fx.centreOf($('#bw'));
  if (!c) return;
  const r = Math.min(3, Math.max(0.2, ratio));
  fx.ring(c.x, c.y, '#f6b92c', 30);
  fx.burst(c.x, c.y, ratio >= 1 ? fx.PALETTE.win : fx.PALETTE.money, Math.round(12 + r * 12), { speed: 230 + r * 60, up: 80, size: 1.15 });
}

/** A piece has been placed: it drops onto the board with a squash, a ring and dust where it lands. @param {number} i @param {'x'|'o'} kind */
function impact(i, kind) {
  if (calmMotion()) return;
  const cell = cellEl(i);
  const el = cell && cell.querySelector(kind === 'o' ? '.oMark' : '.piece');
  if (!cell || !el || !el.animate) return;
  const d = 360 / speedK();
  el.animate([
    { translate: '0 -26px', scale: '1.55', rotate: kind === 'o' ? '-120deg' : '-6deg', opacity: 0 },
    { translate: '0 0', scale: '1 1', rotate: '0deg', opacity: 1, offset: .46 },
    { scale: '1.1 .86', offset: .6 },
    { scale: '.97 1.04', offset: .78 },
    { scale: '1 1', rotate: '0deg', opacity: 1 },
  ], { duration: d, easing: 'cubic-bezier(.3,.9,.4,1)', fill: 'backwards' });
  setTimeout(() => {     // the moment it lands
    const c = fx.centreOf(cell);
    if (!c) return;
    fx.ring(c.x, c.y + c.h * .2, kind === 'o' ? '#ff7b3a' : '#f5efe0', 12);
    fx.dust(c.x, c.y + c.h * .38, c.w * .7);
    const bw = $('#bw');
    if (bw && bw.animate) bw.animate([{ translate: '0 0' }, { translate: '0 3px' }, { translate: '0 0' }], { duration: 150 });
    sfx.thud();
  }, d * .46);
}
/** @param {number} total */
export function showTotal(total) { const h = $('#hname'); if (h) h.innerHTML = `<span class="gold">+${fmt(total)}</span>`; }
export function setMoney() { const e = $('#money'); if (e) e.textContent = '$' + S.money; }
/** @param {number} v */
export function setRoundScore(v) { const e = $('#rs'); if (e) e.textContent = fmt(v); }
/** @param {number[]} cells @param {string} cls @param {boolean} on */
export function markCells(cells, cls, on) { cells.forEach(i => { const e = cellEl(i); if (e) e.classList.toggle(cls, on); }); }
/** @param {string} msg @param {boolean} [bad] */
export function banner(msg, bad) {
  const bw = boardEl(); if (!bw) return null;
  const b = document.createElement('div');
  b.className = 'banner' + (bad ? ' bad' : ''); b.textContent = msg; b.setAttribute('role', 'status');
  bw.appendChild(b); return b;
}
export function refreshRack() { renderRack(); }
export function refreshModal() { renderOverlay(); }
