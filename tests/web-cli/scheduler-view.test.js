import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { comparePolicies, drawScenario, simulateNight } from "../../src/schedule/night.js";
import { NIGHT_START, PRESETS } from "../../src/schedule/presets.js";
import { comparisonRows, ganttRows, gapText, hhmm, scaleOf, summaryOf } from "../../web/app/scheduler/scheduler-view.js";

const START = Date.parse(NIGHT_START);
const surprises = PRESETS.find((preset) => preset.id === "surprises").jobs;

describe("the Ordonnanceur tab's view (web/app/scheduler/scheduler-view.js, Sami 22/10)", () => {
  it("shares one scale between both orders, a tick an hour from the start", () => {
    const scenario = drawScenario(surprises, 4);
    const nights = [simulateNight(surprises, scenario, { start: START, fifo: true }), simulateNight(surprises, scenario, { start: START })];
    const scale = scaleOf(START, 480, nights);
    assert.equal(scale.ticks[0].label, "22:00");
    assert.equal(scale.ticks[0].left, 0);
    assert.equal(hhmm(scale.morning), "06:00");
    assert.ok(scale.end >= scale.morning);
  });

  it("draws a row per job in the file's order, with its bar, its due mark and why it waits", () => {
    const jobs = [
      { id: "a", estimate: "1 h", status: "todo", due: "2026-10-22T23:00" },
      { id: "b", estimate: "1 h", status: "todo", after: ["nope"] },
    ];
    const night = simulateNight(jobs, { a: { factor: 1, fails: false, failAt: 0.5, mean: null }, b: { factor: 1, fails: false, failAt: 0.5, mean: null } }, { start: START, nightMinutes: 120 });
    const rows = ganttRows(jobs, night, scaleOf(START, 120, [night]));
    assert.deepEqual(rows.map((row) => row.id), ["a", "b"]);
    assert.equal(rows[0].bar.left, 0);
    assert.equal(rows[0].bar.width, 50);
    assert.equal(rows[0].due, 50);
    assert.equal(rows[1].bar, null);
    assert.equal(rows[1].note, "bloqué : prérequis inconnu : nope");
    assert.match(summaryOf(night.metrics, scaleOf(START, 120, [night])), /^1 \/ 2 jobs faits avant 00:00 · poids 2 \/ 4 · 0 échéance manquée sur 1/);
  });

  it("puts the comparison in a table and a sentence", () => {
    const compared = comparePolicies(surprises, { nights: 20, seed: 1, start: START });
    const rows = comparisonRows(compared);
    assert.equal(rows[0].label, "Poids fait avant le matin");
    assert.match(rows[0].fifo, /^\d+,\d$/);
    assert.match(gapText(compared), /^Sur 20 nuits tirées, la règle de Smith fait [+−]\d+,\d de poids avant le matin/);
  });
});
