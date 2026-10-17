import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ABLATIONS, FEATURES, compareScorings, featureOf, timeByFeature } from "../../scripts/lib/domain/core-features.js";
import { coreOf } from "../../src/sim/heuristics/experimental.js";

const at = (file, functionName) => ({ url: `file:///E:/lopin/src/sim/${file}`, functionName });

describe("npm run features: the core's features, their time and their activation", () => {
  it("gives each profiled function to its feature, by file then by name", () => {
    assert.equal(featureOf(at("potential.js", "pairPotential")).id, "potential");
    assert.equal(featureOf(at("potential.js", "unseenCards")).id, "unseen");
    assert.equal(featureOf(at("strategist.js", "suitedOutLeft")).id, "suited");
    assert.equal(featureOf(at("strategist.js", "strategistAdjust")).id, "dispatch");
    assert.equal(featureOf(at("ideas.js", "ideasBonus")).id, "dispatch");
    assert.equal(featureOf(at("mined.js", "minedBonus")).id, "idle");
    assert.equal(featureOf(at("bots.js", "moveGain")).id, "gain");
    assert.equal(featureOf(at("bots.js", "cardCost")).id, "price");
    assert.equal(featureOf(at("oracle-ideas.js", "stayMoment")).id, "stay");
    assert.equal(featureOf({ url: "", functionName: "(garbage collector)" }).id, "gc");
    assert.equal(featureOf(at("unknown.js", "x")).id, "other");
  });

  it("every feature id is unique", () => assert.equal(new Set(FEATURES.map(({ id }) => id)).size, FEATURES.length));

  it("sums self time per feature, leaving out the idle thread and the measurement itself", () => {
    const nodes = [
      { id: 1, callFrame: at("potential.js", "sidePotential") },
      { id: 2, callFrame: { url: "", functionName: "(idle)" } },
      { id: 3, callFrame: { url: "", functionName: "dispatch" } },
      { id: 4, callFrame: at("ideas.js", "spreadPenalty") },
    ];
    const { total, features } = timeByFeature({ nodes, samples: [1, 1, 2, 3, 4], timeDeltas: [1000, 1000, 5000, 5000, 2000] });
    assert.equal(total, 4);
    assert.deepEqual(features.potential, { ms: 2, share: 0.5 });
    assert.deepEqual(features.spread, { ms: 2, share: 0.5 });
  });

  it("switches a feature off without touching the rest of the core", () => {
    const core = coreOf("stfig6");
    assert.ok(!ABLATIONS.stay(core).ideas.includes("stay"));
    assert.ok(!ABLATIONS.opening(core).habits.includes("opening"));
    const priced = ABLATIONS.price(core).params;
    assert.equal(priced.jokerCost, 0);
    assert.ok(priced.temperature > 0);
  });

  it("compares two scorings: gains changed, and whether the favourite moved", () => {
    const move = (card, border) => ({ card, border });
    const full = [{ move: move(1, 0), gain: 0.5 }, { move: move(2, 1), gain: 0.3 }];
    assert.deepEqual(compareScorings(full, [{ move: move(1, 0), gain: 0.5 }, { move: move(2, 1), gain: 0.3 }]), { moves: 2, changed: 0, favourite: false });
    assert.deepEqual(compareScorings(full, [{ move: move(1, 0), gain: 0.2 }, { move: move(2, 1), gain: 0.3 }]), { moves: 2, changed: 1, favourite: true });
  });
});
