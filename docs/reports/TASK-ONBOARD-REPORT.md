# TASK ONBOARD — report

**Branch:** `task/onboard` (worktree `wt-onboard`), **not pushed** — the orchestrator merges.
**Prod:** `lrstswfxfsezdmvkvukc`. Nine migrations dry-run inside `BEGIN … ROLLBACK`, then applied, then verified by query. Every DB claim below is query output.
**Health:** `typecheck` 0, `typecheck:api` 0, `build` clean, `lint` 1 error / 39 warnings — the one error is pre-existing (`test/db/creditfix_mint_from_unit_count.test.ts:261`, an unused `client` binding from the merged CREDITFIX branch) and is not in a file this task touched.

**Nothing in the browser was verified.** There is an owner checklist at the end.

---

## The headline: §4's bug, found and fixed

The owner reported Claire receiving each signed document as a **separate email**. `api/deliver-documents.ts` batches correctly and was never at fault. The culprit is the database.

`documents_send_executed_email_trg` is an `AFTER UPDATE OF status` trigger that fires **once per document**, and `send_executed_document_email` posts to `/api/deliver-documents` with a **single-element array**:

```
jsonb_build_object('documentIds', jsonb_build_array(p_document_id::text))
```

So an N-document signing run produced N emails, plus N company mirrors. Measured in prod:

| person | executed docs | distinct send stamps | delivery rows |
|---|---|---|---|
| Claire Bourdon | 6 | **6** | **12** |
| Rachel Engelhorn | 4 | **4** | **8** |
| Charles Zigmund | 2 | **2** | **4** |

Rachel's four stamps are 15:19:51 / 15:20:25 / 15:22:22 / 15:22:49 on 2026-08-14 — four separate sittings of the same three-minute run.

**And the fix was already there, losing a race.** Both signing flows already POST the *full* id list when the last document is signed (`Onboarding.tsx:558`, `DocsParticipantFlow.tsx:212`). By the time that call lands, the trigger has already written a `document_deliveries` row for every (document, recipient) pair, so the batched call skips every recipient, returns an empty `delivered` array — and the onboarding "done" screen then honestly reported *"We couldn't email your copies"* while the member's inbox held six of them.

**The participant flow had a second sender on top of that.** `/api/sign-release` also delivered each document in-process via `deliverExecutedDocument()`. Four calls, four documents, four sends — independent of the trigger.

### The call sites that were wrong

1. `send_executed_document_email` (DB) — one POST per document. **Now: holds, then flushes the set as one POST.**
2. `api/sign-release.ts:98` — `deliverExecutedDocument(db, result.document_id)` per signature. **Now: skipped when the caller declares a multi-document run.**
3. `src/pages/app/Onboarding.tsx:558` — a second sender racing the DB. **Now: reads delivery state instead of sending.**

### How it holds

The two live flows have **opposite shapes**, which is why a single heuristic could not work — and why my first attempt failed its own test:

- **Documents generated up front, signed one by one** (`Onboarding.tsx` → `generate_my_onboarding_documents`). Mary Richardson's 6 DRAFT rows share one `generated_at`. Signal: the signer still has another non-executed document.
- **Documents created *at* signing time** (`DocsParticipantFlow` → `sign_release`). Rachel's 4 rows each have `generated_at = signed_at`. There is nothing to look at, so **the flow declares the run**: `/api/sign-release` opens a delivery hold before the first signature.

`document_delivery_is_held()` reads both signals. `deliver_executed_document_set()` posts the whole held set as one request. `/api/deliver-documents` calls `mark_document_set_delivered()` to close the hold. `flush_held_executed_document_emails()` (wired into the existing hourly `/api/delivery-sweep`) covers an abandoned run after 30 minutes, because somebody who signs three of four documents and walks away is still owed copies of the three.

**A single document is not delayed.** Proved.

### Proof (rolled back against prod)

