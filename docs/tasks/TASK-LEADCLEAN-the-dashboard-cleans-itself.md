# TASK LEADCLEAN — a lead card retires itself when the person becomes a client

**Owner, 2026-08-11:**

> *"the system needs to be intelligent enough to mark up and remove lead cards when a lead
> becomes a client so even without staff interaction the activity record is accurate and the
> status is not confusing between the same name being in two places."*

**The operative phrase is "even without staff interaction."** This is a DERIVATION, not a
status someone has to remember to set. A cleanup that depends on a human doing it is the
problem restated, not solved.

---

# THE LIVE DATA — measured in production 2026-08-11, not hypothetical

**Seven leads are stale right now.** Each is still showing as an open lead while the person
already holds a `clients` row:

```
Marissa Robertson     new        client ✓
Melanie O'Mea-Smith   new        client ✓
Brian Olenik          new        client ✓
Raymond Thicklin      new        client ✓      <- not in the owner's list, same state
Ashlan Hockersmith    new        client ✓
Elisheva Fiszer       new        client ✓      <- not in the owner's list, same state
Serena Lee            contacted  client ✓
```

**Genuinely open, leave alone:** Emmy Castro, Naomi Pouliot, Hannah Dryden, Audrey Brennan —
all `contacted`, no client row.

## ⚠️ KIT GARCIN IS RESERVED. DO NOT TOUCH THAT ROW.

`kitgarcin@gmail.com` — `new`, contact exists, **no client row**. That is the correct live-lead
state, and the owner is holding it as the acceptance case for the whole lead-promotion chain.

**Do not convert it, do not clean it, do not include it in any backfill.** If your derivation
would change Kit Garcin's card, your derivation is wrong — that row is the control.

---

# THE MODEL

## 1. Converted is DERIVED

A request is converted when its person holds a `clients` row (`client_since` **or**
`customer_since` — the two D8 markers). **Do not add a status a human sets.** This codebase
already has the pattern and the precedent: `apply_affiliations` is the sole writer of derived
group rows, and hand-written affiliations are treated as a regression. Follow that shape.

## 2. Join on `contact_id`, not on the email string

**`requests.contact_id` already exists and is populated on 9 of 12 rows.** Use it. Email
matching is the fallback, not the primary key — people change addresses, and this project has
already been bitten by same-name-different-person and same-person-different-record.

**Backfill the 3 NULL `contact_id` rows** by email where a confident single match exists.
**Where the match is ambiguous, leave it NULL and report it** — do not guess a link between a
lead and a person.

## 3. The lead record is RETAINED. Only the card leaves the dashboard.

The owner's words are *"mark up and remove lead cards"* and *"the activity record is
accurate"* — those are the same sentence, so removal means removal **from the dashboard's open
list**, not from history. The request is how the relationship started and it stays as evidence.

**Never delete a request. Never soft-delete one as part of this.**

## 4. Where the converted state lives

`requests.status` today only ever holds `new` or `contacted`, and **`requests` is not on the
`status_events` spine at all** — `status_events_vocab` has no `request` entity type, and
`status_events_entity_type_check` does not permit one.

Two viable shapes. **Choose one, state why, and do not build both:**

- **Derive at read time** — the dashboard query excludes requests whose contact holds a
  clients row. Nothing is written, so nothing can drift, and it is correct retroactively for
  all seven stale rows with no backfill at all.
- **Materialise a `converted` state** — richer (it can carry *when* conversion happened) but it
  needs a writer, a trigger to keep it live, and a backfill, and a materialised value can drift
  from the truth it was derived from.

**Orchestrator's read, offered as input:** derive at read time. It cannot drift, it fixes all
seven immediately, and if a conversion timestamp is wanted later, `clients.client_since`
already holds it.

## 5. The card should say what happened

