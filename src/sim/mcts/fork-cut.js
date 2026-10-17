import { evaluatorFor } from "../engine/border-rules.js";
import { threatsOf, winsWith } from "../eval/fork.js";
import { applyMove, legalMoves } from "../engine/game.js";
import { pickWinner } from "../engine/settle.js";

/**
 * The double threat in the simulations (Sami, 11/10 then 14/10: Connect Four's
 * « fourchette », the Terminal Fork Cutoff of the 1.3 roadmap). A simulation
 * plays under the `final` rule, where no border has an owner before the end:
 * yet a border whose two sides are full already has its winner (`pickWinner`,
 * the rule's own comparison). `forkCut` keeps those owners as borders fill —
 * only then, so it costs one comparison a filled border — and stops early:
 *
 * - level 1, exact: a player holds a victory on the filled borders. The first
 *   victory in filling order is the `final` rule's winner (a test holds the
 *   `early` and `final` rules to the same winner), so the result does not
 *   change; only the moves after it are saved.
 * - level 2, a bet: a player holds two threats or more (undecided borders that
 *   would each win the game, `threatsOf`) while the other holds none. They are
 *   counted the winner: to stop them the other must win every one of those
 *   borders. `trunc`, which also judged a game before its end, lost (41-46 %).
 *
 * Pure; returns the winner (a seat, or null) as `playOut` does.
 */
const isUndecided = (owner) => owner === null || owner === undefined;
const isFull = (border) => border.sides[0].length === 3 && border.sides[1].length === 3;

/** The border's owner if claimed, its winner if both sides are full, else null. */
function ownerNow(game, index) {
  const border = game.borders[index];
  if (!isUndecided(border.owner)) return border.owner;
  if (!isFull(border)) return null;
  const scores = border.sides.map((side, player) => evaluatorFor(game, index, player).score(side));
  return pickWinner(scores, border.completedAt);
}

/** The player holding two threats or more while the other holds none, or null. */
export function forkHolder(owners, spec) {
  const threats = [0, 1].map((player) => threatsOf(owners, player, spec).length);
  if (threats[0] >= 2 && threats[1] === 0) return 0;
  if (threats[1] >= 2 && threats[0] === 0) return 1;
  return null;
}

/** Why the simulation stops once `owners` changed: the winner it counts, or undefined to play on. */
function stopFor(owners, owner, spec, level) {
  if (winsWith(owners.map((other) => other === owner), spec)) return owner;
  if (level < 2) return undefined;
  return forkHolder(owners, spec) ?? undefined;
}

/** The owner `move` just gave its border by filling it, or null (a pass, the game over, the border not full or known). */
function newOwner(game, move, owners) {
  if (move === null || game.over || !isUndecided(owners[move.border])) return null;
  return ownerNow(game, move.border);
}

/** `playOut` (lookahead.js) that stops at a victory on the filled borders, and at level 2 at a double threat. */
export function playOutForkCut(game, policy, level) {
  const guard = game.spec.borders * 6 * 3;
  const owners = game.borders.map((_, index) => ownerNow(game, index));
  while (!game.over && game.turn < guard) {
    const moves = legalMoves(game);
    const move = moves.length > 0 ? policy.choose(game, moves) : null;
    applyMove(game, move);
    const owner = newOwner(game, move, owners);
    if (owner === null) continue;
    owners[move.border] = owner;
    const stop = stopFor(owners, owner, game.spec, level);
    if (stop !== undefined) return stop;
  }
  return game.winner;
}
