# TASK PAGEMERGE — one page per concept, with a version toggle where the owner must choose

**Owner, 2026-08-15, verbatim:**

> *"regarding the duplicate pages in the app, lets merge them. keep the ones that were in use,
> add the missing features, when there are competing layours for the same page, use a toggle at
> the top of the page for version a and version b and version c where there is a 3rd version to
> show. put back all the pages in the nav where they belong now with this merge and tabbed
> version approach."*

**The nav half is DONE** — the orchestrator restored every moved row and deleted the Review nav
group on 2026-08-15 (commit ab45b18). **This task is the merge half.**

**Read first:** `docs/reports/TASK-DUPECENSUS-REPORT.md` (21 duplicate groups, ranked) and
`src/lib/reviewSection.ts` — the latter is a live, structured manifest naming, per group, every
implementation, which one is the **incumbent**, and what each one uniquely does. It is your
input. **It goes stale fast — re-derive every claim against current code before acting.**

---

# WHAT CHANGED UNDER THE CENSUS (verify — several groups are already resolved)

**TASK-RECORDS + the 2026-08-15 consolidation already merged much of this.** Confirmed on main
today: Records is one page whose tabs now include Leads / Clients / Partners / Vendors / Horses
**plus Lessons, Documents, Files and Deals**; the standalone Horses pages were retired; Records
moved into Management above Horses; an Archive function was added.

Still routed in `App.tsx` as of 2026-08-15 and therefore still candidates:
`HorsesPage`, `HorseRecordsPage`, `RecordsHubPage`, `RecordsPage`, `DashboardHome`,
`InstructorHome`, `IntakePage`. (`OpsDashboard` and `ContactDirectory` are no longer routed
directly — establish whether they are composed inside something else or genuinely dead.)

**Start by producing a current census**: for each concept, which implementations still exist,
which is live, and which the owner has already ruled on. **Report that before merging anything**
— if it shows a group is already resolved, say so and skip it. Do not "merge" what one thread
already merged.

# THE RULES (owner's, applied per group)

1. **Keep the one that was in use.** `reviewSection.ts` marks it `incumbent: true`. That page
   survives; the others are folded into it.
2. **Add the missing features.** The value in a retired implementation is the thing it did
   better — `reviewSection.ts` names these explicitly (e.g. Horses B "is the only one that
   resolves breed/colour lookups to names"; ContactForm "the 2026-07-01 original: 4 fields,
   FormField primitives, real inline validation"). **Harvest those into the survivor BEFORE
   retiring the loser, or the capability is lost** — this is the mistake that created the
   duplicates in the first place (LESSONS.md: "nothing unviewed is deleted, it is surfaced
   first"; the replacements were "shoddy at best" while the original had what was wanted).
3. **Competing LAYOUTS get a toggle, not a deletion.** Where two or three genuinely different
   presentations of the same page exist and the owner has not chosen, ship **one page with a
   Version A / B / C toggle at the top**. One component, one route, one nav row; the toggle
   swaps the presentation. **This is a decision-deferral device, not an architecture** — it
   exists so the owner can compare in place and rule. Record in the report which groups got a
   toggle and what question each toggle is asking.
4. **Nothing is deleted.** Retire behind a boolean (`CONTACTS_PAGE_RETIRED` is the pattern),
   keep routes resolving so bookmarks and in-app links still land. D11 stands.
5. **One nav row per concept.** The nav is restored and correct as of ab45b18 — **do not
   re-add rows for retired implementations**, and do not move rows without an owner instruction.

# TRAPS
- **`reviewSection.ts` is the manifest, and it will outlive its accuracy.** It still describes
  Review-era state (e.g. slots pointing at `/app/ops/review/*` mounts). Re-verify each entry.
- **The `/app/ops/review/*` routes still exist** — they were deliberately kept when the nav
  group went, precisely so this task can compare implementations. Decide, per group, whether
  each review route retires with its loser.
- **Do not touch** `ContractPage.tsx`, `ClauseDocument.tsx`, `AddElementModal.tsx`,
  `PartyControlsCard.tsx` (concurrent contract thread) or booking-queue surfaces
  (`TASK-REVIEWQ`). Report needed diffs; the orchestrator applies them.
- **`AppLayout.tsx` is contended and just changed** — rebase, and prefer reporting a nav diff
  over editing it.
- **T1** — any arbitrary Tailwind value must be grepped out of the **built** CSS; two have
  silently emitted nothing here before.
- Retirement constants that already exist (`CONTACTS_PAGE_RETIRED`, `INTAKE_PAGE_RETIRED`) are
  `true` — check before assuming a page is live.

# THE TEST THIS MUST PASS
1. A current census, produced first: per concept, what exists now, what is live, what is
   already resolved.
2. For every group merged: the survivor is the incumbent, and each retired implementation's
   unique capability is either **harvested (say where, with line numbers)** or **explicitly
   reported as dropped with the reason**.
3. Toggled groups: one route, one nav row, a working A/B/C switch, and the question each is
   asking stated in the report.
4. Nothing deleted; retired things sit behind a boolean with their routes still resolving.
5. Nav unchanged from ab45b18 except where an owner instruction says otherwise.
6. Typecheck, lint, build clean on the merged result; every render claim NOT VERIFIED with a
   numbered owner checklist.

Report to `docs/reports/TASK-PAGEMERGE-REPORT.md`. Do not push; the orchestrator merges.
