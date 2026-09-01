# TASK-MODAL2 — the close rule, the trigger source, and where the save state sits

**Built 2026-09-01. Branch `task/modal2`, worktree `~/Downloads/claude-code-repo/wt-2`.
Merge-base `57619291` (`origin/main` at start).** ⚠️ **`main` moved three commits while this ran —
`1911a6eb`, `9b3fe0ab`, `98ecec05` — all `docs/` only. Nothing this task touches was changed.**

---

## 1 · THE HEADLINE

**All five deltas are built.** No dialog in the app closes on a backdrop click or on Escape any more;
`variant`, `allowBackdropClose` and `disableBackdropClose` are gone; the save state moved to the
header beside Close and reads `Saved` in `text-green-500`; leaving a field normalises and then saves
at once, ahead of the debounce; and 14 hand-rolled back affordances became the shared `BackControl`.
**Two spec premises were wrong and are corrected below — the adopter count is 53 files / 67 dialogs,
not 37, and §5 contradicts D5 on whether the back sweep is in scope.** One D1 violation the spec did
not know about was found and fixed: `OfferingCatalog`'s catalog modal still closed on click-out.

---

## 2 · THE SPEC READ BACK, BEFORE ANY CODE (§ TASK-ROLE first act)

**What I understood the task to be.** FIX4's convergence stays; five surgical deltas land on top.
(D1) A control — a button or a link — becomes the *only* way out of any dialog, replacing FIX4's
live-DOM field test and both of its escape-hatch props, because whether a person can reopen what they
dismissed is not a question a component can answer. (D2) The drawer and the sheet are eliminated and
`variant` goes with them. (D3) The auto-save indicator moves from the footer bar to the header beside
the close icon, reads `Saved`, and is lighter green. (D4) Blur normalises then saves immediately, with
the debounce kept as mid-typing insurance. (D5) The back-control sweep FIX4 deferred is now in scope
for every surface that takes input.

**What I would NOT change.** The convergence itself. The `localStorage` draft seam. The normalisation
rules. D34 — closing still neither commits nor discards, and no Save button is added.
`ContactDossierModal`'s Orders tab, which `TASK-BACKDATE` owns.

---

## 3 · CRITERION BY CRITERION AGAINST §7

### ⚠️ 1 · NO modal closes on click-out or Escape — asserted WITH a field and WITHOUT

`ops/kit/Modal.tsx` no longer has a backdrop handler to get the decision wrong. The overlay carries
no `onClick` and no `onMouseDown`; `handleKeyDown` handles `Tab` and nothing else.

```
 ✓ ⚠️ D1 — NOTHING BUT A CONTROL CLOSES A MODAL > ⚠️ an INFORMATION modal no longer closes on a backdrop click
 ✓ ⚠️ D1 — NOTHING BUT A CONTROL CLOSES A MODAL > ⚠️ a modal holding an INPUT does not close on a backdrop click
 ✓ ⚠️ D1 — NOTHING BUT A CONTROL CLOSES A MODAL > ⚠️ the same is true of a textarea and of a select
 ✓ ⚠️ D1 — NOTHING BUT A CONTROL CLOSES A MODAL > ⚠️ neither the empty step nor the one holding a field closes
 ✓ ⚠️ D1 — NOTHING BUT A CONTROL CLOSES A MODAL > a drag that STARTS inside the panel and ends on the backdrop does not close
 ✓ ⚠️ D1 — NOTHING BUT A CONTROL CLOSES A MODAL > ⚠️ Escape does not close a dialog holding a field
 ✓ ⚠️ D1 — NOTHING BUT A CONTROL CLOSES A MODAL > ⚠️ Escape does not close a dialog with NO field either
 ✓ ⚠️ D1 — NOTHING BUT A CONTROL CLOSES A MODAL > ⚠️ the Close control still works — the only way out must actually work
 ✓ ⚠️ criterion 1 … > ⚠️ Escape neither writes NOR closes            (ContactDossierModal, by hand)
 ✓ ⚠️ criterion 1 … > ⚠️ a click on the backdrop neither commits NOR closes
```

⚠️ **THE RULE HAD TWO HOLES BESIDE THE COMPONENT, AND BOTH ARE CLOSED.** Removing the handler inside
`Modal` would not have made the claim true:

| Hole | What it was | Fix |
|---|---|---|
| `ContactDossierModal.tsx:282` (pre-change) | its own `document` `keydown` listener calling `onClose()` | listener deleted |
| `AddElementModal.tsx:937` (pre-change) | an Escape listener that dismissed the chip popover *and then fell through to `onClose()`* | now dismisses the popover only, and only mounts while one is open |
| `OfferingCatalog.tsx:140` | ⚠️ **a hand-rolled overlay carrying `onClick={onClose}`** — see §5 | handler removed |

