# TASK-PAMELA — the account form needs a Save, and the horse-in-contract fields need to be real

**Live, blocking case.** Pamela Godde (`contacts.id f80e944a-0043-4358-9488-fa73c1eff43b`,
`contact_type CONTACT`) is a deal party and horse owner, correctly typed as a client. The owner
is actively building her lease and is blocked by both defects below. Use her real record as the
test case — don't synthesize a fresh one.

Two mostly-independent parts. Fix both; they can land as separate commits.

---

## PART A — the provisioning form has no Save, only Send

### The owner's words

> "the contact page is showing a huge section for provisioning her account as a rider, and there
> is no save button only a send button so i can create the account but my changes dont get saved
> until i send her the invite to activate the account. and im making a contract for her so i want
> to wait until the contract is created, then i will send her the activation email."

### The deeper framing (owner, same conversation, said after the initial report)

> "yea i think the mistake is that every account hinges on activation and it shouldnt."

**This is the actual defect, not just a missing button.** The fix is not "add a Save button
beside Send" as a UI-only patch — it's that account state (category, documents, payment status,
notes) is currently only written as a side effect of the send-invitation act, when an account
should be able to exist and be edited in a real, persisted, workable state with **no** invitation
ever sent. Activation is one later, optional, separate step on top of an account that already
exists — not the thing every other piece of account state is bundled onto. Design from that
premise, not from "where do I insert a save button."

**And a terminology correction, same conversation, right after:**

> "activation is the client facing access for the first time that involves setting the password
> or access token, but truly the activation is when i create an account."

**Two distinct events are likely conflated under one word in the current schema/UI, and this
spec does not assume which columns/flags are involved — find them.** (1) The account becoming
real — staff provisioning it, which per the owner IS the true "activation" moment. (2) The
client's own first-time claim — setting a password or using the access token, which is a later,
separate, client-facing event and should not share the word "activation" if the current code uses
it for both. Audit every place `activate`/`activation`/`activated_at`-shaped state appears
(columns, RPC names, UI copy) and report which of the two events each one actually tracks, before
deciding whether anything needs renaming versus just re-sequencing. Don't rename blind — some of
these may already be correctly scoped and only the UI copy is the confusing part.

### What's actually there (verified, don't re-derive)

`src/pages/app/Admin.tsx` (the client detail view, `ContactsPage.tsx`'s Clients tab) has exactly
two states for an un-provisioned contact: **no invitation yet → render the full
`ProvisionClientForm` in full** (email, account category checkboxes, documents, offerings,
payment status, notes — everything); **an invitation exists → render Send/Resend buttons only.**

`ProvisionClientForm.tsx`'s single submit path is `adminSendInvitation()` — there is no
save-only path. The primary button is literally labeled "Provision & send invitation." Every
field the form collects is thrown away unless staff also send the email in the same act.

**This is why "a huge section for provisioning her as a rider" appears**: it isn't specifically
mislabeling her — it's the *entire* from-scratch provisioning UI (every category checkbox,
every document choice) rendering unconditionally, because nothing about her being an established
client, a deal party, or a horse owner is taken into account before showing it.

### The show/hide rule for the scheduling-heavy content (owner, 2026-08-23)

> "the huge provision form is mostly content that matters for one of two reasons, A) they are a
> rider - these accounts only exist so they can take a lesson and most of the provisioning is
> around lesson scheduling and availability, B) they have an order created for them that involves
> scheduling in some capacity. The provisioning form should match what is required based on what
> category tag the account carries and/or what they have purchased. If they are not a rider, it
> shouldnt be shown to me, if they dont have an order with offering that requires scheduling it
> shouldnt be shown to me. If they are being setup with an order with an offering that requires
> scheduling or they are tagged as a rider, then it can be shown and if i have any of the info from
> them already I can add it in this section."

**This narrows §3 below into an exact, testable rule, not a "use judgment" call.** The
scheduling/availability content shows **only** when: **(A)** the account carries (or is being
given) the RIDER category tag, **or** **(B)** an order attached to this provisioning has at least
one `offering` whose `config_kind` requires scheduling (`scheduled` or `recurring` — read
`CLAUDE.md`'s catalog section, don't guess which kinds those are). **Neither condition true →
the section does not render at all**, not collapsed, not present-but-empty. When it does render,
pre-fill it from whatever the contact record / order already carries — don't ask staff to
re-type what's already known.

