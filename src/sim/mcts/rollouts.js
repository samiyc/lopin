import { playOutExact } from "../eval/exact.js";
import { playOutForkCut } from "./fork-cut.js";
import { applyMove, legalMoves } from "../engine/game.js";
import { playOut } from "../search/lookahead.js";
import { moveKey } from "../search/search.js";
import { decidedCount } from "./truncate.js";

/**
 * The rollouts an ISMCTS iteration may play (ismcts.js), apart from the tree: plain, noted for `rave`, cut short
 * (`trunc`), stopped at a victory or a double threat (`forkCut`), or ended by the exact solver (`simExact`).
 */
/** `playOut`, noting every move and who made it, for `rave`. */
function playOutNoted(game, policy, played) {
  const guard = game.spec.borders * 6 * 3;
  while (!game.over && game.turn < guard) {
    const moves = legalMoves(game);
    const move = moves.length > 0 ? policy.choose(game, moves) : null;
    if (move) played.push(`${game.current}|${moveKey(move)}`);
    applyMove(game, move);
  }
  return game.winner;
}

/**
 * A rollout cut short (`trunc`, truncate.js): once a border is won after at
 * least `trunc` moves, the core's odds of winning the game (`oddsOf`, for the
 * player to move) stand for the result — never once the pile is empty.
 */
/** Is it the place to stop: a border more decided than at the start, after `trunc` moves, with cards still in the pile? */
const cutHere = (game, plies, trunc, decided) => !game.over && game.pile.length > 0 && plies >= trunc && decidedCount(game) > decided;

function playOutCut(game, policy, { trunc, oddsOf }) {
  const guard = game.spec.borders * 6 * 3;
  const decided = decidedCount(game);
  let plies = 0;
  while (!game.over && game.turn < guard) {
    const moves = legalMoves(game);
    applyMove(game, moves.length > 0 ? policy.choose(game, moves) : null);
    plies += 1;
    if (cutHere(game, plies, trunc, decided)) {
      const odds = oddsOf(game);
      return { share: game.current === 0 ? odds : 1 - odds };
    }
  }
  return game.winner;
}

/** The rollout an iteration plays: cut short, noted for `rave`, or plain. */
export function rolloutOf(game, ctx, played) {
  if (ctx.simExact > 0) return playOutExact(game, ctx.rollout, ctx.simExact);
  // `forkCut` (fork-cut.js): stop at a victory on the filled borders (1), or at a double threat too (2).
  if (ctx.forkCut > 0) return playOutForkCut(game, ctx.rollout, ctx.forkCut);
  if (ctx.trunc > 0) return playOutCut(game, ctx.rollout, ctx);
  return ctx.amaf ? playOutNoted(game, ctx.rollout, played) : playOut(game, ctx.rollout);
}
