/**
 * Is a family of ideas on? Read from `context.gates` (`gatesOf`, ideas.js),
 * worked out once per bot; a context built by hand, without gates, asks the
 * set itself through `fallback`.
 */
export const gateOn = (context, key, fallback) => (context.gates ? context.gates[key] : fallback(context.ideas));
