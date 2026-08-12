# TASK HORSEONE — one Horses page, at the URL that was there first

**Owner, 2026-08-11.** Resolves ADMINSWEEP's X-2 and X-4.

> *"so we remove #1… and what might be the right approach is to migrate 2 -> 1, its a cleaner
> url and it sounds like it was the original build page intended for that purpose, a claude code
> thread decided to ignore it rather than modify it and built its own and now we have the
> duplicate page issue for this like the other issues weve experienced and spent all this time
> chasing down the wiring issues which were likely a direct result of the new page being made
> instead of the original one being improved."*

**The owner's history is confirmed by the record:**

```
2026-07-01  HorsesPage.tsx        /app/ops/horses         "ops CRM core"            <- THE ORIGINAL
2026-07-01  RecordsHubPage.tsx    /app/ops/records        "5 module surfaces + hubs"
2026-07-10  HorseRecordsPage.tsx  /app/ops/horse-records  "H.7 + H.8 … staff records"  <- nine days later
```

A thread implementing spec H.8 built a **second page at a second URL** instead of improving the
one that already existed. `/app/ops/horses` then decayed to zero references and became X-2.

---

# THE SHAPE: THE BETTER CODE KEEPS THE BETTER URL

**This is a route consolidation, not a rewrite. Do not port features by hand.**

