# TASK-GRANTS-V — verify that the anon door closed, and that it closed on nothing it should not have

**Profile: `VRFY` (`docs/method/VRFY-PROFILE.md`) — independent verification. You did not build this and
you change NOTHING. Worktree `wt-11`. Thread name `FHE-TASK-GRANTS-V`.**
**Dispatched by `FHE-MGMT-GRANTS` 2026-09-03. Bundle: `docs/orch/BUNDLE-GRANTS.md`. Hand this back to
`FHE-MGMT-GRANTS`** — not to ORCH, not to the owner.

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/VRFY-PROFILE.md` — what PROVEN means here. `docs/method/TASK-ROLE.md` — the standing
>   requirements. `docs/method/CLNR-ROLE.md` §3 — your zeroth act (**record, do not move**: six
>   worktrees are live).
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-GRANTS-V-LEDGER.md` FIRST.
> - 🔒 **`docs/reports/TASK-GRANTS-B-REPORT.md`** — the claims you are testing. Its §2 criteria 4–8 and
>   its §3 196-row before/after `proacl` table are what you re-run.
> - 🔒 **THE SPEC — read it from `bundle/grants`, NOT from the branch you check out. See ⚠️ TRAP 1.**
>   `docs/tasks/TASK-GRANTS-B-close-the-anon-door-on-every-writer-nothing-anonymous-calls.md`
> - 🔒 **`docs/reports/FHE-TASK-GRANTS-A-ANON-WRITERS.md` §`## RULING`** (on `bundle/grants`) — the
>   owner's ruling, which is the authority on which functions KEEP `anon`.
> - `CLAUDE.md` **D35** (a green check from an hour ago is not evidence — re-run at YOUR time).

---

## WHAT YOU ARE VERIFYING

| | |
|---|---|
| task | `TASK-GRANTS-B` — one ACL-only migration + four stale-comment edits |
| branch | `task/grants-b`, tip **`7f2b36ff`** (3 commits: `05069b76` · `d844cf36` · `7f2b36ff`) |
| built in | `wt-2` — ⚠️ **NOT your tree. Take `wt-11`, detached** (`VRFY-PROFILE.md`) |
| applied to production | 2026-09-03 **11:31 PDT**, `supabase/migrations/20260903T1130_the_anon_door_closes_on_every_writer_nothing_anonymous_calls.sql` |
| `origin/main` MGMT intends to merge onto | **`c12d711e`** as of 2026-09-03 12:2x PDT — ⚠️ **it moves; `git fetch` and say what you actually dry-ran onto** |
| merges into | `bundle/grants` (**not** `main`) — see ⚠️ TRAP 1 |

## ⚠️ TWO TRAPS THAT WILL PRODUCE A FALSE VERDICT — read both before you start

### 🔒 TRAP 1 — THE SPEC IN THE BRANCH YOU CHECK OUT IS THE **PRE-RULING** COPY
`task/grants-b` was cut from `origin/main` @ `aa8d347c`. The owner's ruling (CR-116) and the spec
amendment that carries it were committed to **`bundle/grants` @ `1e421e45`**, and `origin/main` **does
not have them** (verified by MGMT 12:20 PDT: `git show origin/main:…TASK-GRANTS-B….md | grep -c "KEEP —
ONE function"` → **0**).

**So the spec inside `task/grants-b`'s tree still says `open_gift` is a KEEP. It is NOT.** The owner
ruled REVOKE on `open_gift` and `redeem_gift`; `submit_public_request` is the only KEEP.
🔒 **Read the spec and the `## RULING` from `bundle/grants` (`git show bundle/grants:<path>`).**
⚠️ **A verdict of DOES NOT HOLD reached by reading the branch's own spec copy is the trap firing, not a
finding.** The builder handled this correctly — its report §2 opens with a RULING gate.

### 🔒 TRAP 2 — DIFF AGAINST THE RIGHT MERGE-BASE, OR YOU WILL FLAG 13 FILES THAT ARE NOT `-B`'s
`bundle/grants` and `task/grants-b` branched from different points on `main`, so
`git merge-base bundle/grants task/grants-b` reaches back to `6790396f` and its diff shows **19 files**,
13 of which are ORCH's and other bundles' work inherited from `main` (DASHBOARDS/FUNNELDEBT ledgers, the
CR ledger, the board…). **Those are not out-of-ownership edits.**
🔒 **The diff that isolates `-B`'s own work is against the `main` it branched from:**
```
git diff $(git merge-base origin/main task/grants-b)..task/grants-b        # = aa8d347c..7f2b36ff
```
**MGMT ran it 12:2x PDT: exactly SIX files** — the migration, `api/deliver-document.ts`,
`src/lib/contact.ts`, `src/pages/app/Onboarding.tsx`, the report, the `-B` ledger. **Confirm that count
yourself. A seventh file is a real finding.**

## THE TEST — what your file must carry, claim by claim

**Every row: the query or command, the output, HOLDS / DOES NOT HOLD. Mark each row DB-STATE or DIFF
(`VRFY-PROFILE.md`) — MGMT re-runs the DB-STATE rows before pushing if `main` moves.**

