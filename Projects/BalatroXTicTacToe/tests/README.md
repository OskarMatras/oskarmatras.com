# Tests and tools

Everything here runs with plain Node (24+), no install step. The engine is loaded headlessly: `hooks.mjs` swaps
`ui.js` and `audio.js` for the stubs next to it, so whole runs play in milliseconds.

| Script | What it does |
| --- | --- |
| `node units.mjs` | One test per mechanic (Sprout growth, Cursed, Turncoat, traps, Safety Net, bosses, vouchers, open play...) |
| `node smoke.mjs` | Calls every Joker hook on hundreds of random boards (3x3, 4x4, 5x5) and checks the results |
| `node validate.mjs` | Every card has balanced English and Danish text, and the CSS knows every piece and square |
| `node bot.mjs 300` | A bot plays 300 whole runs; prints how far they got. Pass options as JSON: `node bot.mjs 300 '{"reserve":5}'` |
| `node dist.mjs 600` | Where runs die, by ante and blind (the difficulty curve) |
| `node diag.mjs 300` | Per-ante averages: lines per game, bust rate, average line |
| `node content.mjs 150 jokers` | Gives each Joker (or piece) to the bot from the start and compares progress. Noisy: read it as a hint |
| `node boss.mjs` | Which boss ends the most runs |
| `node audiotest.mjs` | Runs the soundtrack scheduler against a fake Web Audio and checks nothing throws |
| `node scenes.mjs 1280 800 d` | Needs Chrome and the game served on localhost:8099 (`node ../../../scratchpad/serve.mjs`-style static server). Drives the real page through the title, play, scoring, cash-out, shop and pack screens and saves PNGs to `shots/` |

`cdp.mjs` is a tiny Chrome DevTools Protocol driver (launch headless Chrome, evaluate JS, screenshot) used by the scene scripts.

More: `fuzz.mjs` (chaos test: random, often nonsensical actions in every phase; nothing may throw), `power.mjs` (how much each Joker multiplies a typical line, a quick balance sniff test),
`dup.mjs` (no duplicate Jokers in a shop), `i18n.mjs` (English and Danish interface strings match), `uibot.mjs` (plays the real page with real mouse clicks; add `cheat` to reach many shops fast),
`persist.mjs` (save in every kind of screen, reload, Continue), `modals.mjs` / `deck.mjs` / `jpack.mjs` / `ante.mjs` / `threat.mjs` (screenshots of particular screens).
