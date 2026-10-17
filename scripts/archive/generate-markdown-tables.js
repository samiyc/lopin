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

function getCardCount(engData) {
  return new Set(engData.candidates.map((cand) => cand.key.split("@")[0])).size;
}

const engines = [
  { key: "w5_d0", label: "**widen=5, diverse=0** (sans cap)" },
  { key: "w5_d2", label: "**widen=5, diverse=2 (Le Borné)**" },
  { key: "w7_d0", label: "**widen=7, diverse=0 (Exp 1.2)**" },
  { key: "w7_d2", label: "**widen=7, diverse=2**" },
  { key: "w7_d3_cap321", label: "**widen=7, depth=3, cap321**" },
  { key: "w6_d5_cap321_2", label: "**widen=6, depth=5, Cap2 (Root Cap321/2)**" },
  { key: "w8_d4_r10_c2", label: "**widen=8, depth=4, Cap2 (Root10 Cap2)**" },
  { key: "w7_d5_pw1", label: "**widen=7, depth=5, pw=1 (Exp 1.2 + PW)**" },
  { key: "oracle", label: "**Oracle @20k (widen=6, 99 cand.)**" },
];

const availableEngines = engines.filter((eng) => d.positions[0]?.engines[eng.key]);

console.log("### TABLE 1: CARTES DISTINCTES RACINE\n");
console.log("| Configuration | Début de partie (Tours 1–4, n=500) | Milieu de partie (Tours 10–13, n=500) | Moyenne globale (N=1 000) |");
console.log("| :--- | :---: | :---: | :---: |");
for (const eng of availableEngines) {
  const early = stats(d.positions.filter((p) => p.phase === "early").map((p) => getCardCount(p.engines[eng.key])));
  const mid = stats(d.positions.filter((p) => p.phase === "mid").map((p) => getCardCount(p.engines[eng.key])));
  const all = stats(d.positions.map((p) => getCardCount(p.engines[eng.key])));
  console.log(
    `| ${eng.label} | **${early.mean}** ± ${early.std} <br>*(IC 95 % : [${early.ciLow} – ${early.ciHigh}])* ` +
    `| **${mid.mean}** ± ${mid.std} <br>*(IC 95 % : [${mid.ciLow} – ${mid.ciHigh}])* ` +
    `| **${all.mean}** ± ${all.std} <br>*(IC 95 % : [${all.ciLow} – ${all.ciHigh}])* |`
  );
}

console.log("\n### TABLE 2: PROFONDEURS ET NŒUDS PAR PLI\n");
console.log("| Configuration | Pli 1 (Racine) | Pli 2 (Réponses) | Pli 3 (2e coup bot) | Pli 4 (2e rép. adv.) | Pli 5 (3e coup bot) | Profondeur Max (IC 95 %) |");
console.log("| :--- | :---: | :---: | :---: | :---: | :---: | :---: |");
for (const eng of availableEngines) {
  const p1 = stats(d.positions.map((p) => p.engines[eng.key].depthCounts["1"] || 0));
  const p2 = stats(d.positions.map((p) => p.engines[eng.key].depthCounts["2"] || 0));
  const p3 = stats(d.positions.map((p) => p.engines[eng.key].depthCounts["3"] || 0));
  const p4 = stats(d.positions.map((p) => p.engines[eng.key].depthCounts["4"] || 0));
  const p5 = stats(d.positions.map((p) => p.engines[eng.key].depthCounts["5"] || 0));
  const maxD = stats(d.positions.map((p) => p.engines[eng.key].maxDepth || 0));
  const totNodes = p1.mean + p2.mean + p3.mean + p4.mean + p5.mean;
  const p4Pct = ((p4.mean / totNodes) * 100).toFixed(1);
  const p5Pct = ((p5.mean / totNodes) * 100).toFixed(2);
  console.log(
    `| ${eng.label} | ${p1.mean} ± ${p1.std} | ${Math.round(p2.mean)} ± ${Math.round(p2.std)} | ${Math.round(p3.mean)} ± ${Math.round(p3.std)} | ` +
    `**${Math.round(p4.mean)} ± ${Math.round(p4.std)}** *(${p4Pct} %)* | **${p5.mean} ± ${p5.std}** *(${p5Pct} %)* | ` +
    `**${maxD.mean} ± ${maxD.std}** <br>*(IC: [${maxD.ciLow} – ${maxD.ciHigh}])* |`
  );
}

