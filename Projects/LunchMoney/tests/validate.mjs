import { D, S, R } from './bot.mjs';
let bad = 0; const err = m => { bad++; console.log('PROBLEM', m); };
const tags = s => { const o = (s.match(/<(i|em|u|b)>/g) || []).length, c = (s.match(/<\/(i|em|u|b)>/g) || []).length; return o === c; };
const chk = (where, o) => {
  if (!o || typeof o !== 'object') return err(where + ' missing text');
  for (const l of ['en', 'da']) { if (!o[l] || !o[l].trim()) err(where + ' empty ' + l); else { if (!tags(o[l])) err(where + ' unbalanced tags ' + l); if (/undefined|\[object|NaN/.test(o[l])) err(where + ' bad value ' + l); } }
  if (o.en && o.da && o.en === o.da && o.en.length > 14) console.log('  note: identical en/da', where);
};
R.freshRun();
for (const [k, v] of Object.entries(D.PIECES)) { chk('piece ' + k + '.name', v.name); chk('piece ' + k + '.desc', v.desc); if (k !== 'plain') chk('piece ' + k + '.short', v.short); if (!v.pc) err('piece pc ' + k); }
for (const [k, v] of Object.entries(D.TILES)) { chk('tile ' + k + '.name', v.name); chk('tile ' + k + '.desc', v.desc); if (typeof v.badge(1) !== 'string') err('tile badge ' + k); }
for (const [k, v] of Object.entries(D.JOKERS)) {
  if (!v.name || !v.gl || !v.cost || !v.rar) err('joker fields ' + k);
  chk('joker ' + k + '.desc', v.desc({ data: {} }));
  chk('joker ' + k + '.desc(j)', v.desc({ data: { m: 5, n: 3 } }));
}
for (const [k, v] of Object.entries(D.ITEMS)) { chk('item ' + k + '.name', v.name); if (v.kind === 'tool') chk('item ' + k + '.desc', v.desc); if (!v.gl) err('item gl ' + k); }
for (const [k, v] of Object.entries(D.VOUCHERS)) { chk('voucher ' + k + '.name', v.name); chk('voucher ' + k + '.desc', v.desc); }
for (const [k, v] of Object.entries(D.DECKS)) { chk('deck ' + k + '.name', v.name); chk('deck ' + k + '.desc', v.desc); }
for (const [k, v] of Object.entries(D.EDITIONS)) { chk('edition ' + k + '.name', v.name); chk('edition ' + k + '.desc', v.desc); }
for (const [k, v] of Object.entries(D.BOSSES)) { chk('boss ' + k + '.name', v.name); chk('boss ' + k + '.desc', v.desc); }
for (const [k, v] of Object.entries(D.PACKS)) { chk('pack ' + k + '.name', v.name); chk('pack ' + k + '.desc', v.desc); }
for (const [k, v] of Object.entries(D.EDITS)) { chk('edit ' + k + '.name', v.name); chk('edit ' + k + '.desc', v.desc); }
const css = (await import('node:fs')).readFileSync(new URL('../game.css', import.meta.url), 'utf8');
for (const k of Object.keys(D.PIECES)) if (k !== 'plain' && !css.includes('.t-' + k)) err('no css for piece ' + k);
for (const k of Object.keys(D.TILES)) if (!css.includes('.tb.' + k)) err('no css for tile ' + k);
const jokers = Object.keys(D.JOKERS).length;
console.log(`checked: ${jokers} jokers, ${Object.keys(D.PIECES).length} pieces, ${Object.keys(D.TILES).length} tiles, ${Object.keys(D.ITEMS).length} items, ${Object.keys(D.VOUCHERS).length} vouchers, ${Object.keys(D.BOSSES).length} bosses; problems: ${bad}`);
