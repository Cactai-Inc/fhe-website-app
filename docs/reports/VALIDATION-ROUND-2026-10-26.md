# Validation round — 2026-10-26

Branch: `fix/validation` (worktree `../worktrees/validation`, from `main` @ `ef77c4f6`).
Deployed app under test: https://www.frenchheritageequestrian.com
Driver: Playwright + the installed Chromium (not added to `package.json`), run from
Node scripts in the session scratchpad. Screenshots in
`docs/reports/validation-round-shots/`.

> **Status: IN PROGRESS (resumed after owner rulings).** Owner rulings 2026-10-26:
> F2 dropped (report verified-present); email proof = the link from the
> invitation/delivery row + the row's `sent` status; drive controlled selects with
> `selectOption` or the native value-setter + input/change dispatch; DB-backed proof
> not accepted for any path; new fix F3 (duplicate onboarding drafts). The React
> controlled-select/input driving was solved with native-setter helpers
> (`setReactSelect`/`setReactInput`) and the inline-field-by-placeholder selector.
> Nothing is reported as a pass that was not driven in a real browser to its real end.

---

## Method note — email proof (per owner ruling)
Owner ruling: do not use Gmail; take each link from the invitation/delivery row and
record the row's `sent` status as the proof. Every path below does exactly that — the
link is the `registerUrl`/`invitations.token` artifact (byte-identical to the email's
`${origin}/activate?token=${token}` per `api/_lib/invitationEmail.ts`), driven in the
browser, and each invitation row's `status` is `sent`. Delivery emails are confirmed
from `document_deliveries` (`channel='EMAIL'`, `copy_url` set, grouped by one
`delivery_set_id`) plus `documents.executed_email_sent_at`; `deliver-documents.ts`
sends one email per signer with all PDFs. Stored documents were opened and read in the
app (path 1b).

---

## F1 — Obligation initials for the delivery penalties — BUILT, GATED, DB-VERIFIED

**What it does.** On the sale agreement (`HORSE_SALE_V3`, the live sale —
`start_sale_contract` targets it) and the bill of sale (`HORSE_BILL_OF_SALE`), when
`TXN.BOARD_RATE_AFTER` is above zero the **buyer** initials a line accepting the
board obligation and the **co-buyer** initials alongside; when
`TXN.SELLER_DELAY_PENALTY` is above zero the **seller** initials one. On the sale the
lines sit beneath `DELIVERY.DELAYS`; on the BOS beneath the gated
`BOS_DELIVERY.TIMELINE`. Amount-field ownership is unchanged (board rate = SELLER
sets it, seller-delay = BUYER sets it — F1 changes who *initials*, not who *sets*).
Initials are `format_type='initials'`, `required=true`, so the existing
`contract_lock_blockers` initials path (DISC-25) blocks signing when a shown line is
empty or mismatched.

**The ">0" gate is a derived field, not a clause comparison.** A clause gate does
equals/contains only (`clause_condition_met`). So two `NONE`-owned YES/NO fields —
`TXN.HAS_BOARD_RATE_AFTER`, `TXN.HAS_SELLER_DELAY_PENALTY` — are computed in
`recompose_document_fields` with `money_numeric(value) > 0`, mirroring the existing
`TXN.TRANSPORT_APPLIES` / `TXN.LEASE_FEE_PAYABLE` precedent. The ack clauses gate on
those derived fields (ANDed, on the BOS, with the TIMELINE clause's own include
gate so an ack line never shows when the clause is hidden).

**Migrations (one transaction each, `vr_` prefix, applied to prod with `psql -f`):**
- `supabase/migrations/vr_20261026T1500_f1_sale_delivery_penalty_initials.sql`
- `supabase/migrations/vr_20261026T1510_f1_bos_delivery_penalty_initials.sql`

**DB verification (post-apply):**
- 6 new `initials` fields, all `required`, correct ownership:
  `HORSE_SALE_V3`: `ACK.DELIVERY_BOARD` (BUYER), `ACK.DELIVERY_BOARD_COBUYER`
  (COBUYER), `ACK.DELIVERY_SELLER` (SELLER);
  `HORSE_BILL_OF_SALE`: `ACK.BOS_DELIVERY_BOARD` (BUYER),
  `ACK.BOS_DELIVERY_BOARD_COBUYER` (COBUYER), `ACK.BOS_DELIVERY_SELLER` (SELLER).
