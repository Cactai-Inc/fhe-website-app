-- Stage 5 verification fixes (owner-authorized, 2026-07-28):
--
-- S5.4 FAIL: log_mirror_delivery inserted org_id into document_deliveries,
--   which has NO such column (id, document_id, recipient_contact_id, channel,
--   copy_url, delivered_at, created_at, deleted_at, deleted_by, is_mirror).
--   Every invocation threw. The same defect exists in the PARTY-copy insert in
--   api/deliver-documents.ts, which is why document_deliveries has sat at 0
--   rows permanently — ALL delivery logging, party and mirror, has been
--   silently broken. Both paths are fixed; call sites now surface failures
--   instead of swallowing them (see the api/ diff).
--   Historical sends CANNOT be backfilled — the rows were never written and no
--   provider-side record ties back to (document, recipient). Accepted and noted.
--
-- S5.x calendar_money_items filtered bookings on status 'hold', which the
--   bookings CHECK forbids — a dead half-condition that could never match.
--   Evidence for the replacement: the CHECK allows
--   draft/available/unavailable/pending/pending_slot/pending_payment/
--   confirmed/cancelled/expired/completed/scheduled/no_show. The
--   awaiting-confirmation states are the three pending* values (used by
--   confirm_booking / booking_status_code and typed in src/lib/types.ts).
--   Also: bookings.hold_expires_at is null on every row and is written by
--   NOTHING — hold_expires_at is a request_selections concept (reap_expired_
--   holds and api/expire-holds.ts both key on request_selections). So the
--   confirmation window is keyed on starts_at, which every booking has.

CREATE OR REPLACE FUNCTION public.log_mirror_delivery(p_document_id uuid, p_channel text, p_copy_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- document_deliveries has no org_id column; the document carries the org.
  INSERT INTO document_deliveries (document_id, recipient_contact_id, channel, copy_url, is_mirror)
  VALUES (p_document_id, company_contact_id(), p_channel, p_copy_url, true)
  ON CONFLICT DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calendar_money_items(p_from timestamptz, p_to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'at'), '[]'::jsonb) FROM (
    -- payment due
    SELECT jsonb_build_object(
      'kind','payment','at', p.created_at, 'label',
      'Payment due · $' || round(coalesce(p.amount,0))::text,
      'ref', p.id, 'status', p.payment_status) AS x
      FROM purchases p
     WHERE p.deleted_at IS NULL AND p.payment_status <> 'paid' AND p.status <> 'void'
       AND p.created_at BETWEEN p_from AND p_to
       AND (has_staff_access() OR p.buyer_user_id = auth.uid() OR p.buyer_contact_id = current_contact_id())
    UNION ALL
    -- gift expirations
    SELECT jsonb_build_object(
      'kind','expiration','at', g.expires_at, 'label',
      'Gift expires · ' || coalesce(g.item_label,'gift'), 'ref', g.id, 'status', g.status)
      FROM gifts g
     WHERE g.expires_at BETWEEN p_from AND p_to AND g.status <> 'redeemed'
       AND (has_staff_access() OR g.buyer_user_id = auth.uid()
            OR lower(g.recipient_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())))
    UNION ALL
    -- confirmations pending: the three real awaiting-confirmation statuses,
    -- dated by starts_at (bookings never carry hold_expires_at).
    SELECT jsonb_build_object(
      'kind','confirmation','at', b.starts_at, 'label',
      'Confirm your booking', 'ref', b.id, 'status', b.status)
      FROM bookings b
     WHERE b.starts_at BETWEEN p_from AND p_to
       AND b.status IN ('pending','pending_slot','pending_payment')
       AND (has_staff_access() OR b.account_user_id = auth.uid() OR b.account_contact_id = current_contact_id())
  ) s;
$function$;
GRANT EXECUTE ON FUNCTION public.calendar_money_items(timestamptz, timestamptz) TO authenticated;
