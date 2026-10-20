// @ts-check
/**
 * The cast: every kid, bully and shopkeeper is one small cartoon bust, drawn from a handful of parts (skin,
 * hair, eyes, mouth, one extra) so a new character is one line of data. They are sticker-flat: a thick dark
 * outline, flat colours, no gradients, so they sit well beside the marker and chalk look of the rest of the game.
 */

/** @typedef {{ skin:string, shirt:string, hair?:string, hairKind?:string, eyes?:string, mouth?:string, extra?:string, cap?:string, big?:boolean, trim?:string }} Face */

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
  // the story: the guide, the new kid (you) and the Sixth-Grader, who used to be called Ollie
  pip: { skin: '#b9794c', shirt: '#3fae7a', hair: '#2a1a12', hairKind: 'curls', eyes: 'bright', mouth: 'smile', extra: 'badge' },
  you: { skin: '#ecc19a', shirt: '#2fa7b8', hair: '#7a4a28', hairKind: 'tuft', eyes: 'wide', mouth: 'o', extra: 'straps' },
  ollie: { skin: '#d49a74', shirt: '#22222a', trim: '#d9622b', hair: '#1c1612', hairKind: 'snap', cap: '#d9622b', eyes: 'smug', mouth: 'smirk', extra: 'jacket medal gum', big: true },
  // the grown-ups: the Lunch Lady, a teacher, the caretaker, and the conductor of the school orchestra
  lady: { skin: '#e6b08a', shirt: '#f2efe6', hair: '#b4b4bc', hairKind: 'bun', eyes: 'smug', mouth: 'smirk', extra: 'net ladle' },
  teacher: { skin: '#f0cfae', shirt: '#7a5a8a', hair: '#6a4a3a', hairKind: 'bun', eyes: 'dot', mouth: 'flat', extra: 'glasses lanyard' },
  caretaker: { skin: '#d9a07a', shirt: '#3a5a7a', hair: '#555', hairKind: 'cap', cap: '#2f4f6f', eyes: 'dot', mouth: 'flat', extra: 'moustache' },
  maestro: { skin: '#f3d2b4', shirt: '#1b1b22', hair: '#f2f0e6', hairKind: 'afro', eyes: 'wide', mouth: 'wow', extra: 'baton bowtie' },
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
    case 'curls': return `<g fill="${c}" stroke="${INK}" stroke-width="2.4"><circle cx="14" cy="22" r="7"/><circle cx="23" cy="13" r="7.5"/><circle cx="34" cy="10" r="7.5"/><circle cx="45" cy="14" r="7.5"/><circle cx="52" cy="24" r="6.5"/></g><path d="M14 28 Q32 14 50 28 Q32 22 14 28Z" fill="${c}"/>`;
    case 'afro': return `<circle cx="32" cy="22" r="26" fill="${c}" stroke="${INK}" stroke-width="2.8"/>`;
    case 'ponytail': return `<path d="M12 30 Q12 10 32 10 Q52 10 52 30 Q44 20 32 20 Q20 20 12 30Z" fill="${c}" stroke="${INK}" stroke-width="2.6"/><path d="M50 22 Q64 26 58 44 Q56 34 50 30Z" fill="${c}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;
    case 'sidepart': return `<path d="M11 32 Q10 9 32 9 Q54 9 53 32 Q50 22 38 19 Q24 22 11 32Z" fill="${c}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M26 14 Q30 20 24 22" fill="none" stroke="${INK}" stroke-width="1.8"/>`;
    case 'snap': return `<path d="M12 28 Q12 8 32 8 Q52 8 52 28Z" fill="${cap}" stroke="${INK}" stroke-width="2.8"/><path d="M52 24 L63 22 Q62 29 52 30Z" fill="${cap}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><rect x="11" y="23" width="42" height="5" fill="${INK}" opacity=".35"/><circle cx="32" cy="8" r="2.4" fill="${INK}"/>`;
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
    case 'bright': return `<ellipse cx="24" cy="35" rx="5.4" ry="6.2" fill="#fff" stroke="${INK}" stroke-width="2"/><ellipse cx="40" cy="35" rx="5.4" ry="6.2" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="24.6" cy="36" r="3" fill="${INK}"/><circle cx="40.6" cy="36" r="3" fill="${INK}"/><circle cx="25.6" cy="34.6" r="1.1" fill="#fff"/><circle cx="41.6" cy="34.6" r="1.1" fill="#fff"/><path d="M18 27 Q24 24 29 27 M35 27 Q40 24 46 27" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    case 'joy': return `<path d="M18 37 Q24 28 30 37 M34 37 Q40 28 46 37" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
    case 'worry': return `${w(24)}${w(40)}<path d="M18 31 L29 27 M46 31 L35 27" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
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
    case 'smile': return `<path d="M22 43 Q32 55 42 43Z" fill="#fff" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M26 49 Q32 52 38 49" fill="#e8707e" stroke="none"/>`;
    case 'wow': return `<path d="M23 42 Q32 58 41 42Z" fill="#3a1a1a" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M27 50 Q32 54 37 50 Q32 47 27 50Z" fill="#ef7a8a"/>`;
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
    case 'badge': return `<path d="M44 58 l1.6 3.4 3.6.4 -2.7 2.4.8 3.6 -3.3-1.9 -3.3 1.9.8-3.6 -2.7-2.4 3.6-.4z" fill="#ffd84a" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
    case 'straps': return `<path d="M16 54 L20 66 M48 54 L44 66" stroke="#8a5a2a" stroke-width="4" stroke-linecap="round"/><path d="M16 54 L20 66 M48 54 L44 66" stroke="${INK}" stroke-width="1.2"/>`;
    case 'jacket': return `<path d="M-4 66 Q-4 50 16 50 L22 52 L32 66 L42 52 L48 50 Q68 50 68 66Z" fill="${f.shirt}" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/><path d="M-4 66 Q-4 52 8 50.4 L14 66Z M68 66 Q68 52 56 50.4 L50 66Z" fill="${f.trim || '#d9622b'}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><text x="32" y="64" text-anchor="middle" font-family="Permanent Marker, Impact, sans-serif" font-size="13" fill="${f.trim || '#d9622b'}">6</text>`;
    case 'medal': return `<path d="M26 52 L32 60 L38 52" fill="none" stroke="#f6b92c" stroke-width="2.4"/><circle cx="32" cy="62" r="4.6" fill="none" stroke="#f6b92c" stroke-width="3"/><circle cx="32" cy="62" r="4.6" fill="none" stroke="${INK}" stroke-width=".8"/>`;
    case 'net': return `<path d="M13 30 Q13 8 32 8 Q51 8 51 30" fill="none" stroke="#fff" stroke-width="1.8" stroke-dasharray="2.4 2.4" opacity=".9"/><path d="M20 12 L24 28 M32 8 L32 24 M44 12 L40 28" stroke="#fff" stroke-width="1.2" opacity=".6"/>`;
    case 'ladle': return `<path d="M58 66 L68 28" stroke="#8a8a92" stroke-width="3.4" stroke-linecap="round"/><path d="M58 66 L68 28" stroke="${INK}" stroke-width=".8"/><ellipse cx="69.4" cy="23" rx="6.6" ry="5.2" fill="#9a9aa4" stroke="${INK}" stroke-width="2"/>`;
    case 'lanyard': return `<path d="M24 52 L32 62 L40 52" fill="none" stroke="#d4332a" stroke-width="2.4"/><rect x="29" y="60" width="6.4" height="8" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`;
    case 'moustache': return `<path d="M22 45 Q27 40 32 44.5 Q37 40 42 45 Q37 49 32 46 Q27 49 22 45Z" fill="#3a2a22" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
    case 'baton': return `<path d="M56 62 L78 24" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><path d="M56 62 L78 24" stroke="${INK}" stroke-width=".7"/><circle cx="55" cy="63" r="4.6" fill="${f.skin}" stroke="${INK}" stroke-width="2.2"/>`;
    case 'bowtie': return `<path d="M26 55 L32 58.5 L26 62Z M38 55 L32 58.5 L38 62Z" fill="#d4332a" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
    case 'violin': return `<path d="M0 36 L36 60" stroke="#e8d9b0" stroke-width="1.8"/><g transform="rotate(-26 16 56)"><ellipse cx="16" cy="58" rx="7.6" ry="10.6" fill="#b5651d" stroke="${INK}" stroke-width="2.2"/><rect x="14.4" y="42" width="3.2" height="8" fill="#5a3410" stroke="${INK}" stroke-width="1"/><path d="M12.4 58 h7.2" stroke="${INK}" stroke-width="1.4"/></g>`;
    case 'trombone': return `<path d="M30 58 L10 47 L10 75 L30 64Z" fill="#e0b92c" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M30 58 H80 M30 64 H80 M80 58 V64" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M30 58 H80 M30 64 H80 M80 58 V64" fill="none" stroke="#e0b92c" stroke-width="3" stroke-linecap="round"/>`;
    case 'bass': return `<rect x="59.6" y="0" width="4.4" height="42" fill="#3a2410" stroke="${INK}" stroke-width="1.6"/><circle cx="62" cy="-1" r="3.2" fill="#3a2410" stroke="${INK}" stroke-width="1.6"/><ellipse cx="62" cy="53" rx="10" ry="12" fill="#8a4a1a" stroke="${INK}" stroke-width="2.4"/><ellipse cx="62" cy="70" rx="12.4" ry="14" fill="#8a4a1a" stroke="${INK}" stroke-width="2.4"/><path d="M58 70 q2 -5 4 0 q2 5 4 0" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
    case 'drum': return `<path d="M16 38 L28 54 M48 38 L36 54" stroke="#e8d9b0" stroke-width="2.8" stroke-linecap="round"/><rect x="10" y="56" width="44" height="14" rx="3" fill="#d4332a" stroke="${INK}" stroke-width="2.4"/><ellipse cx="32" cy="56" rx="22" ry="5" fill="#f2efe6" stroke="${INK}" stroke-width="2.4"/>`;
    case 'gum': return `<circle cx="45" cy="49" r="6" fill="#ff8fb8" stroke="${INK}" stroke-width="2"/><path d="M41.5 46 Q43 44 45.5 44.4" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/>`;
    default: return '';
  }
}

/** The look of a mood: the eyes and mouth it overrides, and whether the arms go up. @type {Record<string, { eyes?: string, mouth?: string, arms?: string }>} */
const MOODS = {
  cheer: { eyes: 'joy', mouth: 'wow', arms: 'up' },
  boo: { eyes: 'angry', mouth: 'frown', arms: 'fists' },
  gasp: { eyes: 'wide', mouth: 'o', arms: 'cheeks' },
  worry: { eyes: 'worry', mouth: 'frown' },
  grin: { eyes: 'bright', mouth: 'smile' },
  evil: { eyes: 'smug', mouth: 'grin' },
  smug: { eyes: 'smug', mouth: 'smirk' },
  shock: { eyes: 'wide', mouth: 'o' },
  happy: { eyes: 'bright', mouth: 'smile' },
};

/** Arms behind the body: raised for a cheer, fists for a boo. @param {string} kind @param {Face} f */
function armsBehind(kind, f) {
  if (kind !== 'up' && kind !== 'fists') return '';
  const arm = (/** @type {number} */ x0, /** @type {number} */ x1, /** @type {number} */ y1) => `<path d="M${x0} 58 L${x1} ${y1}" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M${x0} 58 L${x1} ${y1}" stroke="${f.shirt}" stroke-width="5.6" stroke-linecap="round"/><circle cx="${x1}" cy="${y1 - 2}" r="${kind === 'up' ? 5.2 : 6}" fill="${f.skin}" stroke="${INK}" stroke-width="2.4"/>`;
  return arm(10, -4, 18) + arm(54, 68, kind === 'up' ? 10 : 18);
}
/** Hands over the cheeks for a gasp. @param {string} kind @param {Face} f */
function armsFront(kind, f) {
  if (kind !== 'cheeks') return '';
  return `<circle cx="9" cy="44" r="5.4" fill="${f.skin}" stroke="${INK}" stroke-width="2.4"/><circle cx="55" cy="44" r="5.4" fill="${f.skin}" stroke="${INK}" stroke-width="2.4"/>`;
}

