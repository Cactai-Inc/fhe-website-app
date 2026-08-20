# FLOWS — CONTRACTS (lease · sale/deal · counterparty)

**Traced at main `c56559e` (2026-08-20), prod read-only. The signing freeze is in force —
everything here is trace, not execution; DB proofs are quoted from CLOSEOUT/CONTRACTWALK
rolled-back walks.**
Areas touched: **Management** (Records → Clients/Documents/Deals, NewContractPage) ·
**Member app** (`/app/contracts/:id` — the dual-view surface, heaviest in the app per
SURFACE-INVENTORY §2) · **Public site** (`/activate` for counterparties, `/sign/deal`) ·
mail edge (5 contract endpoints) · **Modules → Boarding** (agreements read).
Incumbents absorbed: CONTRACTWALK (whole), CLOSEOUT §1 (whole), DUAL_IDENTITY_TRACE §2.

---

## F7 — Lease contract, compose → execute → terminate

TRIGGER      Staff: Records → client row → New Contract (`ClientRecordActions.tsx:176`) →
             `/app/ops/contracts/new` (SURFACE-INVENTORY §3: LINK-ONLY).
ACTORS       staff · lessee · lessor (either may be a no-account counterparty — F9) ·
             system: pg_net → `deliver-documents`, `delivery-sweep` cron.
PRECONDITION Lessee/lessor exist as contacts; a horse record (`create_horse_record` can be
             done inline); **both parties' onboarding paperwork executed or skipped**
             (the lock gate names the person — CONTRACTWALK §4; skip: CLOSEOUT §1.6).

SEQUENCE
1. `NewContractPage` → `startLeaseContract` → `start_lease_contract_v2`: `documents` row
   (`workflow_state='editable'`, `status='AWAITING_SIGNATURE'`, ~121 fields, 31 required),
   parties attached (LESSEE order 1, LESSOR order 2), a `contracts` envelope row at
   `draft`, horse + identity fields pre-filled (CONTRACTWALK §4). The company originates;
   `claim_document_origination` stamps the acting staff member's PERSONAL contact
   (DUAL_IDENTITY_TRACE §2 — owner-accepted).
   → *Staff see the editor; parties see nothing yet.*
2. Fields are completed on `/app/contracts/:id` (34 distinct data functions; the one
   surface where D19 is substantively satisfied — SURFACE-INVENTORY row). Live blocker
   list = `contract_lock_blockers` — since CLOSEOUT §1.1 the ONE completeness authority.
