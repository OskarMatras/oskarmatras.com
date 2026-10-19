# Balatro X TicTacToe, LÖVE port

A native-desktop port of the browser game (plain JS) to Lua on [LÖVE](https://love2d.org) 11.5.
This folder lives **inside the website repo**, next to the web game it ports (`../js`), so both are versioned,
backed up and pushed together, and the tools below read the web game directly: there is no second copy to keep in step.

## Keeping it in step with the web game

```
node tools/sync.mjs                # regenerate content, list what the Lua port still owes, syntax check, smoke test
node tools/sync.mjs --parity 20    # + replay 20 scripted games on the JS engine and the Lua engine and compare
node tools/sync.mjs --show <id>    # print the web source of a Joker's hooks (what to port)
node tools/sync.mjs --accept a,b   # record Jokers a and b as ported (after the parity test is green)
```

Names, costs and every English and Danish string are generated from the web game (`content_gen.lua`, `strings_gen.lua`),
so a text or number change on the web side is picked up by one command. Behaviour is the part written by hand
(Joker hooks in `src/data.lua`, pieces, bosses and items in `src/engine.lua`, art in `src/widgets.lua`). So that a
regeneration can never break the game, `data.lua` offers the Lua game only what it implements: new web content is
listed as "not yet ported" and left out of the shops, and a Joker whose web hooks changed since it was ported is held
back until it is ported again (`src/ported.lua` keeps a fingerprint per Joker). `lovec . --report` prints both lists.

## Run

```
love .                 # from this folder (LÖVE 11.5; winget install Love2d.Love2d)
```

Mouse: click squares, pieces, cards, buttons. Keyboard: `1`-`9` place on a 3x3 board, `Left`/`Right` pick a piece,
`D` discard, `Enter` continue (title / blind / cash out / shop), `Esc` closes things (or opens Run info),
`F11` or `Alt+Enter` fullscreen. The window is resizable; buttons in the sidebar switch language (EN/DA),
speed, sound, CRT, fullscreen and UI size. Progress is saved after every settled moment to LÖVE's save folder
(`%APPDATA%\LOVE\bxt-love\`) as `run-v3.json` (same v=3 shape as the web save, but cell indices are 1-based, so
web and desktop saves are not interchangeable), `settings.json` and `best.json`.

Build a single file: `powershell tools/build.ps1` → `dist/bxt.love` (run with `love dist/bxt.love`).

## Layout

| Path | What |
| --- | --- |
| `src/state, geometry, rules, data, strings, engine` | the game logic, no drawing (ports of the JS modules) |
| `src/content_gen.lua`, `src/strings_gen.lua` | generated from the JS by `tools/gen_content.js` |
| `src/rng.lua` | seedable xorshift32 (the same one the JS test harness uses) |
| `src/app, view, widgets, gfx, fx, cards, shaders, audio` | LÖVE side: loop, screens, widgets, text, effects, card tilt + shader, GLSL, synthesised sound |
| `lib/json.lua` | small JSON encoder/decoder written for this project |
| `tests/` | parity test against the web game's JS engine (`../js`, headless), save round trip, benchmarks |
| `tools/` | content generator, syntax check, build script |

The engine talks to the interface only through a hook table (`engine.ui`) and runs animated turns as coroutines;
with `engine.async = false` (tests) every action completes instantly. That is what makes headless parity testing possible.

## Tests

```
node tests/run_parity.js 1 60 700     # 60 scripted games: JS engine under node vs the Lua logic under lovec
lovec . --savetest                    # save/load round trip
lovec . --check                       # syntax-check every file
lovec . --report                      # what the web game has that this port does not (yet)
lovec . --autoplay --shots <dir>      # a bot plays ante 1 through the real UI by clicking its buttons; screenshots + frame times
node tests/bench_web.mjs <url> 30     # web version's main-thread cost in headless Chrome (serve a copy of the web game yourself)
```

See `THIRD_PARTY.md` for font licences.
