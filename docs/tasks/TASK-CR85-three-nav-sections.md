# TASK-CR85 — the nav is three sections, and People dissolves into Community

**Authored 2026-08-31 by ORCH6. Builds `CR-85`, which is 🔒 RULED — the shape is decided, not open.**
⚠️ **Small in intent, and in the most contended file in this repo.** Everything that makes it
non-trivial is in §3 and §4.

---

## 1. THE REQUIREMENT, VERBATIM

> *"Community has been the top section. but you are correct to think we should move it down since i
> live in the other layers more. But Community, People, Managment, Admin, is the correct order. The
> calendar needs its own direct link and it is in community, we could move people into community and
> then remove that as a standalone section, now we have community, management, admin."*

> *"catalog and messages belong in community. the only reason i have catalog view and why its in the
> community section is because that is what the community sees. conversely i have a separate surface
> for editing the catalog contents in the admin section."*
> — owner, 2026-08-31

**🔒 THE RULING — three sections, in this order:**

```
1. Community    what the community sees — the feed, Catalog, Messages, + Contacts and Stable
2. Management   the daily working lens — Dashboard · Calendar · Support · Payments · Lessons · Evaluations
3. Admin        configuration and oversight — Moderation · Field options · Content store · Settings' five
```

⚠️ **THE ORDER IS ALREADY CORRECT ON SCREEN. THE ONLY CHANGE IS PEOPLE DISSOLVING.**
⚠️ **The orchestrator argued Catalog and Messages were stray member links and was WRONG.** They are
the lens itself: **the VIEW lives in Community, the EDITOR lives in Admin** *(`Products`,
`pageRegistry.ts:267` — already built and already correctly placed)*. **Do not "tidy" them out.**

✅ **AND THE BLOCKER IS GONE.** `CR-87` rules the Messages page **survives** as an INDEX over threads
that stay on their own surfaces. **Community keeps both rows.** `04-OPEN-QUESTIONS.md` §1 is
superseded — **do not re-open the messaging A/B, and do not let this nav change decide it.**

---

## 2. WHAT I MEASURED — `src/components/app/AppLayout.tsx` on `main`, 2026-08-31, by ORCH6

**The staff rail renders FOUR blocks, and only three of them are real groups:**

| | What renders it | Real group? |
|---|---|---|
| **Community** | `APP_PAGES_GROUP` — a **pseudo-group**, `key: 'app-pages'`, ⚠️ **`items: []`**. Its content is hand-written JSX: `<CommunityNav />` (the feed + its filter children) and `<StaffNavItems />` (`Catalog`, `Messages`) | ⚠️ **NO** |
| **Management** | `manageNavGroups()` → `key: 'management'` | yes |
| **People** | `manageNavGroups()` → `key: 'accounts'` — ⚠️ **exactly two rows**, `ACCOUNTS_GROUP` = `Contacts` (`/app/records`) · `Stable` (`/app/records/horses`) | yes |
| **Admin** | `manageNavGroups()` → ⚠️ **`key: 'community'`, label `Admin`** — the key was deliberately NOT renamed by `TASK-FIX3` | yes |

⚠️ **`Catalog` has NO `pageRegistry` row** — `StaffNavItems` says so itself: *"Catalog is now the only
page left in this shape — same missing-registry-row problem, not asked for, reported."*

---

## 3. ⚠️ THE FOUR TRAPS. THIS IS MOST OF THE SPEC'S VALUE

**T1 · ⚠️ `key: 'community'` IS DATA, AND IT IS THE ADMIN SECTION'S KEY.** It is *"the `group` field
on six"* registry rows, and it keys the open/collapsed state. **Do NOT give the new Community section
that key, and do NOT rename Admin's.** ⚠️ **Promote the existing `app-pages` pseudo-group into a real
group instead** — its key is already `app-pages` and already in use for collapse state.

**T2 · ⚠️ THREE NAV SURFACES RENDER THIS, AND A CHANGE TO ONE IS NOT A CHANGE.** The desktop rail, the
mobile drawer and the avatar menu. **`TASK-AR4` found FIX3's rename was DESKTOP-ONLY: the owner, whose
working device is a phone, would have seen no change at all.** ⚠️ **Prove all three, and remember the
pseudo-group's children are hand-written JSX at each site, not a table the surfaces share.**

**T3 · ⚠️ `AppLayout.tsx` NEVER IMPORTS `pageRegistry.ts`, AND THEY HAVE DRIFTED AT 14 OF 25 ROWS**
(AR3). **Two tables of one fact — the root cause under several nav symptoms.** ⚠️ **Converging them is
its OWN thread and is NOT this task.** **But this task must not deepen it: any row you move into a
real group gets a registry row, and you report the drift count before and after, measured.**

