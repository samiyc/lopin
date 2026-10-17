/**
 * Rollouts cut short (Sami, 03/10). A rollout from turn 1 plays some thirty
 * moves to the end, the core choosing each: most of the tree's time. With
 * `trunc` (`ismcts+trunc=5`), a rollout stops once a border is won after at
 * least `trunc` moves — a new border each time, so a rollout that starts
 * past the first border runs to the next — and the core's odds of winning
 * the game stand for the result. Not once the pile is empty: from there the
 * end is short and exact.
 *
 * Rollouts settle borders at the end (`determinize` plays them at the final
 * rule, claims cost too much), so no border is ever claimed in one: a border
 * counts as won once both its sides hold three cards. Its winner is known
 * then, exactly: the better formation, or on a tie the side filled first
 * (`pickWinner`, settle.js).
 *
 * Shorter rollouts mean more iterations in the same time, so a cut engine is
 * dueled at equal time (`@tMS`).
 */
import { pickWinner } from "../engine/settle.js";

const RUN = 3;

/** Does `won` (a bit per border) hold three adjacent borders? */
function hasRun(won, count) {
  for (let start = 0; start + RUN <= count; start += 1) {
    if (((won >> start) & 0b111) === 0b111) return true;
  }
  return false;
}

function bitCount(bits) {
  let count = 0;
  for (let rest = bits; rest; rest >>= 1) count += rest & 1;
  return count;
}

/** Who takes the game when the borders fall as `won` says: 1, 0, or ½ when both reach a goal. */
function outcome(won, count) {
  const lost = ((1 << count) - 1) & ~won;
  const majority = Math.floor(count / 2) + 1;
  const mine = hasRun(won, count) || bitCount(won) >= majority;
  const theirs = hasRun(lost, count) || bitCount(lost) >= majority;
  if (mine && theirs) return 0.5;
  return mine ? 1 : 0;
}

/**
 * The odds of winning the game from the odds of winning each border (1 or 0
 * for a border already decided), taking the borders as independent: every
 * one of the 2^n ways they can fall, weighed by its odds.
 */
export function gameOdds(borderOdds) {
  const count = borderOdds.length;
  let odds = 0;
  for (let won = 0; won < 1 << count; won += 1) {
    let weight = 1;
    for (let border = 0; border < count && weight > 0; border += 1) weight *= (won >> border) & 1 ? borderOdds[border] : 1 - borderOdds[border];
    if (weight > 0) odds += weight * outcome(won, count);
  }
  return odds;
}

const isFull = (border) => border.sides.every((side) => side.length === 3);

/** Borders decided: claimed, or full on both sides. */
export const decidedCount = (state) => state.borders.filter((border) => border.owner !== null || isFull(border)).length;

/** `player`'s odds on a border: 1 or 0 once it is claimed or full, `estimate` otherwise. */
export function settledOdds(state, player, border, estimate) {
  if (border.owner !== null) return Number(border.owner === player);
  if (!isFull(border)) return estimate;
  return Number(pickWinner(border.sides.map((side) => state.evaluator.score(side)), border.completedAt) === player);
}
