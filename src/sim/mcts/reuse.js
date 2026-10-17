import { moveKey } from "../search/search.js";

/**
 * `reuse` (TreeReuse, Sami's 1.3 roadmap, 12/10): an ISMCTS bot keeps the
 * tree of its last search; at its next move, the node under its own move and
 * the opponent's reply becomes the new root, with its visits and wins. The
 * search's budget counts only new iterations, so the kept ones are free —
 * what the budget's knee at 2 000 asks for. The root offers the core's new
 * candidates: a kept child whose move is still a candidate keeps its
 * statistics, the others are simply not offered.
 *
 * `remember(state, search)` after each search (returns the search),
 * `played(move)` with the move actually made (returns it; a search the bot
 * did not play from, the replay advisor's, keeps nothing), `rootFor(state)`
 * before the next search: null unless the state is the one two half-moves
 * later.
 */
const sameMove = (a, b) => a === b || Boolean(a && b && a.card === b.card && a.border === b.border);

/** The opponent's reply since `kept`: their last move, or a pass when it has not changed. */
function replyKey(state, kept) {
  const theirs = state.lastMoves?.[1 - state.current] ?? null;
  return sameMove(theirs, kept.theirLast) ? "pass" : moveKey(theirs);
}

export function createReuse() {
  let pending = null;
  let kept = null;
  return {
    remember(state, search) {
      pending = { root: search.tree(), turn: state.turn, theirLast: state.lastMoves?.[1 - state.current] ?? null };
      return search;
    },
    played(move) {
      kept = pending ? { ...pending, mine: moveKey(move) } : null;
      pending = null;
      return move;
    },
    rootFor(state) {
      const from = kept;
      kept = null;
      if (!from || state.turn !== from.turn + 2) return null;
      const node = from.root.children.get(from.mine)?.children.get(replyKey(state, from));
      return node?.visits > 0 ? node : null;
    },
  };
}

/** The bot without reuse: nothing kept, nothing given back. */
export const NO_REUSE = Object.freeze({ remember: (state, search) => search, played: (move) => move, rootFor: () => null });

/** A bot's reuse: a fresh keeper when `on` (the engine's `+reuse=1`), or `NO_REUSE`. */
export const reuseOf = (on) => (on ? createReuse() : NO_REUSE);