/**
 * One character as an inline SVG sticker.
 * @param {string} id a key of CAST (anything else gets a plain face) @param {number} [px] size in CSS pixels
 * @param {string} [mood] cheer | boo | gasp | worry | grin | smug | shock: changes the eyes and mouth, and raises the arms
 * @param {string} [add] extra pieces for this one use, e.g. 'violin' or 'trombone' (the school orchestra)
 */
export function face(id, px = 64, mood = '', add = '') {
  const base = CAST[id] || { skin: '#e8b48a', shirt: '#888', eyes: 'dot', mouth: 'smirk' };
  const m = MOODS[mood] || {};
  const f = { ...base, eyes: m.eyes || base.eyes, mouth: m.mouth || base.mouth };
  const extras = ((base.extra || '') + ' ' + add).split(' ').filter(Boolean);
  const hairKind = f.hairKind || '';
  const behind = hairKind === 'pigtails' || hairKind === 'hood' || hairKind === 'bun' ? hair(hairKind, f.hair || '#333', f.cap) : '';
  const front = behind ? '' : hair(hairKind, f.hair || '#333', f.cap);
  const underBody = extras.filter(e => e === 'pals' || e === 'coat' || e === 'jacket').map(e => extra(e, f)).join('');
  const onTop = extras.filter(e => e !== 'pals' && e !== 'coat' && e !== 'jacket').map(e => extra(e, f)).join('');
  const jaw = f.big ? { rx: 21, ry: 20 } : { rx: 20, ry: 19 };
  return `<svg class="face" viewBox="0 0 64 64" width="${px}" height="${px}" overflow="visible" aria-hidden="true" focusable="false">
    ${armsBehind(m.arms || '', f)}
    ${f.big ? '' : `<path d="M6 66 Q6 52 22 52 L42 52 Q58 52 58 66Z" fill="${f.shirt}" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`}
    ${underBody}
    ${behind}
    <ellipse cx="32" cy="36" rx="${jaw.rx}" ry="${jaw.ry}" fill="${f.skin}" stroke="${INK}" stroke-width="3"/>
    <circle cx="12" cy="38" r="3.4" fill="${f.skin}" stroke="${INK}" stroke-width="2.2"/><circle cx="52" cy="38" r="3.4" fill="${f.skin}" stroke="${INK}" stroke-width="2.2"/>
    ${front}
    ${eyes(f.eyes || 'dot')}${mouth(f.mouth || 'smirk')}
    ${onTop}${armsFront(m.arms || '', f)}
  </svg>`;
}

