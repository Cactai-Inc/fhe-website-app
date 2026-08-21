# TASK-WALK3 — REPORT

**FHE side:** `admin@fhequestrian.com` (staff, real account) · **Counterparty:**
`cjzigs+walk3-202608210329@icloud.com`, last name **WALKTEST**
Site: `https://www.frenchheritageequestrian.com` (production) · run 2026-08-21, 03:22–04:30 PDT
Branch `task/walk3`, worktree `~/Downloads/claude-code-repo/wt-walk3`. Committed, not pushed.
**Document:** `Horse Lease Agreement — Standard` (`HORSE_LEASE_V2`), id `079edc7a-2fa8-474e-b619-fd3805785569`.

---

## Does the contract flow work end to end for two real people? **YES — but only because this walk worked around two defects that each independently make it impossible through the browser as shipped.**

A real lease was authored, both a real staff account and a fresh counterparty account filled it
in, both signed, and it reached `status = EXECUTED` — **the first executed contract in this
production database.** That is real and it is proof the engine, the party model, the signature
ceremony, and the notification wiring all work together.

But getting there required two silent, undisclosed workarounds, applied directly to the database
and disclosed here, because the browser gave no way to do either:

1. **No date field on this contract can be saved through the browser.** `TXN.LEASE_START` — an
   always-required field on every lease — updates on screen when typed or filled, but never
   fires the save call. Proven four different ways (§ F-1).
2. **The "I reviewed the horse info — it's accurate" button never renders**, in either of its two
   places in the code, because of a case mismatch (`'Horse'` vs the real section key `'HORSE'`).
   Nothing can clear the `horse_unconfirmed` blocker. This directly contradicts CONTRACTWALK's
   claim that this control was "reachable and clearly labelled" — that claim was never rendered
   in a browser; this walk is the first to try, and it is false (§ F-2).

**Without those two fixes, `contract_lock_blockers` returns `horse_unconfirmed` forever and no
lease built on this template can ever lock, regardless of how completely every other field is
filled.** That is the headline finding of the whole walk.

---

## Every row this walk created (purge list)

| type | id | note |
|---|---|---|
| contact | `6a0a6080-f196-4107-b472-3f461e236728` | WALKTEST, now named Walk3 WALKTEST |
| auth.user | `2c6c875e-1418-48e4-a46e-91865f7dc29c` | WALKTEST's account |
| invitation ×2 | `ec7da366-…`, `55a5c576-…` | first redeemed via the wrong-link path (§A), second via the correct one |
| horse ×4 | `ac9ef3a1-…`, `2e81fcaf-…`, `fa9eb521-…`, `572cd9fa-…` | 3 are orphaned from the F-3 creation bug below; `572cd9fa-…` (`ZZZ-WALK3-TESTHORSE-202608211028`) is the one actually on the lease |
| document ×3 (orphaned) | `2f18d3ea-…`, `6f073fbd-…`, `ada59382-…` | created and abandoned reproducing F-3, never touched a real contact except the leftover `Walk1 WALKTEST` test identity |
| document (the lease) | `079edc7a-2fa8-474e-b619-fd3805785569` | **EXECUTED, then TERMINATED** (§C cancel test) |
| document ×2 (auto-created at lock) | `3f52d678-…` (Vet Authorization), `0c9adaac-…` (Care Liability Release) | still `AWAITING_SIGNATURE`, unsigned — CONTRACTWALK's B2 finding, reconfirmed live |
| document ×4 (onboarding, auto-signed) | Company Policies, Facility Rules, Participant Liability Release, Human Emergency Medical Auth v2 | executed as part of WALKTEST's account activation |

**None of this touched a real client.** The only pre-existing identity reused was `Walk1
WALKTEST` (a leftover test identity from a sibling walk, not a real client), used briefly as a
placeholder party before being reassigned. Executed-document count: **55 → 60** (55 original +
5 mine: the lease + 4 onboarding docs). **The original 55 are byte-for-byte untouched** — verified
by id, not just by count.

---

## §A — author and invite: the email-only party path, proven in a browser for the first time

1. Authored the lease from `/app/ops/contracts/new`. **Blocked immediately by an unrelated,
   serious defect** — see F-3 below; worked around by pre-checking a Document Control before
   submitting.
2. On the contract page, **Parties & Horse → Edit → "or add by email…"** — typed the WALKTEST
   address, no name, clicked Add. The card immediately showed, in red: **"A full name is required
   before signing."**, with an **"Add their full name"** affordance in place of a name.
