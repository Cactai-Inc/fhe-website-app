# FLOWS — FULFILMENT (the obligations spine)

**Traced at main `c56559e` (2026-08-20), prod read-only.**
Areas touched: none directly — that is the headline finding. The spine is written by
**Public site** checkouts, **Member app** bookings, **Management** provisioning and
evaluations, and consumed by DB triggers; **no routed surface reads it back** (§F14
BREAKS 1). Incumbents absorbed: FLOWTRACE §§8/11/13, CLOSEOUT §2, D6 spine design.

---

## F13 — Minting: purchase → units (+ credits)

TRIGGER      Any `purchase_items` insert: provisioning (F1), member checkout
             (commerce.md F10), booking's debit-or-create (BOOKLINK), gift redemption.
ACTORS       system only (triggers) — no human sees this happen.

SEQUENCE
1. `purchase_items` AFTER INSERT fires four triggers (trigger map, this task's psql pass):
   - `trg_generate_fulfillment_units` → one `fulfillment_units` row per
     `offerings.unit_count × quantity`, `unit_kind` from the offering's `config_kind`
     (`session` | `period`; prod: 8 session, 2 period).
   - `trg_mint_purchase_credits` → `_mint_credits_for_purchase_item`: credits also
     `unit_count × quantity` off the catalog (prod body; the FLOWTRACE F8 name-regex and
     the F2 segment-blind mint are both GONE — CREDITALIGN + the 2026-08-16 owner ruling
     that single care services mint one offering-tagged credit, CLOSEOUT §2.2).
   - `attach_first_purchase_policies` — first-purchase document requirements.
   - `promote_buyer_from_offering` — buyer promotion (lead → client shape).
2. `purchases` UPDATE fires `trg_mint_credits_when_order_opens` — a DRAFT order mints
   nothing; opening it mints (CLOSEOUT §2.1 bonus proof). Recurring months are minted by
   the `mint-monthly-allotments` cron (booking.md F6).

TERMINAL     Open units + spendable credits. **The two-ledger problem is now one seam:**
             both ledgers mint from the same catalog numbers; they remain two tables with
             two consumption paths (credits spent at booking, units at completion).
BREAKS
1. **Inherited-and-narrowed (FLOWTRACE F8)** — the ledgers no longer disagree at mint;
   they can still disagree at consumption (a cancelled-after-completion path refunds the
   credit via `_refund_booking_credit` while `trg_booking_unit_link` returns the unit —
   two independent reversals that happen to agree today). UNPROVEN either way: no
   completion has ever occurred.

---

## F14 — Consumption and the execution trigger question

TRIGGER      A unit-bearing thing reaches its terminal act: a booking completes, an
             evaluation report delivers, a governing document executes.
ACTORS       staff (they perform every consuming act) · system triggers.

SEQUENCE
1. **Booking**: `complete_lesson_session` → `scheduled → completed` →
   `trg_booking_unit_link` (AFTER INS/UPD on bookings) consumes the matched unit
   (`consume_unit_for_booking` — BOOKWRITE's offering-preference ORDER BY, verified live
   by FLOWTRACE §13); cancel returns it.
2. **Evaluation**: `trg_evaluation_unit_link` (AFTER UPD on evaluation_reports) consumes
   on delivery (commerce.md F11).
3. **Document execution** (the handed-forward question, resolved):

   ### `deal_autocomplete_on_execution` — FIRES, on one of the two execution paths
   - The trigger is real and armed: `AFTER UPDATE OF workflow_state ON documents`
     (pg_get_triggerdef, this trace).
   - `record_signature` (the path every contract-engine signature takes) executes with
     `UPDATE documents SET status='EXECUTED', …, workflow_state='executed'` — the SET
     list **names `workflow_state`**, so the trigger fires (prod functiondef line 106).
     CLOSEOUT §1.7's walk shows the observable effect: envelope `draft` → `executed`
     beside the document, in the same transaction.
   - **It has never fired in production** — 0 `contracts` rows, 0 `deals` rows — but that
     is absence of use, not absence of wiring. Verdict: **WORKS (walk-proven), unexercised.**
   - CONTRACTWALK's "trapped in a branch that never runs" described the pre-CLOSEOUT
     template predicate; §1.7's migration (`20260819T0140`) widened it to
     `contract_kind IN ('HORSE_SALE','HORSE_BILL_OF_SALE')` and it no longer holds.
     **Do not carry that claim forward.**
4. `trg_status_bookings` / `trg_status_purchases` / `trg_status_documents` write
   `status_events` on each transition.

TERMINAL     `fulfillment_units.current_status='consumed'` + a `status_events` row.
             Prod: 6 open, 4 scheduled, **0 consumed, 0 fulfilment status events ever** —
             the spine has still never once run to its end (FLOWTRACE §11, re-verified
             by count this trace).
BREAKS
1. **BROKEN (D19 corollary, re-verified)** — the obligations ledger is invisible:
   `grep -rn "fulfillment_units\|my_fulfillment" src/` returns **zero** rows at `c56559e`.
   Four ledgers are written (`fulfillment_units`, `status_events`, `lesson_credits`,
   `document_deliveries`) and only `status_events` is read back by any surface
   (ActivityPage — SURFACE-INVENTORY §3). Staff deliver against hand-typed punch-card
   counts in booking notes ("Melanie 3/8"), which remain live procedure and are drifting
   (FLOWTRACE §11 — inherited, not re-counted).
2. **BROKEN (new, this trace) — the second execution path skips the execution triggers.**
   `sign_release` executes kiosk documents with an UPDATE that does **not** name
   `workflow_state` (functiondef, UPDATE at the "EXECUTED once every signer" block).
   Postgres fires `AFTER UPDATE OF workflow_state` only when the column is in the
   statement's SET list — the BEFORE sync trigger (`documents_sync_workflow_on_status`)
   still writes the VALUE, so the row looks executed, but
   `apply_contract_execution_effects`, `deal_autocomplete_on_execution` and
   `snapshot_execution_audit` all silently skip. Today's kiosk documents are releases
   (the effects would early-return anyway), so the live damage is: **no execution audit
   snapshot for any kiosk-signed document** — and a latent trap the moment any
   lease/sale-class template becomes signable through a status-only writer.
   `advance_document_workflow` and `approve_contract_termination` write
   `workflow_state` explicitly and are safe.
3. **UNPROVEN** — unit consumption end-to-end (needs one real completed booking);
   `delivery-sweep`'s re-raise (needs one observed cron run).

---

## F15 — Document delivery and re-delivery (the fulfilment of paper)

TRIGGER      Execution (automatic, pg_net → `/api/deliver-documents`) · staff resend
             (`/api/deliver-document`, DeliveryPanel) · member self-send
             (`/api/deliver-my-document`, "email me a copy") · working copy
             (`/api/contract-working-copy`, caller-only, watermarked NOT EXECUTED).
ACTORS       system (pg_net, `delivery-sweep` hourly cron) · staff · member.

SEQUENCE
1. Execution stamps `executed_email_sent_at` at queue time; the durable proof is a
   `document_deliveries` row per (party, EMAIL), written only after a real provider send
   (delivery-sweep header — the two timestamps are deliberately different truths).
2. `sweep_undelivered_executed_documents()` (cron) finds executed docs >10 min old with a
   party missing its delivery row, raises ONE staff notification per document, marks
   `executed_email_error` so the alert never repeats.
3. Guardian addressing for minors (C10); non-executed documents are refused delivery
   (409) everywhere except the watermarked working copy.

TERMINAL     One `document_deliveries` row per recipient (prod: 35 EMAIL rows — written by
             the kiosk in-process path; which proves that sender works).
BREAKS
1. **UNPROVEN** — the pg_net execution email and the sweep have never been observed for a
   contract-engine document (all 35 delivery rows trace to kiosk/participant sends).
2. **Inherited (DUAL_IDENTITY_TRACE §4)** — deliveries record who received, never which
   hat sent; company mirror copies are unlogged.
