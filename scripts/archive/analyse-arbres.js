import { readFile, writeFile } from "node:fs/promises";
import { runPool, workerCount } from "../lib/cli/pool.js";
import { tmpFile } from "../lib/domain/tmp.js";

const DUEL_FILE = new URL("../../duels/2026-10-10-16-59-01_borne@1.0_vs_experimental@1.2.json", import.meta.url);
const WORKER_URL = new URL("../lib/workers/tree-worker.js", import.meta.url);
const RESULTS_FILE = tmpFile("arbre-analysis-results.json");

const ENGINES = [
  { key: "w5_d0", label: "widen=5, diverse=0", id: "ismcts+widen=5+depth=5+core=stfig6@2000", budget: 2000 },
  { key: "w5_d2", label: "widen=5, diverse=2 (Borné)", id: "ismcts+widen=5+depth=5+core=stfig6+diverse=2@2000", budget: 2000 },
  { key: "w7_d0", label: "widen=7, diverse=0 (Exp 1.2)", id: "ismcts+widen=7+depth=5+core=stfig6@2000", budget: 2000 },
  { key: "w7_d2", label: "widen=7, diverse=2", id: "ismcts+widen=7+depth=5+core=stfig6+diverse=2@2000", budget: 2000 },
  { key: "oracle", label: "Oracle @20k (w6)", id: "ismcts+candidates=99+widen=6+depth=5+smart=1@20000", budget: 20000 },
];

const ALL_TURNS = [1, 2, 3, 4, 10, 11, 12, 13];
const GAMES_COUNT = 5;

function createTasks(sampleGames) {
  const tasks = [];
  sampleGames.forEach((gameLog, gameIndex) => {
    for (const turn of ALL_TURNS) {
      for (const eng of ENGINES) {
        tasks.push({
          gameIndex,
          turn,
          gameLog,
          engineId: eng.id,
          engineKey: eng.key,
          budget: eng.budget,
          seed: 20261010 + gameIndex * 10007 + turn * 103 + eng.key.length,
        });
      }
    }
  });
  return tasks;
}

function groupResultsByPosition(results, tasks) {
  const byPosition = new Map();
  results.forEach((res, index) => {
    if (!res.ok) return;
    const task = tasks[index];
    const posKey = `g${task.gameIndex}_t${task.turn}`;
    if (!byPosition.has(posKey)) {
      byPosition.set(posKey, {
        gameIndex: task.gameIndex,
        turn: task.turn,
        phase: task.turn <= 4 ? "early" : "mid",
        engines: {},
      });
    }
    byPosition.get(posKey).engines[task.engineKey] = res.metrics;
  });
  return byPosition;
}

function compareToOracle(metrics, oracleMetrics) {
  const oracleBest = oracleMetrics.bestMove;
  metrics.agreesWithOracle = Boolean(metrics.bestMove && metrics.bestMove === oracleBest);
  const index = oracleMetrics.candidates.findIndex((c) => c.key === metrics.bestMove);
  metrics.oracleRank = index >= 0 ? index + 1 : 99;
  metrics.oracleInTop8 = metrics.candidates.some((c) => c.key === oracleBest);
}

function enrichWithOracle(byPosition) {
  for (const pos of byPosition.values()) {
    const oracleMetrics = pos.engines.oracle;
    if (!oracleMetrics) continue;
    for (const [key, metrics] of Object.entries(pos.engines)) {
      if (key !== "oracle") compareToOracle(metrics, oracleMetrics);
    }
  }
}

