import { colorOf, isJoker, valueOf } from "../../core/cards.js";
import { gateOn } from "./gates.js";
import { shapeOf } from "../eval/shapes.js";

/**
 * Bonuses that push the core the way the oracle played (03/10,
 * data/oracle-diffs.json: on 2,300 gaps, the oracle's move against the core's
 * favourite). Not a proof that the oracle is right — the core-against-core
 * duels say whether the core gains by it.
 *
 * - `stay`: a card on a side already started earns `stay` (the oracle puts a
 *   2nd card 65 % of the time against 51 %, a 3rd 27 % against 17 %);
 * - `noAnswer`: answering — my side empty, the opponent's not — costs
 *   `noAnswer` (7 % against 30 %);
 * - `noBlindOpen`: opening an untouched border with nothing in hand to make it
 *   trips or a suited run costs `noBlindOpen` (4 % against 18 %).
 *
 * `stay` can be narrowed (each setting off when absent): `stayCard` 2 or 3,
 * only that card of the side; `stayFigure`, only while the side can still
 * become trips or a suited run; `stayUntil` / `stayFrom`, only up to or from
 * that turn; `stayBehind`, only while the opponent has started as many
 * borders as I have, or more.
 *
 * Two more from the oracle's whole games against the 1.0 (04/10), meant for
 * the start of a game (`earlyIdeas`):
 * - `noOpen`: any card on a border nobody has played on costs `noOpen`, a
 *   plan in hand or not (the oracle opens on 44 % of its early moves, the 1.0
 *   on 60 %);
 * - `noRun`: a card that makes a side a suited run costs `noRun` (18 % of the
 *   oracle's gaps against 46 % for the 1.0's core).
 *
 * The other two traits need no new code: sides with no figure (33 % against
 * 9 %) are `junk` with a negative weight, more jokers (14 % against 4 %) a
 * core without the `joker` habit.
 */
export const ORACLE_IDEAS = Object.freeze(["stay", "noAnswer", "noBlindOpen", "noOpen", "noRun"]);

export const anyOracleIdea = (ideas) => ORACLE_IDEAS.some((idea) => ideas.has(idea));

/** Another card of the hand that makes `card` the start of trips or of a suited run (as `startsOf`, move-features.js). */
function plannedStart(spec, hand, card) {
  if (isJoker(card)) return true;
  const [value, color] = [valueOf(spec, card), colorOf(spec, card)];
  return hand.some((other) => other !== card && !isJoker(other) && (valueOf(spec, other) === value || (colorOf(spec, other) === color && Math.abs(valueOf(spec, other) - value) === 1)));
}

const started = (sides) => sides.filter((side) => side.length > 0).length;

/** Is it a turn `stay` counts on, and a board it counts on? */
function stayMoment({ weights, turn, mySides, theirSides }) {
  if (weights.stayUntil && turn > weights.stayUntil) return false;
  if (weights.stayFrom && turn < weights.stayFrom) return false;
  return !weights.stayBehind || started(theirSides) >= started(mySides);
}

/** 1 when two real cards can sit in the same trips, 2 in the same suited run (same colour, one or two values apart), else 0. */
function pairFits(spec, x, y) {
  const gap = Math.abs(valueOf(spec, x) - valueOf(spec, y));
  if (gap === 0) return 1;
  return gap <= 2 && colorOf(spec, x) === colorOf(spec, y) ? 2 : 0;
}

/**
 * Can `mine` plus `card` still become trips or a suited run? The same answer
 * as `shapeOf(spec, [...mine, card]) !== null`, with fewer than two real cards
 * counting as yes (such a side can still become anything) — but read pair by
 * pair, without building the side: `stfig` asks it on every move of every
 * rollout, and through `shapeOf` it cost the tree a fifth of its time. A side
 * holds three cards at most, so every pair fitting the same figure is enough.
 */
export function keepsFigure(spec, mine, card) {
  let [fits, real] = [3, 0];
  for (let i = 0; i <= mine.length; i += 1) {
    const other = mine[i] ?? card;
    if (isJoker(other)) continue;
    for (let j = 0; j < i; j += 1) fits &= isJoker(mine[j]) ? 3 : pairFits(spec, mine[j], other);
    real += 1;
  }
  return real < 2 || fits !== 0;
}

/** Is it a card `stay` counts: the right one of the side, on a side that keeps a figure if asked? */
function stayCard({ spec, weights }, mine, card) {
  if (weights.stayCard && mine.length + 1 !== weights.stayCard) return false;
  return !weights.stayFigure || keepsFigure(spec, mine, card);
}

const stayBonus = (context, mine, card) => (stayMoment(context) && stayCard(context, mine, card) ? context.weights.stay : 0);

/** `noRun`: the card makes my side a suited run. */
const runCost = ({ ideas, weights, spec }, mine, card) => (ideas.has("noRun") && shapeOf(spec, [...mine, card])?.kind === "run" ? -weights.noRun : 0);

/** On a border nobody has played on: `noOpen` whatever the hand, `noBlindOpen` without a plan for the card. */
function openCost(context, card) {
  const { ideas, weights } = context;
  const open = ideas.has("noOpen") ? -weights.noOpen : 0;
  return open + (ideas.has("noBlindOpen") && !plannedStart(context.spec, context.hand, card) ? -weights.noBlindOpen : 0);
}

export function oracleBonus(context, border, card) {
  const { ideas, weights } = context;
  if (!gateOn(context, "oracle", anyOracleIdea)) return 0;
  const [mine, theirs] = [context.mySides[border], context.theirSides[border]];
  if (mine.length > 0) return (ideas.has("stay") ? stayBonus(context, mine, card) : 0) + runCost(context, mine, card);
  if (theirs.length > 0) return ideas.has("noAnswer") ? -weights.noAnswer : 0;
  return openCost(context, card);
}
