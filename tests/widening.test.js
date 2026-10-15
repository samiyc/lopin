import assert from "node:assert/strict";
import { test } from "node:test";
import { ismctsSettings } from "../src/sim/ismcts.js";
import { breadthOf, wideningOf, widenOffset } from "../src/sim/widening.js";

/** The first visit count at which a node offers all `widen` replies. */
const opensAt = (offset, widen = 7) => {
  let visits = 0;
  while (breadthOf(visits, widen, offset) < widen) visits += 1;
  return visits;
};

test("pwl runs from 0 (none) to 4 (the deepest); the obsolete pw maps onto it", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(widenOffset), [0, 3, 2, 1.5, 1]);
  assert.equal(wideningOf({ pw: 1 }), widenOffset(4));
  assert.equal(wideningOf({ pw: 3 }), widenOffset(1));
  assert.equal(wideningOf({ pw: 1, pwl: 1 }), 3);
  assert.equal(wideningOf({}), 0);
});

test("the higher the level, the later a node opens its 7 replies", () => {
  assert.deepEqual([1, 2, 3, 4].map((level) => opensAt(widenOffset(level))), [16, 25, 31, 36]);
});

test("an integer offset widens as k + ⌊√visits⌋ did, so old engine ids keep their moves", () => {
  for (const k of [1, 2, 3]) for (let visits = 0; visits < 60; visits += 1) assert.equal(breadthOf(visits, 7, k), Math.min(7, k + Math.floor(Math.sqrt(visits))));
});

test("no widening offers every reply; a level off the scale is refused", () => {
  assert.equal(breadthOf(0, 7, 0), 7);
  for (const level of [5, -1, 2.5]) assert.throws(() => widenOffset(level), /pwl va de 0/);
  assert.deepEqual(ismctsSettings("ismcts+pwl=3"), { pwl: 3 });
});
