/**
 * The first player's compensations under test (docs/sieges.md, Sami 16/10): the second player wins a little more
 * often, and each of these gives the first one something back — information (a look at the top of the pile, in
 * mirror of the move the second player sees before playing) or a card. Each is a variant id read by
 * `src/sim/seat-rules.js`, with the sentence the rules sheet would print. None is on by default: a game without
 * `seat` is the printed game, and the fingerprints do not move.
 *
 * Ids: `peek=k` the first player looks at the k top cards of the pile before playing, `+turns=N` during their N
 * first turns only, `+claim=1` while no border is won, `+inplay=n` while fewer than n cards are on the table;
 * `hands=a/b` the first player is dealt a cards, the second b.
 */
export const SEAT_VARIANTS = Object.freeze({
  Peek1: { id: "peek=1+turns=1", rule: "Avant son tout premier coup, le premier joueur regarde la carte du dessus de la pioche." },
  PeekAll: { id: "peek=1", rule: "Avant chacun de ses coups, le premier joueur regarde la carte du dessus de la pioche." },
  PeekTurns3: { id: "peek=1+turns=3", rule: "Pendant ses 3 premiers tours, le premier joueur regarde la carte du dessus de la pioche avant de jouer." },
  PeekUntilClaim: { id: "peek=1+claim=1", rule: "Tant qu'aucune borne n'est gagnée, le premier joueur regarde la carte du dessus de la pioche avant de jouer." },
  PeekInPlay20: { id: "peek=1+inplay=20", rule: "Tant qu'il y a moins de 20 cartes posées, le premier joueur regarde la carte du dessus de la pioche avant de jouer." },
  Peek2First: { id: "peek=2+turns=1", rule: "Avant son tout premier coup, le premier joueur regarde les deux cartes du dessus de la pioche." },
  Hand7First: { id: "hands=7/6", rule: "Le premier joueur reçoit 7 cartes, le second 6." },
  Hand5Second: { id: "hands=6/5", rule: "Le second joueur reçoit 5 cartes au lieu de 6." },
});
