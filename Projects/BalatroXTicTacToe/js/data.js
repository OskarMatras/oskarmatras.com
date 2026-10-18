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
    desc:{en:'<i>+5</i> Chips', da:'<i>+5</i> chips'} },
  red:  { name:{en:'Red X', da:'Rød X'}, short:{en:'RED', da:'RØD'}, pc:'#d3313a', chips:5, mult:4, cost:4,
    desc:{en:'<i>+5</i> Chips and <em>+4</em> Mult', da:'<i>+5</i> chips og <em>+4</em> mult'} },
  blue: { name:{en:'Blue X', da:'Blå X'}, short:{en:'BLUE', da:'BLÅ'}, pc:'#2f8ff0', chips:30, cost:4,
    desc:{en:'<i>+30</i> Chips', da:'<i>+30</i> chips'} },
  gold: { name:{en:'Gold X', da:'Guld X'}, short:{en:'GOLD', da:'GULD'}, pc:'#9a6a00', chips:5, cost:5,
    desc:{en:'<i>+5</i> Chips and earns <u>$2</u> when it scores', da:'<i>+5</i> chips og giver <u>$2</u> når den scorer'} },
  lucky:{ name:{en:'Lucky X', da:'Heldig X'}, short:{en:'LUCKY', da:'HELDIG'}, pc:'#2f9a58', chips:5, cost:5,
    desc:{en:'<i>+5</i> Chips. 1 in 3 chance of <em>+15</em> Mult, 1 in 12 chance of <u>$10</u>', da:'<i>+5</i> chips. 1 ud af 3 chance for <em>+15</em> mult, 1 ud af 12 for <u>$10</u>'} },
  glass:{ name:{en:'Glass X', da:'Glas X'}, short:{en:'GLASS', da:'GLAS'}, pc:'#3d86bd', xmult:2, cost:6,
    desc:{en:'<em>X2</em> Mult when it scores. 1 in 4 chance to shatter afterwards', da:'<em>X2</em> mult når den scorer. 1 ud af 4 chance for at den splintres bagefter'} },
  steel:{ name:{en:'Steel X', da:'Stål X'}, short:{en:'STEEL', da:'STÅL'}, pc:'#4a5960', cost:6,
    desc:{en:'<em>X1.5</em> Mult while it sits on the board outside the scoring line', da:'<em>X1,5</em> mult mens den står på brættet uden for den scorende linje'} },
  bomb: { name:{en:'Bomb X', da:'Bombe X'}, short:{en:'BOMB', da:'BOMBE'}, pc:'#ff7b3a', chips:5, cost:6,
    desc:{en:'<i>+5</i> Chips. When placed, blows up one rival O next to it', da:'<i>+5</i> chips. Sprænger et af modstanderens O ved siden af sig, når den lægges'} },
  ghost:{ name:{en:'Ghost X', da:'Spøgelses X'}, short:{en:'GHOST', da:'SPØGELSE'}, pc:'#7a52bd', chips:5, cost:6,
    desc:{en:'<i>+5</i> Chips. Your rival does not get to answer when you place it', da:'<i>+5</i> chips. Modstanderen får ikke et træk, når du lægger den'} },
  mirror:{ name:{en:'Mirror X', da:'Spejl X'}, short:{en:'MIRROR', da:'SPEJL'}, pc:'#b0457e', chips:5, cost:6,
    desc:{en:'<i>+5</i> Chips. Also drops a free Plain X on the square opposite it through the centre, if that square is empty', da:'<i>+5</i> chips. Lægger også et gratis almindeligt X på feltet overfor gennem midten, hvis det er tomt'} },
  twin: { name:{en:'Twin X', da:'Tvilling X'}, short:{en:'TWIN', da:'TVILLING'}, pc:'#1f8f8a', chips:5, retrig:1, cost:6,
    desc:{en:'<i>+5</i> Chips. Scores twice', da:'<i>+5</i> chips. Scorer to gange'} },
  // Sprout: its Mult is stored on the bag piece (`grow`), so it survives from game to game.
  sprout:{ name:{en:'Sprout X', da:'Spire X'}, short:{en:'SPROUT', da:'SPIRE'}, pc:'#3f9a3a', mult:2, cost:6,
    desc:{en:'<em>+2</em> Mult. Gains <em>+1</em> Mult every time it scores, for good', da:'<em>+2</em> mult. Får <em>+1</em> mult hver gang den scorer, for altid'} },
  cursed:{ name:{en:'Cursed X', da:'Forbandet X'}, short:{en:'CURSED', da:'FORBAND.'}, pc:'#6a2a86', xmult:3, cost:5,
    desc:{en:'<em>X3</em> Mult when it scores. The rival gets an extra move when you place it', da:'<em>X3</em> mult når den scorer. Modstanderen får et ekstra træk, når du lægger den'} },
  turncoat:{ name:{en:'Turncoat X', da:'Overløber X'}, short:{en:'TURN', da:'OVERLØB.'}, pc:'#b0502a', chips:5, cost:7,
    desc:{en:'<i>+5</i> Chips. When placed, turns one rival O next to it into a Plain X', da:'<i>+5</i> chips. Når den lægges, bliver et af modstanderens O ved siden af til et almindeligt X'} },
  hunter:{ name:{en:'Hunter X', da:'Jæger X'}, short:{en:'HUNTER', da:'JÆGER'}, pc:'#7a5a2e', chips:5, cost:5,
    desc:{en:'<i>+5</i> Chips and <em>+2</em> Mult for each rival O on the board', da:'<i>+5</i> chips og <em>+2</em> mult for hvert af modstanderens O på brættet'} },
};
export const SPECIALS = Object.keys(PIECES).filter(k => k !== 'plain');

