// @ts-check
/**
 * The crowd: in a boss bout the kids of the yard come running in from both sides and stand along the edges of
 * the play area. They cheer when you score, gasp when the rival is about to win, boo when he does or when the
 * Sixth-Grader cheats. Pure decoration: pointer-events are off and nothing here changes the game.
 *
 * The play screen is redrawn on every move, so the crowd keeps its own mood in a module variable and only
 * plays its entrance the first time it is drawn for a bout.
 */
import { S } from './state.js';
import { face, CROWD } from './faces.js';

let arrived = false;
let mood = '';
/** @type {any} */ let timer = null;

/** The kids for the left and right edges. Which twelve stand where is fixed, so a redraw never reshuffles them. */
const LEFT = CROWD.slice(0, 5), RIGHT = CROWD.slice(5, 10);

const bouts = () => S.phase === 'play' && S.blindIdx === 2;

/** The markup to put inside the stage while a boss bout is on; an empty string otherwise. */
export function crowdHTML() {
  if (!bouts()) { arrived = false; mood = ''; return ''; }
  const first = !arrived; arrived = true;
  /** @param {string[]} ids @param {'L'|'R'} side */
  const group = (ids, side) => `<div class="crowdSide ${side}${first ? ' arrive' : ''}">${ids.map((id, k) =>
    `<span class="cf" style="--k:${k}" data-id="${id}">${face(id, 88, mood)}</span>`).join('')}</div>`;
  return `<div class="crowd${mood ? ' m-' + mood : ''}" aria-hidden="true">${group(LEFT, 'L')}${group(RIGHT, 'R')}</div>`;
}

/** The crowd reacts for a moment. @param {'cheer'|'boo'|'gasp'} kind @param {number} [ms] */
export function crowdReact(kind, ms = 1700) {
  if (!bouts()) return;
  mood = kind;
  repaint();
  clearTimeout(timer);
  timer = setTimeout(() => { mood = ''; repaint(); }, ms);
}

function repaint() {
  const root = document.querySelector('.crowd');
  if (!root) return;
  root.className = 'crowd' + (mood ? ' m-' + mood : '');
  root.querySelectorAll('.cf').forEach(n => { const el = /** @type {HTMLElement} */ (n); el.innerHTML = face(el.dataset.id || 'k0', 88, mood); });
}
