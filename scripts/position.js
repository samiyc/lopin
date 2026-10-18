import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BOT_LINEUP } from "../src/config/bots.js";
import { formatCard } from "../src/core/notation.js";
import { createRng } from "../src/core/random.js";
import { stateAt } from "../src/replay/core/log.js";
import { engineFor } from "../src/sim/bots.js";
import { legalMoves } from "../src/sim/engine/game.js";

/**
 * `npm run position -- <replay.json> <turn> [--engine A]… [--seeds 3]` (the Labo, lot 3, « Copier la commande »): the
 * position before move `turn` of a replay searched by each engine, several seeds each — what « Rejouer ce coup
 * avec… » does in the page, in Node. The first seed is the one the Labo gave the bot to move (the game's seed + 1 +
 * its seat), so the engine that played finds its move again; the others are spread from it. Without `--engine`, the
 * Expérimental 1.2 and the Oracle light.
 *
 *   npm run position -- "replays/2026-10-18_19-12-37_experimental-vs-oracle-light_4-3.json" 28 --engine "ismcts+widen=7+depth=5+core=stfig6+exact=12+mirror=1@2000"
 */
const OTHER_SEED = 7919;
const args = process.argv.slice(2);
const values = (flag) => args.flatMap((arg, i) => (args[i - 1] === flag ? [arg] : []));
const [file, turnText] = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));
const turn = Number(turnText);
if (!file || !Number.isInteger(turn) || turn < 1) {
  process.stderr.write("Usage : npm run position -- <replay.json> <tour> [--engine A]… [--seeds 3]\n");
  process.exit(1);
}
const engines = values("--engine").length > 0 ? values("--engine") : [BOT_LINEUP.experimental.engine, BOT_LINEUP["oracle-light"].engine];
const seeds = Number(values("--seeds")[0] ?? 3);

const log = JSON.parse(await readFile(resolve(process.cwd(), file), "utf8"));
if (turn > log.turns.length) {
  process.stderr.write(`Le replay n'a que ${log.turns.length} coups.\n`);
  process.exit(1);
}
const state = stateAt(log, turn);
const moves = legalMoves(state);
const name = (move) => (move ? `${formatCard(state.spec, move.card)} → ${move.border + 1}` : "passe");
const played = log.turns[turn - 1].move;
const seatSeed = (log.seed ?? 0) + 1 + state.current;

const playedText = played ? `${played.card} → ${played.border}` : "passe";
console.log(`${file}, tour ${turn} : ${moves.length} coups possibles, joué ${playedText}\n`);
for (const engine of engines) {
  const chosen = new Map();
  console.log(engine);
  for (let k = 0; k < seeds; k += 1) {
    const seed = seatSeed + k * OTHER_SEED;
    const started = Date.now();
    const scored = engineFor(engine)(createRng(seed)).scoreMoves(state, moves);
    const best = scored.reduce((a, b) => (b.gain > a.gain ? b : a));
    const total = scored.reduce((sum, entry) => sum + Math.max(0, entry.gain), 0);
    chosen.set(name(best.move), (chosen.get(name(best.move)) ?? 0) + 1);
    const share = scored.tree?.iterations ? ` (${((100 * best.gain) / scored.tree.iterations).toFixed(1).replace(".", ",")} % des visites)` : ` (gain ${best.gain.toFixed(2)} sur ${total.toFixed(2)})`;
    console.log(`  graine ${seed}${k === 0 ? " (celle du Labo)" : ""} : ${name(best.move)}${share}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  const tally = [...chosen].map(([move, count]) => `${move} ${count}/${seeds}`).join(", ");
  console.log(`  → ${tally}\n`);
}
