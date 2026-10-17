import { moveKey } from "../search/search.js";

/**
 * What the Labo shows of a search's tree (Sami, 17/10): the root's candidates with their visits, win rate and interval,
 * and a pruned copy of the tree small enough to post from a worker and draw. Read only: nothing here touches a node,
 * so a search reads the same with or without it. Pure.
 *
 * A node's `wins` are counted for the player who made the move into it (ismcts.js), so a rate is always the mover's.
 * The root's own `visits` stay at 0 (only the path below it is updated): its visits are its children's sum.
 */
const Z = 1.96;

/** Wilson score interval at 95 % of `wins` points over `visits` (a draw counts ½), [0, 1] with no visit. */
export function interval(wins, visits, z = Z) {
  if (visits === 0) return [0, 1];
  const p = wins / visits;
  const denominator = 1 + (z * z) / visits;
  const centre = p + (z * z) / (2 * visits);
  const spread = z * Math.sqrt((p * (1 - p)) / visits + (z * z) / (4 * visits * visits));
  return [Math.max(0, (centre - spread) / denominator), Math.min(1, (centre + spread) / denominator)];
}

/** A move key (`moveKey`: "12@3", or "pass") as `{ card, border }` with the card's id and the 0-based border, or null for a pass. */
export function keyMove(key) {
  if (key === "pass") return null;
  const [card, border] = key.split("@").map(Number);
  return { card, border };
}

const round = (value, digits = 4) => Number(value.toFixed(digits));

/** The root's visits: its children's sum. */
export const rootVisits = (root) => [...root.children.values()].reduce((sum, child) => sum + child.visits, 0);

/**
 * The root's candidates in the core's order (`candidates`: the search's root moves, `core`: the core's scored entries,
 * for its gain and `refused`): `{ key, move, coreRank, coreGain, refused, visits, wins, rate, low, high, share }`.
 */
export function rootStats(root, candidates, core = []) {
  const total = rootVisits(root);
  return candidates.map((move, index) => {
    const key = moveKey(move);
    const { visits = 0, wins = 0 } = root.children.get(key) ?? {};
    const entry = core.find((scored) => scored.move === move);
    return {
      key,
      move: move && { card: move.card, border: move.border },
      coreRank: index + 1,
      coreGain: entry ? round(entry.gain) : null,
      refused: Boolean(entry?.refused),
      ...measured(wins, visits, total),
    };
  });
}

/** A candidate's numbers: visits, wins, rate (null unvisited), interval, share of `total`. */
function measured(wins, visits, total) {
  const [low, high] = interval(wins, visits);
  return { visits, wins: round(wins, 2), rate: visits > 0 ? round(wins / visits) : null, low: round(low), high: round(high), share: total > 0 ? round(visits / total) : 0 };
}

const sumOf = (entries, field) => entries.reduce((sum, entry) => sum + entry[field], 0);
const NOT_THERE = Object.freeze({ visits: 0, wins: 0 });

/** Root stats of several trees (an ensemble's, or the workers' parts) added up, candidate by candidate. */
export function addRootStats(parts) {
  const [first, ...rest] = parts;
  if (rest.length === 0) return first;
  const total = parts.reduce((sum, part) => sum + sumOf(part, "visits"), 0);
  const byKey = parts.map((part) => new Map(part.map((entry) => [entry.key, entry])));
  return first.map((entry) => {
    const same = byKey.map((part) => part.get(entry.key) ?? NOT_THERE);
    return { ...entry, ...measured(sumOf(same, "wins"), sumOf(same, "visits"), total) };
  });
}

export const SNAPSHOT = Object.freeze({ maxNodes: 1500, minVisits: 2, perNode: 7, maxDepth: 12 });

/** A node's copy, without its children yet. */
function copyOf(key, node, depth, mover) {
  return { key, visits: node.visits, wins: round(node.wins, 2), avail: node.avail, depth, mover, children: [] };
}

/**
 * A pruned copy of the tree, built level by level so that the shallow plies are kept first: below the root a node keeps
 * its `perNode` most visited children with at least `minVisits` visits (the root keeps all its candidates), until
 * `maxNodes` copies; what it leaves out is summed in `hidden: { count, visits, wins }`. The root's player
 * (`rootPlayer`) makes the moves of depth 1, then the players alternate (a pass hands the turn over too).
 */
export function snapshotTree(root, { rootPlayer = 0, ...options } = {}) {
  const settings = { ...SNAPSHOT, ...options };
  const top = { key: "root", visits: rootVisits(root), wins: 0, avail: 0, depth: 0, mover: 1 - rootPlayer, children: [] };
  let count = 1;
  let layer = [{ copy: top, node: root }];
  while (layer.length > 0) {
    const next = [];
    for (const { copy, node } of layer) {
      const shown = copyChildren(copy, node, settings, settings.maxNodes - count);
      count += shown.length;
      next.push(...shown);
    }
    layer = next;
  }
  top.size = count;
  return top;
}

/**
 * Copies into `copy` the children of `node` it keeps (at most `room` below the root), sums the others in
 * `copy.hidden`, and returns the pairs to visit next.
 */
function copyChildren(copy, node, { minVisits, perNode, maxDepth }, room) {
  const children = [...node.children.entries()].sort((a, b) => b[1].visits - a[1].visits);
  const depth = copy.depth + 1;
  const atRoot = copy.depth === 0;
  const kept = depth > maxDepth ? [] : children.filter(([, child], index) => atRoot || (index < perNode && child.visits >= minVisits));
  const shown = atRoot ? kept : kept.slice(0, Math.max(0, room));
  const pairs = shown.map(([key, child]) => ({ copy: copyOf(key, child, depth, 1 - copy.mover), node: child }));
  copy.children.push(...pairs.map((pair) => pair.copy));
  const shownKeys = new Set(shown.map(([key]) => key));
  const left = children.filter(([key]) => !shownKeys.has(key)).map(([, child]) => child);
  if (left.length > 0) copy.hidden = { count: left.length, ones: left.filter((child) => child.visits === 1).length, visits: sumOf(left, "visits"), wins: round(sumOf(left, "wins"), 2) };
  return pairs;
}
