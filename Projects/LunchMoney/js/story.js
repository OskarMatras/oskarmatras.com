// @ts-check
/**
 * The story, as plain data: what the narrator says, who stands where and what the yard is doing.
 *
 * You are the new kid. The voices:
 *   Pip          cheerful, a bit useless, panics out loud, says "Pip pip!" when things go well.
 *   The Sixth-Grader (id 'ollie', who used to be called Ollie)  bored, deadpan, chewing gum; calls you Small Fry;
 *                treats rules as suggestions and cheats in the open because nobody dares to say so. "Rent's due."
 *   The narrator dry and short, like a nature documentary about a playground.
 * Keep every line short: one breath, one joke. A scene is a list of beats; storyui.js plays them one at a time.
 * Nothing here touches the page, so the engine can read it too.
 *
 * A beat is:
 *   w      who speaks: 'narr' (the narrator) or a character id ('pip', 'you', 'ollie' = the Sixth-Grader...)
 *   en/da  the line
 *   L R M  who stands on the left, right and middle: 'id:mood' ('' sends them away, nothing keeps them as they were).
 *          A trailing ! draws them as a dark silhouette. Moods: see MOODS in faces.js
 *   crowd  the kids along the bottom: 'on' | 'off' | 'cheer' | 'boo' | 'gasp' | 'turf' (the eight turf kids)
 *   bg     the backdrop, kept until changed: 'gate' | 'yard' | 'sheds' | 'ambush' | 'tour' | 'finale'
 *   fx     'thud' (the screen jolts) | 'bell'
 *   card   a chapter card shown over the backdrop instead of a line
 */

/** @typedef {{ w: string, en?: string, da?: string, L?: string, R?: string, M?: string, crowd?: string, bg?: string, fx?: string, card?: boolean }} Beat */

/** Who the speaker is called on the name plate (the narrator has none). @type {Record<string, { en: string, da: string }>} */
export const WHO = {
  pip: { en: 'Pip', da: 'Pip' },
  you: { en: 'You', da: 'Dig' },
  ollie: { en: 'The Sixth-Grader', da: 'Sjetteklassen' },
  squint: { en: 'Squint', da: 'Squint' },
};

