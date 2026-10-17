import { colorOf, isJoker, valueOf } from "../../core/cards.js";
import { gateOn } from "../heuristics/gates.js";

/**
 * Sami's ideas on choosing a game (02/10): trips or suited runs, which the
 * cards cannot always give both of. Each judges a side of two or three cards,
 * once its shape is readable — a lone real card, with or without a joker,
 * could still become either.
 *
 * - `plan`: once a side of mine is complete, the shape most of my complete
 *   sides have is the plan; a side heading the same way earns `plan`, the
 *   other way costs it. Seven trips or seven runs come easier than a mix.
 * - `ends`: trips belong at the ends. Trips of 5 cut every suited run through
 *   5 (3-4-5, 4-5-6, 5-6-7) in three colours; trips of 1 or 10 cut one. A real
 *   card building trips costs `ends` × that share; a joker earns it — on
 *   mid-range trips it spares a colour the real card would have taken.
 * - `midRuns`: suited runs belong in the mid-range (4-5-6): `midRuns` at the
 *   centre of the values, as much again in cost at either end.
 * - `weakRuns`: a low suited run is overtaken by a higher one almost surely:
 *   it costs `weakRuns` × how low its top card sits.
 */
export const SHAPE_IDEAS = Object.freeze(["plan", "ends", "midRuns", "weakRuns"]);

/** How many runs of three values go through `value`, as a share of the most: 0 at the ends, 1 in the middle. */
export function runsCut(value, values) {
  const through = [value - 2, value - 1, value].filter((low) => low >= 1 && low + 2 <= values).length;
  return (through - 1) / 2;
}

/** `{ kind: "trips", value }`, `{ kind: "run", low, high }`, or null while the side could still be either. */
export function shapeOf(spec, cards) {
  const real = cards.filter((card) => !isJoker(card));
  if (real.length < 2) return null;
  const values = real.map((card) => valueOf(spec, card));
  if (new Set(values).size === 1) return { kind: "trips", value: values[0] };
  const [low, high] = [Math.min(...values), Math.max(...values)];
  const suited = new Set(real.map((card) => colorOf(spec, card))).size === 1;
  return suited && new Set(values).size === values.length && high - low <= 2 ? { kind: "run", low, high } : null;
}

/** The shape most of my complete sides have, or null on a tie. */
function planOf(spec, mySides) {
  const counts = { trips: 0, run: 0 };
  for (const side of mySides) {
    const kind = side.length === 3 ? shapeOf(spec, side)?.kind : null;
    if (kind) counts[kind] += 1;
  }
  if (counts.trips === counts.run) return null;
  return counts.trips > counts.run ? "trips" : "run";
}

function tripsBonus({ spec, weights, ideas }, shape, card) {
  if (!ideas.has("ends")) return 0;
  const cut = weights.ends * runsCut(shape.value, spec.values);
  // `endsReal` 0 keeps only the joker's half: a joker on mid-range trips, real trips left alone.
  if (cut === 0) return 0;
  return isJoker(card) ? cut : -cut * (weights.endsReal ?? 1);
}

function runBonus({ spec, weights, ideas }, shape) {
  const centre = (spec.values + 1) / 2;
  let bonus = 0;
  if (ideas.has("midRuns")) bonus += weights.midRuns * (1 - (2 * Math.abs((shape.low + shape.high) / 2 - centre)) / (centre - 1));
  if (ideas.has("weakRuns")) bonus -= weights.weakRuns * (1 - shape.high / spec.values);
  return bonus;
}

export const anyShapeIdea = (ideas) => ideas.has("plan") || ideas.has("ends") || ideas.has("midRuns") || ideas.has("weakRuns");

/** The shape ideas' bonus for adding `card` to my side `mine`. */
export function shapesBonus(context, mine, card) {
  // Read the shape only when an idea asks: this runs on every move of every rollout.
  if (!gateOn(context, "shapes", anyShapeIdea)) return 0;
  const shape = shapeOf(context.spec, [...mine, card]);
  if (!shape) return 0;
  let bonus = shape.kind === "trips" ? tripsBonus(context, shape, card) : runBonus(context, shape);
  if (context.ideas.has("plan")) {
    const plan = planOf(context.spec, context.mySides);
    if (plan) bonus += plan === shape.kind ? context.weights.plan : -context.weights.plan;
  }
  return bonus;
}
