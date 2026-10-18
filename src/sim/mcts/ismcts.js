import { createRng } from "../../core/random.js";
import { createBudget } from "./budget.js";
import { createEnsemble, explorationBonus, pointsFor, pointsOf } from "./choice.js";
import { visitRng } from "./common-deals.js";
import { finalChoice } from "./final-choice.js";
import { breadthOf, wideningOf } from "./widening.js";
import { reuseOf } from "./reuse.js";
import { EXACT, exactApplies, exactScores } from "../eval/exact.js";
import { backUpEstimates, blendedRate, estimateLeaf } from "./implicit-minimax.js";
import { applyMove, legalMoves } from "../engine/game.js";
import { createHalving, parseHalving } from "./halving.js";
import { createReader, inferredHands, pickHand } from "../search/infer.js";
import { determinize, seeAll, unseenList } from "../search/lookahead.js";
import { parseDiverse, pickCandidates, resolveDiverse, treeDiverseOf } from "./pick.js";
import { rolloutOf } from "./rollouts.js";
import { withoutMirrors } from "./mirror.js";
import { untriedScore } from "./first-play.js";
import { withTreeStats } from "./tree-stats.js";
import { probed, timedIteration } from "./probe.js";
import { moveKey } from "../search/search.js";

/**
 * A tree search over hidden information (single-observer ISMCTS), the 4th
 * lever of the roadmap. The experimental search judges each of its moves by
 * rollouts alone: what the opponent answers is left to the rollout policy,
 * whose mistakes the search then amplifies. Here every iteration deals the
 * unseen cards afresh, walks a tree of moves — mine, the opponent's reply,
 * mine again, `depth` plies — choosing by UCB1 among the core's `widen` best
 * moves where it stands, and only then plays the game out. A reply is a
 * branch the search can learn about, not a single guess of the policy.
 *
 * The opponent's moves depend on the hand each deal gives them, so a child's
 * exploration term counts the iterations where it was available (`avail`),
 * not its parent's visits. The move played is the root child most visited.
 *
 * Two ways to spend the budget deeper (merlin-is-dead, both off by default):
 * - `pw`, progressive widening: below the root a node offers one move, then
 *   more as it is visited (1 + √visits, up to `widen`), so the budget follows
 *   the good lines down instead of spreading over every reply;
 * - `rave` (a weight k, ~300): "7♥ on border 3" is worth about the same a move
 *   earlier or later, so every move a player made in an iteration — in the tree
 *   or the rollout — also informs that move wherever it was available. A
 *   child's value blends in that shared statistic, weighted √(k / (3n + k)): it
 *   speaks while the child has few visits, and fades as they grow.
 */
export const ISMCTS = Object.freeze({ budget: 400, candidates: 8, widen: 4, depth: 3, exploration: 0.7, diverse: 0, pw: 0, rave: 0, trunc: 0, oddsOf: null, puct: 0, trees: 1, simExact: 0, margin: 0, forkCut: 0, implicit: 0 });

const newNode = () => ({ visits: 0, wins: 0, avail: 0, children: new Map() });


/** The core's `count` best moves where `state` stands, or a pass when there is none; `mirror`: one of two mirror moves (mirror.js). */
function shortlist(judge, state, count, { diverse = 0, mirror = false } = {}) {
  const moves = legalMoves(state);
  if (moves.length === 0) return [null];
  return pickCandidates(judge.scoreMoves(state, mirror ? withoutMirrors(state, moves, (move) => move) : moves), count, diverse);
}

/**
 * A child's value: its own wins — with `implicit` (implicit-minimax.js), blended with the estimate backed up to it
 * — then blended with what its move did everywhere (`rave`) while it has few visits.
 */
function valueOf(child, shared, rave, implicit = 0) {
  const own = implicit > 0 && child.est !== undefined ? blendedRate(child, implicit) : child.wins / child.visits;
  if (!shared || shared.visits === 0) return own;
  const beta = Math.sqrt(rave / (3 * child.visits + rave));
  return (1 - beta) * own + (beta * shared.wins) / shared.visits;
}

