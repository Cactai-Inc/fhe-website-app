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
