import { spawnSync } from "node:child_process";

/**
 * `npm test` (Sami, 28/10/2026, mcts-commun's slots: a short test takes 4 threads at most): `node --test` on every
 * test file, as many at once as `TEST_CONCURRENCY` says, else the threads `mcts-backlog --slot N` gave
 * (`MCTS_THREADS`), else 4 — by default node runs one file per core, 23 here. `--coverage` adds the coverage of the
 * code the tests load (not of the tests themselves), and fails under its floors (Sami, 31/10, as mcts-commun does):
 * a floor stops the coverage from sliding down unseen, it is not a goal.
 */
const MAX_DEFAULT = 4;
export const COVERAGE_FLOORS = Object.freeze({ lines: 95, branches: 90, functions: 90 });
const concurrency = Number(process.env.TEST_CONCURRENCY ?? process.env.MCTS_THREADS ?? MAX_DEFAULT) || MAX_DEFAULT;
const floors = Object.entries(COVERAGE_FLOORS).map(([kind, floor]) => `--test-coverage-${kind}=${floor}`);
const coverage = process.argv.includes("--coverage") ? ["--experimental-test-coverage", "--test-coverage-exclude=tests/**", ...floors] : [];
// The glob is node's own (a bare `tests/` is read as a file from Node 22).
const run = spawnSync(process.execPath, ["--test", `--test-concurrency=${concurrency}`, ...coverage, "tests/**/*.js"], { stdio: "inherit" });
process.exit(run.status ?? 1);