Every other `'Escape'` handler in `src` was checked and left: `ExplainTip` (a popover),
`AppLayout` ×2 and `Header` (nav menus), `DealPage:159` and `Messages:137` (cancel an inline rename /
message edit), `ContractDrawer:242` (cancels a drag-resize). **None of them closes a dialog.**

### ⚠️ 2 · Every dialog has a visible close control — the list

`Modal.tsx` renders the header, and its `X`, **unconditionally**; the only way a call site could hide
one is through `panelClassName`. Audited statically across every opening:

```
FILES: 53   <Modal> OPENINGS: 67   CLOSE CONTROL SUPPRESSED: 0
```

<details><summary>all 67, with the panelClassName each passes</summary>

```
src/components/AvatarCropModal.tsx:93                      X in header  panelClassName=""
src/components/ContinueShoppingModal.tsx:41                X in header  panelClassName=""
src/components/app/AddElementModal.tsx:962                 X in header  panelClassName=""
src/components/app/AddHorseModal.tsx:44                    X in header  panelClassName=""
src/components/app/AppOverviewModal.tsx:201                X in header  panelClassName=""
src/components/app/CaptureInfoModal.tsx:144                X in header  panelClassName=""
src/components/app/ClientRecordActions.tsx:102             X in header  panelClassName=""
src/components/app/ClientRecordActions.tsx:121             X in header  panelClassName=""
src/components/app/ClientRecordActions.tsx:154             X in header  panelClassName=""
src/components/app/ClientRecordActions.tsx:300             X in header  panelClassName=""
src/components/app/ConfirmNameModal.tsx:70                 X in header  panelClassName=""
src/components/app/CreateModal.tsx:396                     X in header  panelClassName="bg-cream"
src/components/app/DocumentsContent.tsx:145                X in header  panelClassName="h-[92dvh]"
src/components/app/EmailChangeModal.tsx:135                X in header  panelClassName="bg-cream"
src/components/app/GiftsContent.tsx:144                    X in header  panelClassName=""
src/components/app/LeadWorkDrawer.tsx:327                  X in header  panelClassName=""
src/components/app/NotifyConfirmModal.tsx:100              X in header  panelClassName=""
src/components/app/OrdersContent.tsx:203                   X in header  panelClassName=""
src/components/app/ReviewChangesModal.tsx:95               X in header  panelClassName=""
src/components/app/StableEditors.tsx:41                    X in header  panelClassName="bg-cream"
src/components/app/StableSection.tsx:171                   X in header  panelClassName=""
src/components/app/VoidContractModal.tsx:75                X in header  panelClassName=""
src/components/app/profile/LoginSecurityCard.tsx:44        X in header  panelClassName=""
src/components/feed/PostModal.tsx:28                       X in header  panelClassName=""
src/components/ops/DocumentIntegrityPanel.tsx:233          X in header  panelClassName=""
src/components/ops/documents/DocumentQueuePicker.tsx:116   X in header  panelClassName="bg-cream"
src/components/ops/editor/DocumentSurface.tsx:188          X in header  panelClassName=""
src/components/ops/editor/DocumentSurface.tsx:594          X in header  panelClassName=""
src/components/ops/editor/SurfaceVersions.tsx:144          X in header  panelClassName=""
src/pages/app/CalendarItemPanel.tsx:526                    X in header  panelClassName="bg-cream"
src/pages/app/CalendarPage.tsx:853                         X in header  panelClassName="bg-cream"
src/pages/app/CalendarPage.tsx:1155                        X in header  panelClassName="bg-cream"
src/pages/app/CalendarPage.tsx:1235                        X in header  panelClassName="bg-cream"
src/pages/app/CalendarSettingsPanel.tsx:113                X in header  panelClassName="bg-cream"
src/pages/app/ContractPage.tsx:2439                        X in header  panelClassName=""
src/pages/app/EvaluationsPage.tsx:121                      X in header  panelClassName=""
src/pages/app/Messages.tsx:72                              X in header  panelClassName=""
src/pages/app/ops/ContactsPage.tsx:464                     X in header  panelClassName=""
src/pages/app/ops/ContactsPage.tsx:637                     X in header  panelClassName=""
src/pages/app/ops/DealPage.tsx:66                          X in header  panelClassName=""
src/pages/app/ops/DealsPage.tsx:146                        X in header  panelClassName=""
src/pages/app/ops/DocumentsQueuePage.tsx:240               X in header  panelClassName=""
src/pages/app/ops/FilesRecordsPage.tsx:205                 X in header  panelClassName=""
src/pages/app/ops/HorseRecordsPage.tsx:383                 X in header  panelClassName=""
src/pages/app/ops/HorsesPage.tsx:108                       X in header  panelClassName=""
src/pages/app/ops/TeamPage.tsx:215                         X in header  panelClassName="bg-cream"
src/pages/app/ops/admin/AdminProductsPage.tsx:130          X in header  panelClassName=""
src/pages/app/ops/admin/AdminProductsPage.tsx:183          X in header  panelClassName=""
src/pages/app/ops/admin/AdminProductsPage.tsx:604          X in header  panelClassName=""
src/pages/app/ops/barnops/AllocationRulesPage.tsx:511      X in header  panelClassName=""
src/pages/app/ops/barnops/ResourcesPage.tsx:500            X in header  panelClassName=""
src/pages/app/ops/boarding/BoardAgreementsPage.tsx:385     X in header  panelClassName=""
src/pages/app/ops/boarding/BoardChargesPage.tsx:347        X in header  panelClassName=""
src/pages/app/ops/boarding/FacilitiesPage.tsx:414          X in header  panelClassName=""
src/pages/app/ops/boarding/FacilitiesPage.tsx:430          X in header  panelClassName=""
src/pages/app/ops/employees/SchedulePage.tsx:154           X in header  panelClassName=""
src/pages/app/ops/employees/SchedulePage.tsx:200           X in header  panelClassName=""
src/pages/app/ops/employees/StaffPage.tsx:116              X in header  panelClassName=""
src/pages/app/ops/lessons/GrantCreditDialog.tsx:130        X in header  panelClassName=""
src/pages/app/ops/lessons/GrantCreditDialog.tsx:177        X in header  panelClassName=""
src/pages/app/ops/lessons/GrantCreditDialog.tsx:233        X in header  panelClassName=""
src/pages/app/ops/lessons/LessonCreditsPage.tsx:317        X in header  panelClassName=""
src/pages/app/ops/lessons/LessonCreditsPage.tsx:366        X in header  panelClassName=""
src/pages/app/ops/lessons/LessonPackagesPage.tsx:304       X in header  panelClassName=""
src/pages/app/ops/lessons/SessionsPage.tsx:419             X in header  panelClassName=""
src/pages/app/ops/records/HorseHealthPage.tsx:482          X in header  panelClassName=""
src/pages/app/ops/records/HorsePartiesPage.tsx:413         X in header  panelClassName=""
```
</details>

