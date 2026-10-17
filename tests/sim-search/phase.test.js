import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { phaseBot, phaseSettings, switchOf } from "../../src/sim/search/phase.js";

const board = (owners, started = true) => ({ borders: owners.map((owner) => ({ owner, sides: [[started ? 1 : null].filter(Boolean), [2]] })) });

describe("the two-phase bot", () => {
  it("reads its id: the switch, then the early and the late engine, budgets included", () => {
    assert.deepEqual(phaseSettings("phase:20:ismcts+core=nb1@720/ismcts+depth=7@880"), { switchName: "20", early: "ismcts+core=nb1@720", late: "ismcts+depth=7@880" });
    assert.equal(phaseSettings("ismcts+depth=7@880"), null);
  });

  it("switches at a turn, or on an event of the game", () => {
    assert.equal(switchOf("20")({ turn: 19 }), false);
    assert.equal(switchOf("20")({ turn: 20 }), true);
    assert.equal(switchOf("border")(board([null, null])), false);
    assert.equal(switchOf("border")(board([null, 1])), true);
    assert.equal(switchOf("board")(board([null, null], false)), false);
    assert.equal(switchOf("board")(board([null, null])), true);
    assert.equal(switchOf("pile10")({ pile: Array(11) }), false);
    assert.equal(switchOf("pile10")({ pile: Array(10) }), true);
    assert.throws(() => switchOf("soon"), /Bascule inconnue/);
  });

  it("plays the early engine before the switch and the late one after", () => {
    const engine = (name) => () => ({ choose: () => name, scoreMoves: () => name });
    const bot = phaseBot({ switchName: "20", early: engine("early"), late: engine("late") })(null);
    assert.equal(bot.choose({ turn: 3 }, []), "early");
    assert.equal(bot.choose({ turn: 25 }, []), "late");
  });
});
