import { readFile, writeFile } from "node:fs/promises";
import { runPool, workerCount } from "../lib/cli/pool.js";
import { tmpFile } from "../lib/domain/tmp.js";

const DUEL_FILE = new URL("../../duels/2026-10-10-16-59-01_borne@1.0_vs_experimental@1.2.json", import.meta.url);
const WORKER_URL = new URL("../lib/workers/tree-worker.js", import.meta.url);
const RESULTS_FILE = tmpFile("arbre-analysis-results-1000.json");

const NEW_ENGINE = {
  key: "w8_d4_r10_c2",
  label: "Root10 (Cap2), ShortList: Widen8, Depth4, Cap2",
  id: "ismcts+candidates=10+widen=8+depth=4+core=stfig6+diverse=2@2000",
  budget: 2000,
};

const ALL_TURNS = [1, 2, 3, 4, 10, 11, 12, 13];
const GAMES_COUNT = 125;

function createTasks(sampleGames) {
  const tasks = [];
  sampleGames.forEach((gameLog, gameIndex) => {
    for (const turn of ALL_TURNS) {
      tasks.push({
        gameIndex,
        turn,
        gameLog,
        engineId: NEW_ENGINE.id,
        engineKey: NEW_ENGINE.key,
        budget: NEW_ENGINE.budget,
        seed: 20261010 + gameIndex * 10007 + turn * 103 + NEW_ENGINE.key.length,
      });
    }
  });
  return tasks;
}

function compareToOracle(metrics, oracleMetrics) {
  const oracleBest = oracleMetrics.bestMove;
  metrics.agreesWithOracle = Boolean(metrics.bestMove && metrics.bestMove === oracleBest);
  const index = oracleMetrics.candidates.findIndex((c) => c.key === metrics.bestMove);
  metrics.oracleRank = index >= 0 ? index + 1 : 99;
  metrics.oracleInTop8 = metrics.candidates.slice(0, 8).some((c) => c.key === oracleBest);
  metrics.oracleInTop10 = metrics.candidates.slice(0, 10).some((c) => c.key === oracleBest);
  metrics.distinctCardsTop8 = new Set(metrics.candidates.slice(0, 8).map((c) => c.key.split("@")[0])).size;
  metrics.distinctCardsTop10 = new Set(metrics.candidates.slice(0, 10).map((c) => c.key.split("@")[0])).size;
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
  const t = 1.96;
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
    distinctCardsAtRoot: statsOf(list.map((m) => m.distinctCardsTop8 ?? new Set(m.candidates.slice(0, 8).map((c) => c.key.split("@")[0])).size)),
    distinctCardsTop10: statsOf(list.map((m) => m.distinctCardsTop10 ?? new Set(m.candidates.slice(0, 10).map((c) => c.key.split("@")[0])).size)),
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
    oracleInTop10: statsOf(list.map((m) => (m.oracleInTop10 ? 100 : 0))),
  };
}

function updateExistingData(existingData, results, tasks) {
  const posMap = new Map();
  for (const pos of existingData.positions) {
    posMap.set(`g${pos.gameIndex}_t${pos.turn}`, pos);
  }
  results.forEach((res, index) => {
    if (!res || !res.ok) return;
    const task = tasks[index];
    const pos = posMap.get(`g${task.gameIndex}_t${task.turn}`);
    if (pos) {
      if (pos.engines.oracle) compareToOracle(res.metrics, pos.engines.oracle);
      pos.engines[NEW_ENGINE.key] = res.metrics;
    }
  });

  const allList = existingData.positions.map((p) => p.engines[NEW_ENGINE.key]).filter(Boolean);
  const earlyList = existingData.positions.filter((p) => p.phase === "early").map((p) => p.engines[NEW_ENGINE.key]).filter(Boolean);
  const midList = existingData.positions.filter((p) => p.phase === "mid").map((p) => p.engines[NEW_ENGINE.key]).filter(Boolean);

  existingData.summary[NEW_ENGINE.key] = {
    label: NEW_ENGINE.label,
    all: computeStats(allList),
    early: computeStats(earlyList),
    mid: computeStats(midList),
  };
}

async function main() {
  console.log(`=== ÉVALUATION NOUVELLE CONFIGURATION : ${NEW_ENGINE.label} ===`);
  const duel = JSON.parse(await readFile(DUEL_FILE, "utf8"));
  const sampleGames = duel.games.slice(0, GAMES_COUNT);
  const tasks = createTasks(sampleGames);
  console.log(`Lancement de ${tasks.length} tâches sur ${workerCount()} threads...`);

  const t0 = Date.now();
  const results = await runPool(WORKER_URL, tasks, {
    onProgress: (done, total) => {
      if (done % 100 === 0 || done === total) {
        console.log(`[${done}/${total}] (${((done / total) * 100).toFixed(0)}%) - écoulé : ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
    },
  });

  console.log(`Recherche terminée en ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
  const existingData = JSON.parse(await readFile(RESULTS_FILE, "utf8"));
  updateExistingData(existingData, results, tasks);
  await writeFile(RESULTS_FILE, JSON.stringify(existingData, null, 2), "utf8");
  console.log(`Données sauvegardées avec succès dans ${RESULTS_FILE.pathname} !`);
}

main().catch((err) => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});
