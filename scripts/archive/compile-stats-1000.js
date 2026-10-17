import fs from "node:fs";
import { tmpFile } from "../lib/domain/tmp.js";

const d = JSON.parse(fs.readFileSync(tmpFile("arbre-analysis-results-1000.json"), "utf8"));
const c = JSON.parse(fs.readFileSync("./data/couverture-oracle-1000.json", "utf8"));

function stats(arr) {
  const n = arr.length;
  if (n === 0) return { mean: 0, std: 0, se: 0, ciLow: 0, ciHigh: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { mean, std: 0, se: 0, ciLow: mean, ciHigh: mean };
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
  const std = Math.sqrt(variance);
  const se = std / Math.sqrt(n);
  const t = 1.96; // For n >= 500
  return {
    mean: Number(mean.toFixed(2)),
    std: Number(std.toFixed(2)),
    se: Number(se.toFixed(2)),
    ciLow: Number((mean - t * se).toFixed(2)),
    ciHigh: Number((mean + t * se).toFixed(2)),
  };
}

function propStats(hits, n) {
  const p = hits / n;
  const se = Math.sqrt((p * (1 - p)) / n);
  const z = 1.96;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    hits,
    n,
    pct: Number((p * 100).toFixed(1)),
    std: Number((Math.sqrt(p * (1 - p)) * 100).toFixed(1)),
    se: Number((se * 100).toFixed(2)),
    ciLow: Number(((center - margin) * 100).toFixed(1)),
    ciHigh: Number(((center + margin) * 100).toFixed(1)),
  };
}

const engines = ["w5_d0", "w5_d2", "w7_d0", "w7_d2", "oracle"];

function getCardCount(engData) {
  return new Set(engData.candidates.map((cand) => cand.key.split("@")[0])).size;
}

console.log("=======================================================");
console.log("TABLE 1: CARTES DISTINCTES RACINE (N=1000, 500 early, 500 mid)");
console.log("=======================================================");
for (const eng of engines) {
  const early = d.positions.filter((p) => p.phase === "early").map((p) => getCardCount(p.engines[eng]));
  const mid = d.positions.filter((p) => p.phase === "mid").map((p) => getCardCount(p.engines[eng]));
  const all = d.positions.map((p) => getCardCount(p.engines[eng]));
  console.log(eng, {
    early: `${stats(early).mean} ± ${stats(early).std} [${stats(early).ciLow} - ${stats(early).ciHigh}]`,
    mid: `${stats(mid).mean} ± ${stats(mid).std} [${stats(mid).ciLow} - ${stats(mid).ciHigh}]`,
    all: `${stats(all).mean} ± ${stats(all).std} [${stats(all).ciLow} - ${stats(all).ciHigh}]`,
  });
}

console.log("\n=======================================================");
console.log("TABLE 2: PROFONDEURS ET NŒUDS PAR PLI (N=1000)");
console.log("=======================================================");
for (const eng of engines) {
  const p1 = stats(d.positions.map((p) => p.engines[eng].depthCounts["1"] || 0));
  const p2 = stats(d.positions.map((p) => p.engines[eng].depthCounts["2"] || 0));
  const p3 = stats(d.positions.map((p) => p.engines[eng].depthCounts["3"] || 0));
  const p4 = stats(d.positions.map((p) => p.engines[eng].depthCounts["4"] || 0));
  const p5 = stats(d.positions.map((p) => p.engines[eng].depthCounts["5"] || 0));
  const maxD = stats(d.positions.map((p) => p.engines[eng].maxDepth || 0));
  console.log(eng, {
    p1: `${p1.mean} ± ${p1.std}`,
    p2: `${p2.mean} ± ${p2.std}`,
    p3: `${p3.mean} ± ${p3.std}`,
    p4: `${p4.mean} ± ${p4.std}`,
    p5: `${p5.mean} ± ${p5.std}`,
    maxD: `${maxD.mean} ± ${maxD.std} [${maxD.ciLow} - ${maxD.ciHigh}]`,
  });
}