/**
 * Marks every move of `moves` available, then picks: the first never tried, or
 * the best by UCB1 — or, with `puct`, AlphaZero's rule (puct.js), so the core's
 * favourites are explored first and longer.
 */
function select(node, moves, { exploration, amaf, rave, puct, implicit, fpu }, mover) {
  const children = moves.map((move) => {
    const key = moveKey(move);
    if (!node.children.has(key)) node.children.set(key, newNode());
    const child = node.children.get(key);
    child.avail += 1;
    return { move, child, shared: amaf?.get(`${mover}|${key}`) };
  });
  // A move never tried comes first (+∞, or by `fpu`: first-play.js), and the first of equal scores wins: the order UCB always had.
  const bonus = explorationBonus({ exploration, puct }, children.length);
  const untried = untriedScore(children, fpu, bonus);
  const scores = children.map(({ child, shared }, rank) => (child.visits === 0 ? untried(child, rank) : valueOf(child, shared, rave, implicit) + bonus(child, rank)));
  return children[scores.indexOf(Math.max(...scores))];
}

/** How many of the core's moves a node below the root offers: all `widen`, or fewer with `pwl` / `pw` (widening.js). */
const breadth = (node, ctx) => breadthOf(node.visits, ctx.widen, ctx.pw);

/** Credits every distinct (player, move) of an iteration with its result for that player. */
function creditShared(amaf, played, winner) {
  for (const key of new Set(played)) {
    if (!amaf.has(key)) amaf.set(key, { visits: 0, wins: 0 });
    const stat = amaf.get(key);
    stat.visits += 1;
    stat.wins += pointsFor(winner, Number(key[0]));
  }
}

/**
 * UCB's exploration at a node: `firstExploration` wherever the first player
 * moves (player 0 always starts), the root included, whoever searches; the
 * second player's nodes keep `exploration` (Sami, 06/10: the first player's
 * mistakes cost the most, the « tour critique »). With 7 replies a node, UCB
 * chooses at the root and the first ply, hardly further: in practice, the
 * first player's own candidates, or the replies a second player expects.
 */
const explorationAt = (game, ctx) => (game.current === 0 ? (ctx.firstExploration ?? ctx.exploration) : ctx.exploration);

/** The move taken at this ply: the root's halving, or UCB among the root's candidates or the core's shortlist. */
function choiceAt(node, ply, game, ctx) {
  if (ply === 0 && ctx.halving) return rootChoice(node, ctx);
  const moves = ply === 0 ? ctx.rootMoves : shortlist(ctx.judge, game, breadth(node, ctx), ctx);
  return select(node, moves, { exploration: explorationAt(game, ctx), amaf: ctx.amaf, rave: ctx.rave, puct: ctx.puct, implicit: ctx.implicit, fpu: ply > 0 ? ctx.fpu : undefined }, game.current);
}

/** The walk down the tree: the path taken, and the moves made on it (`rave`). `first`: the root's choice, made before the deal (`crn`). */
function descend(root, game, ctx, first) {
  const path = [];
  const played = [];
  let node = root;
  for (let ply = 0; ply < ctx.depth && !game.over; ply += 1) {
    const mover = game.current;
    const { move, child } = ply === 0 && first ? first : choiceAt(node, ply, game, ctx);
    path.push({ child, mover });
    if (move) played.push(`${mover}|${moveKey(move)}`);
    applyMove(game, move);
    node = child;
    if (child.visits === 0) break;
  }
  return { path, played };
}

/** A root candidate's visits and wins, for `halving`. */
const rootStats = (root) => (move) => root.children.get(moveKey(move)) ?? { visits: 0, wins: 0 };

/** `halving` (halving.js): at the root, the candidate whose turn it is, instead of UCB's pick. */
function rootChoice(root, ctx) {
  const move = ctx.halving.pick(ctx.iterations, rootStats(root));
  const key = moveKey(move);
  if (!root.children.has(key)) root.children.set(key, newNode());
  const child = root.children.get(key);
  child.avail += 1;
  return { move, child };
}

