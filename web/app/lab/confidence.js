/**
 * How sure a bot was of each card and border (the Labo, Sami 17/10), PURE: from the root's candidates of a tree search
 * (`rootStats`, src/sim/mcts/tree-snapshot.js), a tone per candidate measured against the move played.
 *
 * - `sure`: the move played, or one the tree cannot tell from it — its interval reaches the played move's and its
 *   rate is within `SURE_GAP`;
 * - `poor`: clearly behind, its whole interval under the played move's;
 * - `maybe`: in between;
 * - `unseen`: a card none of the candidates plays (or never visited): the tree did not look at it.
 */
export const SURE_GAP = 0.03;

const keyOf = (move) => (move ? `${move.card}@${move.border}` : "pass");

/** The entry the others are measured against: the move played, or the most visited. */
export function referenceOf(root, played) {
  const key = played ? keyOf(played) : null;
  return root.find((entry) => entry.key === key) ?? root.reduce((a, b) => (b.visits > a.visits ? b : a), root[0]);
}

/** One candidate's tone against `reference`. */
export function toneOf(entry, reference) {
  if (!entry || entry.visits === 0 || entry.rate === null) return "unseen";
  if (entry.key === reference.key) return "sure";
  if (entry.high < reference.low) return "poor";
  return entry.rate >= reference.rate - SURE_GAP ? "sure" : "maybe";
}

/** Each candidate with its tone, in the root's order. */
export const tonedCandidates = (root, played) => {
  const reference = referenceOf(root, played);
  return root.map((entry) => ({ ...entry, tone: toneOf(entry, reference) }));
};

/**
 * A tone per card of `hand` (card ids): its best candidate's (the most visited move that plays it), `unseen` when no
 * candidate plays it. Map card id → `{ tone, entry }`.
 */
export function cardTones(root, played, hand) {
  const toned = tonedCandidates(root, played);
  return new Map(
    hand.map((card) => {
      const mine = toned.filter((entry) => entry.move?.card === card && entry.visits > 0);
      const entry = mine.reduce((a, b) => (b.visits > a.visits ? b : a), mine[0]);
      return [card, { tone: entry ? entry.tone : "unseen", entry: entry ?? null }];
    }),
  );
}

/** For one card, each border a candidate puts it on, with that move's tone: Map 0-based border → toned entry. */
export function borderTones(root, played, card) {
  return new Map(tonedCandidates(root, played).filter((entry) => entry.move?.card === card).map((entry) => [entry.move.border, entry]));
}