console.log("\n=======================================================");
console.log("TABLE 3: VISITES ET SINGLETONS (N=1000)");
console.log("=======================================================");
for (const eng of engines) {
  const top1 = stats(d.positions.map((p) => p.engines[eng].bestMoveVisits || 0));
  const top2 = stats(d.positions.map((p) => p.engines[eng].runnerUpVisits || 0));
  const l1Max = stats(d.positions.map((p) => p.engines[eng].l1MaxVisits || 0));
  const l1Med = stats(d.positions.map((p) => p.engines[eng].l1MedianVisits || 0));
  const l1SingPct = stats(d.positions.map((p) => p.engines[eng].l1SingletonPct || 0));
  const totSingPct = stats(d.positions.map((p) => p.engines[eng].totalSingletonPct || 0));
  console.log(eng, {
    top1: `${top1.mean} ± ${top1.std}`,
    top2: `${top2.mean} ± ${top2.std}`,
    l1Max: `${l1Max.mean} ± ${l1Max.std}`,
    l1Med: `${l1Med.mean} ± ${l1Med.std}`,
    l1SingPct: `${l1SingPct.mean}% ± ${l1SingPct.std}% [${l1SingPct.ciLow}% - ${l1SingPct.ciHigh}%]`,
    totSingPct: `${totSingPct.mean}% ± ${totSingPct.std}% [${totSingPct.ciLow}% - ${totSingPct.ciHigh}%]`,
  });
}

console.log("\n=======================================================");
console.log("TABLE 4: PRÉSENCE ORACLE DANS TOP 8 (BANC 1000 POSITIONS)");
console.log("=======================================================");
for (const phase of ["early", "mid", "all"]) {
  console.log(phase, {
    top8NoCap: propStats(c[phase].top8NoCap.hits, c[phase].top8NoCap.total),
    top8Cap2: propStats(c[phase].top8Cap2.hits, c[phase].top8Cap2.total),
  });
}

console.log("\n=======================================================");
console.log("TABLE 5: COUVERTURE SHORTLIST TOP 5 / TOP 7 (BANC 1000 POSITIONS)");
console.log("=======================================================");
for (const phase of ["early", "mid", "all"]) {
  console.log(phase, {
    top5NoCap: propStats(c[phase].top5NoCap.hits, c[phase].top5NoCap.total),
    top5Cap2: propStats(c[phase].top5Cap2.hits, c[phase].top5Cap2.total),
    top7NoCap: propStats(c[phase].top7NoCap.hits, c[phase].top7NoCap.total),
    top7Cap2: propStats(c[phase].top7Cap2.hits, c[phase].top7Cap2.total),
  });
}

console.log("\n=======================================================");
console.log("ORACLE AGREEMENT DANS DUEL (1000 POSITIONS DUEL)");
console.log("=======================================================");
for (const eng of ["w5_d0", "w5_d2", "w7_d0", "w7_d2"]) {
  const earlyHits = d.positions.filter((p) => p.phase === "early" && p.engines[eng].agreesWithOracle).length;
  const midHits = d.positions.filter((p) => p.phase === "mid" && p.engines[eng].agreesWithOracle).length;
  const allHits = d.positions.filter((p) => p.engines[eng].agreesWithOracle).length;
  const earlyIn8 = d.positions.filter((p) => p.phase === "early" && p.engines[eng].oracleInTop8).length;
  const midIn8 = d.positions.filter((p) => p.phase === "mid" && p.engines[eng].oracleInTop8).length;
  const allIn8 = d.positions.filter((p) => p.engines[eng].oracleInTop8).length;

  console.log(eng, {
    accordOracle: {
      early: propStats(earlyHits, 500),
      mid: propStats(midHits, 500),
      all: propStats(allHits, 1000),
    },
    oracleInTop8: {
      early: propStats(earlyIn8, 500),
      mid: propStats(midIn8, 500),
      all: propStats(allIn8, 1000),
    },
  });
}