**Plus two non-adopters, checked by hand:** `ContactDossierModal` (header `X` at `:406` **and** a
footer `Close` at `:805`) and `OfferingCatalog`'s `CategoryModal` (`X` over the cover, `:161`).
**Total: 69 dialogs, 69 with a reachable control, 0 traps.**

### ⚠️ 3 · `variant` is gone, and all 12 former drawer/sheet sites render the centre modal

`ModalVariant`, `OVERLAY` and `PANEL` are deleted; the panel is one string. Nothing in `src` or `test`
mentions `variant="drawer"`, `variant="sheet"`, `allowBackdropClose` or `disableBackdropClose` except
the comments that record why they went. Pinned by a test that asserts the *shape*, since the prop no
longer exists to assert on:

```
 ✓ ⚠️ D2 — one shape > every size renders the centred box, never a sheet or a drawer
```

**⚠️ HOW THE FOUR CALENDAR PANELS READ, as the spec asked — and I did NOT re-introduce a variant.**
All six drawer declarations passed `size="sm"`. The old drawer resolved to
`w-full h-full` + `sm:max-w-md`; the centre box is `w-full rounded-xl max-h-[90dvh]` + `sm:max-w-md`.
**The width is identical.** What changes is height: the panel is now content-height up to 90dvh
instead of pinned to 100%, and it is centred with a 16px gutter instead of flush to the right edge.

| Was | Now, unchanged size | My read |
|---|---|---|
| `CalendarPage.tsx:853` — item detail, drawer/sm | centre/sm (448px) | a short `<dl>`; **better as a box** — it used to be a mostly-empty full-height column |
| `CalendarPage.tsx:1155` — request this time, drawer/sm | centre/sm | a form of ~4 fields; fine |
| `CalendarPage.tsx:1235` — buy lessons, drawer/sm | centre/sm | an offering list; scrolls inside at 90dvh |
| `CalendarSettingsPanel.tsx:113` — drawer/sm | centre/sm | ⚠️ **the one to look at.** The longest of the four; at 448px wide the settings rows are tight |
| `CalendarItemPanel.tsx:526` — new/edit item, drawer/sm | centre/sm | ⚠️ **the other one to look at.** The most field-dense; `size="md"` or `"lg"` would suit it |
| `TeamPage.tsx:215` — staff record, drawer/sm | centre/sm | a form of ~6 fields; fine |

