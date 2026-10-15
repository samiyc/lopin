/**
 * Progressive widening below the root (Sami, 15/10): a node offers ⌊k + √visits⌋ of the core's replies, up to
 * `widen`, so its first visits go deeper instead of wider. Two ways to name it:
 * - `+pwl=n`, the level, 0 to 4: 0 is none, and the higher the level the more the tree is pushed towards depth.
 *   With `widen=7` the 7 replies open at 16 visits (pwl=1), 25 (2), 31 (3) and 36 (4); at 2 000 iterations the tree
 *   reached its 5th level in 20.0 %, 28.6 % and 55.7 % of the moves with levels 1, 2 and 4 — level 3 sits between,
 *   aimed at about 42.5 %.
 * - `+pw=k`, obsolete, kept so that old engine ids (Oracle3, the duels, the Elo lines, the backlog) keep their moves:
 *   pw=1 is pwl=4, pw=2 is pwl=2, pw=3 is pwl=1.
 * For an integer k, ⌊k + √visits⌋ is the k + ⌊√visits⌋ of before: every fingerprint is unchanged.
 */

/** The k of each level: `PW_LEVELS[n]` for `pwl=n`, 0 for none. */
export const PW_LEVELS = Object.freeze([0, 3, 2, 1.5, 1]);

/** The k of `pwl=n`. Throws on a level off the scale. */
export function widenOffset(level) {
  if (!Number.isInteger(level) || level < 0 || level >= PW_LEVELS.length) throw new Error(`pwl va de 0 (aucun) à ${PW_LEVELS.length - 1} (le plus profond) : « ${level} »`);
  return PW_LEVELS[level];
}

/** The k a tree widens with: `pwl` if given, else the obsolete `pw`; 0 (none) without either. */
export const wideningOf = ({ pw = 0, pwl }) => (pwl === undefined ? pw : widenOffset(pwl));

/** How many of the core's replies a node with `visits` offers: all `widen` without progressive widening. */
export const breadthOf = (visits, widen, offset) => (offset ? Math.min(widen, Math.floor(offset + Math.sqrt(visits))) : widen);
