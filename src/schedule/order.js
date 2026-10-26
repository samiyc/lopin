/**
 * Which job of the backlog runs next: mcts-commun's `schedule` (Sami, 26/10/2026: the scheduler brought into the
 * shared library, lopin no longer keeps its own copy). It was this file, moved there unchanged on 23/10; it stays the
 * same rule: prerequisites (`after`, and the duels a `stopIf` reads, for the order only), a `due` it would miss, then
 * Smith's rule on `priority` and `estimate`. The Ordonnanceur tab (web/app/scheduler/) and the night simulator
 * (night.js) import it from here; the page finds the library through its import map (web/index.html).
 *
 * One end more than before: `cancelled`, a job cancelled by hand (`mcts-backlog --cancel`), which blocks the jobs
 * after it as a failed one does.
 */
export * from "mcts-commun/schedule.js";
