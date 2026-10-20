// @ts-check
/**
 * The story, as plain data: what the narrator says, who stands where and what the yard is doing.
 *
 * You are the new kid. Pip, a kind kid, shows you round and teaches you the game; the Sixth-Grader (who
 * used to be called Ollie) runs the yard, takes your lunch money and cheats, openly, because nobody dares to say so. A scene is a list of beats; the player
 * in storyui.js shows them one at a time. Nothing here touches the page, so the engine can read it too.
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
    { w: 'narr', L: 'you:worry', en: 'New school. New shoes. One envelope of lunch money: exactly $4, which Mum called “a fortune”.', da: 'Ny skole. Nye sko. En kuvert med madpenge: præcis $4, som mor kaldte “en formue”.' },
    { w: 'narr', bg: 'yard', crowd: 'on', en: 'You walk through the gate. The yard goes quiet. A bell rings, and nobody moves.', da: 'Du går gennem lågen. Skolegården bliver stille. En klokke ringer, og ingen rører sig.' },
    { w: 'narr', en: 'Chalk grids on the asphalt. Kids huddled round every one. Coins changing hands. Nobody here plays for fun.', da: 'Kridtbrætter på asfalten. Børn i klynger omkring hvert eneste. Mønter, der skifter hænder. Ingen spiller for sjov her.' },
    { w: 'narr', M: 'ollie:smug!', en: 'Over by the bike sheds, a big shape watches you. You get the feeling it has already spent your $4.', da: 'Henne ved cykelskurene betragter en stor skikkelse dig. Du får på fornemmelsen, at den allerede har brugt dine $4.' },
    { w: 'pip', M: '', R: 'pip:happy', L: 'you:shock', en: 'Hey! You’re new! I’m Pip. Don’t worry, everybody looks like that on their first day.', da: 'Hej! Du er ny! Jeg hedder Pip. Bare rolig, alle ser sådan ud på deres første dag.' },
    { w: 'pip', R: 'pip:grin', en: 'Rule one: nobody plays for fun. Every game is a bet, and the winner keeps the lunch money.', da: 'Regel nummer ét: ingen spiller for sjov. Hvert spil er et væddemål, og vinderen beholder madpengene.' },
    { w: 'pip', R: 'pip:happy', en: 'Rule two: you don’t get to eat until you’ve won something. So… want me to show you how it works?', da: 'Regel nummer to: du får ikke mad, før du har vundet noget. Så… skal jeg vise dig, hvordan det fungerer?' },
    { w: 'narr', L: 'you:grin', en: 'You nod. It seems rude not to.', da: 'Du nikker. Det ville være uhøfligt ikke at gøre det.' },
    { w: 'pip', R: 'pip:cheer', en: 'Brilliant! One friendly game. I’ll go easy on you, promise. Let’s find a grid!', da: 'Fedt! Ét venligt spil. Jeg tager det helt roligt, det lover jeg. Lad os finde et bræt!' },
  ],

  // After your second win: the Sixth-Grader arrives.
  ambush_intro: [
    { w: 'pip', bg: 'yard', crowd: 'on', L: 'you:grin', R: 'pip:cheer', M: '', en: 'Two bets, two wins! Your Class Clown and Red Pens make a lovely row. You’re a natural!', da: 'To væddemål, to sejre! Din Klassens klovn og dine Rødpenne danner en dejlig række. Du er et naturtalent!' },
    { w: 'narr', fx: 'thud', crowd: 'gasp', en: 'THUD.', da: 'BUM.' },
    { w: 'narr', en: 'The whole yard goes silent. Even the pigeons leave.', da: 'Hele skolegården bliver stille. Selv duerne letter.' },
    { w: 'pip', R: 'pip:worry', crowd: 'gasp', en: 'Oh no. Oh no no no. Don’t look up. Look at your shoes.', da: 'Åh nej. Åh nej nej nej. Se ikke op. Kig på dine sko.' },
    { w: 'ollie', bg: 'ambush', R: 'ollie:smug', M: 'pip:worry', L: 'you:worry', en: 'Who’s the new kid?', da: 'Hvem er den nye knægt?' },
    { w: 'ollie', R: 'ollie:evil', en: 'They call me the Sixth-Grader. I run this yard. Everyone pays rent. Lunch money, every single day.', da: 'De kalder mig Sjetteklassen. Jeg styrer den her skolegård. Alle betaler leje. Madpenge, hver eneste dag.' },
    { w: 'pip', M: 'pip:worry', en: 'H-hey! He’s in the middle of a game, you can’t just—', da: 'H-hov! Han er midt i et spil, du kan ikke bare—' },
    { w: 'ollie', M: '', en: 'Move, Pip.', da: 'Flyt dig, Pip.' },
    { w: 'ollie', R: 'ollie:smug', en: 'Let’s see your tricks, small fry. A Class Clown. A red pen. A cute little row-builder.', da: 'Lad os se dine kneb, lille ven. En Klassens klovn. En rød pen. En sød lille rækkebygger.' },
    { w: 'pip', M: 'pip:worry', en: 'Careful. He cheats. Everybody knows. Nobody says anything. Nobody has ever won a game against him.', da: 'Pas på. Han snyder. Det ved alle. Ingen siger noget. Ingen har nogensinde vundet et spil mod ham.' },
    { w: 'ollie', M: '', R: 'ollie:evil', en: 'Cheat? Rules are for people who lose. I stand in the middle, I play when I like, and if you get a row… it doesn’t count. Sit down.', da: 'Snyde? Regler er for dem, der taber. Jeg står i midten, jeg spiller, når jeg har lyst, og får du en række… så tæller den ikke. Sæt dig ned.' },
  ],

  // After the Sixth-Grader beats the tutorial build.
  ambush_lose: [
    { w: 'narr', fx: 'thud', bg: 'ambush', R: 'ollie:smug', L: 'you:worry', M: '', crowd: 'boo', en: 'Your Class Clown goes quiet. Your Red Pens are chewed up and spat out. Every time you finish a row, a hand rubs one of your Xs out. Two moves for him. One for you.', da: 'Din Klassens klovn bliver stille. Dine Rødpenne bliver tygget og spyttet ud. Hver gang du er færdig med en række, visker en hånd et af dine X ud. To træk til ham. Ét til dig.' },
    { w: 'ollie', R: 'ollie:evil', en: 'Rows. Everybody builds rows. Easy to see coming. Easy to rub out. And rules? I wrote them. I can change them.', da: 'Rækker. Alle bygger rækker. Nemme at se komme. Nemme at viske ud. Og regler? Dem har jeg skrevet. Jeg kan ændre dem.' },
    { w: 'narr', en: 'He takes your lunch money. All of it. The crowd laughs, the way crowds do when it isn’t them.', da: 'Han tager dine madpenge. Alle sammen. Mængden griner, sådan som mængder gør, når det ikke er dem.' },
    { w: 'ollie', R: 'ollie:smug', en: 'Come back when you’ve got something I haven’t seen, new kid. Or don’t. I like the rent.', da: 'Kom igen, når du har noget, jeg ikke har set før, nyt barn. Eller lad være. Jeg kan godt lide lejen.' },
    { w: 'narr', R: '', crowd: 'on', bg: 'yard', en: 'He strolls off. The yard slowly remembers how to breathe.', da: 'Han slentrer væk. Skolegården husker langsomt, hvordan man trækker vejret.' },
    { w: 'pip', R: 'pip:worry', L: 'you:worry', en: 'Hey. Hey, are you okay? That was the Sixth-Grader. Nobody beats him.', da: 'Hej. Hej, er du okay? Det var Sjetteklassen. Ingen slår ham.' },
    { w: 'pip', R: 'pip:grin', en: 'But here’s the thing: nobody wins that bout. It’s rigged. You only beat him on his last turf, and only with a build that even a cheater can’t shut down.', da: 'Men se, her er sagen: ingen vinder det væddemål. Det er rigget. Du slår ham først på hans sidste revir, og kun med et setup, selv en snyder ikke kan lukke ned.' },
    { w: 'pip', R: 'pip:happy', en: 'Come on. I’ll show you the whole yard. Every bit of it. Then we’ll build something he can’t counter.', da: 'Kom nu. Jeg viser dig hele skolegården. Hver en krog. Så bygger vi noget, han ikke kan modvirke.' },
  ],

  // The yard tour: the whole game, explained by Pip.
  tour: [
    { w: 'narr', card: true, bg: 'tour', M: '', R: '', L: '', crowd: 'off', en: 'The Tour', da: 'Rundvisningen' },
    { w: 'pip', R: 'pip:happy', L: 'you:grin', crowd: 'turf', en: 'This is the yard. Eight turfs, eight kids who run them: from the Sandbox all the way up to the Principal’s Office.', da: 'Det her er skolegården. Otte revirer, otte børn, der styrer dem: fra Sandkassen hele vejen op til Rektors kontor.' },
    { w: 'pip', crowd: 'off', en: 'Every turf has three bets: the Pushover, the Regular, and a Bully who bends one rule. Beat all three to move up.', da: 'Hvert revir har tre væddemål: det nemme bytte, stamkunden og en bølle, der bøjer en regel. Slå dem alle tre for at rykke op.' },
    { w: 'pip', R: 'pip:grin', en: 'A bet has a target. Score enough Marbles × Swagger in your four games and the pot is yours. Draws pay a little too.', da: 'Et væddemål har et mål. Score nok kugler × swagger i dine fire spil, og puljen er din. Uafgjort giver også lidt.' },
    { w: 'pip', M: 'squint:smug', en: 'Between bets, you visit Squint’s Stall. Tricks that bend the rules, special X pieces, chalk that levels up your lines, goody bags and hall passes.', da: 'Mellem væddemålene besøger du Squints bod. Kneb, der bøjer reglerne, specielle X-brikker, kridt der hæver dine linjer, goodiebags og gangpas.' },
    { w: 'pip', M: '', R: 'pip:happy', en: 'Spend smart: spare money earns interest. On turf 4 the board grows to 4×4, and a line no longer ends the game. Score again and again.', da: 'Brug dem klogt: sparede penge giver rente. På revir 4 vokser brættet til 4×4, og en linje afslutter ikke længere spillet. Score igen og igen.' },
    { w: 'pip', R: 'pip:worry', M: 'ollie:smug!', en: 'And at the end of turf 8, he’s waiting. The Sixth-Grader. He cheats, he locks away your two leftmost Tricks, and he goes first. So don’t lean on just one thing.', da: 'Og til sidst på revir 8 venter han. Sjetteklassen. Han snyder, han låser dine to venstre kneb inde, og han starter. Så lad være med kun at læne dig op ad én ting.' },
    { w: 'pip', R: 'pip:cheer', M: '', en: 'Beat him and your lunch money is yours again. All of it. And the whole yard. I’ll be in your corner. Ready, new kid?', da: 'Slå ham, og dine madpenge er dine igen. Alle sammen. Og hele skolegården. Jeg står i dit hjørne. Klar, nye ven?' },
  ],

  // Turf 8, before the real boss bout.
  finale_intro: [
    { w: 'narr', bg: 'finale', crowd: 'cheer', L: 'you:worry', R: 'ollie:smug', en: 'Turf 8. The whole school has come to watch.', da: 'Revir 8. Hele skolen er kommet for at se på.' },
    { w: 'ollie', en: 'Well, well. The new kid. You’ve got further than anyone.', da: 'Nå, nå. Den nye knægt. Du er kommet længere end nogen anden.' },
    { w: 'ollie', R: 'ollie:evil', en: 'But I’ve been watching. I know what you’re made of. And I know the best thing about rules: I don’t follow them.', da: 'Men jeg har holdt øje. Jeg ved, hvad du er lavet af. Og jeg ved, hvad der er det bedste ved regler: jeg følger dem ikke.' },
    { w: 'pip', M: 'pip:cheer', en: 'Don’t let him get in your head! You’ve got this!', da: 'Lad ham ikke komme ind i dit hoved! Du kan godt!' },
    { w: 'ollie', M: '', R: 'ollie:smug', en: 'Sit down. Lunch is on you.', da: 'Sæt dig ned. Frokosten er på dig.' },
  ],

  // After the real win.
  finale_win: [
    { w: 'narr', bg: 'finale', crowd: 'gasp', L: 'you:grin', R: 'ollie:smug', en: 'Your last line scores. The yard holds its breath.', da: 'Din sidste linje scorer. Skolegården holder vejret.' },
    { w: 'ollie', R: 'ollie:worry', en: 'No. No, that doesn’t count. I cheated! I cheated and you STILL… How did you…', da: 'Nej. Nej, det tæller ikke. Jeg snød! Jeg snød, og du… alligevel… Hvordan gjorde du…' },
    { w: 'narr', crowd: 'cheer', M: 'pip:cheer', en: 'The yard erupts. Somebody throws a lunchbox in the air. It is never seen again.', da: 'Skolegården bryder ud i jubel. Nogen kaster en madkasse op i luften. Den bliver aldrig set igen.' },
    { w: 'pip', M: 'pip:cheer', en: 'YOU DID IT! You actually did it!', da: 'DU GJORDE DET! Du gjorde det faktisk!' },
    { w: 'ollie', R: 'ollie:smug', en: '…Fine. Take it. Your lunch money, and the yard. Same time tomorrow?', da: '…Fint. Tag den. Dine madpenge og skolegården. Samme tid i morgen?' },
    { w: 'narr', en: 'You’re not the new kid any more. The yard is yours. But there’s a high school next door…', da: 'Du er ikke den nye længere. Skolegården er din. Men der er en gymnasieskole lige ved siden af…' },
  ],
};
