// @ts-check
/**
 * The cast: every kid, bully and shopkeeper is one small cartoon bust, drawn from a handful of parts (skin,
 * hair, eyes, mouth, one extra) so a new character is one line of data. They are sticker-flat: a thick dark
 * outline, flat colours, no gradients, so they sit well beside the marker and chalk look of the rest of the game.
 */

/** @typedef {{ skin:string, shirt:string, hair?:string, hairKind?:string, eyes?:string, mouth?:string, extra?:string, cap?:string }} Face */

const INK = '#1b1612';
/** @type {Record<string, Face>} */
export const CAST = {
  // the kids who run each turf
  sandbox: { skin: '#f3c9a0', shirt: '#e8c25a', hair: '#e0b04a', hairKind: 'tuft', eyes: 'wide', mouth: 'o', extra: 'freckles' },
  swings: { skin: '#e8b48a', shirt: '#4a90d8', hair: '#6a3f22', hairKind: 'bowl', eyes: 'dot', mouth: 'grin', extra: 'gap' },
  bars: { skin: '#a8714a', shirt: '#e0873a', hair: '#1f1a18', hairKind: 'spikes', eyes: 'wide', mouth: 'tongue' },
  sheds: { skin: '#f0c4a0', shirt: '#4a5560', hair: '#2a2020', hairKind: 'pigtails', eyes: 'angry', mouth: 'smirk', extra: 'bandaid' },
  canteen: { skin: '#e6b08a', shirt: '#6ab86a', hair: '#8a4a22', hairKind: 'buzz', eyes: 'dot', mouth: 'grin', extra: 'sauce' },
  gym: { skin: '#c68a62', shirt: '#c9564a', hair: '#2a1e18', hairKind: 'band', eyes: 'smug', mouth: 'smirk', extra: 'whistle' },
  roof: { skin: '#f0cfae', shirt: '#9a6ac8', hair: '#7a7a82', hairKind: 'hood', eyes: 'smug', mouth: 'flat' },
  office: { skin: '#e9c3a0', shirt: '#2f4f6f', hair: '#9a9aa0', hairKind: 'bun', eyes: 'smug', mouth: 'flat', extra: 'glasses' },
  detention: { skin: '#cfcfcf', shirt: '#4a4a4a', hair: '#222', hairKind: 'buzz', eyes: 'angry', mouth: 'frown' },
  // the bullies
  wall: { skin: '#d9a07a', shirt: '#7a6a55', hair: '#3a2a1e', hairKind: 'buzz', eyes: 'angry', mouth: 'frown', extra: 'scar' },
  crowd: { skin: '#e8b48a', shirt: '#6b5a8a', hair: '#2a2020', hairKind: 'spikes', eyes: 'angry', mouth: 'grin', extra: 'pals' },
  thief: { skin: '#f0c4a0', shirt: '#8a2e4a', hair: '#1f1a18', hairKind: 'cap', cap: '#8a2e4a', eyes: 'smug', mouth: 'smirk', extra: 'mask' },
  master: { skin: '#f3c9a0', shirt: '#2b4f8a', hair: '#d8d8e0', hairKind: 'bowl', eyes: 'smug', mouth: 'flat', extra: 'glasses' },
  needle: { skin: '#e8b48a', shirt: '#4c7a2e', hair: '#7a4a22', hairKind: 'tuft', eyes: 'wide', mouth: 'o', extra: 'bell' },
  drought: { skin: '#c68a62', shirt: '#a0662a', hair: '#1f1a18', hairKind: 'cap', cap: '#f0d060', eyes: 'angry', mouth: 'flat', extra: 'whistle' },
  echo: { skin: '#f0c4a0', shirt: '#2e7a78', hair: '#2a1e18', hairKind: 'bowl', eyes: 'smug', mouth: 'grin', extra: 'cards' },
  muzzle: { skin: '#f3d2b4', shirt: '#7a3b3b', hair: '#6a3f22', hairKind: 'bun', eyes: 'angry', mouth: 'flat', extra: 'finger' },
  clamp: { skin: '#a8714a', shirt: '#55606b', hair: '#1f1a18', hairKind: 'beanie', cap: '#55606b', eyes: 'smug', mouth: 'smirk' },
  siege: { skin: '#e0a880', shirt: '#8a4a2a', hair: '#4a2a1a', hairKind: 'mohawk', eyes: 'angry', mouth: 'grin', extra: 'pals' },
  toll: { skin: '#f0c4a0', shirt: '#8a7a2e', hair: '#2a2020', hairKind: 'cap', cap: '#8a7a2e', eyes: 'smug', mouth: 'grin', extra: 'coin' },
  // the shopkeeper
  squint: { skin: '#e8b48a', shirt: '#6a5a44', hair: '#2a2020', hairKind: 'fedora', cap: '#3a3028', eyes: 'squint', mouth: 'smirk', extra: 'coat' },
};

