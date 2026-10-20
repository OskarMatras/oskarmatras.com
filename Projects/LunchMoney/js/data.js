// @ts-check
/**
 * Every piece of game content lives here: score types, X pieces, square
 * upgrades, Jokers, items, vouchers and bosses.
 *
 * Text is stored next to the thing it describes as { en, da } pairs, so a
 * new Joker is one entry in one file. `tr()` in strings.js picks the
 * language. Markup in descriptions uses three tags only:
 *   <i>  chips (blue)   <em> mult (red)   <u> money (gold)
 *
 * Hooks receive the scoring context and read the run state from state.js.
 * They return an effect { chips?, mult?, xmult?, money? } or null.
 */
import { S, growBoard, nid } from './state.js';
import { isCenter, isCorner, isEdge, neighbours, runLength, geo } from './geometry.js';

/** @typedef {{en:string, da:string}} Text */
/** @typedef {{chips?:number, mult?:number, xmult?:number, money?:number}} Effect */
/** @typedef {{type:string, cells:number[], chips:number, mult:number, simult:number, forked:boolean, threats:number, oThreat:number, li:number}} ScoreCtx */

const countO = () => S.board.filter(c => c && c.t === 'O').length;
const hasJ = (/** @type {string} */ id) => S.jokers.some(j => j.id === id);
/** The kind of each X in a scored line, e.g. ['plain', 'red', 'plain']. @param {{cells:number[]}} c */
const kindsIn = c => c.cells.map(i => S.board[i].p.type);

/* ---------------- score types ---------------- */
export const LINE_TYPES = {
  row:  { name:{en:'Row', da:'Række'},       c:15, m:2, dc:10, dm:1 },
  col:  { name:{en:'Column', da:'Kolonne'},  c:15, m:2, dc:10, dm:1 },
  diag: { name:{en:'Diagonal', da:'Diagonal'}, c:20, m:3, dc:15, dm:2 },
  draw: { name:{en:'Draw', da:'Uafgjort'},   c:10, m:1, dc:10, dm:1 },
};
export const LINE_ORDER = ['row', 'col', 'diag', 'draw'];

/* ---------------- X pieces ---------------- */
export const PIECES = {
  plain:{ name:{en:'Plain X', da:'Almindelig X'}, short:{en:'', da:''}, pc:'#1c2427', chips:5, cost:0,
    desc:{en:'<i>+5</i> Marbles', da:'<i>+5</i> kugler'} },
  red:  { name:{en:'Red-Pen X', da:'Rødpen-X'}, short:{en:'RED PEN', da:'RØDPEN'}, pc:'#d3313a', chips:5, mult:4, cost:4,
    desc:{en:'<i>+5</i> Marbles and <em>+4</em> Swagger', da:'<i>+5</i> kugler og <em>+4</em> swagger'} },
  blue: { name:{en:'Blue X', da:'Blå X'}, short:{en:'BLUE', da:'BLÅ'}, pc:'#2f8ff0', chips:30, cost:4,
    desc:{en:'<i>+30</i> Marbles', da:'<i>+30</i> kugler'} },
  gold: { name:{en:'Gold-Star X', da:'Guldstjerne-X'}, short:{en:'GOLD STAR', da:'GULDSTJERNE'}, pc:'#9a6a00', chips:5, cost:5,
    desc:{en:'<i>+5</i> Marbles and earns <u>$2</u> when it scores', da:'<i>+5</i> kugler og giver <u>$2</u> når den scorer'} },
  lucky:{ name:{en:'Lucky-Penny X', da:'Heldig-mønt-X'}, short:{en:'LUCKY', da:'HELDIG'}, pc:'#2f9a58', chips:5, cost:5,
    desc:{en:'<i>+5</i> Marbles. 1 in 3 chance of <em>+15</em> Swagger, 1 in 12 chance of <u>$10</u>', da:'<i>+5</i> kugler. 1 ud af 3 chance for <em>+15</em> swagger, 1 ud af 12 for <u>$10</u>'} },
  glass:{ name:{en:'Glass X', da:'Glas X'}, short:{en:'GLASS', da:'GLAS'}, pc:'#3d86bd', xmult:2, cost:6,
    desc:{en:'<em>X2</em> Swagger when it scores. 1 in 4 chance to shatter afterwards', da:'<em>X2</em> swagger når den scorer. 1 ud af 4 chance for at den splintres bagefter'} },
  steel:{ name:{en:'Steel X', da:'Stål X'}, short:{en:'STEEL', da:'STÅL'}, pc:'#4a5960', cost:6,
    desc:{en:'<em>X1.5</em> Swagger while it sits on the board outside the scoring line', da:'<em>X1,5</em> swagger mens den står på brættet uden for den scorende linje'} },
  bomb: { name:{en:'Stink-Bomb X', da:'Stinkbombe-X'}, short:{en:'STINK', da:'STINK'}, pc:'#ff7b3a', chips:5, cost:6,
    desc:{en:'<i>+5</i> Marbles. When placed, blows up one rival O next to it', da:'<i>+5</i> kugler. Sprænger et af modstanderens O ved siden af sig, når den lægges'} },
  ghost:{ name:{en:'Invisible-Ink X', da:'Usynligt-blæk-X'}, short:{en:'INVISIBLE', da:'USYNLIG'}, pc:'#7a52bd', chips:5, cost:6,
    desc:{en:'<i>+5</i> Marbles. Your rival does not get to answer when you place it', da:'<i>+5</i> kugler. Modstanderen får ikke et træk, når du lægger den'} },
  mirror:{ name:{en:'Carbon-Copy X', da:'Karbonkopi-X'}, short:{en:'COPY', da:'KOPI'}, pc:'#b0457e', chips:5, cost:6,
    desc:{en:'<i>+5</i> Marbles. Also drops a free Plain X on the square opposite it through the centre, if that square is empty', da:'<i>+5</i> kugler. Lægger også et gratis almindeligt X på feltet overfor gennem midten, hvis det er tomt'} },
  twin: { name:{en:'Twin X', da:'Tvilling X'}, short:{en:'TWIN', da:'TVILLING'}, pc:'#1f8f8a', chips:5, retrig:1, cost:6,
    desc:{en:'<i>+5</i> Marbles. Scores twice', da:'<i>+5</i> kugler. Scorer to gange'} },
  // Sprout: its Mult is stored on the bag piece (`grow`), so it survives from game to game.
  sprout:{ name:{en:'Sprout X', da:'Spire X'}, short:{en:'SPROUT', da:'SPIRE'}, pc:'#3f9a3a', mult:2, cost:6,
    desc:{en:'<em>+2</em> Swagger. Gains <em>+1</em> Swagger every time it scores, for good', da:'<em>+2</em> swagger. Får <em>+1</em> swagger hver gang den scorer, for altid'} },
  cursed:{ name:{en:'Cursed X', da:'Forbandet X'}, short:{en:'CURSED', da:'FORBAND.'}, pc:'#6a2a86', xmult:3, cost:5,
    desc:{en:'<em>X3</em> Swagger when it scores. The rival gets an extra move when you place it', da:'<em>X3</em> swagger når den scorer. Modstanderen får et ekstra træk, når du lægger den'} },
  turncoat:{ name:{en:'Turncoat X', da:'Overløber X'}, short:{en:'TURN', da:'OVERLØB.'}, pc:'#b0502a', chips:5, cost:7,
    desc:{en:'<i>+5</i> Marbles. When placed, turns one rival O next to it into a Plain X', da:'<i>+5</i> kugler. Når den lægges, bliver et af modstanderens O ved siden af til et almindeligt X'} },
  hunter:{ name:{en:'Hunter X', da:'Jæger X'}, short:{en:'HUNTER', da:'JÆGER'}, pc:'#7a5a2e', chips:5, cost:5,
    desc:{en:'<i>+5</i> Marbles and <em>+2</em> Swagger for each rival O on the board', da:'<i>+5</i> kugler og <em>+2</em> swagger for hvert af modstanderens O på brættet'} },
};
export const SPECIALS = Object.keys(PIECES).filter(k => k !== 'plain');

