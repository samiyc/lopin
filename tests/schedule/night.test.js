import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { drawIncidents } from "../../src/schedule/incidents.js";
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

  it("draws the machine's incidents per kind: none on a calm machine, the same from the same seed", () => {
    assert.deepEqual(drawIncidents(5), []);
    const stormy = drawIncidents(5, { heat: 3, update: 1, power: 0 }, 480);
    assert.deepEqual(stormy, drawIncidents(5, { heat: 3, update: 1, power: 0 }, 480));
    assert.ok(stormy.every((one, i) => one.at >= 0 && one.at < 480 && (i === 0 || one.at >= stormy[i - 1].at)));
    const update = stormy.filter((one) => one.kind === "update");
    assert.equal(update.length, 1);
    assert.ok(update[0].down >= 15 && update[0].down <= 40);
    // Another heat rate leaves the update where it was.
    assert.deepEqual(drawIncidents(5, { heat: 0, update: 1, power: 0 }, 480), update);
  });

  it("stops the night at a power cut without auto-resume, the job running lost", () => {
    const jobs = [job("a", "1 h"), job("b", "1 h"), job("c", "10 min", { arrivesAt: 200 })];
    const incidents = [{ kind: "power", at: 30, down: 20 }];
    const night = simulateNight(jobs, scenarioOf(jobs), { start: START, incidents });
    assert.deepEqual(ids(night.steps), ["a:interrupted"]);
    assert.equal(night.steps[0].cause, "power");
    assert.deepEqual(night.stopped, { kind: "power", at: START + 30 * 60_000 });
    assert.deepEqual(night.waiting.map((one) => one.id), ["a", "b", "c"]);
    assert.match(night.waiting[0].reason, /file arrêtée par la coupure de courant, sans reprise automatique/);
    assert.equal(night.metrics.stopped, 1);
    assert.equal(night.metrics.lost, 30);
    assert.equal(night.metrics.down, 20);
  });

  it("plays the lost job again after the restart with auto-resume", () => {
    const jobs = [job("a", "1 h"), job("b", "1 h")];
    const incidents = [{ kind: "update", at: 30, down: 20 }];
    const night = simulateNight(jobs, scenarioOf(jobs), { start: START, incidents, autoResume: true });
    assert.deepEqual(ids(night.steps), ["a:interrupted", "a:done", "b:done"]);
    assert.equal(night.steps[1].start, START + 50 * 60_000);
    assert.equal(night.metrics.restarts, 1);
    assert.equal(night.metrics.stopped, 0);
    assert.equal(night.metrics.end, START + 170 * 60_000);
  });

  it("ignores a heat alert while idle, and lets the CPU cool then goes on by itself after one during a job", () => {
    const jobs = [job("a", "30 min", { arrivesAt: 60 })];
    const incidents = [
      { kind: "heat", at: 10, down: 10 },
      { kind: "heat", at: 70, down: 10 },
    ];
    const night = simulateNight(jobs, scenarioOf(jobs), { start: START, incidents });
    assert.deepEqual(ids(night.steps), ["a:interrupted", "a:done"]);
    assert.deepEqual(night.downs.map((one) => [one.kind, (one.start - START) / 60_000]), [["heat", 70]]);
    assert.equal(night.steps[1].start, START + 80 * 60_000);
    assert.equal(night.metrics.idle, 60);
  });

  it("with preempt, a job come during the night interrupts the one running to keep its due", () => {
    const jobs = [job("long", "1 h 30", { priority: 3 }), job("fix", "20 min", { priority: 1, arrivesAt: 30, due: "2026-10-22T23:00" })];
    const patient = simulateNight(jobs, scenarioOf(jobs), { start: START });
    assert.deepEqual(ids(patient.steps), ["long:done", "fix:done"]);
    assert.equal(patient.metrics.late, 1);
    const hurried = simulateNight(jobs, scenarioOf(jobs), { start: START, preempt: true });
    assert.deepEqual(ids(hurried.steps), ["long:interrupted", "fix:done", "long:done"]);
    assert.equal(hurried.steps[0].by, "fix");
    assert.equal(hurried.metrics.late, 0);
    assert.equal(hurried.metrics.lost, 30);
    // Without a due, or able to wait, it never interrupts.
    assert.deepEqual(ids(simulateNight([jobs[0], { ...jobs[1], due: undefined }], scenarioOf(jobs), { start: START, preempt: true }).steps), ["long:done", "fix:done"]);
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
