# TASK COMPANYFIX — deterministic tenant-company contact marker

Cleanup-ledger item, verified live 2026-08-04 by the orchestrator: `company_contact_id()`
resolves "the tenant's own company contact" as
`SELECT id FROM contacts WHERE org_id=v_org AND is_company AND deleted_at IS NULL LIMIT 1`
— **no ordering, no marker**. It is correct today only because exactly ONE `is_company`
contact exists (French Heritage Equestrian, `352c3898-...`). The moment a counterparty
company (an LLC buyer/lessor, etc.) gets a contact row with `is_company=true` — which the
business model explicitly anticipates — this function becomes nondeterministic, and
everything downstream of it (mirror-delivery bookkeeping via `log_mirror_delivery`, staff
stable scoping via `my_stable_horses`, and any other caller) can silently bind to the wrong
company. This task makes the tenant's own company an explicit fact instead of an inference.

## Locked design
1. `ALTER TABLE organizations ADD COLUMN company_contact_id uuid REFERENCES contacts(id) ON
   DELETE SET NULL;` (nullable — absence falls back to today's behavior).
2. Backfill: set it to the org's single current `is_company` contact. The migration must
   ASSERT exactly one org row and exactly one candidate contact (DO block +
   GET DIAGNOSTICS / count checks; abort loudly otherwise — same defensive pattern as
   C10's data-fix block).
3. `CREATE OR REPLACE company_contact_id()` — live body carried forward, but resolution
   order becomes: (a) `organizations.company_contact_id` when set and the contact is live
   (not deleted); (b) fallback to the existing `is_company LIMIT 1` lookup ONLY when (a) is
   null, and in that case also `UPDATE organizations SET company_contact_id = <found id>`
   (self-healing adoption, so the fallback runs at most once per org); (c) the existing
   create-from-BRAND-config branch unchanged, likewise stamping the new column after
   creating.
4. Find every caller of `company_contact_id()` (live prosrc grep) and confirm none needs a
   change — record the list. Known callers: `log_mirror_delivery`, `my_stable_horses`; there
   may be more.
5. Proof (raw psql):
   - `company_contact_id()` returns `352c3898-...` (unchanged behavior), and
     `organizations.company_contact_id` is now stamped with it.
   - Rolled-back adversarial test: `BEGIN;` insert a second `is_company` contact ("ZZ Test
     LLC"); call `company_contact_id()` — must STILL return `352c3898-...` (the marker, not
     LIMIT 1 luck); `ROLLBACK;` zero residue proven by counts.

## Rules
- Branch `task/companyfix-tenant-marker` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-companyfix -b task/companyfix-tenant-marker origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB writes: the one migration (schema + backfill + function) + rolled-back
  proofs. Everything logged. No UI changes, no TSX.
- `ClauseDocument.tsx` FROZEN. Signed documents never deleted.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors — nothing TSX should change; run anyway) + proofs.
- Report: `docs/reports/TASK-COMPANYFIX-REPORT.md`, committed + pushed. Print ONLY the
  report path.
