import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { keepSelection, planPremove, resolvePremove } from "../../web/app/play/premove.js";

describe("playing ahead", () => {
  const legal = (map) => (index) => new Set(map[index] ?? []);

  it("keeps the card by id, and plays it where it now sits", () => {
    const premove = planPremove([10, 20, 30], 1, 4);
    assert.deepEqual(premove, { card: 20, border: 4 });
    assert.deepEqual(resolvePremove(premove, [30, 10, 20], legal({ 2: [4, 5] })), { index: 2, card: 20, border: 4 });
  });

  it("drops a move that is no longer legal, keeping the card selected", () => {
    const premove = { card: 20, border: 4 };
    assert.deepEqual(resolvePremove(premove, [10, 20], legal({ 1: [5] })), { cancel: true, index: 1 });
    assert.deepEqual(resolvePremove(premove, [10, 30], legal({})), { cancel: true, index: null });
    assert.equal(resolvePremove(null, [10], legal({})), null);
  });

  it("keeps the selection through the bot's move, not through the human's", () => {
    assert.equal(keepSelection(1, [10, 20, 30], [10, 20, 30], false), 1);
    assert.equal(keepSelection(1, [10, 20, 30], [20, 10, 30], false), 0, "follows its card");
    assert.equal(keepSelection(1, [10, 20, 30], [10, 30, 40], true), null);
    assert.equal(keepSelection(null, [10], [10], false), null);
  });
});
