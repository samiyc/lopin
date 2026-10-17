import { colorOf, isJoker, valueOf } from "../../core/cards.js";
import { parseCard, parseCards } from "../../core/notation.js";
import { shapeOf } from "../../sim/eval/shapes.js";

/**
 * High-level traits of one logged move, for mining rules out of replays
 * (`npm run rules`, Sami 02/10): not "a 7 of hearts" but when it was played —
 * phase, after a border won or lost, behind or ahead in open borders, from
 * which starting hand — and what it did: open an untouched border, answer a
 * card, build trips or a suited run, face a full side.
 *
 * `contextsOf` and `traitsOf` return the names that hold; each is a
 * predicate a bonus could read from the core's own context.
 */
const started = (sides) => sides.filter((side) => side.length > 0).length;

function phaseOf(turn) {
  if (turn <= 12) return "début (tours 1-12)";
  return turn <= 24 ? "milieu (13-24)" : "fin (25+)";
}

/** When the move was played, from the mover's side: the situations it is counted in. */
export function contextsOf(state, player, handClass, turn) {
  const mySides = state.borders.map((border) => border.sides[player]);
  const theirSides = state.borders.map((border) => border.sides[1 - player]);
  const owners = state.borders.map((border) => border.owner);
  const contexts = ["partout", phaseOf(turn), `main ${handClass}`];
  if (owners.includes(player)) contexts.push("après une borne gagnée");
  if (owners.includes(1 - player)) contexts.push("après une borne perdue");
  const [mine, theirs] = [started(mySides), started(theirSides)];
  if (theirs > mine) contexts.push("moins de bornes ouvertes que l'adversaire");
  if (mine > theirs) contexts.push("plus de bornes ouvertes que l'adversaire");
  return contexts;
}

/** Another card of the hand that makes `card` the start of trips (same value) or of a suited run (a suited neighbour). */
function startsOf(spec, hand, card) {
  if (isJoker(card)) return { trips: false, run: false };
  const others = hand.filter((other) => other !== card && !isJoker(other));
  return {
    trips: others.some((other) => valueOf(spec, other) === valueOf(spec, card)),
    run: others.some((other) => colorOf(spec, other) === colorOf(spec, card) && Math.abs(valueOf(spec, other) - valueOf(spec, card)) === 1),
  };
}

function placeTraits(state, player, border) {
  const owners = state.borders.map((entry) => entry.owner);
  const traits = [];
  const count = state.borders.length;
  if (Math.abs(border - (count - 1) / 2) <= 1) traits.push("au centre (bornes 3-5)");
  if (border === 0 || border === count - 1) traits.push("sur un bord (borne 1 ou 7)");
  if (owners[border - 1] === player || owners[border + 1] === player) traits.push("à côté d'une borne gagnée");
  if (owners[border - 1] === 1 - player || owners[border + 1] === 1 - player) traits.push("à côté d'une borne perdue");
  return traits;
}

function cardTraits(spec, card) {
  if (isJoker(card)) return ["joker"];
  const value = valueOf(spec, card);
  if (value >= 8) return ["carte forte (8+)"];
  return value <= 3 ? ["carte faible (3-)"] : ["carte moyenne (4-7)"];
}

/** Answering a lone card: one notch higher, or lower. */
function answerTraits(spec, card, theirs) {
  if (theirs.length !== 1 || isJoker(theirs[0]) || isJoker(card)) return [];
  const gap = valueOf(spec, card) - valueOf(spec, theirs[0]);
  if (gap === 1) return ["surenchérit d'un cran"];
  return gap < 0 ? ["répond plus bas"] : [];
}

function openingTraits(spec, hand, card, theirs) {
  const traits = [theirs.length === 0 ? "ouvre une borne vierge" : "répond à une borne adverse"];
  const starts = startsOf(spec, hand, card);
  if (starts.trips) traits.push("ouvre avec de quoi faire un brelan");
  if (starts.run) traits.push("ouvre avec de quoi faire une suite de couleur");
  if (!isJoker(card) && !starts.trips && !starts.run) traits.push("ouvre sans suite prévue en main");
  return [...traits, ...answerTraits(spec, card, theirs)];
}

function buildingTraits(spec, mine, card, theirs) {
  const traits = [mine.length === 2 ? "complète un côté (3e carte)" : "pose une 2e carte"];
  const shape = shapeOf(spec, [...mine, card])?.kind;
  if (shape) traits.push(shape === "trips" ? "bâtit un brelan" : "bâtit une suite de couleur");
  else if (mine.every((other) => !isJoker(other)) && !isJoker(card)) traits.push("bâtit un côté ni brelan ni suite de couleur");
  if (theirs.length === 3) traits.push("face à un côté adverse plein");
  return traits;
}

/** What the move did. */
export function traitsOf(state, player, hand, move) {
  const { spec } = state;
  const mine = state.borders[move.border].sides[player];
  const theirs = state.borders[move.border].sides[1 - player];
  const shape = mine.length === 0 ? openingTraits(spec, hand, move.card, theirs) : buildingTraits(spec, mine, move.card, theirs);
  return [...shape, ...cardTraits(spec, move.card), ...placeTraits(state, player, move.border)];
}

/** The move and the hand of a logged turn, as cards. */
export const loggedMove = (spec, entry) => ({ move: { card: parseCard(spec, entry.move.card), border: entry.move.border - 1 }, hand: parseCards(spec, entry.hand) });
