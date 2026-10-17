import { buildDeck, isJoker } from "../../core/cards.js";
import { isFigure } from "../../core/figures.js";
import { getEvaluator } from "../../core/evaluator.js";
import { createRng } from "../../core/random.js";
import { figureMoves, playFigure } from "./figure-moves.js";
import { noteMove, peekIfDue, startKnowledge } from "./peek.js";
import { skipsDraw } from "./seat-rules.js";
import { checkVictory, claimBorders, decideByCount, isFull, resolveBorder, resolveFinal } from "./settle.js";

export { resolveFinal };

/**
 * The rules of a match, and nothing about how to play it.
 *
 * Two ways to settle borders, same winner:
 *
 * - `endMode: "early"` (the simulations): a border is resolved as soon as both
 *   sides hold three cards, and the game stops at the first victory.
 * - `endMode: "final"` (the web game): all 42 cards are played, then the
 *   borders are resolved in the order they filled up, and the first player to
 *   reach a victory in that order wins. Bots never look at who owns a border,
 *   and a resolved border is full anyway, so both modes pick the same winner;
 *   a test holds them to it.
 *
 * - `endMode: "claim-end"` (the web game, the printed rule): right after a
 *   move, the player who made it claims every border they can prove the
 *   opponent can no longer beat, from the cards on the table alone
 *   (`isClaimable`), then the opponent claims theirs — a card laid down can
 *   prove a border for either side. A claimed border takes no more cards, and
 *   the game stops at the first victory, the mover's first. Borders never
 *   claimed settle at the end, as in `final`. It changes which moves are
 *   legal, so it can change the winner.
 * - `endMode: "claim"`: the same, but claimed at the start of the claimer's
 *   next turn — the web game of 30/09, a move late. Kept so its replays read
 *   back as they were played.
 */
function buildShuffledDeck(spec, figures, deck, rng) {
  if (deck) return [...deck];
  const cards = figures.length > 0 ? [...buildDeck(spec), ...figures] : buildDeck(spec);
  return rng.shuffle(cards);
}

const resolvePileRng = (seed, rng) => (seed !== null && seed !== undefined ? createRng(seed + 7919) : (rng ?? createRng(1)));

const emptyBorders = (count) =>
  Array.from({ length: count }, () => ({
    sides: [[], []],
    completedAt: [Infinity, Infinity],
    owner: null,
    figures: [null, null],
  }));

/** The two starting hands, off the top of `pile`: `spec.handSize` each, or the sizes of a seat compensation. */
function dealHands(spec, pile, seat) {
  const [first, second] = seat?.handSizes ?? [spec.handSize, spec.handSize];
  return [pile.splice(0, first), pile.splice(0, second)];
}

/** What each seat saw by peeking (peek.js): null in the printed game; the base game only. */
function knowledgeOf(seat, figures) {
  if (!seat?.peek) return null;
  if (figures.length > 0) throw new Error("Regarder la pioche : le jeu de base seulement, sans figures");
  return startKnowledge();
}

/**
 * `seat` (`seat-rules.js`, off by default): a compensation for the first player — other hand sizes, or a look at
 * the top of the pile (`peek.js`).
 */
export function createGame(spec, { order, jokerRule, rng, endMode = "early", deck = null, figures = [], openHands = false, seed = null, seat = null }) {
  const shuffled = buildShuffledDeck(spec, figures, deck, rng);
  const pile = [...shuffled];
  const state = {
    spec,
    order,
    jokerRule,
    endMode,
    deck: shuffled,
    evaluator: getEvaluator(spec, order, jokerRule),
    pile,
    hands: dealHands(spec, pile, seat),
    borders: emptyBorders(spec.borders),
    openHands: Boolean(openHands),
    seat,
    known: knowledgeOf(seat, figures),
    rng,
    pileRng: resolvePileRng(seed, rng),
    seed,
    // The extension: figures in this game (the core leaves them out of the hands it weighs).
    withFigures: shuffled.some(isFigure),
    jokersPlayed: [0, 0],
    // Each player's last move, replaced (never mutated), so a cheap clone can share it.
    lastMoves: [null, null],
    current: 0,
    turn: 0,
    passes: 0,
    resolved: [],
    winner: null,
    winType: null,
    over: false,
  };
  if (state.known) peekIfDue(state);
  return state;
}

