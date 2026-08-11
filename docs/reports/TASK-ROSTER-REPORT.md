# TASK-ROSTER — report

Branch `task/roster` (worktree off `origin/main` @ 33dd0ac). 2026-08-10.

## What was built

**The Clients page (`/app/admin`, `Admin.tsx`) is now the one people page.**

### Database (migration `20260810T1600_roster_one_people_page.sql` — APPLIED to prod)

1. **`admin_client_accounts()` gained a third arm** — contacts with no account
   and no `clients` row, which previously appeared in *neither* arm (F1
   confirmed: they were never selected, not filtered). Scope of the new arm:
   `contact_type = 'CONTACT'` or unfiled (`NULL`); any contact with a live
   clients row or USER login still shows regardless of type (arms 1–2,
   unchanged).
2. **Every row gained aggregates** (one LEFT JOIN LATERAL, no N+1):
   `document_count` (own + party grain, same as `staff_contact_directory`),
   `order_count` (`purchases` by `buyer_contact_id` / `buyer_user_id`),
   `credits` (open balances only, each with **the name the credit applies to** —
   offering name, else `package_key`), `services` (consumed service events
   keyed by `service_type` code).
3. **`roster_service_slots()`** — the positional band's slot list: active
   service types with ≥1 active offering, ordered rider → horse → acquisition.
   DB-derived; a new catalog service grows a slot with no frontend change.

**"Consumed" definition** (stated because the task doc doesn't define it):
bookings in `scheduled`/`confirmed`/`completed`/`no_show` (available slots,
drafts, cancellations are not service events), plus consumed **non-session**
fulfillment units (periods/milestones/executions — session units are excluded
because their booking is already counted). A `kind='lesson'` booking with no
offering and no credit falls back to `RIDING_LESSON` — this matches live data,
where credit-booked lessons carry no `offering_id`.

Migration discipline: no `BEGIN;`/`COMMIT;` in the file; dry-run inside an
external `BEGIN…ROLLBACK` against prod; **rollback proven by re-query** (old
16-column signature back, `roster_service_slots` absent); then applied and
re-verified. Grants after `DROP`+`CREATE` match the previous ACL (default
PUBLIC execute; both functions gate on `is_admin()` / read public catalog data).

### Frontend

- **Positional row** (`RosterRow` + `RosterHeader` in `Admin.tsx`): one shared
  CSS-grid template — person | docs | orders | credits | service band | status.
  **Every slot renders in every row**; an empty slot shows a faint placeholder
  dot holding its position (the container scrolls sideways rather than ever
  reflowing). Segment tints + dividers group the band into rider | horse care |
  acquisition zones. Counts show only when nonzero (a zero is noise). Avatar
  shows two-letter initials; tags render as chips under the name.
- **Sort ported from `ContactsPage` verbatim**: A–Z on display name (default) /
  Newest by `created_at`. The old Active-first sort key is gone with the port.
  Search also covers tags now (they're visible on the row).
- **Button is `+ ADD NEW`** — no designation; same action as before
  (`/app/ops/accounts/new`).
- **Row click still goes straight into the record** — same isolate-in-place
  behavior; `kind='contact'` rows open the pending-style view (paperwork
  editor + provision/invite via the shared `ProvisionClientForm`), which keys
  off `contact_id` and degrades cleanly with no `client_id`.
- **`ContactsPage` retired behind `CONTACTS_PAGE_RETIRED = true`** (in
  `ContactsPage.tsx`, per the 86a2c33 rule — nothing deleted; `DirectoryPage`
  and `LeadsPage` from the same file are NOT retired). While true:
  `/app/ops/contacts` **redirects** to `/app/admin` (old links land on the
  winning page), and the AppLayout nav item is hidden. `InstructorHome`'s
  Clients tile now targets `/app/admin`.
- **`HorseIntakeForm`** (the other `adminClientAccounts` consumer) filters out
  `kind='contact'` rows from its assign-to picker — owning a horse requires an
  account, so its population is unchanged.

## Verified (not assumed)

- **Population**: roster returns **15** rows. `SELECT count(*) FROM contacts
  WHERE deleted_at IS NULL` = **25**; deliberate exclusions = **6 LEAD** (stay
  on the Leads page until worked — owner lifecycle) + **4 TEAM** (both staff
  identities' TEAM contacts, the Cactai platform contact, and the FHE company
  contact — Team & access / D1). 15 + 6 + 4 = 25, exact. 0 DIRECTORY-typed
  contacts exist. The one newly-visible person is **Gabriella Olenik**
  (CONTACT, no account, no clients row — the exact F1 gap case).
- **Reconciliation on three shapes** (roster row vs direct source queries, all
  exact):
  - *Rider* — Madeline Do: 4 docs, 0 orders (blank), 9 in the Riding Lesson slot.
  - *Horse owner* — Sarah Morgan (owns 1 horse): 8 docs, 0 orders, 1 riding
    lesson. (Her horse-ownership shows via tags; no horse-care service has been
    consumed by anyone yet — see honesty note below.)
  - *Neither* — Gabriella Olenik: 4 docs (party on the family's paperwork),
    nothing else; every band slot empty and holding position.
  - *Credits* — Claire Bourdon: `1 × Full Body Clip` (from `package_key`; her
    two zero-balance credits correctly do not render). Her roster credit line
    matches `lesson_credits` exactly.
- **The positional test** — `docs/reports/TASK-ROSTER-positional.png`:
  rider row (ink in the leftmost band slot), horse-owner row (ink in the three
  horse-care slots), neither row (all dots). The difference is visible purely
  in shape; all rows share identical column positions.
- **Health**: typecheck 0, typecheck:api 0, lint **0 errors / 30 warnings =
  measured baseline** (stash-compared, not assumed), build passes (the one
  `<Navigate>` prerender warning appears exactly twice on baseline too).

## Assumed / honestly flagged

- **No live contact has consumed a horse-care service yet** (no `care`
  bookings, no consumed fulfillment units in prod). The horse-owner row in the
  positional screenshot is therefore a **clearly-labeled synthetic demo row**
  rendered through the real `RosterRow` component; the rider and neither rows
  are real data. No prod data was fabricated.
- The screenshot was produced through a temporary local harness route feeding
  the real components a psql snapshot of the two RPCs, because no staff
  credentials exist in this environment (same wall the ACCOUNTSURFACE thread
  hit). Harness deleted before commit; an in-browser authenticated
  click-through is still owed when the owner is logged in.
- `is_admin()` behavior was verified by simulating the admin JWT
  (`request.jwt.claims`) in psql, not via a browser session.

## Slot stability

All 8 current purchasable service types have a stable slot (2 rider, 3 horse,
3 acquisition). **No service type lacks a slot.** Service types with no active
offering (JUMPER_TRAINING, the four lease/sale assistance types, ONBOARDING,
INDEPENDENT_CONTRACTOR/internal) have no slot until an active offering exists —
if one has *consumed history* but no slot, the row grows a trailing "Other"
column rather than dropping the data. If the slot count ever passes ~12 the
band needs a design pass, not more columns (noted in code).

## Lead lifecycle (context noted, not built)

When a worked lead converts, whatever flow does the conversion should set
`contact_type = 'CONTACT'` (or create the clients row / account through the
provisioning spine) — the roster picks it up automatically from any of those
three states; no roster-side change is needed. Until then the lead stays on
the Leads page only. A worked lead lands as a `kind='contact'` row ("No
account" status, "added <date>") with any pre-existing documents/orders already
counted, and its provision-and-invite panel one click away — UIO-012's
Dashboard/Inbound work does not collide with this surface.