/** @param {string} kind @param {string} c */
function hair(kind, c, cap) {
  switch (kind) {
    case 'tuft': return `<path d="M22 22 Q32 6 42 22 Q36 16 32 18 Q28 14 22 22Z" fill="${c}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M30 14 Q32 6 36 10" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'bowl': return `<path d="M10 34 Q10 10 32 10 Q54 10 54 34 Q50 24 32 22 Q14 24 10 34Z" fill="${c}" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`;
    case 'spikes': return `<path d="M12 28 L14 12 L22 20 L26 6 L32 18 L38 6 L42 20 L50 12 L52 28 Q32 14 12 28Z" fill="${c}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
    case 'pigtails': return `<path d="M12 30 Q12 10 32 10 Q52 10 52 30 Q44 20 32 20 Q20 20 12 30Z" fill="${c}" stroke="${INK}" stroke-width="2.6"/><circle cx="8" cy="34" r="7" fill="${c}" stroke="${INK}" stroke-width="2.6"/><circle cx="56" cy="34" r="7" fill="${c}" stroke="${INK}" stroke-width="2.6"/>`;
    case 'buzz': return `<path d="M13 30 Q13 11 32 11 Q51 11 51 30 Q42 20 32 20 Q22 20 13 30Z" fill="${c}" stroke="${INK}" stroke-width="2.6" opacity=".95"/>`;
    case 'band': return `<path d="M12 30 Q12 10 32 10 Q52 10 52 30 Q44 20 32 20 Q20 20 12 30Z" fill="${c}" stroke="${INK}" stroke-width="2.6"/><rect x="11" y="21" width="42" height="6" rx="2" fill="#f2f0e6" stroke="${INK}" stroke-width="2.4"/>`;
    case 'hood': return `<path d="M8 40 Q6 6 32 6 Q58 6 56 40 L48 38 Q50 20 32 18 Q14 20 16 38Z" fill="${c}" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`;
    case 'bun': return `<circle cx="32" cy="8" r="7" fill="${c}" stroke="${INK}" stroke-width="2.6"/><path d="M12 30 Q12 11 32 11 Q52 11 52 30 Q44 20 32 20 Q20 20 12 30Z" fill="${c}" stroke="${INK}" stroke-width="2.6"/>`;
    case 'mohawk': return `<path d="M26 22 L28 4 L32 14 L36 2 L38 22Z" fill="${c}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
    case 'cap': return `<path d="M12 28 Q12 8 32 8 Q52 8 52 28Z" fill="${cap}" stroke="${INK}" stroke-width="2.8"/><path d="M12 28 L2 30 Q4 34 14 32Z" fill="${cap}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="32" cy="8" r="2.4" fill="${INK}"/>`;
    case 'beanie': return `<path d="M11 28 Q10 6 32 6 Q54 6 53 28Z" fill="${cap}" stroke="${INK}" stroke-width="2.8"/><rect x="10" y="24" width="44" height="7" rx="3" fill="${cap}" stroke="${INK}" stroke-width="2.6"/><circle cx="32" cy="5" r="4" fill="#f2f0e6" stroke="${INK}" stroke-width="2.4"/>`;
    case 'fedora': return `<ellipse cx="32" cy="22" rx="26" ry="7" fill="${cap}" stroke="${INK}" stroke-width="2.8"/><path d="M18 22 Q18 6 32 6 Q46 6 46 22Z" fill="${cap}" stroke="${INK}" stroke-width="2.8"/><rect x="18" y="16" width="28" height="4" fill="#b98d56"/>`;
    default: return '';
  }
}
/** @param {string} kind */
function eyes(kind) {
  const w = (/** @type {number} */ x) => `<ellipse cx="${x}" cy="35" rx="4.6" ry="5.4" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="${x + 0.6}" cy="36" r="2.2" fill="${INK}"/>`;
  switch (kind) {
    case 'angry': return `${w(24)}${w(40)}<path d="M18 28 L29 32 M46 28 L35 32" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
    case 'smug': return `<path d="M19 36 Q24 31 29 36 Z M35 36 Q40 31 45 36 Z" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="25" cy="35.4" r="1.8" fill="${INK}"/><circle cx="41" cy="35.4" r="1.8" fill="${INK}"/><path d="M19 32 L29 31 M35 31 L46 30" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'wide': return `<circle cx="24" cy="35" r="6" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="40" cy="35" r="6" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="24.5" cy="36" r="2.4" fill="${INK}"/><circle cx="40.5" cy="36" r="2.4" fill="${INK}"/>`;
    case 'squint': return `<path d="M19 36 L29 35 M35 35 L45 36" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M19 31 L28 33 M36 33 L45 31" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
    default: return `<circle cx="24" cy="35" r="2.8" fill="${INK}"/><circle cx="40" cy="35" r="2.8" fill="${INK}"/>`;
  }
}
/** @param {string} kind */
function mouth(kind) {
  switch (kind) {
    case 'smirk': return `<path d="M24 47 Q32 51 42 44" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'frown': return `<path d="M24 49 Q32 43 40 49" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'grin': return `<path d="M22 44 Q32 54 42 44Z" fill="#fff" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M27 46 L27 49 M32 47 L32 51 M37 46 L37 49" stroke="${INK}" stroke-width="1.4"/>`;
    case 'o': return `<ellipse cx="32" cy="47" rx="3.6" ry="4.4" fill="${INK}"/>`;
    case 'flat': return `<path d="M25 47 L39 47" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'tongue': return `<path d="M23 44 Q32 52 41 44Z" fill="#3a1a1a" stroke="${INK}" stroke-width="2.4"/><path d="M29 48 Q32 55 36 48Z" fill="#ef7a8a" stroke="${INK}" stroke-width="2"/>`;
    default: return `<path d="M25 46 Q32 50 39 46" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  }
}
/** @param {string} kind @param {Face} f */
function extra(kind, f) {
  switch (kind) {
    case 'freckles': return `<g fill="#b4683a"><circle cx="21" cy="41" r="1.2"/><circle cx="25" cy="43" r="1.2"/><circle cx="43" cy="41" r="1.2"/><circle cx="39" cy="43" r="1.2"/></g>`;
    case 'gap': return `<rect x="30" y="45" width="4" height="4" fill="#fff"/>`;
    case 'bandaid': return `<g transform="rotate(-20 42 28)"><rect x="35" y="25" width="14" height="6" rx="2" fill="#f0c9a0" stroke="${INK}" stroke-width="1.8"/></g>`;
    case 'glasses': return `<circle cx="24" cy="35" r="7.4" fill="rgba(255,255,255,.35)" stroke="${INK}" stroke-width="2.4"/><circle cx="40" cy="35" r="7.4" fill="rgba(255,255,255,.35)" stroke="${INK}" stroke-width="2.4"/><path d="M31.4 35 L32.6 35" stroke="${INK}" stroke-width="2.4"/>`;
    case 'scar': return `<path d="M42 26 L48 38" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M41 31 L46 29 M44 35 L49 33" stroke="${INK}" stroke-width="1.8"/>`;
    case 'sauce': return `<path d="M36 50 Q42 49 44 52 Q40 55 35 53Z" fill="#d4332a" stroke="${INK}" stroke-width="1.6"/>`;
    case 'whistle': return `<path d="M32 58 L24 64" stroke="#ddd" stroke-width="2"/><circle cx="23" cy="63" r="4" fill="#d8d8d8" stroke="${INK}" stroke-width="2"/>`;
    case 'mask': return `<path d="M17 31 Q32 26 47 31 L47 39 Q32 35 17 39Z" fill="#2a2028" stroke="${INK}" stroke-width="2"/>`;
    case 'bell': return `<path d="M50 54 Q50 46 56 46 Q62 46 62 54Z" fill="#e8c56a" stroke="${INK}" stroke-width="2.2"/><circle cx="56" cy="56" r="2" fill="${INK}"/>`;
    case 'cards': return `<rect x="46" y="50" width="12" height="16" rx="2" fill="#f2f0e6" stroke="${INK}" stroke-width="2" transform="rotate(14 52 58)"/><rect x="42" y="50" width="12" height="16" rx="2" fill="#d4332a" stroke="${INK}" stroke-width="2" transform="rotate(-8 48 58)"/>`;
    case 'finger': return `<rect x="38" y="46" width="3.6" height="13" rx="1.8" fill="${f.skin}" stroke="${INK}" stroke-width="2"/>`;
    case 'coin': return `<circle cx="52" cy="56" r="6" fill="#f6b92c" stroke="${INK}" stroke-width="2.4"/><path d="M52 52 L52 60" stroke="${INK}" stroke-width="2"/>`;
    case 'pals': return `<circle cx="6" cy="52" r="6" fill="${f.skin}" stroke="${INK}" stroke-width="2.4"/><circle cx="58" cy="52" r="6" fill="${f.skin}" stroke="${INK}" stroke-width="2.4"/>`;
    case 'coat': return `<path d="M8 64 L12 50 L26 54 L32 62 L38 54 L52 50 L56 64Z" fill="#4a4036" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M32 62 L32 54" stroke="${INK}" stroke-width="2"/>`;
    default: return '';
  }
}