const jokersOn = (side) => side.filter(isJoker).length;

export function canPlace(state, player, card, borderIndex) {
  const border = state.borders[borderIndex];
  const side = border.sides[player];
  if (border.owner !== null || side.length >= 3 || isFigure(card)) return false;
  if (!isJoker(card)) return true;
  return (
    jokersOn(side) < state.jokerRule.maxPerSide &&
    state.jokersPlayed[player] < state.jokerRule.maxPerPlayer
  );
}

/** One move per distinct card and open border: two jokers are one choice. A figure has its own moves (figure-moves.js). */
export function legalMoves(state) {
  const player = state.current;
  const moves = [];
  for (const card of new Set(state.hands[player])) {
    if (isFigure(card)) {
      moves.push(...figureMoves(state, player, card));
      continue;
    }
    state.borders.forEach((_, border) => {
      if (canPlace(state, player, card, border)) moves.push({ card, border });
    });
  }
  return moves;
}

const allPlayed = (state) => state.pile.length === 0 && state.hands.every((hand) => hand.length === 0);

/** Plays `move`, or passes when it is null (no legal move left). */
export function applyMove(state, move) {
  const player = state.current;
  if (move === null) {
    state.passes += 1;
    if (state.passes >= 2) endOnExhaustion(state);
  } else {
    if (isFigure(move.card)) layFigure(state, player, move);
    else placeCard(state, player, move);
    state.passes = 0;
  }
  state.turn += 1;
  state.current = 1 - player;
  if (!state.over && state.endMode !== "early") settleAfter(state, player, move);
  if (state.known) peekIfDue(state);
}

/** What the end modes settle once a move (or a pass) is made. */
function settleAfter(state, player, move) {
  if (state.endMode === "claim") claimBorders(state, state.current);
  if (state.endMode === "claim-end" && move !== null) claimAfterMove(state, player);
  if (!state.over && allPlayed(state)) resolveFinal(state);
}

/** `claim-end`: the mover claims first, so a double victory is theirs. */
function claimAfterMove(state, player) {
  claimBorders(state, player);
  if (!state.over) claimBorders(state, 1 - player);
}

/** A figure laid: its effect, then the draw — but for the Rappel, which already gave a card back. */
function layFigure(state, player, move) {
  const draws = playFigure(state, player, move);
  if (draws && state.pile.length > 0) state.hands[player].push(state.pile.pop());
}

function placeCard(state, player, { card, border }) {
  const hand = state.hands[player];
  hand.splice(hand.indexOf(card), 1);
  const target = state.borders[border];
  target.sides[player].push(card);
  if (isJoker(card)) state.jokersPlayed[player] += 1;
  state.lastMoves = state.lastMoves.map((last, seat) => (seat === player ? { card, border } : last));
  if (target.sides[player].length === 3) target.completedAt[player] = state.turn;
  drawAfter(state, player, card);
  if (state.endMode === "early" && isFull(target)) {
    const winner = resolveBorder(state, border);
    checkVictory(state, winner);
  }
}

/** The draw after a card laid (none on a seat compensation's skipped turn); under a peek, what each seat still knows. */
function drawAfter(state, player, card) {
  const drawn = state.pile.length > 0 && !skipsDraw(state, player) ? state.pile.pop() : null;
  if (drawn !== null) state.hands[player].push(drawn);
  if (state.known) noteMove(state, player, card, drawn);
}

/** Nobody can play: settle what is left, then more borders wins, equal is a draw. */
function endOnExhaustion(state) {
  if (state.endMode !== "early" && !state.finalResolved) return resolveFinal(state);
  return decideByCount(state);
}

/** Runs a match to its end; `bots[p].choose(state, moves)` picks a move. */
export function playGame(spec, { order, jokerRule, rng, bots, endMode = "early", deck = null, openHands = false, seat = null }) {
  const state = createGame(spec, { order, jokerRule, rng, endMode, deck, openHands, seat });
  const guard = spec.borders * 6 * 3;
  while (!state.over && state.turn < guard) {
    const moves = legalMoves(state);
    applyMove(state, moves.length > 0 ? bots[state.current].choose(state, moves) : null);
  }
  return state;
}
