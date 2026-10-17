/**
 * The double threat, Connect Four's « fourchette » (Sami, 11/10): around two
 * borders already won, play for the borders on both ends — winning either
 * makes three adjacent, and the opponent cannot hold both. A threat is an
 * undecided border that would win the game for its player (three adjacent or
 * the majority); a fork border is one whose win would leave two threats or
 * more, or that is a threat itself.
 *
 * Pure and cheap: only the owners of the borders are read, so the core can
 * ask it on every scoring (the `fork` idea, ideas.js), as can the traps
 * (traps.js) and the puzzles (`npm run puzzles -- --fork`).
 */

/** Does owning the borders flagged in `owned` win the game: a run of `spec.adjacent`, or `spec.majority` of them? */
export function winsWith(owned, spec) {
  let run = 0;
  let count = 0;
  for (const flag of owned) {
    run = flag ? run + 1 : 0;
    if (flag) count += 1;
    if (run >= spec.adjacent) return true;
  }
  return count >= spec.majority;
}

const isUndecided = (owner) => owner === null || owner === undefined;

/** The undecided borders whose win alone would give `player` the game, with `extra` (a border index, or -1) counted as theirs. */
export function threatsOf(owners, player, spec, extra = -1) {
  const owned = owners.map((owner, index) => owner === player || index === extra);
  const threats = [];
  for (let index = 0; index < owners.length; index += 1) {
    if (index === extra || !isUndecided(owners[index])) continue;
    owned[index] = true;
    if (winsWith(owned, spec)) threats.push(index);
    owned[index] = false;
  }
  return threats;
}

/**
 * What border `index` is worth to `player` as a step towards a win: 1 when it
 * wins the game at once (a threat), ½ when winning it leaves two threats or
 * more (a fork border), 0 otherwise — and 0 for a decided border.
 */
export function forkValue(owners, player, spec, index) {
  if (!isUndecided(owners[index])) return 0;
  const owned = owners.map((owner, border) => owner === player || border === index);
  if (winsWith(owned, spec)) return 1;
  return threatsOf(owners, player, spec, index).length >= 2 ? 0.5 : 0;
}

/** Is border `index` a fork border for `player`: winning it leaves at least two threats (it does not win at once)? */
export const isForkBorder = (owners, player, spec, index) => forkValue(owners, player, spec, index) === 0.5;

/**
 * The `fork` idea's bonus for a move on border `index`, in value units:
 * `weight` × (my value of the border + ¾ of the opponent's — taking a border
 * they need is worth almost as much as one I need). `forks` is the per-border
 * array `forkValues` gives once per scoring.
 */
export function forkValues(owners, player, spec) {
  return owners.map((_, index) => forkValue(owners, player, spec, index) + 0.75 * forkValue(owners, 1 - player, spec, index));
}

/** The `fork` idea's bonus (ideas.js): the per-border values worked out once per scoring, kept on its context. */
export function forkBonus(context, border) {
  context.forks ??= forkValues(context.owners, context.me, context.spec);
  return (context.weights.fork ?? 0) * context.forks[border];
}