**T4 · ⚠️ PAGE VISIBILITY IS UNWIRED — hiding a page removes no nav row** (AR3, AR4, FIX3 §9), and
`OpsDashboard` still claims otherwise. ⚠️ **A row promoted from hand-written JSX into a real group
becomes subject to the visibility filter that does not work.** **Establish what happens to Catalog and
Messages if someone hides them, and REPORT it. Do not deepen the lie; do not fix it here.**

---

## 4. ⚠️ WHAT "DISSOLVING" MEANS, PRECISELY

- **`ACCOUNTS_GROUP`'s two rows move into Community, keeping their labels, icons and routes** —
  `Contacts` → `/app/records` · `Stable` → `/app/records/horses`. **Nothing is renamed.**
- **The `accounts` group disappears as a section**, heading and all. ⚠️ **`manageNavGroups()` already
  drops an empty group — confirm it, do not leave an empty heading** (FIX3 hit exactly this).
- ⚠️ **The community FEED and its nested filter children stay where they are, first.** They are the
  section's own content, not something to reshuffle.
- **Order inside Community:** the feed, then Catalog and Messages, then Contacts and Stable.
  ⚠️ **If any of that reads wrong on the phone, say so in the report — do not silently re-order.**
- ⚠️ **The MEMBER rail is not this task.** `QUICK` / `ClientNavItems` / `PRESENCE_LINKS` serve members
  and are untouched. **Say explicitly that you checked you did not move a member's rail.**

## 5. OUT OF SCOPE

The `AppLayout` ↔ `pageRegistry` convergence *(its own thread — T3)* · page visibility *(its own
thread — T4)* · the messaging A/B *(🔒 ruled by CR-87 — closed)* · **the Calendar link** *(⚠️ already
its own direct row in Management, `pageRegistry.ts:175` — the owner's *"the calendar needs its own
direct link"* is ALREADY SATISFIED, and it is not a reason to restructure anything)* · the dashboard
*(`TASK-FIX6`)* · any rename of a section other than the ones above.

## 6. CONSTRAINTS

- **Worktree `~/Downloads/claude-code-repo/wt-cr85`, branch `task/cr85`, from `origin/main`.**
  ⚠️ **Copy `.env.db` AND `.env` in.** ⚠️ **NEVER `~/Desktop`.**
- ⚠️ **YOU OWN `AppLayout.tsx` AND `pageRegistry.ts` ALONE. Nothing else may run beside you in them,
  and `TASK-FIX6` is waiting on this.** **Do not touch dashboards, forms, modals or money.**
- ⚠️ **T1 — arbitrary Tailwind values have silently emitted NOTHING here twice.** Any new class with a
  bracketed value must be **grepped out of the BUILT css** (`dist/assets/*.css`) and pasted.
- **Lint baseline 46**, typecheck 0, typecheck:api 0. **`test:db` red is baseline and proves nothing.**
- **COMMIT AS YOU GO. DO NOT PUSH.** **Stage explicit paths; never `git add docs/`.**
- ⚠️ **TEARDOWN: paste a process census** — nothing left running.

## 7. THE REACH

⚠️ **This task IS reach — that is the whole of it.** State, per surface *(rail · drawer · avatar
menu)*: **the sections in rendered order, and every row under each.** ⚠️ **A row that exists in a
table and renders on one surface only is the defect this task is most likely to ship.**

## 8. THE TEST THIS MUST PASS

1. ⚠️ **Three sections, in this order: Community · Management · Admin.** Paste the rendered order
   **from all three nav surfaces**.
2. **No "People" heading anywhere**, and **no empty heading left behind**.
3. **`Contacts` and `Stable` are under Community**, same labels, same icons, same routes — and both
   still open their pages.
4. **`Catalog` and `Messages` are still under Community**, and Messages still carries its unread badge.
5. ⚠️ **Admin's group key is still `community`** and the six registry rows that carry it are unchanged.
   Paste them.
6. ⚠️ **Registry drift, measured before and after** (T3). It may not increase.
7. **The member rail is byte-for-byte unaffected in behaviour** — state how you checked.
8. `typecheck` · `typecheck:api` · **lint ≤ 46** · `npm run build`, plus the built-CSS grep if any
   class changed.
9. ⚠️ **Renders NOT VERIFIED by you** — a numbered checklist the owner runs, **and it must name the
   phone explicitly**, because that is the device the last nav change missed.

## 9. WHERE THE REPORT GOES

`docs/reports/TASK-CR85-REPORT.md`. **Include "flagged, not fixed" — T3 and T4 both belong there.**

---

# ⚠️ CONCURRENCY — added 2026-09-01. FOUR THREADS ARE RUNNING AT ONCE.
**You still own `AppLayout.tsx` and `pageRegistry.ts` ALONE — no other live thread may touch them.**
**Also live:** `TASK-BACKDATE` *(orders/payments)* · `TASK-MODAL2` *(`ops/kit/Modal.tsx`)* ·
`TASK-BOOKS1` *(money functions)*. ⚠️ **`git fetch` before you start; state your merge-base in the
report.**