🔒 **I changed no `size` value.** Two of the six would read better one step wider, and that is a
product judgement, not a build one — **it is in "flagged, not fixed" as one line, for the owner.**
The eight former sheets keep their sizes too; the only visible change there is that on a phone they
are a rounded, gutter-padded box instead of a flush bottom sheet.

### ⚠️ 4 · The D5 inventory, with a verdict per row

**Measured, not taken from AR5's "20+".** Every `ArrowLeft` / `ChevronLeft` in `src`, plus the four
`BackControl` sites FIX4 already built. **The test is D5's own: does the surface take input?**

| # | Site | Input on the surface? | Verdict |
|---|---|---|---|
| 1 | `BookHorse.tsx:252` | yes — booking funnel | ✅ **converted** (`onClick={handleBack}`) |
| 2 | `BookRider.tsx:279` | yes | ✅ **converted** |
| 3 | `BookSupport.tsx:273` | yes | ✅ **converted** |
| 4 | `Questions.tsx:48` (top link) | yes — the question set | ✅ **converted** |
| 5 | `Questions.tsx:60` (`Previous`) | yes | ✅ **converted** |
| 6 | `Checkout.tsx:140` | yes — contact details | ✅ **converted** |
| 7 | `EmailChangeModal.tsx:205` (google step) | yes | ✅ **converted** |
| 8 | `EmailChangeModal.tsx:228` (password step) | yes | ✅ **converted** |
| 9 | `AcquisitionIntakePage.tsx:64` | yes — the intake form | ✅ **converted** |
| 10 | `NewContractPage.tsx:256` | yes — 7 field groups | ✅ **converted** |
| 11 | `AccountInvitePage.tsx:24` | yes — `ProvisionClientForm` | ✅ **converted** |
| 12 | `HorsePage.tsx:108` | yes — `RecordEditor` fields | ✅ **converted** |
| 13 | `DealPage.tsx:143` | yes — rename-in-place input | ✅ **converted** |
| 14 | `EvaluationsPage.tsx:55` | yes — the share-by-email box | ✅ **converted** |
| 15 | `ThreadDetail.tsx:55` | yes — the reply textarea | ✅ **converted** |
| 16 | `TenantDetailPage.tsx:100` | yes — module toggles | ✅ **converted** |
| 17 | `Onboarding.tsx:997` | yes | already `BackControl` (FIX4) |
| 18 | `Onboarding.tsx:998` | yes | already `BackControl` (FIX4) |
| 19 | `CreateModal.tsx:400` | yes | already `BackControl` (FIX4) |
| 20 | `ReviewChangesModal.tsx:100` | yes | already `BackControl` (FIX4) |
| 21 | `OrderDetail.tsx:73` | **no** — a read-only order record | ⛔ left: nothing to lose going back |
| 22 | `MemberProfile.tsx:47` | **no** — read-only profile | ⛔ left |
| 23 | `MemberProfile.tsx:64` | **no** | ⛔ left |
| 24 | `ContentPostDetail.tsx:36` | **no** — an article | ⛔ left |
| 25 | `MyPosts.tsx:26` | **no** — a list | ⛔ left |
| 26 | `Messages.tsx:358` | yes, but | ⛔ left: an **icon-only mobile pane-back** inside a conversation header row. `BackControl` always renders a label, which would not fit. |
| 27 | `DocumentsContent.tsx:182` | n/a | ⛔ left: `Prev` **pagination**, not a back control |
| 28 | `CalendarPage.tsx:359` | n/a | ⛔ left: **month navigation** |
| 29 | `AvailabilityPicker.tsx:177` | n/a | ⛔ left: **week navigation** |
| 30 | `BookingItemSwap.tsx:86` | n/a | ⛔ left: `ArrowLeftRight`, a **swap** icon |

**16 converted · 4 already converged · 10 left, each with its reason.**

⚠️ **AND THE HALF D5 SAYS MATTERS MOST — going back must not lose input. Checked at every converted
site, not assumed:** `handleBack` in the three funnels only calls `setStep`/`setCurrent`; the
selection lives in the funnel context. `EmailChangeModal`'s two calls only `setScreen('enter')` —
the address stays in component state. `Questions`' `navigate(-1)` and the nine `to=` links are plain
navigations. **No converted site calls a reset, a clear, or a discard.**

### 5 · The save state is in the header, reads `Saved`, and is light green — with the built-CSS grep

