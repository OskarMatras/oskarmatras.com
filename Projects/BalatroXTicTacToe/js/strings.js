// @ts-check
/**
 * Interface text in Danish and English.
 *
 * The site's own /i18n.js owns the language choice (stored under
 * "om-lang" and shown as the DA / EN switch in the top bar). This module
 * reads the same choice and listens for the site's `langchange` event,
 * so the game and the page around it always agree.
 *
 * Content text (Jokers, pieces, bosses) lives in data.js as {en, da}
 * pairs and goes through `tr()`.
 */

/** @type {Record<string, string>} */
const EN = {
  'toast.first': 'Tap a square to place your X. Three in a row scores.',
  'pop.mirror': 'Mirrored!',
  'ui.packs': 'Packs', 'btn.open': 'Open', 'btn.take': 'Take', 'btn.taken': 'Taken', 'btn.skipPack': 'Skip the rest',
  'pack.left': 'Pick {n} more', 'pack.left1': 'Pick 1', 'kind.pack': 'Booster pack', 'tip.selectAgain': 'Tap again for details',
  'blind.small': 'Small Blind', 'blind.big': 'Big Blind',
  'blind.smallDesc': 'A warm-up round', 'blind.bigDesc': 'Bigger target, bigger payout',
  'ui.scoreAtLeast': 'Score at least', 'ui.roundScore': 'Round score',
  'ui.games': 'Games', 'ui.discards': 'Discards', 'ui.ante': 'Ante', 'ui.round': 'Round',
  'ui.runInfo': 'Run info', 'ui.bag': 'Bag', 'ui.speed': 'Speed {n}x', 'ui.soundOn': 'Sound on', 'ui.soundOff': 'Sound off',
  'ui.shop': 'Shop', 'ui.shopDesc': 'Stack your synergies', 'ui.nextUp': 'Next up',
  'ui.chooseBlind': 'Choose a blind', 'ui.nextTarget': 'Next target',
  'ui.jokers': 'Jokers', 'ui.items': 'Items',
  'ui.noJokers': 'No Jokers yet. Buy them in the shop: each one bends the rules of tic-tac-toe.',
  'ui.anteN': 'Ante {n}', 'ui.endless': '(endless)', 'ui.reward': 'Reward', 'ui.boss': 'BOSS',
  'hint.erase': "Tap one of the rival's <b>O</b> marks to erase it.",
  'hint.first': 'Tap a square to place your <b>X</b>. Get three in a row to score.',
  'hint.tap': 'Tap a square to place your X',
  'meta.game': 'Game {n} of {m}', 'meta.overtime': 'Overtime on', 'meta.firstLine': 'First line wins', 'meta.bag': 'Bag {n}',
  'btn.discard': 'Discard selected', 'btn.cancel': 'Cancel', 'btn.play': 'Play', 'btn.skip': 'Skip for a free item',
  'btn.defeated': 'Defeated', 'btn.upcoming': 'Upcoming', 'btn.buy': 'Buy', 'btn.sold': 'Sold',
  'btn.cancelRefund': 'Cancel (refund)', 'btn.reroll': 'Reroll ${n}', 'btn.trim': 'Trim a Plain X $3',
  'btn.nextRound': 'Next round', 'btn.continue': 'Continue run', 'btn.newRun': 'New run', 'btn.close': 'Close',
  'btn.abandon': 'Abandon run', 'btn.abandonSure': 'Tap again to abandon', 'btn.endless': 'Keep going (endless)',
  'btn.use': 'Use', 'btn.sell': 'Sell ${n}',
  'kind.joker': '{r} Joker', 'kind.piece': 'Piece: goes in your bag', 'kind.tile': 'Square upgrade (permanent)',
  'kind.voucher': 'Voucher (permanent)', 'kind.chalk': 'Chalk: levels a score type', 'kind.tool': 'Tool',
  'tag.chalk': 'Chalk', 'tag.tool': 'Tool',
  'chalk.desc': 'Level up <b>{name}</b>: <i>+{c}</i> Chips, <em>+{m}</em> Mult',
  'tile.pick': 'Tap a square to apply <b>{name}</b>. Upgrades on the same square stack.',
  'trim.title': 'Fewer Plain X means you draw your special pieces more often',
  'title.sub': "It starts as plain tic-tac-toe. It doesn't stay that way.",
  'title.best': 'Best: ante {a}, top score {s}.',
  'how.1': '<b>Tap a square to place your X.</b> Your rival answers with an O. Three in a row scores <span class="c">Chips</span> &times; <span class="m">Mult</span>. Draws score a little too.',
  'how.2': "<b>Beat each blind's target</b> within 4 games. Your rival gets sharper every ante, so playing well stops being enough.",
  'how.3': '<b>Stack synergies in the shop.</b> Jokers bend the rules, special X pieces go in your bag, squares get upgraded, and the board itself can grow to 5&times;5.',
  'how.4': '<b>Find a combo that breaks the math.</b> Clear ante 8 to win, then go endless.',
  'cash.title': 'Blind cleared!', 'cash.final': 'Final score <b>{a}</b> of {b}', 'cash.cleared': '{name} cleared',
  'cash.unused': '{n} unused games ($1 each)', 'cash.unused1': '1 unused game ($1)',
  'cash.interest': 'Interest ($1 per $5 held, max $5)', 'cash.btn': 'Cash out ${n}', 'cash.banana': 'Banana Bomb went off and is gone.',
  'over.title': 'Game over', 'over.text': 'You fell short on {name}, ante {a}: {s} of {t}.',
  'over.best': 'Best single score', 'over.lines': 'Lines scored', 'over.jokers': 'Jokers', 'none': 'none',
  'won.title': 'You beat ante 8!', 'won.text': 'Your rival never stood a chance. Best single score: <b>{s}</b>.',
  'info.title': 'Run info', 'info.type': 'Score type', 'info.level': 'Level', 'info.base': 'Base', 'info.scored': 'Scored',
  'info.p1': 'Each X in a scored line adds its own chips (Plain X: +5) plus any square upgrade. A draw scores every X on the board. The board is {n}&times;{n}; three in a row always counts.',
  'info.boss': 'Boss this ante: <b>{name}</b>. {desc}.', 'info.vouchers': 'Vouchers: {list}', 'info.noneYet': 'none yet',
  'bag.title': 'Your bag ({n})', 'bag.text': 'Every game you hold {n} pieces drawn from a fresh shuffle of this bag. Trim Plain X in the shop to draw your specials more often.',
  'why.busy': 'Wait for scoring to finish', 'why.round': 'Use this during a game', 'why.mode': 'Finish the current action first',
  'why.noO': 'No rival O on the board', 'why.active': 'Already active',
  'toast.noMoney': 'Not enough money', 'toast.jokersFull': 'Joker rack is full: sell one first', 'toast.itemsFull': 'Item slots are full: use or sell one first',
  'toast.pieceAdded': '{name} added to your bag', 'toast.tileApplied': '{name} applied', 'toast.trimmed': 'One Plain X removed from your bag',
  'toast.board': 'The board is now {n}×{n}', 'toast.level': '{name} is now level {n}', 'toast.forged': 'Forged a {name}',
  'toast.noPlain': 'No Plain X left to forge', 'toast.free': 'Your next X is a free move', 'toast.erased': 'O erased',
  'toast.tapO': "Tap one of the rival's O marks", 'toast.skipped': 'Blind skipped: free item added', 'toast.money': '+${n}',
  'banner.win': 'You win!', 'banner.busted': 'Rival got three in a row', 'banner.draw': 'Draw', 'banner.full': 'Board full', 'banner.dry': 'No open lines left',
  'pop.again': 'Again!', 'pop.free': 'Free move!', 'pop.boom': 'BOOM', 'pop.shattered': 'Shattered!', 'pop.fizzled': 'Fizzled!', 'pop.mult': '+{n} Mult', 'pop.xmult': 'X{n} Mult',
  'lvl': 'lvl {n}', 'stone': 'STONE',
  'aria.square': 'Square {n}', 'aria.board': 'Game board',
};