/**
 * One character as an inline SVG sticker.
 * @param {string} id a key of CAST (anything else gets a plain face) @param {number} [px] size in CSS pixels
 */
export function face(id, px = 64) {
  const f = CAST[id] || { skin: '#e8b48a', shirt: '#888', eyes: 'dot', mouth: 'smirk' };
  if (id === 'ollie') return ollieKing(px);
  const hairKind = f.hairKind || '';
  const behind = hairKind === 'pigtails' || hairKind === 'hood' || hairKind === 'bun' ? hair(hairKind, f.hair || '#333', f.cap) : '';
  const front = behind ? '' : hair(hairKind, f.hair || '#333', f.cap);
  return `<svg class="face" viewBox="0 0 64 64" width="${px}" height="${px}" aria-hidden="true" focusable="false">
    <path d="M6 66 Q6 52 22 52 L42 52 Q58 52 58 66Z" fill="${f.shirt}" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
    ${f.extra === 'pals' || f.extra === 'coat' ? extra(f.extra, f) : ''}
    ${behind}
    <ellipse cx="32" cy="36" rx="20" ry="19" fill="${f.skin}" stroke="${INK}" stroke-width="3"/>
    <circle cx="12" cy="38" r="3.4" fill="${f.skin}" stroke="${INK}" stroke-width="2.2"/><circle cx="52" cy="38" r="3.4" fill="${f.skin}" stroke="${INK}" stroke-width="2.2"/>
    ${front}
    ${eyes(f.eyes || 'dot')}${mouth(f.mouth || 'smirk')}
    ${f.extra && f.extra !== 'pals' && f.extra !== 'coat' ? extra(f.extra, f) : ''}
  </svg>`;
}

