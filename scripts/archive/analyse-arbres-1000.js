import { readFile, writeFile } from "node:fs/promises";
import { runPool, workerCount } from "../lib/cli/pool.js";
import { tmpFile } from "../lib/domain/tmp.js";

const DUEL_FILE = new URL("../../duels/2026-10-10-16-59-01_borne@1.0_vs_experimental@1.2.json", import.meta.url);
const WORKER_URL = new URL("../lib/workers/tree-worker.js", import.meta.url);
const RESULTS_FILE = tmpFile("arbre-analysis-results-1000.json");

const ENGINES = [
  { key: "w5_d0", label: "widen=5, diverse=0", id: "ismcts+widen=5+depth=5+core=stfig6@2000", budget: 2000 },
  { key: "w5_d2", label: "widen=5, diverse=2 (Borné)", id: "ismcts+widen=5+depth=5+core=stfig6+diverse=2@2000", budget: 2000 },
  { key: "w7_d0", label: "widen=7, diverse=0 (Exp 1.2)", id: "ismcts+widen=7+depth=5+core=stfig6@2000", budget: 2000 },
  { key: "w7_d2", label: "widen=7, diverse=2", id: "ismcts+widen=7+depth=5+core=stfig6+diverse=2@2000", budget: 2000 },
  { key: "oracle", label: "Oracle @20k (w6)", id: "ismcts+candidates=99+widen=6+depth=5+smart=1@20000", budget: 20000 },
];

const ALL_TURNS = [1, 2, 3, 4, 10, 11, 12, 13];
const GAMES_COUNT = 125; // 125 games * 8 turns = 1,000 positions (500 early, 500 mid)

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
    if (!res || !res.ok) return;
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

function statsOf(arr) {
  const n = arr.length;
  if (n === 0) return { count: 0, mean: 0, std: 0, se: 0, ciLow: 0, ciHigh: 0 };
  const sum = arr.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  if (n === 1) return { count: 1, mean, std: 0, se: 0, ciLow: mean, ciHigh: mean };
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
  const std = Math.sqrt(variance);
  const se = std / Math.sqrt(n);
  const t = 1.96; // For n >= 500, normal approx t = 1.96
  return {
    count: n,
    mean: Number(mean.toFixed(2)),
    std: Number(std.toFixed(2)),
    se: Number(se.toFixed(2)),
    ciLow: Number((mean - t * se).toFixed(2)),
    ciHigh: Number((mean + t * se).toFixed(2)),
  };
}

function computeStats(list) {
  if (list.length === 0) return {};
  return {
    count: list.length,
    distinctCardsAtRoot: statsOf(list.map((m) => new Set(m.candidates.map((c) => c.key.split("@")[0])).size)),
    bestMoveVisits: statsOf(list.map((m) => m.bestMoveVisits)),
    runnerUpVisits: statsOf(list.map((m) => m.runnerUpVisits)),
    l1MaxVisits: statsOf(list.map((m) => m.l1MaxVisits)),
    l1MedianVisits: statsOf(list.map((m) => m.l1MedianVisits)),
    l1SingletonPct: statsOf(list.map((m) => m.l1SingletonPct)),
    totalSingletonPct: statsOf(list.map((m) => m.totalSingletonPct)),
    nodesAtDepth1: statsOf(list.map((m) => m.depthCounts[1] ?? 0)),
    nodesAtDepth2: statsOf(list.map((m) => m.depthCounts[2] ?? 0)),
    nodesAtDepth3: statsOf(list.map((m) => m.depthCounts[3] ?? 0)),
    nodesAtDepth4: statsOf(list.map((m) => m.depthCounts[4] ?? 0)),
    nodesAtDepth5: statsOf(list.map((m) => m.depthCounts[5] ?? 0)),
    maxDepth: statsOf(list.map((m) => m.maxDepth)),
    oracleAgreement: statsOf(list.map((m) => (m.agreesWithOracle ? 100 : 0))),
    oracleInTop8: statsOf(list.map((m) => (m.oracleInTop8 ? 100 : 0))),
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

async function main() {
  console.log("=== ANALYSE ARBRES SUR 1 000 POSITIONS (500 early, 500 mid) ===");
  const duel = JSON.parse(await readFile(DUEL_FILE, "utf8"));
  const sampleGames = duel.games.slice(0, GAMES_COUNT);
  const tasks = createTasks(sampleGames);
  console.log(`Chargé ${sampleGames.length} parties. Total tâches : ${tasks.length} (5 moteurs x 1000 positions).`);
  console.log(`Threads ouvriers : ${workerCount()}`);

  const startTime = Date.now();
  let lastReport = Date.now();

  const results = await runPool(WORKER_URL, tasks, {
    onProgress: (done, total) => {
      const now = Date.now();
      if (done % 50 === 0 || done === total || now - lastReport > 15000) {
        lastReport = now;
        const elapsed = (now - startTime) / 1000;
        const rate = done / Math.max(1, elapsed);
        const remaining = (total - done) / Math.max(0.1, rate);
        console.log(
          `[${done}/${total}] (${((done / total) * 100).toFixed(1)}%) ` +
          `- vitesse : ${rate.toFixed(1)} t/s - écoulé : ${(elapsed / 60).toFixed(1)}m - restant : ${(remaining / 60).toFixed(1)}m`
        );
      }
    },
  });

  const byPosition = groupResultsByPosition(results, tasks);
  enrichWithOracle(byPosition);
  const summary = buildSummary(byPosition);

  const payload = {
    generatedAt: new Date().toISOString(),
    positionsCount: byPosition.size,
    summary,
    positions: Array.from(byPosition.values()),
  };

  await writeFile(RESULTS_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\nSuccès ! Résultats sauvegardés dans ${RESULTS_FILE.pathname}`);
  console.log(`Durée totale d'exécution : ${((Date.now() - startTime) / 60000).toFixed(1)} minutes.`);
}

main().catch((err) => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});
