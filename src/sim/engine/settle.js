import { evaluatorFor } from "./border-rules.js";
import { isClaimable } from "../eval/certainty.js";

/**
 * How borders are settled and a game is won, for the four end modes of
 * `game.js`: a border resolved when full (`early`), every full border at the
 * end in the order it filled (`final`), or claimed as soon as it is proved
 * (`claim-end`, or `claim` at the start of the claimer's turn). Every settled
 * border is recorded in `state.resolved`.
 */
export const isFull = (border) => border.sides.every((side) => side.length === 3);

/** The turn a border's second side filled up: the order borders are settled in. */
const filledAt = (border) => Math.max(...border.completedAt);

export function pickWinner(scores, completedAt) {
  if (scores[0] !== scores[1]) return scores[0] > scores[1] ? 0 : 1;
  return completedAt[0] < completedAt[1] ? 0 : 1;
}

/** The formation rank encoded in `score` (`SUM_SPAN = 64`, sum ± 10 in `[-7, 37]`). */
const rankOf = (score) => Math.floor((score + 16) / 64);

function decidedBy(scores) {
  if (scores[0] === scores[1]) return "first";
  return rankOf(scores[0]) === rankOf(scores[1]) ? "sum" : "formation";
}

/** Settles a full border by comparing both sides. */
export function resolveBorder(state, index) {
  const border = state.borders[index];
  // Each side under its border's rules (border-rules.js): the game's evaluator when no figure sits there.
  const scores = border.sides.map((side, player) => evaluatorFor(state, index, player).score(side));
  const formations = border.sides.map((side) => state.evaluator.formation(side));
  const winner = pickWinner(scores, border.completedAt);
  border.owner = winner;
  state.resolved.push({
    border: index,
    winner,
    formations,
    sums: border.sides.map((side) => state.evaluator.sum(side)),
    decidedBy: decidedBy(scores),
    filledAt: filledAt(border),
  });
  return winner;
}

/**
 * Settles a border `player` has proved (`isClaimable`). A full one is
 * compared as usual; on an unfinished one only the claimer has a formation,
 * and the other side is closed where it stands.
 */
function claimBorder(state, index, player) {
  const border = state.borders[index];
  if (isFull(border)) resolveBorder(state, index);
  else {
    border.owner = player;
    const complete = (side, pick) => (side.length === 3 ? pick(side) : null);
    state.resolved.push({
      border: index,
      winner: player,
      formations: border.sides.map((side) => complete(side, (cards) => state.evaluator.formation(cards))),
      sums: border.sides.map((side) => complete(side, (cards) => state.evaluator.sum(cards))),
      decidedBy: "claim",
      filledAt: null,
    });
  }
  state.resolved.at(-1).claimedAt = state.turn;
}

/**
 * The claim modes: every border `player` can prove is claimed, and the game
 * stops at the first victory. `claim-end` calls it after each move, for the
 * mover then the opponent; `claim` at the start of `player`'s turn.
 */
export function claimBorders(state, player) {
  for (let index = 0; index < state.borders.length && !state.over; index += 1) {
    if (!isClaimable(state, index, player)) continue;
    claimBorder(state, index, player);
    checkVictory(state, player);
  }
}

/**
 * The end of a game in `final` or `claim` mode: every full border not yet
 * settled is resolved in the order it filled up; the first victory reached
 * along the way is the game's.
 */
export function resolveFinal(state) {
  const full = state.borders
    .map((border, index) => ({ border, index }))
    .filter(({ border }) => border.owner === null && isFull(border))
    .sort((a, b) => filledAt(a.border) - filledAt(b.border));
  state.finalResolved = true;
  for (const { index } of full) {
    const winner = resolveBorder(state, index);
    if (state.winner === null) checkVictory(state, winner);
  }
  if (state.winner === null) decideByCount(state);
  state.over = true;
  return state;
}

function longestRun(flags) {
  let best = 0;
  let run = 0;
  for (const flag of flags) {
    run = flag ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function finish(state, winner, winType) {
  state.winner = winner;
  state.winType = winType;
  state.over = true;
  return state;
}

export function checkVictory(state, player) {
  const owned = state.borders.map((border) => border.owner === player);
  if (longestRun(owned) >= state.spec.adjacent) return finish(state, player, "adjacent");
  if (owned.filter(Boolean).length >= state.spec.majority) finish(state, player, "majority");
  return state;
}

/** More borders wins, equal is a draw. */
export function decideByCount(state) {
  const count = (player) => state.borders.filter((b) => b.owner === player).length;
  const [zero, one] = [count(0), count(1)];
  if (zero === one) return finish(state, null, "draw");
  return finish(state, zero > one ? 0 : 1, "exhaustion");
}
