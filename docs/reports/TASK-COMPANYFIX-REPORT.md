# TASK COMPANYFIX — deterministic tenant-company contact marker — REPORT

Branch: `task/companyfix-tenant-marker` (worktree `wt-companyfix`, off `origin/main`).
Migration: `supabase/migrations/20260805180000_companyfix_tenant_marker.sql`, applied
directly to production (`lrstswfxfsezdmvkvukc`) via `psql` on 2026-08-05.

## What shipped

1. `organizations.company_contact_id uuid REFERENCES contacts(id) ON DELETE SET
   NULL` — nullable marker column.
2. Guarded backfill (DO block, `GET DIAGNOSTICS` + count asserts, same pattern as
   C10's `minor_delivery_guard`): asserted exactly 1 live org and exactly 1 live
   `is_company` contact before stamping. Both asserts passed; no abort.
3. `company_contact_id()` rewritten with resolution order (a) explicit marker,
   when set and the contact is still live → return it; (b) fallback to the
   existing `is_company LIMIT 1` lookup, then self-heal by stamping the marker
   (runs at most once per org); (c) create-from-BRAND-config, unchanged,
   likewise stamping the marker after creating. Live body carried forward
   verbatim in branch (c).
4. Callers (live `prosrc` grep, confirmed exhaustive): `log_mirror_delivery`,
   `my_stable_horses`. Both only consume the returned uuid — no changes needed.
   Client-side: `src/lib/horses.ts:284` calls `supabase.rpc('company_contact_id')`
   — same reasoning, unaffected.

## Proof 1 — unchanged behavior (PASSED)

```
SET app.current_org = 'e656f20b-ef43-4725-9029-19e7f0190d9c';
SELECT company_contact_id();
→ 352c3898-65d0-4a90-ad59-29107b7e03fe   (unchanged)

SELECT id, company_contact_id FROM organizations;
→ e656f20b-...  |  352c3898-65d0-4a90-ad59-29107b7e03fe   (marker stamped)
```

## Proof 2 — adversarial rolled-back test: BLOCKED BY A REAL CONSTRAINT, not run as specified

The task doc asks: insert a second `is_company` contact ("ZZ Test LLC") into the
**same org**, then confirm `company_contact_id()` still returns the marker, not
LIMIT-1 luck.

This cannot be executed, in one transaction or any number of retries, because
`contacts` already carries:

```
"one_company_contact_per_org" UNIQUE, btree (org_id) WHERE is_company AND deleted_at IS NULL
```

— a partial unique index added 2026-07-12
(`20260712120000_company_identity.sql`), which makes a second live
`is_company=true` row for the same org a hard DB-level impossibility, not
something my migration's function logic can be exercised against. Both
attempts (initial + one retry, per the failure protocol) errored identically:

```
ERROR:  duplicate key value violates unique constraint "one_company_contact_per_org"
DETAIL:  Key (org_id)=(e656f20b-ef43-4725-9029-19e7f0190d9c) already exists.
```

Both attempts were rolled back; zero residue confirmed (`count(*) FROM contacts
WHERE first_name='ZZ Test LLC'` → 0; `organizations.company_contact_id`
unchanged at `352c3898-...`; `is_company` contact count still 1).

**This also means the task doc's stated threat model doesn't hold as written.**
A later migration than the one that added the constraint —
`20260730130000_contact_type_on_every_path_s3.sql` — documents the deliberate
convention explicitly: *"`is_company` does NOT mean 'some organisation'... it
is the TENANT'S OWN company record... Vendor organisations are ordinary rows
filed DIRECTORY by staff."* Counterparty companies (LLC buyers/lessors) are
modeled via `contact_type = 'DIRECTORY'`, a separate field — no code path in
this codebase sets `is_company=true` on a counterparty contact, and the unique
index would reject it for the tenant's org even if one tried.

So: `company_contact_id()`'s old `LIMIT 1` was never actually at risk of
binding to the wrong company within one org — the real latent risk (if any) is
cross-org, not intra-org, and this task's schema/backfill/function change is a
legitimate hardening (explicit fact over inference is still strictly better
than an implicit LIMIT 1) but it does not fix a live bug, and the specified
adversarial proof cannot be performed against the current schema.

**I did not weaken, drop, or bypass `one_company_contact_per_org`** to force
the test through — that constraint is a deliberate, documented invariant
protecting real behavior (S3's TEAM-filing convention depends on it), and
doing so would itself have been an unauthorized production write outside the
one migration this task authorized.

## Done-checks

- `npm run typecheck` — clean.
- `npm run typecheck:api` — clean.
- `npm run lint` — 29 warnings / 0 errors (baseline unchanged, no TSX touched).

## Rules compliance

- `ClauseDocument.tsx` — not touched.
- No UI/TSX changes.
- Only DB write: the one migration (schema + backfill + function), applied
  once, plus rolled-back proof transactions (zero residue).
- `docs/tasks/TASK-COMPANYFIX-tenant-marker.md` copied into worktree;
  `.env.db` copied, untracked (already gitignored upstream — verify before
  push).

## Recommendation

Ship this migration as-is — it's correct, safe, and strictly improves
determinism for any future cross-org scenario or manual DB surgery that
bypasses the trigger/index. But flag back to the task author that the
adversarial proof needs re-scoping (e.g. two separate orgs, each with its own
`is_company` contact, then confirm each org's `company_contact_id()` resolves
to its own marker and never the other org's) since the single-org version in
the locked design is not executable against the schema as it stands today.
