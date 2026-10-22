/**
 * The CPU's temperature (Sami, 04/10 then 22/10: a heat alert is one more thing that can stop the night's
 * queue). Windows gives none without help: LibreHardwareMonitor (C:\Outils\LibreHardwareMonitor, run as
 * administrator, Options → Remote Web Server → Run) serves its sensors at http://127.0.0.1:8085/data.json.
 * Its 0.9.6 no longer publishes them over WMI, which the first version of this module read.
 *
 * One sensor only, the CPU die's (`Core (Tctl/Tdie)` on a Ryzen, `CPU Package` on an Intel): the board's
 * free inputs report nonsense (AUX 2 at 109 °C on this one) and the SSD lists its thresholds as
 * temperatures, so the hottest of all would always alarm.
 *
 * The heat guard (docs/ismcts-ailleurs/backlog.md § 9.8): `alert` °C read `holds` times in a row stops the
 * job running; the queue goes on once the CPU is back under `resume` °C. The Ryzen 9 3900X throttles itself
 * at 95 °C (its Tjmax). `LOPIN_HEAT_ALERT` (0: no guard), `LOPIN_HEAT_RESUME`, `LOPIN_HEAT_EVERY` (seconds
 * between readings) and `LOPIN_SENSORS_URL` change them.
 */
export const SENSORS_URL = "http://127.0.0.1:8085/data.json";
const CPU_SENSOR = /^\/(?:amd|intel)cpu\/\d+\/temperature\//;
const PREFERRED = ["Core (Tctl/Tdie)", "CPU Package", "Core (Tctl)", "Core (Tdie)"];

/** The guard's settings, from the environment: alert and resume in °C, a reading every `everyMs`, `holds` in a row. */
export function heatSettings(env = process.env) {
  const number = (name, fallback) => (env[name] === undefined || env[name] === "" ? fallback : Number(env[name]));
  return {
    alert: number("LOPIN_HEAT_ALERT", 90),
    resume: number("LOPIN_HEAT_RESUME", 75),
    everyMs: number("LOPIN_HEAT_EVERY", 30) * 1000,
    holds: 2,
    url: env.LOPIN_SENSORS_URL || SENSORS_URL,
  };
}

/** "77,9 °C" (the server writes the locale's decimal comma) → 77.9; NaN when it is no number. */
const celsiusOf = (text) => Number(String(text).replace(",", ".").replace(/[^\d.-]/g, "") || Number.NaN);

/** Every CPU temperature sensor of LibreHardwareMonitor's tree. */
function cpuSensors(node, found = []) {
  if (node.Type === "Temperature" && CPU_SENSOR.test(node.SensorId ?? "")) found.push(node);
  for (const child of node.Children ?? []) cpuSensors(child, found);
  return found;
}

/** The CPU die's temperature in LibreHardwareMonitor's data.json: `{ celsius, sensor }`, or null if it has none. */
export function cpuTemperatureOf(data) {
  const sensors = cpuSensors(data).filter((sensor) => Number.isFinite(celsiusOf(sensor.Value)));
  const sensor = PREFERRED.map((name) => sensors.find((one) => one.Text === name)).find(Boolean) ?? sensors[0];
  return sensor ? { celsius: celsiusOf(sensor.Value), sensor: sensor.Text } : null;
}

/** Reads the CPU's temperature from the sensors' server; null when nothing answers within `timeoutMs`. */
export async function readCpuTemperature({ url = heatSettings().url, timeoutMs = 3000 } = {}) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok ? cpuTemperatureOf(await response.json()) : null;
  } catch {
    return null;
  }
}

/** The guard's verdict on each reading: true once `alert` has been reached `holds` readings in a row. */
export function createHeatGuard({ alert, holds }) {
  let hot = 0;
  return {
    observe(celsius) {
      if (!Number.isFinite(alert) || alert <= 0 || celsius === null) return false;
      hot = celsius >= alert ? hot + 1 : 0;
      return hot >= holds;
    },
  };
}

const round = (value) => Math.round(value * 10) / 10;

/**
 * Reads the CPU's temperature every `everyMs` while a job runs; `onAlert(celsius)` once if the guard fires.
 * `stop()` returns what the job log keeps: the temperature at the start and at its highest, if readable.
 */
export function watchHeat({ settings = heatSettings(), onAlert = () => {}, read = () => readCpuTemperature(settings) } = {}) {
  const guard = createHeatGuard(settings);
  const seen = [];
  let fired = false;
  const sample = async () => {
    const reading = await read();
    if (!reading) return;
    seen.push(reading.celsius);
    if (!fired && guard.observe(reading.celsius)) {
      fired = true;
      onAlert(reading.celsius);
    }
  };
  sample();
  const timer = setInterval(sample, settings.everyMs);
  return {
    stop() {
      clearInterval(timer);
      return seen.length ? { cpuStartC: round(seen[0]), cpuMaxC: round(Math.max(...seen)) } : {};
    },
  };
}

const isCool = (reading, { resume }) => reading !== null && reading.celsius < resume;

/** Waits until the CPU is back under `resume` °C (reading every `everyMs`), at most `maxMinutes`; resolves with the last reading. */
export async function waitUntilCool({ settings = heatSettings(), maxMinutes = 30, read = () => readCpuTemperature(settings) } = {}) {
  const end = Date.now() + maxMinutes * 60_000;
  let reading = await read();
  while (!isCool(reading, settings) && Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, settings.everyMs));
    reading = await read();
  }
  return reading;
}