/** @type {Record<string, Beat[]>} */
export const SCENES = {
  // The first thing a new player sees, before the tutorial game.
  intro: [
    { w: 'narr', card: true, bg: 'gate', en: 'Monday. 8:12 a.m.', da: 'Mandag. 08.12.' },
    { w: 'narr', L: 'you:worry', en: 'New school. New shoes. $4 of lunch money. Mum called it “a fortune”.', da: 'Ny skole. Nye sko. $4 i madpenge. Mor kaldte det “en formue”.' },
    { w: 'narr', bg: 'yard', crowd: 'on', en: 'The yard goes quiet. Kids huddle round chalk grids. Coins change hands. Nobody plays for fun.', da: 'Skolegården går i stå. Børn klumper sig om kridtbrætter. Mønter skifter hænder. Ingen spiller for sjov.' },
    { w: 'narr', en: 'The game has been played here forever. The teachers noticed. The teachers profit.', da: 'Spillet har altid været spillet her. Lærerne opdagede det. Lærerne tjener på det.' },
    { w: 'narr', M: 'ollie:smug!', en: 'By the bike sheds, a big shape watches you. It has already spent your $4.', da: 'Ved cykelskurene betragter en stor skikkelse dig. Den har allerede brugt dine $4.' },
    { w: 'pip', M: '', R: 'pip:happy', L: 'you:shock', en: 'Hi! You’re new! I’m Pip! Don’t worry, everyone makes that face on day one.', da: 'Hej! Du er ny! Jeg er Pip! Bare rolig, alle laver det ansigt den første dag.' },
    { w: 'pip', R: 'pip:grin', en: 'Rule one: everything is a bet. Winner keeps the lunch money. Rule two: don’t lose.', da: 'Regel ét: alt er et væddemål. Vinderen beholder madpengene. Regel to: lad være med at tabe.' },
    { w: 'pip', R: 'pip:happy', en: 'Want to see how it works? I’ll go easy. I’m terrible anyway.', da: 'Vil du se, hvordan det virker? Jeg tager det roligt. Jeg er alligevel elendig.' },
    { w: 'narr', L: 'you:grin', en: 'You nod. Saying no seems rude.', da: 'Du nikker. At sige nej virker uhøfligt.' },
    { w: 'pip', R: 'pip:cheer', en: 'Pip pip! Let’s find a grid!', da: 'Pip pip! Lad os finde et bræt!' },
  ],

  // After your second win: the Sixth-Grader arrives.
  ambush_intro: [
    { w: 'pip', bg: 'yard', crowd: 'on', L: 'you:grin', R: 'pip:cheer', M: '', en: 'Two wins! A Clown, a Red Pen, a proper build! You’re a natural!', da: 'To sejre! En Klovn, en Rødpen, et rigtigt setup! Du er et naturtalent!' },
    { w: 'narr', fx: 'thud', crowd: 'gasp', en: 'THUD.', da: 'BUM.' },
    { w: 'narr', en: 'The yard goes silent. Even the pigeons leave.', da: 'Skolegården bliver stille. Selv duerne letter.' },
    { w: 'pip', R: 'pip:worry', crowd: 'gasp', en: 'Oh no. Don’t look up. Look at your shoes. Shoes are great.', da: 'Åh nej. Se ikke op. Kig på dine sko. Sko er fantastiske.' },
    { w: 'ollie', bg: 'ambush', R: 'ollie:smug', M: 'pip:worry', L: 'you:worry', en: 'Who’s the new kid?', da: 'Hvem er den nye?' },
    { w: 'ollie', R: 'ollie:evil', en: 'The Sixth-Grader. I run this yard. Rent’s due.', da: 'Sjetteklassen. Jeg styrer den her skolegård. Lejen forfalder.' },
    { w: 'pip', M: 'pip:worry', en: 'H-hey! He’s mid-game! You can’t just—', da: 'H-hov! Han er midt i et spil! Du kan ikke bare—' },
    { w: 'ollie', M: '', en: 'Move, Pip.', da: 'Flyt dig, Pip.' },
    { w: 'ollie', R: 'ollie:smug', en: 'A Clown and a red pen. Cute. Let’s play.', da: 'En Klovn og en rød pen. Nuttet. Lad os spille.' },
    { w: 'pip', M: 'pip:worry', en: 'He cheats. Everyone knows. Nobody has ever beaten him.', da: 'Han snyder. Alle ved det. Ingen har nogensinde slået ham.' },
    { w: 'ollie', M: '', R: 'ollie:evil', en: 'Cheat? Rules are suggestions. Sit.', da: 'Snyde? Regler er forslag. Sæt dig.' },
  ],

  // After the Sixth-Grader beats the tutorial build.
  ambush_lose: [
    { w: 'narr', fx: 'thud', bg: 'ambush', R: 'ollie:smug', L: 'you:worry', M: '', crowd: 'boo', en: 'Your Tricks go quiet. Your Red Pens get chewed. Every row you finish is rubbed out. He plays twice. You play once.', da: 'Dine kneb bliver stille. Dine Rødpenne bliver tygget. Hver række, du færdiggør, bliver visket ud. Han spiller to gange. Du spiller én.' },
    { w: 'ollie', R: 'ollie:evil', en: 'Rows. So predictable. And rules? I wrote them. I edit them.', da: 'Rækker. Så forudsigeligt. Og regler? Dem har jeg skrevet. Jeg redigerer dem.' },
    { w: 'narr', en: 'He takes your lunch money. All of it. The crowd laughs, the way crowds do when it isn’t them.', da: 'Han tager dine madpenge. Alle sammen. Mængden griner, sådan som mængder gør, når det ikke er dem.' },
    { w: 'ollie', R: 'ollie:smug', en: 'Come back with something I haven’t seen, Small Fry. Or don’t. I like the rent.', da: 'Kom igen med noget, jeg ikke har set, lille ven. Eller lad være. Jeg kan lide lejen.' },
    { w: 'narr', R: '', crowd: 'on', bg: 'yard', en: 'He strolls off, chewing. The yard remembers how to breathe.', da: 'Han slentrer væk og tygger. Skolegården husker, hvordan man trækker vejret.' },
    { w: 'pip', R: 'pip:worry', L: 'you:worry', en: 'Hey! You okay? That was the Sixth-Grader. Nobody beats him.', da: 'Hej! Er du okay? Det var Sjetteklassen. Ingen slår ham.' },
    { w: 'pip', R: 'pip:grin', en: 'It was rigged, by the way. You only beat him on turf 8, with a build even a cheater can’t shut down.', da: 'Det var i øvrigt rigget. Du slår ham først på revir 8, med et setup, selv en snyder ikke kan lukke ned.' },
    { w: 'pip', R: 'pip:happy', en: 'Come on! I’ll show you the yard. Then we build something he’s never seen!', da: 'Kom nu! Jeg viser dig skolegården. Så bygger vi noget, han aldrig har set!' },
  ],

  // The yard tour: the whole game, explained by Pip.
  tour: [
    { w: 'narr', card: true, bg: 'tour', M: '', R: '', L: '', crowd: 'off', en: 'The Tour', da: 'Rundvisningen' },
    { w: 'pip', R: 'pip:happy', L: 'you:grin', crowd: 'turf', en: 'The yard! Eight turfs, eight kids in charge. Sandbox up to the Principal’s Office.', da: 'Skolegården! Otte revirer, otte børn, der bestemmer. Fra Sandkassen op til Rektors kontor.' },
    { w: 'pip', crowd: 'off', en: 'Each turf has three bets: the Pushover, the Regular, and a Bully who bends a rule.', da: 'Hvert revir har tre væddemål: det nemme bytte, stamkunden og en bølle, der bøjer en regel.' },
    { w: 'pip', R: 'pip:grin', en: 'Score enough Marbles × Swagger in four games to win the pot. Draws pay a little too.', da: 'Score nok kugler × swagger i fire spil for at vinde puljen. Uafgjort giver også lidt.' },
    { w: 'pip', M: 'squint:smug', en: 'Between bets: Squint’s Stall! Tricks, special X’s, chalk, goody bags. Everything fell off a teacher.', da: 'Mellem væddemålene: Squints bod! Kneb, specielle X’er, kridt, goodiebags. Alt er faldet af en lærer.' },
    { w: 'pip', M: '', R: 'pip:happy', en: 'Spare cash goes in the Lunch Lady’s bank for interest. How she pays so much? Nobody knows. Don’t ask.', da: 'Sparede penge kommer i Kantinedamens bank og giver rente. Hvordan hun kan betale så meget? Ingen ved det. Spørg ikke.' },
    { w: 'pip', R: 'pip:grin', en: 'On turf 2 the board grows to 4×4 and lines stop ending the game. Finish two lines with ONE X for a double: each line scores twice as hard!', da: 'På revir 2 vokser brættet til 4×4, og linjer afslutter ikke længere spillet. Afslut to linjer med ÉT X for en dobbelt: hver linje scorer dobbelt så hårdt!' },
    { w: 'pip', R: 'pip:worry', M: 'ollie:smug!', en: 'At the end of turf 8, he’s waiting. He cheats and locks two of your Tricks. Don’t rely on just one thing!', da: 'Til sidst på revir 8 venter han. Han snyder og låser to af dine kneb. Stol ikke kun på én ting!' },
    { w: 'pip', R: 'pip:cheer', M: '', en: 'Beat him and the lunch money’s yours. Ready, new kid? Pip pip!', da: 'Slå ham, og madpengene er dine. Klar, nye ven? Pip pip!' },
  ],

  // Turf 8, before the real boss bout.
  finale_intro: [
    { w: 'narr', bg: 'finale', crowd: 'cheer', L: 'you:worry', R: 'ollie:smug', en: 'Turf 8. The whole school came to watch.', da: 'Revir 8. Hele skolen er kommet for at se på.' },
    { w: 'ollie', en: 'The new kid. Furthest anyone’s ever got. Adorable.', da: 'Den nye. Længst nogen nogensinde er nået. Nuttet.' },
    { w: 'ollie', R: 'ollie:evil', en: 'I know your build. I also don’t follow rules. Perfect combination.', da: 'Jeg kender dit setup. Jeg følger heller ikke regler. Perfekt kombination.' },
    { w: 'pip', M: 'pip:cheer', en: 'Don’t listen to him! You’ve got this! He’s mostly gum!', da: 'Hør ikke på ham! Du kan godt! Han er mest tyggegummi!' },
    { w: 'ollie', M: '', R: 'ollie:smug', en: 'Sit. Lunch is on you.', da: 'Sæt dig. Frokosten er på dig.' },
  ],

  // After the real win.
  finale_win: [
    { w: 'narr', bg: 'finale', crowd: 'gasp', L: 'you:grin', R: 'ollie:smug', en: 'Your last line scores. The yard holds its breath.', da: 'Din sidste linje scorer. Skolegården holder vejret.' },
    { w: 'ollie', R: 'ollie:worry', en: 'No. That doesn’t count. I cheated! I cheated and you STILL…', da: 'Nej. Det tæller ikke. Jeg snød! Jeg snød, og du… alligevel…' },
    { w: 'narr', crowd: 'cheer', M: 'pip:cheer', en: 'The yard erupts. A lunchbox flies into the air. It is never seen again.', da: 'Skolegården bryder ud i jubel. En madkasse flyver op i luften. Den bliver aldrig set igen.' },
    { w: 'pip', M: 'pip:cheer', en: 'YOU DID IT! You actually did it! Pip pip!', da: 'DU GJORDE DET! Du gjorde det faktisk! Pip pip!' },
    { w: 'ollie', R: 'ollie:smug', en: '…Fine. Take it. Lunch money, yard, all of it. Same time tomorrow?', da: '…Fint. Tag den. Madpenge, skolegård, det hele. Samme tid i morgen?' },
    { w: 'narr', en: 'You’re not the new kid any more. But there’s a high school next door…', da: 'Du er ikke den nye længere. Men der er en gymnasieskole lige ved siden af…' },
  ],
};
