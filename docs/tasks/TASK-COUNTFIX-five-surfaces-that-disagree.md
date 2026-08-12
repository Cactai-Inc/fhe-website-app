# TASK COUNTFIX — five places the app states the same number two different ways

**Plan of attack item 6.** Sourced from `docs/reports/TASK-DUPECENSUS-REPORT.md` Tier 1 —
**read that section before starting; every finding below is documented there with file, line and
production evidence.**

**These are ranked first in the census for one reason: they make the app lie.** A duplicated page
is untidy. A number that reads 318 on one screen and 39 on another is a surface the owner cannot
trust, and one of these is **customer-facing**.

---

# THE FIVE

## 1.5 — `/acquisition` shows ZERO catalog items. **Fix this first: it is public.**

`OfferingCatalog` (`/shop`, `/app/catalog`) renders **27** active offerings.
`ServiceSelector` + `fetchPublicCatalog` (`/book/rider`, `/horse`, `/acquisition`) renders
**24** — and **0 on `/acquisition`**, which is **one of four entries in the marketing site's
primary navigation**.

**`publicCatalog.ts:31` filters `price_amount != null` and `config_kind !== 'inquire'`.** All
three active acquisition offerings are `inquire` with no price — Horse Finder, Horse Evaluation,
Acquisition Assistance. **So the filter is correct for a booking funnel and wrong for a
marketing page**, and the page renders nothing.

**Decide what `/acquisition` should show and make it show that.** Quote-based services are real
services; a page in the primary nav that renders an empty list is worse than one that says
"enquire".

**Also there:** `Footer.tsx:37-38` has **"Ways to Ride" and "Book a Lesson" as adjacent entries
both pointing at `/shop`.** Two labels, one destination, side by side. One-line fix.

## 1.2 — "Documents attached" is wrong for **every horse in production**

`HorseRecordsPage.tsx:104-108` renders "Documents · N attached" from
`staff_horse_records().document_count`, which counts:

```sql
count(*) FROM horse_relationships WHERE horse_id = h.id AND source_document_id IS NOT NULL
```

**That counts relationship rows created by a document — not documents.** The documents queue,
filtered by horse, counts actual `documents` rows. **The two never agree, for any horse.**

**Make the label match what is counted, or count what the label claims.** Prefer the second —
"Documents attached" should mean documents.

## 1.3 — Lessons reads **318** where **39** exist

`listLessonSessions()` selects every `bookings` row with `kind='lesson'` and **does not filter
status**. Production: **279 `available`** (open slots nobody booked) + **39 `scheduled`**.

**Combined with the always-"Scheduled" status chip, a trainer's day reads about 5× busier than
it is.** An open slot is not a lesson.

**⚠️ Coordinate with item 17 (`OPSHOME`)**, which owns `InstructorHome`'s other defects. **This
task owns the QUERY; OPSHOME owns the page.** If both are running, fix the query here and say so.

## 1.4 — A member's document count: **13** on one page, **5** on another

Two different definitions of "your documents". **Establish which is right for the member** —
almost certainly the narrower one, since the wider count likely includes documents they are a
party to but cannot read, or soft-deleted rows.

**Check against the RLS.** `documents_select` and `my_documents()` were repaired by TASK-DOCVIS;
a count that disagrees with what the page can actually display is the bug.

## 1.1 — Inbound work waiting: **5 / 5 / 12**

`LEADCLEAN` closed one of three; **two definitions remain**. `countPendingIntake` counts
`requests` in `new` **or** `contacted` → **12**. `useOpenLeads` counts `new` only plus unresolved
support requests → **5**.

**`useOpenLeads` feeds `DashboardPanel` AND the nav badge**, and LEADCLEAN deliberately aligned
them. **So `useOpenLeads` is the definition that wins** unless the owner says otherwise —
`countPendingIntake` should adopt it or be retired.

---

# HOW TO DO THIS WITHOUT CREATING A SIXTH DEFINITION

**For each of the five, in the report, state in one line: what the number MEANS, and which single
query produces it.** Then make every surface read that one query.

**The failure mode to avoid is obvious and this project has hit it repeatedly:** fixing surface A
to agree with surface B by writing a third query that happens to match today. **One definition,
one reader, everywhere.**

**Where two definitions are both legitimate** — a badge counting something narrower than a page,
deliberately — **say so and label them differently on screen.** Two numbers that mean different
things must not share a word.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-countfix`, branch `task/countfix`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **`TASK-TEXTEDIT` and `TASK-PAGEVIS` are running**; `TASK-RECORDS` may start. **Rebase before
  you finish.**
- **`DashboardPanel.tsx` carries LEADCLEAN's shipped design.** You may change what
  `useOpenLeads` returns **only** if you keep the dashboard and the nav badge in step — they
  were deliberately aligned. **Prove both after the change.**
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.**
- **Delete nothing.** Retire behind a boolean.
- **`test:db` is broken** (60 of 68 files failing) — **do not cite it as proof.** Verify every
  count against production with direct SQL and **paste the query**.
- No staff browser session exists. **`/acquisition` and `/shop` are PUBLIC** — the owner can
  check those two himself, so give him the exact URLs. Report staff renders as **NOT VERIFIED**.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. `/acquisition` renders something truthful — proven by the owner opening the public URL.
2. The footer no longer offers two labels for one destination.
3. A horse's "documents attached" agrees with that horse's row count in the documents queue,
   **for all 4 horses**.
4. The lessons surface separates **39 scheduled** from **279 available**, and does not present a
   slot as a lesson.
5. A member's document count agrees between both surfaces and matches what RLS lets them read.
6. Inbound work states one number, and the dashboard and nav badge still agree.
7. **Each of the five has ONE named query**, listed in the report, read by every surface that
   shows it.

Report to `docs/reports/TASK-COUNTFIX-REPORT.md`.
