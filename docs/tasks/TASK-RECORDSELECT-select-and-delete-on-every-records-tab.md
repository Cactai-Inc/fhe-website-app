# TASK RECORDSELECT — select rows and archive them, on every Records tab

**Owner, 2026-08-16:** *"the records page still doesnt have a select and delete button action."*

Raised twice. The capability mostly exists but is **buried inside each record's detail modal**, so
the page reads as having no delete at all.

# WHAT WAS MEASURED (main, 2026-08-16 — verify, then build)

**The shared table has no selection support.** `src/components/ops/kit/DataTable.tsx` — used by
almost every Records tab — has **no `selectable`, no `selectedIds`, no `onSelectionChange`, no
checkbox column**. That single fact explains the whole complaint.

**Documents is the one tab that works, because it does not use DataTable.** `DocumentsQueuePage.tsx`
hand-rolls its own `<table>` with row checkboxes, a select-all, and a two-click confirm delete bar
(`:231`, `:390`). **It is the pattern to generalise — and the reason not to hand-roll a second one.**

**Per-tab state today:**

| tab | component | delete today |
|---|---|---|
| All / Leads / Partners / Vendors | `ContactsPage.tsx` (one component, four modes) | `isAdmin`-gated **Archive inside the detail modal** (`:531`) — no row or bulk action |
| Clients | `Admin.tsx` | modal-level only |
| Horses | `HorseRecordsPage.tsx` | `staffArchiveHorse`, two-click confirm, **modal-level only** (`:104`) |
| Documents | `DocumentsQueuePage.tsx` | ✅ **bulk select + delete** — the incumbent pattern |
| Lessons / Files / Deals | `LessonsHubPage` / `FilesRecordsPage` / `DealsPage` | **none at all** |

**Everything is ARCHIVE, not delete, and that is correct** — D11: nothing is purged; records are
hidden from main views but retained, because documents and files attached to them stay visible to
other people. **Keep the word "Archive" in the UI.** The owner says "delete"; the system means
archive, and the existing copy already says so.

# THE BUILD

## S1 — teach `DataTable` selection, once
- Add opt-in selection to `src/components/ops/kit/DataTable.tsx`: a checkbox column, a header
  select-all, and a controlled selected-ids set. **Off by default** so no existing table changes.
- **Model it on `DocumentsQueuePage`'s existing behaviour** (two-click confirm, select-all
  semantics) so the two agree. Where they cannot agree, say why in the report.
- Once `DataTable` supports it, **consider retiring Documents' hand-rolled table onto it** — but
  only if behaviour is preserved exactly. If that is more risk than value, say so and leave it.

## S2 — a row action AND a bulk bar on every Records tab that has an archive path
- **Row-level Archive** on: All, Leads, Partners, Vendors, Clients, Horses. Same two-click confirm
  the modal already uses; same `isAdmin` gate the modal already applies.
- **Bulk bar** when rows are selected: count, Archive, Cancel. One confirm for the batch.
- **The existing modal Archive stays.** This adds reachability; it does not move the capability.

## S3 — the three tabs with nothing
`Lessons`, `Files`, `Deals` have no archive path at all. **Establish per tab whether one is
appropriate** — a lesson booking is REVIEWQ's territory (retire vs delete already ruled), a file is
D15's (a linked file is never removed from the system), a deal is a contract envelope. **Do not
invent a destructive action for these.** Report what each would mean and let the owner rule.

## S4 — say what archiving does
The word "Archive" on its own does not tell staff whether the person disappears from other
people's screens. One line of copy in the confirm: what leaves this view, what is retained.

# TRAPS
- **Archive, never purge (D11).** No hard DELETE on anything carrying documents, purchases,
  bookings, credits, or signatures. REVIEWQ's `delete_calendar_item` already models retire-vs-delete
  — **agree with it, do not contradict it.**
- **D15**: a file linked to a shared item is never removed from the system.
- **Executed documents are evidence** — never archivable in a way that hides them from a
  counterparty who needs them.
- **`isAdmin` gating already exists on the modal action** — match it exactly; do not widen who can
  archive as a side effect of moving the button.
- **Do not build a second bulk-delete implementation.** Documents' is the incumbent.
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- **Never symlink `node_modules` across case-variant paths.**
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes before reporting).
  Note the suite is **not a green baseline** — 46 pre-existing red files; diff against `main`
  rather than expecting zero.

# THE TEST THIS MUST PASS
1. `DataTable` supports selection opt-in; every table that does not opt in renders unchanged —
   prove with the existing UI tests.
2. Each of All / Leads / Partners / Vendors / Clients / Horses has a working row Archive and a bulk
   Archive, both `isAdmin`-gated, both two-click.
3. Archiving from the list produces exactly the same DB effect as archiving from the modal — prove
   both paths land the same row state.
4. A non-admin sees neither control.
5. Nothing is hard-deleted; prove the archived row still exists.
6. Lessons / Files / Deals: reported with a recommendation, nothing destructive built.
7. Render claims **NOT VERIFIED** with a numbered owner checklist.

Report to `docs/reports/TASK-RECORDSELECT-REPORT.md`. Do not push; the orchestrator merges.