`Modal.tsx:208-219` puts the indicator and the close button in one `flex items-center gap-2.5`
cluster; the footer bar now renders only for `onClear` / `footer`. `ContactDossierModal.tsx:405`
reaches the same shape by hand and its `savedLabel="Saved to the record"` is gone.

```
 ✓ ⚠️ D3 — `Saved` renders in the HEADER, beside Close, in light green
 ✓ ⚠️ D3 — it clears the moment unsaved input is entered
 ✓ ⚠️ D3 — the indicator is in the header cluster, next to the X   (ContactDossierModal)
```

The first test asserts `saved.parentElement === close.parentElement` — the *same cluster*, not merely
the same document — and that the footer's `Clear form` does **not** contain it.

⚠️ **T1 — THE GREP, OUT OF THE BUILT CSS** (`dist/assets/index-tqkGj9cy.css`, after `npm run build`):

```
$ grep -o '\.text-green-500{[^}]*}' dist/assets/*.css
.text-green-500{--tw-text-opacity: 1;color:rgb(45 112 67 / var(--tw-text-opacity, 1))}

$ grep -o 'gap-2..5{[^}]*}' dist/assets/*.css
gap-2\.5{gap:.625rem}

$ grep -o '90dvh[^}]*}' dist/assets/*.css
90dvh\]{max-height:90dvh}

$ grep -oE '\.(items-center|justify-center|rounded-xl|shrink-0)\{[^}]*\}' dist/assets/*.css
.items-center{align-items:center}
.justify-center{justify-content:center}
.rounded-xl{border-radius:.75rem}
.shrink-0{flex-shrink:0}
```

**Every class the change introduces emits a rule.** `text-green-700` is still compiled — other
surfaces use it; only the indicator moved off it.

### 6 · Clicking out of a field saves immediately, and the indicator turns true

```
 ✓ ⚠️ D4 — leaving a field saves at once > ⚠️ a blur commits WITHOUT the 700ms debounce elapsing
 ✓ ⚠️ D4 — leaving a field saves at once > a blur on something that is NOT a field does not trigger a save
 ✓ criterion 2 … > shows the auto-save indicator, so the person can tell it happened
```

The first advances fake timers by **30ms** — far short of `useAutoSave`'s 700ms — and still sees
`updateContactRecord('c1', { first_name: 'Elishevaa' })`.

⚠️ **NEGATIVE CONTROL, because a passing test proves nothing on its own.** With the one line
`useFlushOnFieldExit(() => { void run(); }, enabled)` commented out of `formState.ts`:

```
 × ⚠️ a blur commits WITHOUT the 700ms debounce elapsing
 × ⚠️ and the blur saves the NORMALISED value, not what was typed
  Tests  2 failed | 11 passed (13)
```

**And the debounce still works** — `⚠️ the record auto-saves after the debounce, without anyone
pressing anything` passes unchanged, which is the "typing without blurring still saves" half.

### 7 · Normalisation runs on blur BEFORE the save, and a deliberate correction survives

```
 ✓ ⚠️ D4 … > ⚠️ and the blur saves the NORMALISED value, not what was typed
 ✓ ⚠️ §4 … > 'fiszer' becomes 'Fiszer' when they leave the box
 ✓ ⚠️ §4 … > ⚠️ an interior capital is never touched            (LaBuzetta)
```

The ordering test asserts `updateContactRecord('c1', { last_name: 'Fiszer' })` — **not** `'fiszer'`.
⚠️ **This is the reason the flush is one macrotask late rather than synchronous**, and the comment in
`formState.ts` says so: `useFieldNormalizer` calls `apply(next)`, a React state update, inside the
field's own `onBlur`. A synchronous flush would store what was *typed*, which is the CR-83 inversion.

### 8 · Closing still writes nothing, and the record still saves — both halves

```
 ✓ ⚠️ criterion 1 … > the footer Close button writes nothing
 ✓ ⚠️ criterion 1 … > the header X writes nothing
 ✓ ⚠️ criterion 1 … > ⚠️ Escape neither writes NOR closes
 ✓ ⚠️ criterion 1 … > ⚠️ a click on the backdrop neither commits NOR closes
 ✓ criterion 2 … > ⚠️ the record auto-saves after the debounce, without anyone pressing anything
 ✓ criterion 2 … > ⚠️ a failed write keeps the record open, the edits in the boxes, and says why
```

**D34 is untouched.** No Save button was added; `Modal` still offers no way to render one, pinned by
`⚠️ there is NO Save button — the component offers no way to render one`.

### 9 · The numbers