```
CASE A — Onboarding shape (Mary Richardson, 6 DRAFT):
  after 5 of 6 signed:   EXECUTED 5, held 5, emailed 0
  after the last:        ids_in_the_one_post = 6

CASE B — participant shape (declared run, 4 docs created at signing):
  held during the run: 4 of 4     emailed during the run: 0
  mark_document_set_delivered stamped 4 rows; open holds after: 0

CASE C — a lone document:  held = false, went out immediately = true

history untouched: pre_existing_unsent_executed_docs_disturbed = 0
```

That last line matters: prod holds **51** executed documents with a NULL send stamp from before this machinery existed. The flush only ever considers documents *this mechanism itself held*, so none of them is swept into a surprise mail-out.

**Live after apply:** `held_now = 0`, `still_unsent_from_before = 51`.

> **A caveat I cannot remove from a chair.** Cases A–C prove the *set selection and the hold*. They cannot prove the email itself, because proving that means sending real PDFs to real people — the probes ran with `APP_BASE_URL` deleted so no outbound send was possible. **Test #4's "one send row, N attachments" needs one real signing run.** It is item 1 on the owner checklist.

---

## §1 — `/sign` is a chooser

`/sign` did not exist. Only `/sign/:path` did, and **nothing on the site linked to it** — the whole funnel was unreachable. `src/pages/SignChoose.tsx` is the page, five options, each described by what the person is about to *do*. Deep links still skip it.

## §1b — `deal` claims a contract and activates the account in one flow

Corrected mid-task per the owner: `deal` **is** the fifth option, it just is not a document-signing funnel. The contract exists and the person is already a party; what they lack is the account without which the document is unreachable.

**One outcome, two initiation points** — the pattern the rest of this task follows:

```
staff:      ContractPage "Send for review" -> inviteCounterparty -> /api/contract-invite
self-claim: /sign/deal -> /api/sign-start (deal branch) -> find_claimable_contract
                                    \                    /
                                     invite_contract_counterparty
                                     -> /activate?token=…&kind=contract
                                     -> redeem_contract_invitation
                                     -> promote_contact_to_account   (D5)
```

No second claim mechanism, no second account-creation path. The only blocker was `invite_contract_counterparty`'s guard (`has_staff_access() AND org matches`), which had no service-role arm; it now spells the pair the way every other spine function in this schema does.

**Enumeration.** `find_claimable_contract` returns **at most one party and never a reason** — "no such contract", "already has an account" and "already signed" are indistinguishable, because it answers an unauthenticated stranger. The endpoint returns the identical response either way, rate-limited exactly as the other paths are, and the screen's wording is *"If a contract is waiting on that address, we've just emailed you the link"* — which never confirms one exists. The **attempt row records the truth** (`email_ok` is what actually happened, not what the visitor was told), so staff handling the resulting support alert see *"matched nothing"* rather than *"bounced"*.

**Asked and answered: yes, staff can trigger `/api/contract-invite` from a real screen** — `ContractPage.tsx:925` → `sendForReview` → `inviteCounterparty`. It is not another built-but-unreachable endpoint.

**No backfill, per your correction.** The accountless document parties are test records and Sarah Morgan's cancelled contract was the only real one; this is the flow for the first real deal after it ships. Nothing here touches existing rows.

```
PROBE A  accountless party on a live contract  -> found: true (+document/contact/org)
PROBE B  address with no contract              -> {"found": false}   (no reason)
PROBE C  party who already has an account      -> {"found": false}   (no reason)
PROBE D  service-role mints the same invitation -> token_minted = true
PROBE E  anon reach                            -> false on all three
```

## §2 — first name, last name, phone, email, through the one spine

`SignStart` was deliberately email-only; you overrode that. All four are captured and required. `provision_client_invitation` gained `p_phone` and writes it to the contact — **blanks only**, the same conservative rule the names already followed, because a self-service form is a weaker source than a record staff curated.

**A parameter cannot be added with `CREATE OR REPLACE`** — that makes an *overload*, and PostgREST resolves RPCs by argument name, so both would become ambiguous for every existing caller. The 12-argument signature was dropped and the 13-argument one took its place.

