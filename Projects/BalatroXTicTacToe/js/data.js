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
import { S } from './state.js';
import { isCenter, isCorner, isEdge, neighbours, runLength, geo } from './geometry.js';

/** @typedef {{en:string, da:string}} Text */
/** @typedef {{chips?:number, mult?:number, xmult?:number, money?:number}} Effect */
/** @typedef {{type:string, cells:number[], chips:number, mult:number, simult:number, forked:boolean}} ScoreCtx */

const countO = () => S.board.filter(c => c && c.t === 'O').length;
const hasJ = (/** @type {string} */ id) => S.jokers.some(j => j.id === id);

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
    desc:()=>({en:'<em>+3</em> Mult for each rival O on the board', da:'<em>+3</em> mult for hvert af modstanderens O på brættet'}),
    line:()=>{ const n=countO(); return n?{mult:3*n}:null; } },
  crowded:  { name:'Packed House', rar:1, cost:5, gl:'▦',
    desc:()=>({en:'<em>+2</em> Mult for each filled square', da:'<em>+2</em> mult for hvert udfyldt felt'}),
    line:()=>({mult:2*S.board.filter(Boolean).length}) },
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
    desc:(/** @type {any} */ j)=>{ const m=(j&&j.data.m)||0; return {en:`Gains <em>+1</em> Mult every time you score (currently <em>+${m}</em>)`, da:`Får <em>+1</em> mult hver gang du scorer (lige nu <em>+${m}</em>)`}; },
    line:(/** @type {ScoreCtx} */ c, /** @type {any} */ j)=>{ j.data.m=(j.data.m||0)+1; return {mult:j.data.m}; },
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
    desc:()=>({en:'Finishing a line no longer ends the game. Keep placing: every new line scores', da:'En færdig linje afslutter ikke længere spillet. Bliv ved med at lægge: hver ny linje scorer'}) },
  combo:    { name:'Combo Meter', rar:3, cost:8, gl:'↑',
    desc:()=>({en:'<em>X1.5</em> Mult for each line already scored this game (multiplies)', da:'<em>X1,5</em> mult for hver linje der allerede er scoret i dette spil (ganges)'}),
    line:()=>S.g.lines?{xmult:+Math.pow(1.5,S.g.lines).toFixed(3)}:null },
  momentum: { name:'Momentum', rar:3, cost:8, gl:'➠︎',
    desc:(/** @type {any} */ j)=>{ const x=(1+((j&&j.data.n)||0)*0.1).toFixed(1); return {en:`Gains <em>X0.1</em> Mult every time you score (currently <em>X${x}</em>)`, da:`Får <em>X0,1</em> mult hver gang du scorer (lige nu <em>X${x.replace('.',',')}</em>)`}; },
    line:(/** @type {ScoreCtx} */ c, /** @type {any} */ j)=>{ j.data.n=(j.data.n||0)+1; return {xmult:+(1+j.data.n*0.1).toFixed(2)}; },
    val:(/** @type {any} */ j)=>'X'+(1+(j.data.n||0)*0.1).toFixed(1) },
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
};
export { hasJ };

/* ---------------- Joker editions ----------------
 * A shop Joker sometimes comes in a special finish. The edition fires
 * once per scored line, after the Joker's own effect, and the card gets
 * the matching animated sheen (see cardfx.js and game.css). */
/** @type {Record<string, any>} */
export const EDITIONS = {
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
};

/* ---------------- items (chalk levels a score type, tools act right away) ---------------- */
/** @type {Record<string, any>} */
export const ITEMS = {
  chalk_row: { name:{en:'Row Chalk', da:'Rækkekridt'}, gl:'═', kind:'chalk', lt:'row' },
  chalk_col: { name:{en:'Column Chalk', da:'Kolonnekridt'}, gl:'║', kind:'chalk', lt:'col' },
  chalk_diag:{ name:{en:'Diagonal Chalk', da:'Diagonalkridt'}, gl:'╲', kind:'chalk', lt:'diag' },
  chalk_draw:{ name:{en:'Draw Chalk', da:'Uafgjort-kridt'}, gl:'=', kind:'chalk', lt:'draw' },
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
  board4:   { name:{en:'Bigger Board', da:'Større bræt'}, gl:'4×4', desc:{en:'The board grows to <b>4×4</b>. Still three in a row, so many more lines', da:'Brættet vokser til <b>4×4</b>. Stadig tre på stribe, så mange flere linjer'}, apply:()=>{ S.N=4; }, req:()=>S.N===3 && S.ante>=2 },
  board5:   { name:{en:'Huge Board', da:'Kæmpebræt'}, gl:'5×5', desc:{en:'The board grows to <b>5×5</b>', da:'Brættet vokser til <b>5×5</b>'}, apply:()=>{ S.N=5; }, req:()=>S.N===4 },
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
};

/** Base target per ante; small blind ×1, big ×1.5, boss ×2. */
export const ANTE_BASE = [100, 300, 800, 2000, 5000, 11000, 24000, 50000];