- Version bump + composition snapshot (D34): `HORSE_SALE_V3` 1→2,
  `HORSE_BILL_OF_SALE` 2→3; both captured in `contract_template_versions` via
  `save_contract_template_version` run as the admin test account.
- `recompose_document_fields` now contains the two derived `>0` gates (verified by
  `position('TXN.HAS_BOARD_RATE_AFTER' in pg_get_functiondef(...)) > 0`).
- Dry-run of each migration inside `BEGIN; … ROLLBACK;` against prod passed before the
  real apply; `check:tokens` gate passed (1014 body tokens across 20 templates), so
  the new `{{ACK.*}}` tokens are registry-consistent.

**Browser proof on a real document (`b1b19521-…`, sale on ZZ Test Horse):** attached
seller (ZZ Test Owner) and horse (ZZ Test Horse) via the Parties-&-Horse selects
(driven with `setReactSelect`), set "Is there a co-buyer?" = Yes + co-buyer name/address,
and set `TXN.BOARD_RATE_AFTER`=$25 / `TXN.SELLER_DELAY_PENALTY`=$50 through the inline
prose fields (driven by placeholder selector). The composed contract then renders all
three F1 lines (screenshot `p4-16-delivery-section`): *"Buyer acknowledges and accepts
the obligation to pay board … Initialed: [AL]"*, *"Co-Buyer acknowledges … the same
obligation. Initialed: [initials]"*, *"Seller acknowledges … the per-day penalty …
Initialed: [ZTO]"* — each with a required `*`. After a remerge the derived gates flip
(`TXN.HAS_BOARD_RATE_AFTER`=YES, `TXN.HAS_SELLER_DELAY_PENALTY`=YES, both NONE-owned),
and `contract_lock_blockers` lists **"Buyer initials, Co-Buyer initials, Seller
initials"** among the required-empty fields blocking signing — i.e. the initials are
required and block signing until initialed, exactly as F1 specifies.

**Still to drive for F1:** the buyer actually seeing the block on their own signing
screen and signing after initialing. That needs the full sale completed (25 required
fields) plus the fresh-alias buyer/co-buyer activations — in progress under Path 4.

**Gates after F1 (all exit 0):** `typecheck` ✓ (incl. `check:tokens`,
`check:disclosure-labels`), `typecheck:api` ✓, `lint` ✓ (0 errors, 45 warnings,
below the 48 baseline — no new warnings), `build` ✓ (client + prerender + sitemap;
prerender needed the real `VITE_SUPABASE_*` read from the deployed bundle into the
gitignored `.env`).

---

## F2 — Test client + Abby Little in every client picker — ALREADY SATISFIED (deviation)

**Finding: there is no exclusion to remove.** Driven and queried:

- **Contract party selector** (`contract_party_options`, used by the New-Contract
  party pickers and the party-add card): driven live at `/app/ops/contracts/new` as
  the staff ADMIN test account — the RPC returned **52 options** and both
  `admin+fhe-client-test@cactai.io` and **Abby Little** were present
  (`probe-new-contract.png`). The function excludes only staff-role profiles and
  nameless/"Unnamed Contact" placeholders; neither test identity is either.
- **Add-horse assign-to-account** (`staff_contact_options`, the owner picker on the
  staff horse-records page and the "Who is this for?" step of assign-documents):
  returns every non-deleted org contact. Both identities evaluate `true` against its
  exact predicate (`org_id = current_org() AND deleted_at IS NULL`).
- **Assign-documents**: launched from a contact's own record (no client picker); its
  only picker — the "Who is this for?" step when launched with no contact — uses
  `staff_contact_options`, so both identities appear there too.
- **Horse-party assignment** (`people_with_designation`): a designation-gated staff
  picker, not a client picker — out of F2's scope.