console.log("\n### TABLE 3: VISITES ET SINGLETONS\n");
console.log("| Configuration | Visites Top 1 (Racine) | Visites Top 2 (Racine) | Visite Max enfant L1 | Visite Médiane L1 | % Singletons L1 (IC 95 %) | % Singletons Total Arbre (IC 95 %) |");
console.log("| :--- | :---: | :---: | :---: | :---: | :---: | :---: |");
for (const eng of availableEngines) {
  const top1 = stats(d.positions.map((p) => p.engines[eng.key].bestMoveVisits || 0));
  const top2 = stats(d.positions.map((p) => p.engines[eng.key].runnerUpVisits || 0));
  const l1Max = stats(d.positions.map((p) => p.engines[eng.key].l1MaxVisits || 0));
  const l1Med = stats(d.positions.map((p) => p.engines[eng.key].l1MedianVisits || 0));
  const l1Sing = stats(d.positions.map((p) => p.engines[eng.key].l1SingletonPct || 0));
  const totSing = stats(d.positions.map((p) => p.engines[eng.key].totalSingletonPct || 0));
  console.log(
    `| ${eng.label} | ${top1.mean} ± ${top1.std} | ${top2.mean} ± ${top2.std} | ${l1Max.mean} ± ${l1Max.std} | ${l1Med.mean} ± ${l1Med.std} | ` +
    `**${l1Sing.mean} % ± ${l1Sing.std} %** <br>*(IC: [${l1Sing.ciLow} % – ${l1Sing.ciHigh} %])* | ` +
    `**${totSing.mean} % ± ${totSing.std} %** <br>*(IC: [${totSing.ciLow} % – ${totSing.ciHigh} %])* |`
  );
}

console.log("\n### TABLE 4: COUVERTURE ORACLE RACINE SUR 1000 POSITIONS (BANC ORACLE)\n");
console.log("| Configuration | Début de partie (Tours 4–10, n=500) | Milieu de partie (Tours 11–20, n=500) | Global (N=1 000 positions) |");
console.log("| :--- | :---: | :---: | :---: |");
const eNoCap = propStats(c.early.top8NoCap.hits, 500);
const mNoCap = propStats(c.mid.top8NoCap.hits, 500);
const aNoCap = propStats(c.all.top8NoCap.hits, 1000);
const eCap2 = propStats(c.early.top8Cap2.hits, 500);
const mCap2 = propStats(c.mid.top8Cap2.hits, 500);
const aCap2 = propStats(c.all.top8Cap2.hits, 1000);
const eCap321 = propStats(c.early.top8Cap321.hits, 500);
const mCap321 = propStats(c.mid.top8Cap321.hits, 500);
const aCap321 = propStats(c.all.top8Cap321.hits, 1000);
const eHybrid = propStats(c.early.top8Hybrid.hits, 500);
const mHybrid = propStats(c.mid.top8Hybrid.hits, 500);
const aHybrid = propStats(c.all.top8Hybrid.hits, 1000);
const e10Cap2 = propStats(c.early.top10Cap2.hits, 500);
const m10Cap2 = propStats(c.mid.top10Cap2.hits, 500);
const a10Cap2 = propStats(c.all.top10Cap2.hits, 1000);