/* ---------------- square upgrades ---------------- */
export const TILES = {
  hot:  { name:{en:'Hot Square', da:'Varmt felt'}, badge:(/** @type {number} */ l)=>'+'+(4*l),
    desc:{en:'An X on this square gives <em>+4</em> Swagger when it scores (stacks per upgrade)', da:'Et X på dette felt giver <em>+4</em> swagger når det scorer (stabler pr. opgradering)'} },
  rich: { name:{en:'Rich Square', da:'Rigt felt'}, badge:(/** @type {number} */ l)=>'+'+(30*l),
    desc:{en:'An X on this square gives <i>+30</i> Marbles when it scores (stacks per upgrade)', da:'Et X på dette felt giver <i>+30</i> kugler når det scorer (stabler pr. opgradering)'} },
  gild: { name:{en:'Gilded Square', da:'Forgyldt felt'}, badge:(/** @type {number} */ l)=>'$'+l,
    desc:{en:'An X on this square earns <u>$1</u> when it scores (stacks per upgrade)', da:'Et X på dette felt giver <u>$1</u> når det scorer (stabler pr. opgradering)'} },
  echo: { name:{en:'Echo Square', da:'Ekkofelt'}, badge:(/** @type {number} */ l)=>'↻'+(l>1?l:''),
    desc:{en:'An X on this square scores one extra time (stacks per upgrade)', da:'Et X på dette felt scorer en ekstra gang (stabler pr. opgradering)'} },
  star: { name:{en:'Star Square', da:'Stjernefelt'}, cost:6, badge:(/** @type {number} */ l)=>'★'+(l>1?l:''),
    desc:{en:'An X on this square gives <em>X1.25</em> Swagger when it scores (stacks per upgrade)', da:'Et X på dette felt giver <em>X1,25</em> swagger når det scorer (stabler pr. opgradering)'} },
  safe: { name:{en:'Safe Square', da:'Sikkert felt'}, cost:4, badge:()=>'⛨︎',
    desc:{en:'The rival never plays on this square while any other square is free', da:'Modstanderen lægger aldrig på dette felt, så længe et andet felt er frit'} },
  trap: { name:{en:'Trap Square', da:'Fældefelt'}, cost:5, badge:()=>'⚠︎',
    desc:{en:'If the rival plays here, its O is removed at once and you earn <u>$2</u>', da:'Hvis modstanderen lægger her, fjernes dens O med det samme, og du får <u>$2</u>'} },
};

export const RARITY = {
  1:{ name:{en:'Common', da:'Almindeligt'}, color:'var(--common)' },
  2:{ name:{en:'Sneaky', da:'Lusket'}, color:'var(--uncommon)' },
  3:{ name:{en:'Banned', da:'Forbudt'}, color:'var(--rare)' },
};

/* ---------------- Jokers ----------------
 * x:    runs for every X that scores (ctx, cellIndex, piece, joker)
 * line: runs once per scored line, after the X's (ctx, joker)
 * endRound: money paid at cash-out
 * Passive Jokers have no hooks; the engine checks for them by id. */
