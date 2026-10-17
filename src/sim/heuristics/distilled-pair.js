/** Written by `npm run distill` (2026-10-05, 463 rounds of 6 probes): the 1.0's core tuned on the oracle's moves (distill.js). */
export const DISTILLED_CORE = Object.freeze({
  "strategy": {
    "openMiddle": 0.1,
    "openNewSuit": 0.1,
    "suitedStart": 0.2
  },
  "weights": {
    "middleSolid": 0.15,
    "middleWeak": 0.15,
    "spread": 0.6,
    "connector": 0.6,
    "stay": 0.6,
    "junk": 0,
    "noBlindOpen": 0
  },
  "params": {
    "temperature": 0.35,
    "jokerCost": 0.08,
    "cardCost": 0.02,
    "pairDiscount": 0.8673
  },
  "ideas": [
    "junk",
    "noBlindOpen"
  ]
});
