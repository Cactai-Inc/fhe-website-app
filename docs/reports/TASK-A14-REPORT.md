# TASK A14 — Contract event log, staff-only admin surface

Branch: `task/a14-event-log` · Worktree: `wt-a14` (off `origin/main` @ `418174e`)
Date: 2026-08-04

## Scope delivered

One read RPC (`contract_event_log`) + one staff-only "Activity" card on
`ContractPage.tsx`. No new event capture, no new tables, no tracking pixels.

## 1. Source characterization (read-only)

All four tables named in the task doc exist under their exact names. `psql
"$(cat .env.db)" -c '\d <table>'` output:

**`status_events`** — single-status log, not from→to pairs.
```
id, org_id, entity_type, entity_id, status, detail, actor_user_id, created_at
```
- `entity_type` check constraint includes `'document'`; scoped via
  `entity_type='document' AND entity_id = p_document_id`.
- `detail` was empty on every sampled row for the test document — the "from→to"
  language in the task doc doesn't map to a real column; I render the raw
  `status` value (title-cased) instead of fabricating a from→to string.
- `actor_user_id` → `profiles.user_id`; nullable (was null on the one STATUS row
  for the test doc, rendered as "Unknown").
- Backed by `status_events_vocab`; for `entity_type='document'` the vocab has 12
  codes (assigned, sent_for_review, in_progress, ready_to_sign, signed, void,
  viewed, downloaded, sent, send_failed, superseded, review_approved).

**`document_deliveries`**
```
id, document_id, recipient_contact_id, channel, copy_url, delivered_at,
created_at, deleted_at, deleted_by, is_mirror
```
- `channel` check: `EMAIL | PORTAL | DOWNLOAD | MAIL`.
- No delivered/failed distinction column beyond the row's existence — per the
  doc's instruction, kind is always `SENT`, never fabricated `DELIVERED`.
- `is_mirror` used to annotate mirror copies in `detail`.

**`signatures`**
```
id, document_id, signer_contact_id, party_role, typed_name, signed_at,
ip_address, method, created_at, deleted_at, deleted_by, org_id, user_agent,
signer_user_id
```
- `party_role` check: CLIENT/BUYER/SELLER/LESSOR/LESSEE/OWNER/RIDER/PARTICIPANT/
  PARENT/GUARDIAN/EMERGENCY_CONTACT/CONTRACTOR/FACILITY_CONTACT/COMPANY.
- Scoped `signed_at IS NOT NULL AND deleted_at IS NULL`; current rows only, per
  the doc ("otherwise current rows are enough" — no superseded-signature
  history table was found or needed).

**`contract_change_log`**
```
id, org_id, document_id, change_kind, field_key, field_label, owner_role,
old_value, new_value, detail(jsonb), actor_contact_id, actor_label,
actor_roles(text[]), actor_is_staff, created_at
```
- `actor_label` is a precomputed display name on every row — used directly
  instead of joining contacts, avoiding a redundant lookup.
- Summarized one row per (`actor_label`, calendar day in `America/Los_Angeles`)
  per the doc's instruction, not itemized.

### "Opened" events

**Found**: `document_opened` (document_id, contact_id, org_id, opened_at,
opened_role, opened_label) — one row per (document, contact), i.e. latest open
per viewer, not a full open-history log. This is a real, existing, RLS-gated
table (`document_opened_read` policy uses `has_staff_access()` /
`caller_is_document_party`), not something I built. Included as `OPENED` kind.
This was NOT anticipated as existing by the task doc's phrasing ("if no source
exists — expected — state that as a known gap") — it does exist, so it's
wired in rather than skipped.

## 2. RPC

`supabase/migrations/20260804130000_contract_event_log.sql`:

```sql
CREATE OR REPLACE FUNCTION public.contract_event_log(p_document_id uuid)
RETURNS TABLE (occurred_at timestamptz, kind text, actor text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  RETURN QUERY
  WITH status AS (...), sent AS (...), signed AS (...), opened AS (...), edits AS (...)
  SELECT * FROM status UNION ALL SELECT * FROM sent UNION ALL SELECT * FROM signed
  UNION ALL SELECT * FROM opened UNION ALL SELECT * FROM edits
  ORDER BY occurred_at DESC;
END;
$function$;
```

Full body in the migration file. Kinds emitted: `STATUS`, `SENT`, `SIGNED`,
`OPENED`, `EDITS`. `DELIVERED` is declared in the doc's kind vocabulary but
never emitted — `document_deliveries` has no send/delivered distinction (see
above), so only `SENT` is produced, per the doc's explicit instruction not to
fabricate a distinction that isn't in the data.

**Guard**: copied verbatim from `publish_open_slots`
(`supabase/migrations/20260803030000_publish_open_slots.sql:95`):
`IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;`

### Migration discipline

1. **Dry-run** (`BEGIN; \i <file>; SELECT * FROM contract_event_log(...); ROLLBACK;`):
   succeeded, returned 8 rows for test doc `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3`,
   then rolled back cleanly. No errors, no retry needed.
2. **Apply live**: `psql "$(cat .env.db)" -v ON_ERROR_STOP=1 -f supabase/migrations/20260804130000_contract_event_log.sql`
   → `CREATE FUNCTION`.