1. **THE DIFF.** The six files above, whole. ⚠️ **Read the migration end to end** — 195 statements, and a
   wrong signature in any one of them is a door left open or a function you did not mean to touch.
   **Prove it contains zero `GRANT`, `CREATE`, `DROP`, `ALTER`, `COMMIT`** (MGMT's grep found none).
   Dry-run the merge onto the `origin/main` you fetched.
2. **THE HEADLINE, IN PRODUCTION, AT YOUR TIME.** Re-run the population query (report §2 criterion 8).
   MGMT's independent run at **12:20:15 PDT**: `secdef_total 675 · anon_exec 134 · anon_trigger 0 ·
   anon_event_trigger 0`. **State your timestamp.** ⚠️ **If your `anon_exec` is not 134, something else
   landed — say what.**
3. 🔒 **THE RULING HELD, BOTH WAYS.** `has_function_privilege('anon', …)`:
   **`submit_public_request` = t** (the ONLY ruled KEEP — if this is `f`, the public contact form is
   dead and the verdict is DOES NOT HOLD, whatever else passed) ·
   **`open_gift` = f · `redeem_gift` = f** (the owner's ruling, which overruled the DSNR recommendation).
   MGMT's 12:20 run: t · f · f.
4. **CRITERIA 4–8 OF THE SPEC, RE-RUN VERBATIM** — they are pasteable from report §2. Every revoked
   name shows `anon` = f; group S shows `authenticated` = f **and `service_role` = t**; the population
   arithmetic states itself.
5. 🔒 **NO BODY CHANGED — THE CLAIM THIS BUNDLE LIVES OR DIES ON.** The bundle owns ACLs and never a
   body. Re-run `md5(pg_get_functiondef(oid))` for all 196 and compare against report §3's before
   column. ⚠️ **A single differing md5 is DOES NOT HOLD** — it would mean an ACL-only bundle rewrote a
   function another bundle owns.
6. **THE FOUR COMMENT EDITS.** Exactly three source files touched, and
   `src/components/ops/documents/MergedBodyView.tsx` is **not** among them (it was already fixed by
   `d78d3b3c`). The replacements say what the code now does — read the code, not just the comment.
7. **THE RECURRING FAILURE TABLE** (`ORCHESTRATOR.md` §3), row by row against THIS diff. The rows that
   bite here: **`proacl` before/after for every touched function** · **`DROP FUNCTION`/`CREATE` absent**
   (default privileges re-grant `anon` on a fresh function — that is the trap this whole bundle exists
   for) · **a function with two overloads** (see routed finding 3 below — confirm the migration named
   full signatures, not bare names).
8. **THE GATES, YOUR NUMBERS.** `typecheck` · `typecheck:api` · `lint` · `build`. Baseline is
   **45 problems / 0 errors**. The builder proved baseline by re-running lint against `origin/main`'s
   copy of the three edited files — **read that method in report §2 criterion 11 and say whether it
   convinces you.** ⚠️ `test:db` is red at baseline and proves nothing; do not cite it either way.
9. **"FLAGGED, NOT FIXED"** (report §5) — carry every line up. Anything there that makes THIS task
   wrong or unsafe is DOES NOT HOLD; everything else you pass through unchanged.
10. **§2c's THREE QUESTIONS.** This task captures no value and has no reach — **an ACL revoke is
    invisible by design.** Confirm that reading is right rather than inventing a reader for it. The two
    places a REGRESSION would surface are `WALKR`'s, not yours: the public contact form, and `/redeem`
    (which is now **expected to fail closed** — the anonymous gift reveal is retired by the ruling and
    its rebuild belongs to B2 FUNNELDEBT).

## WHAT IS NOT YOURS
- **Fixing anything.** A failed claim is a verdict; it goes back through MGMT to a DSNR-profile task.
- **The default-privileges "door factory"** (`ALTER DEFAULT PRIVILEGES`). MGMT has routed it to ORCH as
  outside this bundle's ownership. **Do not verify it, do not build it** — but if your reading turns up
  anything that changes its urgency, say so in one line.
- **Any function body**, any RLS policy, item 7 (the CHANGE-ORDER-LEDGER headers — MGMT's, with ORCH).

## THREE FINDINGS MGMT ALREADY ROUTED — do not re-report them as new (`TASK-ROLE.md` §4)
1. **14 anon-executable writers have no in-body guard** (`-A` handoff §5) — a BODY finding, B2's.
   `reap_expired_holds` is one: `authenticated` can still call it unguarded. Known.
2. **133 anon-executable definer READERS remain** (plus invoker functions) — a read-ACL sweep is a
   separate bundle, deliberately not started here.
3. **Two definer names carry two live overloads each** — `log_request_alert_send` (6-arg: anon=f,
   authenticated=f — reachable by nobody; 7-arg: the live one) and `claim_request_alert_send` (2-arg
   orphaned, 3-arg live). Measured by MGMT 12:2x PDT. **Dropping an overload is a signature change, so
   it is not B1's.** Routed. ⚠️ **Your job on this is narrow: confirm the migration addressed functions
   by FULL SIGNATURE so no overload was hit by accident.**

## THE VERDICT AND THE ARTIFACT
`docs/reports/TASK-GRANTS-B-VERIFICATION.md` — the shape is in `VRFY-PROFILE.md`. **Verdict on the
first line**: HOLDS · HOLDS, WITH ROUTED FINDINGS · DOES NOT HOLD. ⚠️ **Partial credit does not
exist.** Mark which rows are DB-STATE. TEARDOWN census; `wt-11` returned detached at `origin/main`, clean.

## MODEL AND EFFORT (MGMT's call, D45 — you do not set these)
**Opus · HIGH · thinking ON.** `VRFY-PROFILE.md`'s default, and it is right here: 195 statements reach
production, a revoke that caught the wrong function silently kills the public contact form, and both
traps above need judgment rather than a query.