*"mark up"* — a converted lead, when viewed in the leads history, should show that it became a
client and link to that person's record. A lead that silently vanishes is a different kind of
confusion from a lead that sits there stale.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-leadclean`, branch `task/leadclean`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **`DashboardPanel.tsx` is where staff actually land** — `/app/dashboard`. DASHLEADS proved
  `InstructorHome`/`OpsDashboard` at `/app/ops` is unreachable from any nav link or in-app URL.
  Build against the surface people use; do not ship to the dead one.
- **`AppLayout.tsx`**: report nav changes, do not edit — other threads work in that file.
- No staff browser session exists and you will not be given one. Prove the query result against
  direct SQL and report the render as **NOT VERIFIED**.
- Migrations: **no self-contained `COMMIT;`**, and **do not reuse a temp table name** another
  migration uses — two migrations both using `_lf` could not run together and that is part of
  why a batch of contract work sat unshipped.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

Six stale cards leave the dashboard, Serena Lee's leaves too, the four genuinely open leads
stay, **Kit Garcin stays**, and no `requests` row is deleted. Prove each count against SQL.

Report to `docs/reports/TASK-LEADCLEAN-REPORT.md`.

---

# ADDENDUM — 2026-08-11. THE DETECTION ALREADY EXISTS. CONSOLIDATION IS THE REAL TASK.

**If you have already started, read this — it changes §4 and widens the scope.**

## The system already knows. It just tells the owner instead of acting.

`inbound_queue` (a DB view) computes **`already_converted`** on every row:

```sql
c.contact_type = 'CONTACT' AS already_converted
```

It joins `requests` → `contacts` on `contact_id` when set and falls back to lower(email) —
**exactly the join §2 asks for. Do not write a second one.** `src/lib/ops/api-intake.ts:124`
carries the field, and its own comment says *"Six of the nine rows in the live backlog were
exactly this."*

And `IntakePage.tsx:697` then does this with it:

```js
const stale = rows.filter((r) => r.already_converted && r.status === 'new');
// renders: "{stale.length} already handled, still marked new"
```

**The software computes the answer, renders a notice asking the owner to act on it, and does
nothing.** The owner's words: *"funny, my software telling me to do its job for it when it
already knows what should be done and isnt doing it."*

**That notice is the bug.** The fix is not a better notice.

## §4 is settled: use `already_converted`. Do not invent a definition.

§4 offered a choice and §2 proposed "holds a `clients` row". **Checked against production: both
definitions agree on all 12 live rows.** So the view's definition wins on the grounds that it
already exists, is already delivered to the UI, and already has a consumer.

**One definition, one source.** A second derivation is how three views came to disagree.

## THE ACTUAL PROBLEM — three surfaces over one dataset

| surface | file | what it shows |
|---|---|---|
| Dashboard | `DashboardPanel.tsx` (`/app/dashboard`) | leads as cards — where staff land |
| Inbound | `ops/IntakePage.tsx` | the queue, with `already_converted` badges and the stale notice |
| Leads | `LeadsPage` in `ops/ContactsPage.tsx` | LEAD-typed contacts |

Overlapping, differently filtered, none acting on the signal. **The owner already ruled on the
target shape** — *"inbound goes away. its my management dashboard"* and *"one nav entry under
management and it uses the dashboard layout and the leads are shown as dashboard entries."*

**So: the dashboard is the surface. Inbound retires.**

**But IntakePage carries real working machinery that must NOT be lost** — the per-service fit
checklist (`LESSON_FIT_CHECKLIST`, stored via `set_request_checklist`), `ProvisionClientForm`,
the schedule-lesson path that sets `status='converted'`, and `findClientForRequest`. **Retire
the page, keep the machinery**, reachable from the lead card. Retire behind a boolean the way
`ContactsPage` was retired. **Delete nothing.**

## The "and 1 more" defect — three bugs in one control

Owner: *"the dashboard view says 'and 1 more' below the rows of cards shown but clicking it
doesnt show 1 more it shows many more because it doesnt work as expected (expand the leads
section of the dashboard, it takes me to the inbound page)."*

1. The **count is wrong** — it says 1 and there are many.
2. The **action is wrong** — it navigates instead of expanding.
3. Its **destination is a page that is being retired.**

Expanding must expand, in place, and the count must be the real remainder.

## The `converted` status exists and has never been reached

`IntakePage.tsx:61` defines `converted`, and `invited`, as request statuses. **Production
`requests.status` only ever holds `new` or `contacted`** — the only writer is the
schedule-a-lesson path, so the seven stale rows never had a route to it.

**Do not backfill `status='converted'` to fix the display.** Derive from `already_converted`
so it is right retroactively and cannot drift. Whether `converted` should also be written when
that path runs is a separate question — report it, do not decide it.

## KIT GARCIN IS STILL THE CONTROL. Nothing above changes that.
