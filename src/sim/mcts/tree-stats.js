/**
 * What a search's tree looks like, level by level (Sami, 14/10): is depth 5 to 10 ever reached, how many nodes stay
 * at 0 or 1 visit, how far the most visited goes — the numbers that choose a progressive widening formula (1 + √n,
 * 2 + √n…). Written into a bot's move in the replays (log.js), a few numbers a level. Pure.
 *
 * Level 1 holds the root's candidates, level 2 the replies under them, and so on; `nodes` counts every node created
 * there (a move offered by a parent's shortlist, even if never tried), `zero` and `one` those with 0 and 1 visit,
 * `max` the most visits of any.
 */
export function treeStats(root) {
  const levels = [];
  let layer = [...root.children.values()];
  while (layer.length > 0) {
    levels.push(levelOf(layer, levels.length + 1));
    layer = layer.flatMap((node) => [...node.children.values()]);
  }
  return levels;
}

/** One level's counts. */
function levelOf(layer, depth) {
  const level = { depth, nodes: layer.length, zero: 0, one: 0, max: 0 };
  for (const { visits } of layer) {
    if (visits === 0) level.zero += 1;
    if (visits === 1) level.one += 1;
    level.max = Math.max(level.max, visits);
  }
  return level;
}

/** `scored` with the search's tree statistics attached (`scored.tree`), when the search kept a tree: the replays read it. */
export function withTreeStats(scored, search) {
  if (!search.tree) return scored;
  scored.tree = { iterations: search.rollouts(), levels: treeStats(search.tree()) };
  return scored;
}
