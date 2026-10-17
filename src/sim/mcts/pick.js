/** How a bot picks among scored moves (`bots.js`). */

/**
 * A move drawn with probability ∝ exp(gain / `temperature`): rollouts that
 * do not always repeat the core's favourite, so its blind spots do not
 * decide every simulated game the same way.
 */
export function pickSampled(scored, rng, temperature) {
  const top = Math.max(...scored.map(({ gain }) => gain));
  const weights = scored.map(({ gain }) => Math.exp((gain - top) / temperature));
  let draw = rng.next() * weights.reduce((sum, weight) => sum + weight, 0);
  for (const [i, weight] of weights.entries()) {
    draw -= weight;
    if (draw <= 0) return scored[i].move;
  }
  return scored.at(-1).move;
}

/** The highest gain, ties broken at random. */
export function pickBest(scored, rng) {
  let best = [];
  let bestGain = -Infinity;
  for (const { move, gain } of scored) {
    if (gain > bestGain + 1e-9) [best, bestGain] = [[move], gain];
    else if (gain > bestGain - 1e-9) best.push(move);
  }
  return best[rng.int(best.length)];
}

function cardLimit(card, leadCard, secondCard, diverse) {
  if (diverse === "lead2" || diverse === "2-1") return card === leadCard ? 2 : 1;
  if (diverse === "cap321" || diverse === "321") {
    if (card === leadCard) return 3;
    if (card === secondCard) return 2;
    return 1;
  }
  return diverse;
}

const secondCardOf = (sorted, lead) => sorted.find(({ move }) => move.card !== lead)?.move?.card;

function pickDiverse(sorted, candidates, diverse) {
  const picked = [];
  const counts = new Map();
  const leadCard = sorted[0]?.move?.card;
  const secondCard = secondCardOf(sorted, leadCard);
  for (const { move } of sorted) {
    const count = counts.get(move.card) ?? 0;
    if (count < cardLimit(move.card, leadCard, secondCard, diverse)) {
      picked.push(move);
      counts.set(move.card, count + 1);
      if (picked.length === candidates) break;
    }
  }
  return picked;
}

/**
 * Shortlist candidates at the root of a search (`ismcts.js`): highest gains first,
 * optionally capped or diversified per distinct card (`diverse`: 1 = 1 per card first, 2+ = max per card, "lead2" / "2-1" = 2 on lead card, 1 on others).
 */
export function pickCandidates(scored, candidates, diverse = 0) {
  const sorted = [...scored].sort((a, b) => b.gain - a.gain);
  if (!diverse || sorted.length <= candidates) {
    return sorted.slice(0, candidates).map(({ move }) => move);
  }
  const picked = pickDiverse(sorted, candidates, diverse);
  for (const { move } of sorted) {
    if (picked.length >= candidates) break;
    if (!picked.includes(move)) picked.push(move);
  }
  return picked;
}

/** The phased cap (Sami, 10/10): "cap321" over the first four half-moves of the game (`state.turn` 0 to 3), 2 from the fifth on. */
const PHASED = "cap321_2";
const PHASED_UNTIL = 4;

/** The named caps `diverse` and `rootDiverse` take beside a number. */
const DIVERSE_NAMES = Object.freeze(["lead2", "2-1", "cap321", "321", PHASED]);

/** A `diverse` or `rootDiverse` value of an engine id (ismctsSettings): a number, or a named cap — any other name is refused. */
export function parseDiverse(value) {
  if (!Number.isNaN(Number(value))) return Number(value);
  if (!DIVERSE_NAMES.includes(value)) throw new Error(`Diversité inconnue : « ${value} » (connues : ${DIVERSE_NAMES.join(", ")})`);
  return value;
}

/** The root's cap at `state`: the phased one resolved, any other as given. */
export function resolveDiverse(div, state) {
  if (div !== PHASED) return div;
  return (state?.turn ?? 0) < PHASED_UNTIL ? "cap321" : 2;
}

/** The cap under the root: 2 for the phased one, any other as given. */
export const treeDiverseOf = (div) => (div === PHASED ? 2 : div);
