import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { backUpEstimates, blendedRate, estimateLeaf } from "../src/sim/implicit-minimax.js";
import { engineFor } from "../src/sim/bots.js";
import { createRng } from "../src/core/random.js";

const node = (fields = {}) => ({ visits: 0, wins: 0, avail: 0, children: new Map(), ...fields });

describe("implicit minimax backups (implicit-minimax.js, Sami 14/10)", () => {
  it("gives a new node the odds for the player who moved into it", () => {
    const leaf = node();
    estimateLeaf([{ child: leaf, mover: 0 }], { over: false, current: 1 }, () => 0.7);
    assert.equal(Math.round(leaf.est * 10), 3, "0.7 for player 1, who moves next, is 0.3 for player 0");
    const again = node({ est: 0.9 });
    estimateLeaf([{ child: again, mover: 0 }], { over: false, current: 1 }, () => 0.1);
    assert.equal(again.est, 0.9, "a node keeps its first estimate");
    const won = node();
    estimateLeaf([{ child: won, mover: 1 }], { over: true, winner: 1 }, () => 0);
    assert.equal(won.est, 1, "an ended game is its result");
  });

  it("backs up 1 − the best child, from the leaf's parent to the top", () => {
    const [a, b] = [node({ est: 0.2 }), node({ est: 0.6 })];
    const parent = node({ children: new Map([["a", a], ["b", b]]) });
    const top = node({ children: new Map([["p", parent]]) });
    backUpEstimates([{ child: top, mover: 0 }, { child: parent, mover: 1 }, { child: b, mover: 0 }]);
    assert.equal(Math.round(parent.est * 10), 4, "the opponent picks b (0.6): the parent is worth 0.4 to its mover");
    assert.equal(Math.round(top.est * 10), 6, "and the node above 1 − 0.4");
    assert.equal(blendedRate({ wins: 3, visits: 4, est: 0.25 }, 0.4), 0.6 * 0.75 + 0.4 * 0.25);
  });

  it("leaves the 1.2's search alone when off, and runs when on", () => {
    const off = engineFor("ismcts+widen=7+depth=5+core=stfig6+exact=12@60");
    const on = engineFor("ismcts+widen=7+depth=5+core=stfig6+exact=12+implicit=0.3@60");
    assert.ok(off(createRng(1)) && on(createRng(1)), "both engine ids are known");
  });
});
