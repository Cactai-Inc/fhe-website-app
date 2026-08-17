-- CAREPATH §C6 — TWO EMAILS, BOTH PROVABLE.
--
-- Owner: "We should also get all this information in an email. And the
-- submitter should get an email with the information they sent us. (This
-- includes the selections from step 2)."
--
-- ⚠️ TWO REAL LEADS WERE LOST HERE BEFORE, because the send was fire-and-forget
-- behind a best-effort 200 and could not report failure
-- (`orchestration/lessons/LESSONS.md`). `request_alert_sends` already records
-- one row per ATTEMPT for the staff alert. This migration makes that table hold
-- BOTH emails, discriminated by `kind`, so the buyer's confirmation is exactly
-- as provable as the staff alert and neither can be reported from an assumption.
--
-- ⚠️ The buyer email is a CONFIRMATION OF WHAT THEY SUBMITTED, NOT A BOOKING
-- CONFIRMATION. Nothing is scheduled until staff call, and the template below
-- says so in its own words. Owner-ruled 2026-08-17: it shows a price where the
-- offering carries one and "Price on inquiry" where it does not — the same
-- thing the website already showed them, no new information.

-- ── 1. One table, two kinds of send ─────────────────────────────────────────
ALTER TABLE request_alert_sends
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'staff';
ALTER TABLE request_alert_sends
  DROP CONSTRAINT IF EXISTS request_alert_sends_kind_check;
ALTER TABLE request_alert_sends
  ADD CONSTRAINT request_alert_sends_kind_check CHECK (kind IN ('staff', 'buyer'));
COMMENT ON COLUMN request_alert_sends.kind IS
  'CAREPATH C6: which of the two inquiry emails this attempt was — the staff '
  'alert or the submitter''s own copy. Every attempt of either is a row.';

-- ── 2. "Provable and single" is now PER KIND ────────────────────────────────
-- The old guard refused a second send once ANY alert for the request had
-- succeeded. With two kinds sharing the table that would have made a successful
-- staff alert silently suppress the buyer's copy — the exact class of bug this
-- table exists to prevent. A prior FAILURE still leaves the door open, because
-- a failed email still owes someone a message they never got.
CREATE OR REPLACE FUNCTION public.claim_request_alert_send(
  p_request_id uuid, p_key text, p_kind text DEFAULT 'staff')
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM request_alert_sends
              WHERE request_id = p_request_id
                AND kind = coalesce(p_kind, 'staff')
                AND succeeded) THEN
    RETURN false;                                   -- provable and single, per kind
  END IF;
  RETURN NOT EXISTS (SELECT 1 FROM request_alert_sends WHERE idempotency_key = p_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_request_alert_send(
  p_request_id uuid, p_key text, p_recipient text, p_succeeded boolean,
  p_error text DEFAULT NULL::text, p_message_id text DEFAULT NULL::text,
  p_kind text DEFAULT 'staff')
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM requests WHERE id = p_request_id;
  IF v_org IS NULL THEN RETURN; END IF;   -- no such request: nothing to anchor to
  INSERT INTO request_alert_sends (org_id, request_id, idempotency_key, recipient_email,
                                   succeeded, error, message_id, kind)
  VALUES (v_org, p_request_id, p_key, p_recipient, p_succeeded, p_error, p_message_id,
          coalesce(p_kind, 'staff'))
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$function$;

-- ── 3. What the two endpoints read: the inquiry, its selections, its order ──
-- One definer reader so neither endpoint hand-rolls the join, and so the buyer
-- email cannot accidentally be built from a different set of rows than the
-- staff one. Service-role only — it returns a person's contact details.
CREATE OR REPLACE FUNCTION public.inquiry_email_payload(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'request_id', r.id,
    'org_id', r.org_id,
    'contact_name', r.contact_name,
    'contact_email', r.contact_email,
    'contact_phone', r.contact_phone,
    'contact_method', r.contact_method,
    'category', r.category,
    'created_at', r.created_at,
    -- The SELECTIONS the staff email never carried (§C6) and the buyer's copy
    -- is mostly made of. Price comes from the CATALOG, not from the cart, so a
    -- stale browser cannot put a number in an email; a NULL price stays NULL
    -- and both emails render "Price on inquiry" from it.
    'selections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'label', coalesce(rs.label, o.name),
               'price_amount', o.price_amount,
               'price_unit', o.price_unit)
             ORDER BY coalesce(rs.label, o.name))
        FROM request_selections rs
        LEFT JOIN offerings o ON o.id = rs.offering_id
       WHERE rs.request_id = r.id), '[]'::jsonb),
    'order', (
      SELECT jsonb_build_object('display_code', p.display_code, 'amount', p.amount,
                                'status', p.status, 'current_status', p.current_status)
        FROM purchases p
       WHERE p.request_id = r.id AND p.deleted_at IS NULL
       ORDER BY p.created_at LIMIT 1)
  )
  FROM requests r WHERE r.id = p_request_id;