/* ---- the crowd: a dozen schoolkids put together from the same parts, for the sides of a boss bout and the corners of a story ---- */
const SKINS = ['#f3c9a0', '#e8b48a', '#c68a62', '#a8714a', '#8a5a3a', '#f0cfae'], SHIRTS = ['#e0873a', '#4a90d8', '#6ab86a', '#c9564a', '#9a6ac8', '#e8c25a', '#2e7a78', '#d86aa0'];
const HAIRS = ['#2a1e18', '#6a3f22', '#e0b04a', '#1f1a18', '#8a4a22', '#b8532a'], KINDS = ['tuft', 'bowl', 'spikes', 'pigtails', 'buzz', 'band', 'bun', 'afro', 'ponytail', 'sidepart', 'curls', 'cap', 'beanie'];
const EYES = ['dot', 'wide', 'bright', 'smug'], MOUTHS = ['grin', 'smile', 'smirk', 'o', 'tongue'], EXTRAS = ['', 'freckles', 'gap', 'glasses', 'bandaid', ''];
/** Twelve kids, always the same twelve: k0 ... k11. */
export const CROWD = Array.from({ length: 12 }, (_, i) => {
  const id = 'k' + i, pick = (/** @type {string[]} */ a, /** @type {number} */ m) => a[(i * m + 3) % a.length];
  const c = pick(SHIRTS, 3);
  CAST[id] = { skin: pick(SKINS, 7), shirt: c, hair: pick(HAIRS, 5), hairKind: pick(KINDS, 5), cap: c, eyes: pick(EYES, 3), mouth: pick(MOUTHS, 7), extra: pick(EXTRAS, 5) };
  return id;
});
