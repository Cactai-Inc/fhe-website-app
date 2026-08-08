# TASK NOGUARD — anon-callable SECURITY DEFINER functions with no guard at all

**The largest remaining unknown in the security surface.** Ranked above its own residue by
the `NULLUID` thread, and the orchestrator agrees.

---

## Why this family was invisible to every previous audit

`TASK-NULLUID` audited functions whose **guard was wrong**. `TASK-SECFIX` and `SECFIX2`
audited specific known holes. Every query in those passes keyed on **a guard existing** —
matching `auth.uid()`, `has_staff_access()`, `is_admin()` and so on.

**A function with no guard at all matches none of those patterns.** It is structurally
invisible to the searches already run. NULLUID said so explicitly about its own method, and
named this as the thing it would still miss.

## Measured surface (orchestrator, production, 2026-08-07)

| | count |
|---|---|
| `SECURITY DEFINER` in `public`, anon-executable | **320** |
| …of those, **no guard token anywhere in the body** | **111** |
| …of those 111, trigger functions (`RETURNS trigger`) | 27 |
| **…genuinely callable by `anon` with no guard** | **84** |
| **…of those 84, that also write** | **28** |

The 27 trigger functions are **lower risk, not zero risk** — PostgreSQL refuses a direct
call to a trigger function, so they are not reachable over PostgREST. Confirm that for
yourself rather than taking it on trust, then set them aside.

**The 28 unguarded, anon-callable writers are the priority.**

### The detection method used to produce these numbers is CRUDE — widen it

The orchestrator's pass flagged a function as "no guard" when its body matched **none** of:
`is_super_admin`, `is_admin`, `has_staff_access`, `app_role`, `auth.uid`, `auth.role`,
`current_contact_id`, `session_user`, `is_active_member`.

That is a keyword scan, and it will be **wrong in both directions**:

- **False "guarded"** — a function that merely *mentions* `auth.uid()` while using it to
  look up a value rather than to authorise. `record_invitation_failure` was exactly this
  case in NULLUID. These are dangerous and this pass will have missed them.
- **False "unguarded"** — a function that is safe because it filters internally, takes no
  dangerous argument, or is *intentionally* public.

**Treat the 84 as a starting list, not an answer.** Re-derive it yourself with a wider net.

## Legitimately public — do not revoke without checking

Some of these are anon-callable **by design**, and revoking them breaks the product:

- `redeem_gift` — **leave it alone, but the usual reason for it is WRONG.** The standing
  rationale was "`/redeem` is unauthenticated and a recipient may have no account yet." It
  is not: `redeem_gift`'s body opens
  `IF auth.uid() IS NULL THEN RETURN 'not_authenticated'`, so it **already refuses
  anonymous callers itself**. `SECFIX2` found this; the orchestrator confirmed it at line 15
  of the live function. The anon grant is therefore harmless, not load-bearing. Do not
  revoke it, and **do not repeat the old justification** — a function that guards itself is
  a different fact from a function that must stay open.
- the public catalog read path (`public_offerings` and friends) — the marketing site is
  unauthenticated.

Check each one against its callers in `src/` and `api/` before touching it. **Where you are
unsure, report rather than revoke.** A lockout is worse than the exposure.

## What to do

1. **Enumerate** every anon-callable `SECURITY DEFINER` function in `public` with no
   effective authorisation, using your own widened method. Classify each: **exploitable**,
   **safe-by-construction**, or **intentionally public**, with the reason.
2. **Rank by blast radius.** An unguarded writer that touches `documents`, `signatures`,
   `contacts`, `profiles`, `purchases` or `members` outranks one that touches a log table.
3. **Prove the worst ones**, as NULLUID did — reach past authorisation as `anon` over the
   real PostgREST endpoint and stop at data validation. **Do not flip real data to prove a
   hole.** Reaching validation is sufficient.
4. **Fix by denying at the source**, not only by revoking the grant. NULLUID's strongest
   evidence was that `contact_dossier` and `inbound_open_count` were **never revoked** yet
   began denying anon once the root guard was fixed. Prefer that shape.
5. **Then fix grants explicitly by role** — `REVOKE … FROM anon` and `FROM authenticated`
   separately. `FROM public` is not enough.

## The revoke rule — three silent failures already

| where | why the revoke did nothing |
|---|---|
| `SECFIX` S2 | column revoke against a **table-level** grant |
| `SECFIX` S3 | `FROM anon` against a **PUBLIC** (`=X/postgres`) grant |
| `NULLUID` | `FROM public` against a **role-held `anon`** grant |

NULLUID found **both traps present simultaneously on all 8 functions it touched** — either
revoke alone would have been a silent no-op.

**After every revoke, re-check `has_function_privilege()` and put the raw output in the
report. Never trust the `REVOKE` output.**

## Do not break the billing seam

`api/_lib/supabaseAdmin.ts` reaches PostgREST with the `service_role` key, so **`service_role`
also has `session_user = 'authenticator'` — identical to `anon`.** A guard written on
`session_user` alone will lock out billing. NULLUID proved this and kept the seam alive with
an `auth.role() = 'service_role'` term. **Any guard you write must be tested against the
service path before it ships.**

## Verification

1. For every function changed: `anon` denied, **and the legitimate caller still works.**
2. Post-change `has_function_privilege()` for `anon`, `authenticated` and PUBLIC — raw.
3. `redeem_gift` still anon-callable; gift redemption still completes end to end.
4. The billing/service path still works — exercise it, do not reason about it.
5. Row counts unchanged across `documents`, `signatures`, `contacts`, `profiles`,
   `purchases`, `members`.
6. Re-run your enumeration after the fixes and show the surface shrinking.

## Constraints

- Own git worktree off `origin/main`. **Not on `~/Desktop`** — iCloud emptied that
  directory into the Trash mid-session on 2026-08-07, taking a repo's `.git` with it.
- Separate migrations per logical group, each revertable alone.
- Dry-run in `BEGIN … ROLLBACK` with raw output, then apply.
- **Do not flip real data to prove a hole.**
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.
- `ClauseDocument.tsx` is FROZEN. `AppLayout.tsx` is not part of this task.

## Reporting

`docs/reports/TASK-NOGUARD-REPORT.md`. The full classified list with a reason per function,
raw before/after for every fix, the service-path proof, and an explicit statement of **what
your method would still miss.** That last section is what made NULLUID's report useful — it
is why this task exists.
