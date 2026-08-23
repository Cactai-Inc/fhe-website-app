-- TASK-CREDITGRANT 5 — "generate a balance owed and REQUEST PAYMENT".
--
-- Requesting payment is a deliberate staff act, never a side effect of billing and
-- never a recurring dunning loop (task §5; D9's no-dunning ruling survives — what
-- changes is that a HUMAN may ask once, on purpose).
--
-- It reuses the existing unpaid-balance spine `notify_purchase_unpaid` (buyer
-- notification + the staff review-queue notice) rather than raising a second kind of
-- notice. What it adds is (a) the staff gate and the "there is actually something
-- owed" check, (b) the word on the order's timeline, and (c) a send key so the email
-- half is provable.
--
-- WHY AN EMAIL AT ALL, when the notification already exists: `notifications` rows are
-- emailed by the daily `notifications-nudge` cron — and no Vercel cron has ever run on
-- this project (0 of 128 notification rows have `emailed_at` set, checked 2026-08-23).
-- A request for payment that reaches nobody is not a request. So one email is sent
-- immediately, through the app's ONE send path (api/_lib/email.ts + a DB email
-- template), and every attempt is logged — mirroring `receipt_sends`, exactly as
-- `request_alert_sends` already does for inbound alerts. No row at all means the
-- endpoint never ran.

CREATE TABLE IF NOT EXISTS public.payment_request_sends (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  purchase_id      uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  idempotency_key  text NOT NULL UNIQUE,
  recipient_email  text,
  amount_due       numeric,
  succeeded        boolean NOT NULL,
  error            text,
  message_id       text,
  requested_by     uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  attempted_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_request_sends_purchase_idx
  ON public.payment_request_sends (purchase_id);

ALTER TABLE public.payment_request_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_request_sends_staff ON public.payment_request_sends;
CREATE POLICY payment_request_sends_staff ON public.payment_request_sends
  FOR SELECT TO authenticated
  USING (coalesce(has_staff_access(), false) AND org_id = current_org());

COMMENT ON TABLE public.payment_request_sends IS
  'TASK-CREDITGRANT: one row per attempt to email a client about a balance owed — success or failure, with the provider error verbatim. Mirrors receipt_sends / request_alert_sends. No row at all means the endpoint never ran.';

-- ── the staff act ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_purchase_payment(
  p_purchase_id uuid,
  p_note        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org   uuid := current_org();
  v_pu    purchases%ROWTYPE;
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
  v_due   numeric;
  v_label text;
  v_user  uuid;
  v_email text;
  v_key   text;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'only staff may request payment';
  END IF;

  SELECT * INTO v_pu FROM purchases
   WHERE id = p_purchase_id AND deleted_at IS NULL AND org_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found in this organization';
  END IF;

  v_due := greatest(coalesce(v_pu.amount, 0) - coalesce(v_pu.amount_paid, 0), 0);
  IF v_pu.status = 'void' THEN
    RAISE EXCEPTION 'that order is void — there is nothing to collect';
  END IF;
  IF coalesce(v_pu.payment_status, '') = 'paid' OR v_due <= 0 THEN
    RAISE EXCEPTION 'that order owes nothing';
  END IF;

  SELECT string_agg(pi.label, ', ' ORDER BY pi.created_at) INTO v_label
    FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id AND pi.voided_at IS NULL;
  v_label := coalesce(nullif(btrim(v_label), ''), 'Your order');

  SELECT pr.user_id, pr.email INTO v_user, v_email
    FROM profiles pr WHERE pr.contact_id = v_pu.buyer_contact_id LIMIT 1;
  IF v_email IS NULL THEN
    SELECT c.email INTO v_email FROM contacts c WHERE c.id = v_pu.buyer_contact_id;
  END IF;

  -- The existing spine raises the buyer + staff "payment due" pair. One notice, not two.
  PERFORM notify_purchase_unpaid(p_purchase_id);

  -- A note from staff rides as its own line so the client sees WHY they are being asked.
  IF v_note IS NOT NULL AND v_user IS NOT NULL THEN
    PERFORM notify_user(v_user, 'purchase_unpaid',
      v_label || ' — a note from us', v_note, '/order/' || p_purchase_id::text);
  END IF;

  PERFORM log_status_event('order', p_purchase_id, 'payment_requested',
    'Payment of ' || fmt_money(v_due) || ' requested'
      || coalesce(' — ' || v_note, ''), v_org);

  -- The key the email half logs its attempt under. Unique per request, because staff
  -- may legitimately ask twice a fortnight apart — this is not a "single and provable"
  -- receipt, it is a repeatable deliberate act.
  v_key := 'payreq:' || p_purchase_id::text || ':' || to_char(now(), 'YYYYMMDD"T"HH24MISSMS');

  RETURN jsonb_build_object(
    'purchase_id',  p_purchase_id,
    'display_code', v_pu.display_code,
    'amount_due',   v_due,
    'label',        v_label,
    'recipient',    v_email,
    'note',         v_note,
    'send_key',     v_key);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_purchase_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_purchase_payment(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.request_purchase_payment(uuid, text) IS
  'TASK-CREDITGRANT: one deliberate staff request for an owed balance. Reuses notify_purchase_unpaid, writes the order timeline, and returns the send key the email half logs under. Not dunning: nothing schedules this.';

-- ── the delivery log (service-role writer, mirroring log_receipt_send) ───────
CREATE OR REPLACE FUNCTION public.log_payment_request_send(
  p_purchase_id uuid,
  p_key         text,
  p_recipient   text,
  p_succeeded   boolean,
  p_amount_due  numeric DEFAULT NULL,
  p_error       text    DEFAULT NULL,
  p_message_id  text    DEFAULT NULL,
  p_requested_by uuid   DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM purchases WHERE id = p_purchase_id;
  IF v_org IS NULL THEN RETURN; END IF;
  INSERT INTO payment_request_sends (org_id, purchase_id, idempotency_key, recipient_email,
                                     amount_due, succeeded, error, message_id, requested_by)
  VALUES (v_org, p_purchase_id, p_key, p_recipient, p_amount_due, p_succeeded,
          p_error, p_message_id, coalesce(p_requested_by, auth.uid()))
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.log_payment_request_send(uuid, text, text, boolean, numeric, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_payment_request_send(uuid, text, text, boolean, numeric, text, text, uuid) TO authenticated, service_role;