/* ---------------- square upgrades ---------------- */
export const TILES = {
  hot:  { name:{en:'Hot Square', da:'Varmt felt'}, badge:(/** @type {number} */ l)=>'+'+(4*l),
    desc:{en:'An X on this square gives <em>+4</em> Mult when it scores (stacks per upgrade)', da:'Et X på dette felt giver <em>+4</em> mult når det scorer (stabler pr. opgradering)'} },
  rich: { name:{en:'Rich Square', da:'Rigt felt'}, badge:(/** @type {number} */ l)=>'+'+(30*l),
    desc:{en:'An X on this square gives <i>+30</i> Chips when it scores (stacks per upgrade)', da:'Et X på dette felt giver <i>+30</i> chips når det scorer (stabler pr. opgradering)'} },
  gild: { name:{en:'Gilded Square', da:'Forgyldt felt'}, badge:(/** @type {number} */ l)=>'$'+l,
    desc:{en:'An X on this square earns <u>$1</u> when it scores (stacks per upgrade)', da:'Et X på dette felt giver <u>$1</u> når det scorer (stabler pr. opgradering)'} },
  echo: { name:{en:'Echo Square', da:'Ekkofelt'}, badge:(/** @type {number} */ l)=>'↻'+(l>1?l:''),
    desc:{en:'An X on this square scores one extra time (stacks per upgrade)', da:'Et X på dette felt scorer en ekstra gang (stabler pr. opgradering)'} },
  star: { name:{en:'Star Square', da:'Stjernefelt'}, cost:6, badge:(/** @type {number} */ l)=>'★'+(l>1?l:''),
    desc:{en:'An X on this square gives <em>X1.25</em> Mult when it scores (stacks per upgrade)', da:'Et X på dette felt giver <em>X1,25</em> mult når det scorer (stabler pr. opgradering)'} },
  safe: { name:{en:'Safe Square', da:'Sikkert felt'}, cost:4, badge:()=>'⛨︎',
    desc:{en:'The rival never plays on this square while any other square is free', da:'Modstanderen lægger aldrig på dette felt, så længe et andet felt er frit'} },
  trap: { name:{en:'Trap Square', da:'Fældefelt'}, cost:5, badge:()=>'⚠︎',
    desc:{en:'If the rival plays here, its O is removed at once and you earn <u>$2</u>', da:'Hvis modstanderen lægger her, fjernes dens O med det samme, og du får <u>$2</u>'} },
};

export const RARITY = {
  1:{ name:{en:'Common', da:'Almindelig'}, color:'var(--common)' },
  2:{ name:{en:'Uncommon', da:'Usædvanlig'}, color:'var(--uncommon)' },
  3:{ name:{en:'Rare', da:'Sjælden'}, color:'var(--rare)' },
};

/* ---------------- Jokers ----------------
 * x:    runs for every X that scores (ctx, cellIndex, piece, joker)
 * line: runs once per scored line, after the X's (ctx, joker)
 * endRound: money paid at cash-out
 * Passive Jokers have no hooks; the engine checks for them by id. */