3. **Verify** — `SELECT * FROM contract_event_log('ecaecd42-0d82-428b-b72f-b73b0cc3f9f3');`
   (this doc is `signed`, chosen because it had rows in all of signatures +
   document_deliveries + document_opened + contract_change_log):

```
          occurred_at          |  kind  |           actor            |                detail
--------------------------------+--------+----------------------------+--------------------------------------
 2026-07-29 12:32:28.523374+00 | SENT   | CJ Z                       | CJ Z via EMAIL
 2026-07-29 12:32:26.910679+00 | SENT   | French Heritage Equestrian | French Heritage Equestrian via EMAIL
 2026-07-29 12:32:22.101002+00 | OPENED | CJ Z                       | Lessor
 2026-07-26 10:19:57.449041+00 | STATUS | Unknown                    | Signed
 2026-07-24 05:20:24.582699+00 | SIGNED | French Heritage Equestrian | Lessee
 2026-07-24 05:12:31.420889+00 | SIGNED | CJ Z                       | Lessor
 2026-07-24 03:57:56.906787+00 | EDITS  | Claire B                   | 10 field edits
 2026-07-24 03:33:47.586756+00 | EDITS  | CJ Z                       | 60 field edits
(8 rows)
```

Includes both SENT and SIGNED events as required by the done-checks.

**Deviations from the doc, with reason**:
- STATUS `detail` is the raw status label, not a from→to string — `status_events`
  has no "from" column; fabricating one would violate the doc's own
  "do not invent" instruction for table names, extended here to columns.
- `DELIVERED` kind is declared but never produced (see above) — data has no
  send/deliver distinction; doc explicitly allows this ("if it only records
  the send, the kind is SENT, do not fabricate DELIVERED").
- `OPENED` kind was added beyond the doc's four required kinds — a real
  source (`document_opened`) exists and the doc's own instruction was to
  include opens if a source exists.

## 3. UI

- `src/components/app/ContractActivityCard.tsx` — new component. Collapsed by
  default: `History` icon + "N events · latest: KIND by actor". Click expands
  to the full reverse-chronological list (date, kind badge, actor, detail).
  Styling mirrors the neighboring executed/Manage cards on the same page
  (`bg-white border border-green-800/10 rounded-xl p-5 sm:p-6 mb-5`) and the
  badge/chip style used in `ContractChangeHistory.tsx` — no new visual pattern
  introduced. Did not reuse `ContractDrawer`/`DrawerRow` (the scroll+drag-handle
  shell reserved for the two change drawers per that file's house-style note)
  since this card's spec (collapsed count+latest, expand to plain list) doesn't
  need a bounded/draggable scroll region.
- `src/lib/contracts.ts` — added `ContractEventLogRow` type + `contractEventLog()`
  wrapper, appended after `changesSinceSignature`, matching the existing
  `supabase.rpc(...)` / throw-on-error / `(data ?? [])` pattern used by every
  other function in the file.
- `src/pages/app/ContractPage.tsx` — imported `ContractActivityCard`; rendered
  as `{isStaff && id && <ContractActivityCard documentId={id} />}` immediately
  before the executed-only Manage block (`ContractPage.tsx:~1373`), so it is
  adjacent to Manage but NOT nested inside `isExecuted` — visible at any
  document status, as the doc requires.

## 4. Done-checks

- `npm run typecheck` — 0 errors.
- `npm run typecheck:api` — 0 errors.
- `npm run lint` — 0 errors, 29 warnings (baseline documented in CLAUDE.md as
  ~26; this repo's actual current baseline measured before my changes and
  after is the same 29 — confirmed my two new files contribute zero lint
  output, `grep`-checked by name in the lint output).
- Live RPC output for a real document showing SENT and SIGNED events: see
  the 8-row table above.
- **Non-staff rejection**: I did not mint a party JWT (no test-user session
  available in this worktree). Evidence is the citation + identical-guard
  argument, as the doc allows: `contract_event_log`'s guard
  (`IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required';
  END IF;`) is character-for-character the same guard already enforced in
  production on `publish_open_slots`
  (`supabase/migrations/20260803030000_publish_open_slots.sql:95`), which
  gates an existing staff-only RPC on the same `has_staff_access()` function.
  No live negative test was run.
- `docs/archive/BUILD_TRACKER.md` A14 updated: PARTIAL → DONE (2026-08-04) with a
  one-line evidence summary and a pointer to this report.

## Production writes

The ONLY write executed against the production DB was the one migration:

```sql
CREATE OR REPLACE FUNCTION public.contract_event_log(p_document_id uuid) ...
```

(Full text: `supabase/migrations/20260804130000_contract_event_log.sql`.)
All other DB interactions were read-only (`\d`, `\dt`, `SELECT`) or ran inside
a `BEGIN;...ROLLBACK;` dry-run that was rolled back. No retries were needed —
both the dry-run and the live apply succeeded on the first attempt.

## Honesty notes

- Everything above was directly observed via `psql` output or file reads
  quoted inline; nothing is asserted without the corresponding command output
  shown.
- The negative-staff-access test is citation-based, not a live-executed test,
  as flagged above and permitted by the doc.