/** Ollie: the rival O himself, with a crown for the last turf. @param {number} px */
function ollieKing(px) {
  return `<svg class="face" viewBox="0 0 64 64" width="${px}" height="${px}" aria-hidden="true" focusable="false">
    <circle cx="32" cy="38" r="23" fill="none" stroke="#7a3510" stroke-width="12"/>
    <circle cx="32" cy="35" r="23" fill="none" stroke="#ff7b3a" stroke-width="12"/>
    <path d="M14.5 28 A19 19 0 0 1 27 16.5" fill="none" stroke="#ffb27d" stroke-width="3" stroke-linecap="round" opacity=".85"/>
    <circle cx="32" cy="35" r="17" fill="#1a2524"/>
    <ellipse cx="25" cy="32" rx="4.4" ry="5.2" fill="#fff"/><ellipse cx="39" cy="32" rx="4.4" ry="5.2" fill="#fff"/><circle cx="26.4" cy="33.4" r="2.3" fill="#1a2524"/><circle cx="40.4" cy="33.4" r="2.3" fill="#1a2524"/>
    <path d="M19.5 25.5 L29 26.5 M35 23.5 L44.5 20.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <path d="M25 44 Q33 48.5 42 41" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <path d="M17 16 L19 2 L26 10 L32 0 L38 10 L45 2 L47 16Z" fill="#f6b92c" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    <circle cx="19" cy="2" r="2" fill="#d4332a"/><circle cx="32" cy="0" r="2" fill="#d4332a"/><circle cx="45" cy="2" r="2" fill="#d4332a"/>
  </svg>`;
}
