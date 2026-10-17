/** Written by `npm run distill` (2026-10-04, 218 rounds of 18 probes): the 1.0's core tuned on the oracle's moves (distill.js). */
export const DISTILLED_CORE = Object.freeze({
  "strategy": {
    "openMiddle": 0.0347,
    "openNewSuit": 0.1198,
    "suitedStart": 0.2588
  },
  "weights": {
    "middleSolid": 0.0854,
    "middleWeak": 0.0696,
    "spread": 0.5817,
    "connector": 0.7077,
    "stay": 1.0162,
    "junk": 0.2488,
    "noBlindOpen": 0.0747
  },
  "params": {
    "temperature": 0.2814,
    "jokerCost": 0.0386,
    "cardCost": -0.0058
  },
  "ideas": [
    "junk",
    "noBlindOpen"
  ]
});
