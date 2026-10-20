// No two copies of a Joker in one shop, across many shops.
import { S, E, R, D, seed } from './bot.mjs';
let dups = 0, shops = 0, noJoker = 0;
for (let i = 1; i <= 400; i++) {
  seed(i); R.freshRun(); S.ante = 1 + i % 8; S.phase = 'shop'; S.blindIdx = 0;
  // makeShop is private: reroll is the public way to draw fresh cards
  S.shop = { items: [], voucher: null, vSold: false, reroll: 1, trimmed: false, packs: [] }; S.money = 1000; S.anteVoucher = { ante: S.ante, id: null, bought: false };
  for (let k = 0; k < 5; k++) { E.actions.reroll(); shops++; const ids = S.shop.items.filter(c => c.kind === 'joker').map(c => c.id); if (new Set(ids).size !== ids.length) dups++; if (!ids.length) noJoker++; }
}
console.log(`shops ${shops}, duplicate jokers ${dups}, shops without a joker ${noJoker}`);
