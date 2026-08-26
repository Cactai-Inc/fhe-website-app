-- PAYMENTS BECOME RECORDS WITH THEIR OWN NUMBERS.
--
-- Owner, 2026-08-25 (CR-76b):
--   "My Payments is a history ledger showing every time a payment page was
--    engaged with and what it saved and what its assocaited with, when it was
--    done, all the changes made if any exist, and the fuller picture of the
--    status and timestamps... we would create a payment number along side an
--    order number"
--   "yes we need to have a payment number as an identifier that is unique to each
--    input on the payment screen."
--
-- WHY THIS IS A TABLE AND NOT A COLUMN. Payment lived on the order as
-- `purchases.payment_method` — ONE text column, so one method per order. That is
-- why the answer to "can a user split payment among cash and zelle" was no:
-- `amount_paid` existed and `partial_payment` was a defined status_events term
-- (used zero times), so a partial AMOUNT was modelled while the METHOD that paid
-- it had nowhere to live. A payment record per input IS split payment — two rows
-- against one order, one Zelle, one cash, each numbered and timestamped.
--
-- It also retires that column as the source of truth, which is where the
-- 'Zelle' vs 'zelle' casing bug lives (CR-76): the dropdown wrote capitalised
-- values while every production row and the declaration path are lowercase, so a
-- value written through that control matched nothing. The CHECK below admits
-- lowercase only, and there are exactly two methods — owner, 2026-08-25:
-- "thats it there are only two choices for payment". Card and check were never
-- authorised; Stripe is not set up.
--
-- THE THREE STATES ARE HIS LADDER, UNCHANGED (CR-76):
--   awaiting payment  the order exists and nothing has been chosen — this is the
--                     ABSENCE of a payment row, not a status. Unchosen, not empty.
--   pending           THEY SELECTED a method, declaring they have paid or will.
--                     Client-editable: the method may be changed and nothing else.
--   paid              WE VERIFIED the money arrived.
--
-- ⚠️ `purchases.payment_method` / `payment_status` / `amount_paid` are NOT
-- dropped (D32). They are kept in step by the roll-up below so every existing
-- reader keeps working, and they become derived rather than authored.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS payment_code_seq START 1;

CREATE TABLE IF NOT EXISTS public.payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code      text UNIQUE,
  org_id            uuid NOT NULL,
  -- The transaction this payment is against. "each entry is linked to some type
  -- of transaction, as of now that can only be an order" — so the column is
  -- nullable and named for what it points at, and a second transaction type
  -- later is a second column plus a CHECK, not a re-shape of this one.
  purchase_id       uuid REFERENCES public.purchases(id) ON DELETE RESTRICT,
  payer_contact_id  uuid REFERENCES public.contacts(id),
  method            text NOT NULL CHECK (method IN ('zelle','cash')),
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  -- What matches this entry to money actually received: a Zelle memo, a receipt
  -- number, "handed to Claire at the barn".
  reference         text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','declined','cancelled')),
  declared_at       timestamptz NOT NULL DEFAULT now(),
  declared_by       uuid,
  confirmed_at      timestamptz,
  confirmed_by      uuid,
  decline_reason    text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  deleted_by        uuid
);

CREATE INDEX IF NOT EXISTS payments_purchase_idx ON public.payments(purchase_id);
CREATE INDEX IF NOT EXISTS payments_payer_idx    ON public.payments(payer_contact_id);
CREATE INDEX IF NOT EXISTS payments_org_idx      ON public.payments(org_id);

DROP TRIGGER IF EXISTS payments_assign_code ON public.payments;
CREATE TRIGGER payments_assign_code BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION assign_display_code('PAY-', 'payment_code_seq');

DROP TRIGGER IF EXISTS payments_set_updated_at ON public.payments;
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: the same three policies purchases carries, for the same reasons ────
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_org_boundary ON public.payments;
CREATE POLICY payments_org_boundary ON public.payments
  FOR ALL USING (org_id = current_org());

DROP POLICY IF EXISTS payments_staff_all ON public.payments;
CREATE POLICY payments_staff_all ON public.payments
  FOR ALL USING (has_staff_access());

DROP POLICY IF EXISTS payments_member_own_select ON public.payments;
CREATE POLICY payments_member_own_select ON public.payments
  FOR SELECT USING (payer_contact_id = current_contact_id());

-- ── THE LEDGER VOCABULARY ──────────────────────────────────────────────────
-- status_events is already the audit trail and already carries entity_type
-- 'order'. Payments join it rather than growing a second event log (D18).
-- ⚠️ BOTH tables carry the same entity_type CHECK, and neither admits 'payment'.
-- Widen them together — they are one vocabulary written twice, and widening only
-- one produces events that cannot be labelled or a vocabulary nothing can use.
ALTER TABLE public.status_events
  DROP CONSTRAINT IF EXISTS status_events_entity_type_check;
ALTER TABLE public.status_events
  ADD CONSTRAINT status_events_entity_type_check CHECK (entity_type = ANY (ARRAY[
    'account','document','order','offering','fulfillment','lesson_plan','payment']));

ALTER TABLE public.status_events_vocab
  DROP CONSTRAINT IF EXISTS status_events_vocab_entity_type_check;
ALTER TABLE public.status_events_vocab
  ADD CONSTRAINT status_events_vocab_entity_type_check CHECK (entity_type = ANY (ARRAY[
    'account','document','order','offering','fulfillment','lesson_plan','payment']));

INSERT INTO public.status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES
  ('payment', 'declared',        'Payment declared by client',   true,  false, 10),
  ('payment', 'method_changed',  'Payment method changed',       false, false, 20),
  ('payment', 'confirmed',       'Payment confirmed received',   true,  true,  30),
  ('payment', 'declined',        'Payment could not be verified',false, true,  40),
  ('payment', 'cancelled',       'Payment cancelled',            false, true,  50),
  ('payment', 'staff_recorded',  'Payment recorded by staff',    true,  false, 15)
ON CONFLICT DO NOTHING;

COMMIT;
