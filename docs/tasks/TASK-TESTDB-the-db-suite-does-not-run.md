# TASK TESTDB — 60 of 68 DB test files fail, and 601 of 688 tests never run

**Plan of attack item 5.** This is the force multiplier: **every database claim made in this
project for the last week has been hand-verified with `psql` because the suite cannot be
trusted.** Fixing it makes every task after it cheaper and safer.

---

# MEASURED 2026-08-12 — run it yourself first, these are from `npm run test:db`

```
Test Files   60 failed | 8 passed  (68)
Tests        16 failed | 71 passed | 601 SKIPPED  (688)
Duration     105s
```

**601 skipped is the number that matters.** Most tests are not failing — they are never
reached, because their file's setup hook dies first.

## The distinct causes, counted

```
26  Error: Hook timed out in 10000ms.                                    <- THE HEADLINE
 3  TypeError: Cannot read properties of undefined (reading 'code')
 1  relation "offering_tiers" does not exist
 1  function create_purchase_engagement(...) does not exist
 1  Cannot find module '../../src/lib/catalog'
 1  products_module_key_fkey violation
 1  organizations_display_code_key duplicate
 1  TypeError: Cannot read properties of undefined (reading 'display_name')
```

**One cause accounts for 26 files. The rest is a short tail of tests referencing things that
were deliberately retired.**

---

# FIX IN THIS ORDER — the first one may resolve most of it

## 1. The 10-second hook timeout

`beforeAll` / `beforeEach` sets up a PGlite instance — a WASM Postgres — **and applies the
migration journal**. `supabase/migrations/` has grown all year. **10 seconds is very likely no
longer enough to stand up a database**, and when the hook times out every test in that file is
skipped, which is exactly the 601.

**Establish this before changing anything:** time one setup hook in isolation. If it takes >10s,
raise the timeout to something with real headroom and **re-run the whole suite before touching
anything else.** Report the new pass/fail counts.

**Do not fix the other seven causes until you know how many survive this one.** Several may be
downstream of it.

**If the setup is slow enough to need a large timeout, say so and quantify it** — a suite that
takes minutes to stand up per file is its own problem, and sharing one prepared database across
files may be the real fix. **Report that recommendation; do not rebuild the harness in this
task.**

## 2. Tests referencing RETIRED things

These reference concepts `CLAUDE.md` explicitly lists as removed. **They are not broken code —
they are tests nobody deleted when the thing they tested was deleted.**

- **`offering_tiers`** — the tier layer was **removed 2026-07-08**. *"There is no tier layer…
  Each offering IS the purchasable item."*
- **`create_purchase_engagement`** — `engagements` is on the RETIRED list.
- **`src/lib/catalog`** — one of the two hardcoded shadow catalogs, **deleted deliberately**.
  `test/db/purchase_catalog_matrix.test.ts` imports a file that no longer exists.

**For each: decide whether the test covers behaviour that still exists under a new name, or
behaviour that is genuinely gone.**

- **Still exists, renamed** → point the test at the current thing.
- **Genuinely gone** → **delete the test**, and say so plainly in the report with the
  `CLAUDE.md` line that retired it.

**This is the one place in this project where deleting IS correct** — a test for a deleted
feature is not evidence, it is noise. **Every deletion must name what retired it.**

## 3. Seed and isolation failures

- `products_module_key_fkey` — seed inserts a product with a `module_key` that does not exist.
- `organizations_display_code_key` duplicate — **a test isolation problem**: two tests creating
  an org with the same display code, or state leaking between files.

**The isolation one is worth understanding rather than patching.** If tests share a database and
leak, the fix is the harness, not the assertion.

## 4. The three `reading 'code'` and one `reading 'display_name'` type errors

Undefined where an object was expected. **Read what the assertion expected and what the query
returned** — these are usually a schema drift the test never caught up with, and each one may be
a real finding about production.

---

# ⚠️ WHAT MUST NOT HAPPEN

- **Do not `skip` a test to make the suite green.** A skipped test is the state we are fixing.
  If a test cannot pass, **delete it with a reason or fix it** — do not silence it.
- **Do not change production code to satisfy a test.** If a test is right and the code is wrong,
  **that is a finding — report it and stop.** Several of these may be real defects.
- **Do not touch `supabase/migrations/`.** The journal is hand-maintained and ~31 migrations
  rewrite function bodies in place; they are **not safe to replay on a fresh database** and this
  is a pre-existing property of the repo, not something to fix here. **If the harness's migration
  replay is the cause, say so — that is a finding, not a licence to edit migrations.**
- **Do not rewrite the harness.** Timeout, stale references, seed data. If the harness is the
  real problem, **report it with evidence and stop.**

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-testdb`, branch `task/testdb`, off `origin/main`.
  **Never `~/Desktop`.** Do not push.
- **`TASK-TEXTEDIT` and `TASK-PAGEVIS` are running.** Neither should touch `test/db`, but
  **rebase before you finish.**
- **Do not edit `src/` unless a test proves a production defect** — and then report before
  fixing.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.**
- Report **before and after counts** for files, tests, passed, failed and **skipped** — the last
  is the real measure.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. The pass/fail/skip counts are reported before and after, and **skipped drops sharply**.
2. The hook-timeout cause is diagnosed with a measurement, not a guess, and the suite is re-run
   before the tail is touched.
3. Every deleted test names the `CLAUDE.md` decision that retired the thing it tested.
4. **No test was silenced with `skip` or `only` to make the suite green.**
5. Any production defect the suite exposes is reported, not quietly patched.

Report to `docs/reports/TASK-TESTDB-REPORT.md`.
