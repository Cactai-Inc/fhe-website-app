# TASK-LEADCLEAN — report

**Branch** `task/leadclean` (worktree `~/Downloads/claude-code-repo/wt-leadclean`), rebased
onto `main` @ `a8b0bbe`. **Not pushed.**
**Commits** `3848dfe` (the task) and `a22b03e` (a cross-thread test collision the rebase
exposed — see §7).
**Migration** `20260811T1900_leadclean_open_queue.sql` — **applied to production**
(`lrstswfxfsezdmvkvukc`).

**Render status: NOT VERIFIED.** No staff browser session exists and none was given. Every
count below is proven against direct SQL, and the interactions that could not be proven any
other way are proven by 8 new UI tests under jsdom. Nobody has looked at the actual page.

---

## 1. What was wrong, in one line

The software already computed the answer. `inbound_queue.already_converted` has been on every
row all along, `api-intake.ts:124` carried it to the UI, and `IntakePage.tsx:697` rendered it
as *"{n} already handled, still marked new"* — a notice asking the owner to do the clearing.
**That notice was the bug.** Six people who are already clients were being announced as new
work, on a badge and a card band, indefinitely.

Nothing here writes a second definition. The view's is the only one, on both sides of the wire.

---

## 2. THE TEST — proven against SQL

Production, after the migration, with `psql` as the tenant admin
(`b45a5503…`, org `e656f20b…`):

```
requests_total  null_links  status_new  status_converted  retired  open_leads  badge
            12           1           7                 0        7           5      5
```

| the test asks | result |
|---|---|
| Six stale cards leave the dashboard | ✅ Ashlan Hockersmith, Brian Olenik, Elisheva Fiszer, Marissa Robertson, Melanie O'Mea-Smith, Raymond Thicklin — all `already_converted`, all out of the open set |
| Serena Lee's leaves too | ✅ `contacted` + `already_converted` → out. She was never on the old dashboard at all (it filtered `status='new'`); she is out of the new one by verdict, not by status |
| The four genuinely open leads stay | ✅ Audrey Brennan, Emmy Castro, Hannah Dryden, Naomi Pouliot — all `contacted`, all `already_converted = false`, all in the open set. **See §4: they are only visible at all because the open predicate was widened** |
| **Kit Garcin stays** | ✅ in the open set, `status` still `new`, `contact_id` still **NULL**, `already_converted` still `false`. Not converted, not cleaned, not backfilled |
| No `requests` row deleted | ✅ 12 before, 12 after. No soft-delete either — `requests` has no `deleted_at` |
| No status rewritten | ✅ `status='new'` is still 7; `status='converted'` is still **0**, as it has always been |

The exact partition, read from production:

```
OPEN — stays on the dashboard      Audrey Brennan       contacted
OPEN — stays on the dashboard      Emmy Castro          contacted
OPEN — stays on the dashboard      Hannah Dryden        contacted
OPEN — stays on the dashboard      Kit Garcin           new        <- THE CONTROL
OPEN — stays on the dashboard      Naomi Pouliot        contacted
RETIRED — became a client          Ashlan Hockersmith   new
RETIRED — became a client          Brian Olenik         new
RETIRED — became a client          Elisheva Fiszer      new
RETIRED — became a client          Marissa Robertson    new
RETIRED — became a client          Melanie O'Mea-Smith  new
RETIRED — became a client          Raymond Thicklin     new
RETIRED — became a client          Serena Lee           contacted
```

I also **independently cross-checked the two definitions** rather than taking the addendum's
word for it — the view's `contact_type = 'CONTACT'` against §2's "holds a `clients` row". They
agree on all 12 rows, and every one of the 7 has `client_since` set (none has `customer_since`).

---

## 3. What was built

### The data seam — one definition, one source
`listLeadQueue()` (`src/lib/ops/api-intake.ts`) splits the inbox into `open` and `converted`
using **`inbound_queue.already_converted` and nothing else**. Two reads, because the view holds
the verdict and the `requests` table holds `request_selections` (what they actually asked for,
which the card needs to say anything useful).

`already_converted` is `null` when no contact matched at all — that is *not converted*, so the
row stays open. Both the SQL and the TypeScript coalesce it explicitly; `NOT NULL` in SQL would
have silently dropped exactly the submission that most deserves attention.

### The machinery survived the page
`components/app/LeadWorkDrawer.tsx` — **extracted from `IntakePage`, not copied.** It carries
the per-service fit checklist (`LESSON_FIT_CHECKLIST` → `set_request_checklist`), the staff
call-notes timeline (`append_request_note`), "Mark contacted", "Send as gift"
(`GiftCreateForm`), the checklist-gated `ProvisionClientForm`, and the schedule-lesson path
(`findClientForRequest` → `ScheduleSessionForm` → `schedule_lesson_session`).

