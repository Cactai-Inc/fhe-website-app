# TASK-AR2 — reaching a client record, and booking a weekly rider

⚠️ **READ `docs/method/ADMIN-REVIEW-ANALYSIS-STANDARD.md` FIRST.** ⚠️ **§2's state matrix IS this
task** — the whole defect here is that a surface behaves differently depending on where a person is
in their life. **You are writing a report. You are fixing nothing.**

**Owner, 2026-08-29:** *"fix the issues related to accessing client records and booking by
eliminiating the outdated duplicates, keeping the recent work like the updated booking capability for
the 2x weekly riders, the broken controls preventing access to the full client record after creating
a new account, and the older accounts showing the older records page."*

**And the walkthrough that produced it, 2026-08-27:**
> *"When I setup a new account manually and save it I see a nice full open profile with a bunch of
> pages linked as buttons on the top of the page. when i go back after the first provisioning pass i
> cant see any of that … there is a beautiful functional perfectly designed contact record page that
> is only accessible one time and that is when im first setting up a new client … the clients that
> have a 2x monthly subscription, cannot be setup for it."*

---

## 1. ⚠️ THE ROOT CAUSES ARE ALREADY FOUND. YOUR JOB IS THE PLAN, NOT THE DIAGNOSIS.

**Traced and measured against production 2026-08-27. Re-verify, then go further.**

**GATE 1 — the nine-tab record surface requires a LOGIN, not a person.**
`src/pages/app/Admin.tsx:739` — `if (!selectedId || !selected?.user_id) return;` — so
`admin_client_overview` is never fetched and the Overview / Bookings / Documents / Orders / Payments
/ Activity / Posts / Messages / Login tabs render against nothing.
`admin_client_accounts()` returns three kinds: `account` (has `user_id`), `pending` (**NULL**),
`contact` (**NULL**). ⚠️ **15 of 22 live clients have no login.**

**GATE 2 — the rich provisioning form is gated to BEFORE the invitation is sent.**
`src/pages/app/Admin.tsx:379` — `if ((neverInvited || isDraft) && row.contact_id) { … }`. That block
is `ProvisionClientForm` (category, paperwork, offerings) **plus `AgreedLessonSection`, the
day-and-time picker.** ⚠️ **The moment the invitation is sent the block stops rendering** and the
surface falls through to resend / expire / regenerate — the owner's *"fucked up configuration page."*

⚠️ **THE HOLE BETWEEN THEM IS OCCUPIED.** Invitation sent + never signed in = **neither surface**.
**Measured: 7 have the tabs, 14 have the provisioning form, 1 is stranded with neither.** That is not
an edge case — it is the normal state of every client between "I sent it" and "they signed in."

**AND WHY IT LOOKS LIKE NOBODY NOTICED — they did.** `git log` on gate 2: it was `neverInvited` alone
until **2026-08-23**, when commit `618c673d` *"PAMELA §A: the account exists when it is saved, not
when the email goes out"* **widened it to `neverInvited || isDraft` in response to the owner's own
complaint.** ⚠️ **A thread was shown one broken state and made the form survive one more state
instead of asking why the condition existed.** Gate 1 was written 2026-07-10 when `Admin.tsx` was an
*account* admin page, where `user_id` was the correct key. **Neither was wrong when written.**

## 2. WHY THE 2× WEEKLY CANNOT BE SET UP — the money consequence

**Choosing a recurring offering AND picking the standing days and times exists only inside
`ProvisionClientForm` + `AgreedLessonSection`, which live behind gate 2.** ⚠️ **So the $880 2× weekly
plan can be sold to a brand-new contact and to nobody else.** Adding the offering elsewhere writes an
order line but never places the standing slot — which is exactly why the owner says it *"doesnt show
up the same way."*

⚠️ **The engine is not the defect.** D23's standing-slot model works. **It has one doorway and the
doorway is shut.** This is D17 with an invoice attached.

## 3. THE DUPLICATES — name the incumbent, say which survives

**At least four surfaces render a person.** Establish the full set, then rule on each:
- `src/pages/app/Admin.tsx` — the nine tabs, keyed on `user_id`
- `src/components/app/ContactDossierModal.tsx` — the expanding row
- `src/pages/app/ops/ContactsPage.tsx` — behind `CONTACTS_PAGE_RETIRED`
- `src/components/ops/contacts/ContactForm.tsx` — 4 fields, and `reviewSection.ts` already records
  that `DUPECENSUS` recommended retiring it and it was not attempted
- `src/components/app/ProvisionClientForm.tsx` + `LeadWorkDrawer.tsx` + `AccountInvitePage.tsx`

⚠️ **`ClientRecordActions.tsx` says in its own header that the modal's parts came from the client
page and the page was never switched over.** That is CR-33, and the owner has now hit it twice.

⚠️ **"Older accounts showing the older records page" is his words for a real split — find what
decides which surface an account gets, and report the rule, not the symptom.**

## 4. WHAT THE PLAN MUST PRODUCE

1. ⚠️ **ONE record surface, reachable at EVERY stage of a person's life** — no account, invited,
   signed in, archived. **The state matrix is the acceptance test.**
2. **Provisioning capability available after the invitation as well as before** — assigning an
   offering, picking standing days and times, adding a horse, changing paperwork.
3. **Which duplicates are retired**, and **behind what** — D32: retire behind a flag, never delete.
4. **How a 2× weekly plan gets started, changed, or resumed for an EXISTING client.**
5. ⚠️ **What must NOT be lost** — the owner named it: *"keeping the recent work like the updated
   booking capability for the 2x weekly riders."* **Name every capability that only exists on the
   provisioning path so none is dropped in the consolidation.**

## 5. THE TRAPS

⚠️ **CR-30, CR-75 and CR-74 already rule on the shape of this surface** and they are the owner's
decisions, not proposals: a lead is a submission plus a promote button; **the client record is an
EXPANDING ROW, not a deeper page** (CR-75); modals are for quick work, an expanded card is for a
record's own fields, a page is for what is attached to it (CR-74, settled); **closing saves** and
there is no separate save button.

⚠️ **D30 names the identity/records model as first in line for the ground-up rebuild**, and D31 rules
that tags enable rather than obligate. **Do not propose a new hardcoded category or a fourth flag.**

⚠️ **`TASK-AR3` is decomposing the Records page into Contacts and My Stable.** Your surface lives
inside its outcome. **Coordinate by reporting the dependency; do not design AR3's page for it.**

## 6. OUT OF SCOPE

Building anything · nav sections (AR4) · the Records page split (AR3) · the calendar (AR1).

## 7. REPORT

`docs/reports/TASK-AR2-REPORT.md`, standard §4 shape. Worktree `wt-ar2`, branch `task/ar2`.
**Commit the report only. Do not push.**
