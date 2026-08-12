import { defineConfig } from 'vitest/config';

// The db suite (test/db) stands up a PGlite (WASM Postgres) per test FILE in its
// beforeAll hook, by loading test/db/fixtures/schema_snapshot.sql.
//
// That load costs ~1.5-2.5s on an idle machine. It is not slow. But vitest runs
// test files in parallel across one worker per core, and every worker pays that
// cost at once — 68 files each instantiating their own WASM Postgres. Under that
// contention a 1.5s setup was measured spiking past 5s, and past vitest's DEFAULT
// 10s hookTimeout often enough to kill most of the suite: 64 of 68 files failed
// with "Hook timed out in 10000ms" and 651 of 688 tests were never reached.
//
// The setup was never too slow — the default budget was too tight to survive its
// own parallelism, and the failure was load-dependent (the count moved run to run).
// 60s is ~25x the measured idle cost, so a loaded machine cannot reintroduce this.
//
// NOTE: capping `maxWorkers` (4 was measured) does not change what passes — it only
// reduces thrash: internal test time fell 1201s -> 680s at identical wall clock and
// identical results. It is deliberately NOT set here so bigger machines stay fast.
export default defineConfig({
  test: {
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