/** @type {Record<string, string>} */
const DA = {
  'toast.first': 'Tryk på et felt for at lægge dit X. Tre på stribe scorer.',
  'pop.mirror': 'Spejlet!',
  'ui.packs': 'Pakker', 'btn.open': 'Åbn', 'btn.take': 'Tag', 'btn.taken': 'Taget', 'btn.skipPack': 'Spring resten over',
  'pack.left': 'Vælg {n} mere', 'pack.left1': 'Vælg 1', 'kind.pack': 'Boosterpakke', 'tip.selectAgain': 'Tryk igen for detaljer',
  'blind.small': 'Lille blind', 'blind.big': 'Stor blind',
  'blind.smallDesc': 'En opvarmningsrunde', 'blind.bigDesc': 'Større mål, større gevinst',
  'ui.scoreAtLeast': 'Scor mindst', 'ui.roundScore': 'Rundens point',
  'ui.games': 'Spil', 'ui.discards': 'Kasseringer', 'ui.ante': 'Ante', 'ui.round': 'Runde',
  'ui.runInfo': 'Info', 'ui.bag': 'Pose', 'ui.speed': 'Fart {n}x', 'ui.soundOn': 'Lyd til', 'ui.soundOff': 'Lyd fra',
  'ui.shop': 'Butik', 'ui.shopDesc': 'Byg dine synergier', 'ui.nextUp': 'Næste',
  'ui.chooseBlind': 'Vælg en blind', 'ui.nextTarget': 'Næste mål',
  'ui.jokers': 'Jokere', 'ui.items': 'Genstande',
  'ui.noJokers': 'Ingen Jokere endnu. Køb dem i butikken: hver af dem bøjer reglerne for kryds og bolle.',
  'ui.anteN': 'Ante {n}', 'ui.endless': '(uendelig)', 'ui.reward': 'Gevinst', 'ui.boss': 'BOSS',
  'hint.erase': 'Tryk på et af modstanderens <b>O</b> for at viske det ud.',
  'hint.first': 'Tryk på et felt for at lægge dit <b>X</b>. Få tre på stribe for at score.',
  'hint.tap': 'Tryk på et felt for at lægge dit X',
  'meta.game': 'Spil {n} af {m}', 'meta.overtime': 'Overtid slået til', 'meta.firstLine': 'Første linje vinder', 'meta.bag': 'Pose {n}',
  'btn.discard': 'Kassér valgte', 'btn.cancel': 'Annullér', 'btn.play': 'Spil', 'btn.skip': 'Spring over for en gratis genstand',
  'btn.defeated': 'Besejret', 'btn.upcoming': 'Kommer', 'btn.buy': 'Køb', 'btn.sold': 'Solgt',
  'btn.cancelRefund': 'Annullér (refundér)', 'btn.reroll': 'Nye varer ${n}', 'btn.trim': 'Fjern et almindeligt X $3',
  'btn.nextRound': 'Næste runde', 'btn.continue': 'Fortsæt', 'btn.newRun': 'Nyt spil', 'btn.close': 'Luk',
  'btn.abandon': 'Opgiv spillet', 'btn.abandonSure': 'Tryk igen for at opgive', 'btn.endless': 'Fortsæt (uendelig)',
  'btn.use': 'Brug', 'btn.sell': 'Sælg ${n}',
  'kind.joker': '{r} Joker', 'kind.piece': 'Brik: lægges i din pose', 'kind.tile': 'Feltopgradering (permanent)',
  'kind.voucher': 'Voucher (permanent)', 'kind.chalk': 'Kridt: hæver en scoretype', 'kind.tool': 'Værktøj',
  'tag.chalk': 'Kridt', 'tag.tool': 'Værktøj',
  'chalk.desc': 'Hæv <b>{name}</b> et niveau: <i>+{c}</i> chips, <em>+{m}</em> mult',
  'tile.pick': 'Tryk på et felt for at give det <b>{name}</b>. Opgraderinger på samme felt stabler.',
  'trim.title': 'Færre almindelige X betyder at du trækker dine specielle brikker oftere',
  'title.sub': 'Det starter som almindeligt kryds og bolle. Sådan bliver det ikke ved med at være.',
  'title.best': 'Bedste: ante {a}, højeste score {s}.',
  'how.1': '<b>Tryk på et felt for at lægge dit X.</b> Modstanderen svarer med et O. Tre på stribe scorer <span class="c">chips</span> &times; <span class="m">mult</span>. Uafgjort scorer også lidt.',
  'how.2': '<b>Slå hver blinds mål</b> inden for 4 spil. Modstanderen bliver skarpere for hver ante, så godt spil er ikke nok i længden.',
  'how.3': '<b>Byg synergier i butikken.</b> Jokere bøjer reglerne, specielle X kommer i din pose, felter bliver opgraderet, og selve brættet kan vokse til 5&times;5.',
  'how.4': '<b>Find en kombination der knækker matematikken.</b> Klar ante 8 for at vinde, og fortsæt derefter uendeligt.',
  'cash.title': 'Blind klaret!', 'cash.final': 'Slutscore <b>{a}</b> af {b}', 'cash.cleared': '{name} klaret',
  'cash.unused': '{n} ubrugte spil ($1 pr. stk.)', 'cash.unused1': '1 ubrugt spil ($1)',
  'cash.interest': 'Renter ($1 pr. $5, højst $5)', 'cash.btn': 'Indkassér ${n}', 'cash.banana': 'Banana Bomb sprang og er væk.',
  'over.title': 'Spillet er slut', 'over.text': 'Du nåede ikke {name} i ante {a}: {s} af {t}.',
  'over.best': 'Bedste enkeltscore', 'over.lines': 'Linjer scoret', 'over.jokers': 'Jokere', 'none': 'ingen',
  'won.title': 'Du klarede ante 8!', 'won.text': 'Modstanderen havde aldrig en chance. Bedste enkeltscore: <b>{s}</b>.',
  'info.title': 'Info om spillet', 'info.type': 'Scoretype', 'info.level': 'Niveau', 'info.base': 'Basis', 'info.scored': 'Scoret',
  'info.p1': 'Hvert X i en scorende linje lægger sine egne chips til (almindeligt X: +5) plus eventuelle feltopgraderinger. Uafgjort scorer alle X på brættet. Brættet er {n}&times;{n}; tre på stribe tæller altid.',
  'info.boss': 'Boss i denne ante: <b>{name}</b>. {desc}.', 'info.vouchers': 'Vouchers: {list}', 'info.noneYet': 'ingen endnu',
  'bag.title': 'Din pose ({n})', 'bag.text': 'I hvert spil har du {n} brikker på hånden, trukket fra en frisk blanding af posen. Fjern almindelige X i butikken for at trække dine specielle oftere.',
  'why.busy': 'Vent til scoringen er færdig', 'why.round': 'Brug den under et spil', 'why.mode': 'Gør den igangværende handling færdig først',
  'why.noO': 'Ingen O på brættet', 'why.active': 'Allerede aktiv',
  'toast.noMoney': 'Ikke nok penge', 'toast.jokersFull': 'Jokerhylden er fuld: sælg en først', 'toast.itemsFull': 'Genstandspladserne er fulde: brug eller sælg en først',
  'toast.pieceAdded': '{name} er lagt i din pose', 'toast.tileApplied': '{name} er tilføjet', 'toast.trimmed': 'Et almindeligt X er fjernet fra din pose',
  'toast.board': 'Brættet er nu {n}×{n}', 'toast.level': '{name} er nu niveau {n}', 'toast.forged': 'Smedet: {name}',
  'toast.noPlain': 'Ingen almindelige X tilbage at smede', 'toast.free': 'Dit næste X er et frit træk', 'toast.erased': 'O visket ud',
  'toast.tapO': 'Tryk på et af modstanderens O', 'toast.skipped': 'Blind sprunget over: gratis genstand tilføjet', 'toast.money': '+${n}',
  'banner.win': 'Du vandt!', 'banner.busted': 'Modstanderen fik tre på stribe', 'banner.draw': 'Uafgjort', 'banner.full': 'Brættet er fuldt', 'banner.dry': 'Ingen åbne linjer tilbage',
  'pop.again': 'Igen!', 'pop.free': 'Frit træk!', 'pop.boom': 'BUM', 'pop.shattered': 'Splintret!', 'pop.fizzled': 'Forsvandt!', 'pop.mult': '+{n} mult', 'pop.xmult': 'X{n} mult',
  'lvl': 'niv. {n}', 'stone': 'STEN',
  'aria.square': 'Felt {n}', 'aria.board': 'Spillebræt',
};