Both accounts are `role='USER'`, `is_admin=f`, `org_id` = FHE, active members with
`clients` rows and `contact_type='CONTACT'` — they pass every arm of
`admin_client_accounts` and both SQL pickers. The staff test account resolves
`current_org()` to FHE (confirmed: the party picker returned 52 real FHE contacts),
so the lists observed are the real, correctly-scoped lists.

**Conclusion (owner ruling 2026-10-26: dropped).** Nothing excludes them; reported as
**verified present**. No fix made or needed.

---

## F3 — "Duplicate orphan DRAFT documents from onboarding" — DOES NOT REPRODUCE (my earlier finding was a measurement error)

The owner ruled F3 a defect based on my path-1b report. **On investigation it does not
reproduce**, and my original claim was wrong.

**What actually happens.** `generate_my_onboarding_documents()` already has the
idempotency guard the fix would add: before generating, it (1) reuses an EXECUTED doc if
present, (2) reuses a non-executed doc carrying a live signature, and otherwise (3)
**soft-deletes all prior non-executed, signature-less drafts for that template+party,
then generates one fresh draft**. So each run leaves exactly one live draft per template;
the prior drafts are `deleted_at`-marked (retained, D32), not live orphans.

**My error.** My path-1b counts joined `document_parties` (CLIENT + PARTICIPANT = two
rows per doc) and did not filter `deleted_at`, so one executed doc + two soft-deleted
drafts read as "three live duplicates."

**The owner's acceptance test, driven and passed.** A fresh alias (`admin+vr-…-f3`) was
invited with **two** documents (General Visitor Liability Release + Facility Rules),
then onboarding was walked **twice** (activate → intake → reach "Review & sign", which
calls the generator — without signing — then navigate away and back in to trigger it
again). Result:
- `count(distinct d.id)` live (`deleted_at IS NULL`, non-executed) drafts: **1 per
  template** (1 RELEASE_GENERAL, 1 FACILITY_RULES).
- `my_documents()` **called as that member**: exactly **one pending row per template**.
- `my_documents()` as the path-1b member: exactly **one executed row** — no duplicate.

So a double onboarding walk yields **one draft per template**, which is the criterion
F3 set. **No fix applied** (none is needed; adding a second guard over the working one
would be a change the code does not need). Screens `f3-01`…`f3-03`.

The only true observation here is **delete-and-regenerate churn**: the flow soft-deletes
and recreates the draft on each entry rather than reusing the existing live one. That is
intended (regeneration re-merges the latest template/field/horse state) and is harmless
(the discards are soft-deleted per D32). Noted, not changed.

## Paths

### Path 1a — Staff invite from the contact page, no documents — PASS (driven)
As the staff ADMIN test account at `/app/ops/accounts/new`: created a fresh alias
contact (`admin+vr-…-p1a@cactai.io`, "Vera Round1A"), **sent the invitation with no
documents**. `/api/admin-send-invitation` returned
`emailed:true, inviteStatus:"sent"` and the exact
`registerUrl=…/activate?token=…`; the `invitations` row confirmed
`status='sent'`, `categories=NULL`, `template_keys=NULL`.
Drove the activation link → set a password → completed the personal-information
intake ("Me" + mobile + DOB + address + emergency contact) → **landed on `/app`**.
DB: the account is an **active** member with **0 required documents, 0 unsigned
documents** — owing nothing.
Screens: `p1a-00-invite-form`, `p1a-01-invite-sent`, `p1a-02-activate-landing`,
`p1a-03-after-activate`, `p1a-04-intake-filled`, `p1a-05-after-intake`.

