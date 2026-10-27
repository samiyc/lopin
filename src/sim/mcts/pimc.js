import { solveEndgame } from "../eval/endgame.js";
import { EXACT } from "../eval/exact.js";
import { cloneState, unseenList } from "../search/lookahead.js";
import { moveKey } from "../search/search.js";

/**
 * `+pimc=k` (EndPimc3, Sami's lead of 21/10, docs/priorites-1.3.md § 12-13): with one card left in the pile, the
 * tree's k most visited root candidates are solved exactly on every deal its mover cannot tell apart — the pile card
 * at each place of the unseen cards, the others in the opponent's hand — and the candidate that wins the most deals
 * is played. At 2 000 iterations the tree's misses there are not exploration: the better move is already 2nd or 3rd
 * in visits, with a lower win rate. A perfect-information Monte Carlo (PIMC): the opponent is credited with seeing
 * the cards too. Off by default; no randomness, every deal is played.
 */
export const PIMC = Object.freeze({ nodes: EXACT.nodes });

/** With one card in the pile, one deal per unseen card: that card in the pile, the rest in the opponent's hand. */
export function pileDeals(state, player) {
  const unseen = unseenList(state, player);
  const handsWithout = (k) => state.hands.map((hand, seat) => (seat === player ? [...hand] : [...unseen.slice(0, k), ...unseen.slice(k + 1)]));
  return unseen.map((card, k) => Object.assign(cloneState(state), { pile: [card], hands: handsWithout(k) }));
}

/** Each move's share of `deals` won by the mover with perfect play; null at the first deal past `maxNodes`. */
export function dealShares(deals, moves, maxNodes = PIMC.nodes) {
  const wins = moves.map(() => 0);
  for (const deal of deals) {
    const solution = solveEndgame(deal, { moves, maxNodes });
    if (!solution.complete) return null;
    const won = new Map(solution.moves.map((entry) => [moveKey(entry.move), entry.value > 0 ? 1 : 0]));
    moves.forEach((move, k) => {
      wins[k] += won.get(moveKey(move));
    });
  }
  return wins.map((count) => count / deals.length);
}

/**
 * `rated` (a tree's `scored()`: a root candidate's gain is its visits, the move to play one above the most visited)
 * with the move to play chosen among its `k` best by their share of the deals won; ties go to the most visited.
 * Null — the tree's move stands — unless the pile holds exactly one card, or when a deal runs past `maxNodes`.
 */
export function pimcRated(state, rated, k, { maxNodes = PIMC.nodes } = {}) {
  if (state.pile.length !== 1) return null;
  const top = [...rated].filter((entry) => entry.move && entry.gain >= 0).sort((a, b) => b.gain - a.gain).slice(0, k);
  if (top.length < 2) return null;
  const shares = dealShares(pileDeals(state, state.current), top.map((entry) => entry.move), maxNodes);
  if (!shares) return null;
  const chosen = top[shares.indexOf(Math.max(...shares))].move;
  const most = Math.max(...rated.map((entry) => entry.gain));
  const shareOf = new Map(top.map((entry, i) => [entry.move, shares[i]]));
  const rerated = rated.map((entry) => (shareOf.has(entry.move) ? { ...entry, pimc: shareOf.get(entry.move), gain: entry.move === chosen ? most + 1 : entry.gain } : entry));
  // The tree's shape the replays keep (tree-stats.js) rides on the array.
  if (rated.tree) rerated.tree = rated.tree;
  return rerated;
}

/** `ismctsBot`'s last word on a searched position: the tree's rating, rerated by `pimcRated` when `k` is set and applies. */
export const pimcOf = (k) => (k > 0 ? (state, rated) => pimcRated(state, rated, k) ?? rated : (state, rated) => rated);
