import { CAUSE_LABELS } from "../../../src/schedule/incidents.js";
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

export const STATUS_LABELS = Object.freeze({ done: "fait", skipped: "annulé par son stopIf", failed: "en échec", timeout: "arrêté à sa limite", interrupted: "interrompu, travail perdu" });
export const PRIORITY_LABELS = Object.freeze({ 1: "urgent", 2: "normal", 3: "peut attendre" });

/** The scale the charts share: from the start to the later of the morning and the last end, a tick an hour. */
export function scaleOf(start, nightMinutes, nights) {
  const morning = start + nightMinutes * MINUTE;
  const end = Math.max(morning, ...nights.flatMap((night) => [...night.steps, ...(night.downs ?? [])].map((span) => span.end)));
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

/** Why a bar ended early or late, in words: what interrupted it, or its missed due. */
function afterwordOf(step) {
  if (step.status === "interrupted") return step.by ? `, pour laisser passer ${step.by}` : ` (${CAUSE_LABELS[step.cause]})`;
  return step.late ? ", après son échéance" : "";
}

/** One bar of a row: a job's run, or the part of it an incident or an urgent job cut short. */
function barOf(id, step, scale) {
  return {
    left: scale.at(step.start),
    width: Math.max(scale.at(step.end) - scale.at(step.start), 0.4),
    status: step.status,
    late: Boolean(step.late),
    title: `${id} : ${hhmm(step.start)} → ${hhmm(step.end)}, ${STATUS_LABELS[step.status]}${afterwordOf(step)}`,
  };
}

/**
 * One chart row per job, in the file's order: its bars (a job cut short has one per run), its due time's mark,
 * the mark of its arrival (a job added during the night), its note.
 */
export function ganttRows(jobs, night, scale) {
  return jobs.map((job) => {
    const steps = night.steps.filter((one) => one.id === job.id);
    return {
      id: job.id,
      priority: job.priority ?? 2,
      bars: steps.map((step) => barOf(job.id, step, scale)),
      due: job.due ? Math.min(scale.at(Date.parse(job.due)), 100) : null,
      arrival: job.arrivesAt ? scale.at(scale.start + job.arrivesAt * MINUTE) : null,
      note: noteOf(job, steps.at(-1), night.waiting),
    };
  });
}

/** The times the machine was down, as bands across the chart: what stopped it, from when to when. */
export function downBands(night, scale) {
  return (night.downs ?? []).map((down) => ({
    left: scale.at(down.start),
    width: Math.max(scale.at(down.end) - scale.at(down.start), 0.4),
    kind: down.kind,
    title: `${CAUSE_LABELS[down.kind]} : ${hhmm(down.start)} → ${hhmm(down.end)}${down.kind === "heat" ? ", le CPU refroidit" : ", la machine redémarre"}`,
  }));
}

/** What the incidents cost a night, in words: jobs cut short, work lost, machine down, queue stopped. */
function incidentParts(metrics) {
  const halt = metrics.halt;
  return [
    metrics.restarts ? `${plural(metrics.restarts, "job interrompu")}, ${Math.round(metrics.lost)} min de calcul perdu` : "",
    metrics.down ? `machine arrêtée ${Math.round(metrics.down)} min` : "",
    halt ? `file arrêtée à ${hhmm(halt.at)} par la ${CAUSE_LABELS[halt.kind]}, jamais relancée` : "",
  ];
}

/** A night in one line: done by morning, weight, due times, skips, failures, overrun, waiting and incidents. */
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
    ...incidentParts(metrics),
  ];
  return parts.filter(Boolean).join(" · ");
}

/** The comparison's measures; `incident` ones are shown only when an incident happened. `factor` 100: a share in %. */
const MEASURES = [
  { key: "value", label: "Poids fait avant le matin", digits: 1 },
  { key: "done", label: "Jobs faits avant le matin", digits: 1 },
  { key: "late", label: "Échéances manquées", digits: 2 },
  { key: "skipped", label: "Duels annulés par un stopIf", digits: 1 },
  { key: "failed", label: "Jobs en échec", digits: 2 },
  { key: "overrun", label: "Minutes après le matin", digits: 0 },
  { key: "idle", label: "Minutes d'attente", digits: 0 },
  { key: "restarts", label: "Jobs interrompus", digits: 2, incident: true },
  { key: "lost", label: "Minutes de calcul perdues", digits: 0, incident: true },
  { key: "down", label: "Minutes machine arrêtée", digits: 0, incident: true },
  { key: "stopped", label: "Nuits où la file reste arrêtée (%)", digits: 0, incident: true, factor: 100 },
];

/** The comparison's table: each measure's mean over the nights, file order against Smith's rule. */
export function comparisonRows(compared) {
  const shown = MEASURES.filter(({ key, incident }) => !incident || compared.fifo[key] > 0 || compared.smith[key] > 0);
  return shown.map(({ key, label, digits, factor = 1 }) => ({ label, fifo: decimal(compared.fifo[key] * factor, digits), smith: decimal(compared.smith[key] * factor, digits) }));
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
