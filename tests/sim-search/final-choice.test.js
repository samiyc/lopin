import assert from "node:assert/strict";
import { test } from "node:test";
import { finalChoice } from "../../src/sim/mcts/final-choice.js";
import { ismctsSettings } from "../../src/sim/mcts/ismcts.js";

const rootOf = (stats) => ({ children: new Map(Object.entries(stats).map(([key, [visits, wins]]) => [key, { visits, wins }])) });
const keyOf = (move) => move;

test("without final, the most visited is played", () => {
  assert.equal(finalChoice(rootOf({ a: [100, 50] }), ["a"], undefined, keyOf), undefined);
});

test("final=0 plays the best win rate, final=1 discounts the rarely visited", () => {
  // a: most visited, 55 %; b: 70 % over 16 visits; c: 100 % over one visit.
  const root = rootOf({ a: [400, 220], b: [16, 11.2], c: [1, 1] });
  assert.equal(finalChoice(root, ["a", "b", "c"], 0, keyOf), "c");
  // 0.55 − 1/20 = 0.50; 0.70 − 1/4 = 0.45; 1 − 1 = 0.
  assert.equal(finalChoice(root, ["a", "b", "c"], 1, keyOf), "a");
  // 0.55 − 0.5/20 = 0.525; 0.70 − 0.5/4 = 0.575.
  assert.equal(finalChoice(root, ["a", "b", "c"], 0.5, keyOf), "b");
});

test("an unvisited candidate is never played", () => {
  assert.equal(finalChoice(rootOf({ a: [0, 0], b: [3, 1] }), ["a", "b"], 0, keyOf), "b");
});

test("+final=c reads as a number", () => {
  assert.deepEqual(ismctsSettings("ismcts+final=0.5"), { final: 0.5 });
});