**And that is where this task's sharpest trap fired.** A dropped function loses its grants silently, and this database has `ALTER DEFAULT PRIVILEGES` granting `EXECUTE` on new functions to **`anon`** — as a *direct* grant (`anon=X/postgres`). `REVOKE … FROM PUBLIC` does not remove it. My first draft did exactly that and left the provisioning spine anon-callable. Caught by checking rather than assuming:

```
before:  {postgres=X, authenticated=X, service_role=X}          anon = false
draft:   {postgres=X, anon=X, authenticated=X, service_role=X}  anon = TRUE
after:   REVOKE … FROM PUBLIC, anon                             anon = false
```

Probe (rolled back): the contact carries `Probe / Tester / 555-0142`, the invitation carries the name.

## §3 — the real send state, and the escape hatch

The outcome existed all along — `sendInvitationEmail` returns `{ok, messageId, error}` — and `/api/sign-start` threw it away behind a neutral 200. It now reports `sent` / `send_failed` / `rate_limited` / `unavailable`, and the screen renders each one differently. The failure branches say plainly that **no email went out**, because telling somebody to go look for a message we never sent is how a signup dies quietly.

Anti-enumeration is intact, and worth stating precisely: the property that matters is *"does this address already exist here"*, and the response still cannot answer it — a new address and a returning one both provision and both report the same status. What is now revealed is whether **our own send** succeeded, which is a fact about us. `rate_limited` is keyed on `sha256(ip|user-agent)`, never the email.

**The trail, on the `request_alert_sends` model — one row per attempt, provable:**
- `signup_attempts` — every attempt, with the transport's own error text.
- `signup_alert_sends` — every owner-alert send, idempotency-keyed. A retry is a new row, so the trail shows every try.

"I never received it" → `claim_signup_help_alert` stamps the attempt and inserts the dashboard notice for **every staff account**, once; `/api/signup-help` emails the ops inbox from the **owner-editable `SIGNUP_EMAIL_HELP` template** (D13); `record_signup_alert_send` writes the row. The visitor is told support was notified.

```
attempt recorded:  probe@example.test | email_ok f | 'SMTP 550 mailbox unavailable'
dashboard notice:  2 rows (one per staff account)
  title: 'Probe Tester never received their activation email'
  body:  'probe@example.test · rider · SMTP 550 mailbox unavailable'
second click:      first = false, notices still 2   (no re-notify, email still retried)
alert send row:    hello@fhequestrian.com | succeeded t | msg-1
```

## §5 — the landing, and the profile notice

Completing onboarding routed a member with **zero unread notifications straight past the dashboard to the community feed** — precisely the member who has just finished signing and still owes us their details. The landing is now the dashboard, unconditionally.

The "Complete your profile" tile reads `contact_profile_complete()`, **extracted from `my_onboarding_state`'s inline copy and rewritten in place there** so the wizard and the dashboard cannot drift into two definitions of "done" (the WALLSYNC lesson). It names what is missing rather than nagging, and opens `/app/account?section=profile`.

The in-place body rewrite **asserts it changed something** rather than no-opping, which is the failure mode the repo's migration caveat describes. Verified live: `my_onboarding_state` contains `contact_profile_complete(v_contact)` = **true**.

## §6 — order notice → payment screen

`notify_purchase_unpaid` already fires from `_provision_purchase_for_offerings`, so a staff-added order already becomes a dashboard tile. It pointed at `/app/orders` — a list, one hop from the thing the member was told to do. It now points at `/order/<id>`, which **is** the review-and-pay page. Because that link is also the resolution key, `mark_purchase_paid` resolves **both** forms, so notices raised before this migration still clear.

`report_my_payment` records a **claim**: an order sub-status (`payment_reported`, `is_true_status = false`) plus three columns, and a staff notification **worded as a claim**. It never touches `payment_status`. Staff reconciliation remains the only thing that settles an order.

