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
import { sfx } from './audio.js';

let arrived = false;
let mood = '';
/** @type {any} */ let timer = null;

/** The kids for the left and right edges, and what each plays: the school orchestra comes to a boss bout, with the
 * maestro conducting from the left. Which kid stands where is fixed, so a redraw never reshuffles them. */
const LEFT = [['k0', 'violin'], ['k1', 'trombone'], ['k2', 'violin'], ['k3', 'violin'], ['maestro', '']];
const RIGHT = [['k5', 'trombone'], ['k6', 'drum'], ['k7', 'violin'], ['k8', 'bass'], ['k9', 'trombone']];

const bouts = () => S.phase === 'play' && S.blindIdx === 2;

/** The markup to put inside the stage while a boss bout is on; an empty string otherwise. */
export function crowdHTML() {
  if (!bouts()) { arrived = false; mood = ''; return ''; }
  const first = !arrived; arrived = true;
  /** @param {string[][]} kids @param {'L'|'R'} side */
  const group = (kids, side) => `<div class="crowdSide ${side}${first ? ' arrive' : ''}">${kids.map(([id, inst], k) =>
    `<span class="cf" style="--k:${k}" data-id="${id}" data-add="${inst}">${face(id, 88, mood, inst)}</span>`).join('')}</div>`;
  return `<div class="crowd${mood ? ' m-' + mood : ''}" aria-hidden="true">${group(LEFT, 'L')}${group(RIGHT, 'R')}</div>`;
}

/** The crowd reacts for a moment. @param {'cheer'|'boo'|'gasp'} kind @param {number} [ms] */
export function crowdReact(kind, ms = 1700) {
  if (!bouts()) return;
  mood = kind;
  if (kind === 'boo') sfx.boo(); else if (kind === 'gasp') sfx.gasp();
  repaint();
  clearTimeout(timer);
  timer = setTimeout(() => { mood = ''; repaint(); }, ms);
}

function repaint() {
  const root = document.querySelector('.crowd');
  if (!root) return;
  root.className = 'crowd' + (mood ? ' m-' + mood : '');
  root.querySelectorAll('.cf').forEach(n => { const el = /** @type {HTMLElement} */ (n); el.innerHTML = face(el.dataset.id || 'k0', 88, mood, el.dataset.add || ''); });
}
