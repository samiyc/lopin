import { isFigure } from "../../core/figures.js";
import { createRng } from "../../core/random.js";
import { applyMove, legalMoves } from "../engine/game.js";
import { dealKnowing, knowsHidden } from "../engine/peek.js";
import { unseenCards } from "../eval/potential.js";

/**
 * Looking ahead by playing the game out. The strategist judges a move by what
 * it does to one border; this bot takes the strategist's best few moves and,
 * for each, plays the rest of the game many times — the cards it cannot see
 * (the opponent's hand and the pile) dealt at random each time, both sides
 * then played by a fast policy bot — and keeps the move that wins most often.
 *
 * Every candidate is played out on the same deals (common random numbers),
 * so the comparison between candidates is not drowned in deal-to-deal noise.
 * The deals are seeded from the bot's seed and the turn: scoring the same
 * position twice gives the same answer, so a logged choice can be re-scored.
 */
export const LOOKAHEAD = Object.freeze({ candidates: 4, rollouts: 16, prior: 0.3 });

/** A deep enough copy of a game to play on without touching the original. */
export function cloneState(state) {
  return {
    ...state,
    pile: [...state.pile],
    pileRng: state.pileRng?.clone?.() ?? state.pileRng,
    hands: state.hands.map((hand) => [...hand]),
    borders: state.borders.map((border) => ({ sides: border.sides.map((side) => [...side]), completedAt: [...border.completedAt], owner: border.owner, figures: border.figures && [...border.figures] })),
    jokersPlayed: [...state.jokersPlayed],
    resolved: state.resolved.map((entry) => ({ ...entry })),
  };
}

/**
 * The game as `player` might find it: their own hand and the board as they
 * are, the cards they cannot see shuffled into the opponent's hand and the pile
 * — or, given `hand` (a guess of the opponent's, infer.js), that hand and the
 * rest shuffled into the pile. `known`: `unseenList(state, player)`, worked out once
 * by a search that deals the same position thousands of times; it is copied, not dealt.
 */
export function determinize(state, player, rng, { hand, known } = NO_GUESS) {
  const unseen = known ? [...known] : unseenList(state, player);
  const copy = playable(state, rng);
  // A seat compensation (peek.js): the cards the player saw stay where they are.
  if (!hand && knowsHidden(state, player)) return dealKnowing(copy, state, player, { rng, unseen });
  if (state.openHands) {
    copy.hands[1 - player] = [...state.hands[1 - player]];
    copy.pile = rng.shuffle(withoutCards(unseen, state.hands[1 - player]));
    return copy;
  }
  if (hand) {
    copy.hands[1 - player] = [...hand];
    copy.pile = rng.shuffle(withoutCards(unseen, hand));
    return copy;
  }
  rng.shuffle(unseen);
  const theirs = copy.hands[1 - player].length;
  copy.hands[1 - player] = unseen.slice(0, theirs);
  copy.pile = unseen.slice(theirs);
  return copy;
}

/** Every card `player` cannot see, one entry per copy, in deck order, the figures last: what `determinize` deals. */
export function unseenList(state, player) {
  return [...unseenCards(state, player).entries.flatMap(([card, count]) => Array.from({ length: count }, () => card)), ...hiddenFigures(state, player)];
}

/**
 * The game as it truly is (Omniscient 1.0, `+omniscient=1`): both hands and the
 * pile's order seen, nothing dealt. Rollouts settle borders at the end, as from
 * `determinize`.
 */
export function seeAll(state, rng) {
  return playable(state, rng);
}

const NO_GUESS = Object.freeze({ hand: null, known: null });

/** A copy to deal and play on, its draws from `rng`. */
function playable(state, rng) {
  const copy = cloneState(state);
  copy.pileRng = rng;
  copy.rng = rng;
  // Rollouts settle borders at the end: proving claims on every simulated move
  // would cost a third of the search speed, as the certainty in 0.6 did.
  if (copy.endMode.startsWith("claim")) copy.endMode = "final";
  return copy;
}

