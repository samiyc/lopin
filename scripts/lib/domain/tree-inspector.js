import { parseCard } from "../../../src/core/notation.js";

function getCardId(move, spec) {
  if (!move) return null;
  if (typeof move.card === "number") return move.card;
  return parseCard(spec, move.card);
}

function collectCandidates(root) {
  const candidates = [];
  for (const [key, child] of root.children.entries()) {
    candidates.push({
      key,
      visits: child.visits,
      wins: child.wins,
      winRate: child.visits > 0 ? child.wins / child.visits : 0,
      childrenCount: child.children.size,
    });
  }
  return candidates.sort((a, b) => b.visits - a.visits);
}

function updateLevel1Stats(node, stats) {
  for (const child of node.children.values()) {
    stats.l1Total += 1;
    stats.l1ChildrenVisits.push(child.visits);
    if (child.visits === 1) stats.l1Singletons += 1;
  }
}

function traverseTree(node, depth, stats) {
  stats.totalNodes += 1;
  if (depth > stats.maxDepth) stats.maxDepth = depth;
  stats.depthCounts[depth] = (stats.depthCounts[depth] || 0) + 1;
  stats.depthVisits[depth] = (stats.depthVisits[depth] || 0) + node.visits;

  if (depth > 0) {
    stats.nodesWithVisits += 1;
    if (node.visits === 1) stats.singletonsTotal += 1;
  }
  if (depth === 1) updateLevel1Stats(node, stats);

  for (const child of node.children.values()) {
    traverseTree(child, depth + 1, stats);
  }
}

function summarizeStats(stats, candidates, root, distinctCardsAtRoot) {
  stats.l1ChildrenVisits.sort((a, b) => b - a);
  const midIndex = Math.floor(stats.l1ChildrenVisits.length / 2);
  const first = candidates[0];
  const second = candidates[1];

  return {
    rootVisits: root.visits,
    distinctCardsAtRoot,
    candidates,
    bestMove: first ? first.key : null,
    bestMoveVisits: first ? first.visits : 0,
    runnerUpVisits: second ? second.visits : 0,
    totalNodes: stats.totalNodes,
    maxDepth: stats.maxDepth,
    depthCounts: stats.depthCounts,
    totalSingletonPct: stats.nodesWithVisits ? (stats.singletonsTotal / stats.nodesWithVisits) * 100 : 0,
    l1MaxVisits: stats.l1ChildrenVisits[0] || 0,
    l1MedianVisits: stats.l1ChildrenVisits[midIndex] || 0,
    l1SingletonPct: stats.l1Total ? (stats.l1Singletons / stats.l1Total) * 100 : 0,
  };
}

export function inspectTree(root, rootMoves = [], spec = null) {
  const distinctCardsAtRoot = new Set(rootMoves.map((m) => getCardId(m, spec)).filter((c) => c !== null)).size;
  const candidates = collectCandidates(root);

  const stats = {
    totalNodes: 0,
    maxDepth: 0,
    depthCounts: {},
    depthVisits: {},
    singletonsTotal: 0,
    nodesWithVisits: 0,
    l1ChildrenVisits: [],
    l1Singletons: 0,
    l1Total: 0,
  };

  traverseTree(root, 0, stats);
  return summarizeStats(stats, candidates, root, distinctCardsAtRoot);
}