console.log(
  `| **Top 8 Sans cap (\`diverse=0\`)** <br>*(widen 5 & 7)* ` +
  `| **${eNoCap.pct} %** (${eNoCap.hits}/500) <br>*(SE = ${eNoCap.se} %, IC 95 % : [${eNoCap.ciLow} % – ${eNoCap.ciHigh} %])* ` +
  `| **${mNoCap.pct} %** (${mNoCap.hits}/500) <br>*(SE = ${mNoCap.se} %, IC 95 % : [${mNoCap.ciLow} % – ${mNoCap.ciHigh} %])* ` +
  `| **${aNoCap.pct} %** (${aNoCap.hits}/1000) <br>*(SE = ${aNoCap.se} %, IC 95 % : [${aNoCap.ciLow} % – ${aNoCap.ciHigh} %])* |`
);
console.log(
  `| **Top 8 Avec cap 2 (\`diverse=2\`)** <br>*(Le Borné & w7_d2)* ` +
  `| **${eCap2.pct} %** (${eCap2.hits}/500) <br>*(SE = ${eCap2.se} %, IC 95 % : [${eCap2.ciLow} % – ${eCap2.ciHigh} %])* ` +
  `| **${mCap2.pct} %** (${mCap2.hits}/500) <br>*(SE = ${mCap2.se} %, IC 95 % : [${mCap2.ciLow} % – ${mCap2.ciHigh} %])* ` +
  `| **${aCap2.pct} %** (${aCap2.hits}/1000) <br>*(SE = ${aCap2.se} %, IC 95 % : [${aCap2.ciLow} % – ${aCap2.ciHigh} %])* |`
);
console.log(
  `| **Top 8 Avec cap 3-2-1 (\`diverse=cap321\`)** <br>*(w7_d3)* ` +
  `| **${eCap321.pct} %** (${eCap321.hits}/500) <br>*(SE = ${eCap321.se} %, IC 95 % : [${eCap321.ciLow} % – ${eCap321.ciHigh} %])* ` +
  `| **${mCap321.pct} %** (${mCap321.hits}/500) <br>*(SE = ${mCap321.se} %, IC 95 % : [${mCap321.ciLow} % – ${mCap321.ciHigh} %])* ` +
  `| **${aCap321.pct} %** (${aCap321.hits}/1000) <br>*(SE = ${aCap321.se} %, IC 95 % : [${aCap321.ciLow} % – ${aCap321.ciHigh} %])* |`
);
console.log(
  `| **Top 8 Avec cap Hybride (\`Cap321 T1-4, Cap2 T5+\`)** ` +
  `| **${eHybrid.pct} %** (${eHybrid.hits}/500) <br>*(SE = ${eHybrid.se} %, IC 95 % : [${eHybrid.ciLow} % – ${eHybrid.ciHigh} %])* ` +
  `| **${mHybrid.pct} %** (${mHybrid.hits}/500) <br>*(SE = ${mHybrid.se} %, IC 95 % : [${mHybrid.ciLow} % – ${mHybrid.ciHigh} %])* ` +
  `| **${aHybrid.pct} %** (${aHybrid.hits}/1000) <br>*(SE = ${aHybrid.se} %, IC 95 % : [${aHybrid.ciLow} % – ${aHybrid.ciHigh} %])* |`
);
console.log(
  `| **Top 10 Avec cap 2 (\`Root10, diverse=2\`)** <br>*(Nouvelle config)* ` +
  `| **${e10Cap2.pct} %** (${e10Cap2.hits}/500) <br>*(SE = ${e10Cap2.se} %, IC 95 % : [${e10Cap2.ciLow} % – ${e10Cap2.ciHigh} %])* ` +
  `| **${m10Cap2.pct} %** (${m10Cap2.hits}/500) <br>*(SE = ${m10Cap2.se} %, IC 95 % : [${m10Cap2.ciLow} % – ${m10Cap2.ciHigh} %])* ` +
  `| **${a10Cap2.pct} %** (${a10Cap2.hits}/1000) <br>*(SE = ${a10Cap2.se} %, IC 95 % : [${a10Cap2.ciLow} % – ${a10Cap2.ciHigh} %])* |`
);

