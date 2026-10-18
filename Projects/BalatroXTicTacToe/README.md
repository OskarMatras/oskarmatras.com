# Balatro X TicTacToe

A roguelike that starts as plain tic-tac-toe. Between rounds you buy Jokers,
special X pieces, square upgrades and a bigger board until the scoring breaks.

Live at https://OskarMatras.com/Projects/BalatroXTicTacToe/

## Stack

Plain HTML, CSS and JavaScript ES modules. No framework and no build step, the
same as the rest of the site: Cloudflare Pages serves these files as they are.

| File | What it holds |
| --- | --- |
| `index.html` | Page shell, site bar, script tags |
| `game.css` | All styling and the three responsive layouts |
| `js/main.js` | Entry point, wires the modules together |
| `js/data.js` | Game content: Jokers, pieces, squares, items, vouchers, bosses (DA and EN text) |
| `js/state.js` | The run as one JSON object, saving to localStorage |
| `js/geometry.js` | N×N board lines and square helpers |
| `js/rules.js` | Pure rule helpers: targets, values, board queries |
| `js/engine.js` | Turns, the rival AI, scoring, the shop |
| `js/ui.js` | Rendering, input delegation, scoring effects |
| `js/strings.js` | Interface text in Danish and English |
| `js/audio.js` | Synthesised sound effects and a looping soundtrack in four moods (Web Audio, no audio files) |
| `js/background.js` | WebGL painted backdrop that changes colour with the blind and pulses with big scores |
| `js/cardfx.js` | Card feel: idle sway, lean toward the pointer, edition sheen |

## Adding content

A new Joker is one entry in `JOKERS` in `js/data.js`. Give it a `line` hook
(runs once per scored line) or an `x` hook (runs for every scoring X) that
returns `{ chips, mult, xmult, money }`, and it shows up in the shop.

## Rules worth knowing

* On a 3×3 board the first line ends a game. From 4×4 up (`OPEN_PLAY_FROM` in `js/rules.js`) finishing a line does
  **not** end the game: keep placing, score more lines, until the rival gets three in a row or nothing is left.
* The shop always shows one Joker; the ante voucher costs $6, $8, then $10.
* Jokers score left to right, and you can move them: Copycat copies its right-hand neighbour and The Muzzle
  silences the left-most Joker.

## Testing without a browser

The engine has no hard dependency on the page, so the `scratchpad`-style harness used during development
loads `engine.js` in Node with stubbed `ui.js` and `audio.js` and plays whole runs in milliseconds: a bot that
plays and shops, unit tests for every mechanic, a smoke test that calls every Joker hook on random boards, and a
validator that checks every card has balanced English and Danish text.

## Card feel

Cards sway on their own (sin/cos of time, phase-shifted per card), lean
toward the pointer when hovered, and ease toward every target instead of
jumping. `cardfx.js` writes the tilt into CSS variables; `game.css` turns
them into a 3D rotation, a glare that slides opposite the lean and the
Foil, Holographic and Polychrome finishes. Inspired by how Balatro's card
feel is built (see the MIT-licensed mixandjam/balatro-feel breakdown).

## Layouts

* Stacked: phones and iPads held upright.
* Sidebar: landscape at 760px and wider (iPad landscape, laptops).
* Short landscape: phones on their side; board and pieces sit side by side.

The board is the largest square that fits its space, using CSS container
query units, so it adapts to any screen without JavaScript measuring.

## Checking the code

All modules carry `// @ts-check` with JSDoc types, so TypeScript can verify
them without a build:

```
npx -p typescript tsc --noEmit --allowJs --checkJs --target es2020 \
  --module es2020 --moduleResolution node --lib es2020,dom,dom.iterable js/main.js
```

To run locally, serve the repository root (for example `python -m http.server`)
and open `/Projects/BalatroXTicTacToe/`. Opening the file directly does not
work because browsers block ES modules from `file://`.