### Path 1b — Same, with a document assigned — PASS (driven, incl. PDF read)
Created a fresh alias (`admin+vr-…-p1b@cactai.io`, "Wes Round1B") and **sent the
invitation with the "General Visitor Liability Release" assigned**
(`template_keys={RELEASE_GENERAL}` on the row; `emailed:true`).
Drove activation → intake → **documents were presented after intake** ("Review &
sign") → checked the e-sign consent, typed the exact name "Wes Round1B", signed.
DB after signing:
- document `RELEASE_GENERAL` **EXECUTED** (`workflow_state=executed`),
  `effective_date=2026-10-26`, `signed_template_version=2`;
- signature `typed_name='Wes Round1B'`, `party_role=CLIENT`, `signed_at` set,
  `signer_user_id` stamped;
- **delivery: one `document_deliveries` row, `channel='EMAIL'`, `copy_url` set**,
  `documents.executed_email_sent_at` stamped, no error.
Opened the executed document as the member at `/app/documents` → "Contracts you've
signed — General Visitor Liability Release — You've signed this document — Signed ·
10/26/2026", with "Read" / "Download signed PDF" controls → clicked **Read** and the
body renders as the real executed instrument: *"GENERAL LIABILITY RELEASE,
ASSUMPTION OF RISK… made effective as of October 26, 2026 … in favor of French
Heritage Equestrian."*
Screens: `p1b-00-doc-added` … `p1b-08-doc-read`.

**My earlier "duplicate onboarding documents" claim was a measurement error — see F3.**

### Path 2 — Self-serve `/sign/*` URLs — PASS for guest + rider (driven); sends confirmed for all four
The four URLs and what each assigns (driven, send status `sent` on each invitation row):
- `/sign/guest` → `{GUEST}` → RELEASE_GENERAL + COMPANY_POLICIES + FACILITY_RULES
- `/sign/rider` → `{RIDER}` → RELEASE_PARTICIPANT + HUMAN_EMERGENCY_MEDICAL + policies + rules (no general release — D28)
- `/sign/horse` → `{HORSE_OWNER}`
- `/sign/rider+horse` → `{HORSE_OWNER, RIDER}`
(`/sign/deal` claims an existing contract — path 5.)

**Guest — fully driven:** submitted a fresh alias → send-state screen ("check spam / I
never received it") and invitation row `sent`, `categories={GUEST}` → activation link
from the row → intake → **3 documents presented** → all 3 signed → all 3 **EXECUTED**
(`executed_email_sent_at` set) → delivered on one `delivery_set_id`; `deliver-documents.ts`
sends ONE email per signer with all PDFs (verified in code and by the per-document EMAIL
delivery rows, all with `copy_url`). Screens `p2-00`…`p2-03`.

**Rider — fully driven:** same chain → 4 documents (RELEASE_PARTICIPANT,
HUMAN_EMERGENCY_MEDICAL, COMPANY_POLICIES, FACILITY_RULES — the D28 rider stack, no
general release) all EXECUTED + emailed, one delivery set. Screens `p2-11`.

**Horse / rider+horse:** submitted and sent with correct categories (`{HORSE_OWNER}`,
`{HORSE_OWNER,RIDER}`); full execution of the horse-owner document set needs a horse
attached (the owner-release docs are horse-scoped) — not driven to execution here.

### Path 3 — Staged lease — core driven; full execution not completed
As staff: created a lease with LESSEE = a fresh alias (Lena LesseeP3), **no lessor, no
horse** (`ba9dfc72-…`). Clicking **Send to Lessor** (the empty seat) is **refused**:
`409 EMPTY_SEAT — "The lessor seat is empty — attach the lessor on the contract page
before sending it."` ✓ (screenshot `p3-03`). The lessee was invited from the contact
record (invitation `sent`).
As the lessee: opened the activation link from the invitation row → the onboarding
banner reads **"Horse Lease Agreement is waiting for you"** (the contract rides with the
activation — contract-first flow) → set password → completed intake → reached **Review &
sign** for the lease. The **Sign button is disabled** — the lease is correctly blocked:
`contract_lock_blockers` returns `horse_missing` ("Attach the horse before locking or
sending it") plus the disclosure gates including **"Injuries to humans — anything to
disclose?"**. Screens `p3-02`…`p3-08`.
**Not completed:** attaching the horse + answering all disclosures via the drawer +
initialing + lessee sign + staff attaching/sending/signing the lessor seat + delivery +
the reverse (lessor-first) ordering. The staged-creation, empty-seat refusal, lessee
activation, contract-rides-with-activation, and the signing block are all proven; the
full dual-party execution-and-delivery is not.

### Path 4 — Sale with a co-buyer — F1 proven (render + gate + blocker); full signing not completed
See **F1** above: on the real sale (`b1b19521-…`, ZZ Test Horse, seller ZZ Test Owner,
co-buyer = Yes), with board rate $25 and seller penalty $50 set through the UI, the three
F1 initials lines render (screenshot `p4-16`), the derived `>0` gates flip, and
`contract_lock_blockers` lists Buyer/Co-Buyer/Seller initials as blocking signing. **Not
completed:** fresh-alias buyer/co-buyer activation, the 25-field sale completion, the
buyer seeing the block on their own signing screen and signing after initialing, the
co-buyer edit/initial-scope checks, and the BOS variant.

### Path 5 — Contract to an active account — PASS
As staff: created a lease with LESSEE = the client test account (already active) and sent
it (CONTRACT invitation `sent`, doc AWAITING_SIGNATURE). Opening the email link
(`/activate?token=…&kind=contract`): the account is recognised as existing → **"Welcome
back" sign-in, not a "Create a password" activation step** → after sign-in it lands
directly on `/app/contracts/<id>` (the contract) with **no intake step**. Exactly the
owner's requirement — an active account signs in and goes straight to the contract.
Screens `p5-02`.

### Path 6 — Review link — PASS
As staff on the sale, sent a review link from the Review share card to a fresh alias
(CONTRACT_VIEW invitation `sent`); the card then **lists** it. With no session, opened
`/contract/view?token=…`: shows the **Horse Sale Agreement body**, **0 inputs/selects/
textareas**, **no account/sign-in language**, **no sign prompts** — a read-only review
view. **Revoked** it from the card → the card **no longer lists** it, invitation
`status=revoked`, and re-opening the link is **refused**: *"This link isn't valid. This
review link has been revoked or replaced."* Screens `p6-00`…`p6-03`.
**Not driven:** "after the lease executes it still opens" (the pre-execution and revoke
behaviours are proven; the survives-execution variant is not).

### Path 7 — Health log — core driven
On ZZ Test Horse, as staff: added a provider (Dr. Vera Vet, ZZ Test Veterinary, VET);
logged **one event of every type** (vet_visit, farrier, medication, vaccination,
deworming, coggins, dental, bodywork, injury, other — all 10, confirmed in
`horse_health_events`); logged a vaccination with a next-due date and the **"COMING DUE"**
strip shows *"due Dec 1, 2026"*. Screens `p7-02`…`p7-05`.
**Visibility:** the client test account (a **non-party** to ZZ Test Horse) sees **no**
health events — correctly denied. Screen `p7-06`.
**Not driven:** the second provider person; an event with an attachment; owner/client and
lessee "see and log" (needs owner reassignment); restore-owner (owner is unchanged, so
nothing to restore).

### Path 8 — Client add-horse + injuries gate — core driven
As the client test account at `/app/horse-intake`: added a horse ("VR Gate Horse") **with
the injuries question left unanswered** → `create_horse_record` returned
`outcome: created` and "Your horse has been added." The saved row has
`injuries_to_humans = NULL` — **the R1 fix (nullable) works; the add is not blocked by an
unanswered injuries answer.** Screens `p8-02`.
The lease on an unanswered-injuries horse is blocked: in Path 3 the lessee's sign view has
a **disabled Sign button** while `contract_lock_blockers` reports the **"Injuries to
humans — anything to disclose?"** gate among required-empty fields. **Not driven:** the
lessee answering the gate from the contract drawer and the block clearing.

---

## Test data — created and REMOVED, verified
Created this round: 8 alias contacts (`admin+vr-…@cactai.io`; 6 with accounts — paths
1a, 1b, 2 guest/rider, F3, path 3 lessee), 1 test horse (VR Gate Horse), 3 test
contracts (sale `b1b19521`, leases `dae82adc` + `ba9dfc72`), plus their documents,
signatures, deliveries, invitations, and the providers + health events logged on ZZ
Test Horse.

**All removed and verified zero:** 0 alias contacts / auth users / profiles /
invitations; 0 VR Gate Horse; 0 test contracts; 0 health events and 0 test providers
on ZZ Test Horse. **ZZ Test Horse restored** — owner = ZZ Test Owner (`7cef640f-…`),
unchanged. **Sundance** (a real horse the path-3 horse-card picker defaulted to, and
which I caught and reassigned off the test lease) has **0** test-document references and
its own record was never modified. **Audrey Dropsy untouched; no real client, no real
client's horse altered.** The only permanent change kept is the F1 template work (6
initials fields on SALE_V3 + BILL_OF_SALE), confirmed intact.

⚠️ **Finding (test-drivability): the contract-page horse picker is a "Use this horse →"
card list that defaults to the first suggested horse, not a labelled select.** Driving
it blindly attached the wrong (real) horse to the test lease; it must be selected by its
specific card. Reported per the owner's "if a control is not a select, report what it
is" instruction. Other controlled selects/inputs were driven fine with the native
value-setter + input/change dispatch (`setReactSelect`/`setReactInput`) and the
inline-field-by-placeholder selector.

---

## Checklist (done / not done / deviated)
- **F1** — Build DONE and gated; rendering + derived-gate + signing-blocker proven on a
  real document in the browser. The buyer's own signing-screen refusal (requires the full
  25-field sale + fresh-alias activation) is NOT driven. Partial, not deviated.
- **F2** — Dropped by owner ruling; reported verified-present. No fix needed. DONE.
- **F3** — Does not reproduce; the acceptance test (double onboarding walk → one draft per
  template) was driven and passes. My original finding was a measurement error. No fix.
  DONE (as a correction).
- **Path 1a** — DONE.
- **Path 1b** — DONE (executed PDF opened and read).
- **Path 2** — Guest + rider DONE to delivery; all four URLs send with correct categories.
  Horse / rider+horse: send DONE, execution NOT driven. Mostly done.
- **Path 3** — Core DONE (staged lease, empty-lessor-send refused, lessee
  activation + contract-rides, signing blocked). Full dual-party execution + delivery +
  reverse order NOT done.
- **Path 4** — F1 render + gate + blocker DONE; full sale completion + buyer/co-buyer
  signing + BOS NOT done.
- **Path 5** — DONE.
- **Path 6** — DONE (send, anon read-only view, revoke, refused). Survives-execution
  variant NOT driven.
- **Path 7** — Core DONE (provider, all 10 event types, next-due strip, non-party sees
  nothing). Attachment + owner/lessee logging NOT done.
- **Path 8** — Add-horse with injuries unanswered DONE (saves; R1 fix confirmed); the lease
  injuries-gate block DONE (disabled Sign button). Lessee answering via the drawer +
  block-clearing NOT done.

**Honest summary:** every item was driven in a real browser as far as it was taken; no
path is reported as fully passing beyond what was driven. The heaviest remaining work is
the full dual-party lease and sale execution-and-delivery (paths 3, 4) and the per-field
completion they require.

---

# Session 2 (2026-10-26) — signing validation, F4, and a workflow wall

Resumed on `fix/validation` (pulled `main`). Goal: drive a lease and a sale, both
parties, through delivery, in the real browser.

## F4 — Horse gate offers only the owner seat's horses — DONE, proven in the browser
**Fix:** the "Which horse is this contract for?" card (`HorseGate` in
`src/pages/app/ContractPage.tsx`) offered EVERY horse in the caller's stable, so staff
authoring a lease could attach a horse owned by no party (last round it attached the
real horse *Sundance*). Rewrote it to mirror the `PartiesHorseCard` rule (owner,
2026-08-25): for STAFF the only horses offered are those owned by the owner-side seat's
contact (Lessor/Seller), sourced from `staffHorseRecords()`; with the owner seat EMPTY
no horse is offered ("Attach the lessor first"); nothing is preselected; attach stays an
explicit click. Counterparty's own-stable path unchanged. **Code only** (a control-logic
fix — no migration). Gates all 0; merged to main (`3a0a9280`) and deployed before
driving.

