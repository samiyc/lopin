import { isJoker, valueOf } from "../../core/cards.js";
import { evaluatorFor } from "../engine/border-rules.js";
import { withEndJoker } from "./end-joker.js";

/**
 * `endUrgency` (core 1.2, Sami 08/10, from the endgame traps): once the pile is
 * empty, tactical urgency dominates over raw local formation scores.
 *
 * 1. Card cost is refunded: all remaining cards will be played anyway, so
 *    penalizing high cards in the endgame is counter-productive.
 * 2. Border completion priority: if a 2-card border wins against the opponent,
 *    finish it rather than scattering. If completing it loses, heavily penalize.
 * 3. Tactical arbitration when multiple 2-card borders exist: prioritize
 *    contested borders, match-point wins (4th border), and 3-adjacent threats.
 * 4. Joker discipline & anti-overkill: don't burn jokers or high cards when a
 *    cheaper natural winner already secures the border.
 */

function matchPointBonus(myScore, oppScore, ctx) {
  let bonus = 0;
  if (myScore > oppScore && ctx.myBorders === 3) bonus += 1.5;
  if (ctx.oppBorders === 3) bonus += 1.0;
  return bonus;
}

function sideCompletionBonus(state, move, ctx) {
  const border = state.borders[move.border];
  const oppSide = border.sides[ctx.opp];
  const mySide = [...border.sides[ctx.player], move.card];
  const myScore = evaluatorFor(state, move.border, ctx.player).score(mySide);

  if (oppSide.length === 3) {
    const oppScore = evaluatorFor(state, move.border, ctx.opp).score(oppSide);
    if (myScore <= oppScore) return -2.0;
    return 1.2 + matchPointBonus(myScore, oppScore, ctx);
  }
  // The measured version (08/10) gave 0.9 here to a side scoring 2 000 or more, a score no side
  // reaches (64 a formation rank, 286 at most): always 0.5. Kept so its figures still hold.
  if (oppSide.length === 2) return 0.5 + (ctx.myBorders === 3 ? 1.0 : 0);
  return (ctx.twoCards === 1 ? 0.5 : 0.3) + (ctx.myBorders === 3 ? 0.8 : 0);
}

function hasPair(borders, owner, a, b) {
  return borders[a]?.owner === owner && borders[b]?.owner === owner;
}

function threeInRow(borders, owner, b) {
  return hasPair(borders, owner, b - 2, b - 1) || hasPair(borders, owner, b + 1, b + 2) || hasPair(borders, owner, b - 1, b + 1);
}

function adjacencyBonus(borders, b, player, opp) {
  let bonus = 0;
  if (threeInRow(borders, player, b)) bonus += 0.7;
  if (threeInRow(borders, opp, b)) bonus += 0.6;
  return bonus;
}

function moveUrgencyBonus(state, move, ctx) {
  const mySide = state.borders[move.border].sides[ctx.player];
  const oppSide = state.borders[move.border].sides[ctx.opp];

  if (mySide.length === 2) {
    return sideCompletionBonus(state, move, ctx) + adjacencyBonus(state.borders, move.border, ctx.player, ctx.opp);
  }
  if (ctx.twoCards === 1) return -0.4;
  if (ctx.twoCards === 0 && oppSide.length === 2 && mySide.length === 0) return 0.3;
  return 0;
}

function hasWinningNaturalAlternative(state, move, ctx) {
  const border = state.borders[move.border];
  const oppSide = border.sides[ctx.opp];
  if (oppSide.length !== 3) return false;
  const oppScore = evaluatorFor(state, move.border, ctx.opp).score(oppSide);
  const mySide = border.sides[ctx.player];
  return ctx.moves.some((m) => m.border === move.border && !isJoker(m.card) && evaluatorFor(state, move.border, ctx.player).score([...mySide, m.card]) > oppScore);
}

function jokerPenalty(state, move, ctx) {
  if (!isJoker(move.card)) return 0;
  const oppSide = state.borders[move.border].sides[ctx.opp];
  let penalty = 0;
  if (oppSide.length === 0 && state.borders.some((b) => b.owner === null && b.sides[ctx.opp].length >= 2)) {
    penalty -= 0.6;
  }
  if (hasWinningNaturalAlternative(state, move, ctx)) {
    penalty -= 0.8;
  }
  return penalty;
}

function overkillPenalty(state, move, ctx) {
  if (isJoker(move.card)) return 0;
  const border = state.borders[move.border];
  const oppSide = border.sides[ctx.opp];
  if (oppSide.length !== 3) return 0;
  const oppScore = evaluatorFor(state, move.border, ctx.opp).score(oppSide);
  const mySide = border.sides[ctx.player];
  const myScore = evaluatorFor(state, move.border, ctx.player).score([...mySide, move.card]);
  if (myScore <= oppScore) return 0;
  const cardVal = valueOf(state.spec, move.card);
  const hasCheaperWinner = ctx.moves.some((m) => {
    if (m.border !== move.border || isJoker(m.card)) return false;
    const otherVal = valueOf(state.spec, m.card);
    return otherVal < cardVal && evaluatorFor(state, move.border, ctx.player).score([...mySide, m.card]) > oppScore;
  });
  return hasCheaperWinner ? -0.3 : 0;
}

export function withEndUrgency(state, moves, gainOf, { costOf, on }) {
  if (!on || state.pile.length > 0) return gainOf;

  const player = state.current;
  const opp = 1 - player;
  const myBorders = state.borders.filter((b) => b.owner === player).length;
  const oppBorders = state.borders.filter((b) => b.owner === opp).length;
  const twoCards = state.borders.filter((b) => b.owner === null && b.sides[player].length === 2).length;
  const ctx = { player, opp, myBorders, oppBorders, twoCards, moves };

  return (move) => {
    const bonus = costOf(move.card) + moveUrgencyBonus(state, move, ctx) + jokerPenalty(state, move, ctx) + overkillPenalty(state, move, ctx);
    return gainOf(move) + bonus;
  };
}

/** The core's endgame corrections, pile empty, in order: the joker priced by its best use (end-joker.js), then the urgency. */
export function withEndgame(state, moves, gainOf, { costOf, tuning }) {
  const priced = withEndJoker(state, moves, gainOf, { costOf, on: tuning.endJoker });
  return withEndUrgency(state, moves, priced, { costOf, on: tuning.endUrgency });
}
