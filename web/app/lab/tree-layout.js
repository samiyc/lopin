/**
 * Where each node of a tree snapshot is drawn (the Labo, Sami 17/10), PURE: top-down, one band per ply, the leaves side
 * by side and each parent centred over its children. A node's radius grows with √visits, a link's width with its
 * visits; what a node left out (`hidden`) is drawn as a small « +n » node. Sami, 18/10, so that the tree stays narrow
 * and reaches ply 5:
 * - ply k draws each node's `shown[k - 1]` most visited children (3 for ply 1, the candidates, 2 for plies 2-5), the others join
 *   its « +n » node; that node's id in `expanded` (a double click on it) draws them all;
 * - ply k is drawn only under the root's `reach[k - 1]` most visited candidates (ply 4 under the best two, ply 5
 *   under the best one), and nothing past ply `open`;
 * a node folded so, unless its id is in `expanded`, keeps the number of children it hides (`folded`).
 *
 * The ply names are written at the left (tree-view.js): the nodes start `gutter` to their right (Sami, 18/10: the first
 * nodes sat under « Pli 2 · réponses de l'adversaire »).
 *
 * A node's id is its path of move keys from the root, joined by « / » (the root's is "").
 */
export const LAYOUT = Object.freeze({ open: 5, shown: [3, 2, 2, 2, 2], reach: [8, 8, 8, 2, 1], gutter: 230, slot: 34, band: 92, top: 40, rMin: 4, rMax: 26, wMin: 1, wMax: 14 });

const childId = (parent, key) => (parent === "" ? key : `${parent}/${key}`);

/** The snapshot's own `hidden` plus the children not drawn: `{ count, visits, wins }`, or null when nothing is left out. */
function leftOut(hidden, dropped) {
  const { count = 0, visits = 0, wins = 0 } = hidden ?? {};
  const left = { count, visits, wins };
  for (const child of dropped) Object.assign(left, { count: left.count + 1, visits: left.visits + child.visits, wins: left.wins + child.wins });
  return left.count > 0 ? left : null;
}

/** Is a node of `depth` on the branch of the root's candidate ranked `branch` folded (see the head of the file)? */
const foldedAt = (depth, branch, { open, reach }) => depth >= open || branch >= (reach[depth] ?? 0);

/** The children drawn under a snapshot node (none when folded, its most visited unless widened) and what is left out. */
function visibleChildren(node, { id, depth, branch }, { expanded, shown, ...limits }) {
  if (foldedAt(depth, branch, limits) && !expanded.has(id)) return { children: [], left: null };
  const ranked = [...node.children].sort((a, b) => b.visits - a.visits);
  const cut = expanded.has(childId(id, "+")) ? ranked.length : (shown[depth] ?? shown.at(-1));
  return { children: ranked.slice(0, cut), left: leftOut(node.hidden, ranked.slice(cut)) };
}

/** The « +n » node standing for what `node` left out, at `x`. */
const ghostOf = (node, left, { id, depth, x }) => ({ id: childId(id, "+"), key: "+", depth: depth + 1, mover: 1 - node.mover, visits: left.visits, wins: left.wins, hidden: left.count, x, folded: 0 });

/** Places the visible nodes depth first: each leaf takes the next slot, each parent the middle of its children. */
function placeAll(snapshot, { slot, ...limits }) {
  const drawing = { nodes: [], links: [], slots: 0 };
  // `branch`: the rank of the root's candidate a node hangs from (the root's children: their own rank).
  const place = (node, id, depth, branch) => {
    const { children, left } = visibleChildren(node, { id, depth, branch }, limits);
    const placed = children.map((child, rank) => place(child, childId(id, child.key), depth + 1, depth === 0 ? rank : branch));
    if (left && children.length > 0) {
      const ghost = ghostOf(node, left, { id, depth, x: drawing.slots++ * slot });
      drawing.nodes.push(ghost);
      placed.push(ghost);
    }
    const x = placed.length > 0 ? (placed[0].x + placed[placed.length - 1].x) / 2 : drawing.slots++ * slot;
    const own = { id, key: node.key, depth, mover: node.mover, visits: node.visits, wins: node.wins, avail: node.avail, x, folded: children.length === 0 ? node.children.length : 0, hidden: 0 };
    drawing.nodes.push(own);
    for (const child of placed) drawing.links.push({ from: id, to: child.id, visits: child.visits });
    return own;
  };
  place(snapshot, "", 0, 0);
  return drawing;
}

