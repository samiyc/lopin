import { createRng } from "../../core/random.js";

/**
 * Common random numbers at the root (`ismcts+crn=1`, CommonDeals, 16/10, docs/priorites-1.3.md). Without it, each
 * iteration of the tree deals the unseen cards afresh: two root candidates are judged on different deals, and the
 * deals' luck goes into their comparison — on a shared deal, two finalists of the 1.2 have results correlated at
 * ρ ≈ 0.44 (flat playouts, 30 positions). With it, the k-th visit of every candidate plays the search's k-th deal,
 * its rollouts drawing their ties from the k-th stream: candidates are compared on the same deals, as the 0.7's
 * search and the Stratège 2 compare theirs (lookahead.js). UCB, the tree below the root, the move played (the most
 * visited, or `final`) and the cost of an iteration are unchanged.
 *
 * A candidate's subtree then depends on its own visits only: its k-th visit sees the same deal and the same stream
 * however UCB interleaves the candidates, so the root is a bandit over results fixed in advance, read further for
 * the candidates UCB prefers.
 */

/** The seed of stream `stream` of a search seeded `seed`: the deals on even streams, their rollouts on odd ones. */
const streamSeed = (seed, stream) => (Math.imul(seed ^ 0x2545f491, 0x85ebca6b) + Math.imul(stream + 1, 0x9e3779b1)) >>> 0;

/** The RNG of a root candidate's `visit`-th deal (0 for its first); the rollouts' RNG is set to that visit's stream. */
export function visitRng(ctx, visit) {
  ctx.rolloutRng.setState(streamSeed(ctx.crnSeed, 2 * visit + 1));
  return createRng(streamSeed(ctx.crnSeed, 2 * visit));
}
