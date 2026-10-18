/**
 * One-shot (Sami, 18/10): how deep a depth=10 tree really goes, by what is left in the pile. For the moves of the
 * engine whose id contains `pick` in the kept duels given, the deepest ply holding a visited node (`tree.levels`), its
 * mean, and the share of moves reaching ply 6 and ply 8. The pile empty, the solver plays (no tree).
 * `node scripts/archive/tree-depth-by-pile.js "pwl=3+trees=2@10000" duels/…json …`
 */
import fs from "node:fs";

const [pick, ...files] = process.argv.slice(2);
const bucketOf = (pile) => {
  if (pile >= 10) return "pioche ≥ 10";
  return pile >= 4 ? "pioche 4-9" : `pioche ${pile}`;
};
const buckets = new Map();
function count(turn) {
  const deepest = turn.tree.levels.filter((level) => level.nodes > level.zero).length;
  const tally = buckets.get(bucketOf(turn.pile)) ?? { moves: 0, sum: 0, six: 0, eight: 0 };
  Object.assign(tally, { moves: tally.moves + 1, sum: tally.sum + deepest, six: tally.six + (deepest >= 6), eight: tally.eight + (deepest >= 8) });
  buckets.set(bucketOf(turn.pile), tally);
}
for (const file of files) {
  for (const game of JSON.parse(fs.readFileSync(file)).games) {
    game.turns.filter((turn) => turn.tree && String(game.players[turn.player].bot).includes(pick)).forEach(count);
  }
}
const pct = (part, whole) => `${((100 * part) / whole).toFixed(1)} %`;
for (const [name, { moves, sum, six, eight }] of buckets) {
  console.log(`${name.padEnd(12)} ${String(moves).padStart(5)} coups · pli le plus profond ${(sum / moves).toFixed(2)} en moyenne · pli 6 atteint ${pct(six, moves)} · pli 8 ${pct(eight, moves)}`);
}
