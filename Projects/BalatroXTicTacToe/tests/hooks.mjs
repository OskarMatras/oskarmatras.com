import { pathToFileURL } from 'node:url';
const here = new URL('.', import.meta.url);
export async function resolve(spec, ctx, next) {
  if (ctx.parentURL && ctx.parentURL.includes('/BalatroXTicTacToe/js/')) {
    if (spec === './ui.js') return { url: new URL('stub-ui.mjs', here).href, shortCircuit: true };
    if (spec === './audio.js') return { url: new URL('stub-audio.mjs', here).href, shortCircuit: true };
  }
  return next(spec, ctx);
}
