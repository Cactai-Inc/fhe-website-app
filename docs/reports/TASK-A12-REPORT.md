# TASK A12 — Horse record shows the partial-lease schedule captured in the contract

Branch: `task/a12-lease-schedule`, worktree `~/Downloads/claude-code-repo/wt-a12`, off `origin/main`.

The task doc's "verified current state" (schedule data lives only in `contract_fields`
`TXN.DAYS_USED`/`TXN.SCHEDULE_TERMS`, nothing copies it anywhere; `horse_page_detail` current live
body is `20260804130000_horse_page_viewer_is_lessee.sql`; HorsePage record/schedule tabs; test data
on horse `a8e82033-cf9e-48aa-8ea5-a856f2ede597` "Beau"; `is_horse_lease_template(key)` helper) was
independently re-checked against the schema and DB before building — all of it held exactly as
stated.

## What was built

### 1. Migration — `lease` object on `horse_page_detail`
`supabase/migrations/20260804140000_horse_page_lease_schedule.sql` — `CREATE OR REPLACE FUNCTION
horse_page_detail`, full A11 body carried forward unchanged, plus one added top-level key:

- Gate: the horses lease-window stamp (`lease_start <= current_date AND (lease_end IS NULL OR
  lease_end >= current_date)`) is checked first — this is the execution-time truth per the design,
  and a single horse-level window, so it's evaluated once rather than per candidate document.
- When active, the source document is the latest non-deleted, EXECUTED document linked via
  `documents.horse_id = p_horse_id` (the same linkage `apply_contract_execution_effects` /
  `20260803020001_execution_effects_null_guard.sql` uses) whose template satisfies
  `is_horse_lease_template`, ordered by `effective_date DESC NULLS LAST, created_at DESC` — a
  `LIMIT 1` in case more than one executed lease document ever exists for a horse.
- `lease_type`/`days_used`/`schedule_terms` are pulled from that document's `contract_fields` via a
  `LATERAL` aggregate on `field_key IN ('TXN.LEASE_TYPE','TXN.DAYS_USED','TXN.SCHEDULE_TERMS')`,
  each `nullif(..., '')`'d so a blank field reports `null`, not an empty string — `days_used` is
  composed text (`compose_week_grid`), not parsed or reshaped.
- `lessee_name` reuses the identical contact/`lessee_name_text` coalesce the `record` block already
  uses, for the same horse row, so the two never disagree.
- When no active lease, `'lease'` is present as a key with a `null` value (not omitted) — the UI
  spec checks non-null, so this is behaviorally identical to key-absence for the client and simpler
  to reason about server-side.

**Dry-run** required simulating an authenticated session — `current_org()`/`has_staff_access()`/
`current_contact_id()` all resolve through `auth.uid()`, which a raw superuser psql connection
doesn't set, so the unmodified function raises `unknown horse` / `not authorized` outside a real
session (same condition A11 hit). Ran inside `BEGIN;...ROLLBACK;`, loaded the migration, set
`request.jwt.claim.sub` to a real staff profile in Beau's org (`b45a5503-89bc-489a-b012-c7fbf5c09632`,
ADMIN), confirmed the `lease` object for Beau and `null` for two other horses in the same org with
no active lease, then `ROLLBACK`. Applied for real afterward — see §2 for output.

### 2. Type — `src/lib/horses.ts`
`HorsePageDetail` gained `lease: { lessee_name, lease_start, lease_end, lease_type, days_used,
schedule_terms, source_document_id } | null` at the top level (sibling of `record`, matching how
`viewer_is_lessee` was added in A11).

### 3. UI — `src/pages/app/HorsePage.tsx` record tab
A "Lease" `Card` (the `full` single-column layout, matching "Medications & supplements" / "Health &
history") rendered only when `detail.lease` is non-null, inserted between the existing "Location"
and "Care team" cards:
- Term line reuses the exact A11 framing (`detail.viewer_is_lessee` → "You lease this horse
  [through `<date>`]"; else "Leased to `<name>` [(through `<date>`)]"), now sourced from
  `detail.lease` instead of `detail.record`.
- Lease type, shown when present (`titleCase`'d, matching the rest of the page's convention).
- "Reserved days" — `days_used` rendered as `whitespace-pre-line` (the pattern already used for
  session reports at `HorsePage.tsx:277`), not parsed or split.
- "Additional schedule terms" — `schedule_terms`, same treatment, shown only when present.
- The pre-existing "Leased to"/"Your lease" line inside the "Location" card (A11) was left
  untouched — out of this task's scope, and it draws from the horses stamp directly rather than the
  read-through lease object, so it is not simply redundant with the new card.

`ClauseDocument.tsx` was not read or modified (frozen). No booking/`CalendarPage.tsx` code touched.

## 4. Live proof (production DB)

Applied migration:
```
CREATE FUNCTION
```

`horse_page_detail('a8e82033-cf9e-48aa-8ea5-a856f2ede597')` as a simulated staff session
(`SET request.jwt.claim.sub`/`SET role = 'authenticated'`, non-transactional read-only query):

```json
{
    "days_used": "Lessor: Tue, Thu, Sun; Lessee: Mon, Wed, Fri, Sat.",
    "lease_end": null,
    "lease_type": "PARTIAL",
    "lease_start": "2026-08-01",
    "lessee_name": "French Heritage Equestrian",
    "schedule_terms": null,
    "source_document_id": "ecaecd42-0d82-428b-b72f-b73b0cc3f9f3"
}
```

This is the real `TXN.DAYS_USED` text from the executed lease (`ecaecd42-0d82-428b-b72f-b73b0cc3f9f3`)
— confirmed directly against `contract_fields` before building:

```
     field_key      |                       value                        | value_type | input_kind
--------------------+----------------------------------------------------+------------+------------
 TXN.DAYS_USED      | Lessor: Tue, Thu, Sun; Lessee: Mon, Wed, Fri, Sat. | text       | week_grid
 TXN.LEASE_TYPE     | PARTIAL                                            | select     | select
 TXN.SCHEDULE_TERMS |                                                    | longtext   | longtext
```

`TXN.SCHEDULE_TERMS` is blank on this test document — `schedule_terms` correctly reports `null`
rather than fabricated text. For two other horses in the same org with no active lease
(`8da6bb10-e72f-4db3-81ba-c27d7c25bbe0` "Secret Tattoo", `b33646c6-5129-4dd8-a7e4-87a787e3af8a`
"Peep Show"), `lease` returns `null`.

## Done-checks
- `npm run typecheck` — clean.
- `npm run typecheck:api` — clean.
- `npm run lint` — **29 warnings / 0 errors**, matching the stated baseline exactly (no new warnings
  from `HorsePage.tsx` or `horses.ts`).
- Live proof above.

## Honesty check against the task's own bar
Server-side (RPC/data) behavior is proven live via the psql output above, against real production
data. **No browser step ran in this task** — the UI (`HorsePageDetail` type, "Lease" card) is
code-complete and typecheck-clean but has not been visually confirmed in a browser.
`docs/BUILD_TRACKER.md` A12 is marked **PARTIAL — server-verified, browser pending** accordingly,
not DONE.

## Scope discipline
Touched only: the one migration, `src/lib/horses.ts`, `src/pages/app/HorsePage.tsx`,
`docs/BUILD_TRACKER.md`, this report. The only production write was the single `CREATE OR REPLACE
FUNCTION` migration (no data changes — read-through design, nothing to stamp). A13 (lesson booking)
and `CalendarPage.tsx` were not touched.
