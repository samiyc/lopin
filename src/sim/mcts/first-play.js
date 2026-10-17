/**
 * ReplyFpu (`+fpu=d`, first-play urgency, 17/10, docs/priorites-1.3.md): below the root, a move never tried no
 * longer comes before every tried one (+∞). At 2 000 iterations the 1.2 spends 22 % of them trying a reply for the
 * first time, 173 of its ~444 replies a move are visited once. Here a move never tried scores as if it had one visit
 * worth the mean of the node's tried moves minus d / 10, plus UCB's exploration for that one visit: a node keeps
 * following the replies that already hold up before it opens the rest of its shortlist. With nothing tried yet, the
 * first move in the core's order is taken, as before. The root is left alone: every candidate is tried once.
 */

/** How an untried move of `children` scores: +∞ (off, or nothing tried yet), else the tried mean minus fpu / 10 plus one visit's bonus. */
export function untriedScore(children, fpu, bonus) {
  if (fpu === undefined) return () => Infinity;
  let visits = 0;
  let wins = 0;
  for (const { child } of children) {
    visits += child.visits;
    wins += child.wins;
  }
  if (visits === 0) return () => Infinity;
  const value = wins / visits - fpu / 10;
  return (child, rank) => value + bonus({ avail: child.avail, visits: 1 }, rank);
}