3. Horse confirmation: the Lessor (or staff) clicks "I reviewed the horse info" —
   reachable and labelled (CONTRACTWALK §4 corrected the task brief's suspicion).
4. Lock: `advance_document_workflow(…,'locked')` — runs blockers, seeds pending signature
   rows, recomposes the body. Since CLOSEOUT §1.5, locking creates **no** extra horse
   documents; those wait for execution. Both parties get "ready to sign" in-app.
5. Sign: UI offers the block only when locked; `lock_and_sign_contract` now delegates
   completeness to `contract_lock_blockers` before EVERY signature whatever the state
   (CLOSEOUT §1.1/1.2 — CONTRACTWALK A2/A3's disagreeing/skipping gates are CLOSED,
   walk1 P2/P3 quoted there).
6. Second signature → `record_signature` executes: `UPDATE documents SET
   status='EXECUTED', effective_date, execution_hash, workflow_state='executed'`
   (prod body line 106, read this trace — the UPDATE **names `workflow_state`**, which is
   what arms the three `AFTER UPDATE OF workflow_state` triggers). Effects, same instant:
   - `apply_contract_execution_effects` — horse moves: `lessee_contact_id`, `lease_start`,
     `horse_relationships` LESSEE row; stable views update (CONTRACTWALK §8).
   - `deal_autocomplete_on_execution` — the `contracts` envelope follows its document to
     `executed` (CLOSEOUT §1.7; see fulfilment.md F14 for the full resolution).
   - `snapshot_execution_audit` — the execution snapshot.
   - `ensure_horse_documents` fires now (execution, not lock) — HORSE_EMERGENCY_VET +
     RELEASE_HORSE_CARE appear awaiting the owner's signature (CLOSEOUT §1.5 walk).
   - `documents_send_executed_email_trg` (on `status`) queues the executed-copy email via
     pg_net → `/api/deliver-documents`; `document_deliveries` written per real send;
     the hourly `delivery-sweep` cron re-raises silent failures (endpoint header).
   - freeze: template version frozen; `signatures_seal_after_sign` +
     `freeze_signed_template_version` make the signed thing immutable.
   - notifications: the non-acting party is told; the signer is not; staff mirrored to
     both inboxes; per CLOSEOUT §1.8 every resolved notification survives in
     `notification_log`, read back on the contract's Activity card.
7. Supersession: re-signing supersedes and retains (`apply_document_supersession`,
   horse-scoped since SUPERSEDE 7d016f1); executed documents are never swept (D16/
   executed-docs rule).
8. Termination: ContractPage → Manage → Terminate → counterparty approves
   (`request/approve/decline_contract_termination`) → `workflow_state='terminated'`,
   parties notified (CLOSEOUT §1.4).

WHAT EACH PARTY SEES  Editor + blockers (staff/originating side) · the party view with
             confirm-horse button or "awaiting confirmation" (lessor vs others) · signature
             block only when locked · post-execution: document in My Documents, executed
             copy by email · staff: Activity card with the notification log.
NOTIFIES     ready-to-sign (in-app, both parties) · signed-by-X (staff, both inboxes) ·
             fully-executed (other party + staff) · executed copies by email (pg_net) ·
             change-request email (`contract-change-requests-submitted`) · void email
             (`contract-voided`) · working-copy self-send (`contract-working-copy`).
TERMINAL     `documents.status='EXECUTED'` + `workflow_state='executed'` + execution_hash ·
             `contracts.status='executed'` · horse fields moved · deliveries logged.
             Prod: 51 executed documents; **0 rows in `contracts`** — no lease has yet
             been run through the v2 envelope for a real client (pre-launch expected).
VARIANTS     evergreen lease (NULL end — reads "evergreen", CLOSEOUT §1.4) · company party
             (`redeem_contract_invitation` is_company branch never links a person's profile
             to the company contact — DUAL_IDENTITY_TRACE §2) · staff-as-party two-hats
             (view-level only, no DB flag) · D14 change review: a party submits change
             requests (`submit_change_requests` → `contract_notify` + email ranked by
             `change_request_impact_rank`); review is seen-is-approved.
BREAKS
1. **BROKEN (CLOSEOUT F-NEW-1, standing)** — `record_signature` is granted to `anon` +
   `authenticated`: a direct PostgREST call bypasses the one gate §1.1 built. Owner
   question 4 pending.
2. **BROKEN (CLOSEOUT F-NEW-2, standing)** — termination never releases the horse:
   `horses.lessee_contact_id` / the LESSEE relationship survive a terminated lease until
   staff clear them manually.
3. **Inherited (CONTRACTWALK A4, half-mitigated)** — expired/superseded/redeemed tokens
   raise one identical error; the browser mitigates all but the already-activated case,
   which CLOSEOUT §1.3 then fixed. Residual: the RPC-level message is still uniform.
4. **Inherited (CONTRACTWALK B-class)** — lock-time silence: nobody is told about the two
   horse documents when they appear at execution either; `TXN.LEASE_END` not required is
   now owner-ruled evergreen, not a break.
5. **UNPROVEN** — every render (RETEST §4, steps 27–34) and every real email.

---

## F8 — Sale / deal envelope (Bill of Sale)

TRIGGER      Staff: DealsPage `create_deal` (`/app/ops/deals`, currently behind the Records
             Deals tab — SURFACE-INVENTORY §3) or NewContractPage sale path
             (`startSaleContract`).
ACTORS       staff · buyer · seller · system: same execution triggers as F7.
PRECONDITION Deal-client onboarding done (onboarding F1; the A1 three-docs defect that
             walled Deal clients is fixed via the checkbox truth — CLOSEOUT §1.6).

SEQUENCE
1. Deal envelope created (`deals` row `pending`); documents attach
   (`addDealDocument`, `bos_generate_document` for BILL_OF_SALE; HORSE_SALE_V2 as the
   governing agreement — sale build 3475dd4).
2. Compose/complete/lock/sign exactly as F7 steps 2–6 (same engine).
3. On execution of the GOVERNING document, `deal_autocomplete_on_execution`:
   template predicate `is_horse_lease_template(key) OR key='HORSE_PURCHASE_SALE' OR
   contract_kind IN ('HORSE_SALE','HORSE_BILL_OF_SALE')` (prod body, this trace) —
   attachment documents can never trigger it. Envelope `contracts` → executed; the deal
   itself completes **only when `deal_completion_state(id)->>'can_complete'`** — otherwise
   it stays `pending` with the envelope executed.
4. `voidDeal` is a real named undo (SURFACE-INVENTORY calls it one of very few).

NOTIFIES     Same spine as F7.
TERMINAL     `deals.status='complete'` + `completed_at`. Prod: **0 deals ever** — the whole
             flow is UNPROVEN in production use (server-proven in rolled-back walks only).
BREAKS
1. **PARTIAL** — the two disagreeing completeness checks CONTRACTWALK found (deal-side)
   were consolidated for signing (CLOSEOUT §1.1); `deal_completion_state` remains its own
   stricter, deliberate second rule for the ENVELOPE — by design, not drift. Recorded so
   the next reader doesn't re-flag it.
2. **UNPROVEN** — no deal has existed in prod; first real sale exercises this cold.

---

## F9 — Counterparty invitation (party without an account)

TRIGGER      Staff on the contract page ("invite them"), or the visitor-initiated
             `/sign/deal` claim (onboarding.md F2 variant).
ACTORS       staff or visitor · system: `api/contract-invite.ts` / `api/sign-start.ts`.

SEQUENCE
1. `invite_contract_counterparty` mints a CONTRACT-kind invitation;
   `/api/contract-invite` emails the branded register link (staff path), or sign-start's
   deal branch does the same for a self-service claimant (fill-blanks-only, anti-oracle
   response).
2. Activation redeems via `redeem_contract_invitation` → account created, contact promoted,
   landed **on the contract** — no signing wall, no onboarding list (PARTYROLE round trip,
   RETEST 27).
3. From there F7 step 5 onward.

TERMINAL     Counterparty signs; invitation `redeemed`.
BREAKS       **UNPROVEN** — render + email (RETEST 27); server halves query-proven in
             PARTYROLE/CLOSEOUT walks.