| | keep | retire |
|---|---|---|
| **URL** | **`/app/ops/horses`** (#1's — shorter, original, says what it is) | `/app/ops/horse-records` |
| **Component** | **`HorseRecordsPage.tsx`** (#2's — 13KB, RPC-backed) | `HorsesPage.tsx` (#1's — 4KB generic CRUD) |

The good URL and the good implementation come from different pages. **Take one from each.**
`HorseRecordsPage` describes itself as *"The single source of truth for every horse — identity,
parties, lease state, and the documents that created them"*, and it carries owner/lessee
assignment that writes relationship history. `HorsesPage` is a generic create/edit roster that
predates all of it.

## Verified, so you do not have to re-derive it

`staff_horse_records()` — what #2 reads — is:

```sql
WHERE h.org_id = current_org() AND h.deleted_at IS NULL AND has_staff_access()
```

- **Org-scoped, and that is correct.** The owner's *"show everything in the system"* means
  everything in **this tenant's** system. It must not become cross-tenant. Today FHE has
  **4 horses, 4 live**, and this returns all of them for a staff session.
- **This is a `WHERE`, not an `IF`** — a NULL `current_org()` filters rows OUT (returns 0), it
  does not admit them. **This is NOT the NULL-guard defect class.** Do not "fix" it with
  `coalesce`; that would change a safe failure into a different one.

**Prove the roster count from an authenticated staff context, not from psql** — a direct
connection has NULL auth and legitimately returns 0.

---

# WHAT TO BUILD

## 1. Move `HorseRecordsPage` to `/app/ops/horses`

Same component, same behaviour, new route. **Nothing about the page's function changes in this
task.**

## 2. `/app/ops/horse-records` REDIRECTS — it does not 404

It is in the nav today and is linked from reports, task docs and possibly the owner's
bookmarks. A redirect to `/app/ops/horses` costs one route entry. **A 404 on a URL that worked
this morning is not an acceptable outcome of a tidy-up.**

## 3. Retire `HorsesPage.tsx` behind a boolean

**Delete nothing.** `ContactsPage` is the established pattern. It has zero references already,
so nothing regresses — this only makes the state deliberate instead of accidental.

## 4. `/app/ops/records` — keep the LANES, drop the redundant roster

`RecordsHubPage` renders `select * from horses` as a list, then links per row into two lanes
that are the module's real content:

```
Ownership → /app/ops/records/horses/:id/parties   (horse_relationships ledger)
Health    → /app/ops/records/horses/:id/health    (health log + care team)
```

**The roster is the duplicate. The lanes are not.** Reach both lanes from the consolidated
Horses page's rows, and retire the hub's own list behind a boolean.

**⚠️ THE LANES STAY GATED ON `mod.horserecords`.** `mod.horserecords` is **enabled** for FHE, so
this is invisible today — but the horse roster itself must **not** move behind that gate.
Ownership history and health records are the paid module; managing horses is not. **A tenant
without the module keeps a working Horses page and simply has no Ownership/Health links.**

**Do not resolve this by putting the roster behind `ModuleGate`.** That is an entitlement
change disguised as a nav cleanup, and it is explicitly refused.

## 5. The nav — you own `AppLayout.tsx` for this task

`AppLayout.tsx` is free (NAVMOTION merged at `a8b0bbe`). **You own it. Three changes:**

- **`:488`** — `Horses` points at `/app/ops/horses`.
- **`:535`** — the `Records` entry in `MODULES_GROUP`. Its contents are now reachable from
  Horses, so it goes.

  **⚠️ AMENDED 2026-08-11 — do NOT assume `MODULES_GROUP` becomes empty.** An earlier version of
  this section said it would, because boarding / barnops / employees are `enabled = false`
  today. **The owner is enabling ALL modules for FHE** (see `TASK-PAGEVIS`), which turns on
  **11 more pages** and fills that group. **Handle both cases:** the group must render its
  entries when a tenant has them, and must not render a bare heading when it has none. **Do not
  hardcode either outcome, and do not delete `MODULES_GROUP`.**
- **Apply ADMINSWEEP Phase 2's held nav diff** — it is written out in
  `docs/reports/TASK-ADMINSWEEP-PHASE2.md` §3 and was deliberately not applied because
  NAVMOTION owned this file. **You are the one thread touching the nav; take both changes so
  there is one diff, not two.** If that diff no longer applies cleanly against current `main`,
  **report that and apply only what is sound.**

## 6. Prove nothing was lost

`HorsesPage` had create/edit, breed and colour lookups, and owner selection from contacts.
`HorseRecordsPage` has intake, descriptive editing, and owner/lessee assignment.

**Diff the capabilities and state the result.** If #1 could do something #2 cannot, **say so and
stop** — do not silently drop a capability, and do not build it in this task without saying so
first.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-horseone`, branch `task/horseone`, off `origin/main`
  (`a8b0bbe` or later). **Never `~/Desktop`.** Do not push.
- **`DashboardPanel.tsx` and `ops/IntakePage.tsx` belong to `TASK-LEADCLEAN`** and
  **`src/components/ops/kit/DataTable.tsx` to `TASK-FRAMESCROLL`** — both running. Do not edit
  either.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.**
- **Delete nothing.**
- **Do not change what any page displays.** This is where a route lives and which component
  serves it. Fixing the page's contents is a different task.
- No staff browser session exists and you will not be given one. Prove the roster query and the
  route table; report the render as **NOT VERIFIED** with a numbered checklist.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. `/app/ops/horses` serves `HorseRecordsPage` and lists all **4** horses for a staff session.
2. `/app/ops/horse-records` **redirects** there — it does not 404.
3. `HorsesPage.tsx` is retired behind a boolean, not deleted.
4. Ownership and Health are reachable per horse from the consolidated page, **still gated on
   `mod.horserecords`**, and the roster itself is **not** gated.
5. The nav shows one Horses entry and no orphan `Records` entry. `MODULES_GROUP` renders its
   entries when the tenant has them and renders no bare heading when it has none — **both cases
   handled, neither hardcoded.**
6. ADMINSWEEP's held nav diff is applied, or its non-application is explained.
7. No capability that existed on either page is gone.

Report to `docs/reports/TASK-HORSEONE-REPORT.md`.

---

# ⚠️ HELD 2026-08-11 — DO NOT RUN THIS YET

**Owner, 2026-08-11:**

> *"we need to find all duplicates in the code, wire them up and make them visible for A/B,
> A/B/C, or A/B/C/D review by placing them side-by-side in the temporary 'Review' section."*

**This task consolidates the three horse surfaces down to one. That would delete the A/B/C
before the owner has looked at it** — on the very case that motivated the review, and the one
where he most expects to find that *"the UI is nice in the original and the hack ass replacement
is shoddy."*

**Sequence:** `TASK-DUPECENSUS` → `TASK-REVIEWNAV` → **the owner rules** → this task executes
the ruling.

**What survives regardless of the ruling**, because it is about URLs and wiring rather than
which component wins:

- `/app/ops/horse-records` must **redirect**, never 404.
- Nothing is deleted; the loser retires behind a boolean.
- The Ownership/Health lanes stay gated on `mod.horserecords`; **the roster does not.**
- ADMINSWEEP's held nav diff still needs applying.

**What is now provisional:** §"THE SHAPE" names `HorseRecordsPage` as the component to keep and
`/app/ops/horses` as the URL. **That was the orchestrator's recommendation and the owner's
initial read — it is no longer settled.** Re-read the owner's ruling from the review before
implementing, and if he picks differently, the URL decision and the component decision are still
separable.