function mean(arr) {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function computeStats(list) {
  if (list.length === 0) return {};
  return {
    count: list.length,
    distinctCardsAtRoot: mean(list.map((m) => new Set(m.candidates.map((c) => c.key.split("@")[0])).size)),
    bestMoveVisits: mean(list.map((m) => m.bestMoveVisits)),
    runnerUpVisits: mean(list.map((m) => m.runnerUpVisits)),
    l1MaxVisits: mean(list.map((m) => m.l1MaxVisits)),
    l1MedianVisits: mean(list.map((m) => m.l1MedianVisits)),
    l1SingletonPct: mean(list.map((m) => m.l1SingletonPct)),
    totalSingletonPct: mean(list.map((m) => m.totalSingletonPct)),
    nodesAtDepth1: mean(list.map((m) => m.depthCounts[1] ?? 0)),
    nodesAtDepth2: mean(list.map((m) => m.depthCounts[2] ?? 0)),
    nodesAtDepth3: mean(list.map((m) => m.depthCounts[3] ?? 0)),
    nodesAtDepth4: mean(list.map((m) => m.depthCounts[4] ?? 0)),
    nodesAtDepth5: mean(list.map((m) => m.depthCounts[5] ?? 0)),
    maxDepth: mean(list.map((m) => m.maxDepth)),
    oracleAgreement: mean(list.map((m) => (m.agreesWithOracle ? 1 : 0))) * 100,
    oracleRank: mean(list.map((m) => m.oracleRank ?? 99)),
    oracleInTop8: mean(list.map((m) => (m.oracleInTop8 ? 1 : 0))) * 100,
  };
}

function filterMetrics(byPosition, engineKey, phase) {
  const list = [];
  for (const pos of byPosition.values()) {
    if (phase !== "all" && pos.phase !== phase) continue;
    if (pos.engines[engineKey]) list.push(pos.engines[engineKey]);
  }
  return list;
}

function buildSummary(byPosition) {
  const summary = {};
  ENGINES.forEach((eng) => {
    summary[eng.key] = {
      label: eng.label,
      all: computeStats(filterMetrics(byPosition, eng.key, "all")),
      early: computeStats(filterMetrics(byPosition, eng.key, "early")),
      mid: computeStats(filterMetrics(byPosition, eng.key, "mid")),
    };
  });
  return summary;
}

function printTable(summary, title, header, rowFormatter) {
  console.log(`\n--- ${title} ---`);
  console.log(header);
  console.log("-".repeat(header.length));
  for (const s of Object.values(summary)) {
    console.log(rowFormatter(s));
  }
}

function printSummaryTables(summary) {
  console.log("\n=======================================================");
  console.log("RÉSUMÉ COMPARATIF : DIVERSITÉ RACINE & STRUCTURE ARBRE");
  console.log("=======================================================");

  printTable(
    summary,
    "1. CARTES DISTINCTES AU TOP 8",
    "Configuration                  | Début (T1-4) | Milieu (T10-13) | Global",
    (s) => `${s.label.padEnd(30)} | ${s.early.distinctCardsAtRoot?.toFixed(2).padStart(12)} | ${s.mid.distinctCardsAtRoot?.toFixed(2).padStart(15)} | ${s.all.distinctCardsAtRoot?.toFixed(2).padStart(6)}`
  );

  printTable(
    summary,
    "2. PROFONDEUR DE L'ARBRE (NOMBRE MOYEN DE NŒUDS)",
    "Configuration                  | Pli 1 | Pli 2  | Pli 3   | Pli 4 | Pli 5 | Prof. Max",
    (s) => `${s.label.padEnd(30)} | ${s.all.nodesAtDepth1?.toFixed(0).padStart(5)} | ${s.all.nodesAtDepth2?.toFixed(0).padStart(6)} | ${s.all.nodesAtDepth3?.toFixed(0).padStart(7)} | ${s.all.nodesAtDepth4?.toFixed(0).padStart(5)} | ${s.all.nodesAtDepth5?.toFixed(1).padStart(5)} | ${s.all.maxDepth?.toFixed(2).padStart(9)}`
  );

  printTable(
    summary,
    "3. VISITES ET SINGLETONS (NŒUDS VISITÉ 1 SEULE FOIS)",
    "Configuration                  | Visite Max L1 | % Singletons L1 | % Singletons Global",
    (s) => `${s.label.padEnd(30)} | ${s.all.l1MaxVisits?.toFixed(1).padStart(13)} | ${(s.all.l1SingletonPct?.toFixed(1) + "%").padStart(15)} | ${(s.all.totalSingletonPct?.toFixed(1) + "%").padStart(19)}`
  );

  printTable(
    summary,
    "4. PRÉSENCE DU COUP DE L'ORACLE DANS LE TOP 8",
    "Configuration                  | Début (T1-4) | Milieu (T10-13) | Global",
    (s) => `${s.label.padEnd(30)} | ${(s.early.oracleInTop8?.toFixed(1) + "%").padStart(12)} | ${(s.mid.oracleInTop8?.toFixed(1) + "%").padStart(15)} | ${(s.all.oracleInTop8?.toFixed(1) + "%").padStart(6)}`
  );
}

async function main() {
  const started = Date.now();
  const duel = JSON.parse(await readFile(DUEL_FILE, "utf8"));
  const tasks = createTasks(duel.games.slice(0, GAMES_COUNT));
  console.log(`Lancement de ${tasks.length} tâches sur ${workerCount()} fils...`);

  let completed = 0;
  const results = await runPool(WORKER_URL, tasks, {
    onProgress: () => {
      completed += 1;
      if (completed % 40 === 0 || completed === tasks.length) {
        console.log(`  [${completed}/${tasks.length}] (${((Date.now() - started) / 1000).toFixed(0)}s)...`);
      }
    },
  });

  const byPosition = groupResultsByPosition(results, tasks);
  enrichWithOracle(byPosition);
  const summary = buildSummary(byPosition);

  await writeFile(RESULTS_FILE, JSON.stringify({ summary, positions: Array.from(byPosition.values()) }, null, 2));
  printSummaryTables(summary);
}

main().catch(console.error);
