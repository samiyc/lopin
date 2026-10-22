import { weightOf } from "../../../src/schedule/order.js";

/**
 * What the Ordonnanceur tab shows (Sami, 22/10), pure and tested under Node: the shared time scale, one
 * chart row per job, a night's summary and the comparison of the two orders. The DOM layer
 * (scheduler-tab.js) only draws it.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const pad = (n) => String(n).padStart(2, "0");
export const hhmm = (ms) => `${pad(new Date(ms).getHours())}:${pad(new Date(ms).getMinutes())}`;
const decimal = (value, digits = 1) => value.toFixed(digits).replace(".", ",");
/** "1 duel annulé", "3 duels annulés": every word of `words` takes the plural. */
const plural = (count, words) => `${count} ${words.split(" ").map((word) => word + (count > 1 ? "s" : "")).join(" ")}`;

export const STATUS_LABELS = Object.freeze({ done: "fait", skipped: "annulé par son stopIf", failed: "en échec", timeout: "arrêté à sa limite" });
export const PRIORITY_LABELS = Object.freeze({ 1: "urgent", 2: "normal", 3: "peut attendre" });

/** The scale the charts share: from the start to the later of the morning and the last end, a tick an hour. */
export function scaleOf(start, nightMinutes, nights) {
  const morning = start + nightMinutes * MINUTE;
  const end = Math.max(morning, ...nights.flatMap((night) => night.steps.map((step) => step.end)));
  const at = (time) => (100 * (time - start)) / (end - start);
  const ticks = [];
  for (let time = start; time <= end; time += HOUR) ticks.push({ left: at(time), label: hhmm(time) });
  return { start, end, morning, at, ticks };
}

/** What a row says beside its bar: why the job was skipped, why it still waits, or when it arrived. */
function noteOf(job, step, waiting) {
  if (step?.reason) return step.reason;
  const hold = waiting.find((one) => one.id === job.id);
  if (hold) return `${hold.blocked ? "bloqué" : "attend"} : ${hold.reason}`;
  return job.arrivesAt ? `arrivé ${job.arrivesAt} min après le début` : "";
}

/** One chart row per job, in the file's order: its bar (or none), its due time's mark, its note. */
export function ganttRows(jobs, night, scale) {
  return jobs.map((job) => {
    const step = night.steps.find((one) => one.id === job.id);
    const bar = step && {
      left: scale.at(step.start),
      width: Math.max(scale.at(step.end) - scale.at(step.start), 0.4),
      status: step.status,
      late: Boolean(step.late),
      title: `${job.id} : ${hhmm(step.start)} → ${hhmm(step.end)}, ${STATUS_LABELS[step.status]}${step.late ? ", après son échéance" : ""}`,
    };
    return {
      id: job.id,
      priority: job.priority ?? 2,
      bar: bar ?? null,
      due: job.due ? Math.min(scale.at(Date.parse(job.due)), 100) : null,
      note: noteOf(job, step, night.waiting),
    };
  });
}

/** A night in one line: done by morning, weight, due times, skips, failures, overrun and waiting. */
export function summaryOf(metrics, scale) {
  const s = metrics.late > 1 ? "s" : "";
  const parts = [
    `${metrics.done} / ${metrics.jobs} jobs faits avant ${hhmm(scale.morning)}`,
    `poids ${metrics.value} / ${metrics.maxValue}`,
    metrics.withDue ? `${metrics.late} échéance${s} manquée${s} sur ${metrics.withDue}` : "",
    metrics.skipped ? plural(metrics.skipped, "duel annulé") : "",
    metrics.failed ? `${metrics.failed} en échec` : "",
    metrics.overrun ? `${Math.round(metrics.overrun)} min après le matin` : "",
    metrics.idle ? `${Math.round(metrics.idle)} min d'attente` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

const MEASURES = [
  ["value", "Poids fait avant le matin", 1],
  ["done", "Jobs faits avant le matin", 1],
  ["late", "Échéances manquées", 2],
  ["skipped", "Duels annulés par un stopIf", 1],
  ["failed", "Jobs en échec", 2],
  ["overrun", "Minutes après le matin", 0],
  ["idle", "Minutes d'attente", 0],
];

/** The comparison's table: each measure's mean over the nights, file order against Smith's rule. */
export function comparisonRows(compared) {
  return MEASURES.map(([key, label, digits]) => ({ label, fifo: decimal(compared.fifo[key], digits), smith: decimal(compared.smith[key], digits) }));
}

/**
 * The comparison in words: the paired gap of weight, its interval, the nights won, tied and lost; then the
 * due times missed, where the order shows even when all the work fits in the night (backlog.md § 5).
 */
export function gapText(compared) {
  const { mean, low, high } = compared.gap;
  const sign = mean >= 0 ? "+" : "−";
  const weight =
    `Sur ${compared.nights} nuits tirées, la règle de Smith fait ${sign}${decimal(Math.abs(mean))} de poids avant le matin ` +
    `(de ${decimal(low)} à ${decimal(high)}, sur ${compared.maxValue}) ; elle gagne ${plural(compared.wins, "nuit")}, fait jeu égal sur ${compared.ties}, en perd ${compared.losses}.`;
  const { fifo, smith } = compared;
  if (fifo.late === 0 && smith.late === 0) return weight;
  return `${weight} Échéances manquées par nuit : ${decimal(fifo.late, 2)} dans l'ordre du fichier, ${decimal(smith.late, 2)} avec la règle de Smith.`;
}

/** A job's weight in words, for the row's label. */
export const weightLabel = (job) => `${PRIORITY_LABELS[job.priority ?? 2]}, poids ${weightOf(job)}`;