console.log("\n### TABLE 5: COUVERTURE SHORTLIST (BANC ORACLE 1000 POSITIONS)\n");
console.log("| Taille de la shortlist | Début (Tours 4–10, n=500) | Milieu (Tours 11–20, n=500) | Global (N=1 000 positions) |");
console.log("| :--- | :---: | :---: | :---: |");
const t5No = { e: propStats(c.early.top5NoCap.hits, 500), m: propStats(c.mid.top5NoCap.hits, 500), a: propStats(c.all.top5NoCap.hits, 1000) };
const t5Cap = { e: propStats(c.early.top5Cap2.hits, 500), m: propStats(c.mid.top5Cap2.hits, 500), a: propStats(c.all.top5Cap2.hits, 1000) };
const t6Cap = { e: propStats(c.early.top6Cap2.hits, 500), m: propStats(c.mid.top6Cap2.hits, 500), a: propStats(c.all.top6Cap2.hits, 1000) };
const t7No = { e: propStats(c.early.top7NoCap.hits, 500), m: propStats(c.mid.top7NoCap.hits, 500), a: propStats(c.all.top7NoCap.hits, 1000) };
const t7Cap = { e: propStats(c.early.top7Cap2.hits, 500), m: propStats(c.mid.top7Cap2.hits, 500), a: propStats(c.all.top7Cap2.hits, 1000) };
const t7Cap321 = { e: propStats(c.early.top7Cap321.hits, 500), m: propStats(c.mid.top7Cap321.hits, 500), a: propStats(c.all.top7Cap321.hits, 1000) };
const t8Cap = { e: propStats(c.early.top8Cap2.hits, 500), m: propStats(c.mid.top8Cap2.hits, 500), a: propStats(c.all.top8Cap2.hits, 1000) };

console.log(`| **Top 5 sans cap** (\`widen=5, diverse=0\`) | **${t5No.e.pct} %** (${t5No.e.hits}/500) <br>*(SE=${t5No.e.se} %, [${t5No.e.ciLow} % – ${t5No.e.ciHigh} %])* | **${t5No.m.pct} %** (${t5No.m.hits}/500) <br>*(SE=${t5No.m.se} %, [${t5No.m.ciLow} % – ${t5No.m.ciHigh} %])* | **${t5No.a.pct} %** (${t5No.a.hits}/1000) <br>*(SE=${t5No.a.se} %, [${t5No.a.ciLow} % – ${t5No.a.ciHigh} %])* |`);
console.log(`| **Top 5 avec cap 2** (\`widen=5, diverse=2\`, Borné) | **${t5Cap.e.pct} %** (${t5Cap.e.hits}/500) <br>*(SE=${t5Cap.e.se} %, [${t5Cap.e.ciLow} % – ${t5Cap.e.ciHigh} %])* | **${t5Cap.m.pct} %** (${t5Cap.m.hits}/500) <br>*(SE=${t5Cap.m.se} %, [${t5Cap.m.ciLow} % – ${t5Cap.m.ciHigh} %])* | **${t5Cap.a.pct} %** (${t5Cap.a.hits}/1000) <br>*(SE=${t5Cap.a.se} %, [${t5Cap.a.ciLow} % – ${t5Cap.a.ciHigh} %])* |`);
console.log(`| **Top 6 avec cap 2** (\`widen=6, diverse=2\`) | **${t6Cap.e.pct} %** (${t6Cap.e.hits}/500) <br>*(SE=${t6Cap.e.se} %, [${t6Cap.e.ciLow} % – ${t6Cap.e.ciHigh} %])* | **${t6Cap.m.pct} %** (${t6Cap.m.hits}/500) <br>*(SE=${t6Cap.m.se} %, [${t6Cap.m.ciLow} % – ${t6Cap.m.ciHigh} %])* | **${t6Cap.a.pct} %** (${t6Cap.a.hits}/1000) <br>*(SE=${t6Cap.a.se} %, [${t6Cap.a.ciLow} % – ${t6Cap.a.ciHigh} %])* |`);
console.log(`| **Top 7 sans cap** (\`widen=7, diverse=0\`, Exp 1.2) | **${t7No.e.pct} %** (${t7No.e.hits}/500) <br>*(SE=${t7No.e.se} %, [${t7No.e.ciLow} % – ${t7No.e.ciHigh} %])* | **${t7No.m.pct} %** (${t7No.m.hits}/500) <br>*(SE=${t7No.m.se} %, [${t7No.m.ciLow} % – ${t7No.m.ciHigh} %])* | **${t7No.a.pct} %** (${t7No.a.hits}/1000) <br>*(SE=${t7No.a.se} %, [${t7No.a.ciLow} % – ${t7No.a.ciHigh} %])* |`);
console.log(`| **Top 7 avec cap 2** (\`widen=7, diverse=2\`) | **${t7Cap.e.pct} %** (${t7Cap.e.hits}/500) <br>*(SE=${t7Cap.e.se} %, [${t7Cap.e.ciLow} % – ${t7Cap.e.ciHigh} %])* | **${t7Cap.m.pct} %** (${t7Cap.m.hits}/500) <br>*(SE=${t7Cap.m.se} %, [${t7Cap.m.ciLow} % – ${t7Cap.m.ciHigh} %])* | **${t7Cap.a.pct} %** (${t7Cap.a.hits}/1000) <br>*(SE=${t7Cap.a.se} %, [${t7Cap.a.ciLow} % – ${t7Cap.a.ciHigh} %])* |`);
console.log(`| **Top 7 avec cap 3-2-1** (\`widen=7, diverse=cap321\`) | **${t7Cap321.e.pct} %** (${t7Cap321.e.hits}/500) <br>*(SE=${t7Cap321.e.se} %, [${t7Cap321.e.ciLow} % – ${t7Cap321.e.ciHigh} %])* | **${t7Cap321.m.pct} %** (${t7Cap321.m.hits}/500) <br>*(SE=${t7Cap321.m.se} %, [${t7Cap321.m.ciLow} % – ${t7Cap321.m.ciHigh} %])* | **${t7Cap321.a.pct} %** (${t7Cap321.a.hits}/1000) <br>*(SE=${t7Cap321.a.se} %, [${t7Cap321.a.ciLow} % – ${t7Cap321.a.ciHigh} %])* |`);
console.log(`| **Top 8 avec cap 2** (\`widen=8, diverse=2\`, Nouvelle config) | **${t8Cap.e.pct} %** (${t8Cap.e.hits}/500) <br>*(SE=${t8Cap.e.se} %, [${t8Cap.e.ciLow} % – ${t8Cap.e.ciHigh} %])* | **${t8Cap.m.pct} %** (${t8Cap.m.hits}/500) <br>*(SE=${t8Cap.m.se} %, [${t8Cap.m.ciLow} % – ${t8Cap.m.ciHigh} %])* | **${t8Cap.a.pct} %** (${t8Cap.a.hits}/1000) <br>*(SE=${t8Cap.a.se} %, [${t8Cap.a.ciLow} % – ${t8Cap.a.ciHigh} %])* |`);

