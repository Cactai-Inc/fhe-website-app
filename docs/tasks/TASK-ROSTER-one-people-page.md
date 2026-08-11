# TASK ROSTER — one people page, and the row tells you who someone is at a glance

**Owner ruling, 2026-08-10. This REVERSES a previous instruction and the reversal is the point.**

> "we need to decide about the clients vs contacts, originally i instructed you to remove the
> clients page after contacts page was done being built, I like the layout of the clients page
> better and the information shown on the card is more useful and the click takes me right into
> their record. we need to just stick with using the clients page, but we need to update it to
> show all of the contacts not just the ones labeled clients"

**The Clients page wins. `ContactsPage` is retired.** Removal means hidden behind a boolean,
never deleted — the standing rule from `86a2c33`.

---

## Naming, before anyone goes looking

| what the nav says | route | file |
|---|---|---|
| **Clients** — the page that WINS | `/app/admin` | `src/pages/app/Admin.tsx` |
| **Contacts** — the page being retired | `/app/ops/contacts` | `src/pages/app/ops/ContactsPage.tsx` |

The page the owner calls "Clients" is `Admin.tsx`. Do not assume a `ClientsPage` exists.

## Findings — verified 2026-08-10, do not re-derive

### F1. It cannot show all contacts today. They are not filtered out — they are never selected.

`admin_client_accounts` is a UNION of exactly two arms:

```sql
-- arm 1: accounts
FROM profiles p ... WHERE p.role = 'USER' AND is_admin()
UNION ALL
-- arm 2: clients WITHOUT an account
FROM clients cl ... WHERE cl.org_id = current_org() AND cl.deleted_at IS NULL AND is_admin()
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id)
```

**A contact with no account and no `clients` row appears in neither arm.** Widening this is the
core of the task, not a filter change.

### F2. None of the row data the owner wants is returned.

`admin_client_accounts` returns: `kind, user_id, contact_id, client_id, first_name, last_name,
display_name, email, is_suspended, member_status, created_at, tags, invite_id, invite_status,
invite_expires_at, invite_scheduled_for`.

**No document count. No order count. No credits. No services consumed.** All of it must be
added — this is why the task is not a UI order.

### F3. Aggregates that already exist and should be reused, not rebuilt.

`credits_roster` · `admin_client_documents` · `admin_client_items` · `admin_client_bookings` ·
`admin_client_overview` · `contact_checklist`

**Read each before writing anything new.** Prefer extending `admin_client_accounts` with
aggregate columns over N+1 calls per row — the page renders a list.

---

## What the row must show

**Only when it exists.** An empty slot is information; a zero is noise.

- avatar letters · name · email
- tags
- document count
- order count
- credits, **and the name the credit applies to**
- services consumed, **each with its own label** — lessons, and each horse-care service

## THE DESIGN PRINCIPLE — position encodes category. This is the requirement.

> "things should have a specific location so lessons are always in the same place and horse
> care services are each in their own place. this way i can visually differentiate a horse
> owner from a rider easily and quickly based on where there is information shown on the row
> card."

**Every service type owns a fixed slot on the row. The slot exists whether or not it is filled.**
Lessons are always in the lessons position; each horse-care service is always in its own.

**So a row is read by SHAPE before it is read by content.** A rider shows information on the
left of the service band and nothing on the right; a horse owner is the inverse. The owner
identifies who someone is **without reading a word** — that is the feature, and any layout that
reflows to close gaps destroys it.

**This rules out a flex row that collapses empty items.** Slots hold their position when empty.

**The service list is DATA, not a hardcoded set.** The catalog is DB-driven (`offerings`,
`config_kind`) and `src/lib/services.ts` and `src/lib/catalog.ts` are RETIRED shadow catalogs —
do not resurrect them. **Derive the slots from the catalog** so a new service does not silently
have nowhere to land. **If the slot count grows unbounded, stop and report** rather than
letting the row become unreadable.

## Also required

- **The sort from `ContactsPage`** — port it, do not reinvent it.
- **The button becomes `+ ADD NEW`.** No designation, no "add client".
- **Clicking a row still goes straight into the record.** The owner named this as a reason the
  page won; do not regress it.

## Lead lifecycle — context, not scope

> "when a lead is done being worked it goes to either the contacts page or it stays in the
> leads page."

Leads move into this roster when worked. **UIO-012 makes the Dashboard absorb Inbound** and
render leads as entries. **Do not build the lead flow here** — note how a worked lead should
appear in this roster and report it.

## Constraints

- Own worktree off `origin/main`. **Never the canonical checkout** — a pre-commit hook refuses
  code commits there.
- `npm install` in the worktree before claiming a typecheck. **`npx tsc` with no `node_modules`
  fetches an unrelated package and exits 0.**
- A migration must **never** contain its own `BEGIN;`/`COMMIT;` — the file's COMMIT ends the
  dry-run wrapper. **Two threads applied to production this way on 2026-08-10.** Prove the
  rollback by re-querying after it.
- Retire `ContactsPage` behind a boolean. **Do not delete it.**
- `ClauseDocument.tsx` is untouched by this.

## Verification

- **Every contact appears.** Compare the roster's row count against `SELECT count(*) FROM
  contacts WHERE deleted_at IS NULL` and account for any deliberate exclusion.
- **Every count on a row reconciles** against its source, on at least three real contacts with
  different shapes — one rider, one horse owner, one with neither.
- **The positional test:** screenshot a rider row and a horse-owner row and show that the
  difference is visible in the SHAPE, with slots holding position when empty.
- Typecheck, typecheck:api, lint, build. Baseline: 0 errors, ~30 lint warnings.

## Reporting

`docs/reports/TASK-ROSTER-REPORT.md`. State what you verified versus assumed, and list any
service type you could not give a stable slot.