/**
 * The root's moves as the search rates them: a candidate's gain is its visits;
 * with `halving` (or `final`, final-choice.js), the finalist with the best win rate gets one more than the
 * most visited, so that it is the one played.
 */
function ratingOf(root, scored, ctx) {
  const visits = (move) => root.children.get(moveKey(move))?.visits ?? 0;
  const chosen = ctx.halving?.best(rootStats(root)) ?? finalChoice(root, ctx.rootMoves, ctx.final, moveKey);
  const top = Math.max(0, ...ctx.rootMoves.map(visits));
  return scored.map((entry) => {
    if (!ctx.rootMoves.includes(entry.move)) return { ...entry, gain: -1 + entry.gain / 100 };
    return { ...entry, gain: entry.move === chosen ? top + 1 : visits(entry.move) };
  });
}

/** An iteration's game: a deal of the unseen cards, or (`omniscient`, Omniscient 1.0) the true one. */
const dealFor = (ctx, rng = ctx.deals) => (ctx.omniscient ? seeAll(ctx.state, rng) : determinize(ctx.state, ctx.player, rng, { hand: ctx.hands && pickHand(ctx.hands, rng), known: ctx.unseen }));

/** An iteration's deal — with `crn` (common-deals.js), the root move chosen first and the deal its visit number's. */
function begin(root, ctx) {
  if (!ctx.crn) return { game: dealFor(ctx), first: null };
  const first = choiceAt(root, 0, ctx.state, ctx);
  return { game: dealFor(ctx, visitRng(ctx, first.child.visits)), first };
}

/** The walk down the tree; `implicit`: the new node's estimate, from its position before the rollout plays it on. */
function walk(root, game, ctx, first) {
  const walked = descend(root, game, ctx, first);
  if (ctx.implicit > 0) estimateLeaf(walked.path, game, ctx.oddsOf);
  return walked;
}

const finish = (game, ctx, played) => (game.over ? game.winner : rolloutOf(game, ctx, played));

/** The result carried back up the path. */
function backUp({ path, played }, game, winner, ctx) {
  const points = pointsOf(game, winner, ctx.margin);
  for (const { child, mover } of path) {
    child.visits += 1;
    child.wins += points(mover);
  }
  if (ctx.implicit > 0) backUpEstimates(path);
  if (ctx.amaf) creditShared(ctx.amaf, played, winner);
}

/** One iteration: a deal, a walk down the tree, a rollout, and the result carried back up. */
function iterate(root, ctx) {
  const { game, first } = begin(root, ctx);
  const walked = walk(root, game, ctx, first);
  backUp(walked, game, finish(game, ctx, walked.played), ctx);
}

/** The same iteration, each stage timed into `ctx.probe` (probe.js, the Labo's profiler). */
const iterateTimed = timedIteration({ begin, walk, finish, backUp });

/** `infer`: the opponent's hand guessed from their moves (infer.js), from a seed of its own so the deals stay a plain search's when it is off. */
const guessedHands = (state, judge, seed, { infer, readings }) => (infer > 0 ? inferredHands(state, judge, createRng(seed ^ 0x5bd1e995), { size: infer, readings }) : null);

function resolveCtx(state, scored, { seed, treePolicy, policy, firstExploration, ...settings }, deals) {
  const cfg = { ...ISMCTS, ...settings };
  const rootCap = resolveDiverse(cfg.rootDiverse ?? cfg.diverse, state);
  const rootMoves = pickCandidates(cfg.mirror > 0 ? withoutMirrors(state, scored) : scored, cfg.candidates, rootCap);
  const judge = (treePolicy ?? policy)(createRng(1));
  const phases = parseHalving(settings.halving);
  const rolloutRng = createRng(deals.int(2 ** 31));
  return {
    state, player: state.current, unseen: unseenList(state, state.current), deals, rootMoves, judge,
    rollout: policy(rolloutRng), rolloutRng, crn: cfg.crn > 0, crnSeed: seed,
    widen: cfg.widen, depth: cfg.depth, exploration: cfg.exploration,
    pw: wideningOf(cfg), rave: cfg.rave, trunc: cfg.trunc, oddsOf: cfg.oddsOf, puct: cfg.puct, simExact: cfg.simExact, margin: cfg.margin, forkCut: cfg.forkCut, implicit: cfg.implicit, final: cfg.final, omniscient: cfg.omniscient > 0, fpu: cfg.fpu,
    amaf: cfg.rave > 0 ? new Map() : null,
    hands: guessedHands(state, judge, seed, settings),
    firstExploration, halving: phases ? createHalving(phases, rootMoves) : null,
    iterations: 0, diverse: treeDiverseOf(cfg.diverse), mirror: cfg.mirror > 0,
  };
}

