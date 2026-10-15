// @ts-check
/**
 * Balatro X TicTacToe: entry point.
 *
 * Module map
 *   data.js       game content (Jokers, pieces, bosses...) with DA/EN text
 *   state.js      the run as one JSON object, plus saving
 *   geometry.js   N×N board lines and square helpers
 *   rules.js      pure rule helpers (targets, values, board queries)
 *   engine.js     turns, the rival, scoring, the shop
 *   ui.js         rendering, input delegation, scoring effects
 *   strings.js    interface text, number formatting
 *   audio.js      Web Audio sound effects
 *   background.js WebGL felt background
 *   cardfx.js     card tilt, idle sway and edition sheen
 *
 * No build step: the browser loads these ES modules directly, the same
 * way the rest of oskarmatras.com is plain files on Cloudflare Pages.
 */
import { S, loadSettings, saveRun } from './state.js';
import { freshRun } from './rules.js';
import { setLang } from './strings.js';
import { unlock } from './audio.js';
import { startBackground } from './background.js';
import { startCardFx } from './cardfx.js';
import * as ui from './ui.js';
import { actions } from './engine.js';

loadSettings();
freshRun();
S.phase = 'title';

ui.bind(actions);
ui.initInput();
ui.render();

const bg = /** @type {HTMLCanvasElement|null} */ (document.getElementById('bg'));
if (bg) startBackground(bg);
startCardFx();

// Sound may only start after a gesture (iOS Safari is strictest).
addEventListener('pointerdown', unlock, { passive: true });
addEventListener('keydown', unlock);

// The site-wide DA / EN switch in the top bar.
document.addEventListener('langchange', e => {
  setLang(/** @type {CustomEvent} */ (e).detail.lang);
  ui.render();
});

// Phones and tablets often close a tab by switching away from it.
addEventListener('pagehide', saveRun);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveRun(); });

document.documentElement.classList.add('ready');