| | Baseline (`origin/main`) | This branch |
|---|---|---|
| `npm run typecheck` | 0 | **0** |
| `npm run typecheck:api` | 0 | **0** |
| `npm run lint` | `46 problems (0 errors, 46 warnings)` | **`46 problems (0 errors, 46 warnings)`** |
| `npm run build` | passes | **passes** |
| `vitest run test/ui` | `11 failed \| 173 passed \| 5 skipped (189)` | **`11 failed \| 181 passed \| 5 skipped (197)`** |

⚠️ **The 11 failures are identical at baseline** — same five files, same line numbers
(`dealauto_delivery_recipient_scope` ×5, `pluspass_create_controls` ×3, `wallreturn_onboarding` ×2,
`adminsweep_instructor_preview` ×1, `clause_ownership_affordance` skipped). Measured by checking out
`origin/main`'s `src` and `test` into this worktree and re-running. **+8 passing tests, 0 regressions.**
`test:db` not run — red at baseline and proves nothing (TASK-ROLE §3).

⚠️ **The lint number was 47 after my first commit** — removing `disableBackdropClose={!dismissable}`
left `VoidContractModal`'s `dismissable` unused. Deleted in the second commit; back to 46.

### ⚠️ 10 · Renders NOT VERIFIED by me — the owner's checklist is §8 below

---

## 4 · THE REACH — what a person clicks, with file and line

**This task has no new surface; it changes a rule inside surfaces that already exist.** The reach is
therefore every dialog in the app, and the three deltas a person can *see*:

1. **The close rule** — `src/components/ops/kit/Modal.tsx:187` (the overlay, with no handler) and
   `:210-219` (the header `X`). Reached from all 67 dialogs, plus `ContactDossierModal.tsx:406`
   and `:805`, and `OfferingCatalog.tsx:161`, by hand. **The X is the only way out, and it is on every one.**
2. **The save state** — `src/components/ops/kit/Modal.tsx:209` renders
   `AutoSaveIndicator` beside that X. Visible today on the dialogs that pass `saveStatus`:
   `StableEditors.tsx:41`, `DealsPage.tsx:146`, `CalendarPage.tsx:1155`, `CalendarItemPanel.tsx:526`,
   `TeamPage.tsx:215`, `CreateModal.tsx:396`, `CaptureInfoModal.tsx:144` — and on
   `ContactDossierModal.tsx:405`, which is where the owner will look first.
3. **The field-exit save** — `src/lib/formState.ts:77` (`useFlushOnFieldExit`), reached from
   `useFormDraft` (`:215`) and `useAutoSave` (`:340`). **No call site has to opt in**, which is why
   all 9 surfaces using those hooks get it and none can forget it.
4. **The back control** — 20 sites listed in the D5 table above.

---

## 5 · ⚠️ WHERE THE SPEC WAS WRONG

**1 · "`ops/kit/Modal.tsx` IS NOW RENDERED BY 37 FILES" — it is 53 files and 67 dialogs.**
37 is the count of `<Modal` followed by a space or `>` on the same line. **17 files open the tag with
the props on the next line** (`AppOverviewModal`, `DocumentIntegrityPanel`, `HorsesPage`,
`HorseHealthPage`, `HorsePartiesPage`, `AllocationRulesPage`, `ResourcesPage`, `AdminProductsPage`,
`SessionsPage`, `LessonPackagesPage`, `LessonCreditsPage`, `BoardChargesPage`, `BoardAgreementsPage`,
`FacilitiesPage`, `StaffPage`, `SchedulePage`, `ContactsPage`) and a naive grep misses every one.
⚠️ **The consequence is that criterion 2 was a bigger claim than the spec thought** — 67 dialogs, not
37 — and the audit in §3.2 covers all of them.

**2 · §3 D5 and §5 contradict each other on the back sweep.** D5 says *"THE SWEEP IS NOW IN SCOPE"*
and §7.4 demands the inventory; §5 lists *"the back-control sweep"* under **OUT OF SCOPE**, and its
file allowlist would exclude every page the sweep touches. §3 carries a `⚠️ REWRITTEN 2026-08-31`
banner and §5 does not, so §5 is the stale half. **I built D5.** Saying which I chose, rather than
choosing silently.

**3 · D2's counts are one level off, harmlessly.** *"`variant="drawer"` at 4 call sites"* naming six
locations, and *"`variant="sheet"` at 8"*. Measured: **6 drawer declarations across 4 files, 8 sheet
declarations across 8 files — 14 declarations, 12 files.** The spec's own §7.3 says "12 former
drawer/sheet call sites", which matches the file count. All 14 are removed.

