import { colorOf, isJoker, valueOf } from "../../core/cards.js";

/**
 * Where a joker was put, read at a high level (Sami, 02/10): what it joins on
 * my side (trips, a suited run, a lone card, nothing), whether those cards
 * are mid-range or at the ends, on which border, and what the opponent's side
 * holds there. `npm run jokers` weighs each against the border and the game.
 */
const isMid = (value) => value >= 4 && value <= 7;

/** Two real cards that are the start of trips, or of a suited run (within two values). */
function pairKind(spec, cards) {
  const real = cards.filter((card) => !isJoker(card));
  if (real.length !== 2) return null;
  const [a, b] = real.map((card) => valueOf(spec, card));
  if (a === b) return "trips";
  return colorOf(spec, real[0]) === colorOf(spec, real[1]) && Math.abs(a - b) <= 2 ? "run" : "other";
}

function band(spec, cards) {
  const values = cards.filter((card) => !isJoker(card)).map((card) => valueOf(spec, card));
  if (values.length === 0) return null;
  return values.every(isMid) ? "milieu (4-7)" : "bouts (1-3, 8-10)";
}

function mySideTrait(spec, mine) {
  if (mine.length === 0) return "ouvre une borne avec le joker";
  const real = mine.filter((card) => !isJoker(card));
  if (real.length < mine.length) return "rejoint un autre joker";
  if (mine.length === 1) return `rejoint une carte seule, ${band(spec, mine)}`;
  const kinds = { trips: "complète un brelan", run: "complète une suite de couleur", other: "complète un côté ni brelan ni suite" };
  const kind = kinds[pairKind(spec, mine)];
  return pairKind(spec, mine) === "other" ? kind : `${kind}, ${band(spec, mine)}`;
}

function theirSideTrait(spec, theirs) {
  if (theirs.length === 0) return "face à un côté adverse vide";
  if (theirs.length === 1) return "face à une carte adverse seule";
  if (theirs.length === 3) return "face à un côté adverse plein";
  const kind = pairKind(spec, theirs);
  if (kind === "trips") return "face à un début de brelan adverse";
  return kind === "run" ? "face à un début de suite de couleur adverse" : "face à deux cartes adverses sans figure";
}

function borderTrait(border, count) {
  if (Math.abs(border - (count - 1) / 2) <= 1) return "borne du centre (3-5)";
  return border === 0 || border === count - 1 ? "borne du bord (1 ou 7)" : "borne intermédiaire (2 ou 6)";
}

function phaseTrait(turn) {
  if (turn <= 12) return "début (tours 1-12)";
  return turn <= 24 ? "milieu (13-24)" : "fin (25+)";
}

/** The traits of a joker put on `border` by `player`, before the move. */
export function jokerTraits(state, player, border, turn) {
  const { spec } = state;
  const [mine, theirs] = [state.borders[border].sides[player], state.borders[border].sides[1 - player]];
  return [mySideTrait(spec, mine), theirSideTrait(spec, theirs), borderTrait(border, state.borders.length), phaseTrait(turn)];
}

/**
 * Sami's joker trap: a pair whose last two real cards are already on the
 * board, built with a joker in hand. To the opponent it looks dead; the joker
 * makes it trips. Returns null unless the move makes a pair with a joker in
 * hand; otherwise whether that pair is dead (no real card left to finish it).
 */
export function pairWithJoker(state, player, hand, move) {
  const { spec } = state;
  const mine = state.borders[move.border].sides[player];
  if (isJoker(move.card) || mine.length !== 1 || isJoker(mine[0]) || !hand.some(isJoker)) return null;
  const value = valueOf(spec, move.card);
  if (valueOf(spec, mine[0]) !== value) return null;
  const board = state.borders.flatMap((border) => border.sides.flat());
  const seen = [...board, ...hand].filter((card) => !isJoker(card) && valueOf(spec, card) === value).length;
  return { dead: seen === spec.colors, value };
}
