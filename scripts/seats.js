import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { DUELS_DIR } from "./lib/domain/game-index.js";
import { doubleVictory, tempoAt } from "./lib/domain/seat-replay.js";
import { ENGINE_GROUPS, clusteredInterval, emptyTally, endTable, phaseSplit, rowsOf, tallyGame } from "./lib/domain/seat-tally.js";

/**
 * `npm run seats -- [--dir <duels>] [--group trees|exact12|older] [--claims] [--tempo N]`: where the second
 * player's edge comes from, read in the kept duels (read only, docs/sieges.md). The index alone splits the first
 * player's share by phase; the logs of `--group` (default `trees`) give the borders (who opens, who completes
 * last, how they are decided), the end of the games (on whose move, passes) and an interval by deal.
 * `--claims` rebuilds every game's end (a minute): could the loser have claimed a victory too? `--tempo N` solves
 * N positions at move 30 twice, with each player to move (about a second each). `--dir`: another duels/ folder
 * (a worktree has only a few).
 */
const args = process.argv.slice(2);
const valueOf = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const dirUrl = args.includes("--dir") ? pathToFileURL(`${valueOf("--dir").replace(/[\\/]$/, "")}/`) : pathToFileURL(DUELS_DIR);
const group = valueOf("--group", "trees");
const TEMPO = Number(valueOf("--tempo", 0));
if (!ENGINE_GROUPS[group]) throw new Error(`Groupe inconnu : « ${group} » (${Object.keys(ENGINE_GROUPS).join(", ")})`);

const pct = (share) => `${(100 * share).toFixed(1).replace(".", ",")} %`;
const pts = (points) => `${(100 * points).toFixed(2).replace(".", ",")} pt`;
const rows = JSON.parse(await readFile(new URL("index.json", dirUrl), "utf8"));

function printPhases() {
  console.log("## Par phase (index des duels, règle de la page)\n");
  console.log("| Moteurs | Parties | 1er joueur | Finies avant la pioche vide | Position au coup 30 (solveur) | Jeu de la fin | Fins gagnées jetées (1er / 2e) |");
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const [name, { label }] of Object.entries(ENGINE_GROUPS)) {
    const split = phaseSplit(rowsOf(rows, name));
    const { early, position, play } = split;
    console.log(`| ${label} | ${split.games} | ${pct(split.first)} | ${early.games} : ${pct(early.first)} (${pts(early.points)}) | ${pct(position.first)} (${pts(position.points)}) | ${pct(play.first)} (${pts(play.points)}) | ${play.thrown.join(" / ")} |`);
  }
  console.log("\n(pt : la part de l'écart à 50 % qui vient de cette phase, sur toutes les parties du groupe.)\n");
}

/** Each kept file read once, its games of the group tallied. */
async function tallyGroup(selected, onGame) {
  for (const [file, list] of groupByFile(selected)) {
    const duel = JSON.parse(await readFile(new URL(file, dirUrl), "utf8"));
    for (const row of list) onGame(duel.games[row.game], row);
  }
}

function groupByFile(selected) {
  const byFile = new Map();
  for (const row of selected) byFile.set(row.file, [...(byFile.get(row.file) ?? []), row]);
  return byFile;
}

const pair = ([zero, one]) => `1er ${zero}, 2e ${one}`;
const rates = (won, of) => `${pct(won[0] / of[0])} / ${pct(won[1] / of[1])}`;

function printBorders(tally) {
  const { decidedBy } = tally;
  console.log(`## Par borne — ${ENGINE_GROUPS[group].label}, ${tally.games} parties\n`);
  console.log(`- Bornes ouvertes (première carte) : ${pair(tally.opened)} ; gagnées par celui qui l'a ouverte : ${rates(tally.openerWon, tally.opened)}`);
  console.log(`- Bornes pleines des deux côtés, complétées en dernier : ${pair(tally.lastCompleter)} ; gagnées par celui-là : ${rates(tally.lastCompleterWon, tally.lastCompleter)}`);
  console.log(`- Gagnées par revendication contre un côté incomplet : ${pair(decidedBy.claim)}`);
  console.log(`- Gagnées côté plein contre côté plein : formation ${pair(decidedBy.formation)} · somme ${pair(decidedBy.sum)} · au premier complété ${pair(decidedBy.first)}\n`);
}

function printEnds(tally) {
  const { share, low, high, deals } = clusteredInterval(tally.deals.values());
  console.log("## Fins de partie\n");
  console.log(`- 1er joueur : ${pct(share)} (${pct(low)} – ${pct(high)}, intervalle par donne, ${deals} donnes)`);
  console.log(`- Victoires sur son propre coup : ${pair(tally.winsOn.own)} ; sur le coup adverse : ${pair(tally.winsOn.theirs)}`);
  console.log(`- Passes (aucun coup légal) : ${pair(tally.passes)}\n`);
  console.log("| Coups | Au trait | Parties | 1er joueur | Fin à ce coup (parties encore en cours) |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const row of endTable(tally.ends).filter((entry) => entry.games >= 20)) {
    console.log(`| ${row.turns} | ${row.mover === 0 ? "1er" : "2e"} | ${row.games} | ${pct(row.first)} | ${pct(row.hazard)} |`);
  }
  console.log("");
}

async function printClaims(selected) {
  const doubles = [0, 0];
  await tallyGroup(selected, (log) => {
    if (doubleVictory(log)) doubles[log.result.winner] += 1;
  });
  console.log(`## L'ordre des revendications\n\n- Parties où le perdant pouvait aussi revendiquer une victoire après le dernier coup (le joueur au trait revendique d'abord) : ${doubles[0] + doubles[1]} sur ${selected.length}, gagnées ${pair(doubles)}\n`);
}

async function printTempo(selected) {
  const solved = selected.filter((row) => !row.advantage?.ended && Number.isFinite(row.advantage?.value));
  const picked = solved.filter((_, i) => i % Math.max(1, Math.floor(solved.length / TEMPO)) === 0).slice(0, TEMPO);
  const tempo = { positions: 0, asPlayed: 0, swapped: 0, toMover: 0, toWaiter: 0 };
  await tallyGroup(picked, (log) => {
    const { asPlayed, swapped, toMove } = tempoAt(log);
    if (asPlayed === undefined || swapped === undefined || toMove !== 0) return;
    tempo.positions += 1;
    tempo.asPlayed += Number(asPlayed === 0);
    tempo.swapped += Number(swapped === 0);
    if (asPlayed !== swapped) tempo[swapped === 1 ? "toMover" : "toWaiter"] += 1;
  });
  console.log(`## Le trait quand la pioche est vide (coup 30, solveur)\n\n- ${tempo.positions} positions : le 1er joueur gagne ${pct(tempo.asPlayed / tempo.positions)} au trait, ${pct(tempo.swapped / tempo.positions)} si le 2e était au trait`);
  console.log(`- Le gagnant change dans ${tempo.toMover + tempo.toWaiter} positions : ${tempo.toMover} en faveur de celui qui joue, ${tempo.toWaiter} en faveur de celui qui attend (zugzwang)\n`);
}

console.log(`# L'avantage du siège dans les duels gardés — ${decodeURIComponent(dirUrl.pathname)}\n`);
printPhases();
const selected = rowsOf(rows, group);
const tally = emptyTally();
await tallyGroup(selected, (log) => tallyGame(tally, log));
printBorders(tally);
printEnds(tally);
if (args.includes("--claims")) await printClaims(selected);
if (TEMPO > 0) await printTempo(selected);
