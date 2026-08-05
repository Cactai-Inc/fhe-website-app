# TASK PARTYCTRL — seed document_party_controls at contract creation

Branch: `task/partyctrl-seed`, worktree `~/Downloads/claude-code-repo/wt-partyctrl`, off
`origin/main`.

## Read-first (in the mandated order)

**`\d document_party_controls`:**
```
Table "public.document_party_controls"
     Column     |  Type   | Nullable |    Default
----------------+---------+----------+---------------
 document_id    | uuid    | not null |
 party_role     | text    | not null |
 can_fill       | boolean | not null | true
 can_edit_deal  | boolean | not null | false
 can_suggest    | boolean | not null | false
 org_id         | uuid    | not null | current_org()
 can_add_clause | boolean | not null | false
Primary key: (document_id, party_role)
FK: document_id -> documents(id) ON DELETE CASCADE
```
Composite PK on `(document_id, party_role)` — confirms `ON CONFLICT (document_id, party_role) DO
NOTHING` is the correct idempotent form.

**The 2 reference rows on `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3`:**
```
 party_role | can_fill | can_edit_deal | can_suggest | can_add_clause
 LESSEE     | t        | f             | t           | t
 LESSOR     | t        | t             | f           | t
```
Role-asymmetric: LESSOR carries deal-editing authority, LESSEE can only suggest. Cross-checked
against that document's `document_parties` — exactly 2 rows, LESSOR + LESSEE, no FHE row — so the
reference is a clean 1:1 party-role -> controls-row mapping with nothing else to explain away.

**`set_party_controls` prosrc (full function read via `pg_get_functiondef`):** `SECURITY DEFINER`,
staff-gated (`has_staff_access() AND v_org = current_org()`), upserts one row via
`INSERT ... ON CONFLICT (document_id, party_role) DO UPDATE`. Its one piece of business logic:
refuses to set `can_edit_deal = false` if it would leave **zero** signing, non-FHE/COMPANY parties
able to edit deal terms (`'at least one party must be able to edit deal terms'`). This is an
update-time guard, not a DB constraint — it doesn't forbid a freshly-seeded document from starting
with no editors; it only stops staff from *removing* the last one afterward.