**4 · §2's table says the indicator "reports the truth" and D3 asks for the lighter token "this
system already uses" — but the system had no established light-green *text* token.** `text-green-600`
had two users and `bg-green-500` two; `text-green-500` and `text-green-400` had none. See §6.

---

## 6 · ⚠️ WHAT I DECIDED THAT THE SPEC DID NOT

1. **`text-green-500` (`#2d7043`) for `Saved`, not `green-600`.** The owner said *light* green.
   `green-600` (`#215531`) is barely distinguishable from the `green-700` it replaces — the change
   would not read as a change. `green-400` is lighter still but measures **3.98:1** on white and
   fails WCAG AA at 11.5px. `green-500` is **5.9:1** and passes. It is a declared theme colour
   already in use (`bg-green-500` is the live/online dot — itself an affirmative-state signal), so
   the rule compiles; the grep in §3.5 proves it did.
2. **⚠️ I fixed `OfferingCatalog.tsx`, which the spec's file allowlist does not name.**
   `CategoryModal`'s overlay carried `onClick={onClose}`. It is a modal, a person builds their
   selection inside it, and it was missed by FIX4's convergence, which swept the 26 *in-app* overlays
   and not the public catalog. **Leaving it would have made criterion 1 false** — "NO modal closes on
   click-out" cannot be reported as true while one does. I removed the handler and left its markup
   alone: its full-bleed cover image *is* its header, which `ops/kit/Modal`'s title bar does not
   describe. **Converging that markup is a separate job and I did not start it.**
3. **⚠️ I fixed `AddElementModal`'s Escape listener**, likewise outside the allowlist. It dismissed
   the chip popover and then fell through to `onClose()` — a second, invisible exit. Same reasoning:
   the rule is not true while a hole is open. The popover half is kept, because a popover is not a
   modal.
4. **Nine call-site comments were rewritten.** They said things like *"no field, so click-out still
   closes"* — true yesterday, false now. Each new comment names the rule that replaced the old one
   rather than just deleting the sentence, so the next reader can tell a supersession from a
   regression. Comments only; no behaviour in those files changed.
5. **I kept the test filename `fix4_modal_three_way_rule.test.tsx`** even though the three-way rule is
   gone. The spec asked for *"the change … named in the file"*, not a rename, and keeping the path
   keeps `git blame` continuous across the inversion. Its header now opens with what it asserted
   yesterday and what replaced it.
6. **The two `allowBackdropClose`/`disableBackdropClose` tests were deleted, not inverted.** There is
   nothing left to assert: the props do not exist. The header records that they were deleted and why.
7. **I did not change any `size`.** Two calendar panels would read better one step wider (§3.3); that
   is the owner's call and it is flagged, not fixed.
8. **The worktree is `wt-2`, not `wt-modal2`.** The spec (2026-08-31) predates `TASK/CLNR`'s pool
   ruling (`406a093c`, 2026-09-01), which says to take a pool tree. `wt-1` and `wt-cr85` are both
   busy with unmerged work; `wt-2` did not exist, so I created it as the pool member rather than a
   one-off. `.env` and `.env.db` copied in.

---

## 7 · ⚠️ FLAGGED, NOT FIXED

- `CalendarSettingsPanel` and `CalendarItemPanel` were built full-height and are the two former
  drawers likeliest to read cramped at `size="sm"` (448px); `md`/`lg` is a one-word change per site.
- `BackControl` renders `text-sm text-secondary`; nine converted sites previously used
  `text-sm text-muted` and `EmailChangeModal`'s two used `text-[12px]` — the back links are now
  slightly darker and, in that modal, slightly larger. That is the convergence working.
- `ContactDossierModal` is still 1013 lines and still the one hand-rolled dialog shell in the app.
- The eight former sheets no longer bottom-sheet on a phone; they are centred boxes with a gutter.
- `dealauto_delivery_recipient_scope.test.ts` (5) and `pluspass_create_controls.test.tsx` (3) are red
  on `main` and unrelated to this task.

---

## 8 · ⚠️ THE OWNER'S RENDER CHECKLIST — I VERIFIED NONE OF THESE

**No worktree has a staff login and I did not simulate one. ⚠️ Please run 5, 6 and 9 ON YOUR PHONE**,
since D2 changed how every former sheet and drawer lays out on a small screen.

1. **Open any dialog — say a client record from Clients — and click the dark area beside it.**
   It must **not** close. Then press **Escape**. It must **not** close. The **X** must close it.
2. **Same two gestures on a dialog with nothing to type into** — a gift notice, a document preview,
   the "Deal record" box. ⚠️ **These used to close on click-out and deliberately no longer do.**
   Confirm that feels right rather than stuck; if any one of them should still close on click-out,
   that is a product call and it comes back to me.
