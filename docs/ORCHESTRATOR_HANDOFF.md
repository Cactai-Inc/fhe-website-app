# Orchestrator handoff

**Read this first if you are taking over the orchestrator role in a fresh thread.**
Written 2026-08-07. `main` = `71f622c`, pushed, nothing uncommitted.

Companion docs: `docs/THREAD_REGISTRY.md` (thread IDs + status), `CLAUDE.md` (the system
itself), `docs/BUILD_TRACKER.md` (the 129-item map).

---

## The role

The owner (CJ, admin@cactai.io) runs a fleet of Claude Code threads. **You are the
orchestrator, not a builder.** You:

1. Pick ONE task-level item at a time and write its spec to `docs/tasks/TASK-<ID>-<slug>.md`.
2. Hand the owner a prompt with model / thinking / effort settings and a worktree path.
3. **Independently audit every report against real repo and DB state before believing it.**
4. Merge branches to `main`, run the integration checks no single thread can run, push.
5. Own cleanup and design decisions; surface anything needing the owner's judgement.

### The one rule that matters most

**Never trust self-reported "done". Verify against the live database or repo before
asserting anything.**

This has caught real problems repeatedly, and failing to do it has produced real errors —
including in this session. Two examples worth internalising:

- A thread reported 6 pending version decisions. The orchestrator measured 0 and nearly
  reported the thread wrong — the orchestrator had queried as the wrong identity
  (`cjzigs@icloud.com`, a test account, role `USER`). The thread was right.
- The orchestrator's own merge test reported "clean" for two branches **that did not exist
  in that clone** — the check grepped only for the word "conflict", so a ref-not-found error
  read as success.

**Check that your check is actually testing what you think it is.**

---

## Where things stand

### Merged and verified (nothing outstanding)

`WALLSYNC` `NULLUID` `ACCOUNTSURFACE` `ONEMENU` `LEASEFORK` `WALLRETURN` `TIPTAP` `LEASEMAP`
`SECFIX` `ACCTEVAL` `BP410` `SIGREAD` `PLUSPASS` `PARTYRLS` `DOCVIS` `PROFILE` + ~20 older.

### In flight (4 threads open as of writing)

| ID | state |
|---|---|
| `LEASEGATE` | running — **Phase 1 is analysis only, hard stop for owner review.** Branch `task/leasegate` has unmerged work |
| `NOGUARD` | running — no branch pushed yet |
| `SECFIX2` | running — branch `task/secfix2` has unmerged work |
| `LEASESIMPLE` | just started — worksheet only, makes no content decisions |

**Each needs auditing and merging when it reports.** None have been merged yet.

### Written but never run

`GOOGLEAUTH` · `PURPOSEFIX` · `TITLESWEEP`

---

## Decisions the owner owes — nothing moves without these

1. **The 6 version decisions.** `template_version_events` holds 6 unresolved rows from the
   2026-08-02 contract sprint: `RELEASE_PARTICIPANT` 2→3, `HUMAN_EMERGENCY_MEDICAL` 1→2,
   `HORSE_EMERGENCY_VET` 1→2, `RELEASE_HORSE_CARE` 1→2, `COMPANY_POLICIES` 0→1,
   `FACILITY_RULES` 0→1. For each: **ALL / SELECTED / NONE** must re-sign, via
   `resolve_version_decision()`. This is a legal-materiality call. Until answered, nobody is
   asked to re-sign anything — `WALLSYNC` made the queue authoritative instead of the wall
   enforcing it silently.
2. **Lease picker labels** — deliberately **held** until `LEASEGATE` Phase 1 reports, because
   renaming a template changes rows LEASEGATE must checksum as byte-identical.
3. **Default lease template.** `HORSE_LEASE_V2` and `HORSE_LEASE_STANDARD` are currently
   byte-identical. Once LEASEGATE gates STANDARD they diverge — **and if V2 stays the
   default, the gates never reach the contracts actually sent.** Decide before Phase 2.
4. **`GOOGLEAUTH`:** does the password survive linking (recommendation: yes), and is manual
   identity linking enabled in the Supabase Auth dashboard (owner must check).

---

## Conventions — do not re-derive these

### Thread naming — SOLVED, use the confirmed shape

```
SECFIX2

Begin your first reply with "SECFIX2" alone on the first line.

Read docs/tasks/TASK-SECFIX2-gift-grant-and-directory.md and do exactly what it says.
Worktree: ~/Downloads/claude-code-repo/wt-secfix2, branch task/secfix2, off origin/main.
```