/** The extension's figures `player` cannot see: in the deck, not in their hand, not laid. None in the base game. */
function hiddenFigures(state, player) {
  const figures = state.deck.filter(isFigure);
  if (figures.length === 0) return figures;
  const seen = new Set([...state.hands[player], ...state.borders.flatMap((border) => border.figures ?? [])]);
  return figures.filter((figure) => !seen.has(figure));
}

/** The cards of `all` left once one of each card of `taken` is removed. */
export function withoutCards(all, taken) {
  const rest = [...all];
  for (const card of taken) rest.splice(rest.indexOf(card), 1);
  return rest;
}

/** Plays `game` to its end with `policy` on both sides; returns the winner (or null). */
export function playOut(game, policy) {
  const guard = game.spec.borders * 6 * 3;
  while (!game.over && game.turn < guard) {
    const moves = legalMoves(game);
    applyMove(game, moves.length > 0 ? policy.choose(game, moves) : null);
  }
  return game.winner;
}

const pointsFor = (winner, player) => {
  if (winner === null) return 0.5;
  return winner === player ? 1 : 0;
};

/** The `count` best moves of `scored`, refused ones last. */
function shortlist(scored, count) {
  return [...scored].sort((a, b) => Number(Boolean(a.refused)) - Number(Boolean(b.refused)) || b.gain - a.gain).slice(0, count);
}

/** The shortlist, with `move` added when it is neither in it nor refused: a human's move judged on the same endgames (the replay advice). */
function withMove(picked, scored, move) {
  const entry = move ? scored.find((candidate) => candidate.move.card === move.card && candidate.move.border === move.border) : null;
  return !entry || entry.refused || picked.includes(entry) ? picked : [...picked, entry];
}

/**
 * `base`: the bot whose scores pick the candidates; `policy(rng)`: builds the
 * bot that plays the rollouts (both usually the strategist) — rebuilt on the
 * turn's seed at every scoring, so its tie-breaks repeat too. A candidate's gain becomes
 * its share of won rollouts (0 to 1), plus `prior` times its base score — 16
 * rollouts separate moves only so finely, and the base score carries the
 * habits and ideas; the others rank below every candidate, in base order.
 */
export function lookaheadBot(rng, { base, policy, name = "lookahead", ...settings }) {
  const { candidates, rollouts, prior } = { ...LOOKAHEAD, ...settings };
  const seed = rng.int(2 ** 31);
  const scoreMoves = (state, moves, options = {}) => {
    const scored = base.scoreMoves(state, moves, options);
    if (moves.length <= 1) return scored;
    const player = state.current;
    // `options.include`: a move to judge as well, whatever its score (src/replay/stats/advice.js).
    const picked = withMove(shortlist(scored, candidates), scored, options.include);
    const points = picked.map(() => 0);
    const deals = createRng(seed ^ Math.imul(state.turn + 1, 2654435761));
    const rollout = policy(createRng(deals.int(2 ** 31)));
    for (let r = 0; r < rollouts; r += 1) {
      const deal = determinize(state, player, deals);
      picked.forEach(({ move }, i) => {
        const game = cloneState(deal);
        applyMove(game, move);
        points[i] += pointsFor(playOut(game, rollout), player);
      });
    }
    const judged = new Map(picked.map((entry, i) => [entry, points[i] / rollouts + prior * entry.gain]));
    return scored.map((entry) => ({ ...entry, gain: judged.has(entry) ? judged.get(entry) : -1 + entry.gain / 100 }));
  };
  return {
    name,
    scoreMoves,
    choose: (state, moves) => {
      const scored = scoreMoves(state, moves);
      const top = Math.max(...scored.map((entry) => entry.gain));
      const best = scored.filter((entry) => entry.gain > top - 1e-9);
      return best[rng.int(best.length)].move;
    },
  };
}