**Also worth doing, named explicitly as in-scope, not a maybe:** review this section's field set
against what the two **client-facing** intake flows actually ask for — (1) the invitation a staff
member sends by email, and (2) the self-service flow at `/sign/*` that a visitor reaches from the
website. Find both (the `/sign/*` family is in `App.tsx`'s routes; the staff-sent one is whatever
`adminSendInvitation` leads the client to). **Report where the three field sets — staff
provisioning form, staff-invited intake, self-service `/sign/*` intake — agree and where they
diverge**, and reconcile drift toward one set of questions asked once, not three forms quietly
disagreeing about what a rider needs to answer. Reconciling the exact field-by-field list is real
scope here, not a footnote.

### What to build

1. **The account becomes real when staff create it — that is the activation, per the owner's
   correction above.** Sending the invitation is a later, separate, optional client-facing step
   (the client's own first-time password/token claim), not the event that makes the account
   exist. Staff must be able to persist category/notes/document choices *without* triggering
   `adminSendInvitation`'s email at all. Read `adminSendInvitation` (`src/lib/admin.ts` or
   wherever the API call lives) and what `provisionClient: true` actually does before designing
   this — does it create the account/contact-category rows immediately regardless of whether the
   email sends, or does everything happen atomically in one RPC bundled with the send? The fix
   depends on what's actually true here, not on an assumption, and it may mean the account-
   creation RPC and the send-invitation RPC need to become two calls where there is currently one.
2. **Two real buttons**, not one: **Save** (persists everything, creates/updates the account, no
   email) and **Send invitation** (sends — using whatever was last saved, reachable any time
   after, not bundled to the same click). A contact with saved-but-unsent changes must show that
   state clearly (not silently look identical to "nothing done").
3. **The form should not present itself as "starting from scratch"** for a contact who is already
   correctly typed and has existing context (deal party, horse owner, existing client record).
   Reasonable options: pre-fill and visually de-emphasize what's already established, or collapse
   the category section when it's already unambiguous. Use judgment — the owner's complaint is
   "huge section," not "wrong section."

### THE TEST

- Open Pamela's record, change something in the provisioning form, click Save. Reload the page —
  the change is still there. No email was sent (verify in whatever email/notification log exists).
- Click Send invitation afterward — it sends, using the saved state.
- A contact with no RIDER tag and no scheduling-requiring order attached: the scheduling section
  is absent. Tag them RIDER, or attach a `scheduled`/`recurring`-kind offering: it appears,
  pre-filled from what's already on file.
- The report states plainly where the three field sets (provisioning form, staff-invited intake,
  `/sign/*` self-service intake) agree and diverge.
- `npm run typecheck` / `npm run lint` → 0 errors.

---

## PART B — the horse-in-contract fields: investigate before fixing, then build to spec

### The owner's words (verbatim, this is the spec — do not paraphrase away detail)

> "the contract system is that her horse isnt in here but she gave me her horse's information
> and when i went to add the horse while in the contract, it doesnt open the intake form anymore
> it just shows 8 input fields, and that would be ok if they were properly built but they are just
> empty text only input fields... it needs to be selection menus so i pick recognized options so
> they are then displayed in the contract properly. the only ones that are not able to be
> selection based are the name and the microchip and registration number. also, we dont need to
> record the 'barn name' which ive already told you is very confusing because what you actually
> intended in that field is nickname. but we dont need the nickname on a legal document. and the
> issue with not using the full intake form is that it doesnt have a place for farrier or vet
> information. Also, things like medication, supplements, etc... they should be part of the horse
> record and that information can be shown in the contract but it doesnt need to be since the
> horse record is made available to the lessee, if the lessor is obligating the lessee to manage
> the supplements and medications being given on certain days then that is a reason for them to be
> listed in the contract but they should still be at least accessible as options to select from
> the horse record before resorting to hand writing things in."

### What was already checked, and why this needs live investigation, not a guess

Three places were read before writing this spec, and **none of them matches "8 plain text
fields missing farrier/vet"** — which means the owner is hitting a fourth path this spec hasn't
found, or hitting one of these three in a state/branch not yet identified. Verify against the
live app + live DB before designing anything:

