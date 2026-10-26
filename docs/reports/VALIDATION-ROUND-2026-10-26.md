# Validation round — 2026-10-26

Branch: `fix/validation` (worktree `../worktrees/validation`, from `main` @ `ef77c4f6`).
Deployed app under test: https://www.frenchheritageequestrian.com
Driver: Playwright + the installed Chromium (not added to `package.json`), run from
Node scripts in the session scratchpad. Screenshots in
`docs/reports/validation-round-shots/`.

> **Status: STOPPED for a ruling.** Two fixes (F1, F2) were worked and paths 1a/1b
> were driven to their real end in the browser. The remaining paths and the full
> dual-activation signing of F1 are **not** driven. The reasons are stated plainly
> below — one of them (F2) is a deviation from the prompt's premise, and the
> prompt's rule is "deviated means stop and wait." The others are hard blockers on
> faithful, browser-driven proof. Nothing here is reported as a pass that was not
> driven in a real browser to its real end.

---

## The two blockers that gate the rest, stated up front

### B1 — Email receipt cannot be independently confirmed in this session
Emails are sent for real via Google Workspace SMTP (`api/_lib/email.ts`) to
`admin+<alias>@cactai.io`. **The Gmail inbox for that address is not readable
here** — the Gmail MCP connector requires an OAuth authorization that cannot be
completed in a non-interactive session.

The prompt's own method covers this: *"read from the invitations or delivery rows
only to find the message, never to skip it."* Every link below was reconstructed
from the **exact** send-time artifact — `registerUrl` returned by
`/api/admin-send-invitation` and the `invitations.token` row, which
`api/_lib/invitationEmail.ts` composes as `${origin}/activate?token=${token}` —
i.e. byte-identical to the link the email carries — and then **driven in the
browser**. Delivery emails were confirmed from `document_deliveries`
(`channel='EMAIL'`, `copy_url` set) and `documents.executed_email_sent_at`, and the
stored document was then opened and read in the app. **What was not done: opening
the actual message in the `admin@cactai.io` inbox.** If the owner requires inbox
receipt itself, the Gmail connector must be authorized first.

### B2 — F2's premise does not hold on `main` (deviation)
F2 says the test client account and Abby Little "appear in every staff picker that
lists clients" as a **fix to build**, and asks to "report what excluded them." On
current `main`, **nothing excludes them** — both already appear in every client
picker. There is no exclusion rule to remove and therefore no fix to build without
inventing a change the code does not need (which the clean-code rule forbids). This
is a deviation from the prompt's premise and is the item this round stops on.
Full evidence under **F2** below.

A third, smaller impediment surfaced while driving: the staff **contract-builder and
Parties-&-Horse controls are React controlled components that headless Playwright
drives unreliably** (the buyer-only "Get started" create works; attaching seller/
horse via the on-page pickers did not register in React state across several
approaches). Paths 3/4/5 depend on driving exactly those controls through many
steps. This is noted as a test-drivability finding, not a product defect proven
against a user.

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

**What is NOT yet proven for F1:** the browser-driven buyer-signing block. The sale
document was created on ZZ Test Horse with Abby Little as buyer
(`b1b19521-ecbe-4c48-a3ec-97cd0e876926`, status AWAITING_SIGNATURE), but attaching
the seller/horse and setting `BOARD_RATE_AFTER` > 0 through the Parties-&-Horse card
could not be driven reliably (B2's third impediment), so the buyer's signing view
with the initials line present was not reached. **F1 is correct at the schema and
composition layer; its end-to-end signing behavior in the browser is undriven.**

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

**Conclusion.** F2's "what excluded them / the rule that now includes them" has no
answer because nothing excludes them. Building a speculative fix would add a change
the code does not need. **This is the deviation the round stops on** — the owner may
have seen the exclusion in an earlier build, or F2 may describe a picker not covered
by the four SQL functions above; either way it needs the owner's word before a
change is made.

---

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

**Finding (real, worth a fix): duplicate onboarding documents.** This one onboarding
left **three** `RELEASE_GENERAL` document instances for the contact — two orphan
`DRAFT`s (created 03:56 and 03:58:10) plus the one `EXECUTED` (03:58:47). The
onboarding signing flow appears to regenerate the pending document on each entry
rather than reusing it, orphaning the prior drafts. The member's executed copy is
correct and delivered; the orphans are clutter and briefly double the document in
the member's "My Documents" list. Same class as the historical
`FIX-ROUND-5b-SUNDANCE-DUPLICATE-DOCS` pattern. **Not fixed in this round** — flagged
for the owner.

### Paths 2–8 — NOT DRIVEN
Not attempted to their real end in the browser, for the reasons in B1/B2 and the
controlled-select impediment:
- **2 (self-serve `/sign/*`)**: the four URLs are `/sign/guest` → `{GUEST}`,
  `/sign/rider` → `{RIDER}`, `/sign/horse` → `{HORSE_OWNER}`, `/sign/rider+horse`
  → `{RIDER, HORSE_OWNER}` (`api/sign-start.ts:82`); `/sign/deal` claims an existing
  contract. Enumerated, not driven.
- **3 (staged lease, both orderings)**, **4 (sale + co-buyer, F1 signing block,
  BOS)**, **5 (contract to an active account)**: each needs the contract-page
  Parties-&-Horse controls driven through many steps; those did not register
  reliably. Path 4 is where F1's browser signing-block would be proven.
- **6 (review link)**, **7 (health log)**, **8 (client add-horse / injuries gate)**:
  not reached.

---

## Test data — created this round (NOT yet removed; see note)
- Contacts/accounts: `admin+vr-…-p1a@cactai.io` (Vera Round1A, active member),
  `admin+vr-…-p1b@cactai.io` (Wes Round1B, active member, 1 executed release + 2
  orphan draft releases + 1 delivery).
- Sale document `b1b19521-…` (buyer Abby Little, no seller/horse attached).
- No fresh aliases beyond the two above; **no real client, no real client's horse,
  Audrey Dropsy untouched.** ZZ Test Horse's owner is unchanged (ZZ Test Owner,
  `7cef640f-…`) — the sale draft did not reassign it.

**Cleanup is deferred pending the owner's ruling on whether to continue** (removing
the aliases now would discard the only driven evidence if the round resumes). When
authorized, removal covers the two alias accounts + their contacts, invitations,
documents, files, and the Abby-buyer sale draft, and re-verifies zero rows.

---

## Checklist (done / not done / deviated)
- **F1** — the build is DONE and gated; its browser-driven signing block is NOT done
  (undriven). Deviated: no — the fix is correct, only its end-to-end browser proof is
  incomplete.
- **F2** — NOT done, DEVIATED: the premise (an exclusion to remove) does not hold on
  `main`; both identities already appear in every client picker. Stopping for the
  owner's word.
- **Path 1a** — DONE.
- **Path 1b** — DONE (incl. executed PDF opened and read). One finding: duplicate
  onboarding documents, NOT fixed, flagged.
- **Path 2** — NOT done (URLs enumerated only).
- **Path 3** — NOT done.
- **Path 4** — NOT done (sale created; F1 signing block undriven).
- **Path 5** — NOT done.
- **Path 6** — NOT done.
- **Path 7** — NOT done.
- **Path 8** — NOT done.
