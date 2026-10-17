/**
 * Implicit minimax backups (Lanctot, Winands, Pepels and Sturtevant, 2014; Sami, 14/10, from the literature of the
 * day): a node keeps, apart from its rollouts' win rate, an estimate of the game — the core's odds (`winOdds`,
 * bots.js) where the node was first reached, then the minimax of its children's — and the tree's selection blends
 * the two: (1 − α) × win rate + α × estimate (`+implicit=α`, ismcts.js). The rollout is still played to its end:
 * `trunc`, which replaced it by the same odds, lost (41-46 %).
 *
 * `est` is for the player who moved into the node, as its wins are. Players alternate, so a node is worth to its
 * mover 1 − the best of its children to the opponent who moves next. Pure.
 */

/** The new node's estimate (`path`'s last), from `game` where the walk stopped, before the rollout plays it on. */
export function estimateLeaf(path, game, oddsOf) {
  const leaf = path.at(-1);
  if (!leaf || leaf.child.est !== undefined) return;
  if (game.over) {
    leaf.child.est = game.winner === null ? 0.5 : Number(game.winner === leaf.mover);
    return;
  }
  // The odds are for the player to move next.
  const odds = oddsOf(game);
  leaf.child.est = game.current === leaf.mover ? odds : 1 - odds;
}

/** From the leaf's parent up: each node on the path is worth 1 − its children's best estimate. */
export function backUpEstimates(path) {
  for (let i = path.length - 2; i >= 0; i -= 1) {
    let best = -Infinity;
    for (const child of path[i].child.children.values()) if (child.est !== undefined && child.est > best) best = child.est;
    if (best > -Infinity) path[i].child.est = 1 - best;
  }
}

/** The win rate blended with the estimate: (1 − α) × wins / visits + α × est. */
export const blendedRate = (child, alpha) => (1 - alpha) * (child.wins / child.visits) + alpha * child.est;
