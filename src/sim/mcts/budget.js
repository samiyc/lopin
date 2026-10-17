/**
 * How many iterations each move of a tree search gets (`ismcts.js`). By
 * default `budget` a move — or `budgetMs` on a clock — times `factor` (the
 * turning-point `pivot`). Two ways to spend the same total elsewhere
 * (evol-exp-090), off by default:
 *
 * - `late` / `early`: from `LATE_TURN` on — where a random error costs a fifth
 *   of the games (`npm run error-impact`) — `late` times the budget, before it
 *   `early` times, so that a whole game costs about the same;
 * - `smart`: a move stops as soon as its leader cannot be caught with what is
 *   left of its budget (after `SMART.min` iterations); what it saved goes to a
 *   reserve, which a close call (the two most visited moves within `SMART.close`)
 *   then draws on, up to `SMART.cap` times the budget.
 *
 * `usage` counts the moves searched and the iterations spent, to check that a
 * variant really costs what the default does.
 */
export const LATE_TURN = 22;
export const SMART = Object.freeze({ min: 300, every: 50, close: 0.15, cap: 3 });

/** The visits of the two most visited root moves. */
function topTwo(search) {
  const visits = search
    .scored()
    .map(({ gain }) => gain)
    .sort((a, b) => b - a);
  return [visits[0] ?? 0, visits[1] ?? 0];
}

/** May a search past its own budget go on? Only on a close call, while the reserve lasts. */
function mayExtend(search, spent, base, wallet) {
  if (wallet.saved <= 0 || spent >= SMART.cap * base) return false;
  const [first, second] = topTwo(search);
  return first - second <= SMART.close * first;
}

/** Has the leader moved out of reach of what is left? Checked every `SMART.every` iterations. */
function settled(search, spent, base) {
  if (spent < SMART.min || spent % SMART.every !== 0) return false;
  const [first, second] = topTwo(search);
  return first - second > base - spent;
}

/** One move of a `smart` search: stop early and bank the rest, or draw on the bank for a close call. */
function runSmart(search, base, wallet) {
  let spent = 0;
  while (!search.done()) {
    if (spent < base && settled(search, spent, base)) {
      wallet.saved += base - spent;
      break;
    }
    if (spent >= base && !mayExtend(search, spent, base, wallet)) break;
    if (spent >= base) wallet.saved -= 1;
    search.step();
    spent += 1;
  }
  return spent;
}

/** `run(search, turn, factor)`: searches one move and returns the search; `usage`: `{ moves, iterations }`. */
export function createBudget({ budget, budgetMs = Infinity, late = 1, early = 1, smart = 0 }) {
  const wallet = { saved: 0 };
  const usage = { moves: 0, iterations: 0 };
  const run = (search, turn, factor = 1) => {
    const scale = factor * (turn >= LATE_TURN ? late : early);
    const before = search.rollouts();
    if (smart) runSmart(search, Math.round(budget * scale), wallet);
    else {
      const until = performance.now() + budgetMs * scale;
      while (!search.done() && search.rollouts() < budget * scale && performance.now() < until) search.step();
    }
    usage.moves += 1;
    usage.iterations += search.rollouts() - before;
    return search;
  };
  return { run, usage };
}
