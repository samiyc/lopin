import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { comparePolicies, drawScenario, metricsOf, outcomeOf, simulateNight } from "../../src/schedule/night.js";
import { NIGHT_START, PRESETS } from "../../src/schedule/presets.js";

const START = Date.parse(NIGHT_START);
const job = (id, estimate, extra = {}) => ({ id, command: id, estimate, status: "todo", ...extra });
const plain = (mean = null) => ({ factor: 1, fails: false, failAt: 0.5, mean });
const scenarioOf = (jobs, overrides = {}) => Object.fromEntries(jobs.map((one) => [one.id, { ...plain(), ...overrides[one.id] }]));
const ids = (steps) => steps.map((step) => `${step.id}:${step.status}`);

describe("a simulated night of the backlog (src/schedule/night.js, Sami 22/10)", () => {
  it("draws the same night from the same seed, another from another", () => {
    const jobs = PRESETS[0].jobs;
    assert.deepEqual(drawScenario(jobs, 7), drawScenario(jobs, 7));
    assert.notDeepEqual(drawScenario(jobs, 7), drawScenario(jobs, 8));
    assert.equal(drawScenario([job("x", "1 min")], 1).x.mean, null);
  });

  it("ends a job done, failed partway, or stopped at its limit", () => {
    assert.deepEqual(outcomeOf(job("a", "40 min"), plain()), { minutes: 40, status: "done" });
    assert.deepEqual(outcomeOf(job("a", "40 min"), { ...plain(), fails: true }), { minutes: 20, status: "failed" });
    assert.deepEqual(outcomeOf(job("a", "2 h", { limit: 100 }), plain()), { minutes: 100, status: "timeout" });
  });

  it("skips a duel its stopIf stops, then runs the analysis on what was played", () => {
    const jobs = [
      job("d1", "40 min", { version: "v" }),
      job("d2", "40 min", { version: "v", stopIf: [{ after: ["d1"], below: 0.47 }] }),
      job("versus", "1 min", { after: ["d1", "d2"] }),
    ];
    const night = simulateNight(jobs, scenarioOf(jobs, { d1: { mean: 0.45 } }), { start: START });
    assert.deepEqual(ids(night.steps), ["d1:done", "d2:skipped", "versus:done"]);
    assert.match(night.steps[1].reason, /45\.0 % réunis, sous 47 %/);
  });

  it("waits for a job still to come and for a notBefore, and leaves a job whose prerequisite failed", () => {
    const jobs = [
      job("first", "30 min"),
      job("late", "10 min", { arrivesAt: 60 }),
      job("night", "10 min", { status: "scheduled", notBefore: "2026-10-23T00:00" }),
      job("fragile", "10 min"),
      job("reader", "5 min", { after: ["fragile"] }),
    ];
    const night = simulateNight(jobs, scenarioOf(jobs, { fragile: { fails: true } }), { start: START });
    assert.deepEqual(ids(night.steps), ["fragile:failed", "first:done", "late:done", "night:done"]);
    assert.equal(night.metrics.idle, 25 + 50);
    assert.deepEqual(night.waiting, [{ id: "reader", blocked: true, reason: "fragile : failed" }]);
  });

  it("counts the weight done by morning and the due times missed", () => {
    const jobs = [job("a", "1 min", { priority: 1, due: "2026-10-22T23:00" }), job("b", "1 min"), job("c", "1 min", { priority: 3 })];
    const steps = [
      { id: "a", start: START, end: START + 90 * 60_000, status: "done" },
      { id: "b", start: START, end: START + 100 * 60_000, status: "done" },
      { id: "c", start: START, end: START + 600 * 60_000, status: "done" },
    ];
    const metrics = metricsOf(jobs, steps, { start: START, nightMinutes: 480 });
    assert.equal(metrics.value, 6);
    assert.equal(metrics.maxValue, 7);
    assert.equal(metrics.late, 1);
    assert.equal(metrics.overrun, 120);
  });

  it("keeps the evening's due times better with Smith's rule than with the file order", () => {
    const deadlines = PRESETS.find((preset) => preset.id === "deadlines").jobs;
    const compared = comparePolicies(deadlines, { nights: 60, seed: 3, start: START });
    assert.ok(compared.smith.late < compared.fifo.late, `${compared.smith.late} contre ${compared.fifo.late}`);
    assert.equal(compared.wins + compared.ties + compared.losses, 60);
  });

  it("ships example queues whose prerequisites all exist", () => {
    for (const preset of PRESETS) {
      const known = new Set(preset.jobs.map((one) => one.id));
      assert.equal(known.size, preset.jobs.length, preset.id);
      const named = preset.jobs.flatMap((one) => [...(one.after ?? []), ...(one.stopIf ?? []).flatMap((condition) => condition.after)]);
      assert.deepEqual(named.filter((id) => !known.has(id)), [], preset.id);
    }
  });
});