1. **`HorseGate`** (`src/pages/app/ContractPage.tsx:114`) — the "which horse is this contract
   for" picker. Its "+ Add a different horse" link goes to `/app/horse-intake?contract=<id>`,
   i.e. `HorseIntakePage.tsx` → `HorseIntakeForm.tsx`.
2. **`HorseIntakeForm.tsx`** (`src/components/app/HorseIntakeForm.tsx`) — read directly, and it is
   already rich: `SelectOrOther` for breed/color backed by real lookup tables (`horse_breeds`
   etc., "a typed-in breed can't be stored on the record"), a `nickname` field, farrier name/phone
   and vet name/phone/business/address fields, all present.
3. **`contract_field_defs` for `HORSE_LEASE_V2`** (live DB, queried directly) — also already
   correct: `HORSE.BREED`/`HORSE.COLOR`/`HORSE.SEX` are `input_kind='select'` with real options,
   `HORSE.FARRIER_NAME`/`FARRIER_PHONE`/`VET_NAME`/`VET_PHONE`/`VET_BUSINESS`/`VET_ADDRESS` all
   exist as fields, and **there is no `HORSE.*` token for barn name or nickname at all** — the
   contract template already excludes it.

So: the field *definitions* are correct, and the standalone intake form is correct. Something
else — a different render path for the clause/structure-model document type, a stale cached
version, a different template than `HORSE_LEASE_V2`, or a genuinely separate "quick add" surface
this spec didn't find — is what Pamela's session actually showed. **Reproduce it against her real
contact/contract before writing a fix.** Grep for every place a horse gets created or a horse
field gets rendered inside `ContractPage.tsx` and its clause/structure-model rendering path
specifically (search near where the comment says clause-model horse fields render "above" the
legacy flat-grouping block) — there is a real discrepancy here between what the data says and
what was reported, and it needs to be found, not assumed away.

### The record-it-now flow (owner, 2026-08-23 — this is the target shape, build to it)

> "honestly the original process was already very nice, if I click the button to 'record it now'
> on the horse card in the lease contract creation page, it should open the intake form as a
> modal, filling in even just the name should add the new record for that horse and it should be
> associated with the lessor, if the lessor hasnt been added to the deal yet the horse record
> intake form shown in the modal should ask for me to pick the lessor from a dropdown menu and
> when i do and i save the new record it should close the modal and the lessor field in the card
> above the horse card should show the lessor's name."

**"The original process was already very nice" is a strong signal to check history before
building anything new** — `git log`/`git blame` on `HorseGate`, `ContractPage.tsx`'s horse
section, and `HorseIntakeForm.tsx` for a prior modal-based version, before assuming this is
greenfield. If it regressed (a navigation replaced a modal, a wizard got flattened), restoring the
real shape is very likely cheaper and more correct than redesigning from nothing.