```
CJ Z reports zelle + CONF-9931:
  payment_status  unpaid     <- UNCHANGED
  payment_method  zelle
  client_reported_method zelle | reference CONF-9931 | reported t
  trail:  'Client says they sent the Zelle payment — confirmation CONF-9931'
  staff:  'CJ Z says they paid 1x Weekly (With your horse) by Zelle (ref CONF-9931) — not yet confirmed'
cash: same path, no confirmation number needed
Claire reporting on CJ's order: refused ('order not found')
```

## §7 — booking

- **Credits are visible to the member.** Staff had a roster of everyone's balances on this page; the member could see none of their own on the page they book from. There is now a credits strip.
- **The item picker.** `book_open_slot` gained `p_credit_id`: the member names which purchased item the slot is against and **that** credit is debited, no silent fallback. FLOWTRACE §9 flagged that the parameter existed end-to-end and no client surface ever passed it.
- **Pending is editable, not "changeable by request".** Nothing has been agreed, so there is nothing to renegotiate: `update_my_pending_booking` / `withdraw_my_pending_booking` move it or take it back outright — no request row, no fee, no approval round-trip. A confirmed booking still goes through `request_booking_change`.
- **The fee gate is server-side.** `request_booking_change` **refuses** a chargeable change with no acknowledgement (`FEE_CONFIRMATION_REQUIRED`) rather than creating a row somebody has to chase. Zelle with an optional confirmation number, or cash — the same affordances as the order payment screen. `fee_paid` still only moves via `mark_change_fee_paid`: saying you paid is not paying.

```
PROBE 4  30h out, no acknowledgement  -> refused, request rows created = 0
PROBE 5  same change, 'zelle'/ZL-771  -> accepted; fee 25.00, fee_paid f,
                                          fee_reported_method zelle, reference ZL-771
PROBE 6  outside the window           -> no fee, nothing to acknowledge
PROBE 7  pending booking edited       -> moved, still pending, no request row
PROBE 8  confirmed booking            -> NOT_PENDING
PROBE 9  somebody else's booking      -> not your booking
```

### ⚠️ THE FEE SCHEDULE — where your numbers go

**No fee amount was invented, and the schedule ships EMPTY.** Live after apply: `tiers_seeded = 0`, and `reschedule_fee()` returns **0.00 inside 48h / 0 outside** — bit-for-bit what it did before.

`booking_change_fees` is the table: one row per band, `hours_before` + `fee_amount` + a label the client sees. Bands overlap on purpose and **the tightest one wins**, which is how a person reading "48h → $25, 24h → $50, 4h → $100" expects it to behave:

```
hours_out | fee        (with that schedule entered)
       72 |   0
       47 |  25
       23 |  50
        3 | 100
```

**You enter it in the calendar settings panel** — gear icon on the calendar toolbar, "Change fee schedule", add/remove tiers, save. Adding a tier is never a migration (D13). With no tiers, the existing single "Reschedule fee (inside 48h)" field above it keeps applying, so entering your first tier is a change *you* make deliberately rather than one that arrives with a deploy. `reschedule_fee()` keeps its signature and its meaning; only the source of the number changed, and the 48-hour boundary survives as the fallback.

---

## A hole I left, and closed

**Caught by this task's own verification pass, not by review.** M1 wrote `REVOKE ALL … FROM PUBLIC` on its new functions — the move I then documented correctly in M2 two hours later as *not working*. Six functions came out anon-reachable.

Five refused an unauthorized caller internally. **One did not:** `deliver_executed_document_set` was written for a trigger and a cron, both already privileged, so no guard was written. Reachable by `anon` it is an unauthenticated way to make the system email a stranger's signed documents, given a contact uuid. It now has a guard **as well as** a revoke, so the fix does not rest on the ACL alone.

**anon reach across all 21 new/changed RPCs: 0**, proved with `has_function_privilege`.

## A collision with a concurrent thread — worth knowing about

