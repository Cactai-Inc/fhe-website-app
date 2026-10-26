# Follow-up: app-wide form-modal width

**Raised by:** Part 2 (feat/part-2), 2026-10-25. **Owner-ruled:** resize this
feature's own modals now; hand the app-wide change to the thread that owns
`src/components/ops/kit/Modal.tsx`, so no two threads write the shared primitive at
once (D35/D40 — a shared object has one writer at a time).

## What Part 2 did (shipped on feat/part-2)
- Resized **only** the modals this feature owns/introduces:
  - the new horse-record modal (`HorseRecordPanel`, narrow path) — `size="full"`,
  - the add-horse modal (`AddHorseModal`) — `size="lg"` → `size="full"`,
  - the intake form's own grid on the page (`HorseIntakeForm` `Section` →
    `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, full-width wrappers widened to
    `lg:col-span-3`), and the record identity card's grid.
- Did **not** touch `Modal.tsx`'s shared contract, nor the other ~35 call sites.

## What is left for the ops/kit owner
Item 3 of the Part 2 spec asks that **every form modal in the app** size to the
window with the standard side gutter instead of a fixed narrow width, and that
form grids inside them use 3 columns on wide (4 where fields are short), 2 on
medium, 1 on narrow.

Today `Modal.tsx`'s `SIZE` map is fixed-width:
```
sm: sm:max-w-md   md: sm:max-w-lg   lg: sm:max-w-2xl   xl: sm:max-w-3xl   full: sm:max-w-5xl
```
The widest, `full`, is `max-w-5xl` (~64rem) — it does not fill a large window and
has no larger option. A true "size to the window with the standard gutter" needs
either a new size value (e.g. `window`: `sm:max-w-[min(100%,theme(screens.2xl))]`
or a `max-w-none` + outer gutter) or a change to what `full` means, plus a sweep of
the form-modal call sites to adopt it and to apply the responsive grid inside.

### The call sites (form modals — `<Modal>` with inputs)
~40 files render `<Modal>`; the form-bearing ones to review for width + grid are,
non-exhaustively:
`AddHorseModal` (done), `HorseRecordPanel` (done), `StableEditors`, `StableSection`,
`ClientRecordActions`, `CaptureInfoModal`, `ContactDossierModal`, `ReviewChangesModal`,
`CreateModal`, `AddElementModal`, `TaskModal`, `EmailChangeModal`, `PostModal`,
`profile/LoginSecurityCard`, `ops/documents/DocumentQueuePicker`,
`ops/editor/DocumentSurface`, `ops/editor/SurfaceVersions`,
`ops/DocumentIntegrityPanel`, `pages/app/ops/HorseRecordsPage`,
`pages/app/ops/HorsesPage`, `pages/app/ops/DealsPage`,
`pages/app/ops/records/HorseHealthPage`, `pages/app/CalendarSettingsPanel`,
`pages/app/Messages`, `pages/app/EvaluationsPage`, `CalendarDayView`,
`BookingDraftsPanel`, `NotifyConfirmModal`, `VoidContractModal`, `ConfirmNameModal`.

Some of these are confirmations, not forms (`NotifyConfirmModal`,
`VoidContractModal`, `ConfirmNameModal`) and should stay narrow — the sweep is for
**form** modals, not every modal. Report which stay narrow and why, as item 3 asks.

### Constraint
`Modal.tsx` is a shared single-writer object. Assign it to one thread; do not let
Part 2 and that thread both edit it.
