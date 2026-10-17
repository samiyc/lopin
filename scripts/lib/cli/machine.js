import { execFile } from "node:child_process";
import os from "node:os";

/**
 * What the machine says about itself between two jobs (Sami, 04/10: let the
 * CPU breathe and keep an eye on its temperature): the CPU load over a few
 * seconds, and the hottest temperature a sensor reports, if any can be read.
 *
 * Windows gives no CPU temperature without help: the ACPI zones are refused
 * on this board and the performance counters list none. LibreHardwareMonitor
 * (or OpenHardwareMonitor), once running, publishes its sensors over WMI —
 * then they are read here with nothing else to change.
 */
const SOURCES = [
  "Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor -ErrorAction Stop | Where-Object { $_.SensorType -eq 'Temperature' } | ForEach-Object { $_.Value }",
  "Get-CimInstance -Namespace root/OpenHardwareMonitor -ClassName Sensor -ErrorAction Stop | Where-Object { $_.SensorType -eq 'Temperature' } | ForEach-Object { $_.Value }",
  "Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | ForEach-Object { $_.CurrentTemperature / 10 - 273.15 }",
];

const run = (command) =>
  new Promise((resolve) => {
    // PowerShell is the system's own shell on Windows, as git is a developer tool for changelog.js.
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    execFile("powershell", ["-NoProfile", "-Command", command], { timeout: 20_000, windowsHide: true }, (error, stdout) => resolve(error ? "" : stdout));
  });

/** The hottest sensor in °C, and where it was read; `null` when nothing answers. */
export async function hottest() {
  if (process.platform !== "win32") return null;
  for (const source of SOURCES) {
    const values = (await run(source))
      .split(/\r?\n/)
      .map((line) => Number(line.replace(",", ".")))
      .filter((value) => Number.isFinite(value) && value > 0 && value < 125);
    if (values.length > 0) return { celsius: Math.max(...values), source: source.split(" ")[2] };
  }
  return null;
}

/** The share of the CPU in use over `ms`, every core together. */
export async function cpuLoad(ms = 3000) {
  const sample = () => os.cpus().reduce((sum, cpu) => ({ busy: sum.busy + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq, total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0) }), { busy: 0, total: 0 });
  const before = sample();
  await new Promise((resolve) => setTimeout(resolve, ms));
  const after = sample();
  return (after.busy - before.busy) / Math.max(1, after.total - before.total);
}