/**
 * A search from `state`, advanced one iteration at a time by `step()` — the
 * same interface as `createSearch` (search.js), so the page's worker runs it
 * against its clock. `scored`: the core's `scoreMoves` output; the root
 * shortlist is its `candidates` best. A root move's gain is its visits.
 */
export function createIsmcts(state, scored, options) {
  if ((options.trees ?? 1) > 1) return createEnsemble(createIsmcts, state, scored, options);
  const deals = createRng(options.seed);
  const ctx = resolveCtx(state, scored, options, deals);
  // `probe` (the Labo's profiler, probe.js): the same iterations, timed and counted.
  const run = options.probe ? iterateTimed : iterate;
  if (options.probe) probed(ctx, options.probe);
  const root = options.root ?? newNode();
  const rated = () => ratingOf(root, scored, ctx);
  return {
    step() {
      run(root, ctx);
      ctx.iterations += 1;
    },
    done: () => ctx.rootMoves.length <= 1,
    rollouts: () => ctx.iterations,
    scored: rated,
    best: () => rated().reduce((a, b) => (b.gain > a.gain ? b : a)).move,
    /** The tree itself, read by the finalists bench and the Labo (tree-snapshot.js). */
    tree: () => root,
    trees: () => [root],
    /** The root's candidates in the core's order, and the core's scored moves they came from (the Labo reads both). */
    candidates: () => ctx.rootMoves,
    core: () => scored,
  };
}

/** Has the opponent just put a card on the last of the seven borders? From then on, no border of theirs can start from nothing. */
export function isPivot(state) {
  const opponent = 1 - state.current;
  const last = state.lastMoves?.[opponent];
  const allStarted = state.borders.every((border) => border.sides[opponent].length > 0);
  return Boolean(last) && allStarted && state.borders[last.border].sides[opponent].length === 1;
}

/** `memory`: the opponent's last moves, remembered from one move to the next for `infer` (infer.js); nothing without it. */
function memoryOf(memory) {
  if (!memory) return () => ({});
  const reader = createReader();
  return (state) => {
    reader.observe(state);
    return { readings: reader.readings(memory) };
  };
}

/**
 * The ISMCTS bot: the core shortlists at the root, the rollout policy plays
 * the rest; small endgames are solved. Turning points (merlin-is-dead):
 * `exact` solves endgames up to that many cards once the pile is empty (8
 * by default), capped at `EXACT.nodes` positions past 8; `pivot` multiplies
 * the budget on the move after the opponent has started all seven borders.
 * `hope`: when the solver finds no win, search anyway — every lost move is
 * equal to the solver, not to an opponent who may still slip.
 */
