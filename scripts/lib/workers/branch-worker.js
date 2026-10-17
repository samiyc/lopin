import { parentPort } from "node:worker_threads";
import { isJoker } from "../../../src/core/cards.js";
import { TURNING_TURN, branchFrom, holderAt, reproduces } from "../../../src/replay/core/branch.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { loadGame } from "../domain/game-index.js";

/**
 * One kept game played again from `turn` (`scripts/branch.js`,
 * `scripts/error-impact.js`): `check` says whether the unchanged replay gives
 * back every logged move; otherwise, who holds the game at turn 30 after the
 * change (`force`, `engines`, `reseed`), by exact play from there. `explain`
 * adds a few traits of the position, for the player to move.
 */
function traitsOf(log, turn) {
  const state = stateAt(log, turn);
  const me = state.current;
  const sides = state.borders.filter((border) => border.owner === null).map((border) => [border.sides[me].length, border.sides[1 - me].length]);
  return {
    contested: sides.filter(([mine, theirs]) => mine === 2 && theirs === 2).length,
    chasing: sides.filter(([mine, theirs]) => mine === 2 && theirs === 3).length,
    open: sides.filter(([mine]) => mine < 3).length,
    jokers: state.hands[me].filter(isJoker).length,
    pile: state.pile.length,
  };
}

parentPort.on("message", async ({ row, turn, check, force, engines, reseed, explain }) => {
  const log = await loadGame(row);
  if (check) return parentPort.postMessage({ reproduced: reproduces(log, turn) });
  const until = turn <= TURNING_TURN ? TURNING_TURN : Infinity;
  const holder = holderAt(branchFrom(log, turn, { force, engines, reseed, until }));
  return parentPort.postMessage({ holder, traits: explain ? traitsOf(log, turn) : null });
});