**The exact target, whether restored or built fresh:**
1. A "Record it now" action on the horse card, inside the lease-contract-creation page — opens
   `HorseIntakeForm` **as a modal**, not a page navigation. (This is `HorseGate`'s current
   "+ Add a different horse" link, which today navigates away to `/app/horse-intake` — that has
   to become an in-place modal instead, or a modal-capable sibling of it, without duplicating the
   form's logic.)
2. **Saving with only the name filled in creates the horse record immediately.** Every other field
   stays editable/completable afterward — `HorseIntakeForm` already has an autosave-on-blur mode
   for reviewing an existing record (`?horse=<id>`, "your changes save as you go") — reuse that
   pattern rather than inventing a second save discipline.
3. **The new record is associated with the LESSOR**, not left owner-less.
4. **If the lessor hasn't been added to the deal/contract yet**, the modal must also present a
   lessor picker (a dropdown of contacts) right there, so staff can establish the lessor inline
   without leaving the modal to go add a party first.
5. **On save, the modal closes**, and **the lessor field on the card above the horse card updates
   immediately** to show the name just picked in the modal — real state propagation from the
   modal back to the parent contract view, not a value that only appears after a manual reload.

### The rulings to build to, once the actual path is found

1. **Free text: horse name, microchip number, registration number, farrier name/phone, vet
   name/phone/business/address.** Farrier and vet are people/practices with no fixed taxonomy to
   pick from — free text is correct for them, confirmed against the live `HORSE_LEASE_V2` field
   defs, which already have them as `input_kind='text'`. **Everything else horse-identifying is
   selection-based** — pick from recognized/existing values, not hand-typed, so the same value
   displays consistently everywhere the contract merges it in. This already exists correctly for
   breed/color/sex in both places checked above — if the path Pamela hit doesn't have it, converge
   it onto the same lookup mechanism (`horse_breeds` etc.), don't invent a second one.
2. **No nickname/barn-name field on the contract.** Already true for `HORSE_LEASE_V2`'s field
   defs — verify it stays true for whatever path is actually broken, and don't reintroduce it.
   Nickname stays a horse-*record* field (`HorseIntakeForm` keeps asking for it there); it just
   never becomes a `HORSE.*` contract token.
3. **`horses.home_barn` / `current_barn` vs `nickname` — these are three different columns and
   the owner has flagged confusion between them before.** Read how "barn name" is actually
   labeled wherever Pamela saw it (grep for the literal string "Barn name" in whatever component
   is actually rendering her 8 fields) and report exactly which column it write to. If a UI label
   is asking for `home_barn`/`current_barn` under wording that reads like nickname (or vice
   versa), fix the label to match the column it actually writes — don't merge the columns without
   understanding why both exist first (a horse can board somewhere other than its home barn).
4. **Farrier and vet fields must be present** wherever a horse gets added/edited in the contract
   flow. Already true for both paths checked — if Pamela's path lacks them, that's the gap to
   close, reusing the same field set already defined for `HORSE_LEASE_V2` rather than inventing a
   new one.
5. **Medications/supplements live on the horse record** (`horse_medications`, `kind` discriminates
   `MEDICATION` vs whatever supplement value is in use — confirm the actual kind values live, no
   separate supplements table exists). **Not required in every contract** — only when the lessor
   is obligating the lessee to manage specific ones on a schedule. When a contract needs to name
   one, **the picker must offer the horse's own recorded `horse_medications` rows as selectable
   options first**, with hand-typing as the fallback only when nothing recognized fits — same
   discipline as breed/color, applied to a table that doesn't have it yet. This is new UI, not a
   fix to something broken; scope it as an addition to whatever field/clause lets a lessor name a
   medication obligation in the contract text (find that clause/field first — it may not exist yet
   either, in which case name that as a further finding rather than guessing at its shape).

### THE TEST

1. Reproduce Pamela's actual 8-field experience live, and name in the report exactly which
   component/route it was — this is the single most important finding, everything else follows
   from it.
2. Every horse-identifying field except name/microchip/registration/farrier/vet is
   selection-based, sourced from the same recognized-values mechanism `HorseIntakeForm` already
   uses. Farrier and vet fields stay free text.
3. No nickname/barn-name token reaches contract text; the record-level field (whichever column it
   actually is) is labeled correctly for what it writes.
4. Farrier and vet fields are present and save correctly on whatever path Pamela hit.
5. A contract clause that names a medication/supplement obligation offers the horse's own
   `horse_medications` rows as a picker before falling back to free text.
6. **"Record it now" opens a modal**, not a navigation. Saving with only the name filled creates
   the horse record immediately, associated with the lessor. If no lessor is on the deal yet, the
   modal offers a lessor picker inline. On save, the modal closes and the lessor's name appears on
   the card above the horse card without a manual reload.
7. `npm run typecheck` / `npm run lint` → 0 errors.

---

## Constraints

- Worktree `~/Downloads/claude-code-repo/wt-pamela`, branch `task/pamela`.
- Migration discipline: dry-run in `BEGIN; … ROLLBACK;` against prod, apply, verify, commit.
- Check `git log --oneline -15` for live threads touching `ContractPage.tsx`, `Admin.tsx`,
  `ProvisionClientForm.tsx`, or `HorseIntakeForm.tsx` before starting.
- Do not push. Report and stop.

## THE REACH

Where staff click Save vs. Send on a client record; where staff land when adding a horse from
inside a contract, and what that surface actually is once Part B's investigation is done.

## Report

`docs/reports/TASK-PAMELA-REPORT.md`, with flagged-not-fixed for anything genuinely deferred,
named plainly.
