import { spawnSync } from "node:child_process";

/**
 * `npm test` (Sami, 28/10/2026, mcts-commun's slots: a short test takes 4 threads at most): `node --test` on every
 * test file, as many at once as `TEST_CONCURRENCY` says, else the threads `mcts-backlog --slot N` gave
 * (`MCTS_THREADS`), else 4 — by default node runs one file per core, 23 here. `--coverage` adds the coverage.
 */
const MAX_DEFAULT = 4;
const concurrency = Number(process.env.TEST_CONCURRENCY ?? process.env.MCTS_THREADS ?? MAX_DEFAULT) || MAX_DEFAULT;
const coverage = process.argv.includes("--coverage") ? ["--experimental-test-coverage"] : [];
// The glob is node's own (a bare `tests/` is read as a file from Node 22).
const run = spawnSync(process.execPath, ["--test", `--test-concurrency=${concurrency}`, ...coverage, "tests/**/*.js"], { stdio: "inherit" });
process.exit(run.status ?? 1);