/**
 * The drawing of `snapshot`: `{ nodes, links, bands, width, height }`. Each node: `{ id, key, depth, mover, visits,
 * wins, rate, avail, x, y, r, folded, hidden }` (`hidden`: the « +n » node of what a parent left out).
 */
export function layoutTree(snapshot, { expanded = new Set(), ...sizes } = {}) {
  const { gutter, slot, band, top, rMin, rMax, wMin, wMax, open, shown, reach } = { ...LAYOUT, ...sizes };
  const total = Math.max(1, snapshot.visits);
  const { nodes, links, slots } = placeAll(snapshot, { open, expanded, slot, shown, reach });
  let deepest = 0;
  for (const node of nodes) {
    deepest = Math.max(deepest, node.depth);
    node.x += gutter + slot;
    node.y = top + node.depth * band;
    node.r = node.depth === 0 ? rMax : rMin + (rMax - rMin) * Math.sqrt(node.visits / total);
    node.rate = node.depth > 0 && node.visits > 0 ? node.wins / node.visits : null;
  }
  const widths = links.map(({ from, to, visits }) => ({ from, to, width: wMin + (wMax - wMin) * (visits / total) }));
  const bands = Array.from({ length: deepest + 1 }, (_, depth) => ({ depth, y: top + depth * band }));
  return { nodes, links: widths, bands, width: gutter + (slots + 1) * slot, height: top + deepest * band + top };
}

/** The snapshot's nodes from the root to `id`, root excluded: the line of play a node stands for. */
export function pathTo(snapshot, id) {
  if (id === "") return [];
  const path = [];
  let node = snapshot;
  for (const key of id.split("/")) {
    node = node?.children.find((child) => child.key === key);
    if (!node) break;
    path.push(node);
  }
  return path;
}

/** The snapshot node of `id`, or null. */
export const nodeAt = (snapshot, id) => (id === "" ? snapshot : (pathTo(snapshot, id).at(-1) ?? null));

/** A rate's hue for the colour scale, red (0) at a rate of 0.3 or less to green (120) at 0.7 or more; grey (null) without a rate. */
export function rateHue(rate) {
  if (rate === null || rate === undefined) return null;
  return Math.round(120 * Math.min(1, Math.max(0, (rate - 0.3) / 0.4)));
}

/** What a ply's band is called, from the root player's point of view. */
export function bandLabel(depth) {
  if (depth === 0) return "Position";
  if (depth === 1) return "Pli 1 · ses candidats";
  return depth % 2 === 0 ? `Pli ${depth} · réponses de l'adversaire` : `Pli ${depth} · ses réponses`;
}

/** A level's visits spread (the nodes of one depth in the snapshot), for the band's detail: counts by bucket. */
export function visitBuckets(snapshot, depth, edges = [1, 2, 5, 10, 50, 100, 500]) {
  const counts = Array.from({ length: edges.length + 1 }, () => 0);
  let layer = [snapshot];
  for (let d = 0; d < depth; d += 1) layer = layer.flatMap((node) => node.children);
  for (const node of layer) {
    const index = edges.findIndex((edge) => node.visits < edge);
    counts[index === -1 ? edges.length : index] += 1;
  }
  return edges.map((edge, index) => ({ below: edge, count: counts[index] })).concat([{ below: Infinity, count: counts[edges.length] }]);
}
