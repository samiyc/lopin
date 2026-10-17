import { colorOf, isJoker, valueOf } from "../../core/cards.js";
import { figureOf } from "../../core/figures.js";
import { classify, strengthScore, sumOf } from "../../core/formations.js";
import { jokerStandIns } from "../../core/stand-ins.js";

/**
 * How a border is judged once figures sit beside it (docs/extension.md, Sami
 * 07/10). `evaluatorFor(state, border, player)` is the one place that answers
 * « what is this side worth here »: with no figure, the game's evaluator,
 * untouched — the base game does not change by a bit; otherwise an evaluator
 * with the same `score` contract (higher wins, ties to the first side
 * complete), the figures added up in a fixed order:
 * 1. the Kings and the Valet de Trèfle: the odd colour for both sides (Roi de
 *    Pique), +10 to a run (Roi de Carreau) and -10 to the sum (Valet de
 *    Trèfle, Sami 08/10) for the side of whoever laid it;
 * 2. La Somme (Valet de Carreau): only the sums are compared, the ±10 kept.
 * The Valet de Trèfle's old rule (« the weakest wins ») is gone; its key
 * `weakest` is read as `minusTen` so that older logs still load.
 */
const RANK_SPAN = 64;
const RUNS = new Set(["straight", "straightFlush"]);

/** The rules border `border` plays with for `player`. */
export function rulesOf(border, player) {
  const laid = (border.figures ?? []).flatMap((id, seat) => (id === null || id === undefined ? [] : [{ key: figureOf(id).key, seat }]));
  const has = (key) => laid.some((figure) => figure.key === key);
  return {
    sum: has("sum"),
    oddFlush: has("oddFlush"),
    plusTen: laid.some((figure) => figure.key === "plusTen" && figure.seat === player),
    minusTen: laid.some((figure) => (figure.key === "minusTen" || figure.key === "weakest") && figure.seat === player),
  };
}

const isPlain = (rules) => !rules.sum && !rules.oddFlush && !rules.plusTen && !rules.minusTen;

/** Three odd cards of one real suit (a colourless joker's phantom suit never counts: the joker cannot help). */
function isOddFlush(spec, cards) {
  const suit = colorOf(spec, cards[0]);
  return suit < spec.colors && cards.every((card) => colorOf(spec, card) === suit && valueOf(spec, card) % 2 === 1);
}

/** The value of three concrete cards under `rules` (jokers already stood in). */
function valueOfTriple(spec, order, cards, rules) {
  const sum = sumOf(spec, cards);
  const formation = classify(spec, cards);
  const bonus = rules.plusTen && RUNS.has(formation) ? 10 : 0;
  const penalty = rules.minusTen ? 10 : 0;
  if (rules.sum) return sum + bonus - penalty;
  if (rules.oddFlush && isOddFlush(spec, cards)) return order.length * RANK_SPAN + sum - penalty;
  return strengthScore(order, formation, sum) + bonus - penalty;
}

/** Every way the jokers of `cards` may stand in. */
function standIns(cards, options) {
  const at = cards.findIndex(isJoker);
  if (at < 0) return [cards];
  return options.flatMap((card) => standIns(cards.map((c, i) => (i === at ? card : c)), options));
}

const evaluators = new WeakMap();

function ruledEvaluator(state, rules) {
  const base = state.evaluator;
  if (!evaluators.has(base)) evaluators.set(base, new Map());
  const cache = evaluators.get(base);
  const key = `${rules.sum}${rules.oddFlush}${rules.plusTen}${rules.minusTen}`;
  if (!cache.has(key)) cache.set(key, buildRuled(state, rules));
  return cache.get(key);
}

function buildRuled({ spec, order, jokerRule, evaluator: base }, rules) {
  const options = jokerStandIns(spec, jokerRule);
  const memo = new Map();
  const judge = (cards) => {
    const values = standIns(cards, options).map((triple) => valueOfTriple(spec, order, triple, rules));
    return Math.max(...values);
  };
  const score = (cards) => {
    // A side not yet complete is never judged under a figure: only full sides are compared or proved.
    if (cards.length !== 3) return base.score(cards);
    const id = [...cards].sort((a, b) => a - b).join(",");
    if (!memo.has(id)) memo.set(id, judge(cards));
    return memo.get(id);
  };
  // The formation and sum shown in the replays stay the base ones.
  return { order, score, score3: (a, b, c) => score([a, b, c]), formation: base.formation, sum: base.sum, rules };
}

/** What a side of border `index` is worth for `player`: the game's evaluator, or one under the border's figures. */
export function evaluatorFor(state, index, player) {
  const border = state.borders[index];
  if (!border.figures || (border.figures[0] === null && border.figures[1] === null)) return state.evaluator;
  const rules = rulesOf(border, player);
  return isPlain(rules) ? state.evaluator : ruledEvaluator(state, rules);
}