Both hosts render the same component: the Inbound page (unchanged behaviour) and the dashboard
lead card. There is exactly one implementation of "work a lead", so retiring a page could not
quietly cost the product a capability.

### Inbound retires
`INTAKE_PAGE_RETIRED = true` in `IntakePage.tsx`, the same shape `CONTACTS_PAGE_RETIRED`
already uses. **Nothing is deleted** — the page still compiles and flipping the boolean
restores it whole. The nav item was already gone (`AppLayout.tsx`, UIO-012 item 2); this closes
the route half.

The route redirects **and carries `?request=` through**, because five DB functions still write
notification links pointing there (`submit_public_request`, `create_gift`, `redeem_gift`,
`provision_client_invitation`, `sign_start_register_attempt`), plus the staff email in
`api/request-received.ts`. A 404 would have broken notifications already sitting in the live
table. `/app/ops/intake?request=X` → `/app/dashboard?request=X`, and the dashboard opens that
lead's drawer from the param.

### The "and 1 more" control — all three defects
1. **The count** is now the real remainder of the list it sits under.
2. **The action** expands in place; it does not navigate.
3. **The destination** is gone.

For the record, the original count was arithmetically right about *its own* list (7 leads,
6 shown → "1 more waiting") — the lie was the destination, which showed a differently-filtered
list of all 12 rows. That is why clicking "1 more" showed many more. Both halves are fixed.

### Converted leads are marked up, not vanished
A collapsed line under the band — *"7 leads already became clients"* — expanding to each name,
when they enquired, and **"Open record →"** linking to `/app/admin?open=<contact_id>`, the
existing deep-link the Clients page already honours. A lead that silently disappears is its own
kind of confusion.

### The badge stopped lying
`inbound_open_count()` now counts exactly what the dashboard lists. **7 → 5** for the tenant
admin, measured before and after. `useOpenLeads`'s stated contract was that the list and the
badge can never disagree; it was not true before this.

---

## 4. Decisions I made, stated so you can veto them

**(a) The open list now includes `contacted`, not just `new`.** This is the one judgement call
with teeth, and the acceptance test forced it: *"the four genuinely open leads stay"*. All four
are `contacted`. The old dashboard filtered `status='new'`, so they were never on it — and with
Inbound retiring they would have become **invisible in the entire product**. "Stay" would have
been false. So the open predicate is *not in a terminal status* (`converted`/`expired`) *and
not already converted*. `invited` stays visible too: they were invited and have not registered,
which is open work.

Consequence: the badge counts 5 rather than 1. If you want the band to mean "untouched since it
arrived", say so and it becomes a one-line change in both the migration and `listLeadQueue`.

**(b) Derived at read time, nothing materialised.** As §4 of the task and the addendum both
settle. No `converted` status is backfilled; it is right retroactively and cannot drift.

**(c) The backfill excludes Kit Garcin by request id**, with a comment naming why. An id rather
than the email — less personal, and precise. Exactly one live contact holds `kitgarcin@gmail.com`,
so the *only* reason that row is still NULL is the exclusion clause, and the DB test asserts
precisely that.

**(d) I did not fix the trigger that causes the NULLs.** See §6 — it is the intake write path,
not the dashboard, and it has a non-obvious side effect. Reported, not decided.

---

## 5. The backfill, precisely

`UPDATE 2` — Marissa Robertson and Emmy Castro. Both had exactly one non-deleted contact on
their email, so the link is evidence rather than a guess. `HAVING count(*) = 1` is the whole
guard: an email held by two live contacts keeps its NULL.

- **No ambiguous rows existed in production** — all three NULLs had exactly one match. The
  guard is therefore untested by production data, so the DB test builds the ambiguous case
  explicitly (two contacts on one email) and proves the refusal.
- **Verdict-neutral**: `already_converted` was 7 before and 7 after; the open set is identical
  before and after. The test asserts this directly, on the fixture, across the migration.
- Remaining NULL: **1**, Kit Garcin, on purpose.

---

## 6. Flagged, not fixed

**F1 — `requests_capture_contact` has never actually linked a request. This is why the NULLs
exist, and there will be more.**
The trigger is `AFTER INSERT` and its last act is `NEW.contact_id := v_contact`. Assigning to
`NEW` in an `AFTER` trigger does nothing. Its own migration comment
(`20260802000000_lead_trust_notifications.sql`) says *"ITEM 2: keep the link. Both paths … persist
the id"* — it does not.

The evidence is decisive: `contact_id` was added `2026-08-02`, and **every request created on or
after that date has NULL** (Marissa, Emmy, Kit) while every earlier row has a value. The older
rows were filled by a one-off; the trigger has never filled one. My backfill is the second
one-off, and without a fix there will be a third.

Lowest-risk fix — keep the trigger `AFTER` and persist explicitly, rather than moving it to
`BEFORE`:

```sql
UPDATE requests SET contact_id = v_contact WHERE id = NEW.id AND contact_id IS NULL;
```

