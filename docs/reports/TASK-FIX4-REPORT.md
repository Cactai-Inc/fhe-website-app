# TASK-FIX4 — REPORT: input is never lost, and closing never submits

**Branch `task/fix4`, worktree `wt-fix4`, from `origin/main`. 17 commits, 50 files,
+2697 / −903. Not pushed.**

Builds `CR-83` and `CR-84` (including all three of CR-84's corrections).

---

## 0. THE HEADLINE, IN FOUR LINES

1. ⚠️ **`ContactDossierModal` no longer commits on close.** That is a deliberate
   behaviour change to a fix that shipped three days ago. §1 states what changed,
   why, and what happens to a record edited between the two behaviours.
2. ⚠️ **A second surface was doing the same thing and was not in the task's scope
   list** — `CalendarItemPanel` inserted a calendar row on every exit. §2.
3. **26 hand-rolled input-bearing overlays → 1.** The survivor is the dossier, kept
   deliberately, and it obeys the same rules. §3.
4. ⚠️ **The Chromium probe caught a real defect that no jsdom test could**, and it
   was in code I had just written. §6.

---

## 1. ⚠️ THE DELIBERATE BEHAVIOUR CHANGE — `ContactDossierModal`

**The task told me to flag this rather than rewrite it silently. Flagging it.**

### What it did, and what it does now

`ContactDossierModal.tsx:248`, before:

```
commitRef.current = async () => { if (await commit()) onClose(); };
const requestClose  = () => { void commitRef.current(); };
```

Every exit — the X, Escape, the backdrop — ran `commit()` and then closed. **Clicking
the close control on a contact record SUBMITTED the form.** After:

```
const requestClose = () => { onClose(); };
```

Closing does nothing at all.

### ⚠️ THREE BEHAVIOURS, AND THE THIRD IS NOT A RETURN TO THE FIRST

| | Backdrop / X / Escape | The risk it carried |
|---|---|---|
| **Originally** | **DISCARDED** the edits | data loss — the owner reported it |
| **`TASK-FIX2`** (shipped 2026-08-29) | **COMMITTED** them | an unintended write |
| **`TASK-FIX4`** (this) | ⚠️ **does nothing** | *none — see below* |

**What makes the third safe is that the record now AUTO-SAVES after input.** By the
time anyone closes, the work is already written. Closing is not the mechanism that
saves it, and it is not a submission. This is the distinction the whole task rests
on: **persisting and committing are different acts.**

### What was KEPT from the FIX2 version

The failure handling, exactly as the task asked — *"if the save fails the record
stays open with the edits still in the boxes and the reason on screen."* It now
lives in `ops/kit/Modal`'s `error` prop and in `useAutoSave`, so **every** dialog
inherits it instead of this one owning it. Pinned by a test
(`fix4_close_does_not_commit.test.tsx`).

### ⚠️ WHAT HAPPENS TO A RECORD EDITED BETWEEN THE TWO BEHAVIOURS

**Nothing is stranded, and nothing needs repair.** Under FIX2 the write fired on
close; under FIX4 it fires ~700 ms after the last keystroke. **Both reach the same
RPC (`update_contact_record`) with the same patch**, so anything saved under the old
behaviour is saved, and there is no queue of pending edits to drain.

The one genuine difference is **"typed, then closed within 700 ms"**: under FIX2 the
close awaited the write, under FIX4 the auto-save could still be in flight.
**Closed:** the dossier flushes the pending write on unmount
(`flushRef` / `useEffect(() => () => { void flushRef.current(); }, [])`).

**One cosmetic consequence, and it was a promise the app must no longer make.** The
footer read *"N changes — saved when you close"* over a button labelled *"Save and
close"*. Both are gone. The footer now offers **Close** and **Clear unsaved edits**,
and the header carries the auto-save indicator.

### `requestClose` was NOT rolled out to the other modals

The task forbade it; it was not done. `grep requestClose src/` returns
`ContactDossierModal.tsx` only.

---

## 2. ⚠️ A SECOND SURFACE HAD THE SAME DEFECT, AND IT WAS NOT IN THE TASK

`CalendarItemPanel.tsx`'s `handleClose` called
`saveCalendarItem(buildPayload(true))` on every exit. **Leaving the panel INSERTED a
calendar row.** Same shape as the dossier, same ruling against it — and it was not
on the task's list because CR-84's measurement counted *backdrop-closing* modals,
not *writing-on-close* ones.

It now closes and writes nothing. Its contents are persisted to browser storage
instead, so an accidental close still loses nothing **and** no row appears on
anybody's calendar. `Save draft` is untouched and remains the affirmative act.

`hasContent` — the helper that decided whether a close was worth inserting a row
for — is deleted, and the file says why.

---

## 3. THE GLOBAL SOLUTION — MEASURED BEFORE AND AFTER

> *"implement a global solution rather than updating each modal with the fix directly."*

### ⚠️ FIRST, A CORRECTION TO THE LEDGER'S MEASUREMENT

CR-84 records *"⚠️ of those 18, using the shared `ops/kit/Modal`: **ZERO**"* and the
task repeats it as *"a `disableBackdropClose` flag and **no adopters**."*

**The first claim is right; the second is not.** Seven files already rendered the
shared `Modal` on `origin/main` — four of them import it through the `lib/ops`
barrel (`import { Modal } from '../../lib/ops'`), which a grep for `ops/kit/Modal`
does not find. **My own first measurement made the same mistake and reported 4.**

Zero of the *input-bearing backdrop-closing* dialogs used it. The component itself
was not unadopted.

### THE COUNTS (script: `fixed inset-0` overlays carrying `<input|textarea|select>`)

| | `origin/main` | `task/fix4` |
|---|---|---|
| files rendering the shared `<Modal>` | **7** | **37** |
| ⚠️ hand-rolled overlays carrying a field | **26** | ⚠️ **1** |

**The one survivor is `ContactDossierModal`, and it is deliberate.** It is a
fixed-height, tab-railed record surface — not a box around a form — and the shared
component's three variants do not describe it. ⚠️ **What it shares with every
converged dialog is the RULES, not the markup**, and its own header says so.

*(`AddElementModal` appears in a naive grep because the string `fixed inset-0`
survives in a comment explaining why it renders through a portal. It renders no
overlay of its own.)*

### THE 26, ONE BY ONE

`AvatarCropModal` · `AddElementModal` · `CaptureInfoModal` · `ClientRecordActions`
(×4 overlays) · `ConfirmNameModal` · `ContactDossierModal` *(kept)* · `CreateModal` ·
`DocumentsContent` · `EmailChangeModal` · `OrdersContent` · `ReviewChangesModal` ·
`StableEditors` (×2) · `VoidContractModal` · `LoginSecurityCard` ·
`CalendarItemPanel` · `CalendarPage` (×3) · `CalendarSettingsPanel` · `ContractPage` ·
`EvaluationsPage` · `Messages` · `DealPage` · `DealsPage` · `DocumentsQueuePage` ·
`FilesRecordsPage` · `HorseRecordsPage` · `TeamPage`
— plus `AddHorseModal`, `StableSection`, `GiftsContent`, `NotifyConfirmModal`,
`DocumentQueuePicker`, which had no field and converged anyway for the Close control.

### WHAT THE SHARED COMPONENT NOW ENFORCES

- ⚠️ **Backdrop close is decided from the LIVE DOM, not a prop.** At the moment of
  the click the panel is asked whether it currently holds a field. **No call site
  can get this wrong by forgetting a flag**, and a dialog whose fields appear on
  step 2 is protected on step 2 without anyone saying so. Pinned by a test.
- **A Close button on every modal**, titled or not. It used to render only when a
  `title` was passed, so a titleless dialog had no visible way out.
- **`onClear` → `Clear form`**, `saveStatus` → the indicator, `error` → the reason
  on screen with the dialog held open.
- ⚠️ **No Save button, and the component offers no way to render one.**
- **Three variants — `center` · `sheet` · `drawer`** — because this app genuinely
  has three shapes. Converging did not mean turning the Team panel and the calendar
  drawers into boxes.

### THE TWO DELIBERATE ESCAPE HATCHES, BOTH USED ONCE

- **`allowBackdropClose`** — `Messages`' member picker. Its only field is a search
  box over a list; nothing is being composed, and click-out is the expected gesture.
- **`disableBackdropClose`** — `ConfirmNameModal` and `VoidContractModal`'s later
  pages, which must not be dismissed at all.

### ⚠️ ONE RULE I DECIDED RATHER THAN GUESSED — ESCAPE STILL CLOSES

CR-84's measured population was *"modals closing on backdrop-click **or Escape**"*,
but the ruling names only the backdrop (*"closing the modal accidentally from
clicking outside of it"*), and §10's criterion 3 tests only the backdrop.

**Escape still closes every dialog.** It is a keystroke nobody presses by accident,
it is the a11y contract for `role="dialog"`, and with auto-save behind it nothing is
lost. **Flagging it rather than deciding it silently** — if the owner wants Escape
blocked on input-bearing dialogs it is one line in `ops/kit/Modal`.

---

## 4. NORMALISATION — SHOWN, NEVER SILENT

`src/lib/normalize.ts`. **On blur, then auto-save the normalised value** — that
order, and the code comment says why the other order is wrong.

### ⚠️ THE PART THAT NEEDED A MECHANISM, NOT A FUNCTION

Criterion 8 — *"a person's correction is NOT re-normalised; `La buzetta` survives"* —
**cannot be satisfied by any pure function**, because `normalizeName('La buzetta')`
*is* `La Buzetta`. Two guards do it:

1. **Only what was typed this session is a candidate.** A record loaded holding
   `La buzetta` is never touched, because normalisation only ever runs on a blur.
2. **`normalizeOnBlur` remembers what it last produced for that field.** If
   normalising the current value would land back on our own previous answer, they
   revised it on purpose — return it untouched.

### WHAT NORMALISES, AND WHERE

**Everywhere a name, phone or email is typed — staff surfaces included**
(*"yes staff-entered inputs normalize too"*): `SignStart` (the anonymous front
door), `Onboarding` (first/last/minor names + phone), `ConfirmNameModal`,
`ContactDossierModal` (kind derived from the field name, so a new row in
`FIELD_GROUPS` is normalised without anyone wiring it), `TeamPage`,
`CaptureInfoModal`, `StableEditors`, `EmailChangeModal`.

⚠️ **One field is deliberately NOT normalised: the type-to-sign box.** We do not get
to help someone past their own signature (§5).

### JUDGEMENT CALLS, STATED

- **Phone: anything not recognisably US is returned EXACTLY as typed.** A mangled
  phone number is not recoverable from what is on screen, unlike a capital letter.
- **A hyphen is not a word break.** `mary-jane` → `Mary-jane`. Guessing `Mary-Jane`
  is the same over-reach as guessing `LaBuzetta`.
- ⚠️ **`van der Berg` → `Van Der Berg`, and that is the rule working, not a bug.**
  It is the trade the owner already accepted for `labuzetta`. Guard 2 means that
  once they put `der` back, the field never touches it again. Tested both ways.
- **`city`, `address_line1` and `notes` are refused.** `po box 12` is not improved
  by `Po Box 12`. Widening this is a product decision.

### ⚠️ THE BACKFILL FOUND NOTHING TO FIX — AND THAT IS THE RESULT

`supabase/migrations/20260831T1400_a_typed_name_is_capitalised_once_on_the_contact_record.sql`.
Dry-run in `BEGIN … ROLLBACK`, applied, verified.

```
CREATE FUNCTION
COMMENT
UPDATE 0        ← contacts.first_name / last_name
UPDATE 0        ← contacts.email
```

**All 33 contacts and 13 profiles already carry properly capitalised names and
lowercase emails.** The four uncapitalised names in this database exist **only** in
`signatures.typed_name`:

```
   typed_name    | count | first_signed
-----------------+-------+--------------
 Brian olenik    |     1 | 2026-07-26
 Elisheva fiszer |     3 | 2026-07-14
```

⚠️ **Still there after the migration, unchanged, as required.** They are sealed
evidence (`block_signed_signature_update`), and CR-84 §2 is explicit: *"leave
documents alone, just correct the client records."*

⚠️ **The SQL function is deliberately NOT a trigger, and the migration says so in
capitals.** A `BEFORE UPDATE` trigger running it would overwrite a person's
deliberate correction on the very next write, forever — the exact thing CR-83 rules
out. It is a one-time historical pass, and it is applied anyway because this is a
multi-tenant schema and "there was nothing to fix" should be a recorded fact.

---

## 5. SIGNING — TWO GATES, TWO JOBS

- ⚠️ **BROWSER: back to EXACT**, reversing `TASK-FIX1` §4.4 in `Onboarding.tsx`.
- **SERVER (`record_signature`): unchanged, still case-insensitive.** No migration
  touches it. It must keep accepting the four executed variants, and it does — §9's
  psql output is the proof they are still there and still legitimate.

⚠️ **FIX1's complaint was real, and widening the rule was the wrong answer to it.**
It relaxed the gate because an exact match *"refused them by DISABLING the button,
with nothing on screen to say why — a dead end with no error to read."* That is a
complaint about the **error state**. It is now answered by saying the mismatch out
loud, under the box:

> That doesn't match **Elisheva Fiszer** exactly — capitals count. If the printed
> name is wrong, **go back and correct it** before you sign.

…and *"go back and correct it"* is a live control that returns to the details step.
**That is why §5 and §7 had to ship together**, exactly as CR-83 said.

---

## 6. LOSSLESS — THE STORAGE SEAM, AND THE DEFECT THE PROBE CAUGHT

### THE SEAM, AND THE TRADE-OFF NAMED

**Chosen: `localStorage`, namespaced per signed-in user.** (`src/lib/formDraft.ts`
carries the full reasoning.)

**The alternative — a server-side `form_drafts` table — was rejected, and the first
reason is decisive:**

1. ⚠️ **The form where losing input hurts most has no user to key on.** `/sign/*`
   is anonymous: a stranger typing their name, phone and address has no
   `auth.uid()` until after they submit. **A server-side store cannot hold their
   work at all** — and that is the exact case CR-83 named.
2. A draft is written on a debounce after every input. Server-side that is a
   network round-trip per pause, and it fails offline — when a draft is worth most.
3. New table, new RLS, new expiry job, for state that is per-device by definition.

**⚠️ THE COST, STATED PLAINLY: on a shared machine the bytes stay on disk after the
person leaves.** Four mitigations, all implemented:

- **namespaced by user id**, so a second person signing in never *sees* the first
  person's draft;
- **`clearOwnerDrafts()` on sign-out**, so the common case leaves nothing;
- **a 7-day TTL**, swept on read and on write;
- **secrets are never written** — `omit`, plus no draft at all on the password
  dialog, and `confirmEmail` deliberately excluded on `/sign/*` (restoring a typo
  *and* its confirmation would let the check pass on a wrong address).

**One design note worth keeping:** the namespace is published by `AuthProvider` into
a module registry, not threaded through 20 dialogs as a context. `useFormDraft`
**waits for the session to resolve** before restoring — reading the `anon` namespace
during the loading window and arming against it is how a signed-in person's draft
would be looked for once, in the wrong place, and never again.

### ⚠️ THE DEFECT THE CHROMIUM PROBE CAUGHT, IN MY OWN NEW CODE

The task insisted: *"Prove it in Chromium, not by reading code."* It was right, and
here is what that bought.

`probe-lossless.mjs` failed on **browser-back**: `last came back as "La buzetta"`
instead of `"Olenik"`. **A client-side route change unmounts `useFormDraft` with no
page lifecycle event** — the document never goes away, so `pagehide` never fires and
the pending debounce timer is simply cleared. Everything typed since the last tick
was lost, **on the gesture people use most**.

⚠️ **A jsdom test could not have found it**: jsdom has no page lifecycle to miss.
Fixed by flushing on unmount. The comment in `formState.ts` names the probe.

### THE PROBE RESULT — 23/23 IN CHROMIUM

```
── §4 · normalisation happens on blur, and is visible ──
PASS  "fiszer" is untouched while focused
PASS  "fiszer" → "Fiszer" — a leading lowercase letter is capitalised
PASS  "labuzetta" → "Labuzetta" — better than nothing on a run-together surname
PASS  "LaBuzetta" → "LaBuzetta" — ⚠️ an interior capital is NEVER touched
PASS  "la buzetta" → "La Buzetta" — per WORD, not per field
── §4 · a deliberate correction survives ──
PASS  we produced "La Buzetta"
PASS  ⚠️ "La buzetta" survives the blur — the field does not fight the correction
PASS  phone 8585550123 → (858) 555-0123
PASS  email is trimmed and lowercased
── §3 · auto-save, and the indicator that makes it visible ──
PASS  a draft key appears in storage after input
PASS  ⚠️ the auto-save indicator is on screen
── §6 · a reload is lossless ──
PASS  reload · first / last / phone / email all came back           (4 assertions)
PASS  ⚠️ a reload INSIDE the debounce window still keeps the keystrokes
── §6 · browser-back is lossless ──
PASS  browser-back · first came back as "Brian"
PASS  browser-back · last came back as "Olenik"
── §1 · Clear form is the one control that discards ──
PASS  Clear form empties the boxes
PASS  ⚠️ and the draft is gone — a cleared form stays cleared across a reload
ALL PASS
```

`test/browser/lossless.{html,tsx}` uses **`HashRouter`, deliberately**: the other
harnesses use `MemoryRouter`, which has no browser history, so `goBack()` would
leave the page and criterion 6 would prove nothing.

---

## 7. THE BACK CONTROL

`src/components/app/BackControl.tsx` — **one component**, top-left, CR-53's
placement. `TASK-AR5` found 20+ hand-rolled instances and no shared component.

**`Onboarding.tsx`: eight steps, two Back controls, and none reaching the name field
from `sign`.** Now every step carries one, driven by **the same visible-step list
`Steps` renders**, so a step skipped for this person is skipped going backwards too
— a rider with no horse never lands on the horse step by pressing Back. On the first
step it points at the dashboard rather than disappearing: a control that is
sometimes absent is one people stop looking for.

Also adopted by `CreateModal` (replacing a bare chevron) and `ReviewChangesModal`.

⚠️ **NOT rolled out to the other ~18 hand-rolled back affordances.** The rule is *"a
FLOW, not every page"*, and auditing which of the 20+ are flows is `TASK-AR5`'s
inventory, not this task's. **The component exists; the sweep is unstarted.**

---

## 8. §10 — THE TEST, CRITERION BY CRITERION

| # | Criterion | Result |
|---|---|---|
| 1 | **Closing does NOT commit** | ✅ 4 assertions — footer Close, header X, Escape, backdrop. §8.1 |
| 2 | **The affirmative action DOES commit** | ✅ auto-save fires with the exact patch; Continue / Create deal / Save horse unchanged |
| 3 | **Backdrop: blocked with a field, closes without** | ✅ 7 assertions incl. the step-2 case and the drag-out case |
| 4 | **Auto-save fires; the indicator shows it** | ✅ jsdom + Chromium |
| 5 | **Reload restores — IN CHROMIUM** | ✅ 5 assertions, incl. reload inside the debounce |
| 6 | **Browser-back likewise** | ✅ 2 assertions — **and this is the one that found a real defect** |
| 7 | **The four name cases** | ✅ unit + Chromium |
| 8 | **A correction is not re-normalised** | ✅ unit + Chromium |
| 9 | **Browser gate exact; server still accepts `"brian olenik"`** | ✅ §5, §9 |
| 10 | **Back on every onboarding step, reaching the name from `sign`** | ✅ §7 |
| 11 | **The modals are converged** | ✅ 26 → 1. §3 |
| 12 | `typecheck` · `typecheck:api` · lint ≤46 · `build` | ✅ 0 / 0 / **46** / exit 0 |
| 13 | **Renders NOT verified by me** | → §11 |

### 8.1 · Criterion 1, as the task asked it — before and after

The task asked for the record pasted before and after. **The stronger proof is that
no write leaves the app at all**, which is what
`test/ui/fix4_close_does_not_commit.test.tsx` asserts by spying on
`updateContactRecord` — the dossier's single RPC seam:

```
✓ the footer Close button writes nothing        onClose ×1, updateContactRecord ×0
✓ the header X writes nothing                   onClose ×1, updateContactRecord ×0
✓ Escape writes nothing                         onClose ×1, updateContactRecord ×0
✓ ⚠️ a click on the backdrop neither commits NOR closes
✓ ⚠️ the record auto-saves after the debounce   updateContactRecord('c1', {first_name:'Elishevaa'})
✓ shows the auto-save indicator
✓ ⚠️ a failed write keeps the record open, the edits in the boxes, and says why
✓ 'fiszer' becomes 'Fiszer' when they leave the box
✓ ⚠️ an interior capital is never touched                                  9 passed
```

⚠️ **Both halves are asserted deliberately.** A test that only checked "close does
not write" would pass on a modal that lost everything — which is the behaviour FIX2
was fixing.

### 8.2 · Criterion 12 — the numbers

```
typecheck        0 errors
typecheck:api    0 errors
lint             46 problems (0 errors, 46 warnings)   ← baseline exactly
npm run build    exit 0, 10 routes prerendered, sitemap written
```

**T1 — CSS values grepped out of the BUILT css** (`dist/assets/index-C0yL2QP6.css`):

```
max-h-\[90dvh\] PRESENT   sm\:max-w-2xl PRESENT   sm\:rounded-2xl PRESENT
max-h-\[92dvh\] PRESENT   sm\:max-w-3xl PRESENT   sm\:items-center PRESENT
h-\[92dvh\]     PRESENT   sm\:max-w-5xl PRESENT   sm\:max-w-md/lg PRESENT

font-size:11.5px ×1   font-size:12.5px ×1   max-height:90dvh ×1   max-height:92dvh ×2
max-width: 28/32/42/48/64rem  ×2 each
```

### 8.3 · Test suites — the baseline, measured, not assumed

Measured on `origin/main` in a scratch worktree and on `task/fix4`:

| | `origin/main` | `task/fix4` |
|---|---|---|
| `test/ui` + `src/lib` | **12 failed** / 315 passed | **12 failed** / 317 passed |

⚠️ **Same twelve files, same twelve tests — zero new failures.** They are
`dealauto_delivery_recipient_scope` (×5), `pluspass_create_controls` (×3),
`wallreturn_onboarding` (×2), `adminsweep_instructor_preview` (×1),
`questionSets` (×1), plus `clause_ownership_affordance` failing to collect. **None
is mine and none is fixed by me.**

**One existing test WAS changed, and it was a rule change, not a repair.**
`additem_add_element_modal > "a click that starts AND ends on the backdrop closes
it"` asserted the behaviour CR-84 §5 supersedes. It is inverted, with the reason in
the file, and a companion test added that the Close control still closes it.

`test:db` was not run: the task records it as red-at-baseline and proving nothing,
and this task adds one migration whose only effect is `UPDATE 0`.

---

## 9. WHAT THE DATABASE SAYS NOW

```sql
-- contacts and profiles: nothing left for the name rule to change
 scope                          | rows | name_lc | email_mixed
--------------------------------+------+---------+-------------
 contacts (all, incl. archived) |   33 |       0 |           0
 profiles                       |   13 |       0 |           0

-- the four executed signatures: UNTOUCHED, as required
   typed_name    | count | first_signed
-----------------+-------+--------------
 Brian olenik    |     1 | 2026-07-26
 Elisheva fiszer |     3 | 2026-07-14

-- the rule itself, live
 fiszer | labuzetta | labuzetta_interior | two_words
--------+-----------+--------------------+------------
 Fiszer | Labuzetta | LaBuzetta          | La Buzetta
```

⚠️ **The live lease `7adcd08f-fd5d-40f9-b726-634074266d7c` was not touched.** No
migration in this task writes to `documents`, `signatures` or any contract table.

---

## 10. ⚠️ FLAGGED — THINGS THE OWNER OR THE NEXT THREAD SHOULD DECIDE

1. **Escape still closes input-bearing dialogs** (§3). Deliberate, defensible, and
   one line to change if he disagrees.
2. **`van der Berg` → `Van Der Berg`** (§4). The rule working as specified; the
   correction guard makes it survivable. Worth showing him one real example.
3. **The back-control sweep is unstarted** (§7). One component exists; ~18
   hand-rolled affordances remain, and deciding which are *flows* is AR5's
   inventory.
4. **`OfferingCatalog` was NOT converged.** It is a marketing overlay with a
   full-bleed cover image and **no field** — it already closes on click-out
   correctly and has a Close control. Converging it would have cost its design for
   no behaviour change.
5. **`TeamPage`'s `run()` closes the panel on every action**, so its "Saved." note
   has never been visible. Pre-existing, flagged by `TASK-DASHBOARDBUILD`, and still
   true. Out of scope here; the drawer now carries an auto-save indicator that
   *is* visible.
6. ⚠️ **`origin/main` moved during this task** — `62ae47d2` → `e3080131`, five
   commits, **docs only** (`CHANGE-ORDER-LEDGER.md`, `ORCH6-BRIEF.md`). No code
   collision. The branch is based on `62ae47d2` and rebases cleanly.
7. **`TASK-FIX3` had already merged** before this ran, as the constraint required.
   Nothing owned `AppLayout.tsx` or `pageRegistry.ts`, and this task touched neither.

---

## 11. ⚠️ RENDERS NOT VERIFIED BY ME — THE OWNER'S CHECKLIST

I proved behaviour (jsdom, Chromium, psql). **I did not look at 33 dialogs.** Every
one changed shape, and the three variants are my reading of what this app already
looked like. Please check, in this order:

1. **A contact record** (Records → any person). Type into a field, wait a second —
   *does the header say "Saved to the record"?* Now **click outside the box: it must
   not close.** Then click **Close** — reopen and confirm your edit is there.
2. ⚠️ **The same record, the footer.** It should read **Close** and **Clear unsaved
   edits**. If you see *"Save and close"* anywhere, that is the old build.
3. **Add a horse** (My Stable → Add a horse; and Records → Horses → Add). It is a
   bottom sheet on a phone and a centred box on a laptop. **Click outside — it must
   not close.** Check the *Clear form* link in the footer.
4. **The four calendar panels** (a session, Request this time, Buy lessons, Calendar
   settings, and the staff item editor). They must still **slide in from the right,
   full height** — not become centred boxes.
5. ⚠️ **The staff calendar item editor specifically.** Open it, type a note, and
   **close it. Nothing should appear on the calendar.** That is the behaviour change
   in §2 — previously this created a draft row.
6. **The Team panel** (Team → a person). Right-hand drawer. Type a first name in
   lowercase and click away: **does it capitalise, visibly?**
7. **`/sign/rider` on your phone.** Fill in half, switch apps, come back. Then
   reload. Both must keep what you typed, and the line under the button should say
   *"Saved on this device."*
8. **Onboarding, every step.** A **Back** control top-left on all eight. From
   **Review & sign**, press Back until you reach **Your details** — that path did
   not exist before.
9. ⚠️ **The signing box.** Type your name with a lowercase surname. The Sign button
   stays off **and a gold line appears** telling you capitals count, with a link
   back. Confirm the link works.
10. **A gift, an evaluation report, a file preview, the deal record.** These have no
    fields, so **clicking outside SHOULD close them.** Confirm they still do.
11. **New message** (Messages → +). Clicking outside should close it — the one
    deliberate exception among dialogs with a search box.
12. **The document reader** (Account → Documents → Read). Full-width, paged, with a
    PDF button in the footer.
13. **Change password** and **Change email** (Account → Login & security). Both are
    now framed dialogs; the email one keeps its green header band.

---

## 12. TEARDOWN — PROCESS CENSUS

**Stopped:** the `vite` harness server on :5199, the Chromium instances the probe
launched, and the scratch `origin/main` worktree used to measure the baselines in
§3 and §8.3.

```
$ ps -eo pid,etime,pcpu,comm,args \
    | grep -iE 'vite|vitest|esbuild|playwright|chromium|psql' | grep -v grep
(0 lines — nothing left running)
```

`git worktree list` — `wt-fix4` remains (this task's); the scratch baseline
worktree is gone, and **no worktree belonging to another thread was touched.**

⚠️ **`playwright` was installed with `--no-save`**, per `test/browser/README.md`, so
`package.json` and `package-lock.json` are unchanged by it — confirmed with
`git status`.

**COMMITTED, NOT PUSHED.** 17 commits on `task/fix4`.