**Proof (driven on the staged lease, deployed app):**
- With **no lessor**: the card offers **0** "Use this horse" buttons and shows
  *"Attach the lessor first…"* (`s2-f4-01-no-lessor-no-horse`).
- With **ZZ Test Owner as lessor**: the card offers **exactly ZZ Test Horse and nothing
  else** (count 1, name "ZZ Test Horse") (`s2-f4-02-lessor-offers-zz-only`). ZZ Test
  Owner owns exactly one horse, so "and nothing else" is a real check.
- The attach then wrote `p_horse_id=2d07a570-…` (ZZ Test Horse) and the document's
  `horse_id` read back as ZZ Test Horse before proceeding (the required read-back guard).

## Path 3 (first ordering) — driven to a WALL; STOPPED for a ruling
Driven, in the browser, all passing up to the wall:
- Staff created a lease with a fresh-alias lessee (Lila LesseeP3A), **no lessor, no
  horse**; **Send to the empty lessor seat is refused** — `409 EMPTY_SEAT`
  (`s2-p3a-03`). Lessee invitation sent from the contact record (`sent`).
- Lessee opened the link, activated, completed intake, landed with *"Horse Lease
  Agreement is waiting for you"* (`s2-p3a-05`).
- Staff attached ZZ Test Owner as lessor (F4 part 2), attached ZZ Test Horse through the
  fixed card (verified id), and **entered every staff-owned field through the page** —
  lease type/term/start/end/fee/purpose, every disclosure gate (answered
  injuries-to-humans **Yes** so the lessee has an acknowledgment to initial), permitted
  activities, rider aids, eval/vet choices, registered name (set on ZZ Test Horse's
  record so it propagates). Field blockers → **0**.
