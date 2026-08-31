# The activity log has no surface, on purpose

**Written 2026-08-31 · TASK-FIX3 · owner ruling, same day.**
**Every number below was measured against production (`lrstswfxfsezdmvkvukc`) on the day it was
written, by `SELECT`. Nothing here is inferred from a comment.**

This file exists because a thing was removed, and the reason a thing was removed is the part that
goes stale first. If you are about to build an activity surface, this is the specification for
whether it deserves to exist.

---

## 1. What was removed

| Thing | Was |
|---|---|
| `/app/ops/activity` | `ActivityPage.tsx` — `status_feed()`, 200 rows, four entity tabs |
| `/app/ops/oversight` | `OversightPage.tsx` — four count tiles + 50 rows of `audit_logs` |
| Nav rows | Both, in the section then called Community and now called Admin |
| Dashboard zone **B6** | *"What the app has been doing"* — `dash_activity_readback()`, collapsed, with a footer link reading *"Open the full activity log →"* |
| `GRANTABLE_SURFACES` | The instructor grant for `/app/ops/oversight` |
| `adminOversight()` | The client wrapper. **Only** the client wrapper. |

**Kept, deliberately, and still recording:** `audit_logs`, `status_events`, `notifications`,
`document_deliveries`, `receipt_sends`, and the functions `admin_oversight()`, `status_feed()` and
**`dash_activity_readback()`**. D32: nothing is removed from the database.

---

## 2. ⚠️ Why it was removed — and it is NOT an emptiness finding

The owner, 2026-08-31:

> *"the pages are virtually worthless and provide no true value in a practical sense because they
> show massive repeating entries with the same thing all of which doesnt actually tell me anything …
> i vote to remove this from all surfaces, remove the surfaces that are dedicated to it entirely,
> the result being less clutter in the menus and on the dashboard."*

⚠️ **These pages were full. That is the finding.** A page that renders nothing is unfinished; a page
that renders fifty lines of the same sentence is finished and wrong, and the second is harder to
notice.

`OversightPage` rendered `audit_logs.action` beside `audit_logs.table_name`, and nothing else.
`action` is **CHECK-constrained to exactly three values**:

```
audit_logs_action_check  CHECK (action = ANY (ARRAY['INSERT','UPDATE','DELETE']))
```

So every row it could ever draw was one of three verbs beside a table name. On production today,
**2,538 of 5,632 audit rows are `UPDATE` on `documents`** and a further 381 are `UPDATE` on
`contract_templates` — **52% of the whole ledger is two sentences.** The page showed the most recent
fifty of them.

`ActivityPage` was the same defect in a different ledger: of the 200 rows it rendered,
**138 were `offering` rows reading "Scheduled" or "Completed"** — engine bookkeeping, with no name,
no actor and no link.

**The author of `dash_activity_readback()` had already written this failure mode down, in that
function's own comment, on 2026-08-22:** *"straight 'most recent 40' looked right and was useless:
`audit_logs` writes ~3,200 rows a month where `receipt_sends` writes 2, so the read-back rendered
forty identical 'UPDATE documents' lines."* **The owner's watch page was showing the version that had
already been diagnosed and engineered around on a different surface.**

---

## 3. What would make it worth surfacing again

Four conditions. **All four, not a majority.**

1. **Rigorous filtering and scoping.** Not "most recent N". `dash_activity_readback()` already
   demonstrates the shape: a **fair-share window per ledger**, so the noisiest ledger cannot drown
   the others. A feed that is 69% one entity type is not a feed.
2. **Entries that carry meaning in themselves.** *"UPDATE · documents"* is not an entry; it is a row
   in a table wearing an entry's clothes. An entry says **what changed, on what, to what** —
   *"Lease agreement delivered to pamela@… · LSE-0041 · Pamela Godde"*. If the sentence does not
   survive being read aloud, it does not belong on a page.
3. **The related record is reachable from the entry.** ⚠️ **Nothing on either page was clickable.**
   `ActivityPage` fetched `entity_id` and used it **only as part of a React key**, then discarded it.
   Both pages fetched `actor_user_id` and **neither rendered it.** *"Who did this?"* was unanswerable
   on both surfaces **while both surfaces were querying the answer.** D27 is explicit that an
   activity log is the minimum and *"clicking an entry opens the content"*.
4. **The actor is named.** See 3 — and see §5, because naming the actor is where the data is thinnest.

---

## 4. ⚠️ THE PARTITION REQUIREMENT — a platform ruling, not a preference

**The owner's own, and it survives the rebuild:**

- Activity logs must be **tenant-scoped**. A tenant sees its own activity and nothing else.
- **Platform-level entries are visible only to the platform admin.**
- **Nothing cross-tenant is ever visible from inside a tenant account**, in any state, for any role.

