import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cpuTemperatureOf, createHeatGuard, heatSettings, waitUntilCool, watchHeat } from "../../scripts/lib/cli/machine.js";
import { runCommand } from "../../scripts/lib/cli/run-command.js";

/** A trimmed LibreHardwareMonitor data.json, as this machine served it on 22/10. */
const sensor = (Text, Value, SensorId) => ({ Text, Value, SensorId, Type: "Temperature" });
const TREE = {
  Text: "Sensor",
  Children: [
    {
      Text: "DESKTOP",
      Children: [
        { Text: "ASUS ROG CROSSHAIR VIII HERO", Children: [{ Text: "Temperatures", Children: [sensor("CPU", "50,0 °C", "/lpc/nct6798d/0/temperature/1"), sensor("AUX 2", "109,0 °C", "/lpc/nct6798d/0/temperature/5")] }] },
        { Text: "AMD Ryzen 9 3900X", Children: [{ Text: "Temperatures", Children: [sensor("CCD1 (Tdie)", "73,8 °C", "/amdcpu/0/temperature/3"), sensor("Core (Tctl/Tdie)", "77,9 °C", "/amdcpu/0/temperature/2")] }] },
        { Text: "Samsung SSD 970 EVO Plus 1TB", Children: [{ Text: "Temperatures", Children: [sensor("Critical Temperature", "84,0 °C", "/nvme/0/temperature/11")] }] },
      ],
    },
  ],
};
const quick = { ...heatSettings({}), everyMs: 5 };
const readings = (values) => {
  const left = [...values];
  return async () => (left.length ? { celsius: left.shift(), sensor: "test" } : null);
};

describe("the CPU's temperature and the heat guard (scripts/lib/cli/machine.js, Sami 22/10)", () => {
  it("reads the CPU die's own sensor, never the board's free inputs nor the SSD's thresholds", () => {
    assert.deepEqual(cpuTemperatureOf(TREE), { celsius: 77.9, sensor: "Core (Tctl/Tdie)" });
    assert.equal(cpuTemperatureOf({ Text: "Sensor", Children: [TREE.Children[0].Children[0]] }), null);
  });

  it("alerts at 90 °C read twice in a row, resumes under 75 °C, and can be switched off", () => {
    assert.deepEqual(heatSettings({}), { alert: 90, resume: 75, everyMs: 30_000, holds: 2, url: "http://127.0.0.1:8085/data.json" });
    assert.equal(heatSettings({ LOPIN_HEAT_ALERT: "0" }).alert, 0);
    const guard = createHeatGuard(heatSettings({}));
    assert.deepEqual([91, 88, 92, null, 93].map((celsius) => guard.observe(celsius)), [false, false, false, false, true]);
    const off = createHeatGuard({ alert: 0, holds: 1 });
    assert.equal(off.observe(120), false);
  });

  it("fires once while a job runs and keeps the start and the highest reading for the job log", async () => {
    const alerts = [];
    const watch = watchHeat({ settings: quick, read: readings([80, 91, 92, 95, 70]), onAlert: (celsius) => alerts.push(celsius) });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.deepEqual(alerts, [92]);
    assert.deepEqual(watch.stop(), { cpuStartC: 80, cpuMaxC: 95 });
    assert.deepEqual(watchHeat({ settings: quick, read: readings([]) }).stop(), {});
  });

  it("waits for the CPU to come back under the resume value", async () => {
    assert.deepEqual(await waitUntilCool({ settings: quick, read: readings([92, 80, 74, 60]) }), { celsius: 74, sensor: "test" });
  });

  it("stops a running command on the guard's signal", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "lopin-run-"));
    try {
      const guard = new AbortController();
      setTimeout(() => guard.abort("garde thermique, CPU à 92 °C"), 300);
      const started = Date.now();
      const code = await runCommand('node -e "setTimeout(() => {}, 60000)"', { outFile: path.join(folder, "out.txt"), quiet: true, signal: guard.signal });
      assert.equal(code, "aborted");
      assert.ok(Date.now() - started < 20_000);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