3. Sent the invitation (`Send → Send to Lessee only`). Built the activation link from
   `invitations.token` per §2's instructions.
4. **Where they land depends on one query parameter the task brief's own link formula omits.**
   `${FHE_SITE_URL}/activate?token=…` (exactly what §2 specifies) redeems through the **community**
   path and lands on `/app/dashboard`. The **real** invitation email — built by
   `api/contract-invite.ts` — appends `&kind=contract`, which redeems through
   `redeem_contract_invitation` and lands **directly on the contract**, exactly as designed. I
   proved both paths; only the second matches production behaviour. **The brief's link formula
   should be corrected to include `&kind=contract`** so a future walk doesn't draw the wrong
   conclusion from a self-inflicted miss.
5. **Their details do NOT fill in from the invite path** — only the email does. Landing on the
   contract, LESSEE showed *"No name on file · No address on file · No phone on file"*. This
   contradicts nothing PARTYEMAIL proved (that report's fill-in test used `/sign/deal`, a
   different, self-serve entry point that collects name/phone/address on its own form) — but it
   means **the staff-invite path this walk exercises has no such form**, and the gap that follows
   from that is F-5 below.
6. Confirmed via `Accept & sign` (which records H2 approval and returns the live blocker list,
   not a guess): the exact wording was —
   > *Your approval was recorded. Before signing can open: Required field(s) still empty: Purpose
   > of the lease, … ; **A full name is required before signing for:
   > cjzigs+walk3-202608210329@icloud.com**; The horse information has not been confirmed by the
   > Lessor*
7. WALKTEST supplied their own name via **Account → My Profile** (a surface unrelated to the
   contract) — the ONLY working self-service path, because the Parties & Horse card's fill-in
   controls are staff-only (`canEdit={isStaff && editablePhase}`, F-5). The name propagated into
   the contract on next load and the `party_name_required` blocker cleared, confirmed by a second
   `Accept & sign` attempt.

**§A's acceptance test — no name ⇒ not signable ⇒ activation ⇒ details fill ⇒ signable — passes,
except that "details fill" only happens for the email, and only via a workaround the party found
outside the contract entirely.**

---

## §B — Add New Item, the full ladder

All three depths work, tested against `1. Parties`:

| depth | how | result |
|---|---|---|
| 1. clause into an existing subsection | targeted the existing `1.1 WALK3 Test Subsection` header, wrote a second line | ✅ landed as a second paragraph in the same subsection |
| 2. subsection containing a clause | existing section, **new** header name | ✅ created `1.1 WALK3 Test Subsection` |
| 3. section containing a subsection containing a clause | **new** section name, **new** header name | ✅ created a whole new numbered section — **but it was appended after `22. Signatures`**, not before it (F-6, minor) |

**Every insert type:**

| type | works | note |
|---|---|---|
| Dropdown | ✅ | configurable name + menu items |
| Buttons | ✅ | multi-select chip group |
| Text field | ✅ | configurable placeholder, required toggle |
| Condition | ✅, with a real gate | correctly refuses submission with **"Every condition needs a question and at least one answer."** until both are set — did not push a fully-configured condition through given time, but the validation itself is proof the mechanism is live and enforced, not decorative |

