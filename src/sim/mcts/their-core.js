import { createRng } from "../../core/random.js";

/**
 * `+theirs=core` (Sami, 20/10, TheirPairJoker): the opponent of the searching player is played by another core, in
 * the tree's shortlists below the root and in the rollouts; the searching player's own moves keep the engine's core.
 * Measured on the end-of-game positions (scripts/archive/misjudged-endgames.js): with both jokers hidden the tree still
 * overrated its mover by 5.5 points under JokerTheirHand, its simulated opponent keeping the jokers it holds. With
 * `theirs=stfig6jwp` that opponent lays a joker on a pair (`jokerPair`) even when it does not win the game, while the
 * searcher, under JokerWin, still keeps its own for a win. Off by default: one policy for both seats.
 */
export function bySeat(mine, theirs, player) {
  if (!theirs) return mine;
  const of = (game) => (game.current === player ? mine : theirs);
  return { ...mine, choose: (game, moves) => of(game).choose(game, moves), scoreMoves: (game, moves, options) => of(game).scoreMoves(game, moves, options) };
}

/** The tree's judge and the rollout policy (its rng drawn from the search's `deals`) of a search from `state`, each seat's own once `theirPolicy` is set. */
export function seatPolicies(state, { treePolicy, policy, theirPolicy }, deals) {
  const rolloutRng = createRng(deals.int(2 ** 31));
  const theirs = (rng) => theirPolicy?.(rng);
  return {
    judge: bySeat((treePolicy ?? policy)(createRng(1)), theirs(createRng(1)), state.current),
    rollout: bySeat(policy(rolloutRng), theirs(rolloutRng), state.current),
    rolloutRng,
  };
}
