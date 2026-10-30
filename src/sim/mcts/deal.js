import { isJoker } from "../../core/cards.js";
import { pickHand } from "../search/infer.js";
import { determinize, seeAll } from "../search/lookahead.js";

/**
 * `+jkHand=k` (Sami, 20/10, JokerTheirHand): once the pile holds `k` cards or fewer, the jokers the searching player
 * cannot see are dealt into the opponent's hand, never the pile, until proven otherwise — so neither the tree's nodes
 * nor the rollouts draw one for the searching player. In the kept duels a hidden joker lies in the opponent's hand
 * 95 % of the time with one card in the pile (85.7 % at random), 89 % with two (75 %): bots keep their jokers. Early
 * in a game a joker left in the pile goes to either player alike, hence `k` (`jkHand=40`: always; 0, the default:
 * never). Each joker found in the dealt pile swaps with a random real card of the opponent's hand, from the deal's own
 * `rng`, which draws nothing when no joker lies there.
 */
export function jokersToTheirHand(game, player, rng) {
  const theirs = game.hands[1 - player];
  game.pile.forEach((card, index) => {
    if (!isJoker(card)) return;
    const real = theirs.flatMap((other, at) => (isJoker(other) ? [] : [at]));
    if (real.length === 0) return;
    const at = real[rng.int(real.length)];
    [game.pile[index], theirs[at]] = [theirs[at], card];
  });
  return game;
}

/**
 * `+claimPile=k` (Sami, 30/10, ClaimPile2; docs/priorites-1.3.md § 15): once the pile holds `k` cards or fewer, the
 * iteration plays the game's own rule (`claim-end`) instead of `final`, which `determinize` switches to for speed. Of
 * the « sure » endgames lost to that gap, 83 of 86 had 1-2 cards in the pile, and in 34 of 76 another move won more
 * deals at `claim-end`, mostly the tree's 2nd. 0, the default: never.
 */
const withGameRule = (ctx, game) => (ctx.claimPile > 0 && ctx.state.pile.length <= ctx.claimPile ? Object.assign(game, { endMode: ctx.state.endMode }) : game);

/** An ISMCTS iteration's game (ismcts.js): a deal of the unseen cards, or (`omniscient`, Omniscient 1.0) the true one. */
export function dealFor(ctx, rng = ctx.deals) {
  if (ctx.omniscient) return withGameRule(ctx, seeAll(ctx.state, rng));
  const game = withGameRule(ctx, determinize(ctx.state, ctx.player, rng, { hand: ctx.hands && pickHand(ctx.hands, rng), known: ctx.unseen }));
  return ctx.jkHand > 0 && ctx.state.pile.length <= ctx.jkHand ? jokersToTheirHand(game, ctx.player, rng) : game;
}