/** @type {Record<string, any>} */
export const JOKERS = {
  jester:   { name:'Jester', rar:1, cost:3, gl:'✦',
    desc:()=>({en:'<em>+4</em> Mult', da:'<em>+4</em> mult'}), line:()=>({mult:4}) },
  center:   { name:'Center Stage', rar:1, cost:5, gl:'◉',
    desc:()=>({en:'<em>+10</em> Mult if the line runs through a center square', da:'<em>+10</em> mult hvis linjen går gennem et midterfelt'}),
    line:(/** @type {ScoreCtx} */ c)=>c.cells.some(isCenter)?{mult:10}:null },
  corner:   { name:'Corner Office', rar:1, cost:5, gl:'◰',
    desc:()=>({en:'Each X on a corner square gives <i>+30</i> Chips', da:'Hvert X på et hjørnefelt giver <i>+30</i> chips'}),
    x:(/** @type {ScoreCtx} */ c, /** @type {number} */ i)=>isCorner(i)?{chips:30}:null },
  edge:     { name:'Edgelord', rar:1, cost:5, gl:'▣',
    desc:()=>({en:'Each X on an edge square (not a corner) gives <em>+4</em> Mult', da:'Hvert X på et kantfelt (ikke hjørne) giver <em>+4</em> mult'}),
    x:(/** @type {ScoreCtx} */ c, /** @type {number} */ i)=>isEdge(i)?{mult:4}:null },
  speedrun: { name:'Speedrun', rar:1, cost:5, gl:'↯',
    desc:()=>({en:'<em>+15</em> Mult if the line is finished with your 3rd X of the game', da:'<em>+15</em> mult hvis linjen bliver færdig med dit 3. X i spillet'}),
    line:()=>S.g.placements<=3?{mult:15}:null },
  spite:    { name:'Spite', rar:1, cost:5, gl:'◎',
    desc:()=>({en:'<em>+2</em> Mult for each rival O on the board', da:'<em>+2</em> mult for hvert af modstanderens O på brættet'}),
    line:()=>{ const n=countO(); return n?{mult:2*n}:null; } },
  crowded:  { name:'Packed House', rar:1, cost:5, gl:'▦',
    desc:()=>({en:'<em>+1</em> Mult for each filled square', da:'<em>+1</em> mult for hvert udfyldt felt'}),
    line:()=>({mult:S.board.filter(Boolean).length}) },
  rowfan:   { name:'Row Fan', rar:1, cost:4, gl:'═',
    desc:()=>({en:'<em>+8</em> Mult on Rows', da:'<em>+8</em> mult på rækker'}), line:(/** @type {ScoreCtx} */ c)=>c.type==='row'?{mult:8}:null },
  colfan:   { name:'Column Fan', rar:1, cost:4, gl:'║',
    desc:()=>({en:'<em>+8</em> Mult on Columns', da:'<em>+8</em> mult på kolonner'}), line:(/** @type {ScoreCtx} */ c)=>c.type==='col'?{mult:8}:null },
  plainjane:{ name:'Plain Jane', rar:1, cost:4, gl:'X',
    desc:()=>({en:'Each Plain X gives <i>+15</i> Chips when it scores', da:'Hvert almindeligt X giver <i>+15</i> chips når det scorer'}),
    x:(/** @type {ScoreCtx} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='plain'?{chips:15}:null },
  pennant:  { name:'Pennant', rar:1, cost:5, gl:'⚑',
    desc:()=>({en:'<i>+25</i> Chips for each discard you have left', da:'<i>+25</i> chips for hver kassering du har tilbage'}),
    line:()=>S.round.discards?{chips:25*S.round.discards}:null },
  soreloser:{ name:'Sore Loser', rar:1, cost:4, gl:'☹︎',
    desc:()=>({en:'Earn <u>$3</u> whenever you lose a game', da:'Få <u>$3</u> hver gang du taber et spil'}) },
  goldtooth:{ name:'Gold Tooth', rar:1, cost:6, gl:'$',
    desc:()=>({en:'Earn <u>$4</u> at the end of each round', da:'Få <u>$4</u> ved slutningen af hver runde'}), endRound:()=>4 },
  jeweler:  { name:'Jeweler', rar:1, cost:5, gl:'◆',
    desc:()=>({en:'Gold X also give <em>+6</em> Mult when they score', da:'Guld X giver også <em>+6</em> mult når de scorer'}),
    x:(/** @type {ScoreCtx} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='gold'?{mult:6}:null },
  scout:    { name:'Scout', rar:1, cost:4, gl:'+1',
    desc:()=>({en:'<u>+1</u> piece in your hand', da:'<u>+1</u> brik på hånden'}) },
  diag:     { name:'Diagonal Dash', rar:2, cost:6, gl:'⤡',
    desc:()=>({en:'<em>X2</em> Mult on Diagonals', da:'<em>X2</em> mult på diagonaler'}), line:(/** @type {ScoreCtx} */ c)=>c.type==='diag'?{xmult:2}:null },
  fork:     { name:'Forkmaster', rar:2, cost:7, gl:'⑂',
    desc:()=>({en:'<em>X2.5</em> Mult if you had 2 or more winning threats open when you scored', da:'<em>X2,5</em> mult hvis du havde 2 eller flere vindertrusler åbne da du scorede'}),
    line:(/** @type {ScoreCtx} */ c)=>c.forked?{xmult:2.5}:null },
  catsgame: { name:"Cat's Game", rar:2, cost:6, gl:'≡',
    desc:()=>({en:'Draws score <em>X3</em> Mult and pay <u>$2</u>', da:'Uafgjorte spil scorer <em>X3</em> mult og giver <u>$2</u>'}),
    line:(/** @type {ScoreCtx} */ c)=>c.type==='draw'?{xmult:3, money:2}:null },
  snowball: { name:'Snowball', rar:2, cost:6, gl:'❄︎',
    desc:(/** @type {any} */ j)=>{ const m=(j&&j.data.m)||0; return {en:`Gains <em>+1</em> Mult every time you score. Loses half when the rival gets three in a row (currently <em>+${m}</em>)`, da:`Får <em>+1</em> mult hver gang du scorer. Mister halvdelen, når modstanderen får tre på stribe (lige nu <em>+${m}</em>)`}; },
    line:(/** @type {ScoreCtx} */ c, /** @type {any} */ j)=>{ j.data.m=(j.data.m||0)+1; return {mult:j.data.m}; },
    gameEnd:(/** @type {any} */ j, /** @type {any} */ info)=>{ if (info.reason==='busted') j.data.m=Math.floor((j.data.m||0)/2); },
    val:(/** @type {any} */ j)=>'+'+(j.data.m||0) },
  bully:    { name:'Bully', rar:2, cost:6, gl:'✊︎',
    desc:()=>({en:"Your rival's first move each game is random", da:'Modstanderens første træk i hvert spil er tilfældigt'}) },
  sleepy:   { name:'Sleepy Rival', rar:2, cost:6, gl:'z',
    desc:()=>({en:'Your rival blocks your lines 25% less often', da:'Modstanderen blokerer dine linjer 25% sjældnere'}) },
  doubletap:{ name:'Double Tap', rar:2, cost:7, gl:'»',
    desc:()=>({en:'Your first X each game is a free move: the rival does not answer it', da:'Dit første X i hvert spil er et frit træk: modstanderen svarer ikke'}) },
  gallery:  { name:'Gallery', rar:2, cost:6, gl:'▤',
    desc:()=>({en:'<em>+3</em> Mult for each Joker you own', da:'<em>+3</em> mult for hver Joker du har'}), line:()=>({mult:3*S.jokers.length}) },
  collector:{ name:'Collector', rar:2, cost:6, gl:'∴',
    desc:()=>({en:'<em>+2</em> Mult for each special X in your bag', da:'<em>+2</em> mult for hvert specielt X i din pose'}),
    line:()=>{ const n=S.bag.filter(p=>p.type!=='plain').length; return n?{mult:2*n}:null; } },
  ironclad: { name:'Ironclad', rar:2, cost:6, gl:'■',
    desc:()=>({en:'Steel X give <em>X2</em> instead of X1.5', da:'Stål X giver <em>X2</em> i stedet for X1,5'}) },
  echoj:    { name:'Encore', rar:2, cost:7, gl:'↻',
    desc:()=>({en:'The first X in every scored line scores one extra time', da:'Det første X i hver scorende linje scorer en ekstra gang'}) },
  guardian: { name:'Guardian', rar:2, cost:7, gl:'⛨︎',
    desc:()=>({en:'When your rival completes three in a row, 1 in 2 chance their O fizzles', da:'Når modstanderen får tre på stribe, er der 1 ud af 2 chance for at deres O forsvinder'}) },
  overtime: { name:'Overtime', rar:3, cost:8, gl:'∞',
    desc:()=>({en:'Finishing a line no longer ends the game on a 3×3 board. On bigger boards, every line after the first in a game pays <u>$2</u>', da:'En færdig linje afslutter ikke længere spillet på et 3×3-bræt. På større bræt giver hver linje efter den første i et spil <u>$2</u>'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && S.N>=4 && S.g.lines>=1)?{money:2}:null },
  combo:    { name:'Combo Meter', rar:3, cost:8, gl:'↑',
    desc:()=>({en:'<em>X1.5</em> Mult for each line already scored this game (multiplies)', da:'<em>X1,5</em> mult for hver linje der allerede er scoret i dette spil (ganges)'}),
    line:()=>S.g.lines?{xmult:+Math.pow(1.5,S.g.lines).toFixed(3)}:null },
  momentum: { name:'Momentum', rar:3, cost:8, gl:'➠︎',
    desc:(/** @type {any} */ j)=>{ const x=(1+((j&&j.data.n)||0)*0.05).toFixed(2); return {en:`Gains <em>X0.05</em> Mult every time you score, for good (currently <em>X${x}</em>)`, da:`Får <em>X0,05</em> mult hver gang du scorer, for altid (lige nu <em>X${x.replace('.',',')}</em>)`}; },
    line:(/** @type {ScoreCtx} */ c, /** @type {any} */ j)=>{ j.data.n=(j.data.n||0)+1; return {xmult:+(1+j.data.n*0.05).toFixed(2)}; },
    val:(/** @type {any} */ j)=>'X'+(1+(j.data.n||0)*0.05).toFixed(2) },
  banana:   { name:'Banana Bomb', rar:3, cost:7, gl:'☾',
    desc:()=>({en:'<em>X3</em> Mult. 1 in 5 chance it blows up at the end of a round', da:'<em>X3</em> mult. 1 ud af 5 chance for at den sprænger ved slutningen af en runde'}), line:()=>({xmult:3}) },
  grandstand:{ name:'Grandstand', rar:3, cost:8, gl:'⌂',
    desc:()=>({en:'Square upgrades trigger twice', da:'Feltopgraderinger udløses to gange'}) },
  midas:    { name:'Midas', rar:3, cost:8, gl:'♕︎',
    desc:()=>({en:'Gold X give <em>X1.5</em> Mult when they score', da:'Guld X giver <em>X1,5</em> mult når de scorer'}),
    x:(/** @type {ScoreCtx} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='gold'?{xmult:1.5}:null },
  /* ---- board-expansion tactics: these come alive on 4×4 and 5×5 ---- */
  longshot: { name:'Long Shot', rar:2, cost:7, gl:'\u27F7', req:()=>S.N>=4,
    desc:()=>({en:'Lines that are part of 4 in a row score <em>X2</em> Mult, 5 in a row <em>X3</em>', da:'Linjer der er del af 4 på stribe scorer <em>X2</em> mult, 5 på stribe <em>X3</em>'}),
    line:(/** @type {any} */ c)=>{ if (c.type==='draw') return null; const n=runLength(geo().lines[c.li]); return n>=4?{xmult:n-2}:null; } },
  bigsky:   { name:'Big Sky', rar:2, cost:6, gl:'\u25A1', req:()=>S.N>=4,
    desc:()=>({en:'<em>X1.5</em> Mult on a 4×4 board, <em>X2</em> on 5×5', da:'<em>X1,5</em> mult på et 4×4-bræt, <em>X2</em> på 5×5'}),
    line:()=>S.N>3?{xmult:1+0.5*(S.N-3)}:null },
  crossroads:{ name:'Crossroads', rar:2, cost:6, gl:'\u271A',
    desc:()=>({en:'<em>+15</em> Mult for each X in the line that is also part of another scored line', da:'<em>+15</em> mult for hvert X i linjen der også er del af en anden scoret linje'}),
    line:(/** @type {any} */ c)=>{ if (c.type==='draw') return null; const L=geo().lines; const n=c.cells.filter((/** @type {number} */ i)=>S.g.scored.some((/** @type {number} */ li)=>li!==c.li && L[li].cells.includes(i))).length; return n?{mult:15*n}:null; } },
  cartographer:{ name:'Cartographer', rar:1, cost:5, gl:'\u2316',
    desc:()=>({en:'<i>+8</i> Chips for each empty square on the board', da:'<i>+8</i> chips for hvert tomt felt på brættet'}),
    line:()=>{ const n=S.board.filter((/** @type {any} */ x)=>!x).length; return n?{chips:8*n}:null; } },
  landlord: { name:'Landlord', rar:1, cost:5, gl:'\u2302\uFE0E',
    desc:()=>({en:'<em>+1</em> Mult for each of your X on the board', da:'<em>+1</em> mult for hvert af dine X på brættet'}),
    line:()=>({mult:S.board.filter((/** @type {any} */ x)=>x&&x.t==='X').length}) },
  pincer:   { name:'Pincer', rar:1, cost:5, gl:'\u2194',
    desc:()=>({en:'<i>+25</i> Chips for each rival O touching the line', da:'<i>+25</i> chips for hvert af modstanderens O der rører linjen'}),
    line:(/** @type {any} */ c)=>{ const os=new Set(); c.cells.forEach((/** @type {number} */ i)=>neighbours(i).forEach(k=>{ if(S.board[k]&&S.board[k].t==='O') os.add(k); })); return os.size?{chips:25*os.size}:null; } },
  hermit:   { name:'Hermit', rar:2, cost:6, gl:'\u25CC',
    desc:()=>({en:'<em>X2</em> Mult if no rival O touches the line', da:'<em>X2</em> mult hvis intet O rører linjen'}),
    line:(/** @type {any} */ c)=>{ if (c.type==='draw') return null; const touched=c.cells.some((/** @type {number} */ i)=>neighbours(i).some(k=>S.board[k]&&S.board[k].t==='O')); return touched?null:{xmult:2}; } },
  checkmate:{ name:'Checkmate', rar:3, cost:8, gl:'\u265A\uFE0E',
    desc:()=>({en:'<em>X3</em> Mult if you had 3 or more winning threats open when you scored', da:'<em>X3</em> mult hvis du havde 3 eller flere vindertrusler åbne da du scorede'}),
    line:(/** @type {any} */ c)=>c.threats>=3?{xmult:3}:null },
  demolition:{ name:'Demolition', rar:2, cost:6, gl:'\u2739',
    desc:(/** @type {any} */ j)=>{ const m=(j&&j.data.m)||0; return {en:`Gains <em>+3</em> Mult every time a Bomb X blows up an O (currently <em>+${m}</em>)`, da:`Får <em>+3</em> mult hver gang et Bombe X sprænger et O (lige nu <em>+${m}</em>)`}; },
    line:(/** @type {any} */ c, /** @type {any} */ j)=>j.data.m?{mult:j.data.m}:null, val:(/** @type {any} */ j)=>'+'+(j.data.m||0) },
  ghosttown:{ name:'Ghost Town', rar:2, cost:6, gl:'\u2601\uFE0E',
    desc:()=>({en:'Ghost X give <em>X1.5</em> Mult when they score', da:'Spøgelses X giver <em>X1,5</em> mult når de scorer'}),
    x:(/** @type {any} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='ghost'?{xmult:1.5}:null },
  glassjaw: { name:'Glass Jaw', rar:3, cost:7, gl:'\u25C8',
    desc:()=>({en:'Glass X give <em>X3</em> instead of X2, but always shatter', da:'Glas X giver <em>X3</em> i stedet for X2, men splintres altid'}) },
  reflection:{ name:'Reflection', rar:2, cost:6, gl:'\u29D6',
    desc:()=>({en:'Mirror X and the X they drop give <em>+6</em> Mult when they score', da:'Spejl X og det X de lægger giver <em>+6</em> mult når de scorer'}),
    x:(/** @type {any} */ c, /** @type {number} */ i, /** @type {any} */ p)=>(p.type==='mirror'||p.mirrored)?{mult:6}:null },

  /* ---- sets: what the three X in a line are made of ---- */
  purist:   { name:'Purist', rar:2, cost:6, gl:'○',
    desc:()=>({en:'<em>X2</em> Mult if every X in the line is a Plain X', da:'<em>X2</em> mult hvis hvert X i linjen er et almindeligt X'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && kindsIn(c).every((/** @type {string} */ k)=>k==='plain'))?{xmult:2}:null },
  rainbow:  { name:'Rainbow', rar:2, cost:7, gl:'☼︎',
    desc:()=>({en:'<em>X2.5</em> Mult if the line has three different kinds of X', da:'<em>X2,5</em> mult hvis linjen har tre forskellige slags X'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && new Set(kindsIn(c)).size>=3)?{xmult:2.5}:null },
  matching: { name:'Matching Set', rar:2, cost:7, gl:'⁂',
    desc:()=>({en:'<em>X3</em> Mult if all three X in the line are the same special kind', da:'<em>X3</em> mult hvis alle tre X i linjen er samme specielle slags'}),
    line:(/** @type {any} */ c)=>{ if (c.type==='draw') return null; const k=kindsIn(c); return (k[0]!=='plain' && k.every((/** @type {string} */ x)=>x===k[0]))?{xmult:3}:null; } },
  variety:  { name:'Variety Pack', rar:2, cost:6, gl:'❖︎',
    desc:()=>({en:'<em>+3</em> Mult for each different kind of special X in your bag', da:'<em>+3</em> mult for hvert forskelligt slags specielt X i din pose'}),
    line:()=>{ const n=new Set(S.bag.filter((/** @type {any} */ p)=>p.type!=='plain').map((/** @type {any} */ p)=>p.type)).size; return n?{mult:3*n}:null; } },

  /* ---- one Joker for a kind of X ---- */
  redalert: { name:'Red Alert', rar:2, cost:6, gl:'▲︎',
    desc:()=>({en:'Each Red X also gives <em>X1.5</em> Mult when it scores', da:'Hvert Rødt X giver også <em>X1,5</em> mult når det scorer'}),
    x:(/** @type {any} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='red'?{xmult:1.5}:null },
  bluemoon: { name:'Blue Moon', rar:1, cost:5, gl:'☽︎',
    desc:()=>({en:'Each Blue X also gives <i>+40</i> Chips and <em>+3</em> Mult when it scores', da:'Hvert Blåt X giver også <i>+40</i> chips og <em>+3</em> mult når det scorer'}),
    x:(/** @type {any} */ c, /** @type {number} */ i, /** @type {any} */ p)=>p.type==='blue'?{chips:40, mult:3}:null },
  fourleaf: { name:'Four-Leaf Clover', rar:2, cost:6, gl:'❀︎',
    desc:()=>({en:'Lucky X trigger twice as often', da:'Heldige X udløses dobbelt så ofte'}) },
  twinpeaks:{ name:'Twin Peaks', rar:2, cost:6, gl:'²',
    desc:()=>({en:'Twin X score three times instead of two', da:'Tvilling X scorer tre gange i stedet for to'}) },
  greenhouse:{ name:'Greenhouse', rar:1, cost:5, gl:'❦︎',
    desc:()=>({en:'Sprout X grow <em>+2</em> Mult each time instead of +1', da:'Spire X vokser med <em>+2</em> mult hver gang i stedet for +1'}) },
  exorcist: { name:'Exorcist', rar:2, cost:7, gl:'✝︎',
    desc:()=>({en:'Cursed X no longer give the rival an extra move', da:'Forbandede X giver ikke længere modstanderen et ekstra træk'}) },

  /* ---- money ---- */
  taxman:   { name:'Tax Collector', rar:1, cost:5, gl:'¤',
    desc:()=>({en:'Earn <u>$1</u> the first time you score a line in each game', da:'Få <u>$1</u> første gang du scorer en linje i hvert spil'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && S.g.lines===0)?{money:1}:null },
  piggy:    { name:'Piggy Bank', rar:2, cost:6, gl:'¢',
    desc:()=>({en:'<em>+1</em> Mult for every <u>$3</u> you hold', da:'<em>+1</em> mult for hver <u>$3</u> du har'}),
    line:()=>{ const n=Math.floor(S.money/3); return n?{mult:n}:null; } },
  banker:   { name:'Banker', rar:2, cost:7, gl:'₤',
    desc:()=>({en:'Your interest is capped at <u>$10</u> instead of $5', da:'Din rente er begrænset til <u>$10</u> i stedet for $5'}) },

  /* ---- bag, hand and shelf ---- */
  heldback: { name:'Held Back', rar:1, cost:5, gl:'☞︎',
    desc:()=>({en:'<em>+5</em> Mult for each piece still in your hand', da:'<em>+5</em> mult for hver brik du stadig har på hånden'}),
    line:()=>S.hand.length?{mult:5*S.hand.length}:null },
  minimalist:{ name:'Minimalist', rar:2, cost:7, gl:'·',
    desc:()=>({en:'<em>X2</em> Mult while your bag holds 8 pieces or fewer', da:'<em>X2</em> mult mens din pose har 8 brikker eller færre'}),
    line:()=>S.bag.length<=8?{xmult:2}:null },
  hoarder:  { name:'Hoarder', rar:1, cost:5, gl:'▥︎',
    desc:()=>({en:'<i>+4</i> Chips for each piece in your bag', da:'<i>+4</i> chips for hver brik i din pose'}),
    line:()=>({chips:4*S.bag.length}) },
  chalkboard:{ name:'Chalkboard', rar:2, cost:6, gl:'✎︎',
    desc:()=>({en:'<em>+2</em> Mult for every chalk level you have bought', da:'<em>+2</em> mult for hvert kridtniveau du har købt'}),
    line:()=>{ const n=Object.values(S.levels).reduce((a,b)=>a+b,0)-4; return n>0?{mult:2*n}:null; } },
  toolbox:  { name:'Toolbox', rar:1, cost:5, gl:'⚒︎',
    desc:()=>({en:'<em>+6</em> Mult for each item you hold', da:'<em>+6</em> mult for hver genstand du har'}),
    line:()=>S.items.length?{mult:6*S.items.length}:null },
  showoff:  { name:'Showoff', rar:2, cost:6, gl:'★︎',
    desc:()=>({en:'<em>X0.5</em> Mult for each Joker you own with a special finish', da:'<em>X0,5</em> mult for hver Joker du har med en speciel finish'}),
    line:()=>{ const n=S.jokers.filter((/** @type {any} */ j)=>j.ed).length; return n?{xmult:1+0.5*n}:null; } },

  /* ---- where the line is ---- */
  bullseye: { name:'Bullseye', rar:1, cost:5, gl:'⊙︎',
    desc:()=>({en:'Each X on a center square gives <em>+8</em> Mult', da:'Hvert X på et midterfelt giver <em>+8</em> mult'}),
    x:(/** @type {any} */ c, /** @type {number} */ i)=>isCenter(i)?{mult:8}:null },
  perimeter:{ name:'Perimeter', rar:2, cost:6, gl:'▢︎',
    desc:()=>({en:'<em>X2</em> Mult if every X in the line is on the outer ring of the board', da:'<em>X2</em> mult hvis hvert X i linjen står på brættets yderste ring'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && c.cells.every((/** @type {number} */ i)=>isCorner(i)||isEdge(i)))?{xmult:2}:null },

  /* ---- rhythm and risk ---- */
  hotstreak:{ name:'Hot Streak', rar:2, cost:7, gl:'♨︎',
    desc:(/** @type {any} */ j)=>{ const x=(1+((j&&j.data.n)||0)*0.25).toFixed(2); return {en:`Gains <em>X0.25</em> Mult for every game in a row you score a line. Resets when a game ends without one (currently <em>X${x}</em>)`, da:`Får <em>X0,25</em> mult for hvert spil i træk, hvor du scorer en linje. Nulstilles, når et spil slutter uden en (lige nu <em>X${x.replace('.',',')}</em>)`}; },
    line:(/** @type {any} */ c, /** @type {any} */ j)=>j.data.n?{xmult:+(1+j.data.n*0.25).toFixed(2)}:null,
    gameEnd:(/** @type {any} */ j, /** @type {any} */ info)=>{ j.data.n = info.lines>0 ? (j.data.n||0)+1 : 0; },
    val:(/** @type {any} */ j)=>'X'+(1+(j.data.n||0)*0.25).toFixed(2) },
  sprawl:   { name:'Sprawl', rar:1, cost:5, gl:'⟡', req:()=>S.N>=4,
    desc:()=>({en:'<em>+8</em> Mult for each line already scored this game', da:'<em>+8</em> mult for hver linje der allerede er scoret i dette spil'}),
    line:(/** @type {any} */ c)=>(c.type!=='draw' && S.g.lines)?{mult:8*S.g.lines}:null },
  daredevil:{ name:'Daredevil', rar:2, cost:7, gl:'☠︎',
    desc:()=>({en:'<em>X2.5</em> Mult if the rival has a winning square open when you score', da:'<em>X2,5</em> mult hvis modstanderen har et vindende felt åbent, når du scorer'}),
    line:(/** @type {any} */ c)=>c.oThreat>0?{xmult:2.5}:null },
  curtain:  { name:'Curtain Call', rar:2, cost:7, gl:'⌣',
    desc:()=>({en:'The last X in every scored line scores one extra time', da:'Det sidste X i hver scorende linje scorer en ekstra gang'}) },
  copycat:  { name:'Copycat', rar:3, cost:9, gl:'⧉',
    desc:()=>({en:'Copies the scoring effect of the Joker to its right', da:'Kopierer scoringseffekten fra Jokeren til højre for den'}) },
};
export { hasJ };

/* ---------------- Joker editions ----------------
 * A shop Joker sometimes comes in a special finish. The edition fires
 * once per scored line, after the Joker's own effect, and the card gets
 * the matching animated sheen (see cardfx.js and game.css). */
/** @type {Record<string, any>} */
export const EDITIONS = {
  // Negative takes no score effect: it is one more Joker slot (see jokerSlots() in rules.js).
  negative: { name:{en:'Negative', da:'Negativ'}, chance:.025, cost:4, effect:null,
    desc:{en:'<u>+1</u> Joker slot', da:'<u>+1</u> Joker-plads'} },
  foil: { name:{en:'Foil', da:'Folie'}, chance:.10, cost:2, effect:{chips:50},
    desc:{en:'<i>+50</i> Chips', da:'<i>+50</i> chips'} },
  holo: { name:{en:'Holographic', da:'Holografisk'}, chance:.06, cost:3, effect:{mult:10},
    desc:{en:'<em>+10</em> Mult', da:'<em>+10</em> mult'} },
  poly: { name:{en:'Polychrome', da:'Polykrom'}, chance:.03, cost:5, effect:{xmult:1.5},
    desc:{en:'<em>X1.5</em> Mult', da:'<em>X1,5</em> mult'} },
};

/* ---------------- booster packs ----------------
 * Bought in the shop, opened on the spot: you see `show` cards and keep
 * `choose` of them. */
/** @type {Record<string, any>} */
export const PACKS = {
  joker:   { name:{en:'Joker Pack', da:'Jokerpakke'}, gl:'J', color:'#b4423d', cost:5, show:3, choose:1,
    desc:{en:'Pick <u>1</u> of <u>3</u> Jokers. Better odds of a special finish', da:'Vælg <u>1</u> af <u>3</u> Jokere. Bedre chance for en speciel finish'} },
  piece:   { name:{en:'Piece Pack', da:'Brikpakke'}, gl:'X', color:'#5b6f8a', cost:4, show:4, choose:2,
    desc:{en:'Pick <u>2</u> of <u>4</u> special X pieces for your bag', da:'Vælg <u>2</u> af <u>4</u> specielle X-brikker til din pose'} },
  chalk:   { name:{en:'Chalk Pack', da:'Kridtpakke'}, gl:'\u2550', color:'#2b8f9a', cost:4, show:3, choose:1,
    desc:{en:'Pick <u>1</u> of <u>3</u> chalks. It levels up a score type right away', da:'Vælg <u>1</u> af <u>3</u> kridt. Det hæver en scoretype med det samme'} },
  builder: { name:{en:'Builder Pack', da:'Byggepakke'}, gl:'\u25A6', color:'#a8742a', cost:5, show:3, choose:1,
    desc:{en:'Pick <u>1</u> of <u>3</u> square upgrades and place it on the board', da:'Vælg <u>1</u> af <u>3</u> feltopgraderinger og placér den på brættet'} },
  tool:    { name:{en:'Tool Pack', da:'Værktøjspakke'}, gl:'\u2692\uFE0E', color:'#7a4bb3', cost:3, show:2, choose:1,
    desc:{en:'Pick <u>1</u> of <u>2</u> tools', da:'Vælg <u>1</u> af <u>2</u> værktøjer'} },
  // Shows `targets` random X from your bag next to the edits: pick an edit, then the X it changes.
  forge:   { name:{en:'Forge Pack', da:'Smedjepakke'}, gl:'⚙︎', color:'#c0572b', cost:6, show:3, choose:1, targets:7,
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
  reshuffle:{ name:{en:'The Reshuffle', da:'Omdelingen'}, gl:'⟳', kind:'tool', need:'play',
    desc:{en:'Throw away your whole hand and draw a fresh one. Does not use a discard', da:'Smid hele din hånd væk og træk en ny. Bruger ikke en kassering'} },
  // Passive: it is never "used". It waits in your item slots and triggers by itself (see placeX in engine.js).
  safetynet:{ name:{en:'Safety Net', da:'Sikkerhedsnet'}, gl:'⛶', kind:'tool', need:'passive',
    desc:{en:'Passive. When the rival gets three in a row, the net catches it: that O vanishes and the game goes on. Used up when it triggers', da:'Passiv. Når modstanderen får tre på stribe, griber nettet det: det O forsvinder, og spillet fortsætter. Bruges op, når det udløses'} },
  hourglass:{ name:{en:'The Hourglass', da:'Timeglasset'}, gl:'⧗', kind:'tool', need:'play',
    desc:{en:'Gain one extra game this round', da:'Få ét ekstra spil i denne runde'} },
  amplifier:{ name:{en:'The Amplifier', da:'Forstærkeren'}, gl:'⇧', kind:'tool', need:'play',
    desc:{en:'The next line you score this game gets <em>X2</em> Mult', da:'Den næste linje, du scorer i dette spil, får <em>X2</em> mult'} },
  eraser:  { name:{en:'The Eraser', da:'Viskelæderet'}, gl:'⌫', kind:'tool', need:'board',
    desc:{en:"Remove one of your rival's O marks from the board", da:'Fjern et af modstanderens O fra brættet'} },
  sprint:  { name:{en:'The Sprint', da:'Spurten'}, gl:'»', kind:'tool', need:'play',
    desc:{en:'Your next X is a free move: the rival does not answer it', da:'Dit næste X er et frit træk: modstanderen svarer ikke'} },
  forge:   { name:{en:'The Forge', da:'Smedjen'}, gl:'⚒︎', kind:'tool', need:'any',
    desc:{en:'Turn a random Plain X in your bag into a random special X', da:'Gør et tilfældigt almindeligt X i din pose til et tilfældigt specielt X'} },
  miser:   { name:{en:'The Miser', da:'Gnieren'}, gl:'$$', kind:'tool', need:'any',
    desc:{en:'Double your money (max <u>+$20</u>)', da:'Fordobl dine penge (højst <u>+$20</u>)'} },
};

/* ---------------- vouchers (permanent, one per ante) ---------------- */
/** @type {Record<string, any>} */
export const VOUCHERS = {
  extragame:{ name:{en:'Extra Game', da:'Ekstra spil'}, gl:'+G', desc:{en:'<i>+1</i> game every round', da:'<i>+1</i> spil hver runde'}, apply:()=>{ S.maxGames++; } },
  sparehand:{ name:{en:'Spare Discard', da:'Ekstra kassering'}, gl:'+D', desc:{en:'<em>+1</em> discard every round', da:'<em>+1</em> kassering hver runde'}, apply:()=>{ S.maxDiscards++; } },
  pockets:  { name:{en:'Deep Pockets', da:'Dybe lommer'}, gl:'+H', desc:{en:'<u>+1</u> piece in your hand', da:'<u>+1</u> brik på hånden'}, apply:()=>{ S.handSize++; } },
  rack:     { name:{en:'Joker Rack', da:'Jokerhylde'}, gl:'+J', desc:{en:'<u>+1</u> Joker slot', da:'<u>+1</u> Joker-plads'}, apply:()=>{ S.jokerSlots++; } },
  satchel:  { name:{en:'Satchel', da:'Taske'}, gl:'+C', desc:{en:'<u>+1</u> item slot', da:'<u>+1</u> genstandsplads'}, apply:()=>{ S.itemSlots++; } },
  coupon:   { name:{en:'Coupon', da:'Kupon'}, gl:'%', desc:{en:'Shop rerolls start at <u>$2</u>', da:'Nye varer i butikken starter ved <u>$2</u>'}, apply:()=>{} },
  overstock:{ name:{en:'Overstock', da:'Overskud'}, gl:'+S', desc:{en:'<u>+1</u> card in every shop', da:'<u>+1</u> kort i hver butik'}, apply:()=>{ S.cardSlots = (S.cardSlots || 2) + 1; } },
  packrat:  { name:{en:'Pack Rack', da:'Pakkehylde'}, gl:'+P', desc:{en:'<u>+1</u> pack in every shop', da:'<u>+1</u> pakke i hver butik'}, apply:()=>{ S.packSlots = (S.packSlots || 2) + 1; }, req:()=>(S.packSlots || 2) < 3 },
  compound: { name:{en:'Compound Interest', da:'Renters rente'}, gl:'+$', desc:{en:'Your interest cap is <u>$5</u> higher', da:'Dit renteloft er <u>$5</u> højere'}, apply:()=>{ S.interestCap = (S.interestCap || 5) + 5; } },
  clearance:{ name:{en:'Clearance Sale', da:'Udsalg'}, gl:'-$', desc:{en:'Everything in the shop costs <u>$1</u> less', da:'Alt i butikken koster <u>$1</u> mindre'}, apply:()=>{ S.discount = (S.discount || 0) + 1; }, req:()=>!S.discount },
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
  plain:  { name:{en:'Plain Set', da:'Almindeligt sæt'}, gl:'X', unlock:0,
    desc:{en:'Eight Plain X. Nothing fancy: the way it was meant to start', da:'Otte almindelige X. Ingenting fancy: sådan som det var tænkt'}, apply:()=>{} },
  red:    { name:{en:'Red Set', da:'Rødt sæt'}, gl:'R', unlock:2,
    desc:{en:'Start with <b>2 Red X</b> in your bag (<i>+5</i> Chips and <em>+4</em> Mult each)', da:'Start med <b>2 Røde X</b> i din pose (<i>+5</i> chips og <em>+4</em> mult hver)'}, apply:()=>swapPlain(2,'red') },
  lucky:  { name:{en:'Lucky Set', da:'Heldigt sæt'}, gl:'L', unlock:3,
    desc:{en:'Start with <b>2 Lucky X</b>. Feeling lucky?', da:'Start med <b>2 Heldige X</b>. Føler du dig heldig?'}, apply:()=>swapPlain(2,'lucky') },
  glass:  { name:{en:'Glass Set', da:'Glassæt'}, gl:'G', unlock:4,
    desc:{en:'Start with <b>3 Glass X</b>: <em>X2</em> Mult each, but they may shatter', da:'Start med <b>3 Glas X</b>: <em>X2</em> mult hver, men de kan splintres'}, apply:()=>swapPlain(3,'glass') },
  gilded: { name:{en:'Gilded Set', da:'Forgyldt sæt'}, gl:'$', unlock:4,
    desc:{en:'Start with <u>$8</u> and a <b>Gold X</b>, but two discards fewer each round', da:'Start med <u>$8</u> og et <b>Guld X</b>, men to kasseringer mindre hver runde'},
    apply:()=>{ swapPlain(1,'gold'); S.money = 8; S.maxDiscards = 1; } },
  joker:  { name:{en:'Joker Set', da:'Jokersæt'}, gl:'J', unlock:5,
    desc:{en:'Start with a random <b>Common Joker</b>, but only 4 Joker slots', da:'Start med en tilfældig <b>almindelig Joker</b>, men kun 4 Joker-pladser'},
    apply:()=>{
      const pool = Object.keys(JOKERS).filter(k => JOKERS[k].rar === 1 && !JOKERS[k].req);
      S.jokers.push({ uid: nid(), id: pool[Math.floor(Math.random() * pool.length)], ed: null, data: {} });
      S.jokerSlots = 4;
    } },
  twin:   { name:{en:'Twin Set', da:'Tvillingesæt'}, gl:'2', unlock:6,
    desc:{en:'Start with <b>3 Twin X</b>, which score twice, and a bigger bag: 10 pieces', da:'Start med <b>3 Tvilling X</b>, som scorer to gange, og en større pose: 10 brikker'},
    apply:()=>{ swapPlain(3,'twin'); S.bag.push({ uid: nid(), type: 'plain' }, { uid: nid(), type: 'plain' }); } },
};

/* ---------------- boss blinds ---------------- */
/** @type {Record<string, any>} */
export const BOSSES = {
  wall:   { name:{en:'The Wall', da:'Muren'}, color:'#7a6a55', desc:{en:'A center square is blocked by stone every game', da:'Et midterfelt er blokeret af sten i hvert spil'} },
  crowd:  { name:{en:'The Crowd', da:'Mængden'}, color:'#6b5a8a', desc:{en:'Two random squares start blocked by stone every game', da:'To tilfældige felter starter blokeret af sten i hvert spil'} },
  thief:  { name:{en:'The Thief', da:'Tyven'}, color:'#8a2e4a', desc:{en:'Gold X and Gilded squares pay nothing', da:'Guld X og forgyldte felter giver ingenting'} },
  master: { name:{en:'The Grandmaster', da:'Stormesteren'}, color:'#2b4f8a', desc:{en:'Your rival blocks far more often and never misses a win', da:'Modstanderen blokerer langt oftere og misser aldrig en sejr'} },
  needle: { name:{en:'The Needle', da:'Nålen'}, color:'#4c7a2e', desc:{en:'Only 2 games this round (lower target)', da:'Kun 2 spil i denne runde (lavere mål)'} },
  drought:{ name:{en:'The Drought', da:'Tørken'}, color:'#a0662a', desc:{en:'No discards this round', da:'Ingen kasseringer i denne runde'} },
  echo:   { name:{en:'The Echo', da:'Ekkoet'}, color:'#2e7a78', desc:{en:'Your rival moves first every game', da:'Modstanderen starter i hvert spil'} },
  muzzle: { name:{en:'The Muzzle', da:'Mundkurven'}, color:'#7a3b3b', desc:{en:'Your leftmost Joker does not score this round', da:'Din venstre Joker scorer ikke i denne runde'} },
  clamp:  { name:{en:'The Clamp', da:'Klemmen'}, color:'#55606b', desc:{en:'You hold one piece fewer in your hand this round', da:'Du har én brik mindre på hånden i denne runde'} },
  siege:  { name:{en:'The Siege', da:'Belejringen'}, color:'#8a4a2a', desc:{en:'Your rival starts every game with an O already on the board (two on bigger boards)', da:'Modstanderen starter hvert spil med et O på brættet (to på større bræt)'} },
  toll:   { name:{en:'The Toll', da:'Vejafgiften'}, color:'#8a7a2e', desc:{en:'Every X you place costs $1 (nothing if you are broke)', da:'Hvert X du lægger koster $1 (intet, hvis du er flad)'} },
};

/** Base target per ante; small blind ×1, big ×1.5, boss ×2. */
export const ANTE_BASE = [100, 260, 700, 2000, 5000, 11000, 24000, 50000];
