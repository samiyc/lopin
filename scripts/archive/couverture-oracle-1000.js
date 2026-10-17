import { readFile, writeFile } from "node:fs/promises";
import { formatCard } from "../../src/core/notation.js";
import { createRng } from "../../src/core/random.js";
import { referenceOf } from "../../src/replay/oracle/banc.js";
import { stateAt } from "../../src/replay/core/log.js";
import { strategistBot } from "../../src/sim/bots.js";
import { coreOf } from "../../src/sim/heuristics/experimental.js";
import { legalMoves } from "../../src/sim/engine/game.js";
import { pickCandidates } from "../../src/sim/mcts/pick.js";
import { loadGame } from "../lib/domain/game-index.js";

const BANC_FILE = new URL("../../oracle/positions-banc.jsonl", import.meta.url);
const OUT_FILE = new URL("../../data/couverture-oracle-1000.json", import.meta.url);

function isMoveInList(list, target, spec) {
  return list.some((m) => `${formatCard(spec, m.card)}→${m.border + 1}` === target);
}

function evaluatePosition(state, judge, target) {
  const moves = legalMoves(state);
  const scored = judge.scoreMoves(state, moves);
  const rootCap = state.turn < 4 ? "cap321" : 2;
  return {
    top10NoCap: isMoveInList(pickCandidates(scored, 10, 0), target, state.spec),
    top10Cap2: isMoveInList(pickCandidates(scored, 10, 2), target, state.spec),
    top8NoCap: isMoveInList(pickCandidates(scored, 8, 0), target, state.spec),
    top8Cap2: isMoveInList(pickCandidates(scored, 8, 2), target, state.spec),
    top8Cap321: isMoveInList(pickCandidates(scored, 8, "cap321"), target, state.spec),
    top8Hybrid: isMoveInList(pickCandidates(scored, 8, rootCap), target, state.spec),
    top7NoCap: isMoveInList(pickCandidates(scored, 7, 0), target, state.spec),
    top7Cap2: isMoveInList(pickCandidates(scored, 7, 2), target, state.spec),
    top7Cap321: isMoveInList(pickCandidates(scored, 7, "cap321"), target, state.spec),
    top6Cap2: isMoveInList(pickCandidates(scored, 6, 2), target, state.spec),
    top6NoCap: isMoveInList(pickCandidates(scored, 6, 0), target, state.spec),
    top5NoCap: isMoveInList(pickCandidates(scored, 5, 0), target, state.spec),
    top5Cap2: isMoveInList(pickCandidates(scored, 5, 2), target, state.spec),
  };
}

async function processEntries(entries, judge) {
  const results = [];
  for (const entry of entries) {
    const target = referenceOf(entry).best;
    const log = await loadGame(entry);
    const state = stateAt(log, entry.turn);
    results.push(evaluatePosition(state, judge, target));
  }
  return results;
}

function summarizeRate(results, key) {
  const hits = results.filter((r) => r[key]).length;
  return { hits, total: results.length, pct: Number(((hits / results.length) * 100).toFixed(1)) };
}

function summarizePhase(results) {
  return {
    top10NoCap: summarizeRate(results, "top10NoCap"),
    top10Cap2: summarizeRate(results, "top10Cap2"),
    top8NoCap: summarizeRate(results, "top8NoCap"),
    top8Cap2: summarizeRate(results, "top8Cap2"),
    top8Cap321: summarizeRate(results, "top8Cap321"),
    top8Hybrid: summarizeRate(results, "top8Hybrid"),
    top7NoCap: summarizeRate(results, "top7NoCap"),
    top7Cap2: summarizeRate(results, "top7Cap2"),
    top7Cap321: summarizeRate(results, "top7Cap321"),
    top6Cap2: summarizeRate(results, "top6Cap2"),
    top6NoCap: summarizeRate(results, "top6NoCap"),
    top5NoCap: summarizeRate(results, "top5NoCap"),
    top5Cap2: summarizeRate(results, "top5Cap2"),
  };
}

async function main() {
  const lines = (await readFile(BANC_FILE, "utf8")).split("\n").filter(Boolean);
  const judge = strategistBot(createRng(1), coreOf("stfig6"));

  const early = lines.map((l) => JSON.parse(l)).filter((e) => e.turn >= 4 && e.turn <= 10).slice(0, 500);
  const mid = lines.map((l) => JSON.parse(l)).filter((e) => e.turn >= 11 && e.turn <= 20).slice(0, 500);

  const resEarly = await processEntries(early, judge);
  const resMid = await processEntries(mid, judge);
  const resAll = [...resEarly, ...resMid];

  const summary = {
    early: summarizePhase(resEarly),
    mid: summarizePhase(resMid),
    all: summarizePhase(resAll),
  };

  await writeFile(OUT_FILE, JSON.stringify(summary, null, 2));
  console.log("Calcul terminé sur 1 000 positions. Résultats dans :", OUT_FILE.pathname);
  console.log("Top 8 Early : NoCap", summary.early.top8NoCap.pct, "% vs Cap2", summary.early.top8Cap2.pct, "%");
  console.log("Top 8 Mid   : NoCap", summary.mid.top8NoCap.pct, "% vs Cap2", summary.mid.top8Cap2.pct, "%");
  console.log("Top 8 Total : NoCap", summary.all.top8NoCap.pct, "% vs Cap2", summary.all.top8Cap2.pct, "%");
}

main().catch(console.error);