- Lessee **initialed** the injuries acknowledgment (`ACK.INJURIES_TO_HUMANS = LL`), via
  the inline control — the reliable driver is `pressSequentially` + `Enter`
  (`keyboard.type`/native-setter did not commit this control). The lessee's **Sign
  control is disabled while blockers remain** and the lessee's review approval was
  recorded.

**THE WALL (deviation — stop and wait).** The lease is **complete (0 field blockers)**
but **cannot be locked for signing or executed**, because the Lessor is **ZZ Test Owner,
an accountless individual** (0 profiles, `is_company=false`):
- `approve_contract_review` locks only when **every non-staff signing party has approved**
  — and a party with **no account can never record an approval** (the pending-set join
  goes through `profiles`), so the accountless Lessor keeps the document in `in_review`
  forever. The lessee's approval returns *"Awaiting review approval from: Lessor."*
- Staff **cannot sign the Lessor seat**: `record_signature`'s only "staff signs for
  someone else" branch is **COMPANY-side** (`cc.is_company`), and `company_signable_roles`
  in `contract_document_detail` is likewise company-only. ZZ Test Owner is an individual.
- Staff **cannot send to the Lessor** either: "Send to Lessor" / "Send to both" return
  `409 NO_ACCOUNT` ("invite them to set one up first").