M6 dropped the 2-argument `book_open_slot` and created the 3-argument one. Verified right after applying: **`overloads = 1`**. An hour later the final sweep for this report found **two**, and the old one was anon-callable again. Its body carries the `REVIEWQ R1` comment, so **another thread re-applied `20260815T2300_reviewq_m2_write_paths_land_pending.sql` to prod after mine.**

That is worse than a stray grant. PostgREST resolves RPCs by argument **name**, so with both signatures live, a call passing `p_credit_id` may or may not reach the function that honours it — which would silently spend the wrong purchased item, the exact defect §7 exists to fix.

`20260816T1800` drops every `book_open_slot` that is not the 3-argument one, via a `DO` block rather than a hard-coded signature, because the collision is proof these two files can land in either order or twice. It is a no-op on re-run (proved), and merging this branch puts it last.

**Two things follow for you:**
1. **This branch must merge after REVIEWQ**, or `20260816T1800` needs re-running.
2. A thread is applying migrations to prod that are already applied. It is worth knowing which, because this is the second time an "already verified" fact in this repo turned out to have been quietly undone underneath.

Final state: **1 signature, `anon = false`, and zero duplicate function names anywhere in `public`.**

---

## Open questions for you

1. **Cash: "marked paid by cash" — recorded, or settled?** Your words read either way. I implemented it as **recorded**: method `cash`, a claim on the trail, staff settle it — because at the moment the button is pressed the money has no more arrived than a Zelle transfer has cleared, and §6 says this must never be presented to staff as confirmation. If you want the button to settle the order outright, it is **one line** in `report_my_payment`.
2. **The fee schedule itself.** The mechanism is live and empty. Give me the tiers or enter them yourself in the calendar settings panel.
3. **"Fully editable while pending" — I built time and withdraw.** Changing *which purchased item* a pending booking is against would mean refunding one credit and debiting another; I did not build it. Say if you want it.
4. **`DEAL_PARTY` has no category document set.** `category_document_requirements` holds Guest / Rider / Horse owner only (12 rows). This does not block §1b — a deal party's documents come from the contract, not from a category — but if you ever want a deal party to also get standing onboarding paperwork, the requirements table has **no editor**, so today that would need a developer. Flagged as a D13 gap, not fixed.

## Not verified

- **No browser click-through.** Every render claim in this report is **NOT VERIFIED**.
- **The `test/db` PGlite suite was not run.** Every migration was dry-run and probed directly against prod inside `BEGIN … ROLLBACK`, which is stronger evidence of behaviour — but it is not evidence of replayability on a fresh database, and the standing feedback is that TS-clean ≠ DB-clean. I skipped it deliberately: the resource-hygiene incident (an 8GB Mac killed by orphaned vitest/PGlite processes) makes an unattended full suite the wrong call, and `20260816T1400`'s in-place rewrite of `my_onboarding_state` is by construction not replayable — the same documented property ~31 existing migrations have.
- **`/api/signup-help` end to end.** The RPCs are proved; the actual email to the ops inbox is not.

## Owner checklist

1. **One signing run, start to finish.** `/sign` → rider → four fields → activate → sign every document. **Expect exactly one email with every PDF attached.** Then say the word and I will show you the row count.
2. `/sign` renders five options and each one lands where it says.
3. On the send screen, click **"I never received it"** → you get a dashboard notice *and* an email, and the visitor sees the confirmation.
4. After signing you land on the **dashboard** with the overview modal, and a **"Complete your profile"** tile that opens the profile section.
5. Add an order for someone → they see the notice → it opens the payment screen → "I've sent the payment" (with and without a confirmation number) and "I'm paying cash" both work, and both reach you.
6. Calendar as a member: your credits show, clicking a slot lets you pick the item, the booking lands **pending** and you can change its time or withdraw it.
7. Calendar settings → **enter your fee schedule**. Then reschedule something inside the window and confirm it will not submit until you pick Zelle or cash.
8. `/sign/deal` with an address that has a contract → the email arrives and the link opens the contract with an account attached.
