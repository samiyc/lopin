/**
 * Where the replay player stands, and how its buttons move it. Pure, so it
 * is tested under Node.
 *
 * A position is `{ index, shown }`: `index` is the frame (0 = the deal, `last`
 * = after the last move), `shown` how many borders are settled — only ever
 * above 0 on the last frame, where the end of a game reveals them one by one.
 * `settled` is how many borders the game resolved.
 */
export const START = Object.freeze({ index: 0, shown: 0 });

export const endOf = (last, settled) => ({ index: last, shown: settled });

export const isAtEnd = ({ index, shown }, last, settled) => index === last && shown >= settled;

/** One move forward; past the last move, one more border settled. */
export function stepForward(position, last, settled) {
  if (position.index < last) return { index: position.index + 1, shown: 0 };
  return { index: last, shown: Math.min(position.shown + 1, settled) };
}

/**
 * One move back. From the settled end it goes straight to the move before:
 * un-settling the borders on the same frame looked like a step that did
 * nothing.
 */
export function stepBack(position) {
  return { index: Math.max(0, position.index - 1), shown: 0 };
}
