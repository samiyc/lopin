import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BOT_LINEUP } from "../../src/config/bots.js";
import { engineDiff, normalizeEngine } from "../../src/sim/mcts/engine-id.js";
import { BASE_ENGINE, costOf, engineFromForm, formFromEngine, guardsOf, measuredOf, neighboursOf, verdictOf } from "../../web/app/lab/engine-builder.js";

const V12 = BOT_LINEUP.experimental.engine;
const LIGHT = BOT_LINEUP["oracle-light"].engine;

describe("engine ids as configs (engine-id.js)", () => {
  it("writes one spelling: settings sorted, defaults dropped, the budget written", () => {
    assert.equal(normalizeEngine(V12), "ismcts+core=stfig6+depth=5+exact=12+widen=7@2000");
    assert.equal(normalizeEngine("ismcts+exact=12+candidates=8+trees=1+widen=7+core=stfig6+depth=5@2000"), normalizeEngine(V12));
    assert.equal(normalizeEngine("ismcts+depth=2"), "ismcts+depth=2@400");
    assert.equal(normalizeEngine("greedy"), "greedy");
  });

  it("says which settings two configs differ by", () => {
    assert.deepEqual(engineDiff(V12, V12.replace("@2000", "@4000")), ["@"]);
    assert.deepEqual(engineDiff(V12, V12.replace("+exact=12", "+exact=12+fpu=1")), ["fpu"]);
    assert.equal(engineDiff(V12, "lookahead"), null);
  });
});

describe("the Labo's bot builder (engine-builder.js)", () => {
  it("gives back the line-up's ids from their own forms, the 1.2 untouched", () => {
    assert.equal(BASE_ENGINE, V12);
    for (const engine of [V12, LIGHT, "ismcts+widen=7+depth=5+core=stfig6+exact=12+mirror=1@2000", "ismcts+widen=7+depth=5+core=stfig6+exact=12@t4000"]) {
      assert.equal(engineFromForm(formFromEngine(engine)).engine, engine);
    }
  });

  it("refuses a value off its range or a missing budget", () => {
    const form = formFromEngine(V12);
    assert.match(engineFromForm({ ...form, values: { ...form.values, widen: "40" } }).error, /widen/);
    assert.match(engineFromForm({ ...form, budget: "0" }).error, /Itérations/);
    assert.equal(engineFromForm({ ...form, values: { ...form.values, final: "1", exact: "0" } }).engine, "ismcts+widen=7+depth=5+core=stfig6+final=1@2000");
  });

  it("keeps the settings the form does not show", () => {
    const engine = "ismcts+widen=5+depth=5+core=stfig6+exact=12+diverse=2@2000";
    assert.equal(engineFromForm(formFromEngine(engine)).engine, engine);
  });

  it("estimates a move and a game, and warns past the guards", () => {
    const cost = costOf(LIGHT, { perSecond: 1000, workers: 2 });
    assert.deepEqual([cost.iterations, cost.moveMs], [10000, 5000]);
    assert.deepEqual(guardsOf(LIGHT, cost), [], "10 000 a move, 80 s a game and depth 10 are within the guards");
    const deep = "ismcts+widen=7+depth=12+core=stfig6@20000";
    assert.deepEqual(guardsOf(deep, costOf(deep, { perSecond: 1000 })).map((guard) => guard.level), ["warn", "warn", "note"], "20 000 a move, 5 min 20 s a game, depth 12");
    const huge = V12.replace("@2000", "@60000");
    assert.equal(guardsOf(huge, costOf(huge, { perSecond: 1000 }))[0].level, "stop");
    assert.equal(costOf(V12.replace("@2000", "@t3000"), { perSecond: 1000 }).iterations, 3000);
  });

  const configs = {
    names: { [normalizeEngine(V12)]: "Expérimental 1.2", [normalizeEngine(V12.replace("+exact=12", "+exact=12+fpu=1"))]: "ReplyFpu1" },
    pairs: [
      { a: normalizeEngine(V12), b: normalizeEngine(V12.replace("+exact=12", "+exact=12+fpu=1")), score: 0.485, low: 0.46, high: 0.51, games: 1000, last: "2026-10-17" },
      { a: normalizeEngine(V12), b: normalizeEngine(V12.replace("@2000", "@4000")), score: 0.472, low: 0.445, high: 0.499, games: 1000, last: "2026-10-12" },
    ],
  };

  it("finds what the duels measured, from the config's side, and its neighbours", () => {
    const fpu = measuredOf(V12.replace("+exact=12", "+exact=12+fpu=1"), configs);
    assert.equal(fpu.length, 1);
    assert.deepEqual([fpu[0].name, fpu[0].score, fpu[0].verdict], ["Expérimental 1.2", 0.515, "pas d'écart net"]);
    assert.equal(fpu[0].low, 1 - 0.51);
    assert.deepEqual(neighboursOf(V12.replace("+exact=12", "+exact=12+puct=1"), configs).map((entry) => entry.engine), [normalizeEngine(V12)]);
    assert.deepEqual(measuredOf("ismcts+depth=9@100", configs), []);
  });

  it("reads a verdict as the protocol does", () => {
    assert.equal(verdictOf({ low: 0.501, high: 0.55, games: 1000 }), "devant");
    assert.equal(verdictOf({ low: 0.51, high: 0.6, games: 400 }), "devant, à confirmer sur 1 000 parties");
    assert.equal(verdictOf({ low: 0.4, high: 0.49, games: 300 }), "derrière");
    assert.equal(verdictOf({ low: 0.45, high: 0.55, games: 300 }), "pas d'écart net");
  });
});

describe("the Labo's saved settings (lab-presets.js)", async () => {
  const { isPreset, withPreset } = await import("../../scripts/lib/domain/lab-presets.js");
  const preset = { name: "Miroir", bots: ["engine:ismcts+mirror=1@300", "basique"], seed: 7, note: "" };

  it("keeps a name, two bots, a seed or none, a short note", () => {
    assert.equal(isPreset(preset), true);
    assert.equal(isPreset({ ...preset, seed: null }), true);
    assert.equal(isPreset({ ...preset, bots: ["basique"] }), false);
    assert.equal(isPreset({ ...preset, seed: -1 }), false);
    assert.equal(isPreset({ ...preset, name: "" }), false);
  });

  it("replaces a preset of the same name, the newest first", () => {
    const list = withPreset([{ ...preset, note: "old" }, { ...preset, name: "Autre" }], { ...preset, note: "new" });
    assert.deepEqual(list.map((entry) => [entry.name, entry.note]), [["Miroir", "new"], ["Autre", ""]]);
  });
});

describe("the obsolete pw as its level (engine-id.js)", () => {
  it("files pw=1, 2, 3 under pwl=4, 2, 1, which play the same moves", () => {
    const oracle3 = "ismcts+widen=7+depth=10+core=stfig6+exact=12+pw=1@20000";
    assert.equal(normalizeEngine(oracle3), normalizeEngine(oracle3.replace("pw=1", "pwl=4")));
    assert.equal(normalizeEngine("ismcts+pw=3@400"), "ismcts+pwl=1@400");
    assert.equal(normalizeEngine("ismcts+pw=2+pwl=3@400"), "ismcts+pwl=3@400", "with pwl given, the tree ignores pw");
    assert.equal(normalizeEngine("ismcts+pw=5@400"), "ismcts+pw=5@400", "a k that is no level stays as it is");
  });
});
