/**
 * The matches the report plays out. Decks without jokers have one row; the
 * decks with jokers get every joker rule. The four-colour deck, whose order is
 * in question, gets every order under the three joker rules that never leave
 * a joker stuck in hand.
 */
const row = (deck, jokerRule, order) => ({
  id: `${deck}-${jokerRule}-${order}`,
  deck,
  jokerRule,
  order,
});

export const SIMULATIONS = Object.freeze([
  row("original", "free", "original"),
  row("rapide", "free", "original"),
  ...["original", "swapped", "straightUp", "bothSwapped"].flatMap((order) => [
    row("classique", "free", order),
    row("classique", "onePerBorder", order),
    row("classique", "colorless", order),
  ]),
  row("classique", "onePerPlayer", "original"),
  row("tarot", "free", "original"),
  row("tarot", "onePerBorder", "original"),
  row("tarot", "onePerPlayer", "original"),
  row("tarot", "colorless", "original"),
]);

/**
 * The bot every simulated statistic uses. It plays Sami's habits and beat
 * the previous reference, `greedy`, head to head; the rows below are also
 * played by the previous bot so the report can show both results.
 */
export const REFERENCE_BOT = "strategist";
export const PREVIOUS_BOT = "greedy";
export const PREVIOUS_BOT_ROWS = Object.freeze([
  "original-free-original",
  "rapide-free-original",
  "classique-free-original",
  "classique-onePerBorder-original",
  "classique-colorless-original",
  "tarot-free-original",
  "tarot-colorless-original",
]);

/** Head to head on the recommended rules: each challenger against the previous bot. */
export const DUEL_ROW = row("classique", "colorless", "original");
export const DUEL_CHALLENGERS = Object.freeze([
  "strategist",
  "strategist:joker",
  "strategist:opening",
  "strategist:suited",
  "strategist:habits",
  "strategist:1.1",
]);

/**
 * Sami's solo test protocol (see `src/sim/engine/solo.js`), replayed by bots: the
 * plain greedy one and the one with his habits, on the recommended deck and
 * on the quick 6 × 7 version he knows.
 */
const ALL_HABITS = Object.freeze(["joker", "opening", "suited"]);
const solo = (deck, jokerRule, bot) => ({
  id: `solo-${deck}-${bot}`,
  deck,
  jokerRule,
  order: "original",
  bot,
  habits: bot === "greedy" ? null : ALL_HABITS,
});

export const SOLO_RUNS = Object.freeze([
  solo("classique", "colorless", "greedy"),
  solo("classique", "colorless", "strategist"),
  solo("rapide", "free", "greedy"),
  solo("rapide", "free", "strategist"),
]);

export const SAMPLE_SIZES = Object.freeze({
  full: {
    games: 2000,
    baselineGames: 1000,
    duelGames: 2000,
    soloGames: 2000,
    soloOptimumGames: 100,
    startingHands: 200000,
  },
  quick: {
    games: 150,
    baselineGames: 100,
    duelGames: 100,
    soloGames: 100,
    soloOptimumGames: 4,
    startingHands: 20000,
  },
});

export const SEED = 20260922;