**Party-creation section of each starter (full prosrc read, all three, via
`pg_get_functiondef`):** All three follow an identical shape — insert into `contract_parties`,
then call the shared `generate_document(...)` (which is what actually populates
`document_parties`, keyed by the jsonb party array built from `contract_parties`; confirmed by
reading `generate_document`'s prosrc, lines around its own `INSERT INTO document_parties ... ON
CONFLICT (document_id, contact_id, party_role) DO NOTHING`), then continue with field-seeding and
identity-fill steps.
- `start_lease_contract_v2(p_lessee_contact_id, p_lessor_contact_id DEFAULT NULL, p_horse_id, p_responsible_role)`
  — LESSEE always inserted; LESSOR inserted only `IF p_lessor_contact_id IS NOT NULL`.
- `start_sale_contract(p_buyer_contact_id, p_seller_contact_id DEFAULT NULL, p_horse_id, p_amount, p_deposit)`
  — BUYER always inserted; SELLER only if given.
- `add_deal_document(p_deal_id, p_template_key, p_has_sale_agreement)` — reuses whatever
  `contract_parties` rows already exist on the deal's contract (both of `deal_party_roles(deal_type)`
  required as a precondition), so it can carry more than 2 roles/contacts if the deal does.

None of the three writes `document_party_controls` anywhere in their live bodies — confirmed by
reading every line, not just grepping. `generate_document` itself was left untouched (out of
scope; it's shared infrastructure reused elsewhere per prior threads' notes) — the seed block was
added to each of the three starters instead, immediately after the `generate_document` call
returns `v_doc` (at that point `document_parties` for the new document is fully populated).

## Default-values decision: UI panel default, not the reference doc's rows

The reference document's asymmetry (LESSOR edits deal terms, LESSEE only suggests) reads as
lease-specific business logic — LESSOR is the property owner with elevated authority in that
relationship. It doesn't obviously generalize to `BUYER`/`SELLER` (which side is "the owner" in a
sale?) or to arbitrary `add_deal_document` templates. Per the task spec's own instruction for
exactly this case, used `ContractPage.tsx`'s panel instead: `ContractPage.tsx:1449` is the exact
fallback the panel already uses for a role that appears in `invitableRoles` but has no
`document_party_controls` row yet — `{ can_fill: true, can_edit_deal: false, can_suggest: false,
can_add_clause: false }`. All three starters (and the backfill) seed every non-FHE/COMPANY party
role with this same uniform default. `FHE`/`COMPANY` are excluded from seeding, matching both the
panel's own `.filter(r => r !== 'FHE' && r !== 'COMPANY')` and `set_party_controls`' treatment of
those roles as non-counterparties. (Confirmed via `document_parties` on the reference doc, and on
every backfilled/live-tested document below, that FHE/COMPANY never actually appear as a
document-party row for these three starters anyway — the exclusion is defensive, not a no-op that
hides real rows.)

## Migration

`supabase/migrations/20260804150000_seed_party_controls_at_creation.sql` — `CREATE OR REPLACE`
for all three functions, live bodies carried forward **unchanged** (diffed by eye against the
`pg_get_functiondef` output captured above before editing; the only addition in each is the seed
`INSERT` block, placed right after the `generate_document(...)` call):

```sql
INSERT INTO document_party_controls (document_id, party_role, can_fill, can_edit_deal, can_suggest, can_add_clause, org_id)
SELECT DISTINCT v_doc, dp.party_role, true, false, false, false, v_org   -- v_deal.org_id in add_deal_document
  FROM document_parties dp
 WHERE dp.document_id = v_doc AND dp.party_role NOT IN ('FHE','COMPANY')
ON CONFLICT (document_id, party_role) DO NOTHING;
```

Plus a backfill `INSERT` (below) in the same migration file.

## Backfill

Query used to find candidates: non-deleted, non-`EXECUTED`-status documents with
`document_parties` rows but zero `document_party_controls` rows. `documents.status` /
`workflow_state` / `current_status` currently only take 3 combinations live —
`EXECUTED`/`executed`/`signed` (54 docs, terminal, excluded), `DRAFT`/`editable`/`assigned` (6
docs), `AWAITING_SIGNATURE`/`editable`/`ready_to_sign` (5 docs) — so "configurable, non-terminal"
unambiguously means the latter two. No document currently has `terminated_at`/`voided_at` set, so
there was nothing else to reason about for the exclusion.

**10 documents backfilled** (all `n_controls` were 0 before; one further configurable document,
`215bac09-9f66-43ce-8655-85fd05fea1e2`, already had 2 rows and was left untouched by
`ON CONFLICT DO NOTHING`):

| document_id | status | roles seeded |
|---|---|---|
| `252e4ec7-2873-41a1-b2ed-10a12cab9b89` | DRAFT | CLIENT, PARTICIPANT |
| `7de3d3c5-4575-4114-aea6-e486e6e84fcf` | DRAFT | CLIENT, PARTICIPANT |
| `06903d0a-da74-4a1c-bcd2-711dc586491a` | DRAFT | CLIENT, PARTICIPANT |
| `6e4d2891-f8d6-47f4-8845-c8254919b2da` | DRAFT | CLIENT, PARTICIPANT |
| `19f34177-98c1-4b9a-915d-08b54e5769a0` | DRAFT | CLIENT, PARTICIPANT |
| `7daf7434-5bef-4b20-92d2-7fc47aad806e` | DRAFT | CLIENT, PARTICIPANT |
| `fb6abc6c-ef34-4d80-b731-543eaa40ac71` | AWAITING_SIGNATURE | CLIENT |
| `0360f829-4c31-4dc0-9b95-3489ee9a71cb` | AWAITING_SIGNATURE | CLIENT |
| `704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` | AWAITING_SIGNATURE | LESSEE, LESSOR |
| `27201617-af7c-4001-93d1-cfebdc1b1d72` | AWAITING_SIGNATURE | LESSEE, LESSOR |

18 rows inserted total (`INSERT 0 18`), all `can_fill=true, can_edit_deal=false,
can_suggest=false, can_add_clause=false` — the CLIENT/PARTICIPANT documents are onboarding-style
contracts outside the three starters' template scope, but the task spec's backfill clause is
document-pattern-based ("has document_parties ... ZERO controls rows"), not starter-scoped, so
they're included.

## Live proof (production DB, all rolled back)

Each ran as `BEGIN; \i <migration>; <call>; <verify>; ROLLBACK;` in one psql session — the
migration's `CREATE OR REPLACE`s and backfill `INSERT` are themselves inside the rolled-back
transaction each time, so nothing from these proof runs persisted; the migration was applied for
real in a separate, final, non-rolled-back run (below).

Staff session simulated via `SET LOCAL request.jwt.claim.sub = '<uuid>'` to a real `ADMIN` profile
(`b45a5503-89bc-489a-b012-c7fbf5c09632`, org `e656f20b-ef43-4725-9029-19e7f0190d9c`, the same org
as the reference document) so `has_staff_access()`/`current_org()` resolve correctly — same
technique prior threads used for RPC proofs.

**`start_lease_contract_v2`**, called exactly as `src/lib/api.ts`'s `startLeaseContract()` calls
it (`p_lessee_contact_id`, `p_lessor_contact_id`, `p_horse_id`), against two real contacts:
```
result: {"contract_id": "f59ad1cf-ad18-4fe6-bf24-aa39e8331e97", "document_id": "d6a82200-1940-405d-be6c-3698ffc552c9", "fields_seeded": 117}

document_party_controls for d6a82200…:
 party_role | can_fill | can_edit_deal | can_suggest | can_add_clause
 LESSEE     | t        | f             | f           | f
 LESSOR     | t        | f             | f           | f

document_parties for d6a82200… (for comparison): LESSEE (352c3898…), LESSOR (d99f1472…)
```
Both party roles seeded, matching `document_parties` exactly. `ROLLBACK` executed.

**`start_sale_contract`**, called as `src/lib/api.ts`'s `startSaleContract()` calls it, same two
contacts as BUYER/SELLER, amount 10000, deposit 1000:
```
result: {"contract_id": "281ec5c7-82ef-455d-b901-fefa6263e148", "document_id": "342cbe48-bc4c-4ee9-a2f8-162fd61a7977", "fields_seeded": 65}

document_party_controls for 342cbe48…:
 party_role | can_fill | can_edit_deal | can_suggest | can_add_clause
 BUYER      | t        | f             | f           | f
 SELLER     | t        | f             | f           | f

document_parties for 342cbe48… (for comparison): BUYER (352c3898…), SELLER (d99f1472…)
```
Both party roles seeded, matching `document_parties` exactly. `ROLLBACK` executed.

**`add_deal_document`** — callable directly against a real deal fixture, so this got the full
rolled-back RPC proof rather than a reasoned trace. Used the one live `deals` row
(`c3754d7f-3642-4e86-803c-4178ae135cb6`, `deal_type='LEASE'`, `contract_id`
`eef830bf-1d06-460c-9966-46fd4857dd6f`, which already carries LESSOR + LESSEE `contract_parties`),
called as `src/lib/deals.ts` calls it (`p_deal_id`, `p_template_key`, `p_has_sale_agreement`),
template `HORSE_LEASE_V2`:
```
result: {"document_id": "4199dc6b-d1fc-4e20-8564-ade61d24ca57", "template_key": "HORSE_LEASE_V2", "fields_seeded": 117}

document_party_controls for 4199dc6b…:
 party_role | can_fill | can_edit_deal | can_suggest | can_add_clause
 LESSEE     | t        | f             | f           | f
 LESSOR     | t        | f             | f           | f

document_parties for 4199dc6b… (for comparison): LESSOR (b996dd2c…), LESSEE (352c3898…)
```
Both party roles seeded, matching `document_parties` exactly. `ROLLBACK` executed.

## Applying for real

After all three proofs passed rolled back, ran the migration file for real (not rolled back):
`CREATE FUNCTION` x3, `INSERT 0 18`.

**Post-backfill check** (must be 0):
```sql
SELECT count(*) FROM document_parties dp JOIN documents d ON d.id = dp.document_id
 WHERE d.deleted_at IS NULL AND d.status NOT IN ('EXECUTED')
   AND dp.party_role NOT IN ('FHE','COMPANY')
   AND NOT EXISTS (SELECT 1 FROM document_party_controls c
                    WHERE c.document_id = dp.document_id AND c.party_role = dp.party_role);
--  count
-- -------
--      0
```
Re-listed all 11 configurable documents post-migration: all 11 now show `n_controls >= 1` per
their actual party-role count (the 10 backfilled ones at their seeded count, the one
pre-existing-controls document untouched at its original 2 rows).

## `docs/BUILD_TRACKER.md`

Added a one-line note under A2 pointing at this fix; **A2's status left as `NOT VERIFIED`**
unchanged — send-to-parties itself is still unverified live and is the party-verify thread's item,
not this task's.

## Done-checks
- `npm run typecheck` — clean (no errors).
- `npm run typecheck:api` — clean (no errors).
- `npm run lint` — **29 warnings / 0 errors**, matching the stated baseline exactly; no `.tsx`
  file was touched, so no new warnings possible and none appeared.
- Live proofs above (all three starters, rolled back) + the real, applied migration + the
  post-backfill zero-count check.

## Scope discipline
Touched only: the one migration (3 `CREATE OR REPLACE FUNCTION` + 1 backfill `INSERT`),
`docs/BUILD_TRACKER.md` (one line under A2), this report, and the task-doc copy.
`ClauseDocument.tsx` was not read or touched (frozen, and no UI changes were made at all, per the
hard rule). `generate_document` was read (to confirm where `document_parties` gets populated) but
not modified — out of scope, shared infrastructure. No document, signed or otherwise, was deleted.
All production writes were exactly what the task doc allowed: the one migration (functions +
backfill) and the rolled-back proofs — no other writes were made, no cleanup was needed since
every proof transaction was rolled back and confirmed to leave zero residue.
