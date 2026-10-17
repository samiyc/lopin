import { gatesOf } from "./ideas.js";

/**
 * The settings a strategist's scoring uses (bots.js): its habits, ideas and
 * weights, with the idea families gated once (`gatesOf`). With `earlyIdeas`,
 * there are two: `early`, those ideas added, while `state.turn < earlyUntil`,
 * and `late` after — a bonus that helps the tree where it is weakest, the
 * first turns, without weighing on the rest (Sami, 03/10). `earlyHabits` does
 * the same for habits; `lateIdeas` / `lateHabits` join from `lateFrom` on, the
 * other end of the game.
 *
 * Returns the settings for a turn: early, late, or the core's own between.
 */
export function tuningsOf({ habits, strategy, ideas, earlyIdeas, earlyHabits, lateIdeas, lateHabits, earlyUntil, lateFrom, weights, params, lite = false, endJoker = false, endUrgency = false }) {
  const tuningFor = (extraHabits, extraIdeas) => {
    const set = new Set([...ideas, ...extraIdeas]);
    return { habits: new Set([...habits, ...extraHabits]), strategy, ideas: set, gates: gatesOf(set), weights, params, lite, endJoker, endUrgency };
  };
  const base = tuningFor([], []);
  const early = earlyIdeas.length + earlyHabits.length > 0 ? tuningFor(earlyHabits, earlyIdeas) : base;
  const late = lateIdeas.length + lateHabits.length > 0 ? tuningFor(lateHabits, lateIdeas) : base;
  return (turn) => {
    if (turn < earlyUntil) return early;
    return turn >= lateFrom ? late : base;
  };
}