**The ID alone, no description.** The tab title is auto-generated from the prompt and
paraphrases any description you give it, dropping the ID. With no description, the only
content left is the doc filename — which carries the ID, so it survives. Confirmed working.
Full history of what failed is in `THREAD_REGISTRY.md`; do not re-test those.

**Prompt = pointer. Doc = the whole spec.** Restating the spec in the prompt duplicates it
where it can drift, and it is what feeds the summarizer.

### Worktrees

`~/Downloads/claude-code-repo/wt-<id>` — one per thread, off `origin/main`.

**NEVER `~/Desktop`.** On 2026-08-07 iCloud emptied that directory into the Trash mid-session,
destroying a clone's `.git`. `NULLUID`'s branch and commit were lost that way; its four
migrations and report survived only because they were recovered off the disk by hand.

### Migrations

Timestamped in `supabase/migrations/`, applied by hand via `psql` (`.env.db` line 1 is the
connection string). **Dry-run in `BEGIN … ROLLBACK` with raw output shown, then apply, then
verify with a query, then commit.**

### Standing constraints for every thread

- **Sarah's document `704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` is a LIVE NEGOTIATION** —
  read-only, never write.
- **`ClauseDocument.tsx` is FROZEN** — scoped exceptions only by orchestrator approval.
- **Never flip real data to prove a security hole.** Reaching data validation past the guard
  is sufficient proof.
- **`redeem_gift` is intentionally anon-callable** (`/redeem` is unauthenticated). Do not
  revoke it.

---

## Hazards that have bitten this repo

**Silent revokes — three distinct mechanisms, all confirmed live:**

| mechanism | why the revoke did nothing |
|---|---|
| column revoke against a **table-level** grant | `SECFIX` S2 |
| `FROM anon` against a **PUBLIC** (`=X/postgres`) grant | `SECFIX` S3 |
| `FROM public` against a **role-held `anon`** grant | `NULLUID` |

`NULLUID` found the latter two present **simultaneously** on all 8 functions it touched.
**After every revoke, re-check `has_*_privilege()` and put the raw output in the report.
Never trust the `REVOKE` output.**

**NULL-propagating guards.** `IF NOT has_staff_access()` evaluates to NULL for anon, and
`NOT NULL` is not TRUE — so the guard never fires. It reads like a deny and behaves like an
allow. 49 functions were exposed this way; `platform_tenant_detail` was returning the full
admin dossier to unauthenticated callers. Fixed, but **the no-guard family
(`NOGUARD`, running) was invisible to every audit so far** because they all keyed on a guard
existing.

**`service_role` looks like `anon`.** `api/_lib/supabaseAdmin.ts` reaches PostgREST with the
service key, so `service_role` also has `session_user = 'authenticator'`. A guard on
`session_user` alone **locks out billing**. Use an `auth.role() = 'service_role'` term.

**`test:db` is broken on `main`** — 55 of 64 files failing. That suite is currently
protecting nothing. Not yet tasked.

---

## Known unfinished business

- **Nobody has clicked through the merged UI work in a browser.** `ACCOUNTSURFACE`, `ONEMENU`
  and `LEASEFORK` all shipped without it — no Supabase credentials in any worktree. Verified
  at typecheck/build/RPC level only. Specifically unverified: the account page at 390px with
  heavy panels expanded, Sign-out safe-area on real iOS, superadmin chrome, the lease version
  picker.
- **`LEASEMAP` findings 2 and 5 are unresolved and affect live documents**: `RISK_OF_LOSS`
  and `MED_TAIL` print unconditionally, so when a Lessee takes a cover the document asserts
  both allocations at once; and a blank insurance status still prints its sentence as an
  affirmative covenant (live in draft `215bac09`). Proposed fix — make the residual-risk
  bearer an elected field (`LESSOR`/`LESSEE`/`SHARED`, defaulting to `LESSOR` so nothing
  changes unless chosen) and suppress any sentence whose status field is blank. **Awaiting
  owner sign-off; it is legal wording.**
- **`ACCTEVAL` report (932 lines) has never been reviewed by the owner.**

---

## How the owner works

Direct, fast, decisive. Wants **status, not narrative** — what is finalised, what remains,
what he must decide, what you can do right now. He has said explicitly that long prose
answers read as confusing.

He tests claims. Getting something wrong and being caught is worse than saying "I verified
X, I assumed Y." **Say which is which, every time.**

He will push back with better information than you have — he wrote much of this system.
When he corrects you, check it, then say plainly that you were wrong and fix the artifact
that carries the error, rather than only correcting it in chat.
