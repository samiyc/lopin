import { stopIfFor } from "./stop.js";

/**
 * Example queues for the Ordonnanceur tab (Sami, 22/10), in data/backlog.json's format plus what only the
 * simulator reads: `version` (a duel of that version: its score is drawn, its series' `stopIf` apply),
 * `arrivesAt` (minutes after the start: a job added during the night), `failRate` (this job's own chance
 * to fail). Lengths and series come from October's backlog (docs/ismcts-ailleurs/backlog.md § 2).
 */
export const NIGHT_START = "2026-10-22T22:00";
const at = (time) => `2026-10-2${time < "12:00" ? 3 : 2}T${time}`;

/** The four long duels of a 1k@2k series, each after the one before through its `stopIf`. */
function series(version, estimate) {
  const ids = [1, 2, 3, 4].map((n) => `VALIDATE_LONG_${n}_${version}`);
  return ids.map((id, i) => ({ id, command: `npm run duel -- … --offset ${i}`, estimate, version, status: "todo", stopIf: stopIfFor(ids, i + 1) }));
}

const versus = (version, extra = {}) => ({
  id: `VERSUS_${version}`,
  command: `npm run versus -- … --label ${version}`,
  estimate: "1 min",
  priority: 1,
  status: "todo",
  after: [1, 2, 3, 4].map((n) => `VALIDATE_LONG_${n}_${version}`),
  ...extra,
});

const job = (id, estimate, extra = {}) => ({ id, command: extra.command ?? `npm run ${id.toLowerCase()}`, estimate, status: "todo", ...extra });

export const PRESETS = Object.freeze([
  {
    id: "validation",
    label: "Une nuit de validation",
    note: "Trois versions à valider en 1k@2k, leurs analyses, le changelog pour le réveil, une mesure longue et une lecture de l'oracle : un peu plus de travail que la nuit n'en contient.",
    jobs: [
      job("ENDGAME_MOVES", "1 h 45", { priority: 3, command: "node scripts/archive/endgame-moves.js" }),
      job("ORACLE_READ", "1 h 30", { command: "npm run oracle -- --read …" }),
      ...series("JokerWin", "40 min"),
      ...series("TheirPairJoker", "25 min"),
      ...series("JokerWinHand6", "40 min"),
      versus("JokerWin"),
      versus("TheirPairJoker"),
      versus("JokerWinHand6"),
      job("CHANGELOG_1.3", "2 min", { priority: 1, after: ["VERSUS_JokerWin", "VERSUS_TheirPairJoker", "VERSUS_JokerWinHand6"], due: at("07:00"), command: "npm run changelog -- 1.3" }),
    ],
  },
  {
    id: "deadlines",
    label: "Une soirée avec échéances",
    note: "Un rapport attendu avant 23 h, un banc à lire à 2 h, une lecture pour le réveil, et de longs jobs qui peuvent attendre : l'ordre du fichier les met en travers.",
    jobs: [
      job("PUZZLES", "45 min", { priority: 3, command: "npm run puzzles -- --add 20" }),
      job("SELFPLAY", "2 h", { priority: 3, command: "npm run selfplay" }),
      ...series("FinalLcb1", "30 min"),
      job("BENCH", "1 h", { due: at("02:00"), command: "npm run bench" }),
      job("REPORT", "30 min", { priority: 1, due: at("23:00"), command: "npm run build" }),
      versus("FinalLcb1", { due: at("07:00") }),
    ],
  },
  {
    id: "surprises",
    label: "Des imprévus en série",
    note: "Un job urgent arrive à 1 h, un job fragile qui échoue souvent bloque son analyse, un autre déborde parfois de sa limite, et un dernier ne part pas avant 4 h.",
    jobs: [
      job("LONG_MEASURE", "1 h 30", { priority: 3, limit: 100, command: "node scripts/archive/thread-bench.js" }),
      job("FLAKY", "1 h", { failRate: 0.35, command: "npm run oracle -- --bench …" }),
      job("FLAKY_READ", "10 min", { priority: 1, after: ["FLAKY"], command: "npm run oracle -- --summary" }),
      ...series("ReplyFpu", "35 min"),
      versus("ReplyFpu"),
      job("NIGHT_ONLY", "40 min", { status: "scheduled", notBefore: at("04:00"), command: "npm run deals -- …" }),
      job("URGENT", "20 min", { priority: 1, arrivesAt: 180, due: at("02:00"), command: "npm run duel -- … --games 50" }),
    ],
  },
]);
