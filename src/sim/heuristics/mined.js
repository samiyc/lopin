import { isJoker, valueOf } from "../../core/cards.js";
import { gateOn } from "./gates.js";
import { shapeOf } from "../eval/shapes.js";

/**
 * Rules mined from the kept bot games (`npm run rules`, 02/10): what winners
 * do more often than losers in the same game, turned into bonuses — only the
 * ones that are choices rather than luck (holding a joker) or the mere sign of
 * being ahead (playing next to a won border is mostly having won one).
 *
 * - `junk`: a side that is neither trips nor a suited run costs `junk` (losers
 *   build more of them: 59 % of their late moves against 41 %).
 * - `facing`: playing where the opponent's side is full — the target is known —
 *   earns `facing`.
 * - `underbid`: answering a lone card lower costs `underbid` (against the 0.9,
 *   losers do it on 25 % of their early moves, winners on 12 %).
 * - `nextToWon`: next to a border I have won earns `nextToWon`.
 * - `deepen`: while the opponent has started more borders than me, a second
 *   card on a border I have started earns `deepen` (unequal games: the winner
 *   does it in 80 % of such moves, the loser keeps opening with high cards).
 */
export const MINED_IDEAS = Object.freeze(["junk", "facing", "underbid", "nextToWon", "deepen"]);

function junkPenalty({ spec, weights }, mine, card) {
  const next = [...mine, card];
  if (next.filter((other) => !isJoker(other)).length < 2 || next.length < 2) return 0;
  return shapeOf(spec, next) ? 0 : -weights.junk;
}

function underbidPenalty({ spec, weights }, mine, theirs, card) {
  if (mine.length > 0 || theirs.length !== 1 || isJoker(theirs[0]) || isJoker(card)) return 0;
  return valueOf(spec, card) < valueOf(spec, theirs[0]) ? -weights.underbid : 0;
}

const nextToWon = ({ owners, me }, border) => owners[border - 1] === me || owners[border + 1] === me;
const startedCount = (sides) => sides.filter((side) => side.length > 0).length;
const outnumbered = ({ mySides, theirSides }) => startedCount(theirSides) > startedCount(mySides);

/** The bonuses that read the board around the border: borders won, borders started. */
function boardBonus(context, border, mine) {
  const { ideas, weights } = context;
  let bonus = 0;
  if (ideas.has("nextToWon") && nextToWon(context, border)) bonus += weights.nextToWon;
  if (ideas.has("deepen") && mine.length === 1 && outnumbered(context)) bonus += weights.deepen;
  return bonus;
}

export const anyMined = (ideas) => ideas.has("junk") || ideas.has("facing") || ideas.has("underbid") || ideas.has("nextToWon") || ideas.has("deepen");

export function minedBonus(context, border, card) {
  const { ideas, weights } = context;
  if (!gateOn(context, "mined", anyMined)) return 0;
  const [mine, theirs] = [context.mySides[border], context.theirSides[border]];
  let bonus = 0;
  if (ideas.has("junk")) bonus += junkPenalty(context, mine, card);
  if (ideas.has("facing") && theirs.length === 3) bonus += weights.facing;
  if (ideas.has("underbid")) bonus += underbidPenalty(context, mine, theirs, card);
  return bonus + boardBonus(context, border, mine);
}
