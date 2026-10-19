// A fingerprint of a Joker's behaviour in the web game: the source of its hooks, whitespace removed.
// gen_content.js writes it into content_gen.lua; src/ported.lua records the fingerprint each Joker had when
// it was last ported. A Joker whose web hooks changed since (different fingerprint) is "stale": the Lua game
// stops offering it until it is ported again (node tools/sync.mjs --accept <id> records the new one).
import { createHash } from 'node:crypto';
export function hookHash(j) {
  const src = ['line', 'x', 'endRound', 'req', 'val', 'gameEnd'].map(k => (typeof j[k] === 'function' ? k + ':' + j[k].toString() : '')).join('|');
  return createHash('sha1').update(src.replace(/\s+/g, '')).digest('hex').slice(0, 10);
}
