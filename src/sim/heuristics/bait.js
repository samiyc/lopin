import { colorOf, isJoker, valueOf } from "../../core/cards.js";

/**
 * Sami's bait (02/10): low trips or a low suited run, started on a border that
 * matters to neither side, to draw the opponent's strong suited cards there —
 * cards they then lack where it counts.
 *
 * A border matters to me when it lies in my best run of three adjacent
 * borders (the highest summed odds, `chances`), and to the opponent when it
 * lies in theirs (the highest summed 1 − odds). Any other border is a bait
 * border; a card of 1 to 3 that starts or extends a low pair or a low suited
 * run there earns `bait`.
 *
 * Between bots the opponent reads odds, not intentions: whether it bites at
 * all is what `npm run duel -- core:bt2 core:exp` measures.
 */
const LOW = 3;

/** The three borders of the run of three with the highest summed `score`. */
function bestRun(scores) {
  let best = 0;
  for (let start = 1; start + 2 < scores.length; start += 1) {
    if (scores[start] + scores[start + 1] + scores[start + 2] > scores[best] + scores[best + 1] + scores[best + 2]) best = start;
  }
  return new Set([best, best + 1, best + 2]);
}

/** Borders in neither side's best run of three. */
export function baitBorders(chances) {
  const mine = bestRun(chances);
  const theirs = bestRun(chances.map((odds) => 1 - odds));
  return chances.map((_, border) => !mine.has(border) && !theirs.has(border));
}

/** A low card that starts my side, or makes a low pair or a low suited start with the card already there. */
function lowFigure(spec, mine, card) {
  if (isJoker(card) || valueOf(spec, card) > LOW || mine.length > 1) return false;
  if (mine.length === 0) return true;
  const [other] = mine;
  if (isJoker(other) || valueOf(spec, other) > LOW) return false;
  return valueOf(spec, other) === valueOf(spec, card) || colorOf(spec, other) === colorOf(spec, card);
}

export function baitBonus({ spec, ideas, weights, chances, mySides, memo }, border, card) {
  if (!ideas.has("bait") || !chances) return 0;
  const bait = memo?.get("bait") ?? baitBorders(chances);
  memo?.set("bait", bait);
  return bait[border] && lowFigure(spec, mySides[border], card) ? weights.bait : 0;
}