3. **Open a client record, type into First name, then click onto another field.**
   ⚠️ **A green ✓ `Saved` must appear immediately, up beside the X** — not after a pause, and not
   down in the footer. **Tell me if that green is too light or too dark.**
4. **Type `fiszer` into Last name and click out.** It must become `Fiszer`, and the `Saved` that
   follows must be for `Fiszer`. Then correct it to `fiszer` on purpose — it must stay `fiszer`.
5. **📱 ON THE PHONE — the Calendar.** Tap a session, then Calendar settings, then + to add an item.
   ⚠️ **All three used to slide in as a full-height panel from the right; they are now centred
   boxes.** Say whether the settings panel and the new-item form feel too narrow — that is exactly
   the thing I flagged and did not change.
6. **📱 ON THE PHONE — Add a horse** (My stable → Add), **Change your email** (Profile → Login &
   security), and **Add New** in the document queue. ⚠️ **These used to rise from the bottom edge as
   sheets; they are now centred boxes with a margin all round.**
7. **Staff → Team → a member.** Edit a field, click out, watch for `Saved` beside the X, then close
   with the X and reopen. **The edit must be there.** Then type something and close *fast* — it must
   still be there.
8. **The booking funnels — Lessons, Horse care, Support.** Go two steps in, fill something, press
   **Back**. ⚠️ **What you entered must still be there**, and the control must look like Onboarding's.
9. **📱 ON THE PHONE — Checkout and A Few Questions.** Both back controls, same check: nothing lost.
10. **The public catalog on the home page.** Open a category, add an offering, then click the dark
    area beside the box. ⚠️ **It must NOT close now** — it used to, and your selection went with it.
11. **Anywhere you can find a dialog I have not named — confirm it has a visible X.** With click-out
    and Escape gone, one without a control is a dead end. I audited all 69 statically; you are the
    check on the ones a screen actually renders.

---

## 9 · TEARDOWN — the process census

```
$ ps -ax -o pid,etime,command | grep -Ei 'vite|node .*(dev|preview)|playwright|chromium|supabase|vitest' | grep -v grep
(no rows)
```

**Nothing was left running.** No dev server, no preview server, no browser, no Playwright.
`npm run build` and `vitest run` are one-shot and exited. **Worktrees:** `wt-2` created and kept
(pool member, per `TASK/CLNR`); `wt-1` and `wt-cr85` untouched — both hold other threads' unmerged
work. **No scratch worktree was created.** Scratch files (`/tmp/close_audit.txt`, `/tmp/fs.bak`,
`/private/tmp/…/scratchpad`) are outside the repo and hold nothing needed.

**Commits on `task/modal2`, not pushed:**

```
757b2a10 TASK-MODAL2 D5: the back-control sweep, and the one modal FIX4's convergence missed
4b8c796f TASK-MODAL2 D1-D4: a control is the only way out, one shape, the save state in the header, and the field exit saves
```

---

## 10 · ⚠️ FOR ORCH — CONCURRENCY

**`TASK-BACKDATE` also edits `ContactDossierModal.tsx`.** I stayed inside the split the spec drew:

- **Touched:** the file header's behaviour note (`:45-70`), the Escape listener (**deleted** — it
  was `:282-289`; `:288-296` now records why), the overlay comment (`:372`), and the header
  cluster's `AutoSaveIndicator` (`savedLabel` removed, `:405`).
- **⚠️ NOT TOUCHED:** the Orders tab, in any form. I did not read into it, tidy it, or reformat it.
  **I have no diff to hand you for it.**
- Nothing in `AppLayout.tsx` or `pageRegistry.ts` (`TASK-CR85`), and no money function
  (`TASK-BOOKS1`). `Checkout.tsx` is touched — **a back link only**, no cart or pricing logic.


---

# ⚠️ VALIDATION — ORCH6, 2026-09-01
**Merged `4c06685d`.** Verified in source: no backdrop handler and no Escape close remain in
`ops/kit/Modal.tsx`; `allowBackdropClose` / `disableBackdropClose` are gone.
⚠️ **Its two spec corrections are accepted and both were ORCH's errors:** the adopter count was
**53 files / 67 dialogs, not 37** *(a same-line grep misses `<Modal` with props on the next line —
the same class of mistake as CR-84's "no adopters", which a barrel re-export hid)*, and **§3 and §5
contradicted each other on the back sweep.** **It built §3, which carried the later banner. Correct
reading of a spec ORCH should not have shipped with two answers in it.**
**For the owner:** information-only dialogs no longer close on click-out. That follows the ruling
exactly and is the change most likely to feel stuck rather than safe — item 2 on its checklist.