/** @returns {'da'|'en'} */
function detect() {
  try {
    const w = /** @type {any} */ (window);
    if (w.I18N && (w.I18N.lang === 'da' || w.I18N.lang === 'en')) return w.I18N.lang;
    const v = localStorage.getItem('om-lang');
    if (v === 'da' || v === 'en') return v;
  } catch (e) { /* ignore */ }
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  for (const l of list) {
    const s = String(l).toLowerCase();
    if (s.startsWith('da')) return 'da';
    if (s.startsWith('en')) return 'en';
  }
  return 'en';
}

let lang = detect();
export const getLang = () => lang;
/** @param {string} l */
export function setLang(l) { if (l === 'da' || l === 'en') lang = l; }

/** Interface string with {placeholders}. @param {string} key @param {Record<string, any>} [vars] */
export function t(key, vars) {
  let s = (lang === 'da' ? DA[key] : undefined) ?? EN[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
  return s;
}
/** Content text stored as {en, da}. @param {{en:string, da:string}|string|undefined} o */
export const tr = o => (o == null ? '' : typeof o === 'string' ? o : (o[lang] ?? o.en));

/** Whole numbers with the locale's grouping (1,234 in English, 1.234 in Danish). @param {number} n */
export function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e11) return n.toExponential(2).replace('+', '');
  return n.toLocaleString(lang === 'da' ? 'da-DK' : 'en-US');
}
/** Mult can be fractional after X multipliers. @param {number} m */
export function fmtM(m) {
  if (Number.isInteger(m) || m >= 1000) return fmt(m);
  const s = (Math.round(m * 100) / 100).toString();
  return lang === 'da' ? s.replace('.', ',') : s;
}
