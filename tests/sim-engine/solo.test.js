import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { JOKER, buildDeck, cardOf } from "../../src/core/cards.js";
import { getEvaluator } from "../../src/core/evaluator.js";
import { createRng } from "../../src/core/random.js";
import { playSolo, playSoloBatch } from "../../src/sim/engine/solo.js";
import { HABITS, jokerCompletesTrips, strategistAdjust } from "../../src/sim/heuristics/strategist.js";

const spec = DECKS.classique;
const rules = { order: ORDERS.original, jokerRule: JOKER_RULES.colorless };
const at = (value, suit) => cardOf(spec, suit, value);
const sorted = (cards) => [...cards].sort((a, b) => a - b);

describe("playSolo", () => {
  for (const habits of [null, new Set(HABITS)]) {
    it(`lays every card once, three per column (${habits ? "strategist" : "greedy"})`, () => {
      for (let seed = 1; seed <= 5; seed += 1) {
        const { haut, bas } = playSolo(spec, { ...rules, rng: createRng(seed), habits });
        for (const line of [haut, bas]) {
          assert.equal(line.length, 7);
          for (const column of line) assert.equal(column.length, 3);
        }
        assert.deepEqual(sorted([...haut, ...bas].flat()), sorted(buildDeck(spec)));
      }
    });
  }

  it("is reproducible from its seed", () => {
    const run = () => playSoloBatch(spec, { ...rules, games: 5, seed: 3, habits: HABITS, optimumGames: 1 });
    assert.deepEqual(run(), run());
  });

  it("never beats the exact optimum of its own lines", () => {
    const tally = playSoloBatch(spec, { ...rules, games: 3, seed: 4, habits: HABITS, optimumGames: 3 });
    assert.equal(tally.optimum.lines, 6);
    assert.ok(tally.optimum.value <= tally.optimum.optimum + 1e-9);
  });
});

describe("the strategist's habits", () => {
  const evaluator = getEvaluator(spec, rules.order, rules.jokerRule);
  const context = (habits = HABITS) => ({
    spec,
    evaluator,
    mySides: [[], [], [], [], [], [], []],
    unseen: { entries: buildDeck(spec).map((card) => [card, 1]), total: 42 },
    habits: new Set(habits),
  });

  it("plays a joker only to finish a pair into three of a kind", () => {
    assert.ok(jokerCompletesTrips(spec, [at(7, 0), at(7, 1)]));
    assert.ok(!jokerCompletesTrips(spec, [at(7, 0), at(8, 0)]));
    assert.equal(strategistAdjust([at(7, 0), at(7, 1)], JOKER, context()).allowed, true);
    assert.equal(strategistAdjust([at(4, 1), at(5, 1)], JOKER, context()).allowed, false);
    assert.equal(strategistAdjust([], JOKER, context()).allowed, false);
  });

  it("without the joker habit, a joker may go anywhere", () => {
    assert.equal(strategistAdjust([], JOKER, context(["opening"])).allowed, true);
  });

  it("opens a column with a middle card of a new suit rather than an ace", () => {
    const middle = strategistAdjust([], at(5, 2), context()).bonus;
    const ace = strategistAdjust([], at(1, 2), context()).bonus;
    assert.ok(middle > ace);
  });

  it("prefers two suited neighbours to a pair while the straight flush is still possible", () => {
    const suited = strategistAdjust([at(5, 1)], at(6, 1), context()).bonus;
    const pair = strategistAdjust([at(5, 1)], at(5, 2), context()).bonus;
    assert.ok(suited > pair);
    const exhausted = { ...context(), unseen: { entries: [], total: 0 } };
    assert.equal(strategistAdjust([at(5, 1)], at(6, 1), exhausted).bonus, 0);
  });
});
