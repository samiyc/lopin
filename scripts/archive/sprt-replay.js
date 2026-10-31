/**
 * Point 3 (Sami, 31/10, docs/qualite.md): the duels of data/versus.json replayed through mcts-commun's sprt, pair
 * after pair in the order they were played: where would a sequential test have stopped, and with which verdict?
 *   node scripts/archive/sprt-replay.js
 */
import { readFileSync } from "node:fs";
import { sprt } from "mcts-commun/measure.js";
import { readGame, pairScores } from "../../src/replay/oracle/versus.js";
import { loadGame, readIndex } from "../lib/domain/game-index.js";

const saved = JSON.parse(readFileSync("data/versus.json", "utf8")).duels;
const index = await readIndex();
const H1 = [0.52, 0.53];
const playedBy = (row, engine) => row.engines.includes(engine) || row.players.includes(engine);
const pc = (x) => (100 * x).toFixed(1);

for (const [label, { a, b, low, score }] of Object.entries(saved)) {
  const rows = index.filter((row) => playedBy(row, a) && playedBy(row, b)).sort((x, y) => x.file.localeCompare(y.file));
  const games = [];
  for (const row of rows) {
    const game = readGame(await loadGame(row), a);
    if (game) games.push(game);
  }
  const pairs = pairScores(games);
  const fixed = low > 0.5 ? "gain" : "pas de gain";
  const cells = H1.map((h1) => {
    for (let n = 20; n <= pairs.length; n++) {
      const { verdict, mean } = sprt(pairs.slice(0, n), { h0: 0.5, h1 });
      if (verdict !== "continue") return `${verdict === "h1" ? "gain" : "non"} à ${n} (${pc(mean)})`;
    }
    return `indécis à ${pairs.length}`;
  });
  console.log(`${label.padEnd(22)} ${String(pairs.length).padStart(5)} paires ${pc(score)} % bas ${pc(low)} → ${fixed.padEnd(11)} | h1 52 : ${cells[0].padEnd(22)} | h1 53 : ${cells[1]}`);
}