⚠️ **This is a schema change, not a query fix, and the measurement says so:**

- `admin_oversight()`'s activity block was, verbatim from production:
  `SELECT occurred_at, action, table_name, actor_user_id FROM audit_logs ORDER BY occurred_at DESC LIMIT 50`
  — **no `WHERE` clause at all.**
- The function is **`SECURITY DEFINER`**, so RLS does not apply; and the policy would not have helped
  anyway — `audit_logs_admin_read USING (is_admin())`, and `is_admin()` does not mention the org.
- **`audit_logs` has no `org_id` column.** Its ten columns are `id, occurred_at, actor_user_id,
  action, table_name, record_id, old_value, new_value, ip, user_agent`. **There is nothing to filter
  on.**

Today there is exactly one organization, so nothing leaks. **The second tenant makes this a
cross-tenant disclosure on a tenant admin's own page, with no code change required to trigger it.**
Removing the page removed the reader; **it did not fix the function**, and the function is still
callable. ⚠️ **Whoever resurfaces an activity log inherits this, and must give `audit_logs` an
`org_id` before writing a single line of UI.**

---

## 5. ⚠️ The 33% blind spot — measured, and it defeats the obvious workaround

The obvious way to scope `audit_logs` without a schema change is to join through `profiles` on
`actor_user_id`. **It silently drops a third of the ledger.**

```
audit rows, last 14 days ............. 2,401
  of which actor_user_id IS NULL ....... 807   (33.6%)
```

Those are trigger and system writes — **every change the app made to itself.** Any read keyed on the
actor omits all of them, and omits them invisibly: the page still fills up, so nothing looks wrong.

⚠️ **`dash_activity_readback()` has this bug today.** Its audit branch requires
`EXISTS (SELECT 1 FROM profiles pr WHERE pr.user_id = al.actor_user_id AND pr.org_id = v_org)`, and
`NULL` fails the `EXISTS`. **If that function is ever put back on a surface, this must be fixed in
the same change** — `... WHERE al.actor_user_id IS NULL OR EXISTS (…)` — or the surface ships a
known one-third blind spot on day one.

---

## 6. ⚠️ `dash_activity_readback()` IS RETAINED. Start there.

It is the one honest read of D19's five ledgers that has ever been built. Finished 2026-08-22
(TASK-DASHBOARDBUILD), it `UNION`s **`status_events`, `notifications`, `document_deliveries`,
`receipt_sends`, `audit_logs`**, is **org-scoped** (`org_id = current_org()`), is gated on
`has_staff_access()`, and applies the **fair-share-per-ledger** window described in §2.

**The zone that rendered it is gone; the function is not.** Its client wrapper
(`fetchActivityReadback`) and its component (`ActivityZone`) were removed with the zone — they are
recoverable from git, and they are the smaller half of the work.

**Ledger sizes on the day this was written**, so a future reader can tell growth from breakage:

| Ledger | Rows |
|---|---|
| `audit_logs` | 5,632 |
| `status_events` | 1,335 |
| `notifications` | 170 |
| `document_deliveries` | 79 |
| `receipt_sends` | **0** |

⚠️ **`receipt_sends` at 0 is EMPTY, NOT UNWRITTEN** — `log_receipt_send` / `claim_receipt_send` exist
and `api/_lib/receipt.ts` calls them on every attempt, success or failure. Do not read that zero as a
missing writer.

---

## 7. What is NOT covered by this removal

- **`DocumentIntegrityPanel`** lived on the Oversight page and **is not activity logging.** It names
  broken documents and lets the owner clear one at a time with a written reason, and its CRUD is
  correct under D32. It was **retired behind `DOCUMENT_INTEGRITY_PANEL_RETIRED`** (currently `true`)
  on the documents ledger — `src/pages/app/ops/DocumentsQueuePage.tsx` — not destroyed. One boolean
  brings it back. `document_integrity()` and `cleanup_document()` are untouched.
- **The per-person reads survive and were never in scope.** `contact_dossier()` returns a person's
  `notifications` **and** their `activity` (both confirmed in the live function body), and
  `ContactDossierModal` renders the second as its own **Activity** tab. `StatusLog` renders a
  per-account timeline, fed by `entityStatusLog('account', …)` from `ClientInvitationSection`.
  `Admin.tsx` reads `audit_logs` too, but only to derive a **last-active timestamp** per contact —
  it is not a rendered trail, and should not be mistaken for one.
  **"What has happened to this person" is still answerable.** What was removed is the org-wide
  firehose.
- **CR-30's Account History is still unbuilt** — zero hits for `AccountHistory` in `src/`. When it
  ships, its per-person slice comes from `contact_dossier`, not from anything described here.