Why not `AFTER` → `BEFORE`: triggers fire in name order, and `requests_capture_contact_trg`
sorts before `requests_normalise_phone_trg`. Moving it would make new contacts capture the
**un-normalised** phone. The `UPDATE` above avoids that entirely (it does not touch
`contact_phone`, so the `UPDATE OF contact_phone` trigger never fires). Not applied: it changes
what every public submission writes, which is your call, not this task's.

**F2 — should the schedule-lesson path also write `status='converted'`?** The addendum says
report, do not decide. It is the only writer of that status and it has never run: production
`requests.status` holds only `new` and `contacted`, and `converted` is still 0 today. Nothing
in this task depends on the answer — the derivation ignores the status entirely.

**F3 — `OpsDashboard.tsx:148` still links to `/app/ops/intake`** ("Intake to review"). Left
alone deliberately: `/app/ops` is the strand ADMINSWEEP owns, and the redirect makes the link
work regardless. Same for the staff email in `api/request-received.ts:163`, whose link now
redirects correctly but still reads "Open the Request Inbox".

**F4 — the platform owner (SUPER_ADMIN, `org_id` NULL) gets `inbound_open_count() = 0`.**
`org_id = current_org()` is never true when `current_org()` is NULL. **Pre-existing and
unchanged** — the old function had the identical clause. Noted because I measured it.

**F5 — the "more waiting" control cannot be exercised against live data.** Five open leads
against a six-card preview means zero remainder, so the control does not render at all today.
It is proven by UI test instead (8 leads → "Show 2 more waiting" → 8 cards, route unchanged).

---

## 7. Cross-thread collision, found and fixed

ADMINSWEEP Phase 2 merged to `main` (`bc2a3a8`) **after** this branch was cut, adding
`test/ui/adminsweep_instructor_preview.test.tsx`, which mocks `useOpenLeads: () => []`. This
task changes that hook's return to `{ open, converted, reload }` and `InstructorHome`
destructures `.open`, so the bare-array mock made the component read `.length` of `undefined`.
Caught by rebasing onto current `main` rather than merging blind; fixed in `a22b03e`.

`InstructorHome` itself is updated for the new shape (2 lines) and its two `/app/ops/intake`
links now point at `/app/dashboard`.

**Files I was told not to touch, and did not:** `AppLayout.tsx` (NAVMOTION) and
`src/components/ops/kit/DataTable.tsx` (FRAMESCROLL). `ops/ContactsPage.tsx` was re-read after
the PAGEFRAME rebase and needed no change — `LeadsPage` is a `contact_type='LEAD'` directory,
a different dataset from `requests`, so it is untouched by this task. **Nav change to report:**
none needed. Inbound was already off the nav; only the route remained, and this closes it.

---

## 8. Proof

**A real bug the harness caught before production did.** The migration's first draft used
`min(c.id)` to pick the single matching contact. **Postgres has no `min()` aggregate for
`uuid`** — confirmed against production directly, not just PGlite:

```
ERROR:  function min(uuid) does not exist
```

The whole migration would have rolled back. It now uses `(array_agg(c.id ORDER BY c.created_at))[1]`,
the same tie-break `inbound_queue`'s own lateral join uses.

| check | result |
|---|---|
| `test/db/leadclean_open_queue.test.ts` | **8/8 pass** — migration applied to a fresh PGlite database and exercised: the verdict ignores status, terminal statuses stay out, the control row keeps its NULL, the ambiguous email is refused, the backfill is verdict-neutral, the badge counts 4 for staff and refuses a member, nothing deleted |
| `test/ui/leadclean_dashboard_leads.test.tsx` | **5/5 pass** — the count, expand-in-place with no route change, collapse, card opens the drawer without leaving, converted row links to the record |
| `test/ui/leadclean_intake_retired.test.tsx` | **3/3 pass** — retired behind a boolean, bare link redirects, `?request=` carried through |
| `test/ui` (whole suite) | 83 tests, 1 failure — `pluspass_create_controls`, which **fails identically on `main`** |
| `test/db` (whole suite) | unchanged from `main`. Most suites fail at setup on both trees (`relation "offering_tiers" does not exist` — the snapshot postdates the tiers removal), and the two suites that fail assertions (`organizations`, `service_catalog`) fail identically on `main`. Verified by running both trees side by side |
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors. 39 warnings vs 36 on `main` — the 3 new ones are all `react-refresh/only-export-components` on `LeadWorkDrawer.tsx`, the same accepted pattern `IntakePage` and `ScheduleSessionForm` already carry |
| `npm run build:client` | clean |
| staff RLS read path | verified as the real tenant admin with `SET ROLE authenticated` + JWT claim: 12 rows through `inbound_queue`, 7 converted, 5 open, 12 `requests`, 6 `request_selections`, 0 open support |

**Not proven:** that any of it looks right. Nobody has loaded the page.
