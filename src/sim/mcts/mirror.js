/**
 * Mirror moves (Sami, 18/10, `+mirror=1`): the seven borders read the same from either end — three adjacent borders,
 * the majority, the completion order do not care — so while no card lies off the middle border, playing a card on
 * border b or on border 8 − b leads to mirror games of equal value. The tree then keeps borders 1 to 4 only, at the
 * root (its 8 candidates go to other cards) and in every shortlist (the replies too). Exact, never a guess: the first
 * card off the middle breaks the symmetry for the rest of the game.
 */

/** Does nothing lie on the borders off the middle one (no card, no owner): is the board its own mirror? */
export function isMirrored(state) {
  const middle = (state.borders.length - 1) / 2;
  return state.borders.every((border, index) => index === middle || (border.owner === null && border.sides[0].length === 0 && border.sides[1].length === 0));
}

/** `scored` (or bare moves, `moveOf` reading each one's move) without the moves past the middle when the board is mirrored. */
export function withoutMirrors(state, entries, moveOf = (entry) => entry.move) {
  if (!isMirrored(state)) return entries;
  const middle = (state.borders.length - 1) / 2;
  return entries.filter((entry) => {
    const move = moveOf(entry);
    return !move || move.border <= middle;
  });
}