$function$;

REVOKE ALL ON FUNCTION public.inquiry_email_payload(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inquiry_email_payload(uuid) TO service_role;

-- ── 4. The buyer's confirmation email — CONTENT AS DATA (D13) ───────────────
-- Prose and subject live in `email_templates` exactly as every other email in
-- this system does, so the barn re-words it in the Templates editor without a
-- deploy. What stays in code is plumbing: who receives it, idempotency and the
-- delivery record.
INSERT INTO email_templates (email_key, title, description, category, subject, body,
                             draft_subject, draft_body,
                             from_address_rule, reply_to_rule, recipient_note,
                             transactional, version, active)
VALUES (
  'INQUIRY_CONFIRMATION',
  'Your inquiry — the submitter''s copy',
  'Sent to the person who submitted a website inquiry, confirming what they sent us. NOT a booking confirmation: nothing is scheduled until staff call.',
  'INBOUND',
  'We have your inquiry — {{ORG.NAME}}',
$body$<p>Hi {{MSG.RECIPIENT_NAME_HTML}},</p>

<p>Thank you for reaching out. This is a copy of what you sent us, so you have it
in writing. <strong>Nothing is scheduled yet</strong> — we will agree the timing
with you when we speak.</p>

{{#if REQ.CONTACT_METHOD_HTML}}<p>You asked us to reach you by
<strong>{{REQ.CONTACT_METHOD_HTML}}</strong>, and we will. We normally answer
within a few hours.</p>{{/if}}

<h3>What you asked about</h3>
<ul>
{{#each REQ.SELECTIONS}}<li>{{.LABEL}} — {{.PRICE}}</li>
{{/each}}</ul>

{{#if REQ.DETAILS}}<h3>What you told us</h3>
<ul>
{{#each REQ.DETAILS}}<li><strong>{{.LABEL}}:</strong> {{.VALUE}}</li>
{{/each}}</ul>{{/if}}

{{#if REQ.NOTES_HTML}}<h3>Your note</h3>
<p>{{REQ.NOTES_HTML}}</p>{{/if}}

<p>If anything above is wrong, just reply to this email and tell us.</p>

<p>{{ORG.FOOTER_HTML}}</p>$body$,
  NULL, NULL,
  'tenant', 'none',
  'The person who submitted the inquiry (requests.contact_email).',
  true, 1, true
)
ON CONFLICT (email_key) DO NOTHING;

-- ── 5. §C6 — the STAFF alert must now carry the SELECTIONS ──────────────────
-- Owner: "It must now carry the selections and the step-2 answers, not just a
-- bare notification." The answers already ride in REQ.DETAILS (ASKRIGHT §A5);
-- the SELECTIONS were never in this email at all, so an owner reading it could
-- not tell what the person actually asked to buy without opening the app.
--
-- Appended as data (D13): the barn can move, re-word or delete this block in
-- the Templates editor. Guarded so re-running the migration cannot append it
-- twice.
UPDATE email_templates
   SET body = body || $add$<h3 style="margin:16px 0 6px">What they asked about</h3><ul style="padding-left:18px">{{#each REQ.SELECTIONS}}<li>{{.LABEL}} — {{.PRICE}}</li>{{/each}}</ul>{{#if REQ.ORDER_CODE_HTML}}<p style="margin:6px 0"><strong>Order:</strong> {{REQ.ORDER_CODE_HTML}} — {{REQ.ORDER_STATUS_HTML}}. Nothing is owed until it is confirmed.</p>{{/if}}$add$,
       version = version + 1,
       updated_at = now()
 WHERE email_key = 'REQUEST_RECEIVED'
   AND body NOT LIKE '%REQ.SELECTIONS%';
