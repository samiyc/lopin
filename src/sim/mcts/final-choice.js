/**
 * The root's final choice (`ismcts+final=c`, Sami, 15/10). Without it the tree plays its most visited candidate (the
 * "robust child"). With it, the candidate whose win rate stays best once its uncertainty is counted: win rate minus
 * c / √visits — `final=0` is the best win rate (the "max child"), `final=1` about a 95 % lower bound (a win rate's
 * standard deviation is at most ½). Oracle3 found the 1.2 had searched the oracle's move among its 8 candidates and
 * played another one, +2.5 ± 2.4 points short of it (472 gaps): the final choice between close candidates.
 */

/** The root candidate the search plays under `final`, or undefined without it (the most visited is played). */
export function finalChoice(root, rootMoves, final, keyOf) {
  if (final === undefined || final === null || Number.isNaN(final)) return undefined;
  let best;
  let bestValue = -Infinity;
  for (const move of rootMoves) {
    const child = root.children.get(keyOf(move));
    if (!child || child.visits === 0) continue;
    const value = child.wins / child.visits - final / Math.sqrt(child.visits);
    if (value > bestValue) [best, bestValue] = [move, value];
  }
  return best;
}