console.log("\n### ACCORD ORACLE ET TOP 8 DANS LES 1000 POSITIONS DE JEU DUEL\n");
for (const eng of ["w5_d0", "w5_d2", "w7_d0", "w7_d2", "w7_d3_cap321", "w6_d5_cap321_2", "w8_d4_r10_c2", "w7_d5_pw1"]) {
  if (!d.positions[0]?.engines[eng]) continue;
  const earlyHits = d.positions.filter((p) => p.phase === "early" && p.engines[eng]?.agreesWithOracle).length;
  const midHits = d.positions.filter((p) => p.phase === "mid" && p.engines[eng]?.agreesWithOracle).length;
  const allHits = d.positions.filter((p) => p.engines[eng]?.agreesWithOracle).length;
  const earlyIn8 = d.positions.filter((p) => p.phase === "early" && p.engines[eng]?.oracleInTop8).length;
  const midIn8 = d.positions.filter((p) => p.phase === "mid" && p.engines[eng]?.oracleInTop8).length;
  const allIn8 = d.positions.filter((p) => p.engines[eng]?.oracleInTop8).length;
  console.log(eng, {
    accord: { early: propStats(earlyHits, 500), mid: propStats(midHits, 500), all: propStats(allHits, 1000) },
    top8: { early: propStats(earlyIn8, 500), mid: propStats(midIn8, 500), all: propStats(allIn8, 1000) },
  });
}