/** @type {Record<string, any>} */
export const JOKERS = {
  jester:   { name:'Class Clown', rar:1, cost:3, gl:'✦',
    desc:()=>({en:'<em>+4</em> Swagger', da:'<em>+4</em> swagger'}), line:()=>({mult:4}) },
  center:   { name:"Teacher's Pet", rar:1, cost:5, gl:'◉',
    desc:()=>({en:'<em>+10</em> Swagger if the line runs through a center square', da:'<em>+10</em> swagger hvis linjen går gennem et midterfelt'}),
    line:(/** @type {ScoreCtx} */ c)=>c.cells.some(isCenter)?{mult:10}:null },
  corner:   { name:'Corner Kid', rar:1, cost:5, gl:'◰',
    desc:()=>({en:'Each X on a corner square gives <i>+30</i> Marbles', da:'Hvert X på et hjørnefelt giver <i>+30</i> kugler'}),
    x:(/** @type {ScoreCtx} */ c, /** @type {number} */ i)=>isCorner(i)?{chips:30}:null },
  edge:     { name:'Fence Sitter', rar:1, cost:5, gl:'▣',
    desc:()=>({en:'Each X on an edge square (not a corner) gives <em>+4</em> Swagger', da:'Hvert X på et kantfelt (ikke hjørne) giver <em>+4</em> swagger'}),
    x:(/** @type {ScoreCtx} */ c, /** @type {number} */ i)=>isEdge(i)?{mult:4}:null },
  speedrun: { name:'Quick Draw', rar:1, cost:5, gl:'↯',
    desc:()=>({en:'<em>+15</em> Swagger if the line is finished with your 3rd X of the game', da:'<em>+15</em> swagger hvis linjen bliver færdig med dit 3. X i spillet'}),
    line:()=>S.g.placements<=3?{mult:15}:null },
  spite:    { name:'Grudge', rar:1, cost:5, gl:'◎',
    desc:()=>({en:'<em>+2</em> Swagger for each rival O on the board', da:'<em>+2</em> swagger for hvert af modstanderens O på brættet'}),
    line:()=>{ const n=countO(); return n?{mult:2*n}:null; } },
  crowded:  { name:'Packed Playground', rar:1, cost:5, gl:'▦',
    desc:()=>({en:'<em>+1</em> Swagger for each filled square', da:'<em>+1</em> swagger for hvert udfyldt felt'}),
    line:()=>({mult:S.board.filter(Boolean).length}) },
  rowfan:   { name:'Lunch Line', rar:1, cost:4, gl:'═',
    desc:()=>({en:'<em>+8</em> Swagger on Rows', da:'<em>+8</em> swagger på rækker'}), line:(/** @type {ScoreCtx} */ c)=>c.type==='row'?{mult:8}:null },
  colfan:   { name:'Flagpole', rar:1, cost:4, gl:'║',
    desc:()=>({en:'<em>+8</em> Swagger on Columns', da:'<em>+8</em> swagger på kolonner'}), line:(/** @type {ScoreCtx} */ c)=>c.type==='col'?{mult:8}:null },
  plainjane:{ name:'Plain Jane', rar:1, cost:4, gl:'X',
    desc:()=>({en:'Each Plain X gives <i>+15</i> Marbles when it scores', da:'Hvert almindeligt X giver <i>+15</i> kugler når det scorer'}),
    x:(/** @type {ScoreCtx} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='plain'?{chips:15}:null },
  pennant:  { name:'School Pennant', rar:1, cost:5, gl:'⚑',
    desc:()=>({en:'<i>+25</i> Marbles for each toss you have left', da:'<i>+25</i> kugler for hver smid du har tilbage'}),
    line:()=>S.round.discards?{chips:25*S.round.discards}:null },
  soreloser:{ name:'Sore Loser', rar:1, cost:4, gl:'☹︎',
    desc:()=>({en:'Earn <u>$3</u> whenever you lose a game', da:'Få <u>$3</u> hver gang du taber et spil'}) },
  goldtooth:{ name:'Gold Tooth', rar:1, cost:6, gl:'$',
    desc:()=>({en:'Earn <u>$4</u> at the end of each round', da:'Få <u>$4</u> ved slutningen af hver runde'}), endRound:()=>4 },
  jeweler:  { name:'Bling Kid', rar:1, cost:5, gl:'◆',
    desc:()=>({en:'Gold-Star X also give <em>+6</em> Swagger when they score', da:'Guldstjerne-X giver også <em>+6</em> swagger når de scorer'}),
    x:(/** @type {ScoreCtx} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='gold'?{mult:6}:null },
  scout:    { name:'Big Pockets', rar:1, cost:4, gl:'+1',
    desc:()=>({en:'<u>+1</u> piece in your hand', da:'<u>+1</u> brik på hånden'}) },
  diag:     { name:'Corner to Corner', rar:2, cost:6, gl:'⤡',
    desc:()=>({en:'<em>X2</em> Swagger on Diagonals', da:'<em>X2</em> swagger på diagonaler'}), line:(/** @type {ScoreCtx} */ c)=>c.type==='diag'?{xmult:2}:null },
  fork:     { name:'Two-Timer', rar:2, cost:7, gl:'⑂',
    desc:()=>({en:'<em>X2.5</em> Swagger if you had 2 or more winning threats open when you scored', da:'<em>X2,5</em> swagger hvis du havde 2 eller flere vindertrusler åbne da du scorede'}),
    line:(/** @type {ScoreCtx} */ c)=>c.forked?{xmult:2.5}:null },
  catsgame: { name:"Cat's Game", rar:2, cost:6, gl:'≡',
    desc:()=>({en:'Draws score <em>X3</em> Swagger and pay <u>$2</u>', da:'Uafgjorte spil scorer <em>X3</em> swagger og giver <u>$2</u>'}),
    line:(/** @type {ScoreCtx} */ c)=>c.type==='draw'?{xmult:3, money:2}:null },
  snowball: { name:'Snowball', rar:2, cost:6, gl:'❄︎',
    desc:(/** @type {any} */ j)=>{ const m=(j&&j.data.m)||0; return {en:`Gains <em>+1</em> Swagger every time you score. Loses half when the rival gets three in a row (currently <em>+${m}</em>)`, da:`Får <em>+1</em> swagger hver gang du scorer. Mister halvdelen, når modstanderen får tre på stribe (lige nu <em>+${m}</em>)`}; },
    line:(/** @type {ScoreCtx} */ c, /** @type {any} */ j)=>{ j.data.m=(j.data.m||0)+1; return {mult:j.data.m}; },
    gameEnd:(/** @type {any} */ j, /** @type {any} */ info)=>{ if (info.reason==='busted') j.data.m=Math.floor((j.data.m||0)/2); },
    val:(/** @type {any} */ j)=>'+'+(j.data.m||0) },
  bully:    { name:'Loose Cannon', rar:2, cost:6, gl:'✊︎',
    desc:()=>({en:"Your rival's first move each game is random", da:'Modstanderens første træk i hvert spil er tilfældigt'}) },
  sleepy:   { name:'Nap Time', rar:2, cost:6, gl:'z',
    desc:()=>({en:'Your rival blocks your lines 25% less often', da:'Modstanderen blokerer dine linjer 25% sjældnere'}) },
  doubletap:{ name:'Head Start', rar:2, cost:7, gl:'»',
    desc:()=>({en:'Your first X each game is a free move: the rival does not answer it', da:'Dit første X i hvert spil er et frit træk: modstanderen svarer ikke'}) },
  gallery:  { name:'The Posse', rar:2, cost:6, gl:'▤',
    desc:()=>({en:'<em>+3</em> Swagger for each Trick you own', da:'<em>+3</em> swagger for hvert kneb du har'}), line:()=>({mult:3*S.jokers.length}) },
  collector:{ name:'Trading Cards', rar:2, cost:6, gl:'∴',
    desc:()=>({en:'<em>+2</em> Swagger for each special X in your bag', da:'<em>+2</em> swagger for hvert specielt X i din pose'}),
    line:()=>{ const n=S.bag.filter(p=>p.type!=='plain').length; return n?{mult:2*n}:null; } },
  ironclad: { name:'Locker Door', rar:2, cost:6, gl:'■',
    desc:()=>({en:'Steel X give <em>X2</em> instead of X1.5', da:'Stål X giver <em>X2</em> i stedet for X1,5'}) },
  echoj:    { name:'Do-Over', rar:2, cost:7, gl:'↻',
    desc:()=>({en:'The first X in every scored line scores one extra time', da:'Det første X i hver scorende linje scorer en ekstra gang'}) },
  guardian: { name:'Big Sibling', rar:2, cost:7, gl:'⛨︎',
    desc:()=>({en:'When your rival completes three in a row, 1 in 2 chance their O fizzles', da:'Når modstanderen får tre på stribe, er der 1 ud af 2 chance for at deres O forsvinder'}) },
  overtime: { name:'Extra Recess', rar:3, cost:8, gl:'∞',
    desc:()=>({en:'Finishing a line no longer ends the game on a 3×3 board. On bigger boards, every line after the first in a game pays <u>$2</u>', da:'En færdig linje afslutter ikke længere spillet på et 3×3-bræt. På større bræt giver hver linje efter den første i et spil <u>$2</u>'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && S.N>=4 && S.g.lines>=1)?{money:2}:null },
  combo:    { name:'Winning Streak', rar:3, cost:8, gl:'↑',
    desc:()=>({en:'<em>X1.5</em> Swagger for each line already scored this game (multiplies)', da:'<em>X1,5</em> swagger for hver linje der allerede er scoret i dette spil (ganges)'}),
    line:()=>S.g.lines?{xmult:+Math.pow(1.5,S.g.lines).toFixed(3)}:null },
  momentum: { name:'Gossip Chain', rar:3, cost:8, gl:'➠︎',
    desc:(/** @type {any} */ j)=>{ const x=(1+((j&&j.data.n)||0)*0.05).toFixed(2); return {en:`Gains <em>X0.05</em> Swagger every time you score, for good (currently <em>X${x}</em>)`, da:`Får <em>X0,05</em> swagger hver gang du scorer, for altid (lige nu <em>X${x.replace('.',',')}</em>)`}; },
    line:(/** @type {ScoreCtx} */ c, /** @type {any} */ j)=>{ j.data.n=(j.data.n||0)+1; return {xmult:+(1+j.data.n*0.05).toFixed(2)}; },
    val:(/** @type {any} */ j)=>'X'+(1+(j.data.n||0)*0.05).toFixed(2) },
  banana:   { name:'Rotten Banana', rar:3, cost:7, gl:'☾',
    desc:()=>({en:'<em>X3</em> Swagger. 1 in 5 chance it blows up at the end of a round', da:'<em>X3</em> swagger. 1 ud af 5 chance for at den sprænger ved slutningen af en runde'}), line:()=>({xmult:3}) },
  grandstand:{ name:'Bleachers', rar:3, cost:8, gl:'⌂',
    desc:()=>({en:'Square upgrades trigger twice', da:'Feltopgraderinger udløses to gange'}) },
  midas:    { name:'Golden Touch', rar:3, cost:8, gl:'♕︎',
    desc:()=>({en:'Gold-Star X give <em>X1.5</em> Swagger when they score', da:'Guldstjerne-X giver <em>X1,5</em> swagger når de scorer'}),
    x:(/** @type {ScoreCtx} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='gold'?{xmult:1.5}:null },
  /* ---- board-expansion tactics: these come alive on 4×4 and 5×5 ---- */
  longshot: { name:'Long Shot', rar:2, cost:7, gl:'\u27F7', req:()=>S.N>=4,
    desc:()=>({en:'Lines that are part of 4 in a row score <em>X2</em> Swagger, 5 in a row <em>X3</em>', da:'Linjer der er del af 4 på stribe scorer <em>X2</em> swagger, 5 på stribe <em>X3</em>'}),
    line:(/** @type {any} */ c)=>{ if (c.type==='draw') return null; const n=runLength(geo().lines[c.li]); return n>=4?{xmult:n-2}:null; } },
  bigsky:   { name:'Open Field', rar:2, cost:6, gl:'\u25A1', req:()=>S.N>=4,
    desc:()=>({en:'<em>X1.5</em> Swagger on a 4×4 board, <em>X2</em> on 5×5', da:'<em>X1,5</em> swagger på et 4×4-bræt, <em>X2</em> på 5×5'}),
    line:()=>S.N>3?{xmult:1+0.5*(S.N-3)}:null },
  crossroads:{ name:'Crossing Guard', rar:2, cost:6, gl:'\u271A',
    desc:()=>({en:'<em>+15</em> Swagger for each X in the line that is also part of another scored line', da:'<em>+15</em> swagger for hvert X i linjen der også er del af en anden scoret linje'}),
    line:(/** @type {any} */ c)=>{ if (c.type==='draw') return null; const L=geo().lines; const n=c.cells.filter((/** @type {number} */ i)=>S.g.scored.some((/** @type {number} */ li)=>li!==c.li && L[li].cells.includes(i))).length; return n?{mult:15*n}:null; } },
  cartographer:{ name:'Doodler', rar:1, cost:5, gl:'\u2316',
    desc:()=>({en:'<i>+8</i> Marbles for each empty square on the board', da:'<i>+8</i> kugler for hvert tomt felt på brættet'}),
    line:()=>{ const n=S.board.filter((/** @type {any} */ x)=>!x).length; return n?{chips:8*n}:null; } },
  landlord: { name:'Turf Owner', rar:1, cost:5, gl:'\u2302\uFE0E',
    desc:()=>({en:'<em>+1</em> Swagger for each of your X on the board', da:'<em>+1</em> swagger for hvert af dine X på brættet'}),
    line:()=>({mult:S.board.filter((/** @type {any} */ x)=>x&&x.t==='X').length}) },
  pincer:   { name:'Surrounded', rar:1, cost:5, gl:'\u2194',
    desc:()=>({en:'<i>+25</i> Marbles for each rival O touching the line', da:'<i>+25</i> kugler for hvert af modstanderens O der rører linjen'}),
    line:(/** @type {any} */ c)=>{ const os=new Set(); c.cells.forEach((/** @type {number} */ i)=>neighbours(i).forEach(k=>{ if(S.board[k]&&S.board[k].t==='O') os.add(k); })); return os.size?{chips:25*os.size}:null; } },
  hermit:   { name:'Loner', rar:2, cost:6, gl:'\u25CC',
    desc:()=>({en:'<em>X2</em> Swagger if no rival O touches the line', da:'<em>X2</em> swagger hvis intet O rører linjen'}),
    line:(/** @type {any} */ c)=>{ if (c.type==='draw') return null; const touched=c.cells.some((/** @type {number} */ i)=>neighbours(i).some(k=>S.board[k]&&S.board[k].t==='O')); return touched?null:{xmult:2}; } },
  checkmate:{ name:'Gotcha', rar:3, cost:8, gl:'\u265A\uFE0E',
    desc:()=>({en:'<em>X3</em> Swagger if you had 3 or more winning threats open when you scored', da:'<em>X3</em> swagger hvis du havde 3 eller flere vindertrusler åbne da du scorede'}),
    line:(/** @type {any} */ c)=>c.threats>=3?{xmult:3}:null },
  demolition:{ name:'Firecracker', rar:2, cost:6, gl:'\u2739',
    desc:(/** @type {any} */ j)=>{ const m=(j&&j.data.m)||0; return {en:`Gains <em>+3</em> Swagger every time a Stink-Bomb X blows up an O (currently <em>+${m}</em>)`, da:`Får <em>+3</em> swagger hver gang et Stinkbombe-X sprænger et O (lige nu <em>+${m}</em>)`}; },
    line:(/** @type {any} */ c, /** @type {any} */ j)=>j.data.m?{mult:j.data.m}:null, val:(/** @type {any} */ j)=>'+'+(j.data.m||0) },
  ghosttown:{ name:'Ghost Story', rar:2, cost:6, gl:'\u2601\uFE0E',
    desc:()=>({en:'Invisible-Ink X give <em>X1.5</em> Swagger when they score', da:'Usynligt-blæk-X giver <em>X1,5</em> swagger når de scorer'}),
    x:(/** @type {any} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='ghost'?{xmult:1.5}:null },
  glassjaw: { name:'Glass Jaw', rar:3, cost:7, gl:'\u25C8',
    desc:()=>({en:'Glass X give <em>X3</em> instead of X2, but always shatter', da:'Glas X giver <em>X3</em> i stedet for X2, men splintres altid'}) },
  reflection:{ name:'Mirror, Mirror', rar:2, cost:6, gl:'\u29D6',
    desc:()=>({en:'Carbon-Copy X and the X they drop give <em>+6</em> Swagger when they score', da:'Karbonkopi-X og det X de lægger giver <em>+6</em> swagger når de scorer'}),
    x:(/** @type {any} */ c, /** @type {number} */ i, /** @type {any} */ p)=>(p.type==='mirror'||p.mirrored)?{mult:6}:null },

  /* ---- sets: what the three X in a line are made of ---- */
  purist:   { name:'Keep It Simple', rar:2, cost:6, gl:'○',
    desc:()=>({en:'<em>X2</em> Swagger if every X in the line is a Plain X', da:'<em>X2</em> swagger hvis hvert X i linjen er et almindeligt X'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && kindsIn(c).every((/** @type {string} */ k)=>k==='plain'))?{xmult:2}:null },
  rainbow:  { name:'Box of Crayons', rar:2, cost:7, gl:'☼︎',
    desc:()=>({en:'<em>X2.5</em> Swagger if the line has three different kinds of X', da:'<em>X2,5</em> swagger hvis linjen har tre forskellige slags X'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && new Set(kindsIn(c)).size>=3)?{xmult:2.5}:null },
  matching: { name:'Matching Sneakers', rar:2, cost:7, gl:'⁂',
    desc:()=>({en:'<em>X3</em> Swagger if all three X in the line are the same special kind', da:'<em>X3</em> swagger hvis alle tre X i linjen er samme specielle slags'}),
    line:(/** @type {any} */ c)=>{ if (c.type==='draw') return null; const k=kindsIn(c); return (k[0]!=='plain' && k.every((/** @type {string} */ x)=>x===k[0]))?{xmult:3}:null; } },
  variety:  { name:'Mixed Bag', rar:2, cost:6, gl:'❖︎',
    desc:()=>({en:'<em>+3</em> Swagger for each different kind of special X in your bag', da:'<em>+3</em> swagger for hvert forskelligt slags specielt X i din pose'}),
    line:()=>{ const n=new Set(S.bag.filter((/** @type {any} */ p)=>p.type!=='plain').map((/** @type {any} */ p)=>p.type)).size; return n?{mult:3*n}:null; } },

  /* ---- one Joker for a kind of X ---- */
  redalert: { name:'Red Pen Rage', rar:2, cost:6, gl:'▲︎',
    desc:()=>({en:'Each Red-Pen X also gives <em>X1.5</em> Swagger when it scores', da:'Hvert Rødpen-X giver også <em>X1,5</em> swagger når det scorer'}),
    x:(/** @type {any} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='red'?{xmult:1.5}:null },
  bluemoon: { name:'Blue Marker', rar:1, cost:5, gl:'☽︎',
    desc:()=>({en:'Each Blue X also gives <i>+40</i> Marbles and <em>+3</em> Swagger when it scores', da:'Hvert Blåt X giver også <i>+40</i> kugler og <em>+3</em> swagger når det scorer'}),
    x:(/** @type {any} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='blue'?{chips:40, mult:3}:null },
  fourleaf: { name:'Four-Leaf Clover', rar:2, cost:6, gl:'❀︎',
    desc:()=>({en:'Lucky-Penny X trigger twice as often', da:'Heldig-mønt-X udløses dobbelt så ofte'}) },
  twinpeaks:{ name:'Identical Twins', rar:2, cost:6, gl:'²',
    desc:()=>({en:'Twin X score three times instead of two', da:'Tvilling X scorer tre gange i stedet for to'}) },
  greenhouse:{ name:'Windowsill Garden', rar:1, cost:5, gl:'❦︎',
    desc:()=>({en:'Sprout X grow <em>+2</em> Swagger each time instead of +1', da:'Spire X vokser med <em>+2</em> swagger hver gang i stedet for +1'}) },
  exorcist: { name:'Holy Water', rar:2, cost:7, gl:'✝︎',
    desc:()=>({en:'Cursed X no longer give the rival an extra move', da:'Forbandede X giver ikke længere modstanderen et ekstra træk'}) },

  /* ---- money ---- */
  taxman:   { name:'Lunch Lady', rar:1, cost:5, gl:'¤',
    desc:()=>({en:'Earn <u>$1</u> the first time you score a line in each game', da:'Få <u>$1</u> første gang du scorer en linje i hvert spil'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && S.g.lines===0)?{money:1}:null },
  piggy:    { name:'Piggy Bank', rar:2, cost:6, gl:'¢',
    desc:()=>({en:'<em>+1</em> Swagger for every <u>$3</u> you hold', da:'<em>+1</em> swagger for hver <u>$3</u> du har'}),
    line:()=>{ const n=Math.floor(S.money/3); return n?{mult:n}:null; } },
  banker:   { name:'Loan Shark', rar:2, cost:7, gl:'₤',
    desc:()=>({en:'Your interest is capped at <u>$10</u> instead of $5', da:'Din rente er begrænset til <u>$10</u> i stedet for $5'}) },

  /* ---- bag, hand and shelf ---- */
  heldback: { name:'Ace Up the Sleeve', rar:1, cost:5, gl:'☞︎',
    desc:()=>({en:'<em>+5</em> Swagger for each piece still in your hand', da:'<em>+5</em> swagger for hver brik du stadig har på hånden'}),
    line:()=>S.hand.length?{mult:5*S.hand.length}:null },
  minimalist:{ name:'Light Packer', rar:2, cost:7, gl:'·',
    desc:()=>({en:'<em>X2</em> Swagger while your bag holds 8 pieces or fewer', da:'<em>X2</em> swagger mens din pose har 8 brikker eller færre'}),
    line:()=>S.bag.length<=8?{xmult:2}:null },
  hoarder:  { name:'Pack Rat', rar:1, cost:5, gl:'▥︎',
    desc:()=>({en:'<i>+4</i> Marbles for each piece in your bag', da:'<i>+4</i> kugler for hver brik i din pose'}),
    line:()=>({chips:4*S.bag.length}) },
  chalkboard:{ name:'Chalkboard', rar:2, cost:6, gl:'✎︎',
    desc:()=>({en:'<em>+2</em> Swagger for every chalk level you have bought', da:'<em>+2</em> swagger for hvert kridtniveau du har købt'}),
    line:()=>{ const n=Object.values(S.levels).reduce((a,b)=>a+b,0)-4; return n>0?{mult:2*n}:null; } },
  toolbox:  { name:'Fully Stocked', rar:1, cost:5, gl:'⚒︎',
    desc:()=>({en:'<em>+6</em> Swagger for each item you hold', da:'<em>+6</em> swagger for hver genstand du har'}),
    line:()=>S.items.length?{mult:6*S.items.length}:null },
  showoff:  { name:'Showoff', rar:2, cost:6, gl:'★︎',
    desc:()=>({en:'<em>X0.5</em> Swagger for each Trick you own with a special finish', da:'<em>X0,5</em> swagger for hvert kneb du har med en speciel finish'}),
    line:()=>{ const n=S.jokers.filter((/** @type {any} */ j)=>j.ed).length; return n?{xmult:1+0.5*n}:null; } },

  /* ---- where the line is ---- */
  bullseye: { name:'Dead Centre', rar:1, cost:5, gl:'⊙︎',
    desc:()=>({en:'Each X on a center square gives <em>+8</em> Swagger', da:'Hvert X på et midterfelt giver <em>+8</em> swagger'}),
    x:(/** @type {any} */ c, /** @type {number} */ i)=>isCenter(i)?{mult:8}:null },
  perimeter:{ name:'Fence Line', rar:2, cost:6, gl:'▢︎',
    desc:()=>({en:'<em>X2</em> Swagger if every X in the line is on the outer ring of the board', da:'<em>X2</em> swagger hvis hvert X i linjen står på brættets yderste ring'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && c.cells.every((/** @type {number} */ i)=>isCorner(i)||isEdge(i)))?{xmult:2}:null },

  /* ---- rhythm and risk ---- */
  hotstreak:{ name:'Hot Streak', rar:2, cost:7, gl:'♨︎',
    desc:(/** @type {any} */ j)=>{ const x=(1+((j&&j.data.n)||0)*0.25).toFixed(2); return {en:`Gains <em>X0.25</em> Swagger for every game in a row you score a line. Resets when a game ends without one (currently <em>X${x}</em>)`, da:`Får <em>X0,25</em> swagger for hvert spil i træk, hvor du scorer en linje. Nulstilles, når et spil slutter uden en (lige nu <em>X${x.replace('.',',')}</em>)`}; },
    line:(/** @type {any} */ c, /** @type {any} */ j)=>j.data.n?{xmult:+(1+j.data.n*0.25).toFixed(2)}:null,
    gameEnd:(/** @type {any} */ j, /** @type {any} */ info)=>{ j.data.n = info.lines>0 ? (j.data.n||0)+1 : 0; },
    val:(/** @type {any} */ j)=>'X'+(1+(j.data.n||0)*0.25).toFixed(2) },
  sprawl:   { name:'Spread Out', rar:1, cost:5, gl:'⟡', req:()=>S.N>=4,
    desc:()=>({en:'<em>+8</em> Swagger for each line already scored this game', da:'<em>+8</em> swagger for hver linje der allerede er scoret i dette spil'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && S.g.lines)?{mult:8*S.g.lines}:null },
  daredevil:{ name:'Daredevil', rar:2, cost:7, gl:'☠︎',
    desc:()=>({en:'<em>X2.5</em> Swagger if the rival has a winning square open when you score', da:'<em>X2,5</em> swagger hvis modstanderen har et vindende felt åbent, når du scorer'}),
    line:(/** @type {any} */ c)=>c.oThreat>0?{xmult:2.5}:null },
  curtain:  { name:'School Play', rar:2, cost:7, gl:'⌣',
    desc:()=>({en:'The last X in every scored line scores one extra time', da:'Det sidste X i hver scorende linje scorer en ekstra gang'}) },
  copycat:  { name:'Copycat', rar:3, cost:9, gl:'⧉',
    desc:()=>({en:'Copies the scoring effect of the Trick to its right', da:'Kopierer scoringseffekten fra knebet til højre for det'}) },
};
export { hasJ };

/* ---------------- Joker editions ----------------
 * A shop Joker sometimes comes in a special finish. The edition fires
 * once per scored line, after the Joker's own effect, and the card gets
 * the matching animated sheen (see cardfx.js and game.css). */
/** @type {Record<string, any>} */
export const EDITIONS = {
  // Negative takes no score effect: it is one more Joker slot (see jokerSlots() in rules.js).
  negative: { name:{en:'Extra Pocket', da:'Ekstra lomme'}, chance:.025, cost:4, effect:null,
    desc:{en:'<u>+1</u> Trick slot', da:'<u>+1</u> kneb-plads'} },
  foil: { name:{en:'Shiny', da:'Skinnende'}, chance:.10, cost:2, effect:{chips:50},
    desc:{en:'<i>+50</i> Marbles', da:'<i>+50</i> kugler'} },
  holo: { name:{en:'Holo Sticker', da:'Holo-klistermærke'}, chance:.06, cost:3, effect:{mult:10},
    desc:{en:'<em>+10</em> Swagger', da:'<em>+10</em> swagger'} },
  poly: { name:{en:'Glitter', da:'Glimmer'}, chance:.03, cost:5, effect:{xmult:1.5},
    desc:{en:'<em>X1.5</em> Swagger', da:'<em>X1,5</em> swagger'} },
};

/* ---------------- booster packs ----------------
 * Bought in the shop, opened on the spot: you see `show` cards and keep
 * `choose` of them. */
/** @type {Record<string, any>} */
export const PACKS = {
  joker:   { name:{en:'Trick Bag', da:'Kneb-pose'}, gl:'J', color:'#b4423d', cost:5, show:3, choose:1,
    desc:{en:'Pick <u>1</u> of <u>3</u> Tricks. Better odds of a special finish', da:'Vælg <u>1</u> af <u>3</u> kneb. Bedre chance for en speciel finish'} },
  piece:   { name:{en:'Pencil Pack', da:'Penalhus-pakke'}, gl:'X', color:'#5b6f8a', cost:4, show:4, choose:2,
    desc:{en:'Pick <u>2</u> of <u>4</u> special X pieces for your bag', da:'Vælg <u>2</u> af <u>4</u> specielle X-brikker til din pose'} },
  chalk:   { name:{en:'Chalk Box', da:'Kridtæske'}, gl:'\u2550', color:'#2b8f9a', cost:4, show:3, choose:1,
    desc:{en:'Pick <u>1</u> of <u>3</u> chalks. It levels up a score type right away', da:'Vælg <u>1</u> af <u>3</u> kridt. Det hæver en scoretype med det samme'} },
  builder: { name:{en:'Graffiti Kit', da:'Graffitisæt'}, gl:'\u25A6', color:'#a8742a', cost:5, show:3, choose:1,
    desc:{en:'Pick <u>1</u> of <u>3</u> square upgrades and place it on the board', da:'Vælg <u>1</u> af <u>3</u> feltopgraderinger og placér den på brættet'} },
  tool:    { name:{en:'Gear Bag', da:'Grejpose'}, gl:'\u2692\uFE0E', color:'#7a4bb3', cost:3, show:2, choose:1,
    desc:{en:'Pick <u>1</u> of <u>2</u> tools', da:'Vælg <u>1</u> af <u>2</u> værktøjer'} },
  // Shows `targets` random X from your bag next to the edits: pick an edit, then the X it changes.
  forge:   { name:{en:'Craft Table', da:'Værkstedsbord'}, gl:'⚙︎', color:'#c0572b', cost:6, show:3, choose:1, targets:7,
    desc:{en:'Pick <u>1</u> of <u>3</u> edits, then one of <u>7</u> random X from your bag to change', da:'Vælg <u>1</u> af <u>3</u> ændringer, og så et af <u>7</u> tilfældige X fra din pose'} },
};

/* ---------------- Forge Pack edits ----------------
 * Each one changes a single X you choose from the bag. They are used up on the
 * spot, so (unlike tools) they never take an item slot. */
/** @type {Record<string, any>} */
export const EDITS = {
  smelt: { name:{en:'Smelt', da:'Smelt'}, gl:'⚒︎',
    desc:{en:'Turn an X into a random <em>special</em> X', da:'Gør et X til et tilfældigt <em>specielt</em> X'} },
  twin:  { name:{en:'Twin', da:'Tvilling'}, gl:'2×',
    desc:{en:'Add a <u>copy</u> of an X to your bag', da:'Læg en <u>kopi</u> af et X i din pose'} },
  scrap: { name:{en:'Scrap', da:'Skrot'}, gl:'✕',
    desc:{en:'Destroy an X and gain <u>$3</u>', da:'Ødelæg et X og få <u>$3</u>'} },
};

/* ---------------- items (chalk levels a score type, tools act right away) ---------------- */
/** @type {Record<string, any>} */
export const ITEMS = {
  chalk_row: { name:{en:'Row Chalk', da:'Rækkekridt'}, gl:'═', kind:'chalk', lt:'row' },
  chalk_col: { name:{en:'Column Chalk', da:'Kolonnekridt'}, gl:'║', kind:'chalk', lt:'col' },
  chalk_diag:{ name:{en:'Diagonal Chalk', da:'Diagonalkridt'}, gl:'╲', kind:'chalk', lt:'diag' },
  chalk_draw:{ name:{en:'Draw Chalk', da:'Uafgjort-kridt'}, gl:'=', kind:'chalk', lt:'draw' },
  // Rare: only found in Chalk Packs, never on a shop shelf. Raises three score types at once.
  chalk_rainbow:{ name:{en:'Rainbow Chalk', da:'Regnbuekridt'}, gl:'◈', kind:'chalk', lts:['row', 'col', 'diag'], rare:true },
  reshuffle:{ name:{en:'Shake It Up', da:'Ryst posen'}, gl:'⟳', kind:'tool', need:'play',
    desc:{en:'Throw away your whole hand and draw a fresh one. Does not use a toss', da:'Smid hele din hånd væk og træk en ny. Bruger ikke en smid'} },
  // Passive: it is never "used". It waits in your item slots and triggers by itself (see placeX in engine.js).
  safetynet:{ name:{en:'Teacher Nearby', da:'Lærer i nærheden'}, gl:'⛶', kind:'tool', need:'passive',
    desc:{en:'Passive. When the rival gets three in a row, the teacher turns up: that O vanishes and the game goes on. Used up when it triggers', da:'Passiv. Når modstanderen får tre på stribe, dukker læreren op: det O forsvinder, og spillet fortsætter. Bruges op, når det udløses'} },
  hourglass:{ name:{en:'The Stopwatch', da:'Stopuret'}, gl:'⧗', kind:'tool', need:'play',
    desc:{en:'Gain one extra game this round', da:'Få ét ekstra spil i denne runde'} },
  amplifier:{ name:{en:'Megaphone', da:'Megafonen'}, gl:'⇧', kind:'tool', need:'play',
    desc:{en:'The next line you score this game gets <em>X2</em> Swagger', da:'Den næste linje, du scorer i dette spil, får <em>X2</em> swagger'} },
  eraser:  { name:{en:'The Eraser', da:'Viskelæderet'}, gl:'⌫', kind:'tool', need:'board',
    desc:{en:"Remove one of your rival's O marks from the board", da:'Fjern et af modstanderens O fra brættet'} },
  sprint:  { name:{en:'The Sprint', da:'Spurten'}, gl:'»', kind:'tool', need:'play',
    desc:{en:'Your next X is a free move: the rival does not answer it', da:'Dit næste X er et frit træk: modstanderen svarer ikke'} },
  forge:   { name:{en:'Craft Kit', da:'Hobbysættet'}, gl:'⚒︎', kind:'tool', need:'any',
    desc:{en:'Turn a random Plain X in your bag into a random special X', da:'Gør et tilfældigt almindeligt X i din pose til et tilfældigt specielt X'} },
  miser:   { name:{en:'Piggy Raid', da:'Sparegrisen'}, gl:'$$', kind:'tool', need:'any',
    desc:{en:'Double your money (max <u>+$20</u>)', da:'Fordobl dine penge (højst <u>+$20</u>)'} },
};

/* ---------------- vouchers (permanent, one per ante) ---------------- */
/** @type {Record<string, any>} */
export const VOUCHERS = {
  extragame:{ name:{en:'Extra Game', da:'Ekstra spil'}, gl:'+G', desc:{en:'<i>+1</i> game every round', da:'<i>+1</i> spil hver runde'}, apply:()=>{ S.maxGames++; } },
  sparehand:{ name:{en:'Spare Toss', da:'Ekstra smid'}, gl:'+D', desc:{en:'<em>+1</em> toss every round', da:'<em>+1</em> smid hver runde'}, apply:()=>{ S.maxDiscards++; } },
  pockets:  { name:{en:'Deep Pockets', da:'Dybe lommer'}, gl:'+H', desc:{en:'<u>+1</u> piece in your hand', da:'<u>+1</u> brik på hånden'}, apply:()=>{ S.handSize++; } },
  rack:     { name:{en:'Bigger Pockets', da:'Større lommer'}, gl:'+J', desc:{en:'<u>+1</u> Trick slot', da:'<u>+1</u> kneb-plads'}, apply:()=>{ S.jokerSlots++; } },
  satchel:  { name:{en:'Satchel', da:'Taske'}, gl:'+C', desc:{en:'<u>+1</u> item slot', da:'<u>+1</u> genstandsplads'}, apply:()=>{ S.itemSlots++; } },
  coupon:   { name:{en:'Coupon', da:'Kupon'}, gl:'%', desc:{en:'Shop rerolls start at <u>$2</u>', da:'Nye varer i butikken starter ved <u>$2</u>'}, apply:()=>{} },
  overstock:{ name:{en:'Full Shelves', da:'Fulde hylder'}, gl:'+S', desc:{en:'<u>+1</u> card in every shop', da:'<u>+1</u> kort i hver butik'}, apply:()=>{ S.cardSlots = (S.cardSlots || 2) + 1; } },
  packrat:  { name:{en:'Goody Shelf', da:'Godtehylde'}, gl:'+P', desc:{en:'<u>+1</u> goody bag in every shop', da:'<u>+1</u> pakke i hver butik'}, apply:()=>{ S.packSlots = (S.packSlots || 2) + 1; }, req:()=>(S.packSlots || 2) < 3 },
  compound: { name:{en:'Lunch Lady’s Rate', da:'Kantinedamens rente'}, gl:'+$', desc:{en:'Your interest cap is <u>$5</u> higher', da:'Dit renteloft er <u>$5</u> højere'}, apply:()=>{ S.interestCap = (S.interestCap || 5) + 5; } },
  clearance:{ name:{en:'Squint Discount', da:'Squint-rabat'}, gl:'-$', desc:{en:'Everything in the shop costs <u>$1</u> less', da:'Alt i butikken koster <u>$1</u> mindre'}, apply:()=>{ S.discount = (S.discount || 0) + 1; }, req:()=>!S.discount },
  board4:   { name:{en:'Bigger Board', da:'Større bræt'}, gl:'4×4', desc:{en:'The board grows to <b>4×4</b>. Still three in a row, so many more lines', da:'Brættet vokser til <b>4×4</b>. Stadig tre på stribe, så mange flere linjer'}, apply:()=>{ growBoard(4); }, req:()=>S.N===3 && S.ante>=2 },   // an early way to 4×4; every run gets it at ante 4 anyway (see engine.js)
  board5:   { name:{en:'Huge Board', da:'Kæmpebræt'}, gl:'5×5', desc:{en:'The board grows to <b>5×5</b>', da:'Brættet vokser til <b>5×5</b>'}, apply:()=>{ growBoard(5); }, req:()=>S.N===4 && S.ante>=5 },   // not before ante 5: ante 4 is when the board first grows
};

/* ---------------- starting sets ----------------
 * Chosen when a run begins. Plain is always there; the others unlock as your best ante rises, so
 * finishing a run always opens something new to try. `unlock` is the best ante you need.
 * `apply` changes the fresh run (see freshRun in rules.js). */
/** Swap the first n Plain X in the bag for another kind. @param {number} n @param {string} type */
const swapPlain = (n, type) => { let left = n; for (const p of S.bag) if (left > 0 && p.type === 'plain') { p.type = type; left--; } };
/** @type {Record<string, any>} */
export const DECKS = {
  plain:  { name:{en:'Fresh Start', da:'Frisk start'}, gl:'X', unlock:0,
    desc:{en:'Eight Plain X. Nothing fancy: the way it was meant to start', da:'Otte almindelige X. Ingenting fancy: sådan som det var tænkt'}, apply:()=>{} },
  red:    { name:{en:'Red Pen', da:'Rød pen'}, gl:'R', unlock:2,
    desc:{en:'Start with <b>2 Red-Pen X</b> in your bag (<i>+5</i> Marbles and <em>+4</em> Swagger each)', da:'Start med <b>2 Rødpen-X</b> i din pose (<i>+5</i> kugler og <em>+4</em> swagger hver)'}, apply:()=>swapPlain(2,'red') },
  lucky:  { name:{en:'Lucky Penny', da:'Heldig mønt'}, gl:'L', unlock:3,
    desc:{en:'Start with <b>2 Lucky-Penny X</b>. Feeling lucky?', da:'Start med <b>2 Heldig-mønt-X</b>. Føler du dig heldig?'}, apply:()=>swapPlain(2,'lucky') },
  glass:  { name:{en:'Glass Marbles', da:'Glaskugler'}, gl:'G', unlock:4,
    desc:{en:'Start with <b>3 Glass X</b>: <em>X2</em> Swagger each, but they may shatter', da:'Start med <b>3 Glas X</b>: <em>X2</em> swagger hver, men de kan splintres'}, apply:()=>swapPlain(3,'glass') },
  gilded: { name:{en:'Piggy Bank', da:'Sparegris'}, gl:'$', unlock:4,
    desc:{en:'Start with <u>$8</u> and a <b>Gold-Star X</b>, but two tosses fewer each round', da:'Start med <u>$8</u> og et <b>Guldstjerne-X</b>, men to smid mindre hver runde'},
    apply:()=>{ swapPlain(1,'gold'); S.money = 8; S.maxDiscards = 1; } },
  joker:  { name:{en:'Class Clown', da:'Klassens klovn'}, gl:'J', unlock:5,
    desc:{en:'Start with a random <b>Common Trick</b>, but only 4 Trick slots', da:'Start med en tilfældig <b>almindeligt kneb</b>, men kun 4 kneb-pladser'},
    apply:()=>{
      const pool = Object.keys(JOKERS).filter(k => JOKERS[k].rar === 1 && !JOKERS[k].req);
      S.jokers.push({ uid: nid(), id: pool[Math.floor(Math.random() * pool.length)], ed: null, data: {} });
      S.jokerSlots = 4;
    } },
  twin:   { name:{en:'Best Friends', da:'Bedste venner'}, gl:'2', unlock:6,
    desc:{en:'Start with <b>3 Twin X</b>, which score twice, and a bigger bag: 10 pieces', da:'Start med <b>3 Tvilling X</b>, som scorer to gange, og en større pose: 10 brikker'},
    apply:()=>{ swapPlain(3,'twin'); S.bag.push({ uid: nid(), type: 'plain' }, { uid: nid(), type: 'plain' }); } },
};

/* ---------------- boss blinds ---------------- */
/** @type {Record<string, any>} */
export const BOSSES = {
  wall:   { name:{en:'Tank', da:'Tank'}, color:'#7a6a55', desc:{en:'Stands in the middle: a center square is blocked every game', da:'Står i midten: et midterfelt er blokeret i hvert spil'} },
  crowd:  { name:{en:'The Gang', da:'Banden'}, color:'#6b5a8a', desc:{en:'Two squares start blocked by his friends every game', da:'To felter starter blokeret af hans venner i hvert spil'} },
  thief:  { name:{en:'Sticky Fingers', da:'Lange Fingre'}, color:'#8a2e4a', desc:{en:'Gold-Star X and Gilded squares pay nothing: he pockets it', da:'Guldstjerne-X og forgyldte felter giver ingenting: han stikker det i lommen'} },
  master: { name:{en:'Brainiac Bea', da:'Hjerne-Bea'}, color:'#2b4f8a', desc:{en:'The rival blocks far more and never misses a win', da:'Modstanderen blokerer langt oftere og misser aldrig en sejr'} },
  needle: { name:{en:'The Bell', da:'Klokken'}, color:'#4c7a2e', desc:{en:'Break is almost over: only 2 games this round (lower target)', da:'Frikvarteret er næsten slut: kun 2 spil i denne runde (lavere mål)'} },
  drought:{ name:{en:'Hall Monitor Hank', da:'Gangvagt Hans'}, color:'#a0662a', desc:{en:'No tosses this round: he confiscates them', da:'Ingen smid i denne runde: han konfiskerer dem'} },
  echo:   { name:{en:'Cheater Chet', da:'Snyde-Sune'}, color:'#2e7a78', desc:{en:'The rival moves first every game', da:'Modstanderen starter i hvert spil'} },
  ollie:  { name:{en:'The Sixth-Grader', da:'Sjetteklassen'}, color:'#d9622b', desc:{en:'He cheats. He takes the middle first, plays an extra O after your first line, always blocks and never misses a win. Your two leftmost Tricks are confiscated', da:'Han snyder. Han tager midten først, spiller et ekstra O efter din første linje, blokerer altid og misser aldrig en sejr. Dine to venstre kneb bliver konfiskeret'} },
  muzzle: { name:{en:'Shush Sue', da:'Pssst-Pia'}, color:'#7a3b3b', desc:{en:'Your leftmost Trick does not score this round', da:'Dit venstre kneb scorer ikke i denne runde'} },
  clamp:  { name:{en:'Pickpocket Pete', da:'Lommetyv-Lars'}, color:'#55606b', desc:{en:'You hold one piece fewer in your hand this round', da:'Du har én brik mindre på hånden i denne runde'} },
  siege:  { name:{en:'The Pack', da:'Flokken'}, color:'#8a4a2a', desc:{en:'The rival starts every game with an O already on the board (two on bigger boards)', da:'Modstanderen starter hvert spil med et O på brættet (to på større bræt)'} },
  toll:   { name:{en:'Lunch-Money Larry', da:'Madpenge-Mikkel'}, color:'#8a7a2e', desc:{en:'Every X you place costs $1 (nothing if you are broke)', da:'Hvert X du lægger koster $1 (intet, hvis du er flad)'} },
};

/* ---------------- turfs ----------------
 * Each ante is a part of the schoolyard with its own rival kid for the Pushover and the Regular (the bully you
 * face as the boss is picked at random, except on turf 8, where it is always the Sixth-Grader). `mod` shifts how the rival
 * plays: block/win are added to its chance of blocking your line or taking a win it sees, noise is the chance of
 * a random square instead of a smart one, centre takes the middle first, mirror answers opposite your last X. */
/** @type {{ id:string, name:Text, kid:string, trait:Text, mod:{ block?:number, win?:number, noise?:number, centre?:boolean, mirror?:boolean }, color:string }[]} */
export const TURFS = [
  { id:'sandbox', name:{en:'The Sandbox', da:'Sandkassen'}, kid:'Wee Willie', color:'#d8b45a', trait:{en:'Goes easy on blocks', da:'Blokerer sjældent'}, mod:{ block:-.18, win:-.12 } },
  { id:'swings', name:{en:'The Swings', da:'Gyngerne'}, kid:'Swing-Set Sam', color:'#5aa0d8', trait:{en:'Chases his own lines', da:'Jagter sine egne linjer'}, mod:{ block:-.1, win:.12 } },
  { id:'bars', name:{en:'The Monkey Bars', da:'Klatrestativet'}, kid:'Monkey Mo', color:'#e0873a', trait:{en:'Plays wild', da:'Spiller vildt'}, mod:{ noise:.28 } },
  { id:'sheds', name:{en:'The Bike Sheds', da:'Cykelskurene'}, kid:'Chain-Gang Chloe', color:'#7a8a96', trait:{en:'Blocks a lot', da:'Blokerer meget'}, mod:{ block:.12 } },
  { id:'canteen', name:{en:'The Canteen', da:'Kantinen'}, kid:'Canteen Carl', color:'#6ab86a', trait:{en:'Always grabs the middle', da:'Tager altid midten'}, mod:{ centre:true, block:.04 } },
  { id:'gym', name:{en:'The Gym', da:'Gymnastiksalen'}, kid:"Coach's Pet Cole", color:'#c9564a', trait:{en:'Hardly ever misses', da:'Misser næsten aldrig'}, mod:{ block:.18, win:.12 } },
  { id:'roof', name:{en:'The Roof', da:'Taget'}, kid:'Roof-Rat Rae', color:'#9a6ac8', trait:{en:'Copies your moves', da:'Kopierer dine træk'}, mod:{ mirror:true, block:.06 } },
  { id:'office', name:{en:"The Principal's Office", da:'Rektors kontor'}, kid:'Principal Prim', color:'#2f4f6f', trait:{en:'A bit of everything', da:'Lidt af det hele'}, mod:{ block:.12, win:.12, centre:true } },
];
/** After turf 8 (endless) the whole school piles on. */
export const DETENTION = { id:'detention', name:{en:'Detention', da:'Eftersidning'}, kid:'The Whole School', color:'#4a4a4a', trait:{en:'Everyone at once', da:'Alle på én gang'}, mod:{ block:.2, win:.15, centre:true } };
/** @param {number} ante */
export const turfOf = ante => TURFS[ante - 1] || DETENTION;

/** Base target per ante; small blind ×1, big ×1.5, boss ×2. */
export const ANTE_BASE = [100, 260, 700, 2000, 5000, 11000, 24000, 50000];