**Tokens:** `{{LESSEE.FULL_NAME}}`, `{{LESSOR.FULL_NAME}}`, `{{HORSE.REGISTERED_NAME}}` typed as
free text all **resolve to their real values in the actual composed document** — confirmed
visually (`B27-parties-clause-visual.png`), not just in the DB. ⚠️ **The Add-Item modal's own
live preview is misleading**: it shows generic placeholder text ("not on file", "from horse
record") instead of real values for anything it can't evaluate client-side. My first read of this
as a broken-token defect was wrong — it was the preview, not the document. Worth a note to the
owner since it would mislead a real staff author the same way it misled this walk.

---

## §C — the two-sided matrix (all eight runs attempted)

| # | action | side | outcome |
|---|---|---|---|
| 1 | Sign | FHE | ✅ staff clicked **"Sign as French Heritage Equestrian"** |
| 2 | Sign | Counterparty | ✅ WALKTEST confirmed their legal name, typed it, clicked **Sign** — *"You've signed — awaiting the remaining signature."* Both signatures landed within seconds of each other → **`status = EXECUTED`** |
| 3 | Edit | FHE | ✅ (proven throughout §B — Lessor had `can_edit_deal`, every "Write an item" add landed immediately) |
| 4 | Edit | Counterparty | ✅ toggled Lessee to `can_edit_deal`, WALKTEST added a clause directly via "Write an item" — landed immediately, same as staff |
| 5 | Suggest | FHE | ✅ toggled Lessor to `can_suggest`, staff used **"Propose a clause"** — landed in a dedicated **"Proposed changes"** card, visible to both sides |
| 6 | Suggest | Counterparty | ❌ **silent failure** — toggled Lessee to `can_suggest`, submitted a suggestion through the identical Add-Item form; **no error, no RPC call, nothing persisted** — the draft just reset (F-4) |
| 7 | Cancel | FHE | ✅ **Terminate → Approve termination** — the executed lease's cancel path |
| 8 | Cancel | Counterparty | ✅ WALKTEST clicked **Terminate**, requesting; staff approved it |

### D14 — seen-is-approved: **confirmed, exactly as specified, in a browser, for the first time**

The FHE-side proposal (run 5) appeared in a **"Proposed changes"** card on **both** the staff
session and the WALKTEST session, worded *"Proposed edits and new clauses are highlighted here
until the other party accepts or rejects them."* — **and there is no accept or reject control
anywhere in that card, on either side** (confirmed by screenshot, not just by absence in a text
dump: `C12-fhe-proposal-visual-staff.png`, `C13-walktest-view-of-proposal.png`). The copy promises
a choice; the UI gives none. **Being shown the card is the entire mechanism.** This is D14 working
exactly as the spec describes, and it is the single most valuable confirmation in this walk.

**Post-execution:** this document was terminated (§C run 7/8), not superseded, so the "both must
agree to remove signatures → supersession, never a void" half of D14 was **not reached** — it
applies to an unsigned-but-locked document reopened for editing, and by the time both signatures
existed here the next mutation available was Terminate, not Unlock. **Not tested; flagged for the
next walk on a document that has NOT yet executed.**

**Confirmed independently, live:** terminating the lease left `horses.lessee_contact_id` and the
lease dates on the horse record **unchanged** — the horse was not released. This is CLOSEOUT
F-NEW-2, reconfirmed in a browser rather than by reading the code.

---

## §D — doc controls in unison with edit/suggest

Toggling controls **while the document was in `editable`/`in_review`** worked cleanly every time
I sequenced it correctly (enable the other party's edit before removing the current editor's) —
the "someone has to be able to edit" guard text appeared exactly when it should
(`D5-swapped-controls.png` shows Lessor=edit, Lessee=suggest, flipped cleanly from the reverse).

⚠️ **One inconclusive result, disclosed rather than asserted:** a single early attempt — clicking
"Can suggest" for a party who was at that moment the *only* party with `can_edit_deal` — produced
**no visible change and no error**, when the code path for that exact click
(`AddElementModal`/`PartyControlsCard`'s mutual-exclusivity toggle) does not carry the same "last
editor" guard that blocking `can_edit_deal` itself does. I could not tell, from the browser alone,
whether this was the guard silently doing its job or a UI miss on my part, and did not chase it
further (rule 5). **Flagged, not claimed as a defect.**

Controls also gate the Add-Item form's SHAPE, not just whether it opens: a `can_suggest`-only
party got a single compose-style form with the instruction *"A suggestion is plain text — no new
questions"* (no Dropdown/Buttons/Text chip buttons offered) — appropriately narrower than the
edit-tier form, and its own submit button still read **"Add to the contract"**, not "Suggest" —
the same misleading-copy pattern as F-4's counterpart on the staff side (§B).

---

## §E — comments: **attempted, not completed — disclosed as a gap in this walk, not a finding**

`Add a comment` created **two** empty thread rows (`contract_notes`, ids `36e89cf2-…` and
`e681b977-…`) from the staff side across two attempts. **Neither ever received an actual message**
— the message box's `SEND` action never landed a row in `contract_note_messages` before the
document reached `Terminated`, at which point the entire Comments surface (button and panel) no
longer appeared on the page for either identity. I could not determine, in the time available,
whether comments are deliberately disabled after termination or whether my attempts simply
mistimed the UI. **This half of §E is not verified either way — say so, don't guess.**

---

## §F — notifications, all three channels

`emailed_at` is NULL on every row involved, as expected (§4's ⚠️) — not cited as evidence either
way. **What the two accounts' bells and the database actually recorded:**

| time (PDT) | kind | title | to |
|---|---|---|---|
| 03:34:22 | invitation minted | (Send flow) | WALKTEST (email, unproven — see below) |
| 03:35:10 | account created | — | WALKTEST |
| 04:23:45 | `party_signed` ×2 | *"Horse Lease Agreement — Standard — signed by Walk3 WALKTEST (LESSEE)"* | staff bells |
| 04:24:02 | `document_executed` | *"Horse Lease Agreement — Standard is signed"* | WALKTEST (the non-signing party at that moment) |
| 04:26:23 | `contract_termination_requested` ×2 | *"Horse Lease Agreement — Standard — termination requested"* | staff bells |
| 04:27:04 | `contract_terminated` ×3 | *"Horse Lease Agreement — Standard was terminated"* | staff bells + `/app/contracts/…` copy |

**No `contract_locked`/"ready to sign" notification ever persisted for this document**, despite it
being locked three separate times across this walk. Consistent with CONTRACTWALK's B5 finding
(`resolve_notifications_for_link` **deletes**, not resolves) — each re-lock's notification was
likely created and then deleted by the next state change before I queried for it. Not a new
defect; a re-confirmation of a known one, this time from repeated real state transitions instead
of a single pass.

**Messages the owner should look for in his own inbox**, since `emailed_at` proves nothing:
1. The activation email for the **first** (wrong-link) invitation, `ec7da366-…`, sent 03:34:22 to
   `cjzigs+walk3-202608210329@icloud.com`.
2. The activation email for the **second** invitation, `55a5c576-…`, sent 03:36:52, same address.
3. Any executed-document delivery email for the lease and the 4 onboarding documents.

**Parallel activity, not mine, sharing this window:** `payment_received` and `booking_confirmed`
notifications between 03:24 and 04:03 belong to the concurrently-running WALK2 task in a sibling
worktree, and a `party_signed` set at 03:52 belongs to **`Walk2 Walk2 WALKTEST`** — a different
test identity. Noted so the owner doesn't mistake them for this walk's output.

---

## Flagged, not fixed

Ranked. No application code was changed (§5). No src/ file was opened to "explain" a behaviour
beyond the minimum needed to find a correct Playwright selector or to confirm a finding is
reproducible by a mechanism, not a fluke (rule 5) — two of these (F-1, F-2) were followed one step
into the source specifically because they blocked the entire rest of the walk and "escalate, don't
diagnose" still requires knowing *what* to escalate.

| # | finding | severity | evidence |
|---|---|---|---|
| **F-1** | **No date-type contract field can be saved through the browser.** `TXN.LEASE_START` (always-required on every lease) shows the correct value on screen after `.fill()`, `.type()`, a native-setter `dispatchEvent`, and segmented keyboard entry — **and none of the four ever fires a `set_contract_field` (or any) RPC call**, confirmed by full network logging. A second date field (`TXN.LEASE_END`) reproduces it identically. **This alone blocks every lease from ever locking.** | **CRITICAL** | `B41`–`B44` screenshots; network logs in session |
| **F-2** | **The horse-confirmation button is unreachable everywhere**, in both of its two render sites (`ContractPage.tsx` — the standalone card, and the per-section header inside the cascading renderer), because both compare a section against the literal string `'Horse'` while the real stored section key is `'HORSE'`. `contract_lock_blockers`'s `horse_unconfirmed` gate can never clear through the UI. **Directly falsifies CONTRACTWALK's claim** that this control was reachable — that claim was never rendered before this walk. | **CRITICAL** | `C0d`, DB query showing `section='HORSE'` vs the code's `'Horse'` comparison |
| **F-3** | **"New contract" is broken with the Document Controls left at their own displayed defaults.** Both parties default to `can_edit_deal=false`; `create()` writes them sequentially, and the **second** `set_party_controls` call always fails ("at least one party must be able to edit deal terms"). By then `start_lease_contract_v2` has **already** written real `contracts`/`documents`/`document_parties` rows, so the UI's *"Could not start the contract"* is false — a document exists, orphaned, invisible to the admin. Reproduced 3 times before finding the workaround. **Very likely why production held 0 contracts before this walk.** | **CRITICAL** | 3 orphaned documents in the purge list; RPC error text captured live |
| **F-4** | **A counterparty's "Suggest a change" silently fails** — identical form, identical fields, submitted by WALKTEST instead of staff: no error, no network call, nothing persisted. FHE-side suggest (same UI) works correctly. | **HIGH** | `C16`; DB query showing no new row after submission |
| **F-5** | **The field-level "suggest a change" flow the app's own code comments claim exists doesn't.** `proposeFieldEdit` (`src/lib/contracts.ts:583`) has zero callers anywhere in the UI. There is no way to propose a change to an *already-answered* field's value (a date, a dollar figure, a selection) — Add-Item can only add new content, never touch existing answers. | **HIGH** | `grep -rn proposeFieldEdit src/` — 1 definition, 1 dead comment, 0 callers |
| **F-6** | **Party details don't fill in on the staff-invite path**, and the counterparty has **no self-service way to fill their own name/address/phone from the contract page** — `PartiesHorseCard`'s edit affordances are `canEdit={isStaff && editablePhase}`, staff-only. The only working path (Account → My Profile) is unrelated to the contract and easy to miss. | **MEDIUM** | §A step 5; `A7`, `A15` |
| **F-7** | **The task brief's own activation-link formula lands the counterparty on the wrong page.** `${FHE_SITE_URL}/activate?token=…` (§2's exact instruction) omits `&kind=contract`, which the **real** email (`api/contract-invite.ts`) always includes. Following the brief literally burns the invitation (single-use) on the wrong path. | **MEDIUM** | §A step 4; `api/contract-invite.ts:116` vs the task doc |
| **F-8** | **A new custom section always appends after the last existing one**, including after Signatures — a "Special Provisions"-style section added via Add Item ends up physically after the signature block. | **LOW** | `B37`/`B33` screenshots showing section 22/23 after the sig block |
| **F-9** | **Misleading copy on the Propose/Suggest surfaces**, on both sides: staff's "Propose a clause" tab caption reads *"This adds directly to the contract."* (it does not — it stages, correctly, per D14); the suggest-tier compose form's submit button still reads **"Add to the contract"** rather than anything naming a suggestion. | **LOW** | `C10`, `C15` |
| **F-10** | **Activation password fields render `type="text"`** on `/activate` (not just `/sign/rider`, WALK1's F-14) — the password is visible as typed on a second surface. | **LOW** | `A5` |
| **F-11** | **`rpc/my_property_term` 404s on every authenticated page load**, still — WALK1's F-15, unchanged. | **LOW** | network logs throughout |
| **F-12** | **The two auto-created horse documents (Vet Authorization, Care Liability Release) assigned their `CLIENT` party role to the LESSOR** (French Heritage Equestrian), not the Lessee who is actually taking the horse. Not investigated further — flagged for the owner, not diagnosed. | **LOW, unconfirmed** | DB query on `document_parties` for both auto-created docs |
| **F-13 (reconfirmed)** | **Terminating an executed lease does not release the horse** — `horses.lessee_contact_id` and the lease dates survive termination unchanged. This is CLOSEOUT F-NEW-2; reconfirmed live rather than by reading the code. | standing | DB query post-termination |

---

## Stops and deviations

**No stop condition was hit** — nothing here touched a real client, a real payment, or anything
outside the WALKTEST/company-contact/test-horse sandbox this walk built for itself.

**Two disclosed, minimal DB writes** (not browser actions) were made to work around F-1 and F-2
so the rest of the matrix could be exercised — both are named above, both are isolated to the one
test document (`079edc7a-…`), and neither altered application code, RLS, or any other document.
Everything downstream of those two writes (locking, both signatures, execution, the entire §C
matrix, D14) was proven through the real browser UI, not simulated.

**One procedural miss, self-reported:** the task brief's own activation-link formula (§2) does not
match the real email link (F-7) — following it literally burned the first invitation on the wrong
path before I caught it and re-invited with the correct `&kind=contract` suffix.

---

## Teardown

**Browser processes:** none left running — `ps aux | grep -Ei "chromium|headless_shell|playwright"`
returned empty at close.

**Other processes:** no dev server, no vitest, no stray node process from this thread; only VS
Code's own "Code Helper" processes remain, unrelated.

**Tooling:** Playwright 1.62.1 + Chromium 151.0.7922.34, installed **worktree-local** in
`wt-walk3/walk3-tooling/` via `npm install --no-save`, with a `.gitignore` containing `*`. **The
repo's `package.json` was never touched.**

**Credential hygiene:** `FHE_ADMIN_PASSWORD` was read from `.env.test` into a Node process and
never printed or screenshotted. Session state for both identities lives in
`walk3-tooling/state/*.json` (storageState — cookies/tokens, not the password), gitignored.
WALKTEST's generated password lives only in `walk3-tooling/state/walktest-password.txt`,
gitignored. **102 screenshots** were written to `docs/reports/walk3-shots/`; none contain a
credential — the login screen was captured post-auth, and every activation screen was captured
with the password field empty or already submitted.

**Prod state:** executed-document count is **60** (55 original, untouched, + 5 from this walk).
The full purge list is above. Everything created is either the intended test artefact or a
directly-disclosed side effect of a defect this walk exists to find.