export function ismctsBot(rng, { base, policy, name = "ismcts", budget = ISMCTS.budget, budgetMs = Infinity, exact = EXACT.maxCards, pivot = 1, hope = 0, late, early, smart, memory, ...settings }) {
  const seed = rng.int(2 ** 31);
  const searchFor = (state, moves, options, extra = {}) =>
    createIsmcts(state, base.scoreMoves(state, moves, options), { policy, seed: seed ^ Math.imul(state.turn + 1, 2654435761), ...settings, ...extra });
  // `budgetMs`: a clock instead of a count, to compare variants of unequal speed at equal time; `late`, `early`, `smart`: budget.js.
  const { run, usage } = createBudget({ budget, budgetMs, late, early, smart });
  const recall = memoryOf(memory);
  const reuse = reuseOf(settings.reuse);
  // Omniscient 1.0 sees the pile: its solver counts the pile's cards with the hands' (exact.js).
  const solves = (state, moves) => moves.length > 1 && exactApplies(state, exact, settings.omniscient > 0);
  const maxNodes = exact > EXACT.maxCards ? EXACT.nodes : Infinity;
  const winning = (scores) => scores && (!hope || scores.some((entry) => entry.exact && entry.gain > 0.5));
  const solved = (state, moves, options) => {
    if (!solves(state, moves)) return null;
    const scores = exactScores(state, base.scoreMoves(state, moves, { ...options, keepAll: true }), { maxNodes });
    return winning(scores) ? scores : null;
  };
  const bestOf = (scored) => scored.reduce((a, b) => (b.gain > a.gain ? b : a)).move;
  const scoreMoves = (state, moves, options = {}) => {
    if (moves.length <= 1) return base.scoreMoves(state, moves, options);
    const exactly = solved(state, moves, options);
    if (exactly) return exactly;
    const search = reuse.remember(state, run(searchFor(state, moves, options, { ...recall(state), root: reuse.rootFor(state) }), state.turn, isPivot(state) ? pivot : 1));
    // The tree's shape by level, for the replays (tree-stats.js).
    return withTreeStats(search.scored(), search);
  };
  // `pick` is `choose` with the scores it chose from, for the replays to keep (bot-games.js).
  const pick = (state, moves) => {
    if (moves.length <= 1) return { move: moves[0], scored: null };
    const scored = scoreMoves(state, moves);
    return { move: reuse.played(bestOf(scored)), scored };
  };
  return { name, base, policy, searchFor, solves, scoreMoves, usage, pick, choose: (state, moves) => pick(state, moves).move };
}

/**
 * The settings an `ismcts` engine id names — `ismcts`, then `+depth=2`,
 * `+widen=6`, `+exploration=1`, `+sample=0.05` (sampled rollouts), `+exact=12`,
 * `+pivot=4`, `+hope=1` (`ismctsBot`), `+late=2+early=0.5`, `+smart=1` (`budget.js`),
 * `+firstExploration=0.6` (the first player's nodes, root included), `+puct=2` (the core's rank as a prior), `+trees=2` (Ensemble), `+forkCut=1|2` (fork-cut.js), `+implicit=0.3` (implicit-minimax.js), `+final=1` (final-choice.js), `+crn=1` (common-deals.js), `+fpu=1` (first-play.js), `+mirror=1` (mirror.js), `+pwl=0..5` (widening.js; `+pw=k` obsolete), `+rave=300`, `+infer=48` (`createIsmcts`, infer.js), `+memory=3` (`ismctsBot`), `+lite=1|2` (B1, bots.js), `+halving=1000-500-500` (halving.js), `+core=nb1`, `+shortlist=plain`, `+rollout=plain`
 * (named cores, experimental.js) — or null.
 */
export function ismctsSettings(name) {
  const [base, ...changes] = name.split("+");
  if (base !== "ismcts") return null;
  return Object.fromEntries(
    changes.map((change) => {
      const [key, value] = change.split("=");
      if (["core", "shortlist", "rollout", "halving"].includes(key)) return [key, value];
      if (key === "diverse" || key === "rootDiverse") return [key, parseDiverse(value)];
      if (!["depth", "widen", "exploration", "candidates", "sample", "exact", "pivot", "hope", "pw", "pwl", "rave", "late", "early", "smart", "trunc", "infer", "memory", "lite", "firstExploration", "puct", "trees", "simCertain", "simExact", "margin", "reuse", "forkCut", "implicit", "final", "omniscient", "crn", "fpu", "mirror"].includes(key)) throw new Error(`Variante inconnue : « ${key} »`);
      return [key, Number(value)];
    }),
  );
}
