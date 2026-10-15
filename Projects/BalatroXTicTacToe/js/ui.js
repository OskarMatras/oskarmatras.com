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
import { LINE_TYPES, LINE_ORDER, PIECES, TILES, RARITY, JOKERS, ITEMS, VOUCHERS, BOSSES, hasJ } from './data.js';
import { blindInfo, lineValues, handMax } from './rules.js';
import { t, tr, fmt, fmtM } from './strings.js';
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
  renderSide(); renderRack(); renderStage(); renderOverlay();
}

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
    </div>`;
}

function renderRack() {
  const js = S.jokers.map((/** @type {any} */ j) => {
    const d = JOKERS[j.id];
    return `<button class="joker" style="--jc:${RARITY[d.rar].color}" data-act="inspectJoker" data-arg="${j.uid}" data-joker="${j.uid}" aria-label="${esc(d.name)}">
      <span class="gl">${d.gl}</span><span class="nm">${esc(d.name)}</span>${d.val ? `<span class="val">${d.val(j)}</span>` : ''}</button>`;
  }).join('');
  const its = S.items.map((/** @type {any} */ c) => {
    const d = ITEMS[c.id];
    return `<button class="cons" style="--cc:${d.kind === 'chalk' ? 'var(--chalk)' : 'var(--tool)'}" data-act="inspectItem" data-arg="${c.uid}" data-item="${c.uid}" aria-label="${esc(tr(d.name))}">
      <span class="gl">${d.gl}</span><span class="nm">${esc(tr(d.name))}</span></button>`;
  }).join('');
  el.rack.innerHTML = `<div class="tray jokers"><div class="lbl"><span>${t('ui.jokers')}</span><span>${S.jokers.length}/${S.jokerSlots}</span></div>
      <div class="slots">${js || `<div class="empty">${t('ui.noJokers')}</div>`}</div></div>
    <div class="tray items"><div class="lbl"><span>${t('ui.items')}</span><span>${S.items.length}/${S.itemSlots}</span></div><div class="slots">${its}</div></div>`;
}

function renderStage() {
  if (S.phase === 'play') return renderPlay();
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
function boardHTML(id, board, act) {
  const N = S.N;
  const cells = board.map((c, i) => {
    let inner = '', cls = 'empty';
    if (c) {
      if (c.t === 'X') { cls = 'x'; inner = pieceHTML(c.p, (c.fresh ? ' popIn' : '') + (c.shattered ? ' shattered' : '')); }
      else if (c.t === 'O') { cls = 'o'; inner = `<span class="oMark${c.fresh ? ' popIn' : ''}"></span>`; }
      else { cls = 's'; inner = `<span class="stone">${t('stone')}</span>`; }
      c.fresh = false;
    }
    const up = Object.keys(squareOf(i)).length ? ' up' : '';
    return `<button class="cell ${cls}" data-act="${act}" data-arg="${i}" data-cell="${i}" aria-label="${t('aria.square', { n: i + 1 })}"><span class="slot${up}">${tilesHTML(i)}${inner}</span></button>`;
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
    `<button class="hp${k === S.selIdx ? ' sel' : ''}${p.dealt ? ' deal' : ''}" data-act="selectPiece" data-arg="${k}" aria-pressed="${k === S.selIdx}" aria-label="${esc(tr(/** @type {any} */ (PIECES)[p.type].name))}">${pieceHTML(p)}</button>`).join('');
  S.hand.forEach((/** @type {any} */ p) => { p.dealt = false; });
  let hint;
  if (S.mode === 'erase') hint = `${t('hint.erase')} <button class="btn small" data-act="cancelMode">${t('btn.cancel')}</button>`;
  else if (S.busy) hint = '&nbsp;';
  else if (S.round.gameNo === 1 && S.ante === 1 && S.blindIdx === 0 && S.g.placements === 0) hint = t('hint.first');
  else if (allPlain) hint = t('hint.tap');
  else { const P = /** @type {any} */ (PIECES)[S.hand[S.selIdx].type]; hint = `<b>${esc(tr(P.name))}</b>: ${tr(P.desc)}`; }
  el.stage.innerHTML = `<div class="playArea">
    <div class="boardArea"><div class="boardWrap${armed ? ' armed' : ''}${S.mode === 'erase' ? ' erasing' : ''}" id="bw">
      ${boardHTML('board', S.board, 'cell')}
      <svg id="strikes" viewBox="0 0 ${S.N} ${S.N}" preserveAspectRatio="none" aria-hidden="true">${strikes}</svg></div></div>
    <div class="hint${S.mode ? ' must' : ''}" id="hint">${hint}</div>
    <div class="handMeta"><span>${t('meta.game', { n: S.round.gameNo, m: S.round.gameNo + S.round.games - 1 })}</span>
      <span>${hasJ('overtime') ? t('meta.overtime') : t('meta.firstLine')}</span><span>${t('meta.bag', { n: S.g.pile.length })}</span></div>
    <div class="handRow"><div id="hand">${hand}</div>
      <button class="btn red" data-act="discard" ${(!S.hand.length || !S.round.discards || S.busy || S.mode || noSpecials) ? 'disabled' : ''}>${t('btn.discard')}</button></div>
  </div>`;
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
    return { vis: `<span class="joker" style="--jc:${RARITY[d.rar].color}"><span class="gl">${d.gl}</span></span>`, name: d.name, kind: t('kind.joker', { r: tr(RARITY[d.rar].name) }), desc: tr(d.desc({ data: {} })) };
  }
  if (it.kind === 'piece') {
    const P = /** @type {any} */ (PIECES)[it.id];
    return { vis: `<span class="hpv">${pieceHTML({ type: it.id })}</span>`, name: tr(P.name), kind: t('kind.piece'), desc: tr(P.desc) };
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
  const all = [...sh.items.map((/** @type {any} */ it, /** @type {number} */ i) => ({ it, key: 'i' + i })), { it: sh.tile, key: 't' },
    ...(sh.voucher ? [{ it: { kind: 'voucher', id: sh.voucher, cost: 10, sold: sh.vSold }, key: 'v' }] : [])];
  const cards = all.map(({ it, key }) => {
    const v = itemView(it);
    return `<div class="sitem${it.sold ? ' sold' : ''}">${v.vis}<div class="nm2">${esc(v.name)}</div><div class="kind">${v.kind}</div>
      <div class="ds">${v.desc}</div><div class="price">$${it.cost}</div>
      <button class="btn gold" data-act="buy" data-arg="${key}" ${it.sold || S.mode ? 'disabled' : ''}>${it.sold ? t('btn.sold') : t('btn.buy')}</button></div>`;
  }).join('');
  const pick = S.mode === 'tile'
    ? `<div class="tilePick"><div class="hint">${t('tile.pick', { name: tr(/** @type {any} */ (TILES)[S.pending].name) })}</div>
        <div class="boardWrap tiling small">${boardHTML('tileBoard', Array(S.N * S.N).fill(null), 'applyTile')}</div>
        <button class="btn" data-act="cancelTile">${t('btn.cancelRefund')}</button></div>`
    : '';
  const plainN = S.bag.filter((/** @type {any} */ p) => p.type === 'plain').length;
  el.stage.innerHTML = `<div class="scrollPane"><div class="panelBox"><h2>${t('ui.shop')}</h2><div class="shopGrid">${cards}</div>${pick}
    <div class="shopBar"><div class="row">
      <button class="btn green big" data-act="reroll" ${S.mode ? 'disabled' : ''}>${t('btn.reroll', { n: sh.reroll })}</button>
      <button class="btn big" data-act="trim" title="${esc(t('trim.title'))}" ${(S.mode || plainN === 0 || S.bag.length <= 5 || sh.trimmed) ? 'disabled' : ''}>${t('btn.trim')}</button></div>
      <button class="btn red big" data-act="nextRound" ${S.mode ? 'disabled' : ''}>${t('btn.nextRound')}</button></div></div></div>`;
  if (S.mode === 'tile') { const tp = el.stage.querySelector('.tilePick'); if (tp) tp.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

/* ---------------- overlays ---------------- */
/** @param {string|null} kind */
export function showModal(kind) { modal = kind; abandonArmed = false; renderOverlay(); }

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
      <div class="howto"><div>${t('how.1')}</div><div>${t('how.2')}</div><div>${t('how.3')}</div><div>${t('how.4')}</div></div>
      <div class="btnRow">${hasSavedRun() ? `<button class="btn gold big" data-act="continueRun">${t('btn.continue')}</button>` : ''}
        <button class="btn ${hasSavedRun() ? '' : 'gold '}big" data-act="newRun">${t('btn.newRun')}</button></div></div>`;
  } else if (kind === 'cashout') {
    const c = S.cashout;
    h = `<div class="modal" role="dialog" aria-modal="true"><h2>${t('cash.title')}</h2><p>${t('cash.final', { a: fmt(S.round.score), b: fmt(S.round.target) })}</p>
      <div class="rowsList">${c.rows.map((/** @type {any} */ r) => `<div class="rr"><span>${r[0]}</span><b>${r[1] > 0 ? '$' + r[1] : '-'}</b></div>`).join('')}</div>
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
        <button class="btn" data-act="toggleSound" aria-pressed="${SET.sound}">${SET.sound ? t('ui.soundOn') : t('ui.soundOff')}</button></div>
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
}
/** @param {string} uid @param {HTMLElement} anchor */
function inspectJoker(uid, anchor) {
  const j = S.jokers.find((/** @type {any} */ x) => String(x.uid) === uid); if (!j) return;
  const d = JOKERS[j.id], sell = Math.max(1, Math.floor(d.cost / 2));
  el.insp.innerHTML = `<h4>${esc(d.name)}</h4><span class="tag" style="--tc:${RARITY[d.rar].color}">${t('kind.joker', { r: tr(RARITY[d.rar].name) })}</span><p>${tr(d.desc(j))}</p>
    <div class="row"><button class="btn red" data-act="sellJoker" data-arg="${uid}" ${S.busy ? 'disabled' : ''}>${t('btn.sell', { n: sell })}</button>
    <button class="btn" data-act="hideInsp">${t('btn.close')}</button></div>`;
  placeInsp(anchor);
}
/** @param {string} uid @param {HTMLElement} anchor */
function inspectItem(uid, anchor) {
  const c = S.items.find((/** @type {any} */ x) => String(x.uid) === uid); if (!c) return;
  const d = ITEMS[c.id], why = actions.itemBlocked ? actions.itemBlocked(uid) : '';
  el.insp.innerHTML = `<h4>${esc(tr(d.name))}</h4><span class="tag" style="--tc:${d.kind === 'chalk' ? 'var(--chalk)' : 'var(--tool)'}">${d.kind === 'chalk' ? t('tag.chalk') : t('tag.tool')}</span><p>${itemDesc(d)}</p>
    ${why ? `<p class="why">${why}</p>` : ''}
    <div class="row"><button class="btn gold" data-act="useItem" data-arg="${uid}" ${why ? 'disabled' : ''}>${t('btn.use')}</button>
    <button class="btn red" data-act="sellItem" data-arg="${uid}" ${S.busy ? 'disabled' : ''}>${t('btn.sell', { n: 1 })}</button>
    <button class="btn" data-act="hideInsp">${t('btn.close')}</button></div>`;
  placeInsp(anchor);
}

/* ---------------- input: one delegated listener ---------------- */
/** UI-only actions that never change the run. */
/** @type {Record<string, (arg: string, target: HTMLElement) => void>} */
const local = {
  inspectJoker: (a, el2) => inspectJoker(a, el2),
  inspectItem: (a, el2) => inspectItem(a, el2),
  hideInsp: () => hideInsp(),
  openInfo: () => showModal('info'),
  openBag: () => showModal('bag'),
  closeModal: () => showModal(null),
  abandon: () => {
    if (!abandonArmed) { abandonArmed = true; renderOverlay(); return; }
    modal = null; abandonArmed = false; if (actions.abandon) actions.abandon();
  },
};

export function initInput() {
  document.addEventListener('click', e => {
    const target = /** @type {HTMLElement} */ (e.target);
    const btn = /** @type {HTMLElement|null} */ (target.closest('[data-act]'));
    if (!btn || (btn instanceof HTMLButtonElement && btn.disabled)) {
      if (!el.insp.hidden && !el.insp.contains(target)) hideInsp();
      return;
    }
    const act = btn.dataset.act || '', arg = btn.dataset.arg || '';
    if (!act.startsWith('inspect') && act !== 'hideInsp') hideInsp();
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
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1000);
}
/** @param {HTMLElement|null} e @param {string} cls */
function retrigger(e, cls) { if (!e) return; e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); }
export const bump = (/** @type {HTMLElement|null} */ e) => { retrigger(e, 'bump'); setTimeout(() => e && e.classList.remove('bump'), 90); };
export const jig = (/** @type {HTMLElement|null} */ e) => retrigger(e, 'jig');
export const shake = () => retrigger($('#app'), 'shake');
/** @param {number} chips @param {number} mult @param {string} [name] */
export function setCalc(chips, mult, name) {
  const c = $('#chips'), m = $('#mult'), h = $('#hname');
  if (c) c.textContent = fmt(chips);
  if (m) m.textContent = fmtM(mult);
  if (h && name !== undefined) h.innerHTML = name || '&nbsp;';
}
export const bumpCalc = (/** @type {'chips'|'mult'} */ which) => bump($('#' + which));
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