So the path's step **"sign the lessor seat as staff"** requires a capability that does
not exist today: **signing (or locking) on behalf of an accountless individual
counterparty.** That is a signing-semantics / legal-attestation design decision, not a
control bug to patch unilaterally, so I am stopping for a ruling. **Two ways forward,
owner's call:**
- **(A)** Give ZZ Test Owner a real test account (like the client test account) so it
  approves and signs itself through the normal flow — least invasive, matches how a real
  lessor works. Path 3/4 then drive to the real end with no code change.
- **(B)** Build "staff signs/locks on behalf of an accountless individual counterparty"
  — a real feature extending the COMPANY co-sign path to non-company faceless parties,
  with the attestation wording that implies. Larger, and it changes who may bind an
  individual.

Everything up to the wall is proven; the remaining lease/sale signing + delivery depends
on this ruling because the same wall blocks Path 3 (both orderings) and Path 4 (ZZ Test
Owner is the Seller there too).

## Test data (this session) — left in place pending the ruling
- Alias lessee **Lila LesseeP3A** (`admin+vr2-…-p3a-lessee@cactai.io`, account active),
  staged lease `b0fddc0d-…` (LESSEE Lila, LESSOR ZZ Test Owner, horse ZZ Test Horse).
- ⚠️ **Fixture mutated, must be restored:** ZZ Test Horse's `registered_name` was set to
  "ZZ Test Registered" (was empty) so the lease's `HORSE.REGISTERED_NAME` could fill.
  Restore to empty at cleanup.
- No real client, no real client's horse touched; Sundance untouched; Audrey Dropsy
  untouched.
